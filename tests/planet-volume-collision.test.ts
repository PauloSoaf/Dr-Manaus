import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three/webgpu';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { volumeContactKind } from '../src/physics/VolumeCollisionProvider.ts';
import { segmentTriangleDistance,sweepCapsuleTriangle,rayTriangle } from '../src/world/planet/volume/PlanetVolumeCollisionGeometry.ts';
import { buildVolumeCollider,PlanetVolumeCollisionBuildJob } from '../src/world/planet/volume/PlanetVolumeCollisionBuilder.ts';
import { PlanetVolumeCollisionCache } from '../src/world/planet/volume/PlanetVolumeCollisionCache.ts';
import { volumeChunkKey } from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { cavity,planeMesh,planeProvider } from './helpers/volume-collision.ts';
import { impactFixture } from './helpers/celestial-impact.ts';
const A:[number,number,number]=[0,0,0],B:[number,number,number]=[10,0,0],C:[number,number,number]=[0,0,10];
const grounded=(f:ReturnType<typeof cavity>)=>{for(let i=0;i<120;i++)f.step();assert.equal(f.player.state,'Grounded');};

for(const property of ['FROM_MESH','BODY_ID','SOURCE_REVISION','BOUNDS','MEMORY_ACCOUNTING','BVH_FINITE','BVH_DETERMINISTIC']) {
  test(`T_VOLUME_COLLIDER_${property}`,()=>{const f=cavity();try {
    const c=f.collider;assert.equal(c.sourceMesh,f.mesh);assert.equal(c.bodyId,'earth');assert.equal(c.sourceRevision,f.chunk.sourceRevision);
    assert.equal(c.positions,f.mesh.positions);assert.deepEqual(c.boundsBodyFixedM,f.chunk.boundsBodyFixedM);
    assert.equal(c.memory.bytes,c.memory.sharedBytes+c.memory.nodeBytes+c.memory.referenceBytes+c.memory.metadataBytes);
    assert.ok([...c.bvh.bounds].every(Number.isFinite));assert.ok(c.bvh.nodeCount>0);
    const other=buildVolumeCollider(f.mesh);assert.deepEqual(other.bvh,c.bvh);
  }finally{f.dispose();}});
}
test('T_VOLUME_COLLIDER_BVH_REDUCES_TRIANGLE_CANDIDATES',()=>{const f=cavity('earth',6);try {
  const hit=f.provider.raycast([0,0,0],[1,0,0],20);assert.ok(hit);
  assert.ok(f.provider.metrics.candidateTriangles<f.mesh.triangleCount/2);
}finally{f.dispose();}});
for(const [name,p] of [['FACE',[1,2,1]],['EDGE',[5,2,5]],['MISS',[11,2,11]]] as const) {
  test(`T_VOLUME_RAYCAST_${name}`,()=>{const hit=rayTriangle([...p],[0,-1,0],A,B,C,10);
    if(name==='MISS')assert.equal(hit,null);else assert.equal(hit,2);});
}
for(const [name,p,distance] of [['FACE',[2,2,2],2],['EDGE',[5,2,5],2],['VERTEX',[0,2,0],2]] as const) {
  test(`T_VOLUME_CAPSULE_${name}_CONTACT`,()=>{
    const d=segmentTriangleDistance([...p],[p[0],p[1]+1,p[2]],A,B,C);assert.ok(Math.abs(d.distance-distance)<1e-9);
    const hit=sweepCapsuleTriangle([...p],[p[0],p[1]+1,p[2]],[0,-5,0],.32,A,B,C,[0,1,0]);assert.ok(hit);
    assert.ok(Math.abs(hit.fraction-(2-.32)/5)<1e-4);assert.ok(hit.normal[1]>.99);
  });
}
test('T_VOLUME_CAPSULE_NO_FALSE_CONTACT',()=>{
  assert.equal(sweepCapsuleTriangle([20,2,20],[20,3,20],[0,-5,0],.32,A,B,C,[0,1,0]),null);
  assert.equal(sweepCapsuleTriangle([2,.32,2],[2,1.32,2],[2,0,0],.32,A,B,C,[0,1,0]),null);
});
test('T_VOLUME_CAPSULE_HIGH_SPEED_NO_TUNNEL',()=>{const f=planeProvider('wall');try {
  const hit=f.provider.sweepCapsule([5,0,0],[-1000,0,0],.32,2.1);assert.ok(hit);assert.ok(hit.fraction<.01);
}finally{f.dispose();}});
test('T_VOLUME_CONTACT_NORMAL_TOWARD_EMPTY',()=>{const f=cavity();try {
  const h=f.provider.raycast([0,0,0],[1,0,0],10)!;assert.ok(h);assert.ok(h.normal[0]<0);
}finally{f.dispose();}});
for(const [name,tangent] of [['NO_BOUNCE',0],['PRESERVES_TANGENT',5]] as const) {
  test(`T_VOLUME_CONTACT_${name}`,()=>{const f=planeProvider('wall');try {
    PhysicsWorld.setVolumeCollision(f.provider);PhysicsWorld.setTerrain(null);
    const p=new Vector3(5,0,0),v=new Vector3(-1000,0,tangent);new PhysicsWorld().move(p,v,.1,.32,2.1,[]);
    assert.ok(p.x>=.32);assert.ok(Math.abs(v.x)<1e-8);assert.ok(Math.abs(v.z-tangent)<1e-8);
  }finally{PhysicsWorld.setVolumeCollision(null);f.dispose();}});
}
for(const [kind,normal] of [['floor',[0,1,0]],['wall',[1,0,0]],['ceiling',[0,-1,0]]] as const) {
  test(`T_VOLUME_${kind.toUpperCase()}_CLASSIFICATION`,()=>assert.equal(volumeContactKind([...normal]),kind));
  test(`T_VOLUME_${kind.toUpperCase()}_${kind==='floor'?'GROUNDED':'NOT_GROUNDED'}`,()=>{
    const f=planeProvider(kind);try {
      PhysicsWorld.setVolumeCollision(f.provider);PhysicsWorld.setTerrain(null);const physics=new PhysicsWorld();
      const p=new Vector3(kind==='wall'?5:0,kind==='floor'?5:kind==='ceiling'?-5:0,0),
        v=new Vector3(kind==='wall'?-100:0,kind==='floor'?-100:kind==='ceiling'?100:0,0);
      const ground=physics.move(p,v,.1,.32,2.1,[]);assert.equal(ground,kind==='floor');assert.equal(physics.lastVolumeContact?.kind,kind);
    }finally{PhysicsWorld.setVolumeCollision(null);f.dispose();}
  });
}
test('T_VOLUME_CAVITY_WALKABLE',()=>{const f=cavity();try {
  grounded(f);const before=f.player.position.clone();f.held.add('KeyW');for(let i=0;i<5;i++)f.step();f.held.clear();
  assert.ok(f.player.position.distanceTo(before)>.05);assert.equal(f.player.state,'Grounded');
}finally{f.dispose();}});
test('T_VOLUME_CAVITY_WALL_BLOCKS',()=>{const f=cavity();try {
  grounded(f);f.held.add('KeyW');for(let i=0;i<120;i++)f.step();assert.ok(Math.abs(f.player.position.z)<1.9);
}finally{f.dispose();}});
test('T_VOLUME_CAVITY_CEILING_BLOCKS',()=>{const f=cavity();try {
  const p=new Vector3(0,-.5,0),v=new Vector3(0,1000,0),physics=new PhysicsWorld();
  assert.equal(physics.move(p,v,.1,.32,2.1,[]),false);assert.ok(p.y+2.1<1.91);assert.ok(v.y<=.001);
  assert.equal(physics.lastVolumeContact?.kind,'ceiling');
}finally{f.dispose();}});
test('T_VOLUME_CAVITY_JUMP_AND_FALL',()=>{const f=cavity();try {
  grounded(f);const start=f.player.position.y;f.edges.add('Space');let ceiling=false,raised=false;
  for(let i=0;i<180;i++){f.step();ceiling ||= f.player.lastVolumeContact?.kind==='ceiling';raised ||= f.player.position.y>start+.1;}
  assert.ok(raised);assert.ok(ceiling);assert.equal(f.player.state,'Grounded');
}finally{f.dispose();}});
for(const fps of [30,60,120])test(`T_VOLUME_COLLISION_${fps}FPS`,()=>{const f=cavity();try {
  const p=new Vector3(0,-1,0),v=new Vector3(3000,0,0),physics=new PhysicsWorld();physics.move(p,v,1/fps,.32,2.1,[]);
  assert.ok(p.x<1.9);assert.ok(p.toArray().every(Number.isFinite));
  for(let i=0;i<fps*3;i++)f.step(1/fps);assert.equal(f.player.state,'Grounded');
}finally{f.dispose();}});
test('T_VOLUME_COLLISION_REBASE_INVARIANT',()=>{const f=cavity('moon');try {
  const before=f.provider.raycast([0,0,0],[1,0,0],10),identity=f.collider.bvh;
  f.universe.renderSpace.setOrigin({...f.universe.renderSpace.currentOrigin,position:[1e9,-2e9,3e9]});
  assert.deepEqual(f.provider.raycast([0,0,0],[1,0,0],10),before);assert.equal(f.collider.bvh,identity);
}finally{f.dispose();}});
for(const id of ['earth','moon','mars'])test(`T_VOLUME_COLLISION_${id.toUpperCase()}_FRAME`,()=>{const f=cavity(id);try {
  grounded(f);const hit=f.provider.raycast([0,0,0],[0,-1,0],10)!;assert.equal(hit.bodyId,id);assert.equal(hit.kind,'floor');assert.ok(hit.normal[1]>.65);
}finally{f.dispose();}});
test('T_VOLUME_COLLISION_BODY_FIXED_TO_LOCAL_ENU',()=>{const f=cavity();try {
  const hit=f.provider.raycast([0,0,0],[0,-1,0],10)!;const fixed=f.universe.frames.convertDirection(f.local,f.provider.fixedFrameId,hit.normal);
  assert.ok(fixed[0]>.65);assert.ok(hit.normal[1]>.65);
}finally{f.dispose();}});
for(const name of ['MAX_COUNT','MAX_BYTES','LRU'])test(`T_VOLUME_COLLISION_CACHE_${name}`,()=>{
  const c=buildVolumeCollider(planeMesh()),next={...c,key:volumeChunkKey('earth',0,1,0,0)},third={...c,key:volumeChunkKey('earth',0,2,0,0)};
  const cache=new PlanetVolumeCollisionCache({maxColliders:2,maxBytes:c.memory.bytes*2});
  assert.ok(cache.insert(c));assert.ok(cache.insert(next));cache.get(c.key);assert.ok(cache.insert(third));
  assert.equal(cache.peek(next.key),undefined);assert.ok(cache.peek(c.key));assert.equal(cache.stats().resident,2);
  assert.ok(cache.stats().bytes<=cache.limits.maxBytes);assert.equal(cache.insert({...next,memory:{...next.memory,bytes:cache.limits.maxBytes+1}}),false);
});
test('T_VOLUME_COLLISION_ONLY_ONE_LOD_AUTHORITY',()=>{const f=planeProvider();try {
  const c=f.cache.values()[0];f.cache.insert({...c,key:{...c.key,lod:1},sourceRevision:99});
  f.provider.raycast([0,5,0],[0,-1,0],10);assert.equal(f.provider.metrics.candidateChunks,1);
}finally{f.dispose();}});
test('T_VOLUME_COLLISION_NO_THREE_OBJECT_DEPENDENCY',()=>{
  for(const file of ['PlanetVolumeCollider','PlanetVolumeCollisionBvh','PlanetVolumeCollisionBuilder','PlanetVolumeCollisionCache','PlanetVolumeCollisionProvider','PlanetVolumeCollisionGeometry']) {
    const text=readFileSync(`src/world/planet/volume/${file}.ts`,'utf8');assert.doesNotMatch(text,/from\s+['"]three|new\s+(?:Mesh|Vector3|Raycaster|BufferGeometry)\(/);
  }
});
test('T_VOLUME_COLLISION_DOES_NOT_CREATE_VOLUME_EDIT',()=>{const f=cavity();try {
  const revision=f.field.edits.revision('earth'),count=f.field.edits.editCount;grounded(f);f.provider.raycast([0,0,0],[1,0,0],10);
  assert.equal(f.field.edits.revision('earth'),revision);assert.equal(f.field.edits.editCount,count);
}finally{f.dispose();}});
test('T_VOLUME_COLLISION_C4_EVENTS_UNCHANGED',()=>{
  const baseline=impactFixture();let expected;
  try{baseline.step();expected=baseline.event();}finally{baseline.dispose();}
  const volume=cavity(),flight=impactFixture();try{
    const revision=volume.field.edits.revision('earth');flight.step();assert.deepEqual(flight.event(),expected);
    assert.equal(flight.event().classification,'CATASTROPHIC_IMPACT');assert.equal(volume.field.edits.revision('earth'),revision);
    assert.equal(flight.universe.volume.metrics.resident,0);
  }finally{flight.dispose();volume.dispose();}
});
test('collider build batches are resumable and validate the memory budget',()=>{
  const job=new PlanetVolumeCollisionBuildJob(planeMesh());assert.equal(job.advance(1),false);assert.ok(job.pendingBytes>0);
  while(!job.advance(1)){}assert.ok(job.collider);
  assert.throws(()=>new PlanetVolumeCollisionBuildJob({...planeMesh(),triangleCount:10000000}),RangeError);
});
