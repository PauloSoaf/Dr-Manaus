import { LOCAL_GROUP_CATALOG, type GalaxyDefinition } from '../celestial/GalaxyDefinition';
import { SECTOR_SIZE_M, separationM, type SectorIndex, type UniverseAddress, type CosmologicalAddress } from '../spatial/UniverseAddress';
import type { Vec3 } from '../spatial/units';
import {
  parseGalaxyId,
  DEFAULT_UNIVERSE_SEED,
} from './ProceduralGalaxyDiscovery';
import {
  ProceduralGalaxyGenerator,
  cosmologicalSeparationVectorM,
} from './ProceduralGalaxyGenerator';

const proceduralGalaxyDefinitions = new Map<string, GalaxyDefinition>();

function galaxyDefCacheKey(seed: bigint, id: string): string {
  return `${seed.toString(16)}:${id}`;
}

export function registerProceduralGalaxyDefinition(def: GalaxyDefinition, seed: bigint = activeUniverseSeed): void {
  const effectiveSeed = def.proceduralMorphology?.seed ?? seed;
  proceduralGalaxyDefinitions.set(galaxyDefCacheKey(effectiveSeed, def.id), def);
  if (proceduralGalaxyDefinitions.size > 512) {
    proceduralGalaxyDefinitions.delete(proceduralGalaxyDefinitions.keys().next().value!);
  }
}

let activeUniverseSeed = DEFAULT_UNIVERSE_SEED;
const seedChangeListeners = new Set<(seed: bigint) => void>();

export function onProceduralUniverseSeedChanged(listener: (seed: bigint) => void): () => void {
  seedChangeListeners.add(listener);
  return () => seedChangeListeners.delete(listener);
}

export function setProceduralUniverseSeed(seed: bigint): void {
  if (activeUniverseSeed === seed) return;
  activeUniverseSeed = seed;
  for (const listener of seedChangeListeners) {
    listener(seed);
  }
}

export function getProceduralUniverseSeed(): bigint {
  return activeUniverseSeed;
}

export function clearProceduralGalaxyDefinitions(): void {
  proceduralGalaxyDefinitions.clear();
  const resetSeed = DEFAULT_UNIVERSE_SEED;
  const changed = activeUniverseSeed !== resetSeed;
  activeUniverseSeed = resetSeed;
  if (changed) {
    for (const listener of seedChangeListeners) {
      listener(resetSeed);
    }
  }
}

export function galaxyDefinition(id: string, universeSeed: bigint = activeUniverseSeed): GalaxyDefinition | undefined {
  const canon = LOCAL_GROUP_CATALOG.find(g => g.id === id);
  if (canon) return canon;

  const key = galaxyDefCacheKey(universeSeed, id);
  const cached = proceduralGalaxyDefinitions.get(key);
  if (cached) return cached;

  const parsed = parseGalaxyId(id);
  if (!parsed) return undefined;

  const gen = new ProceduralGalaxyGenerator();
  if (!gen.isGalaxyIndexPopulated(universeSeed, parsed.cell, parsed.index)) {
    return undefined;
  }
  const desc = gen.generateGalaxy(universeSeed, parsed.cell, parsed.index);
  if (desc.id !== id) return undefined; // reject forged aliases

  const res = gen.tryToGalaxyDefinition(desc);
  if (res.ok) {
    registerProceduralGalaxyDefinition(res.definition, universeSeed);
    return res.definition;
  }

  // Fallback for cells outside legacy float domain: construct definition with local coordinates
  // so morphology, dimensions and density profiles remain intact.
  const fallbackDef: GalaxyDefinition = {
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
  registerProceduralGalaxyDefinition(fallbackDef, universeSeed);
  return fallbackDef;
}

export const boundedGalaxySector = (s:SectorIndex):boolean => [s.x,s.y,s.z].every(v=>v>=-1_000_000n&&v<=1_000_000n);

/** Bounded density fallback preserves exact BigInt identity, never converting enormous indices. */
export function galaxyLocalPositionM(g:GalaxyDefinition,s:SectorIndex,offset:Vec3=[0,0,0]):Vec3 {
  const local:Vec3=boundedGalaxySector(s)?[Number(s.x)*SECTOR_SIZE_M,Number(s.y)*SECTOR_SIZE_M,Number(s.z)*SECTOR_SIZE_M]:[0,0,0];
  return local.map((v,i)=>v+offset[i]+g.addressOriginM[i]) as Vec3;
}
/** XYZ Euler convention, matching presentation. Sector physics stays in galaxy-local axes. */
export function orientGalaxyVector(g:GalaxyDefinition,v:Vec3,inverse=false):Vec3 {
  let result:Vec3=[...v];const e=g.orientationEuler??[0,0,0];
  for(const axis of inverse?[0,1,2]:[2,1,0]) {
    const a=e[axis]*(inverse?-1:1),c=Math.cos(a),s=Math.sin(a),[x,y,z]=result;
    result=axis===0?[x,c*y-s*z,s*y+c*z]:axis===1?[c*x+s*z,y,-s*x+c*z]:[c*x-s*y,s*x+c*y,z];
  }
  return result;
}
export function observerGlobalPositionM(a:UniverseAddress,offset:Vec3,universeSeed?:bigint):Vec3|undefined {
  const g=galaxyDefinition(a.galaxyId,universeSeed);if(!g||!boundedGalaxySector(a.sector))return;
  return orientGalaxyVector(g,galaxyLocalPositionM(g,a.sector,offset)).map((v,i)=>v+g.positionM[i]) as Vec3;
}
export function globalTargetDeltaM(a:UniverseAddress,offset:Vec3,targetGlobal:Vec3,universeSeed?:bigint):Vec3|undefined {
  const observer=observerGlobalPositionM(a,offset,universeSeed);if(!observer)return;
  return targetGlobal.map((v,i)=>v-observer[i]) as Vec3;
}

export function galaxyCosmologicalAddress(galaxyId: string, universeSeed?: bigint): CosmologicalAddress | undefined {
  if (galaxyId === 'milky_way' || galaxyId === 'milky-way') {
    return { cell: { x: 0n, y: 0n, z: 0n }, localMpc: [0, 0, 0] };
  }
  if (galaxyId === 'andromeda') {
    return { cell: { x: 0n, y: 0n, z: 0n }, localMpc: [0, 0.767, 0] };
  }
  if (galaxyId === 'triangulum') {
    return { cell: { x: 0n, y: 0n, z: 0n }, localMpc: [0, 0.84, 0] };
  }
  const def = galaxyDefinition(galaxyId, universeSeed);
  if (def?.proceduralMorphology?.cosmologicalAddress) {
    return def.proceduralMorphology.cosmologicalAddress;
  }
  return undefined;
}

export function addressSeparationM(a:UniverseAddress,ao:Vec3,b:UniverseAddress,bo:Vec3,universeSeed?:bigint):number|undefined {
  if(a.galaxyId===b.galaxyId)return separationM({sector:a.sector,offsetM:ao},{sector:b.sector,offsetM:bo});

  const cosmoA = galaxyCosmologicalAddress(a.galaxyId, universeSeed);
  const cosmoB = galaxyCosmologicalAddress(b.galaxyId, universeSeed);
  if (cosmoA && cosmoB) {
    const sepVec = cosmologicalSeparationVectorM(cosmoA, cosmoB);
    if (!sepVec) {
      // Beyond safe Float64 relative conversion domain (> 1024 cells)
      return undefined;
    }

    // Include observer's local displacement in galaxy A and arrival system's local displacement in galaxy B
    const defA = galaxyDefinition(a.galaxyId, universeSeed);
    const defB = galaxyDefinition(b.galaxyId, universeSeed);
    const localA = defA ? orientGalaxyVector(defA, galaxyLocalPositionM(defA, a.sector, ao)) : [0, 0, 0] as Vec3;
    const localB = defB ? orientGalaxyVector(defB, galaxyLocalPositionM(defB, b.sector, bo)) : [0, 0, 0] as Vec3;

    // Total displacement: center separation + destination offset - origin offset
    const totalDelta: Vec3 = [
      sepVec[0] + localB[0] - localA[0],
      sepVec[1] + localB[1] - localA[1],
      sepVec[2] + localB[2] - localA[2],
    ];

    const distM = Math.hypot(...totalDelta);
    return distM > 0 ? distM : undefined;
  }

  const target=observerGlobalPositionM(b,bo,universeSeed),delta=target&&globalTargetDeltaM(a,ao,target,universeSeed);
  return delta?Math.hypot(...delta):undefined;
}

