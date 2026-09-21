import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Matrix4,Vector3,InstancedMesh} from 'three/webgpu';
import {generateChunk} from '../src/world/chunks/BuildingGenerator.ts';
import {TrafficSystem} from '../src/world/traffic/TrafficSystem.ts';
import {RoadGraph} from '../src/world/traffic/RoadGraph.ts';
import {PhysicsWorld} from '../src/physics/PhysicsWorld.ts';

test('wilderness contains dense deterministic forest and no procedural buildings',()=>{
  const chunk=generateChunk(250,-250);
  assert.equal(chunk.buildings.length,0);assert.ok(chunk.trees.length/5>=50);
  assert.deepEqual(chunk.trees,generateChunk(250,-250).trees);
});
function traffic(){
  const graph=new RoadGraph();graph.load({nodes:[[-400,0],[400,0]],segments:[{id:'street',p:[-400,0,400,0],a:0,b:1,width:12,speed:8}]});
  const root=new Group(),cars=new TrafficSystem(root,graph);cars.setCount(4);cars.update(.016,new Vector3());
  return {root,cars};
}
test('traffic damage creates a persistent wreck without spawning another car in the slot',()=>{
  const {root,cars}=traffic();try{
    const car=cars.colliders[0];assert.ok(car);const index=Number(car.id!.slice(8));
    assert.equal(cars.destroy(car.id!),true);assert.equal(cars.destroy(car.id!),false);
    for(let n=0;n<30;n++)cars.update(.05,new Vector3());
    assert.ok(!cars.colliders.some(c=>c.id===car.id));
    const matrix=new Matrix4();(root.getObjectByName('traffic-bodies') as InstancedMesh).getMatrixAt(index,matrix);
    assert.ok(matrix.determinant()>0);assert.ok(Math.abs(matrix.elements[13])<2);
  }finally{cars.dispose();}
});
test('cars fall below street level when a crater opens beneath them',()=>{
  const {root,cars}=traffic();const car=cars.colliders[0];assert.ok(car);const index=Number(car.id!.slice(8));
  PhysicsWorld.setTerrain({heightAt:()=>-12});
  try{
    for(let n=0;n<50;n++)cars.update(.05,new Vector3());
    const matrix=new Matrix4();(root.getObjectByName('traffic-bodies') as InstancedMesh).getMatrixAt(index,matrix);
    assert.ok(matrix.elements[13]<-10);assert.ok(matrix.elements[13]>-13);
  }finally{PhysicsWorld.setTerrain(null);cars.dispose();}
});
