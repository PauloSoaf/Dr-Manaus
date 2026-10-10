import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Frustum,Matrix4,Mesh,MeshBasicNodeMaterial,PerspectiveCamera,Vector3} from 'three/webgpu';
import {impactFixture,rockyEvent} from './helpers/rocky-impact.ts';
import {selectImpactResidency} from '../src/world/planet/volume/PlanetImpactResidency.ts';
import {PlanetVolumeSurfaceMask} from '../src/rendering/PlanetVolumeSurfaceMask.ts';
import {bodySolarDirection,planetDirectLight} from '../src/rendering/PlanetVolumeLighting.ts';
import {chunkKeyToString,samplingProfileOf} from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import {referenceFrame} from '../src/world/spatial/ReferenceFrame.ts';
import {createRenderOrigin} from '../src/world/spatial/RenderOrigin.ts';
import {quatFromAxisAngle} from '../src/world/spatial/units.ts';
import {PlanetGlobe} from '../src/world/planet/PlanetGlobe.ts';
import {serializePlanetVolumeEdits,deserializePlanetVolumeEdits} from '../src/world/planet/volume/PlanetVolumePersistence.ts';

const name=(s:string)=>`T_D11_${s}`;
function addImpact(f:ReturnType<typeof impactFixture>,offset:number,id:string){
  const event=rockyEvent(f.body,260);return f.service.consume({...event,eventId:id,contactBodyFixedM:[f.point[0]+1000,offset,0]});
}
function wait(f:ReturnType<typeof impactFixture>,regions:number){for(let i=0;i<2400;i++){f.frame();
  if(f.runtime.metrics.publishedRegions===regions&&!f.runtime.metrics.pending&&!f.runtime.metrics.pendingMeshes&&!f.runtime.collisionMetrics.pending)return;}
  throw new Error(JSON.stringify(f.runtime.metrics));}
const multi=impactFixture('moon',260);multi.consume();addImpact(multi,500,'second');wait(multi,2);test.after(()=>multi.dispose());
test(name('TWO_CRATERS_SIMULTANEOUSLY_PUBLISHED'),()=>{assert.equal(multi.runtime.metrics.publishedRegions,2);
  assert.equal(multi.runtime.metrics.publishedReplacements,8);assert.equal(multi.renderer.root.children.length,8);});
test(name('FIRST_CRATER_DOES_NOT_HEAL_NEAR_SECOND'),()=>{const before=multi.runtime.replacement.entries;
  multi.observer([multi.point[0],500,0]);for(let i=0;i<8;i++)multi.frame();assert.equal(multi.runtime.replacement.entries,before);
  multi.observer([...multi.point]);multi.frame();assert.equal(multi.runtime.replacement.entries,before);});
test(name('MULTI_CRATER_COLLISION_PERSISTS'),()=>{assert.ok(multi.volume.sweepCapsule([0,-10,0],[200,0,0],.32,2.1));
  assert.ok(multi.volume.sweepCapsule([500,-10,0],[200,0,0],.32,2.1));});
test(name('MULTI_CRATER_MASK_PERSISTS'),()=>{assert.equal(multi.terrain.heightAt(0,0),-Infinity);assert.equal(multi.terrain.heightAt(500,0),-Infinity);});
test(name('MULTI_CRATER_RAYCAST'),()=>{assert.ok(multi.ray()!.point[1]<-25);assert.ok(multi.ray(500)!.point[1]<-25);});
const budget={maxChunks:8,maxScalarBytes:8*169884,standardCapacity:8,highCapacity:4};
test(name('MULTI_REGION_CAPACITY_COHERENT'),()=>{const f=impactFixture('moon',260);try{f.consume();addImpact(f,500,'B');addImpact(f,1000,'C');
  const plan=selectImpactResidency(f.runtime.edits,'moon',f.point,f.runtime.lod,budget);assert.equal(plan.regions.length,2);assert.equal(plan.keys.length,8);
  for(const region of plan.regions)assert.equal(region.keys.length,4);assert.equal(f.runtime.edits.editCount,3);}finally{f.dispose();}});
test(name('NO_PARTIAL_CRATER_PUBLICATION'),()=>{const f=impactFixture('moon',260);try{f.consume();addImpact(f,500,'B');
  (f.runtime.cache as any).limits={maxChunks:6,maxBytes:6*169884};wait(f,1);assert.equal(f.runtime.replacement.entries.length,4);
  assert.equal(f.runtime.edits.editCount,2);assert.equal(f.terrain.heightAt(500,0),f.intact.heightAt(500,0));}finally{f.dispose();}});
test(name('REGION_SELECTION_DETERMINISTIC'),()=>{const first=selectImpactResidency(multi.runtime.edits,'moon',multi.point,multi.runtime.lod,budget);
  for(let i=0;i<10;i++)assert.deepEqual(selectImpactResidency(multi.runtime.edits,'moon',multi.point,multi.runtime.lod,budget),first);});
test(name('REGION_HYSTERESIS'),()=>{const plan=selectImpactResidency(multi.runtime.edits,'moon',[multi.point[0],230,0],multi.runtime.lod,{...budget,maxChunks:4});
  const retained=selectImpactResidency(multi.runtime.edits,'moon',[multi.point[0],260,0],multi.runtime.lod,{...budget,maxChunks:4},plan.regions);
  assert.equal(retained.regions[0].editId,plan.regions[0].editId);});
test(name('EVICTED_EDIT_REGENERATES'),()=>{const f=impactFixture('moon',260);try{f.consume();addImpact(f,500,'B');addImpact(f,1000,'C');
  (f.runtime.cache as any).limits={maxChunks:8,maxBytes:8*169884};wait(f,2);const first=f.runtime.metrics.publishedRegionIds[0];
  f.observer([f.point[0],1000,0]);for(let i=0;i<2400;i++){f.frame();if(!f.runtime.metrics.publishedRegionIds.includes(first)
    &&f.runtime.metrics.publishedRegionIds.includes(f.runtime.edits.allEdits()[2].id))break;}
  assert.equal(f.runtime.metrics.publishedRegionIds.includes(first),false);assert.equal(f.runtime.edits.editCount,3);
  f.observer([...f.point]);for(let i=0;i<2400&&!f.runtime.metrics.publishedRegionIds.includes(first);i++)f.frame();
  assert.ok(f.runtime.metrics.publishedRegionIds.includes(first));assert.ok(f.ray()!.point[1]<-25);assert.equal(f.runtime.edits.editCount,3);
}finally{f.dispose();}});
test('D1.1 geometry-byte eviction is stable until demand changes and returning restores the other crater',()=>{
  const f=impactFixture('moon',8000);try{
    (f.runtime.meshCache as any).limits={maxMeshes:128,maxBytes:450000};
    const first=f.consume();f.ready();
    const event=rockyEvent(f.body,8000),second=f.service.consume({...event,eventId:'byte-pressure-B',
      contactBodyFixedM:[f.point[0]+1000,1600,0]});
    for(let i=0;i<2400;i++){f.frame();if(f.runtime.metrics.regionAdmissionBlocked==='replacement-byte-budget'
      &&f.runtime.metrics.publishedRegions===1&&!f.runtime.metrics.pendingMeshes)break;}
    assert.ok(f.runtime.metrics.publishedRegionIds.includes(first));
    assert.equal(f.runtime.metrics.regionAdmissionBlocked,'replacement-byte-budget');
    const stable=f.runtime.replacement.entries;
    f.observer([f.point[0],1,1]);let repeatedBuilds=0;
    for(let i=0;i<20;i++){f.frame();repeatedBuilds+=f.runtime.metrics.generatedThisFrame
      +f.runtime.metrics.meshedThisFrame+f.runtime.collisionMetrics.buildsThisFrame;}
    assert.equal(f.runtime.replacement.entries,stable);assert.equal(repeatedBuilds,0);
    f.observer([f.point[0],1600,0]);
    for(let i=0;i<2400&&!f.runtime.metrics.publishedRegionIds.includes(second);i++)f.frame();
    assert.ok(f.runtime.metrics.publishedRegionIds.includes(second),'return must reconsider byte-evicted region');
    assert.ok(f.ray(1600)!.point[1]<-180);assert.equal(f.runtime.edits.editCount,2);
    assert.ok(f.runtime.metrics.meshBytes<=450000);
    f.observer([...f.point]);
    for(let i=0;i<2400&&!f.runtime.metrics.publishedRegionIds.includes(first);i++)f.frame();
    assert.ok(f.runtime.metrics.publishedRegionIds.includes(first));assert.ok(f.ray()!.point[1]<-180);
  }finally{f.dispose();}
});
test(name('VOLUME_LIGHT_USES_SOLAR_DIRECTION'),()=>{multi.renderer.update();const expected=bodySolarDirection(multi.universe.activeSystem,multi.universe.frames,'moon',multi.universe.renderSpace.currentOrigin.frame)!;
  const actual=multi.renderer.stats.lights.moon;for(let i=0;i<3;i++)assert.ok(Math.abs(actual[i]-expected[i])<1e-12);});
test(name('VOLUME_NIGHT_SIDE_DARK'),()=>{assert.equal(planetDirectLight(-1),.05);assert.equal(planetDirectLight(1),1);
  const prior=multi.renderer.stats.lights.moon;multi.universe.frames.register(referenceFrame({id:'d11-rotated-render',parentId:multi.local,kind:'surface-enu',
    rotationToParent:quatFromAxisAngle([0,0,1],Math.PI)}));multi.universe.renderSpace.setOrigin(createRenderOrigin('d11-rotated-render',[0,0,0]));multi.renderer.update();
  assert.notDeepEqual(multi.renderer.stats.lights.moon,prior);multi.universe.renderSpace.setOrigin(createRenderOrigin(multi.local,[0,0,0]));multi.renderer.update();});
test(name('LIGHT_MATCHES_INTACT_SURFACE'),()=>{const globe=new PlanetGlobe('moon');try{multi.renderer.update();
  const sun=bodySolarDirection(multi.universe.activeSystem,multi.universe.frames,'moon',multi.universe.renderSpace.currentOrigin.frame)!;
  globe.setSunDirection(sun);const intactSun=(globe as any).uSunDirectionRender.value as Vector3,volumeSun=new Vector3(...multi.renderer.stats.lights.moon);
  assert.ok(intactSun.distanceTo(volumeSun)<1e-12);const normal=new Vector3(...multi.ray(80)!.normal),up=new Vector3(0,1,0);
  assert.ok(Math.abs(planetDirectLight(normal.dot(volumeSun))-planetDirectLight(up.dot(intactSun)))<.01);
}finally{globe.dispose();}});
test(name('VOLUME_FRUSTUM_BOUNDS_VALID'),()=>{for(const child of multi.renderer.root.children){const mesh=child as Mesh,source=mesh.userData.volumeSource;
  const box=mesh.geometry.boundingBox!,sphere=mesh.geometry.boundingSphere!;assert.ok(mesh.frustumCulled);assert.ok(Number.isFinite(sphere.radius));
  for(let i=0;i<source.vertexCount;i++){const p=new Vector3().fromArray(source.positions,i*3);assert.ok(box.containsPoint(p));assert.ok(p.distanceTo(sphere.center)<=sphere.radius+1e-6);}}});
test(name('OFFSCREEN_CHUNK_CULLABLE'),()=>{multi.universe.renderSpace.setOrigin(createRenderOrigin(multi.local,[0,0,0]));multi.renderer.update();multi.scene.updateMatrixWorld(true);
  const mesh=multi.renderer.root.children[0] as Mesh,camera=new PerspectiveCamera(45,1,.1,10000);camera.position.set(0,400,800);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const view=()=>new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  assert.ok(view().intersectsObject(mesh));camera.lookAt(0,400,1800);camera.updateMatrixWorld(true);assert.equal(view().intersectsObject(mesh),false);});
function maskFixture(){const mask=new PlanetVolumeSurfaceMask('moon'),near=new Mesh(new BoxGeometry(50,50,50),new MeshBasicNodeMaterial()),
  far=new Mesh(new BoxGeometry(50,50,50),new MeshBasicNodeMaterial());mask.attach(near,[multi.point[0],0,0]);mask.attach(far,[multi.point[0],100000,0]);
  return {mask,near,far,dispose(){mask.dispose();for(const m of [near,far]){m.geometry.dispose();(m.material as MeshBasicNodeMaterial).dispose();}}};}
test(name('UNAFFECTED_TILE_ZERO_MASK_BOUNDS'),()=>{const f=maskFixture();try{f.mask.update(multi.runtime.replacement.entries);assert.equal(f.mask.stats.zeroTiles,1);assert.equal(f.mask.stats.maskedTiles,1);}finally{f.dispose();}});
test(name('MASK_LIST_FILTERED_PER_TILE'),()=>{const f=maskFixture();try{f.mask.update(multi.runtime.replacement.entries);assert.equal(f.mask.stats.maxBounds,4);
  assert.equal(f.mask.stats.averageBounds,2);assert.equal(f.mask.publishedCount,8);}finally{f.dispose();}});
test(name('MASK_CAP_BOUNDED'),()=>{const f=maskFixture();try{assert.throws(()=>f.mask.prepareUpdate(Array(129).fill(multi.runtime.replacement.entries[0])));assert.equal(f.mask.publishedCount,0);}finally{f.dispose();}});
test(name('ATOMIC_PUBLICATION_PRESERVED'),()=>{const f=maskFixture();try{const commit=f.mask.prepareUpdate(multi.runtime.replacement.entries);
  assert.equal(f.mask.publishedCount,0);assert.equal(f.mask.stats.maxBounds,0);commit();assert.equal(f.mask.publishedCount,8);}finally{f.dispose();}});
test(name('COLLIDER_VISUAL_MASK_SAME_GENERATION'),()=>{for(const e of multi.runtime.replacement.entries){assert.equal(multi.runtime.collisionCache.peek(e.source.key)?.sourceMesh,e.mesh);
  assert.ok(multi.renderer.root.children.some(m=>m.userData.volumeSource===e.mesh));assert.equal(samplingProfileOf(e.source.key),'impact-high');}});
test('D1.1 prepared mask includes tiles attached after preparation, without changing active masks',()=>{const f=maskFixture();try{
  const commit=f.mask.prepareUpdate(multi.runtime.replacement.entries),late=new Mesh(new BoxGeometry(50,50,50),new MeshBasicNodeMaterial());
  f.mask.attach(late,[multi.point[0],500,0]);assert.equal(f.mask.stats.maxBounds,0);commit();assert.equal(f.mask.stats.maskedTiles,2);
  f.mask.detach(late);late.geometry.dispose();(late.material as MeshBasicNodeMaterial).dispose();}finally{f.dispose();}});
test('D1.1 mixed-resolution adjacent regions are rejected as whole regions',()=>{const f=impactFixture('moon',260);try{f.consume();const e=f.runtime.edits.allEdits()[0] as any;
  f.runtime.edits.subtractSphere({...e,id:'large',impact:{...e.impact,craterRadiusM:433,craterDepthM:202}});
  const plan=selectImpactResidency(f.runtime.edits,'moon',f.point,f.runtime.lod,{...budget,maxChunks:128,maxScalarBytes:4*1048576,standardCapacity:128});
  assert.equal(plan.regions.length,0);assert.equal(plan.blocked,'profile-boundary-conflict');assert.equal(plan.keys.length,0);
}finally{f.dispose();}});
test('D1.1 stale prepared sources cannot publish after a new edit',()=>{const f=impactFixture('moon',260);try{f.consume();for(let i=0;i<2400&&!(f.runtime as any).prepared;i++)f.frame();
  const before=f.runtime.replacement.generation;addImpact(f,30,'invalidating');f.frame(.00001);assert.equal(f.runtime.replacement.generation,before);
  wait(f,2);assert.ok(f.runtime.replacement.generation>before);assert.equal(f.runtime.metrics.publishedRegions,2);}finally{f.dispose();}});
test('D1.1 save/load preserves authoritative impact demand metadata and deterministic multi-region selection',()=>{
  const restored=deserializePlanetVolumeEdits(serializePlanetVolumeEdits(multi.runtime.edits,'moon'));
  assert.deepEqual(restored.allEdits(),multi.runtime.edits.allEdits());
  assert.deepEqual(selectImpactResidency(restored,'moon',multi.point,multi.runtime.lod,budget),
    selectImpactResidency(multi.runtime.edits,'moon',multi.point,multi.runtime.lod,budget));
});
test('D1.1 volume vertex albedo samples the intact surface instead of a fixed grey patch',()=>{
  for(const object of multi.renderer.root.children){const mesh=object as Mesh,source=mesh.userData.volumeSource,
    colours=mesh.geometry.getAttribute('color');assert.ok(colours);
    for(const index of [0,Math.floor(source.vertexCount/2),source.vertexCount-1]){const p:[number,number,number]=[0,1,2].map(a=>source.originBodyFixedM[a]+source.positions[index*3+a]) as [number,number,number];
      const length=Math.hypot(...p);for(let a=0;a<3;a++)p[a]/=length;const expected:[number,number,number]=[0,0,0];multi.surface.colourAt(p,expected);
      for(let a=0;a<3;a++)assert.ok(Math.abs(colours.getComponent(index,a)-expected[a])<1e-7);}
  }
});
test('D1.1 authority commit performs no renderer preparation, spatial-index construction or geometry disposal',()=>{
  const f=impactFixture('moon',260);try{f.consume();for(let i=0;i<2400&&!(f.runtime as any).prepared;i++)f.frame();
    assert.ok((f.runtime as any).prepared);const generation=f.runtime.replacement.generation;
    f.renderer.prepare=()=>{throw new Error('render preparation inside commit');};
    (f.runtime.collisionCache as any).buildIndex=()=>{throw new Error('chunk index construction inside commit');};
    const prepared=(f.renderer as any).staged as Map<unknown,Mesh>;
    for(const mesh of prepared.values())mesh.geometry.dispose=()=>{throw new Error('geometry disposal inside commit');};
    f.runtime.covers(f.context());assert.equal(f.runtime.replacement.generation,generation+1);
    assert.equal(f.runtime.collisionCache.values().length,f.renderer.root.children.length);
    // Restore ordinary disposal before leaving the fixture.
    for(const mesh of f.renderer.root.children as Mesh[])delete (mesh.geometry as any).dispose;
  }finally{f.dispose();}
});
test('D1.1 renderer reset invalidates a staged transaction before physics authority changes',()=>{
  const f=impactFixture('moon',260);try{f.consume();for(let i=0;i<2400&&!(f.runtime as any).prepared;i++)f.frame();
    assert.ok((f.runtime as any).prepared);f.renderer.clear();f.runtime.covers(f.context());
    assert.equal(f.runtime.replacement.entries.length,0);assert.equal(f.runtime.collisionCache.values().length,0);
    wait(f,1);assert.equal(f.runtime.replacement.entries.length,4);assert.ok(f.ray());
  }finally{f.dispose();}
});
