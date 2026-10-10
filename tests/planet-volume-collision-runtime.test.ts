import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanetVolumeRuntime } from '../src/world/planet/volume/PlanetVolumeRuntime.ts';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface.ts';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface.ts';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { activeFrame,referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { quatFromBasis } from '../src/world/spatial/units.ts';
import { volumeChunkKey,chunkContainingPoint,chunkBoundsBodyFixedM } from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import { generateVolumeChunk } from '../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import { meshVolumeChunk } from '../src/world/planet/volume/PlanetVolumeMesher.ts';
import { PlanetVolumeCollisionBuildJob } from '../src/world/planet/volume/PlanetVolumeCollisionBuilder.ts';
import { cavity } from './helpers/volume-collision.ts';
import type { StreamingContext } from '../src/world/providers/WorldProvider.ts';

const context:StreamingContext={spatial:{timeS:0,player:pose('fixed'),frame:activeFrame(referenceFrame({id:'fixed',kind:'body-fixed'}),pose('fixed')),
  localVelocityMps:[0,0,0],bodyId:'earth',address:{galaxyId:'milky_way',sector:{x:0n,y:0n,z:0n},systemId:'sol'}},
  camera:{fovRad:1,viewportHeightPx:900,forward:[1,0,0]},quality:{sseTargetPx:8,detailFactor:1},budget:DEFAULT_STREAMING_BUDGET};
function fixture(){
  const lod={baseChunkSizeM:16,samplesPerAxis:17,maxLod:0},r=planetSurfaceRadius(EarthSurfaceGenerator,[1,0,0]);
  const key=chunkContainingPoint('earth',[r-256,8,8],0,lod),centre=chunkBoundsBodyFixedM(key,lod).minBodyFixedM.map(v=>v+8) as [number,number,number];
  let ticks=0,clockStep=0;
  const runtime=new PlanetVolumeRuntime({lod,demand:{radiusM:16,radialHalfBandM:16,maxDemands:8,maxVisited:64},clock:()=>{ticks+=clockStep;return ticks;},
    resolve:()=>({surface:EarthSurfaceGenerator,observerBodyFixedM:centre})});
  runtime.setDebugDemand(true,true);runtime.setDebugCollision(true);
  let edit=runtime.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:centre,radiusM:1.9});
  const frame=(grant=100)=>{runtime.covers(context);runtime.advance(grant);};
  const until=(predicate:()=>boolean)=>{for(let i=0;i<50&&!predicate();i++)frame();assert.ok(predicate());};
  until(()=>!!runtime.collisionCache.peek(key));const original=runtime.collisionCache.peek(key)!;
  return {runtime,key,original,frame,until,cooperative(value=true){clockStep=value?.001:0;},change(radius=2.2){runtime.edits.remove(edit);edit=runtime.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:centre,radiusM:radius});},
    dispose:()=>runtime.dispose()};
}
test('T_VOLUME_COLLISION_OLD_REVISION_STAYS_DURING_REBUILD',()=>{const f=fixture();try{
  f.change();assert.equal(f.runtime.collisionCache.peek(f.key),f.original);
  f.cooperative();for(let i=0;i<4000&&!f.runtime.collisionMetrics.pendingBytes;i++)f.frame(.02);
  assert.ok(f.runtime.collisionMetrics.pendingBytes>0,'tiny grants leave a real incremental BVH in progress');
  assert.equal(f.runtime.collisionCache.peek(f.key),f.original);
  f.change(2.5);f.runtime.covers(context);assert.equal(f.runtime.collisionMetrics.pendingBytes,0,'stale in-progress job cancels');
  assert.equal(f.runtime.collisionCache.peek(f.key),f.original);f.cooperative(false);f.until(()=>f.runtime.collisionCache.peek(f.key)?.sourceRevision===5);
}finally{f.dispose();}});
test('T_VOLUME_COLLISION_ATOMIC_REVISION_SWAP',()=>{const f=fixture();try{
  f.change();f.frame();assert.equal(f.runtime.collisionCache.peek(f.key),f.original,'complete BVH is still staged');
  assert.ok(f.runtime.collisionMetrics.staged>0);f.runtime.covers(context);
  const next=f.runtime.collisionCache.peek(f.key)!;assert.notEqual(next,f.original);assert.equal(next.sourceRevision,3);
  assert.equal(f.runtime.collisionCache.values().filter(c=>c.key.x===f.key.x&&c.key.y===f.key.y&&c.key.z===f.key.z).length,1);
}finally{f.dispose();}});
test('T_VOLUME_COLLISION_STALE_BUILD_NOT_INSTALLED',()=>{const f=fixture();try{
  f.change();f.frame();f.change(2.5);f.runtime.covers(context);
  assert.equal(f.runtime.collisionCache.peek(f.key),f.original,'obsolete completed BVH rejected');
  f.until(()=>f.runtime.collisionCache.peek(f.key)?.sourceRevision===5);
}finally{f.dispose();}});
test('T_VOLUME_COLLISION_EMPTY_REPLACEMENT_REMOVES_OLD_ATOMICALLY',()=>{const f=fixture();try{
  f.change(50);f.frame();assert.equal(f.runtime.cache.peek(f.key)?.classification,'EMPTY');
  assert.equal(f.runtime.collisionCache.peek(f.key),f.original);f.runtime.covers(context);assert.equal(f.runtime.collisionCache.peek(f.key),undefined);
}finally{f.dispose();}});
test('solid replacement also retires collision only when authoritative samples are ready',()=>{const f=fixture();try{
  for(const edit of f.runtime.edits.allEdits())f.runtime.edits.remove(edit.id);
  f.frame();assert.equal(f.runtime.cache.peek(f.key)?.classification,'SOLID');assert.equal(f.runtime.collisionCache.peek(f.key),f.original);
  f.runtime.covers(context);assert.equal(f.runtime.collisionCache.peek(f.key),undefined);
}finally{f.dispose();}});

for(const name of ['ADJACENT_CHUNK_SEAM','NEGATIVE_CHUNK_COORDS'])test(`T_VOLUME_COLLISION_${name}`,()=>{
  const f=cavity('earth',4);try{
    const lod={baseChunkSizeM:16,samplesPerAxis:17,maxLod:0},centre:[number,number,number]=[f.centre[0],0,8];
    for(const edit of f.field.edits.allEdits())f.field.edits.remove(edit.id);
    f.field.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:centre,radiusM:4});f.cache.clearAll();
    f.universe.frames.register(referenceFrame({id:f.local,kind:'surface-enu',parentId:f.provider.fixedFrameId,originInParent:centre,
      rotationToParent:quatFromBasis([0,1,0],[1,0,0],[0,0,-1])}));
    for(const y of [-1,0]){
      const chunk=generateVolumeChunk(f.field,volumeChunkKey('earth',0,f.key.x,y,0),lod),mesh=meshVolumeChunk(chunk),job=new PlanetVolumeCollisionBuildJob(mesh,chunk);
      while(!job.advance(128)){}f.cache.insert(job.collider!);
    }
    assert.ok(f.cache.values().some(c=>c.key.y===-1));
    const left=f.provider.raycast([-.001,0,0],[0,-1,0],10)!,right=f.provider.raycast([.001,0,0],[0,-1,0],10)!;
    assert.ok(left&&right);assert.ok(Math.abs(left.distance-right.distance)<1e-5);assert.ok(left.normal[1]>.65&&right.normal[1]>.65);
    const hit=f.provider.sweepCapsule([-1,0,0],[2,-100,0],.32,2.1);assert.ok(hit);assert.equal(hit.kind,'floor');
    assert.ok(f.provider.metrics.candidateChunks>=2);
  }finally{f.dispose();}
});
