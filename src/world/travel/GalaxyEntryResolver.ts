import { knownGalaxyRuntime } from '../galaxy/GalaxyRuntime';
import { sectorIndex } from '../spatial/UniverseAddress';
import { bodyProfile } from '../celestial/CelestialBodyProfile';
import { UniversalTargetCatalog, type ProceduralTargetDescriptor } from './UniversalTargetCatalog';
import type { UniversalNavigationTarget } from './UniversalNavigationTarget';
import { setProceduralUniverseSeed } from '../galaxy/GalaxyCoordinates';

function entryCacheKey(seed: bigint, galaxyId: string): string {
  return `${seed.toString(16)}:${galaxyId}`;
}

const resolvedEntryCache = new Map<string, ProceduralTargetDescriptor | null>();

export function clearGalaxyEntryCache(): void {
  resolvedEntryCache.clear();
}

/** Check cached entry status in O(1) without triggering sector or star generation. */
export function peekProceduralGalaxyEntry(galaxyId: string, seed: bigint): boolean | undefined {
  const key = entryCacheKey(seed, galaxyId);
  const cached = resolvedEntryCache.get(key);
  if (cached === undefined) return undefined;
  return cached !== null;
}

/** Stable production entry: a populated disc system about 20 kly from M31. */
export function andromedaEntryDescriptor(catalog = new UniversalTargetCatalog()) {
  const galaxy = knownGalaxyRuntime('andromeda')!;
  for (const x of [200n,201n,202n]) for (const y of [0n,1n,-1n]) {
    const sector = sectorIndex(x,y,0n);
    for (const star of galaxy.generateSector(sector).stars) {
      if (!star.planetCount) continue;
      const d = catalog.proceduralDescriptor(galaxy.id,sector,star.id)!;
      if (d.system.bodies.some(b=>bodyProfile(b).bodyClass==='rocky')
        && d.system.bodies.some(b=>b.parentId&&b.parentId!==star.id&&bodyProfile(b).canLand)
        && d.system.bodies.some(b=>['gas-giant','ice-giant'].includes(bodyProfile(b).bodyClass))) return d;
    }
  }
  throw Error('No populated Andromeda entry system');
}

/** Check whether a procedural galaxy has a resolvable landable entry system without throwing. */
export function hasProceduralGalaxyEntry(galaxyId: string, catalog = new UniversalTargetCatalog()): boolean {
  const seed = catalog.discovery.universeSeed;
  const key = entryCacheKey(seed, galaxyId);
  const cached = resolvedEntryCache.get(key);
  if (cached !== undefined) {
    return cached !== null;
  }
  try {
    return !!proceduralGalaxyEntryDescriptor(galaxyId, catalog);
  } catch {
    return false;
  }
}

/** Deterministic entry system resolution for any procedural galaxy. */
export function proceduralGalaxyEntryDescriptor(galaxyId: string, catalog = new UniversalTargetCatalog()): ProceduralTargetDescriptor {
  const seed = catalog.discovery.universeSeed;
  setProceduralUniverseSeed(seed);

  const key = entryCacheKey(seed, galaxyId);
  const cached = resolvedEntryCache.get(key);
  if (cached === null) {
    throw Error(`No populated and landable entry system in procedural galaxy ${galaxyId}`);
  }
  if (cached !== undefined) {
    return cached;
  }

  const galaxy = knownGalaxyRuntime(galaxyId, seed);
  if (!galaxy) throw Error(`Unknown galaxy: ${galaxyId}`);

  // Base search radius in sectors (~20% of galactic diameter, 1 sector = 100 ly)
  const diameterLy = galaxy.definition.diameterLy ?? 100_000;
  const radiusSectors = BigInt(Math.max(5, Math.floor((diameterLy * 0.2) / 100)));

  // 13 deterministic candidate offsets covering mid-radius, cardinal axes, diagonals, and inner core
  const candidateOffsets: readonly [bigint, bigint, bigint][] = [
    [radiusSectors, 0n, 0n],
    [radiusSectors, 1n, 0n],
    [radiusSectors, -1n, 0n],
    [-radiusSectors, 0n, 0n],
    [0n, radiusSectors, 0n],
    [0n, -radiusSectors, 0n],
    [radiusSectors / 2n, radiusSectors / 2n, 0n],
    [-radiusSectors / 2n, radiusSectors / 2n, 0n],
    [radiusSectors / 2n, -radiusSectors / 2n, 0n],
    [-radiusSectors / 2n, -radiusSectors / 2n, 0n],
    [radiusSectors / 2n, 0n, 0n],
    [0n, radiusSectors / 2n, 0n],
    [0n, 0n, 0n],
  ];

  let populatedFallback: ProceduralTargetDescriptor | undefined;

  for (const [x, y, z] of candidateOffsets) {
    const sector = sectorIndex(x, y, z);
    const sectorContent = galaxy.generateSector(sector, { universeSeed: seed });
    for (const star of sectorContent.stars) {
      if (star.planetCount <= 0) continue;
      const d = catalog.proceduralDescriptor(galaxy.id, sector, star.id);
      if (!d) continue;

      const hasRocky = d.system.bodies.some(b => bodyProfile(b).bodyClass === 'rocky');
      const hasLandable = d.system.bodies.some(b => b.id !== star.id && bodyProfile(b).canLand);
      const hasLandableMoon = d.system.bodies.some(b => b.parentId && b.parentId !== star.id && bodyProfile(b).canLand);

      // Preferred ideal destination: rocky planet with a landable moon
      if (hasRocky && hasLandableMoon) {
        resolvedEntryCache.set(key, d);
        if (resolvedEntryCache.size > 256) resolvedEntryCache.delete(resolvedEntryCache.keys().next().value!);
        return d;
      }

      // Valid secondary candidate: populated system with landable surface
      if (hasRocky && hasLandable && !populatedFallback) {
        populatedFallback = d;
      }
    }
  }

  if (populatedFallback) {
    resolvedEntryCache.set(key, populatedFallback);
    if (resolvedEntryCache.size > 256) resolvedEntryCache.delete(resolvedEntryCache.keys().next().value!);
    return populatedFallback;
  }

  // Record negative result to prevent repeated searches every frame
  resolvedEntryCache.set(key, null);
  if (resolvedEntryCache.size > 256) resolvedEntryCache.delete(resolvedEntryCache.keys().next().value!);
  throw Error(`No populated and landable entry system in procedural galaxy ${galaxyId}`);
}

export class GalaxyEntryResolver {
  constructor(readonly catalog:UniversalTargetCatalog) {}
  resolve(target:UniversalNavigationTarget):UniversalNavigationTarget {
    if(target.kind!=='galaxy') return target;
    if(target.galaxyId==='milky_way') return this.catalog.target('sol')!;
    if(target.galaxyId==='andromeda') {
      const d=andromedaEntryDescriptor(this.catalog);
      return this.catalog.proceduralTarget('andromeda',d.address.sector,d.star.id,'system')!;
    }
    if(target.galaxyId) {
      const d = proceduralGalaxyEntryDescriptor(target.galaxyId, this.catalog);
      return this.catalog.proceduralTarget(target.galaxyId, d.address.sector, d.star.id, 'system')!;
    }
    throw Error('Unknown galaxy entry');
  }
}


