import { BoxGeometry, CapsuleGeometry, Color, Group, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three/webgpu';
import type { Collider, Target } from '../core/types';
import { isLand, LANDMARKS } from '../world/geodata/geodata';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { IMPACT, type ImpactFootprint } from '../player/combat/MeteorImpact';
import { localManausPresentationMode } from '../world/spatial/ManausSurfacePresentation';
import { SurfaceFrameService } from '../world/spatial/SurfaceFrameService';
import { FastSpatialGrid2D } from '../world/spatial/FastSpatialGrid2D';

interface Body extends Target { base: Vector3; velocity: Vector3; index: number; angle: number; chunk: string }
export interface NpcBody { id: string; index: number; base: Vector3; position: Vector3; velocity: Vector3; active: boolean; state: 'walking'|'fleeing'|'knocked'|'disabled'; timer: number }
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const FIRST_PROP=28,LAST_PROP=76,NPC_CAPACITY=40,HISTORY_LIMIT=4096;
/** Fixed local instance pools, stable cell/slot IDs, no per-person render or rigid-body objects. */
export class PopulationManager {
  readonly targets: Body[]=[];
  readonly npcs: NpcBody[]=[];
  readonly destroyed=new Set<string>();
  readonly colliders:Collider[]=[];
  npcCount=24; reaction=0; vehicleCount=16;
  private props:InstancedMesh; private people:InstancedMesh; private heads:InstancedMesh;
  private dummy=new Object3D(); private color=new Color(); private cell=''; private elapsed=0;
  private gaspCooldown = 0;
  private readonly surfaceService = new SurfaceFrameService('earth');
  private readonly spatialGrid = new FastSpatialGrid2D(4000, 16, NPC_CAPACITY);
  constructor(root:Group, private readonly onGasp?: () => void){
    this.props=new InstancedMesh(new BoxGeometry(1,1,1),new MeshStandardMaterial({color:'#ba8a56',roughness:.8}),48);
    this.people=new InstancedMesh(new CapsuleGeometry(.28,.9,3,6),new MeshStandardMaterial({roughness:.9}),NPC_CAPACITY);
    this.heads=new InstancedMesh(new SphereGeometry(.19,6,5),new MeshStandardMaterial({color:'#a07555'}),NPC_CAPACITY);
    this.props.name='population-props';this.people.name='population-npcs';this.heads.name='population-heads';
    for(const mesh of [this.props,this.people,this.heads]){mesh.frustumCulled=false;mesh.castShadow=true;root.add(mesh);}
    for(let i=0;i<NPC_CAPACITY;i++){
      this.color.setHSL(hash(i+40),.35,.4);this.people.setColorAt(i,this.color);
      this.npcs.push({id:'',index:i,base:new Vector3(),position:new Vector3(),velocity:new Vector3(),active:false,state:'walking',timer:0});
    }
  }
  private remember(id:string){this.destroyed.add(id);while(this.destroyed.size>HISTORY_LIMIT)this.destroyed.delete(this.destroyed.values().next().value!);}
  private seed(player:Vector3){
    const cx=Math.floor(player.x/128),cz=Math.floor(player.z/128),key=`${cx},${cz}`;
    if(key===this.cell)return;this.cell=key;this.targets.length=0;
    for(let i=FIRST_PROP;i<LAST_PROP;i++){
      const ix=(i%5)-2,iz=Math.floor(i/5)%5-2,bx=(cx+ix)*128,bz=(cz+iz)*128;
      let x=bx+11,z=bz+18+hash(i+cx*19+cz*31)*90;
      if(i%2===0){x=bx+30+hash(i+cz)*60;z=bz+11;}
      const id=`prop:${cx+ix}:${cz+iz}:${i}`,base=new Vector3(x,PhysicsWorld.terrainHeight(x,z)+.7,z);
      const reserved=LANDMARKS.some(l=>Math.hypot(l.x-x,l.z-z)<l.radius*.65);
      this.targets.push({id,position:base.clone(),base,velocity:new Vector3(),index:i-FIRST_PROP,angle:0,chunk:`${cx+ix}:${cz+iz}`,radius:1.4,kind:'prop',active:isLand(x,z)&&!reserved&&!this.destroyed.has(id)});
    }
    for(const npc of this.npcs){
      const x=(cx+(npc.index%5)-2)*128+10,z=(cz+(Math.floor(npc.index/5)%5)-2)*128+hash(npc.index+cx*7)*110;
      npc.id=`npc:${key}:${npc.index}`;npc.base.set(x,PhysicsWorld.terrainHeight(x,z)+1,z);npc.position.copy(npc.base);npc.velocity.set(0,0,0);
      npc.active=isLand(x,z)&&!this.destroyed.has(npc.id);npc.state=npc.active?'walking':'disabled';npc.timer=0;
    }
  }
  destroy(id:string):boolean{
    const body=this.targets.find(t=>t.id===id);
    if(body?.active){body.active=false;body.velocity.set(0,0,0);this.remember(id);this.hide(this.props,body.index);const index=this.colliders.findIndex(c=>c.id===id);if(index>=0)this.colliders.splice(index,1);return true;}
    const npc=this.npcs.find(n=>n.id===id);
    if(!npc?.active)return false;npc.active=false;npc.state='disabled';npc.velocity.set(0,0,0);this.remember(id);this.hide(this.people,npc.index);this.hide(this.heads,npc.index);return true;
  }
  hit(id:string,force:number){void force;this.reaction=5;return this.destroy(id);}
  private hide(mesh:InstancedMesh,index:number){this.dummy.scale.setScalar(0);this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix);mesh.instanceMatrix.needsUpdate=true;}
  impulse(at:Vector3,radius:number,force:number){
    if(radius<=0||force<=0)return;this.reaction=6;
    for(const body of this.targets){const d=Math.hypot(body.position.x-at.x,body.position.z-at.z);
      if(body.active&&d<radius){const gain=Math.min(IMPACT.maxActorSpeed,force*(1-d/radius));body.velocity.set((body.position.x-at.x)/(d||1)*gain,Math.min(60,8+gain*.16),(body.position.z-at.z)/(d||1)*gain);}}
  }
  applyImpact(at:Vector3,footprint:ImpactFootprint){
    const result={queried:0,affected:0,disabled:0,knocked:0,fleeing:0};
    if(footprint.reactionRadiusM<=0)return result;
    for(const npc of this.npcs){
      if(!npc.active||npc.index>=this.npcCount)continue;
      const dx=npc.position.x-at.x,dz=npc.position.z-at.z,d=Math.hypot(dx,dz);
      if(d>footprint.reactionRadiusM)continue;result.queried++;result.affected++;
      if(d-.3<=footprint.coreDestructionRadiusM){this.destroy(npc.id);result.disabled++;continue;}
      const strength=d<footprint.impulseRadiusM?Math.min(IMPACT.maxActorSpeed,footprint.impulse*(1-d/footprint.impulseRadiusM)):10;
      npc.velocity.set(dx/(d||1)*strength,d<footprint.impulseRadiusM?Math.min(45,4+strength*.16):0,dz/(d||1)*strength);
      if(d<footprint.blastDamageRadiusM){npc.state='knocked';npc.active=false;npc.timer=8;this.remember(npc.id);this.hide(this.people,npc.index);this.hide(this.heads,npc.index);result.knocked++;}
      else{npc.state='fleeing';npc.timer=6;result.fleeing++;}
    }
    return result;
  }
  reconstruct(at:Vector3,radius:number){
    let count=0;
    for(const body of this.targets)if(!body.active&&this.destroyed.has(body.id)&&Math.hypot(body.base.x-at.x,body.base.z-at.z)<radius){body.active=true;body.position.copy(body.base);body.position.y=PhysicsWorld.terrainHeight(body.base.x,body.base.z)+.7;body.velocity.set(0,0,0);this.destroyed.delete(body.id);count++;}
    for(const npc of this.npcs)if(!npc.active&&this.destroyed.has(npc.id)&&Math.hypot(npc.base.x-at.x,npc.base.z-at.z)<radius){npc.active=true;npc.state='walking';npc.position.copy(npc.base);npc.position.y=PhysicsWorld.terrainHeight(npc.base.x,npc.base.z)+1;npc.velocity.set(0,0,0);npc.timer=0;this.destroyed.delete(npc.id);count++;}
    return count;
  }
  appendBlastColliders(out:Collider[],at:Vector3,radius:number){for(const body of this.targets)if(body.active&&Math.hypot(Math.max(0,Math.abs(body.position.x-at.x)-.6),Math.max(0,Math.abs(body.position.z-at.z)-.6))<=radius)out.push({id:body.id,x:body.position.x,y:body.position.y,z:body.position.z,width:1.2,height:1.4,depth:1.2,category:'fragile'});}
  private advance(body:{position:Vector3;velocity:Vector3},dt:number,offset:number){
    const floor=PhysicsWorld.terrainHeight(body.position.x,body.position.z)+offset;
    if(body.position.y>floor+.01||body.velocity.y>0)body.velocity.y-=15*dt;
    body.position.addScaledVector(body.velocity,dt);
    const movedFloor=PhysicsWorld.terrainHeight(body.position.x,body.position.z)+offset;
    if(body.position.y<=movedFloor){body.position.y=movedFloor;body.velocity.y=0;}
    const damp=Math.exp(-dt*2);body.velocity.x*=damp;body.velocity.z*=damp;
  }
  update(dt:number,player:Vector3,size:number,playerVelocity?:Vector3){
    this.seed(player);this.elapsed+=dt;this.reaction=Math.max(0,this.reaction-dt);this.colliders.length=0;
    this.gaspCooldown=Math.max(0,this.gaspCooldown-dt);
    const curved = localManausPresentationMode() === 'curved';
    const playerSpeed = playerVelocity ? playerVelocity.length() : 0;
    const isSupersonicFlyby = playerSpeed > 28;

    // Fast Spatial Grid pre-pass for pedestrian crowd separation
    this.spatialGrid.clear();
    for (const npc of this.npcs) {
      if (npc.active) {
        this.spatialGrid.insert(npc.index, npc.position.x, npc.position.z);
      }
    }

    for(const body of this.targets){
      const enabled=body.active&&Math.abs(player.y-body.position.y)<250;
      if(enabled){
        if(isSupersonicFlyby&&Math.abs(player.y-body.position.y)<18&&Math.hypot(body.position.x-player.x,body.position.z-player.z)<18){
          body.velocity.x+=playerVelocity!.x*0.02;body.velocity.z+=playerVelocity!.z*0.02;
        }
        this.advance(body,dt,.7);body.angle+=dt*body.velocity.length()*.07;this.colliders.push({x:body.position.x,y:body.position.y,z:body.position.z,width:1.2,height:1.4,depth:1.2,id:body.id,category:'fragile'});
      }
      const renderPos = curved ? this.surfaceService.legacyPointToRenderLocal(body.position.x, body.position.y, body.position.z) : body.position;
      this.dummy.position.copy(renderPos);this.dummy.rotation.set(0,body.angle,0);this.dummy.scale.setScalar(enabled?1.2:0);this.dummy.updateMatrix();this.props.setMatrixAt(body.index,this.dummy.matrix);
    }
    for(const npc of this.npcs){
      const knocked=npc.state==='knocked'&&npc.timer>0;
      if(npc.active||knocked){
        const dx=npc.position.x-player.x,dz=npc.position.z-player.z,d=Math.hypot(dx,dz);
        if(isSupersonicFlyby&&Math.abs(player.y-npc.position.y)<20&&d<26){
          npc.state='fleeing';npc.timer=Math.max(npc.timer,3.5);
          npc.velocity.set(dx/(d||1)*8+playerVelocity!.x*0.05,1.2,dz/(d||1)*8+playerVelocity!.z*0.05);
          if(this.gaspCooldown<=0){this.onGasp?.();this.gaspCooldown=2.2;}
        } else if(npc.state==='walking'&&(this.reaction>0||size>2)){
          if(d<80*size){npc.state='fleeing';npc.timer=2;npc.velocity.set(dx/(d||1)*10,0,dz/(d||1)*10);}
        }
        if(npc.state==='walking')npc.position.z=npc.base.z+Math.sin(this.elapsed*.07+npc.index)*38;
        this.advance(npc,dt,knocked?.35:1);npc.timer=Math.max(0,npc.timer-dt);
        if(npc.state==='fleeing'&&npc.timer===0){npc.state='walking';npc.base.copy(npc.position);npc.base.z-=Math.sin(this.elapsed*.07+npc.index)*38;}

        // Reynolds Crowd Separation: prevent pedestrian overlap
        if (!knocked && npc.active) {
          this.spatialGrid.forEachNeighbor(npc.position.x, npc.position.z, 2.2, (otherIdx, ox, oz, distSq) => {
            if (otherIdx === npc.index || distSq < 0.001) return;
            const d = Math.sqrt(distSq);
            const push = Math.min(1.5, (2.2 - d) * 1.8);
            npc.position.x += ((npc.position.x - ox) / d) * push * dt;
            npc.position.z += ((npc.position.z - oz) / d) * push * dt;
          });
        }
      }
      const enabled=(npc.active||knocked)&&npc.index<this.npcCount&&Math.abs(player.y-npc.position.y)<250;
      const renderPos = curved ? this.surfaceService.legacyPointToRenderLocal(npc.position.x, npc.position.y, npc.position.z) : npc.position;
      this.dummy.position.copy(renderPos);this.dummy.rotation.set(0,0,knocked?1.4:Math.sin(this.elapsed*6+npc.index)*.035);this.dummy.scale.setScalar(enabled?1:0);this.dummy.updateMatrix();this.people.setMatrixAt(npc.index,this.dummy.matrix);
      this.dummy.position.y+=knocked?.12:.88;this.dummy.updateMatrix();this.heads.setMatrixAt(npc.index,this.dummy.matrix);
    }
    for(const mesh of [this.props,this.people,this.heads])mesh.instanceMatrix.needsUpdate=true;
  }
  dispose(){for(const mesh of [this.props,this.people,this.heads]){mesh.removeFromParent();mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();}}
}
