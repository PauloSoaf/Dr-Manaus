import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore.ts';
import { generateVolumeChunk, PlanetVolumeChunkGenerationJob } from '../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import { chunkByteLength } from '../src/world/planet/volume/PlanetVolumeChunk.ts';
import { chunkKeyToString, parseChunkKey, volumeChunkKey, chunkContainingPoint, chunkBoundsBodyFixedM,
  chunkSamplePosition, DEFAULT_VOLUME_LOD } from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { MarsSurfaceGenerator } from '../src/world/planet/MarsSurface.ts';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface.ts';

export const sphereSurface: PlanetSurfaceGenerator = {
  body: { id: 'test-body', semiMajorAxisM: 1024, flattening: 0, rotationPeriodS: 1, parentFrame: 'test/fixed' },
  radiusM: 1024, heightAt: ()=>0, normalEnu: (_d,out)=>{out[0]=0;out[1]=0;out[2]=1;},
  colourAt: (_d,out)=>{out[0]=1;out[1]=1;out[2]=1;},
};
const key = (x=0,y=0,z=0,lod=0,body='test-body') => volumeChunkKey(body,lod,x,y,z);
function verifySamples(field: PlanetVolumeField, chunk: ReturnType<typeof generateVolumeChunk>): void {
  const n=chunk.samplesPerAxis;
  for (let z=0;z<n;z++) for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
    const p=chunkSamplePosition(chunk.key,x,y,z);
    assert.equal(chunk.distances[x+n*(y+n*z)],Math.fround(field.signedDistanceBodyFixed(p)));
  }
}
test('T_VOLUME_CHUNK_KEY_ROUNDTRIP',()=>{
  for (const body of ['earth','moon','mars','odd/body %']) for (const lod of [0,1,3]) {
    const k=volumeChunkKey(body,lod,-42,13,0);
    assert.deepEqual(parseChunkKey(chunkKeyToString(k)),k); assert.ok(Object.isFrozen(k));
  }
  for (const bad of ['volume/earth/0/01/0/0','volume/earth/-1/0/0/0','volume/%zz/0/0/0/0','volume/earth/0/NaN/0/0']) assert.equal(parseChunkKey(bad),undefined);
});
test('T_VOLUME_CHUNK_NEGATIVE_COORDINATES',()=>{
  assert.deepEqual(chunkContainingPoint('earth',[-.1,-256,-256.1]),volumeChunkKey('earth',0,-1,-1,-2));
  assert.throws(()=>chunkContainingPoint('earth',[Infinity,0,0]));
});
test('T_VOLUME_CHUNK_BOUNDS',()=>{
  assert.deepEqual(chunkBoundsBodyFixedM(key(-1,2,3)),{minBodyFixedM:[-256,512,768],maxBodyFixedM:[0,768,1024]});
  assert.deepEqual(chunkBoundsBodyFixedM(key(1,0,0,2)).maxBodyFixedM,[2048,1024,1024]);
});
test('T_VOLUME_CHUNK_LOD_ALIGNMENT',()=>{
  for (let x=0;x<=8;x++) for (let y=0;y<=8;y++) for (let z=0;z<=8;z++) {
    assert.deepEqual(chunkSamplePosition(key(-2,0,0),x*2,y*2,z*2),chunkSamplePosition(key(-1,0,0,1),x,y,z));
  }
});
test('T_VOLUME_ADJACENT_BOUNDARY_POSITIONS_MATCH',()=>{
  const field=new PlanetVolumeField(sphereSurface), store=field.edits;
  store.subtractSphere({bodyId:field.bodyId,centerBodyFixedM:[256,128,128],radiusM:40});
  for (let axis=0;axis<3;axis++) {
    const origin=[0,0,0], adjacent=[0,0,0]; adjacent[axis]=1;
    const a=key(...origin as [number,number,number]), b=key(...adjacent as [number,number,number]);
    const ca=generateVolumeChunk(field,a), cb=generateVolumeChunk(field,b), n=17;
    for (let u=0;u<n;u++) for (let v=0;v<n;v++) {
      const ia=[u,v,0], ib=[u,v,0];
      const others=[0,1,2].filter(i=>i!==axis);
      ia[axis]=16;ib[axis]=0; ia[others[0]]=ib[others[0]]=u;ia[others[1]]=ib[others[1]]=v;
      assert.deepEqual(chunkSamplePosition(a,...ia as [number,number,number]),chunkSamplePosition(b,...ib as [number,number,number]));
      assert.equal(ca.distances[ia[0]+n*(ia[1]+n*ia[2])],cb.distances[ib[0]+n*(ib[1]+n*ib[2])]);
    }
  }
});
test('T_VOLUME_CHUNK_SAMPLE_COUNT',()=>{
  const chunk=generateVolumeChunk(new PlanetVolumeField(sphereSurface),key());
  assert.equal(chunk.distances.length,4913); assert.equal(chunk.cellsPerAxis,16); assert.equal(chunk.spacingM,16);
});
test('T_VOLUME_CHUNK_MEMORY_ACCOUNTING',()=>{
  const job=new PlanetVolumeChunkGenerationJob(new PlanetVolumeField(sphereSurface),key());
  assert.equal(job.pendingBytes,58956);while(!job.advance()) {}
  assert.equal(chunkByteLength(job.chunk!),19652);assert.equal(job.chunk!.materials,undefined);
  assert.equal(chunkByteLength({...job.chunk!,materials:new Uint8Array(4913)}),24565);
});
test('T_VOLUME_CHUNK_INTACT_SOLID_CLASSIFICATION',()=>{
  assert.equal(generateVolumeChunk(new PlanetVolumeField(sphereSurface),key()).classification,'SOLID');
});
test('T_VOLUME_CHUNK_INTACT_EMPTY_CLASSIFICATION',()=>{
  assert.equal(generateVolumeChunk(new PlanetVolumeField(sphereSurface),key(5)).classification,'EMPTY');
});
test('T_VOLUME_CHUNK_SURFACE_MIXED_CLASSIFICATION',()=>{
  assert.equal(generateVolumeChunk(new PlanetVolumeField(sphereSurface),key(3)).classification,'MIXED');
});
test('T_VOLUME_CHUNK_SPHERE_EDIT_SAMPLING',()=>{
  const field=new PlanetVolumeField(sphereSurface);
  field.edits.subtractSphere({bodyId:field.bodyId,centerBodyFixedM:[128,128,128],radiusM:30});
  const chunk=generateVolumeChunk(field,key()); verifySamples(field,chunk);
  assert.equal(chunk.classification,'MIXED');
  // All eight corners remain negative; the internal cut is found by sampling the whole grid.
  for (const x of [0,16]) for (const y of [0,16]) for (const z of [0,16]) assert.ok(chunk.distances[x+17*(y+17*z)]<0);
});
test('T_VOLUME_CHUNK_CAPSULE_EDIT_SAMPLING',()=>{
  const field=new PlanetVolumeField(sphereSurface);
  field.edits.subtractCapsule({bodyId:field.bodyId,aBodyFixedM:[-2048,128,128],bBodyFixedM:[2048,128,128],radiusM:32});
  const chunk=generateVolumeChunk(field,key());verifySamples(field,chunk);assert.equal(chunk.classification,'MIXED');
});
test('T_VOLUME_CHUNK_BATCH_QUERY_ONCE',()=>{
  const store=new PlanetVolumeEditStore(), field=new PlanetVolumeField(sphereSurface,store);
  store.subtractSphere({bodyId:field.bodyId,centerBodyFixedM:[600,128,128],radiusM:20});
  let queries=0;const original=store.queryBounds.bind(store);
  store.queryBounds=(...args)=>{queries++;return original(...args);};
  const chunk=generateVolumeChunk(field,key());assert.equal(queries,1);
  assert.equal(chunk.overlappingEditCount,1,'a cut outside the physical chunk can change its negative numerical distance');
  verifySamples(field,chunk);
});
test('T_VOLUME_CHUNK_SOURCE_REVISION',()=>{
  const field=new PlanetVolumeField(sphereSurface), before=generateVolumeChunk(field,key());
  const job=new PlanetVolumeChunkGenerationJob(field,key());job.advance();
  field.edits.subtractSphere({bodyId:field.bodyId,centerBodyFixedM:[0,0,0],radiusM:20});
  assert.equal(before.sourceRevision,0);assert.equal(job.obsolete,true);assert.throws(()=>job.advance());
  assert.equal(generateVolumeChunk(field,key()).sourceRevision,1);
});
test('T_VOLUME_EARTH_MOON_MARS_SHARED_IMPLEMENTATION',()=>{
  for (const surface of [EarthSurfaceGenerator,MoonSurfaceGenerator,MarsSurfaceGenerator]) {
    const field=new PlanetVolumeField(surface), radius=planetSurfaceRadius(surface,[1,0,0]);
    const k=chunkContainingPoint(field.bodyId,[radius,0,0]);const chunk=generateVolumeChunk(field,k);
    verifySamples(field,chunk); assert.equal(chunk.key.bodyId,surface.body.id);
  }
});
test('T_VOLUME_CENTRE_SAFE',()=>{
  for (const surface of [EarthSurfaceGenerator,MoonSurfaceGenerator,MarsSurfaceGenerator]) {
    const field=new PlanetVolumeField(surface), chunk=generateVolumeChunk(field,chunkContainingPoint(field.bodyId,[0,0,0]));
    assert.ok([...chunk.distances].every(Number.isFinite));assert.equal(chunk.classification,'SOLID');
  }
});
test('T_VOLUME_NO_THREE_IMPORT_IN_GENERATOR',()=>{
  for (const file of ['PlanetVolumeChunkGenerator','PlanetVolumeField','PlanetVolumeChunkKey','PlanetVolumeChunkDemand']) {
    const source=readFileSync(new URL(`../src/world/planet/volume/${file}.ts`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/from\s+['"]three|document\.|window\.|setInterval\(|Promise\.all\(/);
  }
});
test('volume generation can pause and resumes without changing sample values',()=>{
  const field=new PlanetVolumeField(sphereSurface), job=new PlanetVolumeChunkGenerationJob(field,key());
  assert.equal(job.advance(1),false);assert.equal(job.chunk,undefined);
  assert.throws(()=>job.advance(0));while(!job.advance(128)) {}
  assert.deepEqual(job.chunk!.distances,generateVolumeChunk(field,key()).distances);
});
