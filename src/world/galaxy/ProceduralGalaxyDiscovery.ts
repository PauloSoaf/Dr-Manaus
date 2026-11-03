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
import { LOCAL_GROUP_CATALOG } from '../celestial/GalaxyDefinition';
import type { ManagedSubsystem, ManagedDemand, ManagedStats } from '../streaming/ManagedSubsystem';
import type { StreamingContext } from '../providers/WorldProvider';

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
  // Canonical Local Group entities
  if (id === 'milky_way') return { cell: { x: 0n, y: 0n, z: 0n }, index: 0 };
  if (id === 'andromeda') return { cell: { x: 0n, y: 0n, z: 0n }, index: 1 };
  if (id === 'triangulum') return { cell: { x: 0n, y: 0n, z: 0n }, index: 2 };
  if (id === 'large_magellanic_cloud' || id === 'lmc') return { cell: { x: 0n, y: 0n, z: 0n }, index: 3 };
  if (id === 'small_magellanic_cloud' || id === 'smc') return { cell: { x: 0n, y: 0n, z: 0n }, index: 4 };

  const match = /^galaxy_c(-?\d+)_(-?\d+)_(-?\d+)_(\d+)$/.exec(id);
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

export class ProceduralGalaxyDiscovery implements ManagedSubsystem {
  readonly id = 'procedural-galaxy-discovery';

  private readonly generator: ProceduralGalaxyGenerator;
  private readonly cellCache = new Map<string, readonly ProceduralGalaxyDescriptor[]>();
  private pendingWorkCount = 0;
  private grantedWorkMs = 0;

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
    const r = Math.max(0, Math.min(3, Math.floor(radiusCells)));
    const offsets = r <= 1
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
   * Resolves a galaxy descriptor by canonical or procedural identifier.
   *
   * Pure deterministic resolution: does not require prior spatial exploration.
   */
  findGalaxyById(id: string): ProceduralGalaxyDescriptor | undefined {
    const parsed = parseGalaxyId(id);
    if (!parsed) return undefined;

    // Fast check: is it in the cell cache already?
    const cellKey = cosmologicalCellKey(parsed.cell);
    const cached = this.cellCache.get(cellKey);
    if (cached) {
      const found = cached.find((g) => g.id === id || (g.indexInCell === parsed.index));
      if (found) return found;
    }

    // Check if the index is within the deterministic population of the cell
    if (!this.generator.isGalaxyIndexPopulated(this.universeSeed, parsed.cell, parsed.index)) {
      return undefined;
    }

    // Generate directly
    const desc = this.generator.generateGalaxy(this.universeSeed, parsed.cell, parsed.index);
    return desc;
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

  /* ======================================================================== */
  /* ManagedSubsystem Protocol (GlobalStreamingScheduler integration)          */
  /* ======================================================================== */

  covers(context: StreamingContext): boolean {
    return context.cosmological !== undefined;
  }

  plan(context: StreamingContext): readonly ManagedDemand[] {
    if (!context.cosmological) return [];
    const cell = context.cosmological.cell;
    const key = cosmologicalCellKey(cell);
    if (!this.cellCache.has(key)) {
      return [
        {
          id: `galaxy-cell/${key}`,
          pending: 1,
          estimatedMs: 0.2,
          critical: true,
        },
      ];
    }
    return [];
  }

  advance(budgetMs: number): void {
    this.grantedWorkMs = budgetMs;
    // Cell generation is light and synchronous; no unmonitored async spikes.
    this.pendingWorkCount = 0;
  }

  stats(): ManagedStats {
    return {
      id: this.id,
      pending: this.pendingWorkCount,
      grantedMs: this.grantedWorkMs,
    };
  }
}
