import { Box3,Box3Helper,CapsuleGeometry,Color,DirectionalLight,Group,HemisphereLight,Mesh,MeshStandardMaterial,
  PerspectiveCamera,Scene,Vector3,WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UniverseRuntime } from '../world/runtime/UniverseRuntime';
import { surfaceForBody } from '../world/planet/BodySurfaceFactory';
import { planetSurfaceRadius } from '../world/planet/PlanetSurface';
import { chunkContainingPoint,chunkKeyToString,chunkBoundsBodyFixedM } from '../world/planet/volume/PlanetVolumeChunkKey';
import { PlanetVolumeCollisionProvider } from '../world/planet/volume/PlanetVolumeCollisionProvider';
import { referenceFrame } from '../world/spatial/ReferenceFrame';
import { quatFromBasis,type Vec3 } from '../world/spatial/units';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { InputController } from '../player/InputController';
import { PlayerController } from '../player/PlayerController';
import { createVolumeMeshGeometry } from './VolumeMeshGeometry';
import type { PlanetVolumeMesh } from '../world/planet/volume/PlanetVolumeMesh';
import type { PlanetVolumeLab } from './PlanetVolumeLab';

/** D0 only: real field/MC/collider and real player, isolated from Game and its heightfield. */
export function startPlanetVolumeCollisionLab(container:HTMLElement):PlanetVolumeLab {
  container.innerHTML='';
  const renderer=new WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);container.append(renderer.domElement);
  const scene=new Scene();scene.background=new Color(0x0c1824);scene.add(new HemisphereLight(0xe2f0ff,0x343039,2));
  const light=new DirectionalLight(0xffefda,3);light.position.set(30,30,30);scene.add(light);
  const camera=new PerspectiveCamera(55,innerWidth/innerHeight,.02,200);
  camera.up.set(1,0,0);
  const controls=new OrbitControls(camera,renderer.domElement);controls.minDistance=.1;controls.maxDistance=80;
  const cage=new Box3Helper(new Box3(new Vector3(),new Vector3(16,16,16)),0x537b94);scene.add(cage);
  const material=new MeshStandardMaterial({color:0xb7a481,roughness:.85});
  const marker=new Mesh(new CapsuleGeometry(.32,2.1-.64,8,12),new MeshStandardMaterial({color:0x55c9ef}));scene.add(marker);
  // Body-fixed X is local ENU up in this fixture.
  marker.rotation.z=-Math.PI/2;
  const lod={baseChunkSizeM:16,samplesPerAxis:17,maxLod:0};
  const universe=new UniverseRuntime({streaming:true,volume:{lod,demand:{radiusM:16,radialHalfBandM:16,maxDemands:8,maxVisited:64}}});
  const input=new InputController(renderer.domElement),player=new PlayerController(new Group(),input);
  let body:'earth'|'moon'|'mars'='earth',scenario:'intact'|'sphere'|'capsule'='sphere',ownKey='',edit='',radius=1.9;
  let centre:Vec3=[0,0,0],origin:Vec3=[0,0,0],provider:PlanetVolumeCollisionProvider,displayed:PlanetVolumeMesh|undefined,object:Mesh|undefined;
  let disposed=false,paused=false,spawned=false;
  const panel=document.createElement('section');panel.className='planet-volume-lab';
  panel.innerHTML=`<h1>DR Manaus · Colisão D0</h1><p>WASD: andar · Espaço: saltar · F: voar. Arraste para orbitar.</p>
    <label>Corpo <select data-body><option value="earth">Terra</option><option value="moon">Lua</option><option value="mars">Marte</option></select></label>
    <label>Cavidade <select data-scenario><option value="sphere">Esfera</option><option value="capsule">Túnel</option></select></label>
    <div><button data-reset>Reiniciar posição</button><button data-rebuild>Ampliar cavidade</button></div>
    <div><button data-fast>Testar parede a 3000 m/s</button><button data-view="inside">Vista interna</button><button data-view="outside">Vista externa</button></div>
    <label><input type="checkbox" data-wireframe> Mostrar triangulação</label><label><input type="checkbox" data-cage> Limites do chunk</label>
    <output data-status aria-live="polite">Gerando…</output><pre data-metrics></pre>
    <p>Cenário isolado de teste. <a href="?volumeLab=1">Inspecionar malhas</a> · <a href="${location.pathname}">Voltar ao jogo</a></p>`;
  container.append(panel);cage.visible=false;
  const removeMesh=()=>{if(object){scene.remove(object);object.geometry.dispose();object=undefined;}displayed=undefined;};
  const reset=()=>{input.clear();player.position.set(0,-.5,0);player.velocity.set(0,0,0);player.state='Falling';};
  const setView=(inside=false)=>{camera.fov=inside?70:55;camera.updateProjectionMatrix();
    camera.position.set(...(inside?[8.6,8.5,9.5]:[20,18,22]) as Vec3);
    controls.target.set(...(inside?[7.3,8,8]:[8,8,8]) as Vec3);controls.update();};
  const addEdit=()=>{if(edit)universe.volume.edits.remove(edit);
    edit=scenario==='capsule'?universe.volume.edits.subtractCapsule({bodyId:body,aBodyFixedM:[centre[0],centre[1],centre[2]-3],
      bBodyFixedM:[centre[0],centre[1],centre[2]+3],radiusM:radius}):universe.volume.edits.subtractSphere({bodyId:body,centerBodyFixedM:centre,radiusM:radius});};
  const configure=()=>{
    removeMesh();universe.volume.setDebugDemand(false);for(const e of universe.volume.edits.allEdits())universe.volume.edits.remove(e.id);
    const celestial=universe.solarSystem.bodies.find(b=>b.id===body)!,surface=surfaceForBody(celestial)!,r=planetSurfaceRadius(surface,[1,0,0]);
    const key=chunkContainingPoint(body,[r-256,8,8],0,lod);origin=[...chunkBoundsBodyFixedM(key,lod).minBodyFixedM];
    centre=origin.map(v=>v+8) as Vec3;ownKey=chunkKeyToString(key);radius=1.9;edit='';addEdit();
    const local=`${body}/d0-lab-enu`;universe.frames.register(referenceFrame({id:local,kind:'surface-enu',parentId:celestial.frameId,
      originInParent:centre,rotationToParent:quatFromBasis([0,1,0],[1,0,0],[0,0,-1])}));
    provider=new PlanetVolumeCollisionProvider(universe.volume.collisionCache,universe.frames,body,celestial.frameId,local);
    universe.volume.setCollisionDiagnostics(provider.metrics);PhysicsWorld.setTerrain(null);PhysicsWorld.setVolumeCollision(provider);
    universe.setPlayerPose(celestial.frameId,centre);universe.volume.setDebugCollision(true);universe.volume.setDebugDemand(true,true);
    reset();spawned=false;setView();material.color.set(body==='earth'?0xb7a481:body==='moon'?0xc1c6cf:0xb45a3a);
  };
  const step=(dt=1/60)=>{if(!universe.volume.collisionCache.values().some(c=>chunkKeyToString(c.key)===ownKey))return;
    player.update(dt,[],0);input.endFrame();};
  const probe=(feet:Vec3,velocity:Vec3,dt:number)=>{
    const p=new Vector3(...feet),v=new Vector3(...velocity),physics=new PhysicsWorld();
    const grounded=physics.move(p,v,dt,.32,2.1,[]);
    return {position:p.toArray(),velocity:v.toArray(),grounded,contact:physics.lastVolumeContact};
  };
  const lab={universe,get ready(){return !disposed;},
    setBody(next:'earth'|'moon'|'mars'){body=next;configure();},
    setScenario(next:'intact'|'sphere'|'capsule'){if(next==='intact')throw new RangeError('collision lab requires a cavity');scenario=next;configure();},
    pause(value=true){paused=value;},reset,runFrames(count:number,dt=1/60){for(let i=0;i<count;i++)step(dt);},probe,
    rebuild(){radius=Math.min(3.5,radius+.3);addEdit();return universe.volume.edits.revision(body);},
    raycast(origin:Vec3,direction:Vec3,distance=10){return provider.raycast(origin,direction,distance);},
    snapshot(){return {body,scenario,displayedRevision:displayed?.sourceRevision,displayedKey:displayed&&chunkKeyToString(displayed.key),
      triangles:displayed?.triangleCount??0,vertices:displayed?.vertexCount??0,maxLocalCoordinate:displayed?displayed.positions.reduce((max,p)=>Math.max(max,Math.abs(p)),0):0,
      metrics:universe.volume.metrics,collision:universe.volume.collisionMetrics,player:{position:player.position.toArray(),velocity:player.velocity.toArray(),state:player.state,contact:player.lastVolumeContact}};},
    dispose(){if(disposed)return;disposed=true;renderer.setAnimationLoop(null);input.dispose();player.character.dispose();PhysicsWorld.setVolumeCollision(null);PhysicsWorld.setTerrain(null);
      controls.dispose();removeMesh();marker.geometry.dispose();marker.material.dispose();cage.geometry.dispose();(cage.material as MeshStandardMaterial).dispose();
      material.dispose();universe.dispose();renderer.dispose();panel.remove();renderer.domElement.remove();removeEventListener('resize',resize);removeEventListener('pagehide',disposeOnHide);delete window.__DR_VOLUME_LAB__;}
  };
  panel.querySelector<HTMLSelectElement>('[data-body]')!.onchange=e=>lab.setBody((e.target as HTMLSelectElement).value as typeof body);
  panel.querySelector<HTMLSelectElement>('[data-scenario]')!.onchange=e=>lab.setScenario((e.target as HTMLSelectElement).value as typeof scenario);
  panel.querySelector<HTMLButtonElement>('[data-reset]')!.onclick=reset;panel.querySelector<HTMLButtonElement>('[data-rebuild]')!.onclick=()=>lab.rebuild();
  panel.querySelector<HTMLButtonElement>('[data-fast]')!.onclick=()=>{reset();const result=probe([0,-1,0],[3000,0,0],1/30);player.position.fromArray(result.position);player.velocity.fromArray(result.velocity);};
  panel.querySelector<HTMLButtonElement>('[data-view="inside"]')!.onclick=()=>setView(true);panel.querySelector<HTMLButtonElement>('[data-view="outside"]')!.onclick=()=>setView();
  panel.querySelector<HTMLInputElement>('[data-wireframe]')!.onchange=e=>{material.wireframe=(e.target as HTMLInputElement).checked;};
  panel.querySelector<HTMLInputElement>('[data-cage]')!.onchange=e=>{cage.visible=(e.target as HTMLInputElement).checked;};
  const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
  const disposeOnHide=()=>lab.dispose();addEventListener('resize',resize);addEventListener('pagehide',disposeOnHide);
  window.__DR_VOLUME_LAB__=lab;configure();
  renderer.setAnimationLoop(()=>{
    provider.resetMetrics();universe.updateStreaming(1/60);
    const collider=universe.volume.collisionCache.values().find(c=>chunkKeyToString(c.key)===ownKey),next=collider?.sourceMesh;
    // Render the same retained source as physics throughout a rebuild.
    if(next!==displayed){removeMesh();if(next){displayed=next;object=new Mesh(createVolumeMeshGeometry(next),material);scene.add(object);}}
    if(collider&&!spawned){reset();spawned=true;}if(spawned&&!paused)step();
    const fixed=universe.frames.convertPosition(provider.localFrameId,provider.fixedFrameId,[player.position.x,player.position.y+1.05,player.position.z]);
    marker.position.set(...fixed.map((v,i)=>v-origin[i]) as Vec3);marker.visible=!!collider;
    panel.querySelector('output')!.textContent=displayed?`${player.state} · revisão ${displayed.sourceRevision}`:'Gerando…';
    panel.querySelector('pre')!.textContent=Object.entries(universe.volume.debugMetrics()).map(([key,value])=>`${key}: ${value}`).join('\n');
    controls.update();renderer.render(scene,camera);
  });
  return lab;
}
