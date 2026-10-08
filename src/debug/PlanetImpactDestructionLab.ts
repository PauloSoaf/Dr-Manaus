import { Color,Group,PerspectiveCamera,Raycaster,Scene,Vector3,WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UniverseRuntime } from '../world/runtime/UniverseRuntime';
import { IMPACT_VOLUME_LIMITS } from '../world/planet/volume/PlanetVolumeImpactDemand';
import { surfaceForBody } from '../world/planet/BodySurfaceFactory';
import { planetSurfaceRadius } from '../world/planet/PlanetSurface';
import { PlanetGlobe,buildPlanetTileMesh } from '../world/planet/PlanetGlobe';
import { planetTile } from '../world/planet/PlanetTileAddress';
import { PlanetTerrainProvider } from '../world/planet/PlanetTerrainProvider';
import { surfaceGravityMps2 } from '../world/planet/PlanetBody';
import { PlanetVolumeTerrainProvider } from '../world/planet/volume/PlanetVolumeTerrainProvider';
import { PlanetVolumeCollisionProvider } from '../world/planet/volume/PlanetVolumeCollisionProvider';
import { PlanetVolumeSurfaceRenderer } from '../rendering/PlanetVolumeSurfaceRenderer';
import { RockyImpactDestructionService } from '../world/destruction/RockyImpactDestructionService';
import { CelestialImpactService } from '../world/travel/CelestialImpactService';
import { bodyProfile } from '../world/celestial/CelestialBodyProfile';
import { referenceFrame } from '../world/spatial/ReferenceFrame';
import { IDENTITY_QUAT,quatFromBasis,type Vec3 } from '../world/spatial/units';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { InputController } from '../player/InputController';
import { PlayerController } from '../player/PlayerController';
import './PlanetVolumeLab.css';

/** Explicit D1 acceptance fixture; uses the production scheduler, renderer, mask and player. */
export async function startPlanetImpactDestructionLab(container:HTMLElement) {
  container.innerHTML='';
  const renderer=new WebGPURenderer({forceWebGL:true,antialias:true,logarithmicDepthBuffer:true});
  await renderer.init();renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
  container.append(renderer.domElement);
  const scene=new Scene();scene.background=new Color(0x172334);
  const camera=new PerspectiveCamera(55,innerWidth/innerHeight,.1,20_000_000);camera.layers.enableAll();
  const controls=new OrbitControls(camera,renderer.domElement);controls.maxDistance=5000;
  const universe=new UniverseRuntime({streaming:true,volume:IMPACT_VOLUME_LIMITS}),runtime=universe.volume;
  const input=new InputController(renderer.domElement),player=new PlayerController(new Group(),input);
  let body:'earth'|'moon'|'mars'='moon',globe:PlanetGlobe,local:string,fixed:string,
    terrain:PlanetVolumeTerrainProvider,volume:PlanetVolumeCollisionProvider,point:Vec3,
    paused=true,disposed=false,solarDirection:Vec3=[0,1,0],volumeDrawCalls=0;
  const presentation=new PlanetVolumeSurfaceRenderer(scene,universe.frames,universe.renderSpace,
    id=>bodyProfile(universe.activeSystem.bodies.find(b=>b.id===id)!),entries=>globe?.volumeMask.update(entries),
    {solarDirection:()=>solarDirection,surface:id=>surfaceForBody(universe.activeSystem.bodies.find(b=>b.id===id)!),
      prepareMasks:entries=>globe.volumeMask.prepareUpdate(entries),maskStats:()=>globe.volumeMask.stats});
  runtime.setImpactPublication(presentation);
  const impacts=new CelestialImpactService(),service=new RockyImpactDestructionService({edits:runtime.edits,
    body:id=>universe.activeSystem.bodies.find(b=>b.id===id),requestRegion:(id,plan)=>runtime.requestImpactRegion(id,plan)});
  const panel=document.createElement('section');panel.className='planet-volume-lab';
  panel.innerHTML=`<h1>DR Manaus · Impacto D1</h1><p>WASD: andar · Espaço: saltar · Arraste para orbitar.</p>
    <label>Corpo <select data-body><option value="moon">Lua</option><option value="mars">Marte</option><option value="earth">Terra controlada</option></select></label>
    <div><button data-impact>Impacto a 8 km/s</button><button data-reset>Entrar na cratera</button><button data-play>Andar / pausar</button></div>
    <div><button data-view="above">Vista superior</button><button data-view="inside">Vista interna</button></div>
    <output data-status></output><pre data-metrics></pre><p>Fixture explícita com componentes de produção. <a href="${location.pathname}">Voltar ao jogo</a></p>`;
  container.append(panel);
  const view=(inside=false)=>{camera.position.set(...(inside?[0,-140,50]:[0,650,1000]) as Vec3);
    controls.target.set(0,inside?-50:-70,inside?-440:0);controls.update();};
  const reset=(position:Vec3=[0,1,0])=>{input.clear();player.teleport(new Vector3(...position));player.velocity.set(0,0,0);player.state='Falling';};
  const bind=()=>{PhysicsWorld.setTerrain(terrain);PhysicsWorld.setVolumeCollision(runtime.replacement.bodyId===body?volume:null);};
  const configure=()=>{
    runtime.setDebugDemand(false);presentation.clear();globe?.dispose();globe?.root.removeFromParent();
    const celestial=universe.activeSystem.bodies.find(b=>b.id===body)!,surface=surfaceForBody(celestial)!;
    fixed=`${body}/fixed`;local=`${body}/d1-lab-enu`;point=[planetSurfaceRadius(surface,[1,0,0]),0,0];
    if(!universe.frames.has(fixed))universe.frames.register(referenceFrame({id:fixed,parentId:celestial.frameId,kind:'body-fixed'}));
    universe.frames.register(referenceFrame({id:local,parentId:fixed,kind:'surface-enu',originInParent:point,
      rotationToParent:quatFromBasis([0,1,0],[1,0,0],[0,0,-1])}));
    const intact=new PlanetTerrainProvider(universe.frames,surface.body,surface,local);
    terrain=new PlanetVolumeTerrainProvider(intact,runtime.replacement,universe.frames,body,fixed,local);
    volume=new PlanetVolumeCollisionProvider(runtime.collisionCache,universe.frames,body,fixed,local);
    runtime.setCollisionDiagnostics(volume.metrics);player.setSurfaceGravity(surfaceGravityMps2(surface.body));
    reset();universe.setPlayerPose(local,[0,1,0]);universe.update([0,1,0],[0,0,0],0);
    // Four real tiles around +X and two unaffected neighbours for mask/culling diagnostics.
    globe=new PlanetGlobe(body);scene.add(globe.root);
    const level=Math.ceil(Math.log2(surface.body.semiMajorAxisM/1600)),mid=2**(level-1);
    for(const [x,y] of [[mid-1,mid-1],[mid-1,mid],[mid,mid-1],[mid,mid],[mid+4,mid],[mid+5,mid]]){
      const address=planetTile(body,0,level,x,y);globe.add(`${x}:${y}`,buildPlanetTileMesh(address,surface));}
    globe.setSunDirection([0,1,0]);bind();view();
  };
  const impact=(speed=8000,offsetM=0)=>{
    const celestial=universe.activeSystem.bodies.find(b=>b.id===body)!;
    impacts.clear();const event=impacts.emit({bodyId:body,fraction:1,envelopeRadiusM:point[0]+1000,
      contactPositionM:[point[0]+1000,offsetM,0],impactNormalSystem:[1,0,0],playerVelocityMps:[-speed,0,0],bodyVelocityMps:[0,0,0],
      relativeSpeedMps:speed,radialSpeedMps:-speed,assisted:false,responseMode:'graze',responseRadialSpeedMps:0,responseTangentialSpeedMps:0},
      bodyProfile(celestial),{autopilotActive:false,warpStep:0,simulationTimeS:0},[point[0]+1000,offsetM,0])!;
    impacts.drain();return service.consume(event);
  };
  const step=(dt=1/60)=>{bind();player.update(dt,[],0);input.endFrame();};
  const update=(dt=1/60)=>{
    if(!paused)step(dt);
    universe.setPlayerPose(local,player.position.toArray() as Vec3);
    universe.update(player.position.toArray() as Vec3,player.velocity.toArray() as Vec3,dt);
    universe.updateStreaming(dt);bind();presentation.update();
    globe.setCentre(universe.renderSpace.logicalToRender(fixed,[0,0,0]));
    globe.setOrientation(universe.frames.convertOrientation(fixed,universe.renderSpace.currentOrigin.frame,IDENTITY_QUAT));
  };
  const lab={get ready(){return !disposed;},universe,impact,
    setSolarDirection(direction:Vec3){solarDirection=[...direction];globe.setSunDirection(direction);presentation.update();},
    lookAway(){controls.target.copy(camera.position).add(new Vector3(0,0,1000));controls.update();},
    viewCrater(){const plan=service.last?.plan;if(!plan)return;
      const r=plan.craterRadiusM;camera.position.set(r*.3,r*1.8,r*2.5);controls.target.set(0,-plan.craterDepthM*.3,0);controls.update();},
    pause(value=true){paused=value;},reset,view,setBody(next:'earth'|'moon'|'mars'){body=next;configure();},
    runFrames(count:number,dt=1/60){for(let i=0;i<count;i++)step(dt);},
    ray(x=0,z=0){return volume.raycast([x,10,z],[0,-1,0],1200);},
    surfaceProbe(x:number,z=0){return {intact:terrain.intact.heightAt(x,z),heightfield:terrain.heightAt(x,z),
      floor:volume.raycast([x,10,z],[0,-1,0],1200)?.point[1]??terrain.heightAt(x,z)};},
    visualRay(x=0,z=0){scene.updateMatrixWorld(true);const ray=new Raycaster(new Vector3(x,10,z),new Vector3(0,-1,0),0,1200);
      ray.layers.enableAll();return ray.intersectObjects(presentation.root.children,false)[0]?.point.toArray();},
    probe(feet:Vec3,velocity:Vec3,dt:number){bind();const p=new Vector3(...feet),v=new Vector3(...velocity),physics=new PhysicsWorld();
      const firstContact=volume.sweepCapsule(feet,velocity.map(value=>value*dt) as Vec3,.32,2.1);
      const grounded=physics.move(p,v,dt,.32,2.1,[]);
      return {grounded,position:p.toArray(),velocity:v.toArray(),contact:physics.lastVolumeContact,firstContact,
        floor:volume.raycast([p.x,10,p.z],[0,-1,0],1200)?.point[1]};},
    snapshot(){return {body,editCount:runtime.edits.editCount,revision:runtime.edits.revision(body),metrics:runtime.metrics,
      collision:runtime.collisionMetrics,presentation:presentation.stats,mask:globe.volumeMask.publishedCount,volumeDrawCalls,
      intactHeight:terrain.heightAt(0,0),service:service.debugMetrics(),player:{position:player.position.toArray(),velocity:player.velocity.toArray(),
        state:player.state,contact:player.lastVolumeContact}};},
    dispose(){if(disposed)return;disposed=true;renderer.setAnimationLoop(null);input.dispose();player.character.dispose();controls.dispose();
      PhysicsWorld.setTerrain(null);PhysicsWorld.setVolumeCollision(null);presentation.dispose();globe.dispose();universe.dispose();renderer.dispose();
      panel.remove();renderer.domElement.remove();removeEventListener('resize',resize);delete window.__DR_IMPACT_LAB__;}
  };
  const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
  addEventListener('resize',resize);
  panel.querySelector<HTMLSelectElement>('[data-body]')!.onchange=e=>lab.setBody((e.target as HTMLSelectElement).value as typeof body);
  panel.querySelector<HTMLButtonElement>('[data-impact]')!.onclick=()=>impact();panel.querySelector<HTMLButtonElement>('[data-reset]')!.onclick=()=>reset();
  panel.querySelector<HTMLButtonElement>('[data-play]')!.onclick=()=>{paused=!paused;};
  panel.querySelector<HTMLButtonElement>('[data-view="above"]')!.onclick=()=>view();
  panel.querySelector<HTMLButtonElement>('[data-view="inside"]')!.onclick=()=>view(true);
  configure();window.__DR_IMPACT_LAB__=lab;
  const countVolumeDraw=()=>{volumeDrawCalls++;};
  renderer.setAnimationLoop(()=>{update();controls.update();volumeDrawCalls=0;
    for(const mesh of presentation.root.children)mesh.onBeforeRender=countVolumeDraw;
    renderer.render(scene,camera);
    panel.querySelector('output')!.textContent=`${body} · ${player.state} · ${runtime.metrics.publishedReplacements} chunks publicados`;
    panel.querySelector('pre')!.textContent=Object.entries({...service.debugMetrics(),...runtime.debugMetrics()}).map(([k,v])=>`${k}: ${v}`).join('\n');});
  return lab;
}
declare global {interface Window {__DR_IMPACT_LAB__?:Awaited<ReturnType<typeof startPlanetImpactDestructionLab>>}}
