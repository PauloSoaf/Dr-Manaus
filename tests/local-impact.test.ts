import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Group, InstancedMesh, Matrix4, Raycaster, Vector3 } from 'three/webgpu';
import { resolveImpact, resolveContactImpact, IMPACT } from '../src/player/combat/MeteorImpact.ts';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import { PowerSystem } from '../src/player/powers/PowerSystem.ts';
import { EffectPool } from '../src/player/powers/EffectPool.ts';
import { DebrisPool } from '../src/world/destruction/DebrisPool.ts';
import { DestructionSystem } from '../src/world/destruction/DestructionSystem.ts';
import { TerrainDestruction, TERRAIN_DAMAGE } from '../src/world/destruction/TerrainDestruction.ts';
import { localImpactFixture } from './helpers/local-impact-fixture.ts';
const input={enabled:true,held:()=>false,consume:()=>false,pressed:()=>false,mouseDelta:{x:0,y:0}} as any;
const zero=new Vector3();
let fixture:ReturnType<typeof localImpactFixture>,initial:any,oldDocument:Document;
before(()=>{
  oldDocument=globalThis.document;
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',fillRect(){}})})} as any;
  fixture=localImpactFixture();
  initial={boxes:fixture.query(zero,2000),parts:fixture.matrices('largo:'),npcOutside:fixture.population.npcs[4].position.clone()};
  assert.ok(initial.parts.length>100);assert.ok(initial.parts.every((p:any)=>p.determinant>0));
  fixture.impact();fixture.drain();
});
after(()=>{fixture.dispose();globalThis.document=oldDocument;});
function range(value:number,lo:number,hi:number){assert.ok(value>=lo&&value<=hi,`${value} must be in [${lo}, ${hi}]`);}
const speeds=[70,100,260,800,8000,50000,1e6,1e9];
test('T_IMPACT_RADIUS_MONOTONIC',()=>{let last=-1;for(const v of speeds){const r=resolveImpact(v).craterRadiusM;assert.ok(r>=last);last=r;}});
test('T_IMPACT_DEPTH_MONOTONIC',()=>{let last=-1;for(const v of speeds){const d=resolveImpact(v).craterDepthM;assert.ok(d>=last);last=d;}});
for(const [v,r0,r1,d0,d1] of [[260,40,60,18,30],[800,90,140,40,70],[8000,350,500,160,250],[50000,800,1100,350,500]])test(`T_IMPACT_${v}MPS_RADIUS`,()=>{const f=resolveImpact(v);range(f.craterRadiusM,r0,r1);range(f.craterDepthM,d0,d1);});
test('T_IMPACT_RADIUS_LOCAL_CAP',()=>{for(const size of [1,100,1000])range(resolveImpact(1e9,size).craterRadiusM,0,1200);});
test('T_IMPACT_DEPTH_LOCAL_CAP',()=>{for(const size of [1,100,1000])range(resolveImpact(1e9,size).craterDepthM,0,600);});
const oblique=()=>resolveContactImpact(new Vector3(8000,-20,0),new Vector3(0,1,0));
test('T_IMPACT_OBLIQUE_NOT_ZERO',()=>{const f=oblique();assert.equal(f.impactSpeed,4820);assert.ok(f.craterRadiusM>250&&f.craterDepthM>100);});
test('T_IMPACT_DIRECT_STRONGER_THAN_GRAZE',()=>{const direct=resolveImpact(8000),graze=oblique();assert.ok(direct.craterRadiusM>graze.craterRadiusM);assert.ok(direct.energy>graze.energy);});
test('T_IMPACT_NORMAL_BASED_NOT_WORLD_Y',()=>{assert.equal(resolveContactImpact(new Vector3(-8000,0,0),new Vector3(1,0,0)).craterRadiusM,resolveImpact(8000).craterRadiusM);});
function sweptLanding(fps:number){
  PhysicsWorld.setTerrain({heightAt:()=>0,heightfieldOnly:true});
  const physics=new PhysicsWorld(),position=new Vector3(0,1,0),velocity=new Vector3(8000,-20,0),beforeVelocity=velocity.clone();
  for(let i=0;i<20&&!physics.lastTerrainContact;i++)physics.move(position,velocity,1/fps,.32,2,[]);
  const contact=physics.lastTerrainContact;assert.ok(contact);
  const player=new PlayerController(new Group(),input);
  (player as any).physics=physics;(player as any).impactVelocity.copy(beforeVelocity);player.position.set(9999,0,0);(player as any).registerImpact();
  const landing=player.consumeImpact()!;player.character.dispose();PhysicsWorld.setTerrain(null);return {landing,contact,velocity};
}
test('T_IMPACT_POINT_IS_SWEPT_CONTACT',()=>{const {landing,contact,velocity}=sweptLanding(30);assert.deepEqual(landing.position,contact.position);assert.ok(landing.position.x<533);assert.equal(velocity.y,0);assert.equal(landing.impact.normalImpactSpeed,20);});
test('T_IMPACT_SEPARATE_CRATER_AND_BLAST_RADIUS',()=>{assert.notEqual(oblique().craterRadiusM,oblique().blastDamageRadiusM);});
test('T_IMPACT_BLAST_GREATER_THAN_CRATER',()=>{for(const v of speeds)assert.ok(resolveImpact(v).blastDamageRadiusM>resolveImpact(v).craterRadiusM);});
test('T_IMPACT_IMPULSE_GREATER_THAN_BLAST',()=>{for(const v of speeds)assert.ok(resolveImpact(v).impulseRadiusM>resolveImpact(v).blastDamageRadiusM);});
test('T_IMPACT_REPEAT_DEEPENS_CRATER',()=>{
  const terrain=new TerrainDestruction(new Group());terrain.setBodyId('repeat-impact-fixture');terrain.restoreAt(zero,1e9);
  try{const f=resolveImpact(8000);terrain.damageAt(zero,f.craterRadiusM,f.damage,f.craterDepthM);const first={...terrain.craters[0]};terrain.damageAt(zero,f.craterRadiusM,f.damage,f.craterDepthM);assert.ok(terrain.craters[0].depth>first.depth);assert.ok(terrain.craters[0].radius>first.radius);assert.ok(terrain.craters[0].radius<first.radius*2);for(let i=0;i<30;i++)terrain.damageAt(zero,f.craterRadiusM,f.damage,f.craterDepthM);range(terrain.craters[0].radius,0,1200);range(terrain.craters[0].depth,0,600);}finally{terrain.restoreAt(zero,1e9);terrain.dispose();}
});
test('T_IMPACT_BUILDING_CORE_DESTROYED',()=>{assert.ok(fixture.streamer.isDestroyed('0,0/building/0'));assert.ok(fixture.streamer.isDestroyed('0,0/building/1'),'tall wide building intersects the core');});
test('T_IMPACT_TREE_CORE_DESTROYED',()=>{assert.ok(fixture.streamer.isDestroyed('0,0/tree/0'));assert.ok(fixture.destruction.lastImpact!.trees>1);});
test('T_IMPACT_TREE_CANOPY_REMOVED',()=>{const group=fixture.root.getObjectByName('chunk:0,0')!,matrix=new Matrix4();(group.getObjectByName('tropical-canopy') as InstancedMesh).getMatrixAt(0,matrix);assert.equal(matrix.determinant(),0);assert.ok(fixture.matrices('largo:tree/').every(p=>p.determinant===0));});
test('T_IMPACT_POPULATION_PROP_DESTROYED',()=>{assert.equal(fixture.population.targets[0].active,false);assert.ok(fixture.population.destroyed.has(fixture.population.targets[0].id));assert.ok(!fixture.population.colliders.some(c=>c.id===fixture.population.targets[0].id));});
test('T_IMPACT_NPC_CORE_AFFECTED',()=>{assert.equal(fixture.population.npcs[0].state,'disabled');assert.equal(fixture.population.npcs[0].active,false);assert.equal(fixture.population.npcs[1].state,'knocked');assert.ok(fixture.population.npcs[1].velocity.length()>0);
  const matrix=new Matrix4();(fixture.root.getObjectByName('population-npcs') as InstancedMesh).getMatrixAt(0,matrix);assert.equal(matrix.determinant(),0);(fixture.root.getObjectByName('population-heads') as InstancedMesh).getMatrixAt(0,matrix);assert.equal(matrix.determinant(),0);
});
test('T_IMPACT_NPC_OUTER_REACTS',()=>{assert.equal(fixture.population.npcs[2].state,'fleeing');assert.equal(fixture.population.npcs[3].state,'fleeing');assert.equal(fixture.population.npcs[4].state,'walking');assert.deepEqual(fixture.population.npcs[4].position,initial.npcOutside);});
test('T_IMPACT_CAR_CORE_DESTROYED',()=>{assert.equal((fixture.traffic as any).pool[0].wreck,true);assert.ok(!fixture.traffic.colliders.some(c=>c.id==='traffic:0'));assert.ok(fixture.destruction.lastImpact!.vehicles>0,'wrecks created before queue drain remain in event telemetry');});
test('T_IMPACT_CAR_OUTER_IMPULSE',()=>{
  const f=resolveImpact(800),car=(fixture.traffic as any).pool[1];car.shown=true;car.wreck=false;car.x=f.blastDamageRadiusM+15;car.z=0;car.y=1;
  const before=car.x;assert.ok(before<f.impulseRadiusM);fixture.traffic.impulse(zero,f.impulseRadiusM,f.impulse);assert.ok(car.vx>0);assert.equal(car.x,before,'impulse changes velocity, not position');fixture.traffic.update(1/60,zero);assert.ok(car.x>before);
});
for(const [name,family,mesh] of [
  ['LAMP_POST_DESTROYED','largo:lamp:','largo-lamp-posts'],['LAMP_HEAD_DESTROYED_WITH_POST','largo:lamp:','largo-lamp-heads'],
  ['BENCH_ALL_PARTS_DESTROYED','largo:bench:',null],['TABLE_ALL_PARTS_DESTROYED','largo:table:',null],['BIN_DESTROYED','largo:bin:',null],
] as const)test(`T_IMPACT_${name}`,()=>{const parts=fixture.matrices(family).filter(p=>!mesh||p.name===mesh);assert.ok(parts.length>0);assert.ok(parts.every(p=>p.determinant===0));});
test('T_IMPACT_OUTSIDE_BLAST_SURVIVES',()=>{assert.equal(fixture.streamer.isDestroyed('0,0/building/2'),false);assert.ok(fixture.query(zero,2000).some(c=>c.id==='0,0/building/2'));});
test('T_IMPACT_PENDING_DESTRUCTION_COMPLETES',()=>{
  const boxes=Array.from({length:1000},(_,i)=>({id:`building:${i}`,x:i%30,y:500,z:Math.floor(i/30),width:5,height:1000,depth:5,category:'building' as const})),removed=new Set<string>();
  const system=new DestructionSystem(new Group(),{colliders:()=>boxes,destroy:id=>{if(removed.has(id))return false;removed.add(id);return true;}});
  try{system.impactAt(zero,resolveImpact(8000));assert.equal(removed.size,16);assert.equal(system.pendingCount,984);system.impactAt(zero,resolveImpact(8000));assert.equal(removed.size,16,'all waves share the frame budget');for(let i=0;i<65;i++)system.update(1/60,zero,zero,true);assert.equal(removed.size,1000);assert.equal(system.pendingCount,0);}finally{system.dispose();}
});
test('T_IMPACT_LARGE_CRATER_VISUAL_PHYSICS_MATCH',()=>{
  const terrain=fixture.terrain;fixture.root.updateMatrixWorld(true);PhysicsWorld.setTerrain(terrain);
  try{for(const ratio of [0,.25,.5,.75]){const x=fixture.footprint.craterRadiusM*ratio,height=terrain.heightAt(x,0);
    const ray=new Raycaster(new Vector3(x,100,0),new Vector3(0,-1,0),0,1000),hit=ray.intersectObject(terrain.bowl)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-height)<.01);
    const physics=PhysicsWorld.raycast(new Vector3(x,100,0),new Vector3(0,-1,0),[],1000,0,true);assert.ok(physics);assert.ok(Math.abs(physics.point.y-height)<.01);
  }}finally{PhysicsWorld.setTerrain(null);}
});
test('T_IMPACT_LARGE_CRATER_NO_BLACK_VOID',()=>{
  const terrain=fixture.terrain;assert.ok(terrain.bowl.visible);assert.ok(terrain.stats.triangles>1000);assert.ok(terrain.bowl.geometry.boundingBox!.min.y<-160);
  const colors=terrain.bowl.geometry.getAttribute('color'),index=terrain.bowl.geometry.index!;
  for(let i=0;i<terrain.bowl.geometry.drawRange.count;i++){const vertex=index.getX(i);assert.ok(colors.getX(vertex)>0&&colors.getY(vertex)>0&&colors.getZ(vertex)>0);}
  assert.ok(terrain.stats.span>=1024);assert.equal(terrain.bowl.geometry.getAttribute('position').count,257*257);
});
test('T_IMPACT_ROAD_CLIPPED_ONLY_IN_CRATER',()=>{
  const mesh=fixture.roads.group.getObjectByName('real-roads-arterial') as any;assert.ok(mesh);assert.ok(mesh.material.maskNode);assert.equal(fixture.terrain.heightAt(900,0),0);
  assert.ok(fixture.terrain.heightAt(0,0)<-160);const position=mesh.geometry.getAttribute('position');assert.ok(Array.from(position.array as Float32Array).some((v,i)=>i%3===0&&Math.abs(v)>900),'road outside the crater is retained');
});
for(const fps of [30,60,120])test(`T_IMPACT_${fps}FPS`,()=>{const {landing}=sweptLanding(fps);assert.ok(Math.abs(landing.position.x-400)<.1);assert.equal(landing.impact.impactSpeed,4820);assert.equal(landing.impact.craterRadiusM,oblique().craterRadiusM);});
test('walking, own jump, double jump and kerb do not excavate or blast',()=>{for(const v of [0,9.5,17.4,25,40]){const f=resolveContactImpact(new Vector3(0,-v,0),new Vector3(0,1,0));assert.equal(f.craterRadiusM,0);assert.equal(f.blastDamageRadiusM,0);}assert.equal(resolveContactImpact(new Vector3(650,-1,0),new Vector3(0,1,0),1,false,false).craterRadiusM,0);});
test('almost tangential contact has bounded shallow excavation',()=>{const f=resolveContactImpact(new Vector3(8000,-.1,0),new Vector3(0,1,0));assert.ok(f.craterDepthM<20);assert.ok(f.blastDamageRadiusM>400);assert.equal(resolveContactImpact(new Vector3(8000,0,0),new Vector3(0,1,0)).craterRadiusM,0);});
test('large impact queries residents without generating an unloaded tree chunk',()=>{const internals=fixture.streamer as any;const before=internals.records.size;const out:any[]=[];fixture.streamer.appendBlastColliders(out,new Vector3(10000,0,10000),1000);assert.equal(out.length,0);assert.equal(internals.records.size,before);});
test('core trees, lamps and props retire immediately on their separate bounded path',()=>{
  const f=localImpactFixture();try{f.impact();assert.ok(f.streamer.isDestroyed('0,0/tree/0'));assert.ok(f.matrices('largo:').every(p=>p.determinant===0));assert.equal(f.population.targets[0].active,false);
    assert.equal(f.destruction.lastImpact!.buildings,16);assert.ok(f.destruction.pendingCount>=18,'heavy structures retain their 16/frame queue');
  }finally{f.dispose();}
});
test('light retirement overflow queues all IDs without consuming the building budget',()=>{
  const boxes=Array.from({length:1100},(_,i)=>({id:`prop:${i}`,x:0,y:1,z:0,width:1,height:2,depth:1,category:'fragile' as const}));const removed=new Set<string>();
  const system=new DestructionSystem(new Group(),{colliders:()=>boxes,destroy:id=>{if(removed.has(id))return false;removed.add(id);return true;}});
  try{system.impactAt(zero,resolveImpact(8000));assert.equal(removed.size,1024);assert.equal(system.pendingCount,76);system.update(1/60,zero,zero,true);assert.equal(removed.size,1100);assert.equal(system.pendingCount,0);}finally{system.dispose();}
});
test('every Largo instance has an owner, and multipart offsets share an entity',()=>{fixture.props.traverse(node=>{if(node instanceof InstancedMesh){assert.equal(node.userData.authoredInstances.length,node.count);assert.ok(node.userData.authoredInstances.every((b:any)=>b.id&&b.collider));}});for(const family of ['chair','parasol','stall']){const parts=fixture.matrices(`largo:${family}:`);assert.ok(parts.length>0);assert.ok(parts.every(p=>p.determinant===0));}});
test('heavy blast destroys fragile objects beyond crater lip',()=>{const boxes=initial.boxes.filter((b:any)=>b.category==='fragile'&&Math.hypot(b.x,b.z)>fixture.footprint.craterRadiusM&&Math.hypot(b.x,b.z)<fixture.footprint.blastDamageRadiusM*.9);assert.ok(boxes.length>0);const remaining=fixture.query(zero,2000);assert.ok(boxes.every((b:any)=>!remaining.some(c=>c.id===b.id)));});
test('reconstruction restores tree, furniture, props and NPCs and cancels the queue',()=>{
  const f=localImpactFixture();try{f.impact();assert.ok(f.destruction.pendingCount>0);f.destruction.restoreAt(zero,2000);assert.equal(f.destruction.pendingCount,0);
    f.terrain.restoreAt(zero,2000);f.terrain.update(zero,zero);f.registry.restore(zero,2000);f.streamer.restore(zero,2000);PhysicsWorld.setTerrain(f.terrain);f.population.reconstruct(zero,2000);
    assert.ok(f.matrices('largo:').every(p=>p.determinant>0));assert.equal(f.population.targets[0].active,true);assert.equal(f.population.npcs[0].active,true);assert.equal(f.population.npcs[1].active,true);assert.equal(f.terrain.heightAt(0,0),0);
    for(let i=0;i<10;i++)f.destruction.update(1/60,zero,zero,true);assert.equal(f.streamer.isDestroyed('0,0/tree/0'),false);
  }finally{f.dispose();}
});
test('surviving props and NPCs use crater support instead of the former street height',()=>{
  const f=localImpactFixture();try{f.terrain.damageAt(zero,500,1000,200);f.terrain.update(zero,zero);PhysicsWorld.setTerrain(f.terrain);
    const prop=f.population.targets[0],npc=f.population.npcs[0];prop.active=true;npc.active=true;npc.state='fleeing';npc.timer=10;
    for(let i=0;i<240;i++)f.population.update(1/60,zero,1);
    assert.ok(prop.position.y<-100);assert.ok(npc.position.y<-100);assert.equal(f.population.npcs.length,40);assert.equal(f.population.targets.length,48);
  }finally{f.dispose();}
});
test('finite extreme impact keeps all effects within fixed budgets',()=>{const f=resolveImpact(1e300,1000);for(const value of Object.values(f))if(typeof value==='number')assert.ok(Number.isFinite(value));assert.ok(f.impulse<=IMPACT.maxImpulse&&f.debrisCount<=IMPACT.maxDebris&&f.shake<=IMPACT.maxShake);});
test('contact policy normalizes before multiplying and rejects invalid velocities',()=>{
  assert.equal(resolveContactImpact(new Vector3(0,-1e300,0),new Vector3(0,1e100,0)).craterRadiusM,1200);
  for(const value of [NaN,Infinity,-Infinity]){const f=resolveContactImpact(new Vector3(value,-20,0),new Vector3(0,1,0));assert.equal(f.craterRadiusM,0);assert.equal(f.normalImpactSpeed,0);}
});
test('power sink passes the same footprint once and scales bounded effects',()=>{
  const f=resolveImpact(50000),waves:number[]=[],flashes:number[]=[],dust:number[]=[],limits:number[]=[],spreads:number[]=[];let routed=0,legacy=0;
  const powers=Object.assign(Object.create(PowerSystem.prototype),{player:{size:1},time:100,collapseNotice:0,
    hooks:{impact:(p:Vector3,impact:any)=>{assert.equal(p,zero);assert.equal(impact,f);routed++;return 2;},damage:()=>{legacy++;},impulse:()=>{legacy++;},sound(){},notify(){}},
    effects:{wave:(_:Vector3,r:number)=>waves.push(r),flash:(_:Vector3,r:number)=>flashes.push(r),burst:(_:Vector3,__:number,size:number,___:number,limit:number,spread:number)=>{dust.push(size);limits.push(limit);spreads.push(spread);}},hitStop:{trigger(){}}});
  powers.applyImpact({position:zero,impact:f});assert.equal(routed,1);assert.equal(legacy,0);assert.equal(waves[0],f.blastDamageRadiusM);assert.ok(flashes[0]>60&&flashes[0]<=IMPACT.maxFlash);assert.ok(dust[0]>40&&dust[0]<=50);assert.equal(limits[0],IMPACT.maxDustSpeed);assert.equal(spreads[0],f.craterRadiusM*.85);
  powers.hooks.canDeformSurface=()=>false;powers.applyImpact({position:zero,impact:f});assert.equal(routed,1);assert.ok(waves.at(-1)!<=8,'airless surface stays on the protected stylized path');
});
test('impact dust covers the crater footprint within the actual speed and instance limits',()=>{
  const effects=new EffectPool(new Group()),f=resolveImpact(50000);
  try{effects.burst(zero,0xffffff,50,f.debrisCount,IMPACT.maxDustSpeed,f.radius*.85);
    const active=(effects as any).particles.filter((p:any)=>p.life>0);assert.equal(active.length,90);
    assert.ok(active.every((p:any)=>p.velocity.length()<=IMPACT.maxDustSpeed+1e-9&&Math.hypot(p.position.x,p.position.z)<=f.radius*.85));
    assert.ok(active.some((p:any)=>Math.hypot(p.position.x,p.position.z)>f.radius*.7));
  }finally{effects.dispose();}
});
test('entulho falls to the excavated floor instead of bouncing on former street level',()=>{
  const terrain=new TerrainDestruction(new Group());terrain.setBodyId('debris-floor-fixture');terrain.restoreAt(zero,1e9);terrain.damageAt(zero,500,1000,200);terrain.update(zero,zero);PhysicsWorld.setTerrain(terrain);
  const pool=new DebrisPool(new Group(),4,{gravity:24,restitution:0,friction:4,lifetime:30,speedScale:0,sizeScale:1,cullRadius:1000});
  try{pool.spawn(0,0,0,1,0xffffff,0);for(let i=0;i<300;i++)pool.update(1/60,zero);
    const internals=pool as any;assert.ok(internals.py[0]<-190);assert.ok(Math.abs(internals.py[0]-terrain.heightAt(internals.px[0],internals.pz[0]))<2);
  }finally{pool.dispose();PhysicsWorld.setTerrain(null);terrain.restoreAt(zero,1e9);terrain.dispose();}
});
test('50 km/s and capped crater keep bounds, rays and topology consistent',()=>{
  const terrain=new TerrainDestruction(new Group());terrain.setBodyId('large-impact-fixture');terrain.restoreAt(zero,1e9);const bytes=terrain.stats.bytes;
  try{for(const speed of [50000,1e9]){terrain.restoreAt(zero,1e9);const f=resolveImpact(speed);terrain.damageAt(zero,f.radius,f.damage,f.craterDepthM);terrain.update(zero,zero);terrain.group.updateMatrixWorld(true);
    assert.equal(terrain.stats.bytes,bytes);assert.ok(terrain.stats.span<=4096);for(const ratio of [0,.25,.5,.75]){const x=f.radius*ratio,ray=new Raycaster(new Vector3(x,100,0),new Vector3(0,-1,0),0,1500),hit=ray.intersectObject(terrain.bowl)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-terrain.heightAt(x,0))<.01);}
    assert.ok(terrain.bowl.geometry.boundingSphere!.radius>f.radius);range(-terrain.heightAt(0,0),f.craterDepthM-.1,f.craterDepthM+.1);
  }}finally{terrain.restoreAt(zero,1e9);terrain.dispose();}
});
test('surplus above the former 65536 cap is retained and eventually retired',()=>{
  const boxes=Array.from({length:65600},(_,i)=>({id:`resident:${i}`,x:0,y:1,z:0,width:1,height:2,depth:1})),removed=new Set<string>();
  const system=new DestructionSystem(new Group(),{colliders:()=>boxes,destroy:id=>{if(removed.has(id))return false;removed.add(id);return true;}});
  try{system.impactAt(zero,resolveImpact(8000));assert.equal(system.pendingCount,boxes.length-16);
    for(let i=0;i<4100;i++)system.update(1/60,zero,zero,true);assert.equal(removed.size,boxes.length);assert.equal(system.pendingCount,0);
  }finally{system.dispose();}
});
