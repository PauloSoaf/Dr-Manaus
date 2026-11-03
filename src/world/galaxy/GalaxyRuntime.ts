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
  readonly universeSeed?: bigint;
  constructor(readonly definition:GalaxyDefinition, universeSeed?: bigint) {
    this.id=definition.id;
    this.universeSeed = universeSeed ?? definition.universeSeed;
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
  generateSector(sector:SectorIndex,options:{densityScale?:number;maxStars?:number;universeSeed?:bigint}={}){
    const effectiveUniverseSeed = options.universeSeed ?? this.universeSeed ?? this.definition.universeSeed;
    return generateStarSector(this.id,sector,{...options, universeSeed: effectiveUniverseSeed});
  }
}
const runtimes=new Map<string,GalaxyRuntime>();

function runtimeCacheKey(id: string, universeSeed?: bigint): string {
  if (id === 'milky_way' || id === 'milky-way' || id === 'andromeda' || id === 'triangulum' || id === 'large-magellanic-cloud' || id === 'small-magellanic-cloud') {
    return id;
  }
  return universeSeed !== undefined ? `${universeSeed.toString(16)}:${id}` : id;
}

export function registerGalaxyRuntime(runtime: GalaxyRuntime, universeSeed?: bigint): void {
  const uSeed = runtime.universeSeed ?? universeSeed ?? runtime.definition.universeSeed;
  const key = runtimeCacheKey(runtime.id, uSeed);
  runtimes.set(key, runtime);
  if (runtimes.size > 256) {
    runtimes.delete(runtimes.keys().next().value!);
  }
}

export function clearGalaxyRuntimes(): void {
  runtimes.clear();
}

export function knownGalaxyRuntime(id:string, universeSeed?: bigint):GalaxyRuntime|undefined {
  const g = galaxyDefinition(id, universeSeed);
  if (!g) return undefined;
  const uSeed = universeSeed ?? g.universeSeed;
  const key = runtimeCacheKey(id, uSeed);
  let runtime = runtimes.get(key);
  if (runtime) return runtime;
  runtime = new GalaxyRuntime(g, uSeed);
  registerGalaxyRuntime(runtime, uSeed);
  return runtime;
}


