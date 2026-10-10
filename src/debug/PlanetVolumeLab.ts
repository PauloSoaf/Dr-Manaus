import { Box3,Box3Helper,Color,DirectionalLight,HemisphereLight,Mesh,MeshStandardMaterial,
  PerspectiveCamera,Scene,Vector3,WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UniverseRuntime } from '../world/runtime/UniverseRuntime';
import { surfaceForBody } from '../world/planet/BodySurfaceFactory';
import { planetSurfaceRadius } from '../world/planet/PlanetSurface';
import { chunkContainingPoint,chunkKeyToString,chunkBoundsBodyFixedM } from '../world/planet/volume/PlanetVolumeChunkKey';
import type { PlanetVolumeMesh } from '../world/planet/volume/PlanetVolumeMesh';
import { createVolumeMeshGeometry } from './VolumeMeshGeometry';
import './PlanetVolumeLab.css';
import { startPlanetVolumeCollisionLab } from './PlanetVolumeCollisionLab';

type LabBody='earth'|'moon'|'mars';
type LabScenario='intact'|'sphere'|'capsule';
export interface PlanetVolumeLab {
  readonly universe:UniverseRuntime;
  readonly ready:boolean;
  setBody(body:LabBody):void;
  setScenario(scenario:LabScenario):void;
  snapshot():{body:LabBody;scenario:LabScenario;displayedRevision?:number;displayedKey?:string;
    triangles:number;vertices:number;maxLocalCoordinate:number;metrics:UniverseRuntime['volume']['metrics']};
  dispose():void;
}
declare global {interface Window {__DR_VOLUME_LAB__?:PlanetVolumeLab}}

/** Explicit isolated chunk inspector. It uses the real runtime/scheduler and never starts Game. */
export function startPlanetVolumeLab(container:HTMLElement):PlanetVolumeLab {
  if(new URLSearchParams(location.search).has('volumeCollision'))return startPlanetVolumeCollisionLab(container);
  container.innerHTML='';
  const renderer=new WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);container.append(renderer.domElement);
  const scene=new Scene();scene.background=new Color(0x0c1824);
  scene.add(new HemisphereLight(0xe2f0ff,0x343039,2));
  const light=new DirectionalLight(0xffefda,3);light.position.set(600,350,450);scene.add(light);
  const camera=new PerspectiveCamera(45,innerWidth/innerHeight,.1,5000);
  const controls=new OrbitControls(camera,renderer.domElement);controls.minDistance=2;controls.maxDistance=1600;
  const cage=new Box3Helper(new Box3(new Vector3(0,0,0),new Vector3(256,256,256)),0x537b94);scene.add(cage);
  const material=new MeshStandardMaterial({color:0xb7a481,roughness:.85,metalness:0});
  const universe=new UniverseRuntime({streaming:true});universe.volume.setDebugDemand(true);universe.volume.setDebugMeshing(true);
  let body:LabBody='earth',scenario:LabScenario='sphere',displayed:PlanetVolumeMesh|undefined,object:Mesh|undefined;
  let ownKey='',surfaceX=128,disposed=false;
  const panel=document.createElement('section');panel.className='planet-volume-lab';
  panel.innerHTML=`<h1>DR Manaus · Volume</h1><p>Prévia de um chunk. Arraste para orbitar e use a roda para aproximar.</p>
    <label>Corpo <select data-body><option value="earth">Terra</option><option value="moon">Lua</option><option value="mars">Marte</option></select></label>
    <label>Corte <select data-scenario><option value="intact">Intacto</option><option value="sphere" selected>Esfera</option><option value="capsule">Cápsula / túnel</option></select></label>
    <div><button data-view="outside">Vista externa</button><button data-view="inside">Vista interna</button></div>
    <label><input type="checkbox" data-wireframe> Mostrar triangulação</label>
    <label><input type="checkbox" data-cage checked> Limites do chunk</label>
    <output data-status aria-live="polite">Gerando…</output><pre data-metrics></pre>
    <p>Geometria de inspeção. <a href="?volumeLab=1&volumeCollision=1">Laboratório de colisão</a></p><a href="${location.pathname}">Voltar ao jogo</a>`;
  container.append(panel);
  const bodySelect=panel.querySelector<HTMLSelectElement>('[data-body]')!,scenarioSelect=panel.querySelector<HTMLSelectElement>('[data-scenario]')!;
  const status=panel.querySelector<HTMLOutputElement>('[data-status]')!,info=panel.querySelector<HTMLElement>('[data-metrics]')!;
  const removeMesh=()=>{if(object) {scene.remove(object);object.geometry.dispose();object=undefined;}displayed=undefined;};
  const setView=(inside=false)=>{
    camera.fov=inside?70:45;camera.updateProjectionMatrix();
    if(inside) {
      camera.position.set(scenario==='capsule'?16:surfaceX-104,128,128);
      controls.target.set(surfaceX+128,128,128);
    } else {camera.position.set(570,400,420);controls.target.set(128,128,128);}
    controls.update();
  };
  const configure=()=>{
    removeMesh();
    universe.volume.setDebugDemand(false);
    for(const edit of universe.volume.edits.allEdits()) universe.volume.edits.remove(edit.id);
    const celestial=universe.solarSystem.bodies.find(candidate=>candidate.id===body)!,surface=surfaceForBody(celestial)!;
    const radius=planetSurfaceRadius(surface,[1,0,0]),observer:[number,number,number]=[radius,128,128];
    const key=chunkContainingPoint(body,observer),origin=chunkBoundsBodyFixedM(key).minBodyFixedM;
    surfaceX=radius-origin[0];ownKey=chunkKeyToString(key);
    universe.setPlayerPose(celestial.frameId,observer);
    if(scenario==='sphere') universe.volume.edits.subtractSphere({bodyId:body,centerBodyFixedM:[radius-48,128,128],radiusM:72});
    if(scenario==='capsule') universe.volume.edits.subtractCapsule({bodyId:body,aBodyFixedM:[radius+128,128,128],bBodyFixedM:[radius-512,128,128],radiusM:56});
    // Edits remain logical; the next scheduler frame samples and meshes the new fixture.
    universe.volume.setDebugDemand(true);
    material.color.set(body==='earth'?0xb7a481:body==='moon'?0xc1c6cf:0xb45a3a);
    bodySelect.value=body;scenarioSelect.value=scenario;status.textContent='Gerando…';setView();
  };
  const lab:PlanetVolumeLab={universe,get ready(){return !disposed;},
    setBody(next){if(!['earth','moon','mars'].includes(next)) throw new RangeError('unsupported lab body');body=next;configure();},
    setScenario(next){if(!['intact','sphere','capsule'].includes(next)) throw new RangeError('unsupported lab scenario');scenario=next;configure();},
    snapshot(){return {body,scenario,displayedRevision:displayed?.sourceRevision,displayedKey:displayed&&chunkKeyToString(displayed.key),
      triangles:displayed?.triangleCount??0,vertices:displayed?.vertexCount??0,
      maxLocalCoordinate:displayed?displayed.positions.reduce((max,p)=>Math.max(max,Math.abs(p)),0):0,metrics:universe.volume.metrics};},
    dispose(){if(disposed) return;disposed=true;renderer.setAnimationLoop(null);controls.dispose();removeMesh();
      cage.geometry.dispose();if(Array.isArray(cage.material)) cage.material.forEach(m=>m.dispose());else cage.material.dispose();
      material.dispose();universe.dispose();renderer.dispose();panel.remove();renderer.domElement.remove();
      removeEventListener('resize',resize);removeEventListener('pagehide',disposeOnHide);delete window.__DR_VOLUME_LAB__;},
  };
  bodySelect.onchange=()=>lab.setBody(bodySelect.value as LabBody);scenarioSelect.onchange=()=>lab.setScenario(scenarioSelect.value as LabScenario);
  panel.querySelector<HTMLButtonElement>('[data-view="outside"]')!.onclick=()=>setView();
  panel.querySelector<HTMLButtonElement>('[data-view="inside"]')!.onclick=()=>setView(true);
  panel.querySelector<HTMLInputElement>('[data-wireframe]')!.onchange=event=>{material.wireframe=(event.target as HTMLInputElement).checked;};
  panel.querySelector<HTMLInputElement>('[data-cage]')!.onchange=event=>{cage.visible=(event.target as HTMLInputElement).checked;};
  const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
  const disposeOnHide=()=>lab.dispose();addEventListener('resize',resize);addEventListener('pagehide',disposeOnHide);
  window.__DR_VOLUME_LAB__=lab;configure();
  renderer.setAnimationLoop(()=>{
    universe.updateStreaming(1/60);
    const next=universe.volume.meshes.find(mesh=>chunkKeyToString(mesh.key)===ownKey);
    if(next!==displayed) {removeMesh();if(next&&next.triangleCount) {displayed=next;object=new Mesh(createVolumeMeshGeometry(next),material);scene.add(object);}}
    const m=universe.volume.metrics;
    status.textContent=displayed?`${displayed.triangleCount.toLocaleString()} triângulos · ${displayed.vertexCount.toLocaleString()} vértices`:'Gerando…';
    info.textContent=`Chunks: ${m.resident} · malhas: ${m.residentMeshes}\nAmostras: ${(m.bytes/1048576).toFixed(3)} MiB · malhas: ${(m.meshBytes/1048576).toFixed(3)} MiB\nGeração: ${m.generationMs.toFixed(2)} ms · MC: ${m.meshingMs.toFixed(2)} ms\nRevisão: ${m.revision} · faces ambíguas: ${m.ambiguousMeshFaces}`;
    controls.update();renderer.render(scene,camera);
  });
  return lab;
}
