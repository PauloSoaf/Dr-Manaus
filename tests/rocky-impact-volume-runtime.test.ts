import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Raycaster } from 'three/webgpu';
import { impactFixture,rockyEvent } from './helpers/rocky-impact.ts';
import { chunkKeyToString,chunkBoundsBodyFixedM,volumeChunkKey } from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import { selectImpactVolumeDemand } from '../src/world/planet/volume/PlanetVolumeImpactDemand.ts';
import { generateVolumeChunk } from '../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { createRenderOrigin } from '../src/world/spatial/RenderOrigin.ts';

const f=impactFixture();f.consume();f.ready();
test.after(()=>f.dispose());
const reset=(x=0,y=2,z=0)=>{f.bind();f.player.teleport(new Vector3(x,y,z));f.player.state='Falling';f.player.velocity.set(0,0,0);f.held.clear();};
test('T_D1_EDIT_INVALIDATES_ONLY_INTERSECTING_CHUNKS',()=>{
  const unaffected=generateVolumeChunk(new PlanetVolumeField(f.surface,f.runtime.edits),volumeChunkKey('moon',0,100000,0,0));f.runtime.cache.insert(unaffected);
  f.runtime.edits.subtractSphere({bodyId:'moon',centerBodyFixedM:f.point,radiusM:1,id:'invalidate-local'});
  assert.ok(f.runtime.cache.stats().stale>0);assert.equal(unaffected.state,'ready');f.runtime.edits.remove('invalidate-local');
});
test('T_D1_UNAFFECTED_CHUNK_SURVIVES',()=>{const key=volumeChunkKey('moon',0,100000,0,0);assert.equal(f.runtime.cache.peek(key)!.state,'ready');});
for(const name of ['IMPACT_REGION_CREATES_PRODUCTION_DEMAND','PRODUCTION_DEMAND_NO_DEBUG_FLAG'])test(`T_D1_${name}`,()=>{
  assert.ok(f.runtime.metrics.productionActive);assert.ok(f.runtime.stats().id==='planet/volume');assert.equal((f.runtime as any).enabled,false);
});
for(const name of ['DEMAND_BOUNDED','433M_CRATER_RESIDENCY_BOUNDED'])test(`T_D1_${name}`,()=>{
  assert.ok(f.runtime.metrics.resident<=128&&f.runtime.metrics.bytes<=4*1048576);assert.ok(f.runtime.collisionMetrics.resident<=128&&f.runtime.collisionMetrics.bytes<=32*1048576);
});
test('T_D1_925M_LOGICAL_CRATER_SPARSE_RESIDENCY',()=>{const large=impactFixture('moon',50000);try{large.consume();large.frame();const edit=large.runtime.edits.allEdits()[0];
  assert.ok(edit.type==='subtract-sphere'&&edit.impact!.craterRadiusM>924);assert.ok(large.runtime.metrics.pending<=128);assert.equal(large.runtime.edits.editCount,1);
}finally{large.dispose();}});
test('T_D1_NEAR_CHUNKS_PRIORITY',()=>{const keys=selectImpactVolumeDemand(f.runtime.edits,'moon',f.point,f.runtime.lod,128);assert.ok(keys.length);
  const b=chunkBoundsBodyFixedM(keys[0]);assert.ok(f.point.every((v,i)=>v>=b.minBodyFixedM[i]-256&&v<=b.maxBodyFixedM[i]+256));});
test('T_D1_EDIT_SURVIVES_CACHE_EVICTION',()=>{const e=f.runtime.edits.get('moon:impact:unit-impact')!;f.observer([f.point[0]+100000,0,0]);f.frame();assert.equal(f.runtime.metrics.resident,0);assert.equal(f.runtime.edits.get(e.id),e);f.observer([...f.point]);});
test('T_D1_EDIT_REGENERATES_AFTER_RETURN',()=>{f.ready();assert.ok(f.ray());assert.ok(Math.abs(f.ray()!.point[1]+202.69)<2);});
test('T_D1_MOON_AND_MARS_EDIT_STORES_ISOLATED',()=>{const mars=f.universe.activeSystem.bodies.find(b=>b.id==='mars')!;f.service.consume(rockyEvent(mars,8000,'mars-isolated'));
  assert.equal(f.runtime.edits.editsForBody('mars').length,1);assert.ok(f.runtime.edits.editsForBody('moon').length>=1);});

function pendingCase(inspect:(state:any)=>void,second=false) {
  const x=impactFixture();try{x.consume();if(second)x.ready();const old=x.runtime.replacement.entries,oldColliders=x.runtime.collisionCache.values();
    if(second)x.service.consume({...x.event,eventId:'second',inwardRadialSpeedMps:10000,relativeSpeedMps:10000});
    x.frame(.00001);inspect({x,old,oldColliders});
  }finally{x.dispose();}
}
test('T_D1_INTACT_SURFACE_REMAINS_WHILE_REBUILD_PENDING',()=>pendingCase(({x})=>{assert.equal(x.renderer.stats.meshes,0);assert.equal(x.runtime.replacement.entries.length,0);assert.ok(Number.isFinite(x.terrain.heightAt(0,0)));}));
test('T_D1_OLD_COLLIDER_REMAINS_WHILE_REBUILD_PENDING',()=>pendingCase(({x,oldColliders})=>assert.deepEqual(x.runtime.collisionCache.values(),oldColliders),true));
test('T_D1_VISUAL_NOT_PUBLISHED_BEFORE_COLLIDER',()=>pendingCase(({x})=>{for(let i=0;i<3;i++)x.frame();assert.equal(x.runtime.replacement.entries.length,0);assert.equal(x.renderer.stats.meshes,0);}));
test('T_D1_COLLIDER_NOT_REPLACED_BEFORE_VISUAL_READY',()=>{const x=impactFixture();try{x.consume();x.runtime.setImpactPublication({prepare:()=>false,commit:()=>{throw new Error('early commit');},clear:()=>{}});
  for(let i=0;i<160;i++)x.frame();assert.equal(x.runtime.collisionCache.stats().resident,0);assert.equal(x.runtime.replacement.entries.length,0);
  x.runtime.setImpactPublication(x.renderer);x.ready();assert.ok(x.ray());}finally{x.dispose();}});
test('T_D1_ATOMIC_VISUAL_COLLISION_SWAP',()=>{for(const entry of f.runtime.replacement.entries)if(entry.mesh){assert.equal(f.runtime.collisionCache.peek(entry.source.key)!.sourceMesh,entry.mesh);
  assert.ok(f.renderer.root.children.some(m=>m.userData.volumeSource===entry.mesh));}});
test('T_D1_STALE_REVISION_NEVER_PUBLISHED',()=>{const x=impactFixture();try{x.consume();for(let i=0;i<5;i++)x.frame();x.service.consume({...x.event,eventId:'newer'});x.ready();
  assert.ok(x.runtime.replacement.entries.every(e=>e.source.state==='ready'));assert.ok(x.runtime.replacement.entries.some(e=>e.source.sourceRevision===2));}finally{x.dispose();}});
test('T_D1_SECOND_EDIT_ATOMIC_REPLACEMENT',()=>{const x=impactFixture();try{x.consume();x.ready();const old=x.runtime.replacement.entries,generation=x.runtime.replacement.generation;
  x.service.consume({...x.event,eventId:'overlap',inwardRadialSpeedMps:10000,relativeSpeedMps:10000});x.frame(.00001);assert.deepEqual(x.runtime.replacement.entries,old);
  for(let i=0;i<1600&&x.runtime.replacement.generation===generation;i++)x.frame();assert.ok(x.runtime.replacement.generation>generation);assert.equal(x.runtime.edits.editCount,2);
  assert.ok(x.ray()!.point[1]<-220);}finally{x.dispose();}});

test('T_D1_HEIGHTFIELD_ACTIVE_BEFORE_VOLUME_READY',()=>pendingCase(({x})=>assert.ok(Math.abs(x.terrain.heightAt(0,0))<.01)));
test('T_D1_HEIGHTFIELD_SUPPRESSED_AFTER_PUBLICATION',()=>assert.equal(f.terrain.heightAt(0,0),-Infinity));
test('T_D1_VOLUME_FLOOR_REPLACES_INTACT_GROUND',()=>assert.ok(f.ray()!.point[1]<-200));
test('T_D1_NO_DOUBLE_FLOOR',()=>{f.bind();const hit=PhysicsWorld.raycast(new Vector3(0,10,0),new Vector3(0,-1,0),[],1000,0,true)!;assert.ok(hit.point.y<-200);});
test('T_D1_NO_INVISIBLE_WALL_AT_RIM',()=>{reset(450,f.intact.heightAt(450,0)+.05);f.held.add('KeyA');for(let i=0;i<240;i++)f.step();assert.ok(f.player.position.x<430);assert.ok(f.player.position.y<0);});
test('T_D1_NO_COLLISION_GAP_AT_RIM',()=>{for(const x of [400,425,435,450,480]){const hit=f.ray(x);assert.ok(hit);assert.ok(hit!.normal.every(Number.isFinite));assert.ok(hit!.point[1]>-250);}});
test('T_D1_PLAYER_FALLS_TO_CRATER_FLOOR',()=>{reset();for(let i=0;i<900;i++)f.step();assert.ok(f.player.position.y<-200);});
test('T_D1_PLAYER_GROUNDED_ON_CRATER_FLOOR',()=>assert.equal(f.player.state,'Grounded'));
test('T_D1_PLAYER_WALKS_ON_CRATER_FLOOR',()=>{const before=f.player.position.clone();f.held.add('KeyW');for(let i=0;i<60;i++)f.step();f.held.clear();assert.ok(f.player.position.distanceTo(before)>1);assert.ok(f.player.position.y<-200);});
test('T_D1_PLAYER_BLOCKED_BY_CRATER_WALL',()=>{const hit=f.volume.sweepCapsule([0,-10,0],[1000,0,0],.32,2.1);assert.ok(hit);assert.ok(hit!.fraction<.5);assert.ok(hit!.normal[0]<-.5);});
for(const fps of [30,60,120])test(`T_D1_${fps}FPS`,()=>{reset();for(let i=0;i<fps*16;i++)f.step(1/fps);assert.equal(f.player.state,'Grounded');assert.ok(Math.abs(f.player.position.y-f.ray()!.point[1])<1);});
test('T_D1_FLOATING_ORIGIN_REBASE',()=>{const before=f.ray()!,source=f.runtime.collisionCache.values()[0].sourceMesh;
  f.universe.renderSpace.setOrigin(createRenderOrigin(f.local,[100,-20,30]));f.renderer.update();assert.equal(f.ray()!.distance,before.distance);assert.equal(f.runtime.collisionCache.values().find(c=>c.sourceMesh===source)!.sourceMesh,source);
  for(const mesh of f.renderer.root.children){const m=mesh.userData.volumeSource;assert.deepEqual(mesh.position.toArray(),f.universe.renderSpace.logicalToRender('moon/fixed',m.originBodyFixedM));}
});
test('T_D1_BODY_FIXED_EDIT_STABLE',()=>{const e=f.runtime.edits.get('moon:impact:unit-impact')!;const before=JSON.stringify(e);f.renderer.update();assert.equal(JSON.stringify(e),before);});
for(const id of ['moon','mars','earth'])test(`T_D1_${id.toUpperCase()}_LOCAL_ENU_COLLISION`,()=>{
  const x=impactFixture(id);try{x.consume();x.ready();x.bind();x.player.position.set(0,2,0);x.player.state='Falling';for(let i=0;i<1800;i++)x.step();
    assert.equal(x.player.state,'Grounded');assert.ok(x.player.position.y<-190);assert.equal(x.ray()!.bodyId,id);
    assert.equal(x.terrain.heightAt(0,0),-Infinity);
  }finally{x.dispose();}
});
test('production mesh raycast agrees with volume floor at centre and 25/50/75 percent radius',()=>{
  f.renderer.update();f.renderer.root.updateMatrixWorld(true);const raycaster=new Raycaster();raycaster.layers.enableAll();
  for(const ratio of [0,.25,.5,.75]){const x=433.056*ratio,from=f.universe.renderSpace.logicalToRender(f.local,[x,20,0]),
    direction=f.universe.frames.convertDirection(f.local,f.universe.renderSpace.currentOrigin.frame,[0,-1,0]);
    raycaster.set(new Vector3(...from),new Vector3(...direction));const hit=raycaster.intersectObjects(f.renderer.root.children,false)[0];assert.ok(hit);
    const local=f.universe.renderSpace.renderToLogical(hit.point.toArray(),f.local);assert.ok(Math.abs(local[1]-f.ray(x)!.point[1])<.001);
  }
});
