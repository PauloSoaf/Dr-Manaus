/**
 * ProceduralGalaxyDiscovery.ts
 *
 * Cosmological procedural galaxy streaming and discovery authority for U4.3.
 *
 * Responsibilities:
 *   - Bounded deterministic streaming and spatial discovery of procedural galaxies
 *     partitioned into 2 Mpc cosmological cells (`BigInt3`).
 *   - Bounded LRU cache of discovered cells preventing unbounded memory growth.
 *   - Exact identity lookup and resolution by procedural ID (`galaxy_c{x}_{y}_{z}_{idx}`)
 *     and canonical astronomical entities (`milky_way`, `andromeda`, etc.).
 *   - Multiscale spatial search by coordinate, identifier, or procedural designation.
 *   - Controlled spatial query budgets to prevent main-thread spikes during cosmic zoom.
 *   - ManagedSubsystem integration for GlobalStreamingScheduler compatibility.
 *
 * Architectural Contracts:
 *   - Pure mathematical determinism: zero Math.random, zero Date.now.
 *   - BigInt arithmetic for cell coordinates: safe at arbitrary magnitudes (> 2^53).
 *   - Canonical Local Group preservation (cell 0,0,0).
 *   - Strictly decoupled from continuous transit / flight physics (U4.4).
 */

import {
  type BigInt3,
  type CosmologicalAddress,
  type SectorIndex,
} from '../spatial/UniverseAddress';
import { type Vec3 } from '../spatial/units';
import {
  ProceduralGalaxyGenerator,
  type ProceduralGalaxyDescriptor,
  COSMOLOGICAL_CELL_SIZE_MPC,
  COSMOLOGICAL_CELL_SIZE_M,
  GALAXY_INDEX_MAX,
  assertValidGalaxyIndex,
  isCellInFloatDomain,
  cosmologicalPositionM,
} from './ProceduralGalaxyGenerator';
import { LOCAL_GROUP_CATALOG, type GalaxyDefinition } from '../celestial/GalaxyDefinition';

/** Default universe seed derived from ASCII 'DRMANAUS' */
export const DEFAULT_UNIVERSE_SEED = 0x4452_4d41_4e41_5553n;

/** Maximum cosmological cells cached in memory before LRU eviction. */
export const DEFAULT_MAX_CACHED_CELLS = 128;

/** Maximum galaxies returned per spatial region discovery query. */
export const DEFAULT_MAX_REGION_GALAXIES = 64;

/** Serialises BigInt3 cell coordinate into an exact cache key. */
export function cosmologicalCellKey(cell: BigInt3): string {
  return `c${cell.x.toString(10)}_${cell.y.toString(10)}_${cell.z.toString(10)}`;
}

/** Parses cell coordinate from a string key or returns undefined if invalid. */
export function parseCosmologicalCellKey(key: string): BigInt3 | undefined {
  const match = /^c(-?\d+)_(-?\d+)_(-?\d+)$/.exec(key);
  if (!match) return undefined;
  try {
    return {
      x: BigInt(match[1]),
      y: BigInt(match[2]),
      z: BigInt(match[3]),
    };
  } catch {
    return undefined;
  }
}

/** Parsed components of a procedural galaxy ID. */
export interface ParsedGalaxyId {
  readonly cell: BigInt3;
  readonly index: number;
}

/** Parses a procedural galaxy ID (`galaxy_c{x}_{y}_{z}_{idx}`) or canonical identifier. */
export function parseGalaxyId(id: string): ParsedGalaxyId | undefined {
  let cleanId = id;
  if (id.startsWith('galaxy/')) {
    try {
      cleanId = decodeURIComponent(id.slice(7));
    } catch {
      cleanId = id.slice(7);
    }
  }
  // Canonical Local Group entities
  if (cleanId === 'milky_way') return { cell: { x: 0n, y: 0n, z: 0n }, index: 0 };
  if (cleanId === 'andromeda') return { cell: { x: 0n, y: 0n, z: 0n }, index: 1 };
  if (cleanId === 'triangulum') return { cell: { x: 0n, y: 0n, z: 0n }, index: 2 };
  if (cleanId === 'large_magellanic_cloud' || cleanId === 'lmc') return { cell: { x: 0n, y: 0n, z: 0n }, index: 3 };
  if (cleanId === 'small_magellanic_cloud' || cleanId === 'smc') return { cell: { x: 0n, y: 0n, z: 0n }, index: 4 };

  const match = /^galaxy_c(-?\d+)_(-?\d+)_(-?\d+)_(\d+)$/.exec(cleanId);
  if (!match) return undefined;
  try {
    const index = Number(match[4]);
    if (!Number.isSafeInteger(index) || index < 0 || index > GALAXY_INDEX_MAX) return undefined;
    return {
      cell: {
        x: BigInt(match[1]),
        y: BigInt(match[2]),
        z: BigInt(match[3]),
      },
      index,
    };
  } catch {
    return undefined;
  }
}

/** Spatial cell query offset with distance metric. */
interface CellOffset {
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
  readonly distSq: number;
}

/** Pre-computed concentric spatial offsets for bounded sphere exploration up to radius 5. */
function computeConcentricOffsets(maxRadius: number): readonly CellOffset[] {
  const offsets: CellOffset[] = [];
  const r = Math.max(0, Math.min(5, maxRadius));
  for (let x = -r; x <= r; x++) {
    for (let y = -r; y <= r; y++) {
      for (let z = -r; z <= r; z++) {
        const distSq = x * x + y * y + z * z;
        if (distSq <= r * r) {
          offsets.push({ dx: x, dy: y, dz: z, distSq });
        }
      }
    }
  }
  // Sort from nearest to furthest
  offsets.sort((a, b) => a.distSq - b.distSq);
  return Object.freeze(offsets);
}

const PRECOMPUTED_OFFSETS_R1 = computeConcentricOffsets(1);
const PRECOMPUTED_OFFSETS_R2 = computeConcentricOffsets(2);
const PRECOMPUTED_OFFSETS_R3 = computeConcentricOffsets(3);

export class ProceduralGalaxyDiscovery {
  readonly id = 'procedural-galaxy-discovery';

  private readonly generator: ProceduralGalaxyGenerator;
  private readonly cellCache = new Map<string, readonly ProceduralGalaxyDescriptor[]>();

  constructor(
    readonly universeSeed: bigint = DEFAULT_UNIVERSE_SEED,
    private readonly maxCachedCells: number = DEFAULT_MAX_CACHED_CELLS,
    generator?: ProceduralGalaxyGenerator,
  ) {
    this.generator = generator ?? new ProceduralGalaxyGenerator();
  }

  /** Current count of cosmological cells retained in memory. */
  get cachedCellCount(): number {
    return this.cellCache.size;
  }

  /** Clears the LRU cache (e.g. on complete cosmological region rebase). */
  clearCache(): void {
    this.cellCache.clear();
  }

  /**
   * Deterministically discovers and caches all galaxies inside a cosmological cell.
   *
   * Maintains bounded LRU order: least recently requested cell is evicted when
   * capacity is reached.
   */
  discoverCell(cell: BigInt3): readonly ProceduralGalaxyDescriptor[] {
    const key = cosmologicalCellKey(cell);
    const cached = this.cellCache.get(key);
    if (cached) {
      // Refresh LRU position
      this.cellCache.delete(key);
      this.cellCache.set(key, cached);
      return cached;
    }

    const count = this.generator.getGalaxyCountInCell(this.universeSeed, cell);
    const galaxies: ProceduralGalaxyDescriptor[] = [];
    for (let i = 0; i < count; i++) {
      galaxies.push(this.generator.generateGalaxy(this.universeSeed, cell, i));
    }

    const immutableGalaxies = Object.freeze(galaxies);
    this.cellCache.set(key, immutableGalaxies);

    // Evict oldest if exceeding capacity
    if (this.cellCache.size > this.maxCachedCells) {
      const oldestKey = this.cellCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cellCache.delete(oldestKey);
      }
    }

    return immutableGalaxies;
  }

  /**
   * Discovers galaxies in a cosmological spherical neighbourhood around `centerCell`.
   *
   * Queries concentric spherical shells from closest to furthest, stopping as soon
   * as `maxGalaxies` is reached to prevent main-thread hitching.
   */
  discoverRegion(
    centerCell: BigInt3,
    radiusCells: number = 1,
    maxGalaxies: number = DEFAULT_MAX_REGION_GALAXIES,
  ): readonly ProceduralGalaxyDescriptor[] {
    if (maxGalaxies <= 0) return Object.freeze([]);

    const r = Math.max(0, Math.min(3, Math.floor(radiusCells)));
    if (r === 0) {
      const cellGalaxies = this.discoverCell(centerCell);
      return Object.freeze(cellGalaxies.slice(0, maxGalaxies));
    }

    const offsets = r === 1
      ? PRECOMPUTED_OFFSETS_R1
      : r === 2
        ? PRECOMPUTED_OFFSETS_R2
        : PRECOMPUTED_OFFSETS_R3;

    const results: ProceduralGalaxyDescriptor[] = [];

    for (const offset of offsets) {
      const targetCell: BigInt3 = {
        x: centerCell.x + BigInt(offset.dx),
        y: centerCell.y + BigInt(offset.dy),
        z: centerCell.z + BigInt(offset.dz),
      };

      const cellGalaxies = this.discoverCell(targetCell);
      for (const g of cellGalaxies) {
        results.push(g);
        if (results.length >= maxGalaxies) {
          return Object.freeze(results);
        }
      }
    }

    return Object.freeze(results);
  }

  /**
   * Adaptive multi-scale discovery for cosmological map viewport rendering.
   *
   * For close zoom (<= 16 Mpc), queries 3D neighbourhood cells in radius 1..3.
   * For distant zoom (> 16 Mpc up to 120 Mpc), applies deterministic 4-quadrant symmetric
   * concentric sampling across the visible 2D cosmological plane (z = centerCell.z).
   * Ensures identical sampling density in all 4 quadrants without edge truncation,
   * with LOD decimation (1 galaxy per sampled cell) and strict query budgeting.
   */
  discoverVisibleRegion(
    centerCell: BigInt3,
    zoomMpc: number,
    maxGalaxies: number = DEFAULT_MAX_REGION_GALAXIES,
  ): readonly ProceduralGalaxyDescriptor[] {
    if (maxGalaxies <= 0) return Object.freeze([]);

    if (zoomMpc <= 16) {
      const radius = Math.max(1, Math.min(3, Math.ceil(zoomMpc / (2 * COSMOLOGICAL_CELL_SIZE_MPC))));
      return this.discoverRegion(centerCell, radius, maxGalaxies);
    }

    // Viewport visible span in cells (each cell is 2 Mpc)
    const spanMpc = zoomMpc * 0.6;
    const spanCells = Math.max(1, Math.ceil(spanMpc / COSMOLOGICAL_CELL_SIZE_MPC));
    const maxTiers = 4;
    const tierStep = Math.max(1, Math.floor(spanCells / maxTiers));
    const tiers = Math.max(1, Math.ceil(spanCells / tierStep));

    const results: ProceduralGalaxyDescriptor[] = [];
    const visitedKeys = new Set<string>();

    // 1. Center cell is always highest priority
    visitedKeys.add(cosmologicalCellKey(centerCell));
    const centerGalaxies = this.discoverCell(centerCell);
    for (const g of centerGalaxies) {
      results.push(g);
      if (results.length >= maxGalaxies) return Object.freeze(results);
    }

    // Helper to evaluate and collect 1 galaxy per cell
    const trySampleCell = (dx: number, dy: number): boolean => {
      const targetCell: BigInt3 = {
        x: centerCell.x + BigInt(dx),
        y: centerCell.y + BigInt(dy),
        z: centerCell.z,
      };
      const key = cosmologicalCellKey(targetCell);
      if (visitedKeys.has(key)) return false;
      visitedKeys.add(key);

      const cellGalaxies = this.discoverCell(targetCell);
      if (cellGalaxies.length > 0) {
        results.push(cellGalaxies[0]);
        if (results.length >= maxGalaxies) return true;
      }
      return false;
    };

    // 2. Symmetric concentric tiers expanding outward
    for (let t = 1; t <= tiers; t++) {
      const r = Math.min(spanCells, t * tierStep);

      // (a) Axial points: (+x, +y, -x, -y)
      const axialOffsets: readonly [number, number][] = [
        [r, 0],
        [0, r],
        [-r, 0],
        [0, -r],
      ];
      for (const [dx, dy] of axialOffsets) {
        if (trySampleCell(dx, dy)) return Object.freeze(results);
      }

      // (b) Corners: 4 quadrants (+r,+r), (-r,+r), (-r,-r), (+r,-r)
      const cornerOffsets: readonly [number, number][] = [
        [r, r],
        [-r, r],
        [-r, -r],
        [r, -r],
      ];
      for (const [dx, dy] of cornerOffsets) {
        if (trySampleCell(dx, dy)) return Object.freeze(results);
      }

      // (c) Intermediate points on edges: step symmetrically between 1 and r-1
      const intermediateSteps = Math.max(0, Math.floor(t) - 1);
      if (intermediateSteps > 0) {
        const stepK = Math.max(1, Math.floor(r / (intermediateSteps + 1)));
        for (let k = stepK; k < r; k += stepK) {
          // Quad-symmetric tuples
          const quadPoints1: readonly [number, number][] = [
            [k, r],
            [-k, r],
            [-k, -r],
            [k, -r],
          ];
          for (const [dx, dy] of quadPoints1) {
            if (trySampleCell(dx, dy)) return Object.freeze(results);
          }

          const quadPoints2: readonly [number, number][] = [
            [r, k],
            [-r, k],
            [-r, -k],
            [r, -k],
          ];
          for (const [dx, dy] of quadPoints2) {
            if (trySampleCell(dx, dy)) return Object.freeze(results);
          }
        }
      }
    }

    return Object.freeze(results);
  }

  /**
   * Resolves a galaxy descriptor by canonical or procedural identifier.
   *
   * Pure deterministic resolution: does not require prior spatial exploration.
   * Rejects forged procedural aliases for canonical astronomical entities.
   */
  findGalaxyById(id: string): ProceduralGalaxyDescriptor | undefined {
    let cleanId = id;
    if (id.startsWith('galaxy/')) {
      try {
        cleanId = decodeURIComponent(id.slice(7));
      } catch {
        cleanId = id.slice(7);
      }
    }
    const parsed = parseGalaxyId(cleanId);
    if (!parsed) return undefined;

    // Fast check: is it in the cell cache already?
    const cellKey = cosmologicalCellKey(parsed.cell);
    const cached = this.cellCache.get(cellKey);
    let candidate: ProceduralGalaxyDescriptor | undefined;

    if (cached) {
      candidate = cached.find((g) => g.indexInCell === parsed.index);
    }

    if (!candidate) {
      // Check if the index is within the deterministic population of the cell
      if (!this.generator.isGalaxyIndexPopulated(this.universeSeed, parsed.cell, parsed.index)) {
        return undefined;
      }
      candidate = this.generator.generateGalaxy(this.universeSeed, parsed.cell, parsed.index);
    }

    if (!candidate) return undefined;

    // Reject forged / inconsistent procedural aliases for canonical entities
    // E.g. cleanId = 'galaxy_c0_0_0_0' vs candidate.id = 'milky_way'
    if (candidate.id === cleanId) return candidate;
    if (cleanId === 'lmc' && candidate.id === 'large_magellanic_cloud') return candidate;
    if (cleanId === 'smc' && candidate.id === 'small_magellanic_cloud') return candidate;

    return undefined;
  }

  /**
   * Searches for galaxies matching a user query:
   *   - Exact ID: e.g. `galaxy_c0_0_0_1`, `milky_way`, `andromeda`
   *   - Coordinate query: e.g. `c:0,0,0` or `10,-20,30`
   *   - Canonical names: e.g. `Milky Way`, `Via Láctea`, `Andromeda`, `M31`, `Triangulum`
   *   - Substring match on procedural designation (e.g. `DM-PG A3F0`) in neighbourhood
   */
  search(
    query: string,
    nearCell: BigInt3 = { x: 0n, y: 0n, z: 0n },
    limit: number = 10,
  ): readonly ProceduralGalaxyDescriptor[] {
    const q = query.trim();
    if (!q) return [];

    // 1. Exact ID
    const byId = this.findGalaxyById(q);
    if (byId) return [byId];

    // 2. Cell coordinate syntax: `c:x,y,z` or `cell:x,y,z` or `x,y,z` or `c_x_y_z`
    const coordMatch = /^(?:c:?|cell:?)?\s*(-?\d+)[,_\s]+(-?\d+)[,_\s]+(-?\d+)$/i.exec(q);
    if (coordMatch) {
      try {
        const targetCell: BigInt3 = {
          x: BigInt(coordMatch[1]),
          y: BigInt(coordMatch[2]),
          z: BigInt(coordMatch[3]),
        };
        return this.discoverCell(targetCell).slice(0, limit);
      } catch {
        // Fallthrough
      }
    }

    // 3. Canonical name matches
    const lower = q.toLowerCase();
    const canonicalResults: ProceduralGalaxyDescriptor[] = [];
    const localGroup = this.discoverCell({ x: 0n, y: 0n, z: 0n });

    for (const g of localGroup) {
      if (
        g.name.toLowerCase().includes(lower) ||
        g.id.toLowerCase().includes(lower) ||
        (lower === 'via láctea' && g.id === 'milky_way') ||
        (lower === 'm31' && g.id === 'andromeda') ||
        (lower === 'm33' && g.id === 'triangulum')
      ) {
        canonicalResults.push(g);
      }
    }

    if (canonicalResults.length >= limit) {
      return Object.freeze(canonicalResults.slice(0, limit));
    }

    // 4. Search nearby region for procedural designation matches
    const regionGalaxies = this.discoverRegion(nearCell, 2, 48);
    const proceduralMatches: ProceduralGalaxyDescriptor[] = [];

    for (const g of regionGalaxies) {
      if (canonicalResults.some((c) => c.id === g.id)) continue;
      if (g.name.toLowerCase().includes(lower) || g.id.toLowerCase().includes(lower)) {
        proceduralMatches.push(g);
        if (canonicalResults.length + proceduralMatches.length >= limit) {
          break;
        }
      }
    }

    return Object.freeze([...canonicalResults, ...proceduralMatches].slice(0, limit));
  }

  /** Resolves and returns a full GalaxyDefinition for a discovered or canonical galaxy. */
  getGalaxyDefinition(id: string): GalaxyDefinition | undefined {
    const desc = this.findGalaxyById(id);
    if (!desc) return undefined;
    const res = this.generator.tryToGalaxyDefinition(desc);
    if (res.ok) return res.definition;
    return {
      id: desc.id,
      name: desc.name,
      addressOriginM: [0, 0, 0],
      type: desc.family === 'barred-spiral' ? 'barred-spiral' : desc.family === 'elliptical' ? 'elliptical' : desc.family === 'irregular' ? 'irregular' : 'spiral',
      diameterLy: desc.diameterLy,
      thicknessLy: desc.thicknessLy,
      positionM: [0, 0, 0],
      orientationEuler: desc.orientationEulerRad,
      densityProfile: 'procedural',
      densityScale: desc.densityScale,
      proceduralMorphology: desc,
    };
  }
}
