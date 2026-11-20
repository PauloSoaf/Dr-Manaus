import { isCanonicalGalaxyId, type GalaxyDefinition } from '../celestial/GalaxyDefinition';
import { generateStarSector, milkyWayDensity, andromedaDensity } from '../celestial/StarSector';
import type { SectorIndex } from '../spatial/UniverseAddress';
import type { Vec3 } from '../spatial/units';
import { galaxyDefinition, galaxyLocalPositionM, getProceduralUniverseSeed } from './GalaxyCoordinates';
import { evaluateProceduralDensity } from './ProceduralGalaxyGenerator';

export { isCanonicalGalaxyId };

/** Small immutable runtime catalogue. UniverseAddress remains the player's sole location authority. */
export class GalaxyRuntime {
  readonly id:string;
  readonly addressOrigin:{readonly galaxyId:string;readonly originFromGalacticCentreM:Vec3};
  readonly universeSeed?: bigint;
  constructor(readonly definition:GalaxyDefinition, universeSeed?: bigint) {
    this.id=definition.id;
    this.universeSeed = isCanonicalGalaxyId(this.id) ? undefined : (universeSeed ?? definition.universeSeed);
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
    const effectiveUniverseSeed = isCanonicalGalaxyId(this.id)
      ? undefined
      : (options.universeSeed ?? this.universeSeed ?? this.definition.universeSeed);
    return generateStarSector(this.id,sector,{...options, universeSeed: effectiveUniverseSeed});
  }
}

export function sameGalaxyIdentity(a: GalaxyRuntime | undefined, id: string, universeSeed?: bigint): boolean {
  if (!a || a.id !== id) return false;
  if (isCanonicalGalaxyId(id)) return true;
  const effectiveTargetSeed = universeSeed ?? getProceduralUniverseSeed();
  const effectiveRuntimeSeed = a.universeSeed ?? a.definition.universeSeed ?? getProceduralUniverseSeed();
  return effectiveRuntimeSeed === effectiveTargetSeed;
}

const runtimes=new Map<string,GalaxyRuntime>();

function runtimeCacheKey(id: string, universeSeed?: bigint): string {
  if (isCanonicalGalaxyId(id)) {
    return id;
  }
  const effectiveSeed = universeSeed ?? getProceduralUniverseSeed();
  return `${effectiveSeed.toString(16)}:${id}`;
}

export function registerGalaxyRuntime(runtime: GalaxyRuntime, universeSeed?: bigint): void {
  const uSeed = isCanonicalGalaxyId(runtime.id) ? undefined : (runtime.universeSeed ?? universeSeed ?? runtime.definition.universeSeed);
  const key = runtimeCacheKey(runtime.id, uSeed);
  runtimes.set(key, runtime);
  if (runtimes.size > 256) {
    for (const k of runtimes.keys()) {
      if (!isCanonicalGalaxyId(k)) {
        runtimes.delete(k);
        break;
      }
    }
  }
}

export function clearGalaxyRuntimes(): void {
  for (const key of [...runtimes.keys()]) {
    if (!isCanonicalGalaxyId(key)) {
      runtimes.delete(key);
    }
  }
}

export function knownGalaxyRuntime(id:string, universeSeed?: bigint):GalaxyRuntime|undefined {
  if (isCanonicalGalaxyId(id)) {
    let runtime = runtimes.get(id);
    if (runtime) return runtime;
    const g = galaxyDefinition(id);
    if (!g) return undefined;
    runtime = new GalaxyRuntime(g);
    runtimes.set(id, runtime);
    return runtime;
  }
  const effectiveSeed = universeSeed ?? getProceduralUniverseSeed();
  const key = runtimeCacheKey(id, effectiveSeed);
  let runtime = runtimes.get(key);
  if (runtime) return runtime;
  const g = galaxyDefinition(id, effectiveSeed);
  if (!g) return undefined;
  runtime = new GalaxyRuntime(g, effectiveSeed);
  registerGalaxyRuntime(runtime, effectiveSeed);
  return runtime;
}


