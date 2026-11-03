import { LOCAL_GROUP_CATALOG, type GalaxyDefinition } from '../celestial/GalaxyDefinition';
import { SECTOR_SIZE_M, separationM, type SectorIndex, type UniverseAddress, type CosmologicalAddress } from '../spatial/UniverseAddress';
import type { Vec3 } from '../spatial/units';
import {
  parseGalaxyId,
  ProceduralGalaxyGenerator,
  DEFAULT_UNIVERSE_SEED,
  cosmologicalSeparationVectorM,
} from './ProceduralGalaxyGenerator';

const proceduralGalaxyDefinitions = new Map<string, GalaxyDefinition>();

export function registerProceduralGalaxyDefinition(def: GalaxyDefinition): void {
  proceduralGalaxyDefinitions.set(def.id, def);
  if (proceduralGalaxyDefinitions.size > 256) {
    proceduralGalaxyDefinitions.delete(proceduralGalaxyDefinitions.keys().next().value!);
  }
}

export function galaxyDefinition(id: string): GalaxyDefinition | undefined {
  const canon = LOCAL_GROUP_CATALOG.find(g => g.id === id);
  if (canon) return canon;

  const cached = proceduralGalaxyDefinitions.get(id);
  if (cached) return cached;

  const parsed = parseGalaxyId(id);
  if (!parsed) return undefined;

  const gen = new ProceduralGalaxyGenerator();
  if (!gen.isGalaxyIndexPopulated(DEFAULT_UNIVERSE_SEED, parsed.cell, parsed.index)) {
    return undefined;
  }
  const desc = gen.generateGalaxy(DEFAULT_UNIVERSE_SEED, parsed.cell, parsed.index);
  if (desc.id !== id) return undefined; // reject forged aliases

  const res = gen.tryToGalaxyDefinition(desc);
  if (res.ok) {
    registerProceduralGalaxyDefinition(res.definition);
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
  registerProceduralGalaxyDefinition(fallbackDef);
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
export function observerGlobalPositionM(a:UniverseAddress,offset:Vec3):Vec3|undefined {
  const g=galaxyDefinition(a.galaxyId);if(!g||!boundedGalaxySector(a.sector))return;
  return orientGalaxyVector(g,galaxyLocalPositionM(g,a.sector,offset)).map((v,i)=>v+g.positionM[i]) as Vec3;
}
export function globalTargetDeltaM(a:UniverseAddress,offset:Vec3,targetGlobal:Vec3):Vec3|undefined {
  const observer=observerGlobalPositionM(a,offset);if(!observer)return;
  return targetGlobal.map((v,i)=>v-observer[i]) as Vec3;
}

export function galaxyCosmologicalAddress(galaxyId: string): CosmologicalAddress | undefined {
  if (galaxyId === 'milky_way' || galaxyId === 'milky-way') {
    return { cell: { x: 0n, y: 0n, z: 0n }, localMpc: [0, 0, 0] };
  }
  if (galaxyId === 'andromeda') {
    return { cell: { x: 0n, y: 0n, z: 0n }, localMpc: [0, 0.767, 0] };
  }
  if (galaxyId === 'triangulum') {
    return { cell: { x: 0n, y: 0n, z: 0n }, localMpc: [0, 0.84, 0] };
  }
  const def = galaxyDefinition(galaxyId);
  if (def?.proceduralMorphology?.cosmologicalAddress) {
    return def.proceduralMorphology.cosmologicalAddress;
  }
  return undefined;
}

export function addressSeparationM(a:UniverseAddress,ao:Vec3,b:UniverseAddress,bo:Vec3):number|undefined {
  if(a.galaxyId===b.galaxyId)return separationM({sector:a.sector,offsetM:ao},{sector:b.sector,offsetM:bo});

  const cosmoA = galaxyCosmologicalAddress(a.galaxyId);
  const cosmoB = galaxyCosmologicalAddress(b.galaxyId);
  if (cosmoA && cosmoB) {
    const sepVec = cosmologicalSeparationVectorM(cosmoA, cosmoB);
    if (!sepVec) {
      // Beyond safe Float64 relative conversion domain (> 1024 cells)
      return undefined;
    }
    const distM = Math.hypot(...sepVec);
    return distM > 0 ? distM : undefined;
  }

  const target=observerGlobalPositionM(b,bo),delta=target&&globalTargetDeltaM(a,ao,target);
  return delta?Math.hypot(...delta):undefined;
}

