import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three/webgpu';
import {impactFixture} from './helpers/rocky-impact.ts';
import {measureCraterFidelity,craterFidelityAccepted} from './helpers/crater-fidelity.ts';
import {PlanetVolumeField} from '../src/world/planet/volume/PlanetVolumeField.ts';
import {generateVolumeChunk,PlanetVolumeChunkGenerationJob} from '../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import {DEFAULT_VOLUME_LOD,IMPACT_HIGH_VOLUME_LOD,volumeChunkKey,chunkKeyToString,parseChunkKey,chunkBoundsBodyFixedM,
  chunkSamplePosition,samplingProfileOf,physicalChunkKeyToString} from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import {selectImpactSamplingProfile,selectImpactVolumeDemand} from '../src/world/planet/volume/PlanetVolumeImpactDemand.ts';
import {meshVolumeChunk,PlanetVolumeMeshingJob,MAX_VOLUME_MESH_JOB_BYTES,MAX_HIGH_VOLUME_MESH_JOB_BYTES} from '../src/world/planet/volume/PlanetVolumeMesher.ts';
import {PlanetVolumeCollisionBuildJob,buildVolumeCollider} from '../src/world/planet/volume/PlanetVolumeCollisionBuilder.ts';
import {PlanetVolumeChunkCache} from '../src/world/planet/volume/PlanetVolumeChunkCache.ts';
import {PlanetVolumeMeshCache} from '../src/world/planet/volume/PlanetVolumeMeshCache.ts';
import {PlanetVolumeCollisionCache} from '../src/world/planet/volume/PlanetVolumeCollisionCache.ts';
import {chunkByteLength} from '../src/world/planet/volume/PlanetVolumeChunk.ts';
import {createRenderOrigin} from '../src/world/spatial/RenderOrigin.ts';
import {referenceFrame} from '../src/world/spatial/ReferenceFrame.ts';
import {PlanetVolumeCollisionProvider} from '../src/world/planet/volume/PlanetVolumeCollisionProvider.ts';
import {bodyProfile,bodyArrivalPolicy} from '../src/world/celestial/CelestialBodyProfile.ts';
import {PhysicsWorld} from '../src/physics/PhysicsWorld.ts';
import {IMPACT,resolveImpact} from '../src/world/destruction/ImpactFootprintPolicy.ts';
import {MAX_COLLISION_BUILD_BYTES,requiredVolumeCollisionBuildBytes} from '../src/world/planet/volume/PlanetVolumeCollisionBvh.ts';

const name=(s:string)=>`T_D12_${s}`;
test(name('STANDARD_PROFILE_17_SAMPLES'),()=>assert.equal(DEFAULT_VOLUME_LOD.samplesPerAxis,17));
test(name('HIGH_PROFILE_33_SAMPLES'),()=>assert.equal(IMPACT_HIGH_VOLUME_LOD.samplesPerAxis,33));
test(name('STANDARD_SPACING_16M'),()=>assert.equal(256/(DEFAULT_VOLUME_LOD.samplesPerAxis-1),16));
test(name('HIGH_SPACING_8M'),()=>assert.equal(256/(IMPACT_HIGH_VOLUME_LOD.samplesPerAxis-1),8));
const standard=volumeChunkKey('moon',0,-2,3,-4),high=volumeChunkKey('moon',0,-2,3,-4,'impact-high');
test(name('PROFILE_IN_CHUNK_IDENTITY'),()=>{assert.deepEqual(parseChunkKey(chunkKeyToString(high)),high);
  assert.equal(chunkKeyToString(standard),'volume/moon/0/-2/3/-4');assert.equal(parseChunkKey('volume/moon/0/-2/3/-4/standard'),undefined);});
test(name('STANDARD_HIGH_KEYS_DISTINCT'),()=>assert.notEqual(chunkKeyToString(standard),chunkKeyToString(high)));
test(name('CHUNK_BOUNDS_IDENTICAL_ACROSS_PROFILES'),()=>assert.deepEqual(chunkBoundsBodyFixedM(high),chunkBoundsBodyFixedM(standard)));
test(name('NEGATIVE_HIGH_CHUNK_COORDS'),()=>{assert.deepEqual(chunkSamplePosition(high,0,0,0),[-512,768,-1024]);
  assert.deepEqual(chunkSamplePosition(high,32,32,32),[-256,1024,-768]);});
test(name('SHARED_HIGH_FACE_SAMPLES_IDENTICAL'),()=>{
  const f=impactFixture();try{const field=new PlanetVolumeField(f.surface,f.runtime.edits);
    for(const axis of [0,1,2]) {const coords=[Math.floor(f.point[0]/256),-1,-1],next=[...coords];next[axis]++;
      const a=volumeChunkKey('moon',0,...coords as [number,number,number],'impact-high'),b=volumeChunkKey('moon',0,...next as [number,number,number],'impact-high'),
        ca=generateVolumeChunk(field,a),cb=generateVolumeChunk(field,b),others=[0,1,2].filter(i=>i!==axis);
      for(let u=0;u<33;u++)for(let v=0;v<33;v++){const ia=[0,0,0],ib=[0,0,0];ia[axis]=32;
        ia[others[0]]=ib[others[0]]=u;ia[others[1]]=ib[others[1]]=v;
        assert.deepEqual(chunkSamplePosition(a,...ia as [number,number,number]),chunkSamplePosition(b,...ib as [number,number,number]));
        assert.equal(ca.distances[ia[0]+33*(ia[1]+33*ia[2])],cb.distances[ib[0]+33*(ib[1]+33*ib[2])]);}
    }
  }finally{f.dispose();}
});
for(const [label,speed,profile] of [['SMALL_56M',260,'impact-high'],['MEDIUM_114M',800,'impact-high'],['LARGE_433M',8000,'standard'],['LARGE_925M',50000,'standard']] as const)
  test(name(`${label}_SELECTS_${profile==='standard'?'STANDARD':'HIGH'}`),()=>{const f=impactFixture('moon',speed);try{f.consume();
    assert.equal(selectImpactSamplingProfile(f.runtime.edits.allEdits()[0] as any),profile);}finally{f.dispose();}});
test(name('PROFILE_SELECTION_DETERMINISTIC'),()=>{const f=impactFixture('moon',260);try{f.consume();const e=f.runtime.edits.allEdits()[0] as any;
  for(let i=0;i<20;i++)assert.equal(selectImpactSamplingProfile(JSON.parse(JSON.stringify(e))),'impact-high');}finally{f.dispose();}});
for(const kind of ['EVICTION','BODY_SWITCH'])test(name(`PROFILE_SURVIVES_${kind}`),()=>{
  const f=impactFixture('moon',260);try{f.consume();f.ready();const prior=f.runtime.replacement.entries.map(e=>[chunkKeyToString(e.source.key),[...e.source.distances]]);
    if(kind==='EVICTION'){f.observer([f.point[0]+100000,0,0]);f.frame();f.observer([...f.point]);}
    else f.runtime.covers({...f.context(),spatial:{...f.context().spatial,bodyId:'mars'}});
    assert.equal(f.runtime.metrics.publishedReplacements,0);assert.equal(f.runtime.edits.editCount,1);f.ready();
    assert.equal(f.runtime.metrics.samplingProfile,'impact-high');assert.deepEqual(f.runtime.replacement.entries.map(e=>[chunkKeyToString(e.source.key),[...e.source.distances]]),prior);
  }finally{f.dispose();}
});
const f=impactFixture('moon',260);f.consume();f.ready();test.after(()=>f.dispose());
for(const [kind,bytes,cap] of [['SCALAR',()=>f.runtime.metrics.bytes,4],['MESH',()=>f.runtime.metrics.meshBytes,16],['COLLISION',()=>f.runtime.collisionMetrics.bytes,32]] as const)
  test(name(`HIGH_${kind}_CACHE_BOUNDED`),()=>{assert.ok(bytes()<=cap*1048576);assert.equal(f.runtime.metrics.impactCapacity,4);
    assert.equal(f.runtime.replacement.entries.length,4);assert.ok(f.runtime.replacement.entries.every(e=>samplingProfileOf(e.source.key)==='impact-high'));});
test(name('HIGH_WINDOW_NOT_PARTIALLY_PUBLISHED'),()=>{assert.equal(selectImpactVolumeDemand(f.runtime.edits,'moon',f.point,f.runtime.lod,3).length,0);
  const x=impactFixture('moon',260);try{x.consume();(x.runtime.meshCache as any).limits={maxMeshes:128,maxBytes:3*1048576};x.frame();
    assert.equal(x.runtime.metrics.publicationBlocked,'high-res-budget');assert.equal(x.runtime.replacement.entries.length,0);
    assert.equal(x.runtime.metrics.pending,0);assert.ok(Number.isFinite(x.terrain.heightAt(0,0)));}finally{x.dispose();}});

function fallbackFixture() {
  const x=impactFixture('moon',260);x.consume();x.frame(.00001);const field=new PlanetVolumeField(x.surface,x.runtime.edits);
  const keys=selectImpactVolumeDemand(x.runtime.edits,'moon',x.point,x.runtime.lod,4).map(k=>volumeChunkKey(k.bodyId,k.lod,k.x,k.y,k.z));
  const entries=keys.map(key=>{const source=generateVolumeChunk(field,key),mesh=source.classification==='MIXED'?meshVolumeChunk(source):undefined;
    return {source,mesh,collider:mesh?buildVolumeCollider(mesh):undefined};});
  assert.ok(x.renderer.prepare(entries));x.runtime.collisionCache.replaceAll(entries.flatMap(e=>e.collider?[e.collider]:[]));
  x.runtime.replacement.publish(entries);x.renderer.commit(entries);return x;
}
test(name('HIGH_OLD_AUTHORITY_REMAINS_WHILE_BUILDING'),()=>{const x=fallbackFixture();try{const prior=x.runtime.replacement.entries,colliders=x.runtime.collisionCache.values();
  x.frame(.00001);assert.equal(x.runtime.replacement.entries,prior);
  assert.ok(x.runtime.collisionCache.values().every((c,i)=>c===colliders[i]));
  assert.equal(samplingProfileOf(x.ray()!.key),'standard');}finally{x.dispose();}});
test('HIGH insufficient count/byte budget keeps the previously published standard authority',()=>{
  const x=fallbackFixture();try{const prior=x.runtime.replacement.entries;(x.runtime.meshCache as any).limits={maxMeshes:128,maxBytes:3*1048576};
    for(let i=0;i<8;i++)x.frame();assert.equal(x.runtime.metrics.publicationBlocked,'high-res-budget');
    assert.equal(x.runtime.replacement.entries,prior);assert.equal(samplingProfileOf(x.ray()!.key),'standard');assert.equal(x.runtime.metrics.pending,0);
  }finally{x.dispose();}
});
test('HIGH over-budget BVH source blocks preparation without retiring old authority or regenerating forever',()=>{
  const x=fallbackFixture();try{x.frame();const source=x.runtime.cache.peek((x.runtime as any).wanted[0])!;
    const prior=x.runtime.replacement.entries;(x.runtime as any).blockedHighSources.add(source);
    for(let i=0;i<8;i++)assert.equal(x.runtime.covers(x.context()),false);
    assert.equal(x.runtime.metrics.publicationBlocked,'high-res-budget');assert.equal(x.runtime.replacement.entries,prior);
    const mesh=prior.find(e=>e.mesh)!.mesh!;assert.ok(requiredVolumeCollisionBuildBytes(mesh)<MAX_COLLISION_BUILD_BYTES);
    assert.ok(requiredVolumeCollisionBuildBytes({...mesh,triangleCount:1000000})>MAX_COLLISION_BUILD_BYTES);
  }finally{x.dispose();}
});
test(name('HIGH_ATOMIC_SWAP'),()=>{const x=fallbackFixture();try{const generation=x.runtime.replacement.generation;
  for(let i=0;i<1600&&x.runtime.replacement.generation===generation;i++){
    x.frame();const entries=x.runtime.replacement.entries,profiles=new Set(entries.map(e=>samplingProfileOf(e.source.key)));
    assert.equal(profiles.size,1);for(const e of entries)if(e.mesh)assert.equal(x.runtime.collisionCache.peek(e.source.key)?.sourceMesh,e.mesh);
  }
  assert.equal(x.runtime.replacement.generation,generation+1);assert.equal(samplingProfileOf(x.ray()!.key),'impact-high');
  assert.ok(x.renderer.root.children.every(m=>samplingProfileOf(m.userData.volumeSource.key)==='impact-high'));
}finally{x.dispose();}});
test(name('HIGH_NO_DOUBLE_COLLIDER'),()=>{const values=f.runtime.collisionCache.values();assert.equal(new Set(values.map(c=>physicalChunkKeyToString(c.key))).size,values.length);
  assert.equal(f.runtime.collisionCache.replaceAll([...values,{...values[0],key:volumeChunkKey('moon',0,values[0].key.x,values[0].key.y,values[0].key.z)}]),false);});
test(name('HIGH_NO_DOUBLE_MASK'),()=>{const entries=f.runtime.replacement.entries;assert.equal(new Set(entries.map(e=>physicalChunkKeyToString(e.source.key))).size,entries.length);
  assert.throws(()=>f.runtime.replacement.publish([...entries,entries[0]]));assert.equal(f.terrain.heightAt(0,0),-Infinity);});

const fidelity=['moon','mars','earth'].flatMap(body=>[260,800].flatMap(speed=>[0,2,4,6].map(phase=>measureCraterFidelity(body,speed,phase))));
for(const body of ['moon','mars','earth'])for(const speed of [260,800])test(name(`HIGH_${body.toUpperCase()}_${speed}_FIDELITY`),()=>{
  const rows=fidelity.filter(r=>r.body===body&&r.speedMps===speed);assert.equal(rows.length,4);
  for(const row of rows){assert.equal(row.samplingProfile,'impact-high');assert.equal(row.spacingM,8);assert.ok(craterFidelityAccepted(row),JSON.stringify(row));}
});
for(const phase of [0,2,4,6])test(name(`HIGH_GRID_PHASE_${phase}`),()=>{const rows=fidelity.filter(r=>r.phaseM===phase);assert.equal(rows.length,6);
  for(const row of rows){assert.ok(row.phaseBodyFixedM.every(v=>Math.abs(v-phase)<.001));assert.ok(craterFidelityAccepted(row));}});
test(name('HIGH_VISUAL_COLLIDER_AGREE'),()=>assert.ok(fidelity.every(r=>r.maxVisualColliderDisagreementM<.0001)));
test(name('HIGH_FLOOR_COLLISION'),()=>{f.bind();f.player.teleport(new Vector3(0,2,0));f.player.state='Falling';f.player.velocity.set(0,0,0);
  for(let i=0;i<1200;i++)f.step();assert.equal(f.player.state,'Grounded');assert.ok(Math.abs(f.player.position.y-f.ray()!.point[1])<.01);});
test(name('HIGH_WALL_COLLISION'),()=>{const contact=f.volume.sweepCapsule([0,-10,0],[200,0,0],.32,2.1);assert.ok(contact);assert.ok(contact.fraction<.5);assert.ok(contact.normal[0]<-.3);});
test(name('HIGH_RAYCAST'),()=>{for(const x of [0,20,40,60,80]){assert.ok(f.ray(x));assert.equal(samplingProfileOf(f.ray(x)!.key),'impact-high');}});
test(name('HIGH_NO_TUNNEL'),()=>{for(const fps of [30,60,120]){const hit=f.volume.sweepCapsule([0,-10,0],[10000/fps,0,0],.32,2.1);assert.ok(hit&&hit.fraction<1);}});
test(name('HIGH_REBASE_INVARIANT'),()=>{const before=f.ray()!.point;f.universe.renderSpace.setOrigin(createRenderOrigin(f.local,[100,50,-80]));f.renderer.update();assert.deepEqual(f.ray()!.point,before);});
test(name('LARGE_IMPACT_STANDARD_REGRESSION'),()=>{for(const speed of [8000,50000]){const x=impactFixture('moon',speed);try{x.consume();x.ready();
  assert.equal(x.runtime.metrics.samplingProfile,'standard');assert.equal(x.runtime.metrics.spacingM,16);assert.ok(Math.abs(x.ray()!.point[1]+x.service.last!.plan!.craterDepthM)<2);
  assert.ok(x.runtime.metrics.publishedReplacements<=128);}finally{x.dispose();}}});
test(name('SUN_UNCHANGED'),()=>{const sun=f.universe.activeSystem.bodies.find(b=>b.id==='sun')!,profile=bodyProfile(sun);
  assert.equal(sun.equatorialRadiusM,695700000);assert.equal(bodyArrivalPolicy(sun).exclusionMarginM,100000);
  assert.equal(bodyArrivalPolicy(sun).observationMarginM,20871000);assert.equal(profile.supportsVolumeDestruction,false);});
test(name('MANAUS_UNCHANGED'),()=>{assert.equal(IMPACT.maxRadius,1200);assert.equal(IMPACT.maxDepth,600);
  assert.ok(resolveImpact(8000,1,false,1).craterRadiusM>433);assert.ok(PhysicsWorld);});
test('HIGH generation, meshing and BVH remain resumable with independent bounded jobs',()=>{
  const source=f.runtime.replacement.entries.find(e=>e.mesh)!.source,field=new PlanetVolumeField(f.surface,f.runtime.edits),gen=new PlanetVolumeChunkGenerationJob(field,source.key);
  assert.equal(gen.advance(1),false);assert.equal(gen.pendingBytes,(33**3+6*33**2)*12);
  const mesh=new PlanetVolumeMeshingJob(source);assert.equal(mesh.advance(1),false);assert.ok(mesh.pendingBytes<MAX_HIGH_VOLUME_MESH_JOB_BYTES);
  assert.equal(MAX_VOLUME_MESH_JOB_BYTES,2*1048576);assert.equal(chunkByteLength(source),169884);
  const bvh=new PlanetVolumeCollisionBuildJob(f.runtime.replacement.entries.find(e=>e.mesh)!.mesh!,source);assert.equal(bvh.advance(1),false);
});
test('HIGH scalar/mesh caches distinguish same physical standard and high sources',()=>{
  const src=f.runtime.replacement.entries.find(e=>e.mesh)!,stdKey=volumeChunkKey(src.source.key.bodyId,0,src.source.key.x,src.source.key.y,src.source.key.z),
    std=generateVolumeChunk(new PlanetVolumeField(f.surface,f.runtime.edits),stdKey),stdMesh=meshVolumeChunk(std),cache=new PlanetVolumeChunkCache(),meshes=new PlanetVolumeMeshCache();
  assert.ok(cache.insert(std)&&cache.insert(src.source));assert.equal(cache.stats().resident,2);assert.notEqual(std.generationSignature,src.source.generationSignature);
  assert.ok(meshes.insert(std,stdMesh)&&meshes.insert(src.source,src.mesh!));assert.equal(meshes.stats().resident,2);
  assert.equal(meshes.insert(std,src.mesh!),false);assert.throws(()=>new PlanetVolumeCollisionBuildJob(src.mesh!,std));cache.dispose();meshes.clearAll();
  assert.throws(()=>generateVolumeChunk(new PlanetVolumeField(f.surface),stdKey,IMPACT_HIGH_VOLUME_LOD),/impact-high identity/);
});
test('HIGH seam normals match and all ordinary MC normals remain finite unit vectors',()=>{
  const byPoint=new Map<string,number[]>();let shared=0;
  for(const {mesh} of f.runtime.replacement.entries)if(mesh)for(let i=0;i<mesh.vertexCount;i++){
    const p=[0,1,2].map(a=>mesh.originBodyFixedM[a]+mesh.positions[i*3+a]).map(v=>v.toFixed(5)).join(','),n=[0,1,2].map(a=>mesh.normals[i*3+a]);
    assert.ok(n.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...n)-1)<1e-6);
    const old=byPoint.get(p);if(old){shared++;for(let a=0;a<3;a++)assert.ok(Math.abs(old[a]-n[a])<1e-5);}else byPoint.set(p,n);
  }
  assert.ok(shared>10);
});
test('HIGH extracted cavity includes physical ceiling as well as floor and wall',()=>{
  const field=new PlanetVolumeField(f.surface),key=f.runtime.replacement.entries[0].source.key,b=chunkBoundsBodyFixedM(key),centre=b.minBodyFixedM.map(v=>v+128) as [number,number,number];
  centre[0]-=512;const cavityKey=volumeChunkKey('moon',0,Math.floor(centre[0]/256),key.y,key.z,'impact-high');
  field.edits.subtractSphere({bodyId:'moon',centerBodyFixedM:centre,radiusM:48});const chunk=generateVolumeChunk(field,cavityKey),mesh=meshVolumeChunk(chunk),collider=buildVolumeCollider(mesh),
    cache=new PlanetVolumeCollisionCache();assert.ok(cache.insert(collider));
  f.universe.frames.register(referenceFrame({id:'high-cavity',parentId:'moon/fixed',kind:'surface-enu',originInParent:centre}));
  const provider=new PlanetVolumeCollisionProvider(cache,f.universe.frames,'moon','moon/fixed','high-cavity');
  for(const direction of [[0,1,0],[0,-1,0],[1,0,0]] as [number,number,number][]){assert.ok(provider.raycast([0,0,0],direction,100));
    assert.ok(provider.sweepCapsule([0,0,0],direction.map(v=>v*200) as [number,number,number],.32,2.1));}
  cache.clearAll();
});
