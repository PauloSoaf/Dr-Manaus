import { BoxGeometry, CapsuleGeometry, Color, Group, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three/webgpu';
import type { Collider, Target } from '../core/types';
import { isLand, LANDMARKS } from '../world/geodata/geodata';
interface Body extends Target { base: Vector3; velocity: Vector3; index: number; angle: number; chunk: string }
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** Fixed pools simulate only the local neighborhood. Destruction is keyed by stable chunk/entity ids. */
export class PopulationManager {
  readonly targets: Body[] = [];
  readonly destroyed = new Set<string>();
  readonly colliders: Collider[] = [];
  npcCount = 24; vehicleCount = 16; reaction = 0;
  private cars: InstancedMesh; private glass: InstancedMesh; private props: InstancedMesh; private people: InstancedMesh; private heads: InstancedMesh;
  private dummy = new Object3D();
  private color = new Color();
  private cell = '';
  private elapsed = 0;
  private npcX = new Float32Array(40); private npcZ = new Float32Array(40);
  private root: Group;
  constructor(root: Group) {
    this.root = root;
    this.cars = new InstancedMesh(new BoxGeometry(1,1,1), new MeshStandardMaterial({ roughness: .45, metalness: .28 }), 28);
    this.glass = new InstancedMesh(new BoxGeometry(1,1,1), new MeshStandardMaterial({ color: '#324f59', roughness: .25, metalness: .55 }), 28);
    this.props = new InstancedMesh(new BoxGeometry(1,1,1), new MeshStandardMaterial({ color: '#ba8a56', roughness: .8 }), 48);
    this.people = new InstancedMesh(new CapsuleGeometry(.28,.9,3,6), new MeshStandardMaterial({ roughness: .9 }), 40);
    this.heads = new InstancedMesh(new SphereGeometry(.19,6,5), new MeshStandardMaterial({ color: '#a07555' }), 40);
    for (const mesh of [this.cars,this.glass,this.props,this.people,this.heads]) { mesh.frustumCulled = false; mesh.castShadow = true; root.add(mesh); }
    for (let i=0;i<28;i++) { this.color.setHSL(hash(i)*.7,.18+hash(i+3)*.3,.3+hash(i+8)*.4); this.cars.setColorAt(i,this.color); }
    for (let i=0;i<40;i++) { this.color.setHSL(hash(i+40),.35,.4); this.people.setColorAt(i,this.color); }
  }
  private seed(player: Vector3) {
    const cx = Math.floor(player.x/128), cz = Math.floor(player.z/128), key = `${cx},${cz}`;
    if (key === this.cell) return;
    this.cell = key; this.targets.length = 0;
    for (let i=0;i<76;i++) {
      const vehicle = i < 28; const ix = (i % 5)-2, iz = Math.floor(i/5)%5-2;
      const bx=(cx+ix)*128,bz=(cz+iz)*128;
      let x=bx+ (vehicle ? 4 : 11), z=bz+18+hash(i+cx*19+cz*31)*90;
      if (!vehicle && i%2 === 0) { x=bx+30+hash(i+cz)*60; z=bz+11; }
      const id=`${vehicle?'vehicle':'prop'}:${cx+ix}:${cz+iz}:${i}`;
      const base=new Vector3(x,vehicle?.65:.7,z);
      const reserved=LANDMARKS.some(l=>Math.hypot(l.x-x,l.z-z)<l.radius*.65);
      this.targets.push({id,position:base.clone(),base,velocity:new Vector3(),index:vehicle?i:i-28,angle:0,chunk:`${cx+ix}:${cz+iz}`,radius:vehicle?2.7:1.4,kind:vehicle?'vehicle':'prop',active:isLand(x,z)&&!reserved&&!this.destroyed.has(id)});
    }
    for (let i=0;i<40;i++) { this.npcX[i]=(cx+(i%5)-2)*128+10; this.npcZ[i]=(cz+(Math.floor(i/5)%5)-2)*128+hash(i+cx*7)*110; }
  }
  hit(id: string, force: number) {
    const body=this.targets.find(t=>t.id===id); if (!body?.active) return false;
    body.active=false; this.destroyed.add(id); body.velocity.set(0,0,0); this.reaction=5;
    void force; return true;
  }
  impulse(at: Vector3,radius:number,force:number) {
    this.reaction=6;
    for (const body of this.targets) { const d=body.position.distanceTo(at); if(body.active&&d<radius) { body.velocity.copy(body.position).sub(at).normalize().multiplyScalar(force*(1-d/radius)); body.velocity.y=8+force*.16; } }
  }
  reconstruct(at:Vector3,radius:number) {
    let count=0;
    for(const body of this.targets) if(!body.active&&this.destroyed.has(body.id)&&body.base.distanceTo(at)<radius) { body.active=true; body.position.copy(body.base);body.velocity.set(0,0,0); this.destroyed.delete(body.id);count++; }
    return count;
  }
  update(dt:number,player:Vector3,size:number) {
    this.seed(player); this.elapsed+=dt; this.reaction=Math.max(0,this.reaction-dt);
    this.colliders.length=0;
    let visibleCars=0;
    for(const body of this.targets) {
      const vehicle=body.kind==='vehicle'; const enabled=body.active&&(!vehicle||body.index<this.vehicleCount)&&Math.abs(player.y-body.position.y)<250;
      if(enabled) {
        if(body.velocity.lengthSq()>.02) {body.velocity.y-=15*dt;body.position.addScaledVector(body.velocity,dt); if(body.position.y<body.base.y){body.position.y=body.base.y;body.velocity.multiplyScalar(Math.exp(-dt*4));body.velocity.y=0;}body.angle+=dt*body.velocity.length()*.07;}
        else if(vehicle) {body.position.z=body.base.z+((this.elapsed*6+body.index*12)%105)-52;body.angle=0;}
        if(vehicle)visibleCars++;
        this.colliders.push({x:body.position.x,y:body.position.y,z:body.position.z,width:vehicle?1.85:1.2,height:vehicle?1.3:1.4,depth:vehicle?4.1:1.2,id:body.id});
      }
      this.dummy.position.copy(body.position);this.dummy.rotation.set(0,body.angle,0);this.dummy.scale.set(enabled?(vehicle?1.85:1.2):0,enabled?(vehicle?1.3:1.4):0,enabled?(vehicle?4.1:1.2):0);this.dummy.updateMatrix();
      (vehicle?this.cars:this.props).setMatrixAt(body.index,this.dummy.matrix);
      if(vehicle){this.dummy.position.y+=.82;this.dummy.scale.set(enabled?1.58:0,enabled?.65:0,enabled?2.05:0);this.dummy.updateMatrix();this.glass.setMatrixAt(body.index,this.dummy.matrix);}
    }
    for(let i=0;i<40;i++) {
      let x=this.npcX[i], z=this.npcZ[i]+Math.sin(this.elapsed*.07+i)*38;
      const flee=this.reaction>0||size>2;
      if(flee){const dx=x-player.x,dz=z-player.z,d=Math.hypot(dx,dz)||1;if(d<80*size){x+=dx/d*12;z+=dz/d*12;}}
      const enabled=i<this.npcCount&&isLand(x,z)&&player.y<230;
      this.dummy.position.set(x,1+Math.sin(this.elapsed*(flee?13:7)+i)*.035,z);this.dummy.rotation.set(0,0,Math.sin(this.elapsed*6+i)*.035);this.dummy.scale.setScalar(enabled?1:0);this.dummy.updateMatrix();this.people.setMatrixAt(i,this.dummy.matrix);
      this.dummy.position.y+=.88;this.dummy.updateMatrix();this.heads.setMatrixAt(i,this.dummy.matrix);
    }
    for(const mesh of [this.cars,this.glass,this.props,this.people,this.heads])mesh.instanceMatrix.needsUpdate=true;
    void visibleCars;
  }
}
