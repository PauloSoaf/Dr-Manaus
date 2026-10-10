import test from 'node:test';
import assert from 'node:assert/strict';
import { selectVolumeChunkDemand, volumeBoundsInObserverBand, DEFAULT_VOLUME_DEMAND } from '../src/world/planet/volume/PlanetVolumeChunkDemand.ts';
import { chunkContainingPoint, chunkKeyToString, chunkBoundsBodyFixedM } from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import { PlanetVolumeRuntime } from '../src/world/planet/volume/PlanetVolumeRuntime.ts';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';
import { generateVolumeChunk } from '../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { MarsSurfaceGenerator } from '../src/world/planet/MarsSurface.ts';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { GlobalStreamingScheduler } from '../src/world/streaming/GlobalStreamingScheduler.ts';
import { ProviderRegistry } from '../src/world/runtime/ProviderRegistry.ts';
import { DEFAULT_STREAMING_BUDGET, StreamingLedger } from '../src/world/streaming/StreamingBudget.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { createRenderOrigin } from '../src/world/spatial/RenderOrigin.ts';
import type { StreamingContext } from '../src/world/providers/WorldProvider.ts';
import type { BodyFixedPoint } from '../src/world/planet/volume/PlanetVolumeEdit.ts';

const context = (): StreamingContext => ({
  spatial:{timeS:0,player:pose('test',[0,0,0]),frame:activeFrame(referenceFrame({id:'test',kind:'body-fixed'}),pose('test')),
    localVelocityMps:[0,0,0],bodyId:'earth',address:{galaxyId:'milky_way',sector:{x:0n,y:0n,z:0n},systemId:'sol',bodyId:'earth'}},
  camera:{fovRad:1,viewportHeightPx:900,forward:[0,0,-1]},quality:{sseTargetPx:8,detailFactor:1},budget:DEFAULT_STREAMING_BUDGET,
});
function fixture(maxChunks=8) {
  let observer: BodyFixedPoint=[EarthSurfaceGenerator.radiusM,0,0], surface=EarthSurfaceGenerator;
  let time=0,resolveCalls=0;
  const runtime=new PlanetVolumeRuntime({resolve:()=>{resolveCalls++;return {surface,observerBodyFixedM:observer};},
    cacheLimits:{maxChunks,maxBytes:2097152},clock:()=>{time+=.001;return time;}});
  const frame=(grant=100)=>{runtime.covers(context());runtime.advance(grant);};
  const fill=()=>{for(let i=0;i<maxChunks+3;i++) frame();};
  return {runtime,frame,fill,setObserver:(p:BodyFixedPoint)=>{observer=p;},
    setSurface:(s:PlanetSurfaceGenerator)=>{surface=s;},resolveCalls:()=>resolveCalls};
}
test('T_VOLUME_DEMAND_NEAREST_FIRST',()=>{
  const point: BodyFixedPoint=[6378137,13,37],demand=selectVolumeChunkDemand('earth',point);
  assert.deepEqual(demand[0].key,chunkContainingPoint('earth',point));
  for (let i=1;i<demand.length;i++) assert.ok(demand[i].distanceSquared>=demand[i-1].distanceSquared);
});
test('T_VOLUME_DEMAND_BOUNDED',()=>{
  for (const p of [[0,0,0],[6378137,0,0],[-1737400,-7,0],[1e9,2e9,-1e9]] as const) {
    const demand=selectVolumeChunkDemand('earth',p);assert.ok(demand.length>0&&demand.length<=32);
    assert.equal(new Set(demand.map(d=>chunkKeyToString(d.key))).size,demand.length);
  }
  assert.throws(()=>selectVolumeChunkDemand('earth',[0,0,0],undefined,{...DEFAULT_VOLUME_DEMAND,radiusM:1e12}));
});
test('T_VOLUME_DEMAND_LOD_DISTANCE',()=>{
  const demand=selectVolumeChunkDemand('earth',[6378137,13,37]);
  assert.equal(demand[0].key.lod,0);assert.ok(demand.some(d=>d.key.lod>0));
  const finest=demand.filter(d=>d.key.lod===0),coarse=demand.filter(d=>d.key.lod>0);
  assert.ok(coarse.every(d=>d.distanceSquared>=128**2));
  assert.ok(finest.every(d=>d.distanceSquared<(128+256*Math.sqrt(3))**2));
  const wider=selectVolumeChunkDemand('earth',[6378137,13,37],undefined,{...DEFAULT_VOLUME_DEMAND,maxDemands:128});
  assert.ok(wider.some(d=>d.key.lod>=2));
  // Selected dyadic leaves cannot have another selected chunk as an ancestor.
  for (const a of demand) for (const b of demand) if (a.key.lod<b.key.lod) {
    const factor=2**(b.key.lod-a.key.lod);
    assert.ok(Math.floor(a.key.x/factor)!==b.key.x||Math.floor(a.key.y/factor)!==b.key.y||Math.floor(a.key.z/factor)!==b.key.z);
  }
});
test('T_VOLUME_DEMAND_SURFACE_BAND',()=>{
  const observer: BodyFixedPoint=[6378137,0,0];
  for (const d of selectVolumeChunkDemand('earth',observer)) assert.equal(volumeBoundsInObserverBand(chunkBoundsBodyFixedM(d.key),observer,256),true);
  assert.equal(volumeBoundsInObserverBand({minBodyFixedM:[observer[0]+600,0,0],maxBodyFixedM:[observer[0]+856,256,256]},observer,256),false);
});
test('logical edits and an inactive runtime allocate zero sampled chunks',()=>{
  const f=fixture();const radius=EarthSurfaceGenerator.radiusM;
  f.runtime.edits.subtractCapsule({bodyId:'earth',aBodyFixedM:[-radius-100,0,0],bBodyFixedM:[radius+100,0,0],radiusM:100});
  for (let i=0;i<10;i++) f.frame();
  assert.deepEqual(f.runtime.edits.indexStats('earth'),{editCount:1,nodeCount:1});
  assert.equal(f.runtime.metrics.resident,0);assert.equal(f.runtime.metrics.pendingBytes,0);assert.equal(f.resolveCalls(),0);
  f.runtime.dispose();
});
test('T_VOLUME_OBSERVER_MOVEMENT_RETIRES_OLD_CHUNKS',()=>{
  const f=fixture(),radius=EarthSurfaceGenerator.radiusM;
  f.runtime.edits.subtractCapsule({bodyId:'earth',aBodyFixedM:[-radius-100,0,0],bBodyFixedM:[radius+100,0,0],radiusM:100});
  assert.equal(f.runtime.metrics.resident,0);f.runtime.setDebugDemand(true,true);
  let previous: ReturnType<typeof chunkContainingPoint> | undefined;
  for (const point of [[radius,0,0],[0,0,0],[-radius,0,0]] as const) {
    f.setObserver(point);f.fill();const current=chunkContainingPoint('earth',point);
    assert.equal(f.runtime.cache.has(current),true);if(previous) assert.equal(f.runtime.cache.has(previous),false);
    assert.ok(f.runtime.metrics.resident<=8);assert.equal(f.runtime.metrics.bytes,f.runtime.metrics.resident*19652);
    assert.equal(f.runtime.cache.peek(current)!.overlappingEditCount,1);
    assert.equal(f.runtime.edits.editCount,1);previous=current;
  }
  f.runtime.setDebugDemand(false);assert.equal(f.runtime.metrics.bytes,0);assert.equal(f.runtime.metrics.pendingBytes,0);
});
test('global scheduler grants volume work; zero grants allocate nothing and batches resume',()=>{
  let time=0;
  const runtime=new PlanetVolumeRuntime({resolve:()=>({surface:EarthSurfaceGenerator,observerBodyFixedM:[6378137,0,0]}),
    clock:()=>{time+=.01;return time;}});
  runtime.setDebugDemand(true);runtime.covers(context());runtime.advance(0);
  assert.equal(runtime.metrics.resident,0);assert.equal(runtime.metrics.pendingBytes,0);
  runtime.advance(.02);assert.equal(runtime.metrics.resident,0);assert.equal(runtime.metrics.pendingBytes,58956);
  class TestLedger extends StreamingLedger {protected nowMs():number{return time;}}
  const scheduler=new GlobalStreamingScheduler(new ProviderRegistry(),{ledger:new TestLedger()});scheduler.registerSubsystem(runtime);
  for(let i=0;i<20;i++) scheduler.update(context(),1/60);
  assert.ok(runtime.metrics.resident>0);assert.ok(runtime.metrics.generatedThisFrame<=1);
  assert.ok(runtime.metrics.grantedMs<=DEFAULT_STREAMING_BUDGET.mainThreadMs);
  assert.ok(scheduler.stats.subsystems.some(s=>s.id==='planet/volume'));
  runtime.advance(100);assert.ok(runtime.metrics.generatedThisFrame<=1,'one completed chunk per scheduler frame');
  scheduler.unregisterSubsystem(runtime.id);runtime.dispose();scheduler.dispose();
});
test('a pending job is discarded after an edit revision and regenerated',()=>{
  let time=0;
  const runtime=new PlanetVolumeRuntime({resolve:()=>({surface:MoonSurfaceGenerator,observerBodyFixedM:[1737400,0,0]}),
    clock:()=>{time+=.01;return time;}});
  runtime.setDebugDemand(true);runtime.covers(context());runtime.advance(.02);assert.equal(runtime.metrics.pendingBytes,58956);
  runtime.edits.subtractSphere({bodyId:'moon',centerBodyFixedM:[1737400,0,0],radiusM:100});
  runtime.covers(context());assert.equal(runtime.metrics.pendingBytes,0);runtime.advance(100);
  const nearest=chunkContainingPoint('moon',[1737400,0,0]);assert.equal(runtime.cache.peek(nearest)!.sourceRevision,1);
  runtime.dispose();
});
test('runtime demand fits a small byte cap without repeated regeneration',()=>{
  const runtime=new PlanetVolumeRuntime({resolve:()=>({surface:EarthSurfaceGenerator,observerBodyFixedM:[6378137,0,0]}),
    cacheLimits:{maxChunks:64,maxBytes:19652*2},clock:()=>0});
  runtime.setDebugDemand(true);
  for(let i=0;i<10;i++) {runtime.covers(context());runtime.advance(100);}
  assert.equal(runtime.metrics.resident,2);assert.equal(runtime.metrics.pending,0);assert.equal(runtime.metrics.generatedThisFrame,0);
  runtime.dispose();
});
test('Earth, Moon and Mars switch one resident manager and retire the previous body',()=>{
  const f=fixture();f.runtime.setDebugDemand(true);
  for(const surface of [EarthSurfaceGenerator,MoonSurfaceGenerator,MarsSurfaceGenerator]) {
    f.setSurface(surface);f.setObserver([planetSurfaceRadius(surface,[1,0,0]),0,0]);f.frame();
    assert.equal(f.runtime.metrics.bodyId,surface.body.id);assert.equal(f.runtime.metrics.resident,1);
    assert.equal(f.runtime.cache.stats().bytes,19652);assert.equal(f.runtime.cache.stats(surface.body.id).resident,1);
  }
  f.setObserver([1e9,0,0]);f.frame();assert.equal(f.runtime.metrics.resident,0);assert.equal(f.runtime.metrics.bodyId,undefined);
  f.runtime.dispose();
});
test('T_VOLUME_GAS_GIANTS_DISABLED',()=>{
  const universe=new UniverseRuntime({streaming:true});universe.volume.setDebugDemand(true,true);
  for (const id of ['sun','jupiter','saturn','uranus','neptune','io','europa','ganymede','callisto','titan','enceladus','titania','oberon','triton']) {
    const body=universe.solarSystem.bodies.find(b=>b.id===id)!;universe.setPlayerPose(body.frameId,[body.equatorialRadiusM+100,0,0]);
    universe.updateStreaming(1/60);assert.equal(universe.volume.metrics.resident,0,id);assert.equal(universe.volume.metrics.pendingBytes,0,id);
  }
  universe.dispose();
});
test('T_VOLUME_REBASE_DOES_NOT_CHANGE_KEYS',()=>{
  const universe=new UniverseRuntime({streaming:true}),body=universe.solarSystem.bodies.find(b=>b.id==='moon')!;
  const fixed:[number,number,number]=[planetSurfaceRadius(MoonSurfaceGenerator,[1,0,0]),31,42];
  universe.setPlayerPose(body.frameId,fixed);universe.volume.setDebugDemand(true);universe.updateStreaming(1/60);
  const before=universe.volume.metrics.nearestChunk;
  for (const origin of [[1e11,-2e11,3e11],[-4e11,7e11,1e11],[0,0,0]] as [number,number,number][]) {
    universe.renderSpace.setOrigin(createRenderOrigin('solar-system/barycentric',origin));universe.updateStreaming(1/60);
    assert.equal(universe.volume.metrics.nearestChunk,before);
  }
  universe.dispose();
});
test('T_VOLUME_REBASE_DOES_NOT_CHANGE_SAMPLES',()=>{
  const universe=new UniverseRuntime({streaming:true}),body=universe.solarSystem.bodies.find(b=>b.id==='moon')!;
  const fixed:[number,number,number]=[1737400,31,42],field=new PlanetVolumeField(MoonSurfaceGenerator);
  const k=chunkContainingPoint('moon',fixed);
  universe.setPlayerPose(body.frameId,fixed);universe.volume.setDebugDemand(true);
  for(let i=0;i<80&&!universe.volume.cache.has(k);i++) universe.updateStreaming(1/60);
  const before=universe.volume.cache.get(k)!;assert.ok(before);
  const values=before.distances.slice();assert.deepEqual(values,generateVolumeChunk(field,k).distances);
  for (const origin of [[1e11,-2e11,3e11],[-4e11,7e11,1e11]] as [number,number,number][]) {
    universe.renderSpace.setOrigin(createRenderOrigin('solar-system/barycentric',origin));
    const rendered=universe.renderSpace.logicalToRender(body.frameId,fixed);
    universe.updateStreaming(1/60);
    assert.ok(rendered.every(Number.isFinite));assert.equal(universe.volume.cache.get(k),before);
    assert.deepEqual(before.distances,values);
  }
  universe.dispose();
});
