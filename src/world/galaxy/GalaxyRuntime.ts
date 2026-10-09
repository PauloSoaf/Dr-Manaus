import type { GalaxyDefinition } from '../celestial/GalaxyDefinition';
import { generateStarSector, milkyWayDensity, andromedaDensity } from '../celestial/StarSector';
import type { SectorIndex } from '../spatial/UniverseAddress';
import type { Vec3 } from '../spatial/units';
import { galaxyDefinition, galaxyLocalPositionM } from './GalaxyCoordinates';

/** Small immutable runtime catalogue. UniverseAddress remains the player's sole location authority. */
export class GalaxyRuntime {
  readonly id:string;
  readonly addressOrigin:{readonly galaxyId:string;readonly originFromGalacticCentreM:Vec3};
  constructor(readonly definition:GalaxyDefinition) {
    this.id=definition.id;
    this.addressOrigin=Object.freeze({galaxyId:this.id,originFromGalacticCentreM:definition.addressOriginM});
  }
  get centralBlackHole(){return this.definition.centralBlackHole;}
  galaxyLocalPosition(sector:SectorIndex,offsetM:Vec3=[0,0,0]):Vec3{return galaxyLocalPositionM(this.definition,sector,offsetM);}
  densityAtLocal(positionM:Vec3):number {
    return (this.definition.densityProfile==='andromeda'?andromedaDensity:milkyWayDensity)(positionM)*(this.definition.densityScale??1);
  }
  generateSector(sector:SectorIndex,options:{densityScale?:number;maxStars?:number}={}){return generateStarSector(this.id,sector,options);}
}
const runtimes=new Map<string,GalaxyRuntime>();
export function knownGalaxyRuntime(id:string):GalaxyRuntime|undefined {
  const g=galaxyDefinition(id);if(!g)return;
  let runtime=runtimes.get(id);if(!runtime){runtime=new GalaxyRuntime(g);runtimes.set(id,runtime);}return runtime;
}
