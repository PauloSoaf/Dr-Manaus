import { Bone, Group, Mesh, MeshBasicMaterial, Skeleton, SkinnedMesh, Vector3, type PerspectiveCamera } from 'three/webgpu';
import { createCharacterGeometry } from './CharacterGeometry';
import { CosmicAura } from './cosmic/CosmicAura';
import { CosmicTrail } from './cosmic/CosmicTrail';
import { CosmicMaterial, type CosmicLevel } from './cosmic/CosmicMaterial';
import { CosmicVideoSource } from './cosmic/CosmicVideoSource';
export type { CosmicLevel };

export class CharacterModel {
  readonly group = new Group();
  readonly body = new Bone();
  readonly leftArm = new Bone(); readonly rightArm = new Bone();
  readonly leftLeg = new Bone(); readonly rightLeg = new Bone();
  readonly cosmicSource?: CosmicVideoSource;
  readonly cosmicMaterial?: CosmicMaterial;
  readonly surface: SkinnedMesh;
  private readonly skeleton: Skeleton;
  private readonly accents: Mesh;
  private readonly accentMaterial=new MeshBasicMaterial({vertexColors:true,toneMapped:false});
  private readonly echoMaterial?:MeshBasicMaterial;
  private readonly aura?:CosmicAura;private readonly trail?:CosmicTrail;
  private phase=0;private facing=new Vector3(0,0,-1);private level:CosmicLevel|null=null;private levelSpeed=0;
  private enabled=true;private disposed=false;

  constructor(echo=false){
    this.group.name=echo?'cosmic-echo':'DR Manaus · portal silhouette';
    if(!echo){this.cosmicSource=new CosmicVideoSource();this.cosmicMaterial=new CosmicMaterial({source:this.cosmicSource});}
    else this.echoMaterial=new MeshBasicMaterial({color:'#3f9b96',transparent:true,opacity:.66,toneMapped:false});
    const geometry=createCharacterGeometry();
    this.surface=new SkinnedMesh(geometry.skin,this.cosmicMaterial?.material??this.echoMaterial!);
    this.surface.name='cosmic-silhouette';this.surface.castShadow=!echo;this.surface.frustumCulled=false;
    this.group.add(this.surface,this.body);
    this.leftArm.position.set(-.36,1.46,0);this.rightArm.position.set(.36,1.46,0);
    this.leftLeg.position.set(-.137,.96,0);this.rightLeg.position.set(.137,.96,0);
    this.body.add(this.leftArm,this.rightArm,this.leftLeg,this.rightLeg);
    this.group.updateMatrixWorld(true);
    this.skeleton=new Skeleton([this.body,this.leftArm,this.rightArm,this.leftLeg,this.rightLeg]);
    this.surface.bind(this.skeleton);
    this.accents=new Mesh(geometry.accents,this.accentMaterial);this.accents.name='cosmic-eyes-and-sigil';this.body.add(this.accents);
    if(!echo){this.aura=new CosmicAura(this.group);this.trail=new CosmicTrail(this.group);}
  }
  get cosmicEnabled(){return this.enabled;}
  set cosmicEnabled(enabled:boolean){this.enabled=enabled;if(this.cosmicMaterial)this.cosmicMaterial.enabled=enabled;this.cosmicSource?.setEnabled(enabled);}
  updateCosmicView(camera:PerspectiveCamera){this.cosmicMaterial?.updateView(camera);}
  get cosmicDiagnostics(){return {...this.cosmicSource?.diagnostics,...this.cosmicMaterial?.metrics,bodyDraws:2};}
  setCosmicLevel(level:CosmicLevel,speed:number,forward?:Vector3){this.level=level;this.levelSpeed=Number.isFinite(speed)?Math.max(0,speed):0;if(forward&&forward.lengthSq()>1e-6)this.facing.copy(forward);}

  animate(dt:number,speed:number,flying:boolean,boost:boolean,pose:string){
    dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;this.phase+=dt;
    const stride=flying?0:Math.min(1,speed/5),swing=Math.sin(this.phase*(speed>8?12:8))*stride*.62,smooth=1-Math.exp(-dt*10);
    this.body.rotation.x+=((flying?(boost?-1.13:-.18):0)-this.body.rotation.x)*smooth;
    this.body.position.y=flying?Math.sin(this.phase*2)*.055:Math.abs(Math.sin(this.phase*8))*stride*.025;
    this.leftLeg.rotation.x+=((flying?.13:swing)-this.leftLeg.rotation.x)*smooth;
    this.rightLeg.rotation.x+=((flying?-.09:-swing)-this.rightLeg.rotation.x)*smooth;
    let left=flying?-.12:-swing,right=flying?-.12:swing;
    if(pose==='energy')right=-1.6;
    if(['shockwave','reconstruct','teleport'].includes(pose)){left=-1.25;right=-1.25;}
    this.leftArm.rotation.x+=(left-this.leftArm.rotation.x)*smooth;this.rightArm.rotation.x+=(right-this.rightArm.rotation.x)*smooth;
    this.leftArm.rotation.z=flying||pose==='giant'?.23:.07;this.rightArm.rotation.z=flying||pose==='giant'?-.23:-.07;
    const level:CosmicLevel=pose?'power':this.level??(boost?'boost':flying?'flight':'idle'),pace=this.level?this.levelSpeed:speed;
    this.cosmicSource?.update(dt);this.cosmicSource?.setPlaybackRate(flying?1.1:1);
    this.cosmicMaterial?.update(dt,level,pace);
    const glow=1+(level==='mega'?.65:level==='power'?.3:0);this.accentMaterial.color.setRGB(glow,glow,glow);
    this.aura?.update(dt,this.enabled?level:'idle',this.enabled?pace:0,this.facing);
    this.trail?.update(dt,this.enabled?level:'idle',this.enabled?pace:0,this.facing);
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.aura?.dispose();this.trail?.dispose();this.cosmicMaterial?.dispose();this.cosmicSource?.dispose();
    this.surface.geometry.dispose();this.accents.geometry.dispose();this.skeleton.dispose();this.accentMaterial.dispose();this.echoMaterial?.dispose();this.group.removeFromParent();
  }
}
