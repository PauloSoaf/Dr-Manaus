import { CameraHelper, Group, Mesh, Vector3 } from 'three/webgpu';
import { WORLD, QUALITY } from '../core/config';
import type { Collider } from '../core/types';
import { SaveManager, type Settings } from '../core/SaveManager';
import { AssetManager } from '../core/AssetManager';
import { RendererManager } from '../rendering/RendererManager';
import { Atmosphere } from '../rendering/Atmosphere';
import { WeatherSystem } from '../rendering/WeatherSystem';
import { WaterSystem } from '../rendering/WaterSystem';
import { QualityManager } from '../rendering/QualityManager';
import { WorldStreamer } from '../world/streaming/WorldStreamer';
import { HLODManager } from '../world/lod/HLODManager';
import { LandmarkManager } from '../world/landmarks/LandmarkManager';
import { createTerrain } from '../world/geodata/terrain';
import { LANDMARKS, isLand } from '../world/geodata/geodata';
import { InputController } from '../player/InputController';
import { PlayerController } from '../player/PlayerController';
import { CameraController } from '../player/CameraController';
import { PowerSystem } from '../player/powers/PowerSystem';
import { PopulationManager } from '../entities/PopulationManager';
import { MissionManager } from '../missions/MissionManager';
import { AudioManager } from '../audio/AudioManager';
import { HUD } from '../ui/HUD';
export interface FrameSample { fps:number; cpu:number; drawCalls:number; triangles:number; geometries:number; textures:number; active:number; cached:number; queued:number; loadedMB:number; streamMs:number; x:number; z:number }
export class Game {
  readonly save=new SaveManager();readonly assets=new AssetManager();readonly rendering:RendererManager;
  readonly worldRoot=new Group();readonly origin=new Vector3();readonly player:PlayerController;readonly input:InputController;readonly camera:CameraController;
  readonly streamer:WorldStreamer;readonly hlod:HLODManager;readonly landmarks:LandmarkManager;readonly atmosphere:Atmosphere;readonly weather:WeatherSystem;readonly water:WaterSystem;
  readonly population:PopulationManager;readonly missions:MissionManager;readonly powers:PowerSystem;readonly audio=new AudioManager();readonly hud:HUD;readonly quality:QualityManager;
  ready=false;frame:FrameSample={fps:0,cpu:0,drawCalls:0,triangles:0,geometries:0,textures:0,active:0,cached:0,queued:0,loadedMB:0,streamMs:0,x:0,z:0};
  stressReport:FrameSample[]=[];private stressRoute:Vector3[]=[];private stressIndex=0;private stressSampleTime=0;
  private lastTime=0;private discoveryTime=0;private telemetryTime=0;private cpu=0;private colliders:Collider[]=[];private playerLocal=new Vector3();private direction=new Vector3();
  private bounds=false;private lod=false;private culling?:CameraHelper;
  constructor(container:HTMLElement){
    this.rendering=new RendererManager(container);this.worldRoot.name='Manaus · global meters';this.rendering.scene.add(this.worldRoot);
    this.atmosphere=new Atmosphere(this.rendering.scene);this.water=new WaterSystem(this.worldRoot);this.weather=new WeatherSystem(this.worldRoot);
    createTerrain(this.worldRoot);this.landmarks=new LandmarkManager(this.worldRoot);
    this.streamer=new WorldStreamer(this.worldRoot);this.hlod=new HLODManager(this.worldRoot);
    this.input=new InputController(this.rendering.renderer.domElement);this.player=new PlayerController(this.worldRoot,this.input);this.camera=new CameraController(this.rendering.camera,this.input);
    this.population=new PopulationManager(this.worldRoot);
    this.missions=new MissionManager(this.worldRoot,this.save,message=>this.hud?.notify(message));
    this.powers=new PowerSystem(this.worldRoot,this.player,this.rendering.camera,this.input,{
      targets:()=>[...this.population.targets,...this.missions.targets],
      hit:(id,force)=>{this.missions.hit(id,force)||this.population.hit(id,force);},
      reconstruct:(position,radius)=>this.population.reconstruct(position,radius),
      impulse:(position,radius,force)=>{this.population.impulse(position,radius,force);this.camera.shake(.45);},
      prepare:destination=>this.streamer.prepare(destination),notify:message=>this.hud.notify(message),sound:name=>this.audio.play(name),getOrigin:()=>this.origin,getColliders:()=>this.colliders,
    });
    this.quality=new QualityManager(this.rendering,level=>this.applyDensity(level));
    this.hud=new HUD(this.save,{power:name=>{void this.audio.unlock();this.powers.use(name);},travel:(id,debug)=>{void this.travel(id,debug);},settings:settings=>this.applySettings(settings),pause:open=>{this.input.enabled=!open;if(open&&document.pointerLockElement)void document.exitPointerLock();},debug:(option,value)=>this.setDebug(option,value),reset:()=>{this.save.reset();location.reload();},stress:()=>this.startStress()});
    this.applySettings(this.save.data.settings);
    this.rendering.renderer.domElement.addEventListener('pointerdown',()=>{void this.audio.unlock();});
    window.addEventListener('keydown',()=>{void this.audio.unlock();},{once:true});
    window.addEventListener('drmanaus-shake',event=>this.camera.shake((event as CustomEvent<number>).detail));
    window.addEventListener('keydown',event=>{if(event.code==='F3'){event.preventDefault();this.hud.toggleDebug();}if(event.code==='KeyM'){event.preventDefault();this.hud.togglePanel('map');}if(event.code==='KeyH'){event.preventDefault();this.hud.togglePanel('help');}if(event.code==='Escape'&&this.hud.panelOpen)this.hud.togglePanel('');});
  }
  async initialize(){
    await this.rendering.initialize();
    await this.streamer.initialize();
    this.hlod.update(this.player.position,this.streamer.activeKeys);
    // The compact offline geographic payload is optional metadata; gameplay makes no map-service calls.
    void this.assets.json('/geodata/manaus.json').catch(()=>undefined);
    this.ready=true;this.hud.ready();this.lastTime=performance.now();
    this.rendering.renderer.setAnimationLoop(this.tick);
  }
  private applyDensity(level:number){
    const config=QUALITY[this.save.data.settings.quality];const factor=1-level*.15;
    this.population.npcCount=Math.round(config.npcs*factor);this.population.vehicleCount=Math.round(config.vehicles*factor);
    this.streamer.setDetailRadius(config.detailRadius*factor);this.hlod.setDetailRadius(config.detailRadius*factor);
    const distance=145*(1-level*.14);Object.assign(this.atmosphere.sun.shadow.camera,{left:-distance,right:distance,top:distance,bottom:-distance});this.atmosphere.sun.shadow.camera.updateProjectionMatrix();
  }
  applySettings(settings:Settings){this.save.data.settings=settings;this.save.save();this.rendering.setQuality(settings.quality);this.atmosphere.time=settings.time;this.atmosphere.weather=settings.weather;this.atmosphere.dayCycle=settings.dayCycle;this.quality.enabled=settings.dynamicResolution;this.quality.reset();this.audio.setEnabled(settings.sound);this.streamer.setNight(settings.time==='Night');this.water.setNight(settings.time==='Night');}
  async travel(id:string,debug=false){const landmark=LANDMARKS.find(l=>l.id===id);if(!landmark)return;if(!debug&&!this.save.data.discovered.includes(id)){this.hud.notify('Descubra esse lugar pelo voo.');return;}this.stressRoute=[];this.camera.skipIntro();await this.powers.teleportTo(new Vector3(landmark.x,landmark.spawnHeight+4,landmark.z));this.hud.notify(landmark.name);}
  private setDebug(option:string,value:boolean|number){
    if(option==='speed'){this.player.speedMultiplier=Number(value);return;}
    if(option==='bounds')this.bounds=Boolean(value);if(option==='lod')this.lod=Boolean(value);
    this.streamer.setDebug(this.bounds,this.lod);
    if(option==='hlod')this.hlod.setDebug(Boolean(value));
    if(option==='wireframe')this.worldRoot.traverse(object=>{if(object instanceof Mesh){const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials)if('wireframe'in material)material.wireframe=Boolean(value);}});
    if(option==='culling'){if(this.culling){this.rendering.scene.remove(this.culling);this.culling.dispose();this.culling=undefined;}if(value){const snapshot=this.rendering.camera.clone();snapshot.far=500;snapshot.updateProjectionMatrix();this.culling=new CameraHelper(snapshot);this.rendering.scene.add(this.culling);}}
  }
  startStress(){
    this.camera.skipIntro();this.player.teleport(new Vector3(0,160,0));this.stressIndex=0;this.stressReport=[];
    this.stressRoute=['arena','ponta','ponte','teatro'].map(id=>{const l=LANDMARKS.find(l=>l.id===id)!;return new Vector3(l.x,160,l.z);});
    this.hud.notify('Rota de stress · Arena → Ponta Negra → Ponte → Centro');
  }
  private updateStress(dt:number){
    const target=this.stressRoute[this.stressIndex];if(!target)return;
    this.direction.copy(target).sub(this.player.position);const distance=this.direction.length();this.direction.normalize();this.player.velocity.copy(this.direction).multiplyScalar(720);
    if(distance<Math.max(30,720*dt)){this.player.position.copy(target);this.stressIndex++;if(this.stressIndex>=this.stressRoute.length){this.stressRoute=[];this.player.velocity.set(0,0,0);this.hud.notify(`Stress concluído · ${this.stressReport.length} amostras registradas`);}}
    else this.player.position.addScaledVector(this.direction,720*dt);
    this.player.state='Flight';this.player.model.position.copy(this.player.position);this.player.character.animate(dt,720,true,true,'');this.camera.yaw=Math.atan2(-this.direction.x,-this.direction.z);
    this.stressSampleTime+=dt;if(this.stressSampleTime>1){this.stressSampleTime=0;this.stressReport.push({...this.frame});}
  }
  private tick=(time:number)=>{
    const start=performance.now(),rawDt=Math.max(.001,(time-this.lastTime)/1000);this.lastTime=time;
    const dt=Math.min(.06,rawDt),worldDt=dt*(this.powers.temporal?.14:1);
    this.colliders.length=0;this.colliders.push(...this.streamer.colliders,...this.landmarks.colliders,...this.population.colliders);
    if(this.stressRoute.length)this.updateStress(dt);else this.player.update(dt,this.colliders,this.camera.yaw);
    // Global doubles stay stable. Every world object receives the same inverse origin transform.
    if(Math.hypot(this.player.position.x-this.origin.x,this.player.position.z-this.origin.z)>WORLD.originThreshold){this.origin.set(Math.round(this.player.position.x/1024)*1024,0,Math.round(this.player.position.z/1024)*1024);this.worldRoot.position.copy(this.origin).negate();}
    this.streamer.update(this.player.position,this.player.velocity,dt);this.hlod.update(this.player.position,this.streamer.activeKeys);
    this.landmarks.update(this.player.position,worldDt);this.population.update(worldDt,this.player.position,this.player.size);this.missions.update(worldDt,this.player.position);
    this.camera.update(this.player,this.origin,dt,this.colliders);this.rendering.camera.updateMatrixWorld();this.powers.update(dt,worldDt);
    this.playerLocal.copy(this.player.position).sub(this.origin);this.atmosphere.update(worldDt,this.playerLocal);const flash=this.weather.update(worldDt,this.player.position,this.atmosphere.weather);if(flash)this.atmosphere.sun.intensity+=flash;
    this.audio.update(this.player.velocity.length(),this.player.position.y,['rain','storm'].includes(this.atmosphere.weather),!isLand(this.player.position.x,this.player.position.z));
    this.discoveryTime+=dt;if(this.discoveryTime>.5){this.discoveryTime=0;for(const landmark of LANDMARKS)if(Math.hypot(landmark.x-this.player.position.x,landmark.z-this.player.position.z)<Math.max(240,landmark.radius)&&this.save.discover(landmark.id)){this.hud.notify(`LUGAR DESCOBERTO · ${landmark.shortName}`);this.audio.play('discovery');}this.streamer.setNight(this.atmosphere.time==='Night');}
    this.rendering.renderer.render(this.rendering.scene,this.rendering.camera);
    this.cpu+=(performance.now()-start-this.cpu)*.08;this.quality.update(rawDt);this.telemetryTime+=dt;
    if(this.telemetryTime>.2){this.telemetryTime=0;this.sample();}
    const frame=this.frame;
    this.hud.update(dt,{position:this.player.position,origin:this.origin,velocity:this.player.velocity,yaw:this.camera.yaw,state:this.player.state,size:this.player.size,selected:this.powers.selected,temporal:this.powers.temporal,title:this.missions.title,objective:this.missions.objective,hint:this.missions.hint,destination:this.missions.destination,remaining:this.missions.remaining,stage:this.missions.stage,time:this.atmosphere.clock,weather:this.atmosphere.weather,fps:frame.fps,backend:this.rendering.backend,debug:{'Renderer':this.rendering.backend,'FPS':frame.fps,'Frame (ms)':this.quality.averageMs.toFixed(1),'CPU (ms)':this.cpu.toFixed(1),'GPU (ms)':'indisponível','Draw calls':frame.drawCalls,'Triângulos':frame.triangles.toLocaleString(),'Geometrias / texturas':`${frame.geometries} / ${frame.textures}`,'Chunks ativos / cache':`${frame.active} / ${frame.cached}`,'Fila de streaming':frame.queued,'Streaming (ms)':frame.streamMs.toFixed(2),'Memória estimada (MB)':frame.loadedMB.toFixed(1),'HLOD instâncias':this.hlod.nodeCount,'NPCs / veículos':`${this.population.npcCount} / ${this.population.vehicleCount}`,'Global XYZ':`${this.player.position.x.toFixed(0)} ${this.player.position.y.toFixed(0)} ${this.player.position.z.toFixed(0)}`,'Local XYZ':`${this.playerLocal.x.toFixed(0)} ${this.playerLocal.y.toFixed(0)} ${this.playerLocal.z.toFixed(0)}`,'Qualidade / resolução':`${this.rendering.preset} / ${Math.round(this.rendering.renderScale*100)}%`}},this.rendering.camera);
    this.input.endFrame();
  };
  private sample(){const info=this.rendering.renderer.info,stats=this.streamer.stats;this.frame={fps:Math.round(1000/this.quality.averageMs),cpu:Number(this.cpu.toFixed(2)),drawCalls:info.render.drawCalls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,active:stats.active,cached:stats.cached,queued:stats.queued,loadedMB:stats.loadedMB+info.memory.total/1048576,streamMs:stats.streamMs,x:this.player.position.x,z:this.player.position.z};}
}
