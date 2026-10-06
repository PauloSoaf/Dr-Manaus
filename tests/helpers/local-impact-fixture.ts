import { Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3, type Material } from 'three/webgpu';
import { PopulationManager } from '../../src/entities/PopulationManager.ts';
import { PhysicsWorld } from '../../src/physics/PhysicsWorld.ts';
import { resolveImpact } from '../../src/player/combat/MeteorImpact.ts';
import { DestructionSystem } from '../../src/world/destruction/DestructionSystem.ts';
import { TerrainDestruction } from '../../src/world/destruction/TerrainDestruction.ts';
import { AuthoredDestruction } from '../../src/world/destruction/AuthoredDestruction.ts';
import { createLargoProps } from '../../src/world/landmarks/largo/props.ts';
import { WorldStreamer } from '../../src/world/streaming/WorldStreamer.ts';
import { ChunkState } from '../../src/world/chunks/Chunk.ts';
import { RoadGraph } from '../../src/world/traffic/RoadGraph.ts';
import { TrafficSystem } from '../../src/world/traffic/TrafficSystem.ts';
import { RoadNetwork } from '../../src/world/realcity/roads.ts';
import { impactCategory, impactKind } from '../../src/world/destruction/ImpactCategories.ts';
import type { Collider } from '../../src/core/types.ts';
import { Game } from '../../src/game/Game.ts';
export { Group, Vector3, HemisphereLight, DirectionalLight, Raycaster } from 'three/webgpu';

let serial=0;
/** Explicit deterministic poses; every owner and mesh builder is the production implementation. */
export function localImpactFixture() {
  PhysicsWorld.setTerrain(null);
  const root=new Group(),zero=new Vector3(),terrain=new TerrainDestruction(root);
  terrain.setBodyId(`local-impact-fixture-${++serial}`);
  const sheet=new Mesh(new PlaneGeometry(2800,2800),new MeshStandardMaterial({color:'#858d68',roughness:1}));sheet.rotation.x=-Math.PI/2;sheet.position.y=-.01;sheet.name='terrain-backdrop';sheet.userData.terrainSurface='sheet';root.add(sheet);terrain.attach(sheet);
  const roadMaterial=new MeshStandardMaterial({vertexColors:true,roughness:1}),lampMaterial=new MeshStandardMaterial({vertexColors:true,roughness:.7});
  const roads=new RoadNetwork([{class:'primary',width:14,p:[-1100,0,1100,0]}],roadMaterial,lampMaterial);root.add(roads.group);
  for(let i=0;i<5;i++)roads.update(0,0,0);terrain.attach(roads.group);
  const registry=new AuthoredDestruction(),props=createLargoProps();root.add(props);registry.register(props,'largo:props',{x:0,z:0});
  const streamer=new WorldStreamer(root),internals=streamer as any;
  const payload={key:'0,0',cx:0,cz:0,land:true,
    trees:new Float32Array([30,0,10,3,0]),
    buildings:new Float32Array([50,0,12,10,12,.5,.5,.5,2, 170,0,80,200,80,.5,.5,.5,3, 900,0,30,20,30,.5,.5,.5,3,
      ...Array.from({length:32},(_,i)=>[-100+i*6,80,4,8,4,.5,.5,.5,1]).flat()])};
  const built=internals.meshes.create(payload);root.add(built.group);
  internals.records.set('0,0',{key:'0,0',cx:0,cz:0,state:ChunkState.ACTIVE,priority:0,touched:0,payload,...built});internals.active.add('0,0');internals.refreshColliders();
  const population=new PopulationManager(root);population.npcCount=40;population.update(0,zero,1);
  const prop=population.targets[0];prop.active=true;prop.base.set(60,.7,0);prop.position.copy(prop.base);
  population.npcs.forEach(n=>{n.active=false;n.state='disabled';});
  const footprint=resolveImpact(8000);
  for(const [i,x] of [50,600,800,950,1200].entries()){
    const npc=population.npcs[i];npc.active=true;npc.state='walking';npc.position.set(x,1,0);npc.base.copy(npc.position);
  }
  population.update(0,zero,1);
  const graph=new RoadGraph();graph.load({nodes:[[-400,0],[400,0]],segments:[{id:'street',p:[-400,0,400,0],a:0,b:1,width:12,speed:8}]});
  const traffic=new TrafficSystem(root,graph);traffic.setCount(2);traffic.update(.016,zero);
  const car=(traffic as any).pool[0];car.x=70;car.z=0;
  traffic.colliders[0].x=70;traffic.colliders[0].z=0;
  const query=(point:Vector3,radius:number)=>{
    const out:Collider[]=[];registry.appendColliders(out,point,radius,true);streamer.appendBlastColliders(out,point,radius);population.appendBlastColliders(out,point,radius);
    for(const box of traffic.colliders)if(Math.hypot(box.x-point.x,box.z-point.z)<=radius+4)out.push(box);
    for(const box of roads.colliders)if(Math.hypot(box.x-point.x,box.z-point.z)<=radius+10)out.push(box);
    for(const box of out){box.category??=impactCategory(box.id);box.impactKind??=impactKind(box.id);}return out;
  };
  const world={colliders:()=>query(zero,2000),blastColliders:query,
    destroy:(id:string)=>traffic.destroy(id)||population.destroy(id)||streamer.destroy(id)||registry.destroy(id)||roads.destroy(id),
    deform:(p:Vector3,r:number,d:number,depth?:number)=>terrain.damageAt(p,r,d,depth)};
  let destruction=new DestructionSystem(root,world),peakPending=0;
  terrain.attach(root);
  const empty={appendBlastColliders(){},appendColliders(){},destroy(){return false;}};
  const authored={appendBlastColliders:(out:Collider[],p:Vector3,r:number)=>registry.appendColliders(out,p,r,true),destroy:(id:string)=>registry.destroy(id)};
  const roadOwner={appendBlastColliders:(out:Collider[],p:Vector3,r:number)=>{for(const box of roads.colliders)if(Math.hypot(box.x-p.x,box.z-p.z)<=r+10)out.push(box);},destroy:(id:string)=>roads.destroy(id)};
  const fields={terrain,population,traffic,streamer,destruction,realCity:roadOwner,landmarks:empty,largo:authored,airport:empty,colliders:traffic.colliders,curvedColliders:[]};
  return {
    root,zero,terrain,registry,props,streamer,population,traffic,roads,footprint,query,
    get destruction(){return destruction;},
    get peakPending(){return peakPending;},
    /** Uses Game's actual local impact handler, and optionally its actual owner-routing adapter. */
    impact(game?:Game,impact=footprint){
      if(!game){const count=Game.prototype.applyLocalImpact.call({manausSimulationActive:true,destruction,population,traffic} as any,zero,impact);population.update(0,zero,1);peakPending=destruction.pendingCount;return count;}
      const saved:Record<string,unknown>={};
      for(const key of Object.keys(fields)){saved[key]=(game as any)[key];(game as any)[key]=(fields as any)[key];}
      try{
        destruction.dispose();destruction=new DestructionSystem(root,game.destructible);(game as any).destruction=destruction;
        terrain.attach(root);
        const count=game.applyLocalImpact(zero,impact);population.update(0,zero,1);peakPending=destruction.pendingCount;
        for(let i=0;destruction.pendingCount>0&&i<1000;i++)destruction.update(1/60,zero,zero,true);
        terrain.update(zero,zero);return count;
      }finally{for(const key of Object.keys(fields))(game as any)[key]=saved[key];PhysicsWorld.setTerrain(game.terrain);}
    },
    drain(){for(let i=0;destruction.pendingCount>0&&i<1000;i++)destruction.update(1/60,zero,zero,true);terrain.update(zero,zero);},
    matrices(family:string){
      const result:{name:string;id:string;determinant:number}[]=[],matrix=new Matrix4();
      props.traverse(node=>{if(node instanceof InstancedMesh)for(const binding of node.userData.authoredInstances??[])if(binding.id.includes(family)){node.getMatrixAt(binding.index,matrix);result.push({name:node.name,id:binding.id,determinant:matrix.determinant()});}});
      return result;
    },
    dispose(){
      terrain.restoreAt(zero,1e7);terrain.dispose();destruction.dispose();registry.dispose();population.dispose();traffic.dispose();streamer.dispose();
      props.traverse(node=>{if(node instanceof Mesh){node.geometry.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material]) (material as Material).dispose();}});
      root.removeFromParent();PhysicsWorld.setTerrain(null);
      roads.dispose();roadMaterial.dispose();lampMaterial.dispose();sheet.geometry.dispose();(sheet.material as Material).dispose();
    },
  };
}
