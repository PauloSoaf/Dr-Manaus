import { Bone, Group, Mesh, MeshBasicMaterial, Skeleton, SkinnedMesh, Vector3, type PerspectiveCamera } from 'three/webgpu';
import { createCharacterGeometry, HUMAN_RIG } from './CharacterGeometry';
import { CosmicAura } from './cosmic/CosmicAura';
import { CosmicTrail } from './cosmic/CosmicTrail';
import { CosmicMaterial, type CosmicLevel } from './cosmic/CosmicMaterial';
import { CosmicVideoSource } from './cosmic/CosmicVideoSource';
import { Locomotion } from './animations/Locomotion';
import { Quaternion } from 'three/webgpu';
import { PARADE_REST } from './animations/ParadeRest';
export type { CosmicLevel };

export class CharacterModel {
  readonly group = new Group();
  readonly body = new Bone();
  readonly leftArm = new Bone(); readonly rightArm = new Bone();
  readonly leftLeg = new Bone(); readonly rightLeg = new Bone();
  readonly leftForearm = new Bone(); readonly rightForearm = new Bone();
  readonly leftShin = new Bone(); readonly rightShin = new Bone();
  readonly leftHand = new Bone(); readonly rightHand = new Bone();
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
  private readonly locomotion = new Locomotion();
  private lastPose = ''; private posePhase = 0;
  private wasFlying = false; private flightTime = 0;
  private readonly flightArms = [this.leftArm, this.rightArm, this.leftForearm, this.rightForearm];
  private readonly previousArms = PARADE_REST.map(() => new Quaternion());
  private readonly armTarget = new Quaternion();

  constructor(echo=false){
    this.group.name=echo?'cosmic-echo':'DR Manaus · portal silhouette';
    if(!echo){this.cosmicSource=new CosmicVideoSource();this.cosmicMaterial=new CosmicMaterial({source:this.cosmicSource});}
    else this.echoMaterial=new MeshBasicMaterial({color:'#3f9b96',transparent:true,opacity:.66,toneMapped:false});
    const geometry=createCharacterGeometry();
    this.surface=new SkinnedMesh(geometry.skin,this.cosmicMaterial?.material??this.echoMaterial!);
    this.surface.name='cosmic-silhouette';this.surface.castShadow=!echo;this.surface.frustumCulled=false;
    this.group.add(this.surface,this.body);
    this.leftArm.position.set(-HUMAN_RIG.shoulderX,HUMAN_RIG.shoulderY,0);this.rightArm.position.set(HUMAN_RIG.shoulderX,HUMAN_RIG.shoulderY,0);
    this.leftLeg.position.set(-HUMAN_RIG.hipX,HUMAN_RIG.hipY,0);this.rightLeg.position.set(HUMAN_RIG.hipX,HUMAN_RIG.hipY,0);
    this.body.add(this.leftArm,this.rightArm,this.leftLeg,this.rightLeg);
    for(const [arm,forearm,hand,side] of [[this.leftArm,this.leftForearm,this.leftHand,-1],[this.rightArm,this.rightForearm,this.rightHand,1]] as const){
      forearm.position.set(side*.03,HUMAN_RIG.elbowY-HUMAN_RIG.shoulderY,-.007);arm.add(forearm);
      hand.position.set(side*.01,HUMAN_RIG.wristY-HUMAN_RIG.elbowY,-.009);forearm.add(hand);
    }
    for(const [leg,shin] of [[this.leftLeg,this.leftShin],[this.rightLeg,this.rightShin]]){shin.position.set(0,HUMAN_RIG.kneeY-HUMAN_RIG.hipY,-.016);leg.add(shin);}
    this.group.updateMatrixWorld(true);
    this.skeleton=new Skeleton([this.body,this.leftArm,this.rightArm,this.leftLeg,this.rightLeg,this.leftForearm,this.rightForearm,this.leftShin,this.rightShin,this.leftHand,this.rightHand]);
    this.surface.bind(this.skeleton);
    this.accents=new Mesh(geometry.accents,this.accentMaterial);this.accents.name='cosmic-eyes-and-sigil';this.body.add(this.accents);
    if(!echo){this.aura=new CosmicAura(this.group);this.trail=new CosmicTrail(this.group);}
  }
  get cosmicEnabled(){return this.enabled;}
  set cosmicEnabled(enabled:boolean){this.enabled=enabled;if(this.cosmicMaterial)this.cosmicMaterial.enabled=enabled;this.cosmicSource?.setEnabled(enabled);}
  updateCosmicView(camera:PerspectiveCamera){this.cosmicMaterial?.updateView(camera);}
  get cosmicDiagnostics(){return {...this.cosmicSource?.diagnostics,...this.cosmicMaterial?.metrics,bodyDraws:2};}
  setCosmicLevel(level:CosmicLevel,speed:number,forward?:Vector3){this.level=level;this.levelSpeed=Number.isFinite(speed)?Math.max(0,speed):0;if(forward&&forward.lengthSq()>1e-6)this.facing.copy(forward);}

  aimEnergy(direction:Vector3):void{
    this.body.rotation.x=0;
    this.rightArm.rotation.set(Math.PI/2+Math.asin(Math.max(-1,Math.min(1,direction.y))),0,0);
    this.rightForearm.rotation.set(0,0,0);this.rightHand.rotation.set(0,0,0);
    this.group.updateWorldMatrix(true,true);
  }

  animate(dt:number,speed:number,flying:boolean,boost:boolean,pose:string,verticalSpeed=0,turn=0){
    dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;this.phase+=dt;
    const stride=flying?0:Math.min(1,speed/5),swing=Math.sin(this.phase*(speed>8?12:8))*stride*.62,smooth=1-Math.exp(-dt*10);
    if (pose !== this.lastPose) { this.lastPose = pose; this.posePhase = 0; }
    this.posePhase += dt;
    if (flying !== this.wasFlying) { this.flightTime = 0; this.wasFlying = flying; }
    this.flightTime += dt;
    for (let i = 0; i < 4; i++) this.previousArms[i].copy(this.flightArms[i].quaternion);
    for (const bone of this.skeleton.bones) { bone.rotation.y *= 1 - smooth; bone.rotation.z *= 1 - smooth; }
    if (!flying || pose) this.body.rotation.x+=((flying&&pose!=='energy'?(boost?-1.13:-.18):0)-this.body.rotation.x)*smooth;
    this.body.position.y=flying?Math.sin(this.phase*2)*.055:Math.abs(Math.sin(this.phase*8))*stride*.025;
    if (!flying || pose) {
      this.leftLeg.rotation.x+=((flying?0:swing)-this.leftLeg.rotation.x)*smooth;
      this.rightLeg.rotation.x+=((flying?0:-swing)-this.rightLeg.rotation.x)*smooth;
    }
    let left=flying?-.12:-swing,right=flying?-.12:swing;
    if(pose==='energy')right=Math.PI/2;
    if(['shockwave','reconstruct','teleport'].includes(pose)){left=1.25;right=1.25;}
    if (!flying || pose) { this.leftArm.rotation.x+=(left-this.leftArm.rotation.x)*smooth;this.rightArm.rotation.x+=(right-this.rightArm.rotation.x)*smooth; }
    this.leftArm.rotation.z=flying||pose==='giant'?.23:.07;this.rightArm.rotation.z=flying||pose==='giant'?-.23:-.07;
    const bend=(bone:Bone,target:number)=>{bone.rotation.x+=(target-bone.rotation.x)*smooth;};
    if (!flying || pose) {
      bend(this.leftForearm,flying?-.25:-.12-Math.max(0,swing)*.5);
      bend(this.rightForearm,pose==='energy'?-.07:flying?-.25:-.12-Math.max(0,-swing)*.5);
      bend(this.leftShin,flying?-.025:Math.max(0,-swing)*1.05);
      bend(this.rightShin,flying?-.025:Math.max(0,swing)*1.05);
    }
    this.leftHand.rotation.x=-.035;this.rightHand.rotation.x=pose==='energy'?-.12:-.035;
    if (flying && !pose) {
      const moving = Math.min(1, speed / 120), takeoff = Math.max(0, 1 - this.flightTime / .5);
      const accelerating = Math.max(0, Math.min(1, (speed - 160) / 280));
      const climb = Math.max(-1, Math.min(1, verticalSpeed / 100));
      const sway = Math.sin(this.phase * 1.6);
      this.body.rotation.x += ((boost ? -1.4 : moving * (-.72 - accelerating * .48 + climb * .12)) - this.body.rotation.x) * smooth;
      this.body.rotation.z += (Math.max(-.3, Math.min(.3, -turn)) * moving - this.body.rotation.z) * smooth;
      this.body.position.y = sway * .025 + takeoff * .025;
      // At ease: straight legs, relaxed shoulders, hands behind the hips.
      // Cruise keeps the arms trailing; acceleration extends one arm, boost both.
      const restingArm = -.22 + moving * .1;
      this.leftArm.rotation.x = boost ? 2.9 : restingArm;
      this.rightArm.rotation.x = boost ? 2.9 : restingArm + accelerating * 2.92;
      this.leftArm.rotation.z = boost ? .06 : -.035;
      this.rightArm.rotation.z = -this.leftArm.rotation.z;
      this.leftForearm.rotation.x = boost ? -.08 : -.24 * (1 - moving) - .04;
      this.rightForearm.rotation.x = boost ? -.08 : (-.24 * (1 - moving) - .04) * (1 - accelerating);
      this.leftForearm.rotation.z = boost ? 0 : .22 * (1 - moving);
      this.rightForearm.rotation.z = -this.leftForearm.rotation.z;
      for (let i = 0; i < 4; i++) {
        this.armTarget.copy(this.flightArms[i].quaternion).slerp(PARADE_REST[i], boost ? 0 : (1 - moving) ** 2);
        this.flightArms[i].quaternion.copy(this.previousArms[i]).slerp(this.armTarget, smooth);
      }
      bend(this.leftLeg, boost ? .12 : 0);
      bend(this.rightLeg, boost ? -.1 : 0);
      this.leftLeg.rotation.z = -.10 * (1 - moving);
      this.rightLeg.rotation.z = -this.leftLeg.rotation.z;
      // Negative X bends a downward bone BACK, away from the character's -Z front.
      bend(this.leftShin, boost ? -.15 : -.025);
      bend(this.rightShin, boost ? -.12 : -.025);
    }
    this.locomotion.apply(this.skeleton.bones, dt, speed, flying, pose);
    if (pose.startsWith('kick')) {
      const extension = Math.sin(Math.min(1, this.posePhase / .55) * Math.PI);
      this.rightLeg.rotation.x = extension * 1.65;
      this.rightShin.rotation.x = .2 * (1 - extension);
      this.body.rotation.x = -extension * .2;
      this.leftArm.rotation.x = .65; this.rightArm.rotation.x = .65;
      if (pose === 'kickSide') {
        this.body.rotation.y = extension * Math.PI / 2;
        this.rightLeg.rotation.set(.12, 0, extension * 1.65);
        this.leftArm.rotation.x = 1.1;
      } else if (pose === 'kickRound') {
        this.body.rotation.y = Math.sin(Math.min(1, this.posePhase / .55) * Math.PI * 2) * 1.2;
        this.rightLeg.rotation.z = extension * .9;
        this.leftArm.rotation.z = .8 * extension;
      }
    }
    if (pose === 'punchUpper') {
      const extension = Math.sin(Math.min(1, this.posePhase / .42) * Math.PI);
      this.body.rotation.y = -.35 * extension; this.body.rotation.x = -.12 * extension;
      this.rightArm.rotation.set(extension * 2.1, 0, -.15);
      this.rightForearm.rotation.x = .65 * extension;
      this.leftArm.rotation.x = .9; this.leftForearm.rotation.x = .65;
      this.leftShin.rotation.x = .2 * extension; this.rightShin.rotation.x = .25 * extension;
    }
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
