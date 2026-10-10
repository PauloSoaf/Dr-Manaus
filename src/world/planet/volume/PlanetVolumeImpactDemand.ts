import type { BodyFixedPoint, PlanetVolumeBounds, SubtractSphereEdit } from './PlanetVolumeEdit';
import { chunkContainingPoint, chunkBoundsBodyFixedM, chunkKeyToString, volumeChunkKey,
  DEFAULT_VOLUME_LOD,type PlanetVolumeSamplingProfile,type PlanetVolumeChunkKey, type PlanetVolumeLodConfig } from './PlanetVolumeChunkKey';
import type { PlanetVolumeEditStore } from './PlanetVolumeEditStore';
import { distanceToVolumeBoundsSquared } from './PlanetVolumeChunkCache';

export const IMPACT_VOLUME_LIMITS = Object.freeze({
  cacheLimits: {maxChunks:128,maxBytes:4*1048576},
  meshLimits: {maxMeshes:128,maxBytes:16*1048576},
  collisionLimits: {maxColliders:128,maxBytes:32*1048576},
});
export function logicalImpactChunkCount(edit:SubtractSphereEdit,lod:PlanetVolumeLodConfig):number {
  const lo=chunkContainingPoint(edit.bodyId,edit.centerBodyFixedM.map(v=>v-edit.radiusM) as [number,number,number],0,lod),
    hi=chunkContainingPoint(edit.bodyId,edit.centerBodyFixedM.map(v=>v+edit.radiusM) as [number,number,number],0,lod);
  return (hi.x-lo.x+1)*(hi.y-lo.y+1)*(hi.z-lo.z+1);
}
/** Geometry alone determines resolution. Never depends on camera, FPS, body identity or pressure. */
export function selectImpactSamplingProfile(edit:SubtractSphereEdit):PlanetVolumeSamplingProfile {
  const spacing=DEFAULT_VOLUME_LOD.baseChunkSizeM/(DEFAULT_VOLUME_LOD.samplesPerAxis-1),impact=edit.impact;
  return impact&&(2*impact.craterRadiusM/spacing<32||impact.craterDepthM/spacing<6)?'impact-high':'standard';
}
export function nearestImpactEdit(edits:PlanetVolumeEditStore,bodyId:string,observer:BodyFixedPoint):SubtractSphereEdit|undefined {
  const nearby=edits.queryBounds(bodyId,{minBodyFixedM:observer.map(v=>v-16384) as [number,number,number],
    maxBodyFixedM:observer.map(v=>v+16384) as [number,number,number]})
    .filter((e):e is SubtractSphereEdit=>e.type==='subtract-sphere'&&!!e.impact);
  nearby.sort((a,b)=>Math.hypot(...a.impact!.surfaceContactBodyFixedM.map((v,i)=>v-observer[i]))
    -Math.hypot(...b.impact!.surfaceContactBodyFixedM.map((v,i)=>v-observer[i]))||a.id.localeCompare(b.id));
  return nearby[0];
}
/** Complete bounded 3D windows. HIGH is a whole opening/depth/halo window, never shrunk. */
export function selectImpactVolumeDemand(edits:PlanetVolumeEditStore,bodyId:string,observer:BodyFixedPoint,
  lod:PlanetVolumeLodConfig,capacity:number):readonly PlanetVolumeChunkKey[] {
  const edit=nearestImpactEdit(edits,bodyId,observer);if(!edit)return [];
  return impactVolumeWindow(edit,observer,lod,capacity);
}
export function impactVolumeWindow(edit:SubtractSphereEdit,observer:BodyFixedPoint,
  lod:PlanetVolumeLodConfig,capacity:number):readonly PlanetVolumeChunkKey[] {
  const bodyId=edit.bodyId;
  const profile=selectImpactSamplingProfile(edit);
  const {surfaceContactBodyFixedM:p,surfaceNormalBodyFixed:n,craterRadiusM:a,craterDepthM:h}=edit.impact!;
  // Centre the local window on the observer's tangent-plane projection, clamped to the opening.
  const delta=observer.map((v,i)=>v-p[i]),dot=delta.reduce((s,v,i)=>s+v*n[i],0),t=delta.map((v,i)=>v-dot*n[i]),length=Math.hypot(...t),
    focus=(profile==='impact-high'?[...p]:p.map((v,i)=>v+t[i]*Math.min(1,a/(length||1)))) as [number,number,number];
  let radius=a;const halo=lod.baseChunkSizeM/(lod.samplesPerAxis-1)*2;
  for(let attempt=0;attempt<48;attempt++,radius*=.8) {
    const bounds:PlanetVolumeBounds={minBodyFixedM:focus.map((v,i)=>v-radius*Math.sqrt(Math.max(0,1-n[i]*n[i]))-Math.max(0,n[i])*h-halo) as [number,number,number],
      maxBodyFixedM:focus.map((v,i)=>v+radius*Math.sqrt(Math.max(0,1-n[i]*n[i]))+Math.max(0,-n[i])*h+halo) as [number,number,number]};
    const lo=chunkContainingPoint(bodyId,bounds.minBodyFixedM,0,lod),hi=chunkContainingPoint(bodyId,bounds.maxBodyFixedM,0,lod),
      count=(hi.x-lo.x+1)*(hi.y-lo.y+1)*(hi.z-lo.z+1);
    if(count>capacity){if(profile==='impact-high')return [];continue;}
    const keys:PlanetVolumeChunkKey[]=[];
    for(let x=lo.x;x<=hi.x;x++)for(let y=lo.y;y<=hi.y;y++)for(let z=lo.z;z<=hi.z;z++)keys.push(volumeChunkKey(bodyId,0,x,y,z,profile));
    // Contact/floor near the observer first; this ordering never removes a selected cell.
    return keys.sort((x,y)=>distanceToVolumeBoundsSquared(observer,chunkBoundsBodyFixedM(x,lod))
      -distanceToVolumeBoundsSquared(observer,chunkBoundsBodyFixedM(y,lod))||chunkKeyToString(x).localeCompare(chunkKeyToString(y)));
  }
  return []; // Explicit insufficient window capacity; intact authority remains.
}
