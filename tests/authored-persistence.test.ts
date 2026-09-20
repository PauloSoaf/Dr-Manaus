import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three/webgpu';
import {LandmarkManager} from '../src/world/landmarks/LandmarkManager.ts';
import {LANDMARKS} from '../src/world/geodata/geodata.ts';
test('custom theatre remains destroyed across detail changes and reconstructs',()=>{
 const manager=new LandmarkManager(new Group()),mark=LANDMARKS.find(x=>x.id==='teatro')!,p=new Vector3(mark.x,0,mark.z);
 manager.update(p,1);assert.equal(manager.destroy('landmark:teatro'),true);
 assert.ok(!manager.colliders.some(x=>x.id==='landmark:teatro'));
 manager.update(new Vector3(100000,0,100000),1);manager.update(p,1);
 assert.ok(!manager.colliders.some(x=>x.id==='landmark:teatro'));
 assert.equal(manager.restore(p,1000),1);assert.ok(manager.colliders.some(x=>x.id==='landmark:teatro'));manager.dispose();
});
