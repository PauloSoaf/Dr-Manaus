import { LOCAL_GROUP_CATALOG, type GalaxyDefinition } from '../celestial/GalaxyDefinition';
import { SECTOR_SIZE_M, separationM, type SectorIndex, type UniverseAddress } from '../spatial/UniverseAddress';
import type { Vec3 } from '../spatial/units';

export const galaxyDefinition = (id:string):GalaxyDefinition|undefined => LOCAL_GROUP_CATALOG.find(g=>g.id===id);
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
export function addressSeparationM(a:UniverseAddress,ao:Vec3,b:UniverseAddress,bo:Vec3):number|undefined {
  if(a.galaxyId===b.galaxyId)return separationM({sector:a.sector,offsetM:ao},{sector:b.sector,offsetM:bo});
  const target=observerGlobalPositionM(b,bo),delta=target&&globalTargetDeltaM(a,ao,target);
  return delta?Math.hypot(...delta):undefined;
}
