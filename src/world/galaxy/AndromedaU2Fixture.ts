import { knownGalaxyRuntime } from './GalaxyRuntime';
import { sectorIndex } from '../spatial/UniverseAddress';
import { UniversalTargetCatalog } from '../travel/UniversalTargetCatalog';
import { bodyProfile } from '../celestial/CelestialBodyProfile';

/** Bounded, ordered disc search, 20 kly from M31's centre. Only run on explicit QA request. */
export function findAndromedaU2Fixture(catalog=new UniversalTargetCatalog()) {
  const galaxy=knownGalaxyRuntime('andromeda')!;
  for(const x of [200n,201n,202n])for(const y of [0n,1n,-1n]) {
    const sector=sectorIndex(x,y,0n),stars=galaxy.generateSector(sector).stars;
    for(const star of stars){
      if(!star.planetCount)continue;
      const descriptor=catalog.proceduralDescriptor(galaxy.id,sector,star.id)!;
      const rocky=descriptor.system.bodies.some(b=>bodyProfile(b).bodyClass==='rocky');
      const moon=descriptor.system.bodies.some(b=>b.parentId&&b.parentId!==star.id&&bodyProfile(b).canLand);
      const giant=descriptor.system.bodies.some(b=>['gas-giant','ice-giant'].includes(bodyProfile(b).bodyClass));
      if(rocky&&moon&&giant)return descriptor;
    }
  }
  throw Error('Fixture U2 ausente na busca limitada');
}
