import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three/webgpu';
import {DestructionSystem} from '../src/world/destruction/DestructionSystem.ts';
import {skylineBuildings} from '../src/world/realcity/skyline.ts';

test('a single wave eventually destroys every hit structure beyond the per-frame budget',()=>{
  const boxes=Array.from({length:900},(_,i)=>({id:`building:${i}`,x:i%30*6,y:5,z:Math.floor(i/30)*6,width:5,height:10,depth:5}));
  const removed=new Set<string>(),world={colliders:()=>boxes.slice(0,10),blastColliders:()=>boxes,destroy:(id:string)=>{if(removed.has(id))return false;removed.add(id);return true;}};
  const destruction=new DestructionSystem(new Group(),world),zero=new Vector3();
  destruction.damageAt(zero,400,100000);assert.ok(removed.size<900);assert.ok(destruction.pendingCount>500);
  for(let frame=0;frame<60;frame++)destruction.update(1/60,zero,zero);
  assert.equal(removed.size,900);assert.equal(destruction.pendingCount,0);destruction.dispose();
});
test('distant blocks become separate small buildings with varied restrained gray tones',()=>{
  const buildings=skylineBuildings(3000,2000,180,220,30);
  assert.equal(buildings.length,9);assert.ok(new Set(buildings.map(b=>b.gray)).size>5);
  for(const b of buildings){assert.ok(b.width<=28&&b.depth<=26&&b.height<=38);assert.ok(b.gray>=.13&&b.gray<.34);}
  assert.deepEqual(buildings,skylineBuildings(3000,2000,180,220,30));
});
