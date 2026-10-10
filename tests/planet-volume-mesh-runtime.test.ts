import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanetVolumeRuntime } from '../src/world/planet/volume/PlanetVolumeRuntime.ts';
import { PlanetVolumeMeshCache } from '../src/world/planet/volume/PlanetVolumeMeshCache.ts';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';
import { generateVolumeChunk } from '../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import { meshVolumeChunk } from '../src/world/planet/volume/PlanetVolumeMesher.ts';
import { volumeMeshByteLength } from '../src/world/planet/volume/PlanetVolumeMesh.ts';
import { chunkContainingPoint } from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface.ts';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { activeFrame,referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { createVolumeMeshGeometry } from '../src/debug/VolumeMeshGeometry.ts';
import type { StreamingContext } from '../src/world/providers/WorldProvider.ts';
import type { BodyFixedPoint } from '../src/world/planet/volume/PlanetVolumeEdit.ts';

const context:StreamingContext={spatial:{timeS:0,player:pose('fixed'),frame:activeFrame(referenceFrame({id:'fixed',kind:'body-fixed'}),pose('fixed')),
  localVelocityMps:[0,0,0],bodyId:'earth',address:{galaxyId:'milky_way',sector:{x:0n,y:0n,z:0n},systemId:'sol'}},
  camera:{fovRad:1,viewportHeightPx:900,forward:[1,0,0]},quality:{sseTargetPx:8,detailFactor:1},budget:DEFAULT_STREAMING_BUDGET};
function fixture() {
  let surface=EarthSurfaceGenerator,observer:BodyFixedPoint=[planetSurfaceRadius(surface,[1,0,0]),128,128];
  const runtime=new PlanetVolumeRuntime({resolve:()=>({surface,observerBodyFixedM:observer}),clock:()=>0});
  const frame=(grant=100)=>{runtime.covers(context);runtime.advance(grant);};
  return {runtime,frame,fill:()=>{for(let i=0;i<40;i++) frame();},setObserver:(next:BodyFixedPoint)=>{observer=next;},
    moon:()=>{surface=MoonSurfaceGenerator;observer=[planetSurfaceRadius(surface,[1,0,0]),128,128];}};
}
test('T_VOLUME_MC_RUNTIME_OPT_IN_AND_ONLY_MIXED',()=>{
  const f=fixture();f.runtime.setDebugDemand(true);f.fill();
  assert.equal(f.runtime.metrics.residentMeshes,0);assert.equal(f.runtime.metrics.meshJobBytes,0);
  f.runtime.setDebugMeshing(true);f.fill();assert.ok(f.runtime.metrics.residentMeshes>0);
  for(const mesh of f.runtime.meshes) assert.equal(f.runtime.cache.peek(mesh.key)!.classification,'MIXED');
  assert.ok(f.runtime.metrics.residentMeshes<=8);assert.ok(f.runtime.metrics.meshBytes<=8*1048576);
  f.runtime.setDebugMeshing(false);assert.equal(f.runtime.metrics.meshBytes,0);assert.ok(f.runtime.metrics.resident>0);
  f.runtime.setDebugDemand(false);assert.equal(f.runtime.metrics.bytes,0);assert.equal(f.runtime.metrics.meshJobBytes,0);f.runtime.dispose();
});
test('T_VOLUME_MC_RUNTIME_NEAREST_MESH_BEFORE_FAR_SAMPLES',()=>{
  const f=fixture();f.runtime.setDebugDemand(true);f.runtime.setDebugMeshing(true);f.frame();
  assert.equal(f.runtime.metrics.generatedThisFrame,1);assert.equal(f.runtime.metrics.meshedThisFrame,1);
  assert.equal(f.runtime.metrics.resident,1);assert.equal(f.runtime.metrics.residentMeshes,1);
  assert.equal(f.runtime.meshes[0].key, f.runtime.cache.peek(f.runtime.meshes[0].key)!.key);
  f.runtime.advance(100);assert.equal(f.runtime.metrics.generatedThisFrame,1);assert.equal(f.runtime.metrics.meshedThisFrame,1);f.runtime.dispose();
});
test('T_VOLUME_MC_RUNTIME_EDIT_ADD_REMOVE_HIDE_STALE_AND_REMESH',()=>{
  const f=fixture();f.runtime.setDebugDemand(true);f.runtime.setDebugMeshing(true);f.frame();
  const before=f.runtime.meshes[0],origin=before.originBodyFixedM;
  const id=f.runtime.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:[origin[0]+128,128,128],radiusM:70});
  assert.equal(f.runtime.meshes.length,0,'stale geometry is hidden before another scheduler frame');
  f.frame();const cut=f.runtime.meshes.find(mesh=>JSON.stringify(mesh.key)===JSON.stringify(before.key))!;
  assert.ok(cut);assert.equal(cut.sourceRevision,1);assert.notDeepEqual(cut.positions,before.positions);
  f.runtime.edits.remove(id);assert.equal(f.runtime.meshes.length,0);f.frame();const restored=f.runtime.meshes[0];
  assert.equal(restored.sourceRevision,2);assert.deepEqual(restored.positions,before.positions);f.runtime.dispose();
});
test('T_VOLUME_MC_RUNTIME_UNRELATED_EDIT_KEEPS_VALID_OLD_REVISION',()=>{
  const f=fixture();f.runtime.setDebugDemand(true);f.runtime.setDebugMeshing(true);f.frame();const before=f.runtime.meshes[0];
  f.runtime.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:[-6378137,0,0],radiusM:20});f.frame();
  assert.ok(f.runtime.meshes.includes(before));assert.equal(before.sourceRevision,0);f.runtime.dispose();
});
test('T_VOLUME_MC_RUNTIME_MOVEMENT_BODY_AND_DISABLE_RETIRE',()=>{
  const f=fixture();f.runtime.setDebugDemand(true);f.runtime.setDebugMeshing(true);f.fill();const before=f.runtime.meshes[0];
  f.setObserver([planetSurfaceRadius(EarthSurfaceGenerator,[1,0,0]),20000,128]);f.fill();
  assert.ok(!f.runtime.meshes.includes(before));f.moon();f.frame();
  assert.ok(f.runtime.meshes.every(mesh=>mesh.key.bodyId==='moon'));assert.equal(f.runtime.metrics.resident,1);
  f.runtime.setDebugDemand(false);assert.equal(f.runtime.metrics.meshBytes,0);f.runtime.dispose();
});
test('T_VOLUME_MC_MESH_CACHE_CHUNK_BYTE_LIMITS_AND_SOURCE_IDENTITY',()=>{
  const field=new PlanetVolumeField(EarthSurfaceGenerator),radius=planetSurfaceRadius(field.surface,[1,0,0]);
  const chunk=generateVolumeChunk(field,chunkContainingPoint('earth',[radius,128,128])),mesh=meshVolumeChunk(chunk);
  const cache=new PlanetVolumeMeshCache({maxMeshes:1,maxBytes:volumeMeshByteLength(mesh)});
  assert.equal(cache.insert(chunk,mesh),true);assert.equal(cache.stats().bytes,volumeMeshByteLength(mesh));
  const replacement=generateVolumeChunk(field,chunk.key);assert.equal(cache.get(replacement),undefined);assert.equal(cache.stats().resident,0);
  assert.equal(new PlanetVolumeMeshCache({maxMeshes:1,maxBytes:1}).insert(chunk,mesh),false);
  cache.insert(chunk,mesh);chunk.state='stale';assert.equal(cache.get(chunk),undefined);assert.equal(cache.stats().bytes,0);
});
test('T_VOLUME_MC_MESH_CACHE_LRU_AND_BYTE_EVICTION',()=>{
  const field=new PlanetVolumeField(EarthSurfaceGenerator),radius=planetSurfaceRadius(field.surface,[1,0,0]);
  const sources=[128,384,640].map(y=>generateVolumeChunk(field,chunkContainingPoint('earth',[radius,y,128])));
  const meshes=sources.map(meshVolumeChunk),cache=new PlanetVolumeMeshCache({maxMeshes:2,maxBytes:1048576});
  cache.insert(sources[0],meshes[0]);cache.insert(sources[1],meshes[1]);cache.get(sources[0]);cache.insert(sources[2],meshes[2]);
  assert.equal(cache.get(sources[1]),undefined);assert.equal(cache.get(sources[0]),meshes[0]);assert.equal(cache.stats().resident,2);
  const bytes=new PlanetVolumeMeshCache({maxMeshes:8,maxBytes:Math.max(...meshes.map(volumeMeshByteLength))});
  for(let i=0;i<sources.length;i++) bytes.insert(sources[i],meshes[i]);
  assert.equal(bytes.stats().resident,1);assert.ok(bytes.stats().bytes<=bytes.limits.maxBytes);bytes.clearAll();assert.equal(bytes.stats().bytes,0);
});
test('T_VOLUME_MC_ZERO_GRANT_AND_COOPERATIVE_JOB_CANCEL',()=>{
  let ticks=0;
  const runtime=new PlanetVolumeRuntime({resolve:()=>({surface:EarthSurfaceGenerator,observerBodyFixedM:[6378137,128,128]}),clock:()=>{ticks+=.001;return ticks;}});
  runtime.setDebugDemand(true);runtime.setDebugMeshing(true);runtime.covers(context);runtime.advance(0);
  assert.equal(runtime.metrics.meshJobBytes,0);assert.equal(runtime.metrics.pendingBytes,0);
  // Fill the nearest scalar first; then use tiny grants to prove mesh extraction is resumable.
  runtime.advance(100);runtime.covers(context);
  runtime.setDebugMeshing(false);runtime.setDebugMeshing(true);runtime.covers(context);runtime.advance(.02);
  assert.equal(runtime.metrics.meshBytes,0);assert.ok(runtime.metrics.meshJobBytes>0);
  runtime.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:[6378137,128,128],radiusM:60});runtime.covers(context);
  assert.equal(runtime.metrics.meshJobBytes,0);runtime.advance(100);assert.equal(runtime.meshes[0].sourceRevision,1);runtime.dispose();
});
test('T_VOLUME_MC_SMALL_BUDGET_DOES_NOT_THRASH_OR_ALLOCATE_MESH_JOB',()=>{
  const runtime=new PlanetVolumeRuntime({resolve:()=>({surface:EarthSurfaceGenerator,observerBodyFixedM:[6378137,128,128]}),
    meshLimits:{maxMeshes:8,maxBytes:1},clock:()=>0});
  runtime.setDebugDemand(true);runtime.setDebugMeshing(true);
  for(let i=0;i<40;i++) {runtime.covers(context);runtime.advance(100);}
  assert.equal(runtime.metrics.residentMeshes,0);assert.equal(runtime.metrics.meshJobBytes,0);assert.equal(runtime.metrics.pendingMeshes,0);runtime.dispose();
});
test('T_VOLUME_MC_GEOMETRY_ADAPTER_LOCAL_ATTRIBUTES_AND_DISPOSAL',()=>{
  const field=new PlanetVolumeField(EarthSurfaceGenerator),chunk=generateVolumeChunk(field,chunkContainingPoint('earth',[6378137,128,128]));
  const mesh=meshVolumeChunk(chunk),geometry=createVolumeMeshGeometry(mesh);
  assert.equal(geometry.getAttribute('position').array,mesh.positions);assert.equal(geometry.getAttribute('normal').array,mesh.normals);
  assert.equal(geometry.getIndex()!.array,mesh.indices);assert.ok(geometry.boundingBox!.max.x<=256);
  assert.ok(geometry.boundingSphere!.radius<256);assert.ok(mesh.originBodyFixedM[0]>6e6);
  let disposed=false;geometry.addEventListener('dispose',()=>{disposed=true;});geometry.dispose();assert.equal(disposed,true);
});
