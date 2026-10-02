import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';
import { generateVolumeChunk } from '../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import { PlanetVolumeChunkCache } from '../src/world/planet/volume/PlanetVolumeChunkCache.ts';
import { volumeChunkKey } from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface.ts';

const surface: PlanetSurfaceGenerator = {
  body:{id:'earth',semiMajorAxisM:1024,flattening:0,rotationPeriodS:1,parentFrame:'test'},radiusM:1024,
  heightAt:()=>0,normalEnu:()=>{},colourAt:()=>{},
};
const key=(x=0,body='earth')=>volumeChunkKey(body,0,x,0,0);
function fixture(maxChunks=64,maxBytes=2097152) {
  const field=new PlanetVolumeField(surface),cache=new PlanetVolumeChunkCache({maxChunks,maxBytes},field.edits);
  const make=(x:number)=>generateVolumeChunk(field,key(x));return {field,cache,make};
}
test('T_VOLUME_EDIT_INVALIDATES_INTERSECTING_RESIDENT_CHUNKS',()=>{
  const {field,cache,make}=fixture();cache.insert(make(0));cache.insert(make(20));
  field.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:[128,128,128],radiusM:20});
  assert.equal(cache.peek(key())!.state,'stale');assert.equal(cache.has(key(20)),true);assert.equal(cache.stats().stale,1);
  assert.equal(cache.get(key()),undefined);
  cache.insert(make(0));assert.equal(cache.has(key()),true);assert.equal(cache.peek(key())!.sourceRevision,1);
});
test('T_VOLUME_EDIT_DOES_NOT_INVALIDATE_UNRELATED_CHUNKS',()=>{
  const {field,cache,make}=fixture();cache.insert(make(20));
  field.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:[0,0,0],radiusM:20});
  assert.equal(cache.peek(key(20))!.sourceRevision,0);assert.equal(cache.has(key(20)),true);
  assert.equal(cache.stats().resident,1,'an edit never allocates a chunk');
});
test('T_VOLUME_EDIT_REMOVAL_INVALIDATES',()=>{
  const {field,cache,make}=fixture();const id=field.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:[128,128,128],radiusM:30});
  const edited=make(0);cache.insert(edited);field.edits.remove(id);
  assert.equal(cache.peek(key())!.state,'stale');const intact=make(0);cache.insert(intact);
  assert.equal(intact.classification,'SOLID');assert.notDeepEqual(intact.distances,edited.distances);
  assert.equal(intact.sourceRevision,2);
});
test('numerical halo invalidates even when the cut does not touch the chunk',()=>{
  const {field,cache,make}=fixture();cache.insert(make(0));
  const id=field.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:[600,128,128],radiusM:20});
  assert.equal(cache.has(key()),false);const edited=make(0);cache.insert(edited);
  field.edits.remove(id);assert.equal(cache.has(key()),false);assert.notDeepEqual(make(0).distances,edited.distances);
});
test('T_VOLUME_CACHE_MAX_CHUNKS',()=>{
  const {cache,make}=fixture(2);for (let x=0;x<10;x++) cache.insert(make(x));
  assert.equal(cache.stats().resident,2);assert.equal(cache.stats().bytes,39304);assert.equal(cache.stats().evictions,8);
});
test('T_VOLUME_CACHE_MAX_BYTES',()=>{
  const {cache,make}=fixture(10,19652*2+1);for (let x=0;x<5;x++) cache.insert(make(x));
  assert.equal(cache.stats().resident,2);assert.equal(cache.stats().bytes,39304);
  const tiny=new PlanetVolumeChunkCache({maxChunks:1,maxBytes:19651});assert.equal(tiny.insert(make(0)),false);assert.equal(tiny.stats().bytes,0);
});
test('T_VOLUME_CACHE_LRU',()=>{
  const {cache,make}=fixture(2);cache.insert(make(0));cache.insert(make(1));cache.get(key(0));cache.insert(make(2));
  assert.equal(cache.has(key(1)),false);assert.equal(cache.has(key(0)),true);assert.equal(cache.has(key(2)),true);
  assert.equal(cache.remove(key(0)),true);assert.equal(cache.remove(key(0)),false);assert.equal(cache.stats().bytes,19652);
});
test('T_VOLUME_CACHE_BODY_ISOLATION',()=>{
  const {field,cache,make}=fixture();cache.insert(make(0));
  const lunar=new PlanetVolumeField({...surface,body:{...surface.body,id:'moon'}},field.edits);
  cache.insert(generateVolumeChunk(lunar,key(0,'moon')));
  field.edits.subtractSphere({bodyId:'earth',centerBodyFixedM:[128,128,128],radiusM:20});
  assert.equal(cache.has(key(0)),false);assert.equal(cache.has(key(0,'moon')),true);
  cache.clearBody('earth');assert.equal(cache.stats().resident,1);assert.equal(cache.stats('earth').bytes,0);
  cache.clearAll();assert.equal(cache.stats().bytes,0);cache.dispose();
});
test('retention margin keeps recently resident chunks near a demand edge',()=>{
  const {cache,make}=fixture();cache.insert(make(0));
  cache.retainNear('earth',[1500,128,128],1536,new Set());assert.equal(cache.has(key()),true);
  cache.retainNear('earth',[5000,128,128],1536,new Set());assert.equal(cache.stats().resident,0);
});
