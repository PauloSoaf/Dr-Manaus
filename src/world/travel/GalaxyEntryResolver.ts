import { knownGalaxyRuntime } from '../galaxy/GalaxyRuntime';
import { sectorIndex } from '../spatial/UniverseAddress';
import { bodyProfile } from '../celestial/CelestialBodyProfile';
import { UniversalTargetCatalog } from './UniversalTargetCatalog';
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
export class GalaxyEntryResolver {
  constructor(readonly catalog:UniversalTargetCatalog) {}
  resolve(target:UniversalNavigationTarget):UniversalNavigationTarget {
    if(target.kind!=='galaxy') return target;
    if(target.galaxyId==='milky_way') return this.catalog.target('sol')!;
    if(target.galaxyId==='andromeda') {
      const d=andromedaEntryDescriptor(this.catalog);
      return this.catalog.proceduralTarget('andromeda',d.address.sector,d.star.id,'system')!;
    }
    throw Error('Unknown galaxy entry');
  }
}
