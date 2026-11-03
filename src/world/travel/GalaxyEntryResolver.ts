import { knownGalaxyRuntime } from '../galaxy/GalaxyRuntime';
import { sectorIndex } from '../spatial/UniverseAddress';
import { bodyProfile } from '../celestial/CelestialBodyProfile';
import { UniversalTargetCatalog, type ProceduralTargetDescriptor } from './UniversalTargetCatalog';
import type { UniversalNavigationTarget } from './UniversalNavigationTarget';

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

/** Deterministic entry system resolution for any procedural galaxy. */
export function proceduralGalaxyEntryDescriptor(galaxyId: string, catalog = new UniversalTargetCatalog()): ProceduralTargetDescriptor {
  const galaxy = knownGalaxyRuntime(galaxyId);
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
    const sectorContent = galaxy.generateSector(sector);
    for (const star of sectorContent.stars) {
      if (star.planetCount <= 0) continue;
      const d = catalog.proceduralDescriptor(galaxy.id, sector, star.id);
      if (!d) continue;

      const hasRocky = d.system.bodies.some(b => bodyProfile(b).bodyClass === 'rocky');
      const hasLandable = d.system.bodies.some(b => b.id !== star.id && bodyProfile(b).canLand);
      const hasLandableMoon = d.system.bodies.some(b => b.parentId && b.parentId !== star.id && bodyProfile(b).canLand);

      // Preferred ideal destination: rocky planet with a landable moon
      if (hasRocky && hasLandableMoon) {
        return d;
      }

      // Valid secondary candidate: populated system with landable surface
      if (hasRocky && hasLandable && !populatedFallback) {
        populatedFallback = d;
      }
    }
  }

  if (populatedFallback) return populatedFallback;
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

