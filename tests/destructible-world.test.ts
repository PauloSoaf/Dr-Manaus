import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three/webgpu';
import { TerrainDestruction, TERRAIN_DAMAGE } from '../src/world/destruction/TerrainDestruction.ts';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { AuthoredDestruction } from '../src/world/destruction/AuthoredDestruction.ts';
import { createAirport } from '../src/world/realcity/airport.ts';
import { createCharacterGeometry } from '../src/player/CharacterGeometry.ts';

test('crater has matching visible depth, raycast and landing; reconstruction restores ground',()=>{
  const terrain=new TerrainDestruction(new Group()), p=new Vector3();
  assert.equal(terrain.damageAt(new Vector3(0,100,0),20,2600),false);
  terrain.damageAt(p,20,2600);terrain.update(p,p);PhysicsWorld.setTerrain(terrain);
  try{
    assert.ok(terrain.heightAt(0,0)<-6);assert.ok(terrain.stats.triangles>0);
    const hit=PhysicsWorld.raycast(new Vector3(0,30,0),new Vector3(0,-1,0),[],100,0,true)!;
    assert.ok(Math.abs(hit.point.y-terrain.heightAt(0,0))<.001);
    assert.ok(PhysicsWorld.safeLanding(new Vector3(0,-50,0),[],.3,2).y<-5);
    const position=new Vector3(0,1,0),velocity=new Vector3(0,-30,0);
    new PhysicsWorld().move(position,velocity,1,.3,2,[]);assert.ok(position.y<-5);
    const depth=terrain.heightAt(0,0);terrain.update(p,new Vector3(1024,0,1024));assert.equal(terrain.heightAt(0,0),depth);
    assert.equal(terrain.restoreAt(p,30),1);terrain.update(p,p);assert.equal(terrain.heightAt(0,0),0);
  }finally{PhysicsWorld.setTerrain(null);terrain.dispose();}
});
test('terrain bounds stored craters, active topology and idle rebuilds',()=>{
  const terrain=new TerrainDestruction(new Group()),p=new Vector3();
  for(let i=0;i<TERRAIN_DAMAGE.maxStored+20;i++)terrain.damageAt(new Vector3(i*50,0,0),8,100);
  terrain.update(p,p);assert.equal(terrain.stats.stored,TERRAIN_DAMAGE.maxStored);assert.ok(terrain.stats.active<=32);
  const revision=terrain.stats.revision;terrain.update(p,p);assert.equal(terrain.stats.revision,revision);terrain.dispose();
});
test('continuous destruction does not auto-regenerate; only reconstructs with player power',()=>{
  const terrain=new TerrainDestruction(new Group()),p=new Vector3();
  // Simulate dragging a continuous laser across 80 meters (40 overlapping damage hits)
  for(let x=0;x<=80;x+=2) terrain.damageAt(new Vector3(x,0,0),4,200);
  terrain.update(new Vector3(80,0,0),new Vector3(80,0,0));
  // All points along the entire trench must remain deeply excavated; none should have regenerated
  for(let x=0;x<=80;x+=5) assert.ok(terrain.heightAt(x,0)<-1, `point at x=${x} must stay excavated`);
  // Destroying even more ground elsewhere must NOT regenerate the earlier trench
  for(let z=10;z<=60;z+=2) terrain.damageAt(new Vector3(80,0,z),4,200);
  terrain.update(new Vector3(80,0,0),new Vector3(80,0,0));
  for(let x=0;x<=80;x+=5) assert.ok(terrain.heightAt(x,0)<-1, `earlier trench at x=${x} must not regenerate after more destruction`);
  // Only player restore power heals the ground
  terrain.restoreAt(new Vector3(20,0,0),25);
  terrain.update(new Vector3(80,0,0),new Vector3(80,0,0));
  assert.equal(terrain.heightAt(20,0),0, 'explicit restore power must restore ground');
  // Sections outside the restore radius still remain excavated
  assert.ok(terrain.heightAt(70,0)<-1, 'section outside restore radius must stay excavated');
  terrain.dispose();
});
test('giant laser and shots carve larger holes without allocating a larger mesh',()=>{
  const terrain=new TerrainDestruction(new Group()),zero=new Vector3();
  terrain.damageAt(zero,3,220);terrain.update(zero,zero);
  const bytes=terrain.stats.bytes,smallDepth=terrain.heightAt(0,0);
  terrain.restoreAt(zero,10);
  const giant=1000/2.07,laserRadius=3*Math.pow(giant,.7);
  terrain.damageAt(zero,laserRadius,220*giant);terrain.update(zero,zero);
  assert.ok(terrain.craters[0].radius>200);assert.ok(terrain.heightAt(100,0)<-30);
  assert.ok(terrain.heightAt(0,0)<smallDepth-50);assert.equal(terrain.stats.bytes,bytes);
  const hit=terrain.raycast(new Vector3(100,300,0),new Vector3(0,-1,0),1000)!;
  assert.ok(Math.abs(300-hit-terrain.heightAt(100,0))<.01);
  terrain.restoreAt(zero,500);terrain.damageAt(zero,7*Math.pow(giant,.7),700*giant);terrain.update(zero,zero);
  assert.ok(terrain.craters[0].radius>500);assert.ok(terrain.stats.span>=2048);assert.ok(terrain.heightAt(300,0)<-30);
  assert.equal(terrain.stats.bytes,bytes);terrain.dispose();
});
test('airport terminal, hangars, tower and tanks destroy and reconstruct independently',()=>{
  const registry=new AuthoredDestruction();createAirport(registry);
  for(const id of ['airport:terminal','airport:hangar:-500','airport:hangar:-260','airport:tower','airport:tank:0'])assert.equal(registry.destroy(id),true,id);
  assert.equal(registry.destroyedCount,5);assert.equal(registry.destroy('airport:terminal'),false);
  assert.equal(registry.restore(new Vector3(),100000),5);assert.equal(registry.destroy('airport:terminal'),true);registry.dispose();
});
test('human skin keeps hero scale, bounded triangles and normalized articulation weights',()=>{
  const {skin,accents}=createCharacterGeometry(),box=skin.boundingBox!;
  assert.ok(box.max.y>2&&box.max.y<2.1);assert.ok(box.max.x-box.min.x<.8);assert.ok(skin.getAttribute('position').count/3<15000);
  const weights=skin.getAttribute('skinWeight'),bones=skin.getAttribute('skinIndex');const used=new Set<number>();
  for(let i=0;i<weights.count;i++){assert.ok(Math.abs(weights.getX(i)+weights.getY(i)-1)<1e-6);used.add(bones.getX(i));used.add(bones.getY(i));}
  assert.equal(used.size,19);skin.dispose();accents.dispose();
});
