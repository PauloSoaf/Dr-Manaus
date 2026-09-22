import { Clock, Color, DirectionalLight, GridHelper, HemisphereLight, PerspectiveCamera, Scene, SkeletonHelper, WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CharacterModel } from '../CharacterModel';
import './AnimationLab.css';

const PREFERRED = [
  'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
  'Roll', 'Punch_Jab', 'Punch_Cross', 'Melee_Hook', 'Kick_Left', 'Kick_Right', 'Hit_Chest', 'Hit_Head',
];

export async function startAnimationLab(container: HTMLElement): Promise<void> {
  container.innerHTML = '';
  const renderer = new WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
  container.append(renderer.domElement); await renderer.init();
  const scene = new Scene(); scene.background = new Color('#17252d');
  scene.add(new HemisphereLight(0xdceeff, 0x203020, 2.3));
  const sun = new DirectionalLight(0xffffff, 3); sun.position.set(3, 5, -4);
  const grid = new GridHelper(20, 20, 0x78909c, 0x33444b); scene.add(sun, grid);
  const camera = new PerspectiveCamera(42, innerWidth / innerHeight, 0.01, 100); camera.position.set(0, 1.35, -4.1);
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 1.02, 0); controls.update();

  const character = new CharacterModel(); scene.add(character.group); await character.initializeAnimations();
  const helper = new SkeletonHelper(character.skinnedMeshes[0].skeleton.bones[0]); helper.visible = false; scene.add(helper);
  const names = character.clipNames;
  const ordered = [...PREFERRED.filter(name => names.includes(name)), ...names.filter(name => !PREFERRED.includes(name)).sort()];
  const panel = document.createElement('section'); panel.className = 'animation-lab';
  panel.innerHTML = `<h1>DR Manaus · UAL Superhero</h1><label>Clip <select>${ordered.map(name => `<option>${name}</option>`).join('')}</select></label><div><button data-action="play">Play</button><button data-action="pause">Pause</button><button data-action="restart">Restart</button></div><div><button data-view="front">Front</button><button data-view="side">Side</button><button data-view="back">Back</button></div><label>Speed <input data-speed type="range" min="0.1" max="2" step="0.05" value="1"><output>1.00×</output></label><label>Time <input data-time type="range" min="0" max="1" step="0.001" value="0"></label><label><input data-skeleton type="checkbox"> skeleton helper</label><label><input data-ground type="checkbox" checked> ground grid</label><pre></pre>`;
  document.body.append(panel);
  const select = panel.querySelector('select')!;
  const speed = panel.querySelector<HTMLInputElement>('[data-speed]')!;
  const scrubber = panel.querySelector<HTMLInputElement>('[data-time]')!;
  const output = panel.querySelector('output')!, info = panel.querySelector('pre')!;
  const play = (name: string) => { character.previewClip(name); character.setAnimationPaused(false); };
  select.onchange = () => play(select.value);
  speed.oninput = () => { character.setAnimationSpeed(Number(speed.value)); output.textContent = `${Number(speed.value).toFixed(2)}×`; };
  scrubber.oninput = () => character.seekAnimation(Number(scrubber.value));
  panel.querySelector<HTMLButtonElement>('[data-action="play"]')!.onclick = () => character.setAnimationPaused(false);
  panel.querySelector<HTMLButtonElement>('[data-action="pause"]')!.onclick = () => character.setAnimationPaused(true);
  panel.querySelector<HTMLButtonElement>('[data-action="restart"]')!.onclick = () => play(select.value);
  const setView = (x: number, z: number) => { camera.position.set(x, 1.35, z); controls.target.set(0, 1.02, 0); controls.update(); };
  panel.querySelector<HTMLButtonElement>('[data-view="front"]')!.onclick = () => setView(0, -4.1);
  panel.querySelector<HTMLButtonElement>('[data-view="side"]')!.onclick = () => setView(4.1, 1.2);
  panel.querySelector<HTMLButtonElement>('[data-view="back"]')!.onclick = () => setView(0, 4.1);
  panel.querySelector<HTMLInputElement>('[data-skeleton]')!.onchange = event => { helper.visible = (event.target as HTMLInputElement).checked; };
  panel.querySelector<HTMLInputElement>('[data-ground]')!.onchange = event => { grid.visible = (event.target as HTMLInputElement).checked; };
  play(select.value);
  const clock = new Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    character.cosmicSource?.update(dt); character.cosmicMaterial?.update(dt, 'idle', 0); character.updateCosmicView(camera);
    controls.update();
    const state = character.animationDebug;
    if (state?.duration) scrubber.value = String(state.time / state.duration);
    const ground = character.groundDiagnostics;
    info.textContent = `asset: dr-manaus-character.glb\nclip: ${state?.clip ?? select.value}\ntime: ${(state?.time ?? 0).toFixed(3)} / ${(state?.duration ?? 0).toFixed(3)} s\nUAL humanoid: 65 bones\nSkinnedMesh: ${character.skinnedMeshes.length}\nrest sole Y: ${(ground.minY + ground.offset).toFixed(5)} m\nground offset: ${ground.offset.toFixed(5)} m`;
    renderer.render(scene, camera);
  });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
}
