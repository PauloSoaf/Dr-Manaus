import type { GalaxyDefinition } from '../celestial/GalaxyDefinition';
import { generateStarSector, milkyWayDensity, andromedaDensity } from '../celestial/StarSector';
import type { SectorIndex } from '../spatial/UniverseAddress';
import type { Vec3 } from '../spatial/units';
import { galaxyDefinition, galaxyLocalPositionM } from './GalaxyCoordinates';
import { evaluateProceduralDensity } from './ProceduralGalaxyGenerator';

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
    if (this.definition.proceduralMorphology) {
      return evaluateProceduralDensity(this.definition.proceduralMorphology, positionM);
    }
    return (this.definition.densityProfile==='andromeda'?andromedaDensity:milkyWayDensity)(positionM)*(this.definition.densityScale??1);
  }
  generateSector(sector:SectorIndex,options:{densityScale?:number;maxStars?:number}={}){return generateStarSector(this.id,sector,options);}
}
const runtimes=new Map<string,GalaxyRuntime>();

export function registerGalaxyRuntime(runtime: GalaxyRuntime): void {
  runtimes.set(runtime.id, runtime);
  if (runtimes.size > 128) {
    runtimes.delete(runtimes.keys().next().value!);
  }
}

export function clearGalaxyRuntimes(): void {
  runtimes.clear();
}

export function knownGalaxyRuntime(id:string):GalaxyRuntime|undefined {
  let runtime=runtimes.get(id);
  if(runtime)return runtime;
  const g=galaxyDefinition(id);if(!g)return;
  runtime=new GalaxyRuntime(g);
  registerGalaxyRuntime(runtime);
  return runtime;
}

