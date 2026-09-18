import { Color, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, TorusGeometry, Vector3 } from 'three/webgpu';
import type { Target } from '../core/types';
import type { SaveManager } from '../core/SaveManager';
import { LANDMARKS } from '../world/geodata/geodata';
interface Anomaly extends Target { model: Group; health: number; anchor: Vector3; phase: number }
export class MissionManager {
  stage=0; title='O Despertar'; objective='Decole do Teatro Amazonas'; hint='F para levitar · Espaço para subir';
  readonly targets: Anomaly[]=[]; readonly destination=new Vector3(-60,62,110);
  completed=false; private time=0; private eventCooldown=15;
  private coreGeo=new OctahedronGeometry(2.8,0); private ringGeo=new TorusGeometry(5,.08,4,48);
  private coreMat=new MeshStandardMaterial({color:'#302237',emissive:'#b04cff',emissiveIntensity:2,metalness:.7,roughness:.2});
  private ringMat=new MeshBasicMaterial({color:'#ecb8fc'});
  private emberGeo=new IcosahedronGeometry(.7,0);
  constructor(private root:Group,private save:SaveManager,private notify:(message:string)=>void) {
    if(save.data.completed.includes('despertar')) {this.stage=4;this.completed=true;this.title='Além do horizonte';this.objective='Explore Manaus e contenha as anomalias';this.hint='M abre o mapa · Descubra novos lugares';}
  }
  private spawn(center:Vector3,count=3) {
    for(const target of this.targets) this.root.remove(target.model);
    this.targets.length=0;
    for(let i=0;i<count;i++) {
      const model=new Group();const core=new Mesh(this.coreGeo,this.coreMat);model.add(core);
      for(let r=0;r<2;r++){const ring=new Mesh(this.ringGeo,this.ringMat);ring.rotation.set(r*Math.PI/2,.6,0);model.add(ring);}
      for(let r=0;r<3;r++){const ember=new Mesh(this.emberGeo,this.ringMat);ember.position.set(Math.cos(r*2.094)*6,Math.sin(r*2.094)*6,0);model.add(ember);}
      const anchor=center.clone().add(new Vector3((i-1)*25,i*9,(i%2)*35));model.position.copy(anchor);this.root.add(model);
      this.targets.push({id:`anomaly:${this.stage}:${i}:${Math.round(this.time)}`,position:anchor.clone(),anchor,radius:7,kind:'anomaly',active:true,health:2,model,phase:i*2.1});
    }
  }
  hit(id:string,force:number){const t=this.targets.find(t=>t.id===id);if(!t?.active)return false;t.health-=force>=30?2:1;if(t.health<=0){t.active=false;this.notify('Anomalia estabilizada');}return true;}
  update(dt:number,player:Vector3) {
    this.time+=dt;
    for(const target of this.targets){
      if(target.position.distanceToSquared(player)>1500*1500){target.model.visible=false;continue;}
      target.model.visible=target.active||target.model.scale.x>.01;
      if(target.active){target.position.copy(target.anchor);target.position.y+=Math.sin(this.time*1.2+target.phase)*3;target.model.position.copy(target.position);target.model.rotation.y+=dt*.6;target.model.rotation.z=Math.sin(this.time*.7+target.phase)*.25;}
      else target.model.scale.multiplyScalar(Math.exp(-dt*6));
    }
    if(this.stage===0&&player.y>45&&Math.hypot(player.x,player.z)>12){this.stage=1;this.objective='Estabilize as anomalias do centro';this.hint='Mire e clique para emitir energia · Q cria uma onda';this.spawn(new Vector3(-60,62,110));this.notify('Uma fratura se abriu sobre o centro.');}
    if(this.stage===1){const alive=this.targets.filter(t=>t.active);if(alive[0])this.destination.copy(alive[0].position);else{this.stage=2;this.objective='Investigue a perturbação no porto';this.hint='Shift acelera · B ativa voo supersônico';const port=LANDMARKS.find(l=>l.id==='porto');this.destination.set(port?.x??-430,45,(port?.z??800)-80);this.notify('Outro sinal vem do Rio Negro.');}}
    if(this.stage===2&&player.distanceTo(this.destination)<210){this.stage=3;this.objective='Contenha a fratura sobre o Rio Negro';this.hint='T desacelera o mundo · C cria ecos de energia';this.spawn(this.destination);}
    if(this.stage===3){const alive=this.targets.filter(t=>t.active);if(alive[0])this.destination.copy(alive[0].position);else{this.stage=4;this.completed=true;this.save.complete('despertar');this.title='Além do horizonte';this.objective='Explore Manaus e contenha as anomalias';this.hint='M abre o mapa · R reconstrói matéria destruída';this.notify('O DESPERTAR CONCLUÍDO · Manaus está em equilíbrio.');}}
    if(this.stage===4){this.eventCooldown-=dt;const alive=this.targets.filter(t=>t.active);if(alive[0]){this.destination.copy(alive[0].position);this.objective='Estabilize a anomalia local';}else if(this.eventCooldown<0){const landmark=LANDMARKS.find(l=>l.id!=='teatro'&&Math.hypot(l.x-player.x,l.z-player.z)<300);if(landmark){this.spawn(new Vector3(landmark.x+65,60,landmark.z+80),3);this.notify(`Nova atividade · ${landmark.shortName}`);}this.eventCooldown=40;}}
  }
  get remaining(){return this.targets.filter(t=>t.active).length;}
}
