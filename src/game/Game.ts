import { ForestBackdrop } from '../world/ForestBackdrop';
import { CameraHelper, Group, Mesh, Vector3 } from 'three/webgpu';
import { WORLD, QUALITY } from '../core/config';
import type { Collider } from '../core/types';
import { SaveManager, type Settings } from '../core/SaveManager';
import { AssetManager } from '../core/AssetManager';
import { RendererManager } from '../rendering/RendererManager';
import { Atmosphere } from '../rendering/Atmosphere';
import { SpaceLayer } from '../rendering/SpaceLayer';
import { SpeedVFX, type SpeedState } from '../rendering/SpeedVFX';
import { WeatherSystem } from '../rendering/WeatherSystem';
import { WaterSystem } from '../rendering/WaterSystem';
import { QualityManager } from '../rendering/QualityManager';
import { WorldStreamer } from '../world/streaming/WorldStreamer';
import { HLODManager } from '../world/lod/HLODManager';
import { RealCityLayer } from '../world/realcity/RealCityLayer';
import { LandmarkManager } from '../world/landmarks/LandmarkManager';
import { createTerrain } from '../world/geodata/terrain';
import { GeoDebug } from '../world/geodata/GeoDebug';
import { LargoDistrict } from '../world/landmarks/largo';
import { createAirport } from '../world/realcity/airport';
import { LANDMARKS, isLand } from '../world/geodata/geodata';
import { InputController } from '../player/InputController';
import { PlayerController } from '../player/PlayerController';
import { CameraController } from '../player/CameraController';
import { PowerSystem } from '../player/powers/PowerSystem';
import type { CosmicLevel } from '../player/CharacterModel';
import { TerrainDestruction } from '../world/destruction/TerrainDestruction';
import { AuthoredDestruction } from '../world/destruction/AuthoredDestruction';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { DestructionSystem } from '../world/destruction/DestructionSystem';
import { TrafficSystem } from '../world/traffic/TrafficSystem';
import { PopulationManager } from '../entities/PopulationManager';
import { MissionManager } from '../missions/MissionManager';
import { AudioManager } from '../audio/AudioManager';
import { HUD } from '../ui/HUD';
export interface FrameSample { fps:number; cpu:number; drawCalls:number; triangles:number; geometries:number; textures:number; active:number; cached:number; queued:number; loadedMB:number; streamMs:number; x:number; z:number }
export class Game {
  readonly save=new SaveManager();readonly assets=new AssetManager();readonly rendering:RendererManager;
  readonly worldRoot=new Group();readonly origin=new Vector3();readonly player:PlayerController;readonly input:InputController;readonly camera:CameraController;
  readonly streamer:WorldStreamer;readonly hlod:HLODManager;readonly realCity:RealCityLayer;readonly landmarks:LandmarkManager;readonly geoDebug:GeoDebug;readonly largo:LargoDistrict;readonly atmosphere:Atmosphere;readonly space:SpaceLayer;readonly speedVfx:SpeedVFX;readonly weather:WeatherSystem;readonly water:WaterSystem;
  readonly population:PopulationManager;readonly missions:MissionManager;readonly powers:PowerSystem;readonly destruction:DestructionSystem;traffic?:TrafficSystem;readonly audio=new AudioManager();readonly hud:HUD;readonly quality:QualityManager;
  readonly forest:ForestBackdrop;readonly terrain:TerrainDestruction;readonly airport=new AuthoredDestruction();
  ready=false;frame:FrameSample={fps:0,cpu:0,drawCalls:0,triangles:0,geometries:0,textures:0,active:0,cached:0,queued:0,loadedMB:0,streamMs:0,x:0,z:0};
  stressReport:FrameSample[]=[];private stressRoute:Vector3[]=[];private stressIndex=0;private stressSampleTime=0;
  private lastTime=0;private discoveryTime=0;private telemetryTime=0;private cpu=0;private colliders:Collider[]=[];private playerLocal=new Vector3();private direction=new Vector3();
  private stompTimer=0;private readonly foot=new Vector3();
  private bounds=false;private lod=false;private culling?:CameraHelper;private spaceFactor=0;
  /** Exponentially smoothed per-system frame cost, in milliseconds. Drives the F3 panel. */
  readonly profile:Record<string,number>={realCity:0,colliders:0,player:0,streamer:0,hlod:0,landmarks:0,population:0,destruction:0,traffic:0,render:0};
  private mark=0;private lastSpeed=0;private district='AMAZONAS';
  constructor(container:HTMLElement){
    this.rendering=new RendererManager(container);this.worldRoot.name='Manaus · global meters';this.rendering.scene.add(this.worldRoot);
    this.atmosphere=new Atmosphere(this.rendering.scene);this.space=new SpaceLayer(this.rendering.scene,this.rendering.camera);this.speedVfx=new SpeedVFX(this.rendering.scene);this.water=new WaterSystem(this.worldRoot);this.weather=new WeatherSystem(this.worldRoot);
    this.terrain=new TerrainDestruction(this.worldRoot);PhysicsWorld.setTerrain(this.terrain);
    createTerrain(this.worldRoot);this.worldRoot.add(createAirport(this.airport));this.geoDebug=new GeoDebug(this.worldRoot);this.largo=new LargoDistrict(this.worldRoot);this.landmarks=new LandmarkManager(this.worldRoot);
    this.streamer=new WorldStreamer(this.worldRoot);this.hlod=new HLODManager(this.worldRoot);this.realCity=new RealCityLayer(this.worldRoot);this.hlod.setDestructionSource(this.streamer);
    this.streamer.setReplacesChunk((cx, cz) => this.realCity.coversChunk(cx, cz));
    this.watchGround(this.worldRoot);this.forest=new ForestBackdrop(this.worldRoot);
    this.input=new InputController(this.rendering.renderer.domElement);this.player=new PlayerController(this.worldRoot,this.input);this.camera=new CameraController(this.rendering.camera,this.input);
    this.population=new PopulationManager(this.worldRoot);
    this.missions=new MissionManager(this.worldRoot,this.save,message=>this.hud?.notify(message));
    this.destruction=new DestructionSystem(this.worldRoot,this.destructible);
    this.player.beforeMove=(position,velocity,dt)=>{this.destruction.plough(position,velocity,dt,true);this.gatherColliders();return this.colliders;};
    this.powers=new PowerSystem(this.worldRoot,this.player,this.rendering.camera,this.input,{
      targets:()=>[...this.population.targets,...this.missions.targets],
      hit:(id,force)=>{this.missions.hit(id,force)||this.population.hit(id,force);},
      reconstruct:(position,radius)=>this.population.reconstruct(position,radius)+this.realCity.restore(position,radius)+this.streamer.restore(position,radius)+this.landmarks.restore(position,radius)+this.largo.restore(position,radius)+this.airport.restore(position,radius)+this.terrain.restoreAt(position,radius),
      impulse:(position,radius,force)=>{this.population.impulse(position,radius,force);this.camera.shake(.45);},
      damage:(point,radius,amount,deform)=>this.destruction.damageAt(point,radius,amount,deform),prepare:destination=>this.streamer.prepare(destination),notify:message=>this.hud.notify(message),sound:name=>this.audio.play(name),getOrigin:()=>this.origin,getColliders:()=>this.colliders,getAttackColliders:(point,radius)=>this.attackColliders(point,radius),
    });
    this.quality=new QualityManager(this.rendering,level=>this.applyDensity(level));
    this.hud=new HUD(this.save,{power:name=>{void this.audio.unlock();this.powers.use(name);},travel:(id,debug)=>{void this.travel(id,debug);},settings:settings=>this.applySettings(settings),pause:open=>{this.input.enabled=!open;if(open&&document.pointerLockElement)void document.exitPointerLock();},debug:(option,value)=>this.setDebug(option,value),reset:()=>{this.save.reset();location.reload();},stress:()=>this.startStress()});
    this.applySettings(this.save.data.settings);
    this.rendering.renderer.domElement.addEventListener('pointerdown',()=>{void this.audio.unlock();});
    window.addEventListener('keydown',()=>{void this.audio.unlock();},{once:true});
    window.addEventListener('drmanaus-shake',event=>this.camera.shake((event as CustomEvent<number>).detail));
    window.addEventListener('keydown',event=>{if(event.code==='F3'){event.preventDefault();this.hud.toggleDebug();}if(event.code==='KeyM'){event.preventDefault();this.hud.togglePanel('map');}if(event.code==='KeyH'){event.preventDefault();this.hud.openPause('controls');}if(event.code==='Escape'){event.preventDefault();this.hud.togglePause();}});
  }
  async initialize(){
    await this.rendering.initialize();
    await Promise.all([this.player.character.initializeAnimations(), this.powers.initializeCharacters()]);
    await this.streamer.initialize();
    await this.realCity.initialize();
    if(this.realCity.active){
      this.streamer.setReplacesChunk((cx, cz) => this.realCity.coversChunk(cx, cz));
      this.realCity.syncProceduralVisibility();
    }
    // Awaited during the loading screen: triangulating the real river costs about a second, and
    // that hitch belongs before the first frame rather than in the middle of play.
    await this.water.initialize();
    // Traffic only exists where the compiled network does, so it is built after the city loads.
    if(this.realCity.roads_graph.size>0){
      this.traffic=new TrafficSystem(this.worldRoot,this.realCity.roads_graph);
      this.traffic.setCount(QUALITY[this.save.data.settings.quality].vehicles*2);
      // The old free-roaming vehicles drove through buildings and across the plaza; the road
      // graph replaces them entirely rather than running both.
      this.population.vehicleCount=0;
    }
    this.realCity.update(this.player.position,this.player.velocity,1);
    // Only once the compiled block masses can cover the horizon does the procedural city stand down.
    if(this.realCity.hasSkyline)this.hlod.setRealCoverage(this.realCity.coveredTiles,this.realCity.tileSize);
    this.realCity.setNight(this.save.data.settings.time==='Night');
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
    // Window panes and balconies are the first thing to go when the frame budget slips.
    this.realCity.setDetail(config.shadows&&level<2);
    const distance=145*(1-level*.14);Object.assign(this.atmosphere.sun.shadow.camera,{left:-distance,right:distance,top:distance,bottom:-distance});this.atmosphere.sun.shadow.camera.updateProjectionMatrix();
  }
  applySettings(settings:Settings){this.save.data.settings=settings;this.save.save();this.rendering.setQuality(settings.quality);
    this.rendering.setShadows(settings.shadows);this.camera.baseFov=settings.fov;this.camera.sensitivity=settings.sensitivity;this.camera.invertY=settings.invertY;
    this.audio.setVolumes(settings.masterVolume,settings.ambienceVolume,settings.effectsVolume);this.atmosphere.time=settings.time;this.atmosphere.weather=settings.weather;this.atmosphere.dayCycle=settings.dayCycle;this.quality.enabled=settings.dynamicResolution;this.quality.reset();this.audio.setEnabled(settings.sound);this.destruction.setQuality(QUALITY[settings.quality].particles);this.streamer.setNight(settings.time==='Night');this.water.setNight(settings.time==='Night');this.realCity.setNight(settings.time==='Night');this.realCity.setDetail(settings.quality!=='Low');}
  async travel(id:string,debug=false){const landmark=LANDMARKS.find(l=>l.id===id);if(!landmark)return;if(!debug&&!this.save.data.discovered.includes(id)){this.hud.notify('Descubra esse lugar pelo voo.');return;}this.stressRoute=[];this.camera.skipIntro();await this.powers.teleportTo(new Vector3(landmark.x,landmark.spawnHeight+4,landmark.z));this.hud.notify(landmark.name);}
  private setDebug(option:string,value:boolean|number){
    if(option==='speed'){this.player.speedMultiplier=Number(value);return;}
    if(option==='bounds')this.bounds=Boolean(value);if(option==='lod')this.lod=Boolean(value);
    this.streamer.setDebug(this.bounds,this.lod);
    if(option==='hlod')this.hlod.setDebug(Boolean(value));
    if(option==='geo')this.geoDebug.setEnabled(Boolean(value));
    if(option==='roads')this.traffic?.setDebugColours(Boolean(value));
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
  /** Smoothed so one slow frame does not dominate the readout, and cheap enough to always run. */
  private lap(key:string){const now=performance.now();this.profile[key]+=(now-this.mark-this.profile[key])*.1;this.mark=now;}
  private tick=(time:number)=>{
    const start=performance.now(),rawDt=Math.max(.001,(time-this.lastTime)/1000);this.lastTime=time;
    const dt=Math.min(.06,rawDt),worldDt=dt*(this.powers.temporal?.14:1);
    this.mark=performance.now();
    this.realCity.update(this.player.position,this.player.velocity,dt);this.lap('realCity');
    this.gatherColliders();this.lap('colliders');
    this.updateStomps(dt);
    if(this.stressRoute.length)this.updateStress(dt);else this.player.update(dt,this.colliders,this.camera.yaw,this.camera.pitch);this.lap('player');
    // Global doubles stay stable. Every world object receives the same inverse origin transform.
    if(Math.hypot(this.player.position.x-this.origin.x,this.player.position.z-this.origin.z)>WORLD.originThreshold){this.origin.set(Math.round(this.player.position.x/1024)*1024,0,Math.round(this.player.position.z/1024)*1024);this.worldRoot.position.copy(this.origin).negate();}
    this.streamer.update(this.player.position,this.player.velocity,dt);this.lap('streamer');this.hlod.update(this.player.position,this.streamer.activeKeys);this.lap('hlod');
    // Real dt, never worldDt: the high-speed ram must match the distance actually flown.
    this.destruction.update(dt,this.player.position,this.player.velocity,this.player.state==='Grounded');this.lap('destruction');
    this.traffic?.update(worldDt,this.player.position);this.lap('traffic');
    // Actors are suppressed as the world starts to blur past: simulating NPCs kilometres behind
    // the player costs the same as simulating them in front, and none of it can be seen.
    this.suppressActors();
    const speedNow=this.player.velocity.length();
    this.speedVfx.update(dt,this.speedState(),speedNow);
    // The field of view opens with the effect, and the shake follows ACCELERATION rather than
    // speed, so holding a steady 8 000 m/s is smooth while entering it is not.
    this.camera.speedFov=this.speedVfx.fovBoost;
    const shake=this.speedVfx.shakeFor((speedNow-this.lastSpeed)/Math.max(dt,.001));
    if(shake>.004)this.camera.shake(shake);
    this.lastSpeed=speedNow;
    this.largo.update(this.player.position,worldDt);
    this.landmarks.update(this.player.position,worldDt);this.lap('landmarks');this.population.update(worldDt,this.player.position,this.player.size);this.lap('population');this.missions.update(worldDt,this.player.position);
    this.camera.update(this.player,this.origin,dt,this.colliders);this.rendering.camera.updateMatrixWorld();
    // After the camera settles: the portal skin samples in screen space, so a stale matrix would
    // stretch the galaxy by the viewport and leave it static as the player looks around.
    this.player.character.updateCosmicView(this.rendering.camera);
    this.player.character.setCosmicLevel(this.cosmicLevel(),this.player.velocity.length(),this.direction);this.powers.update(dt,worldDt);
    this.playerLocal.copy(this.player.position).sub(this.origin);this.atmosphere.setAltitude(this.player.position.y);this.atmosphere.update(worldDt,this.playerLocal);this.space.update(this.player.position.y,this.atmosphere.sunDirection,this.atmosphere.time==='Night',worldDt,this.atmosphere.weather==='clear'?0:1);this.spaceFactor=this.space.spaceFactor;const flash=this.weather.update(worldDt,this.player.position,this.atmosphere.weather);if(flash)this.atmosphere.sun.intensity+=flash;
    this.audio.update(this.player.velocity.length(),this.player.position.y,['rain','storm'].includes(this.atmosphere.weather),!isLand(this.player.position.x,this.player.position.z));
    this.discoveryTime+=dt;if(this.discoveryTime>.5){this.discoveryTime=0;for(const landmark of LANDMARKS)if(Math.hypot(landmark.x-this.player.position.x,landmark.z-this.player.position.z)<Math.max(240,landmark.radius)&&this.save.discover(landmark.id)){this.hud.notify(`LUGAR DESCOBERTO · ${landmark.shortName}`);this.audio.play('discovery');}this.streamer.setNight(this.atmosphere.time==='Night');this.realCity.setNight(this.atmosphere.time==='Night');this.realCity.syncProceduralVisibility();this.updateDistrict();}
    this.terrain.update(this.player.position,this.origin);this.forest.update(this.player.position);
    this.rendering.renderer.render(this.rendering.scene,this.rendering.camera);
    this.cpu+=(performance.now()-start-this.cpu)*.08;this.quality.update(rawDt);this.telemetryTime+=dt;
    if(this.telemetryTime>.2){this.telemetryTime=0;this.sample();}
    const frame = this.frame;
    const animDebug = this.player.character.animationController.debugState;
    const softTarget = this.powers.softTargetInfo;
    const hitStopMs = this.powers.hitStop.remainingMs;
    this.hud.update(dt,{position:this.player.position,origin:this.origin,velocity:this.player.velocity,yaw:this.camera.yaw,state:this.player.state,size:this.player.size,selected:this.powers.selected,temporal:this.powers.temporal,title:this.missions.title,objective:this.missions.objective,hint:this.missions.hint,destination:this.missions.destination,remaining:this.missions.remaining,stage:this.missions.stage,time:this.atmosphere.clock,weather:this.atmosphere.weather,fps:frame.fps,backend:this.rendering.backend,speedMode:this.player.speedMode,megaMode:this.player.megaMode,spaceFactor:this.spaceFactor,district:this.district,debug:{'Renderer':this.rendering.backend,'FPS':frame.fps,'Frame (ms)':this.quality.averageMs.toFixed(1),'CPU (ms)':this.cpu.toFixed(1),'GPU (ms)':'indisponível','Draw calls':frame.drawCalls,'Triângulos':frame.triangles.toLocaleString(),'Geometrias / texturas':`${frame.geometries} / ${frame.textures}`,'Chunks ativos / cache':`${frame.active} / ${frame.cached}`,'Fila de streaming':frame.queued,'Streaming (ms)':frame.streamMs.toFixed(2),'Memória estimada (MB)':frame.loadedMB.toFixed(1),'HLOD instâncias':this.hlod.nodeCount,'Cidade real · tiles':`${this.realCity.stats.tiles} (${this.realCity.stats.near} células)`,'Cidade real · triângulos':`${Math.round(this.realCity.stats.detailTriangles/1000)}k perto / ${Math.round(this.realCity.stats.shellTriangles/1000)}k casca`,'Cidade real · skyline':this.realCity.stats.skyline,'Cidade real · colisores':this.realCity.stats.colliders,'Destruição':`${this.destruction.stats.destroyed} prédios · ${this.destruction.stats.debris} escombros · ${this.destruction.stats.scars} marcas`,'Perfil (ms)':Object.entries(this.profile).filter(([,v])=>v>.05).map(([k,v])=>`${k} ${v.toFixed(1)}`).join(' · ')||'—','Animação · Base / Voo':`${animDebug.baseLayer} / ${animDebug.flightLayer}`,'Animação · Combate':`${animDebug.combatMove} [${animDebug.movePhase}] (${animDebug.boneMask})`,'Animação · Pulo / Flip':`jumps: ${this.player.jumpCount} · flip: ${(animDebug.doubleJumpProgress*100).toFixed(0)}%`,'Voo · Alinhamento / Vel':`${animDebug.flightAlignment.toFixed(3)} · XYZ(${animDebug.velocityDir.x.toFixed(2)}, ${animDebug.velocityDir.y.toFixed(2)}, ${animDebug.velocityDir.z.toFixed(2)})`,'Voo · Pitch / Bank':`${animDebug.rootPitch.toFixed(2)} / ${animDebug.rootBank.toFixed(2)}`,'Voo · Modo / Vertical':`${animDebug.flightMode} · ${(animDebug.upright*100).toFixed(0)}% em pé`,'Movimento · Esquiva / Mortal':`${animDebug.dodge??'nenhuma'} · ${animDebug.flipPhase}${this.player.isSlamming?' · SLAM':''}`,'Combate · Soft Target':`${softTarget.id??'nenhum'} (${softTarget.angleDeg.toFixed(1)}°)`,'Combate · Hit Stop':`${hitStopMs} ms`,'Largo':`${this.largo.stats.detail} · ${this.largo.stats.draws} draws · ${this.largo.stats.colliders} colisores`,'Skin cósmica':Object.entries(this.player.character.cosmicDiagnostics).filter(([,v])=>v!==undefined&&v!==null).slice(0,5).map(([k,v])=>`${k} ${v}`).join(' · '),'Trânsito':this.traffic?`${this.traffic.stats.active} carros · ${this.traffic.stats.segments} vias · ${this.traffic.stats.nodes} cruzamentos`:'sem malha viária','Ruas reais (tri)':this.realCity.stats.roadTriangles,'Voo':this.player.speedMode+(this.player.megaMode?' · MEGA':''),'NPCs / veículos':`${this.population.npcCount} / ${this.population.vehicleCount}`,'Global XYZ':`${this.player.position.x.toFixed(0)} ${this.player.position.y.toFixed(0)} ${this.player.position.z.toFixed(0)}`,'Local XYZ':`${this.playerLocal.x.toFixed(0)} ${this.playerLocal.y.toFixed(0)} ${this.playerLocal.z.toFixed(0)}`,'Qualidade / resolução':`${this.rendering.preset} / ${Math.round(this.rendering.renderScale*100)}%`}},this.rendering.camera);
    this.input.endFrame();
  };
  /** Rebuilt in place every frame: spreads and filters would allocate three arrays per tick. */
  private gatherColliders(){
    const list=this.colliders;list.length=0;
    for(const collider of this.streamer.colliders)if(!this.realCity.replacesCollider(collider))list.push(collider);
    for(const collider of this.realCity.colliders)list.push(collider);
    for(const collider of this.hlod.colliders)if(!this.realCity.replacesCollider(collider))list.push(collider);
    for(const collider of this.landmarks.colliders)list.push(collider);
    for(const collider of this.largo.colliders)list.push(collider);
    this.airport.appendColliders(list,this.player.position,1600);
    if(this.traffic)for(const collider of this.traffic.colliders)list.push(collider);
    for(const collider of this.population.colliders)list.push(collider);
  }
  private updateStomps(dt:number):void{
    this.stompTimer-=dt;if(this.player.size<5||this.stompTimer>0)return;
    this.stompTimer=.12;
    const size=this.player.size,angle=this.player.facingYaw;
    for(const side of [-1,1]){
      this.foot.copy(this.player.position);this.foot.x+=Math.cos(angle)*side*.112*size;this.foot.z-=Math.sin(angle)*side*.112*size;
      const floor=PhysicsWorld.terrainHeight(this.foot.x,this.foot.z);
      const supported=this.foot.y<=floor+Math.max(2,size*.08)||this.colliders.some(c=>Math.abs(c.x-this.foot.x)<c.width/2+size*.1&&Math.abs(c.z-this.foot.z)<c.depth/2+size*.1&&Math.abs(c.y+c.height/2-this.foot.y)<Math.max(2,size*.08));
      if(supported)this.destruction.damageAt(this.foot,Math.max(2,size*.18),100000);
    }
  }
  private attackTime=-Infinity;private attackRadius=0;private readonly attackPosition=new Vector3();private attackBoxes:Collider[]=[];
  private attackColliders(point:Vector3,radius:number):readonly Collider[]{
    if(this.player.size<7)return this.colliders;
    const now=performance.now();
    if(now-this.attackTime>120||radius!==this.attackRadius||point.distanceToSquared(this.attackPosition)>65536){
      this.attackBoxes=Array.from(this.destructible.blastColliders(point,radius));this.attackTime=now;this.attackRadius=radius;this.attackPosition.copy(point);
    }
    return this.attackBoxes;
  }
  private readonly blastBoxes:Collider[]=[];
  readonly destructible={
    blastColliders:(point:Vector3,radius:number):readonly Collider[]=>{
      if(radius<80)return this.colliders;
      const out=this.blastBoxes;out.length=0;
      for(const box of this.colliders)if(!box.id?.startsWith("real:")&&!box.id?.startsWith("landmark:")&&!box.id?.startsWith("largo:")&&!box.id?.startsWith("airport:"))out.push(box);
      this.realCity.appendBlastColliders(out,point,radius);this.landmarks.appendBlastColliders(out,point,radius);this.largo.appendBlastColliders(out,point,radius);this.airport.appendColliders(out,point,radius);return out;
    },
    colliders:():readonly Collider[]=>this.colliders,
    destroy:(id:string):boolean=>{id=id.replace(/^hlod:/,'');return !!this.traffic?.destroy(id)||this.realCity.destroy(id)||this.streamer.destroy(id)||this.landmarks.destroy(id)||this.largo.destroy(id)||this.airport.destroy(id);},
    deform:(point:Vector3,radius:number,damage:number)=>this.terrain.damageAt(point,radius,damage),
  };
  /** Register newly built surfaces once, including streamed roads and plaza LOD changes. */
  private readonly watchedGround=new WeakSet<import('three/webgpu').Object3D>();
  private watchGround(object:import('three/webgpu').Object3D,ground=false):void{
    if(this.watchedGround.has(object))return;this.watchedGround.add(object);
    ground ||= /Generalized Manaus|airport-pavement|sidewalks|destruction-scars|real-city-road-network|largo-sao-sebastiao/.test(object.name);
    if(ground&&object instanceof Mesh)this.terrain.registerSurface(object);
    for(const child of object.children)this.watchGround(child,ground);
    object.addEventListener('childadded',event=>this.watchGround(event.child,ground));
  }
  /** Named from the real compiled bairro boundaries; throttled with the discovery sweep. */
  private updateDistrict(){
    const bairro=this.realCity.districts.nearest(this.player.position.x,this.player.position.z,2500);
    this.district=(bairro?.name??'AMAZONAS').toUpperCase();
  }
  /** The flight tier the player is actually in, which is what the effect keys off. */
  /** The flight tier and the powers both feed the skin; a power reads over the flight state. */
  private cosmicLevel():CosmicLevel{
    if(this.powers.temporal||this.powers.cooldowns[this.powers.selected]>0)return 'power';
    const mode=this.player.speedMode;
    return mode==='mega'?'mega':mode==='super'?'boost':mode==='fast'?'flight'
      :this.player.state==='Grounded'?'idle':'flight';
  }
  private speedState():SpeedState{
    const mode=this.player.speedMode;
    return mode==='mega'?'mega':mode==='super'?'super':mode==='fast'?'fast':'normal';
  }
  private suppressActors(){
    const speed=this.player.velocity.length();
    const config=QUALITY[this.save.data.settings.quality];
    const fade=speed<=WORLD.actorSpeedLimit?1:Math.max(0,1-(speed-WORLD.actorSpeedLimit)/(WORLD.actorCutoffSpeed-WORLD.actorSpeedLimit));
    this.population.npcCount=Math.round(config.npcs*fade);
    this.traffic?.setCount(Math.round(config.vehicles*2*fade));
  }
  private sample(){const info=this.rendering.renderer.info,stats=this.streamer.stats;this.frame={fps:Math.round(1000/this.quality.averageMs),cpu:Number(this.cpu.toFixed(2)),drawCalls:info.render.drawCalls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,active:stats.active,cached:stats.cached,queued:stats.queued,loadedMB:stats.loadedMB+info.memory.total/1048576,streamMs:stats.streamMs,x:this.player.position.x,z:this.player.position.z};}
}
