import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Scene, Vector3 } from 'three/webgpu';
import { SpeedVFX } from '../src/rendering/SpeedVFX.ts';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import { CameraController } from '../src/player/CameraController.ts';
import { FLIGHT } from '../src/player/flightConfig.ts';
import { SPACE } from '../src/core/config.ts';
import { PowerSystem, type PowerHooks } from '../src/player/powers/PowerSystem.ts';
import type { InputController } from '../src/player/InputController.ts';
import type { Collider, Target } from '../src/core/types.ts';

const classes = new Set<string>();
Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: { classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) } } } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

function controls() {
  const held = new Set<string>(), edges = new Set<string>();
  const input = {
    enabled: true, mouseDelta: { x: 0, y: 0 },
    held: (code: string) => input.enabled && held.has(code),
    pressed: (code: string) => input.enabled && edges.has(code),
    consume: (code: string) => { const result = input.enabled && edges.has(code); edges.delete(code); return result; },
  } as unknown as InputController;
  return { input, held, edges };
}

function harness(options: Partial<PowerHooks> = {}) {
  const { input, held, edges } = controls();
  const root = new Group(), camera = new PerspectiveCamera(60, 1, 0.1, 30000);
  camera.position.set(0, 10, 15); camera.lookAt(0, 10, -100); camera.updateMatrixWorld();
  const player = new PlayerController(root, input); player.teleport(new Vector3(0, 8.5, 0));
  const targets: Target[] = [{ id: 'anomaly', position: new Vector3(0, 10, -60), radius: 4, kind: 'anomaly', active: true }];
  const hits: [string, number][] = [], messages: string[] = [], impulses: number[] = [];
  const hooks: PowerHooks = {
    targets: () => targets, hit: (id, force) => { hits.push([id, force]); }, reconstruct: () => 3,
    impulse: (_position, radius) => { impulses.push(radius); }, prepare: async () => undefined,
    notify: text => { messages.push(text); }, sound: () => undefined,
    getOrigin: () => new Vector3(), getColliders: () => [], ...options,
  };
  const powers = new PowerSystem(root, player, camera, input, hooks);
  return { powers, player, camera, input, held, edges, hits, messages, impulses, targets, root };
}

test('continuous character sweep stops supersonic movement at a thin wall', () => {
  const physics = new PhysicsWorld(), position = new Vector3(0, 1, 0), velocity = new Vector3(720, 0, 0);
  const wall: Collider[] = [{ x: 10, y: 5, z: 0, width: 2, height: 10, depth: 20 }];
  physics.move(position, velocity, 0.05, 0.32, 2.1, wall);
  assert.ok(Math.abs(position.x - 8.68) < 0.001);
  assert.equal(velocity.x, 0);
});

test('fast falls land on roofs and safe teleport resolves solid destinations', () => {
  const physics = new PhysicsWorld(), position = new Vector3(0, 30, 0), velocity = new Vector3(0, -720, 0);
  const roof: Collider[] = [{ x: 0, y: 5, z: 0, width: 20, height: 10, depth: 20 }];
  assert.equal(physics.move(position, velocity, 0.05, 0.32, 2.1, roof), true);
  assert.equal(position.y, 10); assert.equal(velocity.y, 0);
  assert.equal(PhysicsWorld.safeLanding(new Vector3(0, 2, 0), roof, 0.4, 2.1).y, 10.05);
  assert.equal(PhysicsWorld.raycast(new Vector3(0, 20, 0), new Vector3(0, -1, 0), roof, 100)?.distance, 10);
});

test('flight accelerates smoothly into boost and colossal movement adjusts scale', () => {
  const { input, held, edges } = controls();
  const player = new PlayerController(new Group(), input); player.position.set(0, 0, 0);
  for (let i = 0; i < 10; i++) player.update(1 / 60, [], 0);
  edges.add('KeyF'); held.add('Space');
  for (let i = 0; i < 60; i++) player.update(1 / 60, [], 0);
  assert.notEqual(player.state, 'Grounded'); assert.ok(player.position.y > 20);
  held.delete('Space'); held.add('KeyB');
  player.update(1 / 60, [], 0); assert.ok(player.velocity.length() < 300, 'boost accelerates rather than setting velocity instantly');
  for (let i = 0; i < 90; i++) player.update(1 / 60, [], 0);
  assert.ok(player.velocity.length() > 1500);
  player.setSize(22);
  for (let i = 0; i < 150; i++) player.update(1 / 60, [], 0);
  assert.equal(player.size, 22);
});

test('flight follows camera pitch so W moves toward the point being looked at', () => {
  const { input, held, edges } = controls();
  const player = new PlayerController(new Group(), input);
  player.position.set(0, 8, 0);
  edges.add('KeyF'); held.add('KeyW');
  for (let i = 0; i < 75; i++) player.update(1 / 60, [], 0, -0.55);
  assert.ok(player.position.y > 30, 'looking upward while flying forward must gain altitude');
  assert.ok(Math.hypot(player.position.x, player.position.z) > 35);
});

test('normal, fast and super flight have separate stable speed limits', () => {
  const { input, held } = controls();
  const player = new PlayerController(new Group(), input); player.teleport(new Vector3(0, 200, 0));
  held.add('KeyW');
  for (let i = 0; i < 120; i++) player.update(1 / 60, [], 0);
  assert.equal(player.speedMode, 'normal'); assert.ok(Math.abs(player.velocity.length() - 120) < 0.01);
  held.add('ShiftLeft');
  for (let i = 0; i < 120; i++) player.update(1 / 60, [], 0);
  assert.equal(player.speedMode, 'fast'); assert.ok(Math.abs(player.velocity.length() - 500) < 0.01);
  held.add('KeyB');
  for (let i = 0; i < 180; i++) player.update(1 / 60, [], 0);
  assert.equal(player.speedMode, 'super'); assert.ok(Math.abs(player.velocity.length() - 2000) < 0.01);
  assert.equal(player.megaMode, false);
});

test('mega mode requires explicit arming and a fresh boost after arming during super flight', () => {
  const { input, held, edges } = controls();
  const player = new PlayerController(new Group(), input); player.teleport(new Vector3(0, 200, 0));
  held.add('KeyB');
  for (let i = 0; i < 90; i++) player.update(1 / 60, [], 0);
  edges.add('KeyV'); held.add('KeyV');
  for (let i = 0; i < 90; i++) player.update(1 / 60, [], 0);
  assert.equal(player.megaMode, true); assert.equal(player.speedMode, 'super');
  assert.ok(player.velocity.length() <= FLIGHT.speeds.super);
  held.delete('KeyB'); player.update(1 / 60, [], 0);
  held.add('KeyB');
  for (let i = 0; i < 150; i++) player.update(1 / 60, [], 0);
  assert.equal(player.speedMode, 'mega'); assert.ok(player.velocity.length() > 7800 && player.velocity.length() <= 8000);
  edges.add('KeyV'); player.update(1 / 60, [], 0);
  assert.equal(player.megaMode, false); assert.equal(player.speedMode, 'super');
});

test('mega thrust ramps, follows pitch and yaw, and brakes progressively when released', () => {
  const { input, held, edges } = controls();
  const player = new PlayerController(new Group(), input); player.teleport(new Vector3(0, 100, 0));
  edges.add('KeyV'); player.update(1 / 60, [], 0);
  assert.equal(player.velocity.length(), 0, 'the arm toggle cannot propel the player');
  held.add('KeyB');
  const yaw = 0.65, pitch = -0.4;
  player.update(1 / 60, [], yaw, pitch);
  assert.ok(player.velocity.length() > 0 && player.velocity.length() < 300);
  for (let i = 0; i < 150; i++) player.update(1 / 60, [], yaw, pitch);
  const direction = new Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  assert.ok(player.velocity.clone().normalize().dot(direction) > 0.99999);
  assert.ok(player.position.y > 1000 && player.velocity.length() > 7800);
  held.delete('KeyB'); const before = player.velocity.length(); player.update(1 / 60, [], yaw, pitch);
  assert.ok(player.velocity.length() < before && player.velocity.length() > before * 0.8);
  for (let i = 0; i < 90; i++) player.update(1 / 60, [], yaw, pitch);
  assert.ok(player.velocity.length() < 1);
});

test('disabled UI input cannot arm mega and size/debug scaling respects the flight safety ceiling', () => {
  const { input, held, edges } = controls();
  const player = new PlayerController(new Group(), input); player.teleport(new Vector3(0, 200, 0));
  input.enabled = false; edges.add('KeyV'); player.update(1 / 60, [], 0);
  input.enabled = true; player.update(1 / 60, [], 0);
  assert.equal(player.megaMode, false);
  player.setSize(22); player.megaMode = true; player.speedMultiplier = 10; held.add('KeyB');
  for (let i = 0; i < 240; i++) player.update(1 / 60, [], 0);
  assert.ok(player.velocity.length() > 9900 && player.velocity.length() <= FLIGHT.maxSpeed);
});

test('mega speed keeps swept collision for thin walls and the ground at long frame times', () => {
  const physics = new PhysicsWorld(), position = new Vector3(0, 20, 0), velocity = new Vector3(8000, 0, 0);
  physics.move(position, velocity, 0.06, 0.32, 2.1, [{ x: 150, y: 25, z: 0, width: 1, height: 50, depth: 30 }]);
  assert.ok(Math.abs(position.x - 149.18) < 0.001); assert.equal(velocity.x, 0);
  position.set(0, 200, 0); velocity.set(0, -8000, 0);
  assert.equal(physics.move(position, velocity, 0.06, 0.32, 2.1, []), true);
  assert.equal(position.y, 0); assert.equal(velocity.y, 0);
});

test('climbing hard leaves the atmosphere instead of stopping at the old twelve-kilometre lid', () => {
  const { input, held, edges } = controls();
  const player = new PlayerController(new Group(), input); player.teleport(new Vector3(0, 200, 0));
  edges.add('KeyV'); player.update(1 / 60, [], 0);
  assert.equal(player.megaMode, true);
  held.add('KeyB');
  // Boost with the camera at the zenith: the thrust vector follows pitch, so this climbs straight up.
  const zenith = -Math.PI / 2;
  for (let i = 0; i < 900; i++) player.update(1 / 60, [], 0, zenith);
  assert.ok(player.position.y > SPACE.atmosphereTop, `only reached ${player.position.y.toFixed(0)} m`);
  for (let i = 0; i < 1800; i++) player.update(1 / 60, [], 0, zenith);
  assert.ok(player.position.y > SPACE.orbit, `orbit is reachable, reached ${player.position.y.toFixed(0)} m`);
  // The ceiling holds and stops accumulating upward speed rather than letting the player run away.
  for (let i = 0; i < 3600; i++) player.update(1 / 60, [], 0, zenith);
  assert.equal(player.position.y, SPACE.maxAltitude);
  assert.ok(player.velocity.y <= 0);
  // Hover flight has no gravity, so coming home is an explicit descent input, not a release.
  held.delete('KeyB'); held.add('ControlLeft');
  for (let i = 0; i < 600; i++) player.update(1 / 60, [], 0, 0);
  assert.equal(player.speedMode, 'normal');
  assert.ok(player.position.y < SPACE.maxAltitude - 500, 'the player can come back down');
});

test('energy hits the aimed target, observes cooldown, and cannot shoot through buildings', () => {
  const game = harness();
  game.powers.use('energy'); assert.equal(game.hits[0]?.[0], 'anomaly');
  game.powers.use('energy'); assert.equal(game.hits.length, 1);
  game.powers.update(0.3, 0.3); game.powers.use('energy'); assert.equal(game.hits.length, 2);
  game.powers.dispose();
  const blocked = harness({ getColliders: () => [{ x: 0, y: 10, z: -20, width: 20, height: 20, depth: 5 }] });
  blocked.powers.use('energy'); assert.equal(blocked.hits.length, 0); blocked.powers.dispose();
});

test('teleport waits for destination streaming before placing the player above solids', async () => {
  let completePreparation: () => void = () => undefined;
  const game = harness({
    prepare: () => new Promise<void>(resolve => { completePreparation = resolve; }),
    getColliders: () => [{ x: 10, y: 5, z: 10, width: 10, height: 10, depth: 10 }],
  });
  const before = game.player.position.clone();
  const pending = game.powers.teleportTo(new Vector3(10, 0, 10));
  assert.equal(game.powers.teleporting, true); assert.deepEqual(game.player.position, before); assert.ok(classes.has('teleporting'));
  completePreparation(); await pending;
  assert.deepEqual(game.player.position.toArray(), [10, 10.05, 10]);
  assert.equal(game.powers.teleporting, false); assert.equal(classes.has('teleporting'), false); game.powers.dispose();
});

test('E targets the ground from the camera ray without requiring loaded geometry', async () => {
  const game = harness(); game.camera.lookAt(0, 0, -50); game.camera.updateMatrixWorld(); game.edges.add('KeyE');
  game.powers.update(0.1, 0.1); await new Promise(resolve => setImmediate(resolve));
  assert.ok(Math.abs(game.player.position.z + 50) < 0.001);
  assert.equal(game.player.position.y, 0.08); game.powers.dispose();
});

test('shockwave preserves outer rigid bodies to throw them and reconstruction calls its world hook', () => {
  const game = harness();
  game.targets.push({ id: 'near-prop', position: new Vector3(0, 8.5, -2), radius: 1, kind: 'prop', active: true });
  game.targets.push({ id: 'outer-car', position: new Vector3(0, 8.5, -30), radius: 2, kind: 'vehicle', active: true });
  game.powers.use('shockwave');
  assert.deepEqual(game.impulses, [48]); assert.ok(game.hits.some(([id]) => id === 'near-prop'));
  assert.equal(game.hits.some(([id]) => id === 'outer-car'), false);
  game.powers.use('reconstruct'); assert.ok(game.messages.some(text => text.includes('3 objetos reconstruídos'))); game.powers.dispose();
});

test('clones attack the designated target and expire; temporal perception uses real time', () => {
  const game = harness(); game.powers.use('clone'); assert.equal(game.powers.cloneCount, 3);
  game.powers.update(1.3, 1.3); assert.ok(game.hits.length >= 3);
  game.powers.use('temporal'); assert.equal(game.powers.temporal, true);
  game.powers.update(18.1, 0.01); assert.equal(game.powers.temporal, false);
  game.powers.update(3, 3); assert.equal(game.powers.cloneCount, 0); game.powers.dispose();
});

test('the speed effect ramps and fades instead of switching on, and stays off at rest', () => {
  const vfx = new SpeedVFX(new Scene());
  try {
    assert.equal(vfx.level, 0, 'nothing at all while standing still');
    vfx.update(1 / 60, 'normal', 0);
    assert.equal(vfx.level, 0);

    // Entering super must build over several frames, never appear in one.
    vfx.update(1 / 60, 'super', 2000);
    const firstFrame = vfx.level;
    assert.ok(firstFrame > 0 && firstFrame < .2, `the effect jumped to ${firstFrame.toFixed(2)} in one frame`);
    for (let i = 0; i < 120; i++) vfx.update(1 / 60, 'super', 2000);
    const settled = vfx.level;
    assert.ok(settled > .5 && settled < .95, `super settled at ${settled.toFixed(2)}`);
    assert.ok(vfx.fovBoost > 10, 'the field of view must open with the effect');

    // Mega is visibly stronger than super.
    for (let i = 0; i < 180; i++) vfx.update(1 / 60, 'mega', 8000);
    assert.ok(vfx.level > settled + .1, 'mega must read stronger than super');
    const megaFov = vfx.fovBoost;
    assert.ok(megaFov > 25 && megaFov < 40, `mega opens the field of view to +${megaFov.toFixed(0)} degrees`);

    // Releasing decays gradually and reaches exactly zero rather than lingering.
    for (let i = 0; i < 600; i++) vfx.update(1 / 60, 'normal', 0);
    assert.equal(vfx.level, 0, 'the effect must clear completely once the player slows down');
    assert.equal(vfx.fovBoost, 0);

    // Shake follows acceleration, so a steady cruise is smooth and entering the band is not.
    for (let i = 0; i < 180; i++) vfx.update(1 / 60, 'mega', 8000);
    assert.ok(vfx.shakeFor(0) < .001, 'holding a constant speed must not shake the camera');
    assert.ok(vfx.shakeFor(9000) > .01, 'hard acceleration must be felt');
    assert.ok(vfx.shakeFor(1e9) <= .5, 'the shake is clamped');
    // A non-finite frame must not poison the ramp.
    vfx.update(Number.NaN, 'mega', 8000);
    assert.ok(Number.isFinite(vfx.level));
  } finally { vfx.dispose(); }
});

test('giant sizes reach 200 m and one kilometre then return to normal',()=>{
 const h=harness(),heights=[];
 for(let i=0;i<6;i++){h.powers.cooldowns.giant=0;h.powers.use('giant');heights.push(h.player.targetSize*2.07);}
 assert.ok(heights.some(v=>Math.abs(v-200)<.01));assert.ok(heights.some(v=>Math.abs(v-1000)<.01));assert.equal(h.player.targetSize,1);h.powers.dispose();h.player.character.dispose();
});
test('continuous laser stays visible between damage ticks and stops when paused or toggled off',()=>{
 let damage=0;const h=harness({getColliders:()=>[{id:'wall',x:0,y:10,z:-30,width:30,height:30,depth:2}],damage:()=>{damage++;return 0;}});
 h.powers.use('laser');for(let i=0;i<60;i++)h.powers.update(1/60,1/60);
 assert.equal(h.root.getObjectByName('continuous-laser')!.visible,true);assert.equal(h.root.getObjectByName('laser-glow')!.visible,true);assert.equal(h.root.getObjectByName('laser-impact')!.visible,true);assert.equal(h.root.getObjectByName('laser-impact-ring')!.visible,true);assert.ok(damage>=8&&damage<=11);
 h.input.enabled=false;h.powers.update(.1,.1);assert.equal(h.root.getObjectByName('continuous-laser')!.visible,false);assert.equal(h.root.getObjectByName('laser-glow')!.visible,false);assert.equal(h.root.getObjectByName('laser-impact')!.visible,false);
 h.input.enabled=true;h.powers.use('laser');h.powers.update(.1,.1);assert.equal(h.powers.laserActive,false);h.powers.dispose();h.player.character.dispose();
});

test('giant laser starts beyond the forward hand, scales up, and the arm aims forward',()=>{
 const h=harness();h.player.size=200/2.07;h.player.setSize(h.player.size);
 h.camera.position.set(0,200,500);h.camera.lookAt(0,160,-3000);h.camera.updateMatrixWorld();
 h.powers.use('laser');h.powers.update(.016,.016);
 const beam=h.root.getObjectByName('continuous-laser')!;
 const axis=new Vector3(0,1,0).applyQuaternion(beam.quaternion);
 const muzzle=beam.position.clone().addScaledVector(axis,-beam.scale.y/2);
 const wrist=new Vector3();h.player.character.rightHand.getWorldPosition(wrist);
 assert.ok(axis.z<0);assert.ok(muzzle.z<h.player.position.z-.5*h.player.size);assert.ok(wrist.z<h.player.position.z-.4*h.player.size);assert.ok(beam.scale.x>6);
 h.powers.dispose();h.player.character.dispose();
});
test('giant Q expands both the blast radius and damage rather than stopping at normal strength',()=>{
 const calls:number[][]=[];const h=harness({damage:(_point,radius,amount)=>{calls.push([radius,amount]);return 0;}});
 h.player.size=1000/2.07;h.powers.use('shockwave');assert.ok(calls[0][0]>1400);assert.ok(calls[0][1]>1000000);h.powers.dispose();h.player.character.dispose();
});

test('camera cycles shoulder and first person, hiding only the local hero', () => {
  const h = harness(), control = new CameraController(h.camera, h.input);
  control.skipIntro();
  h.edges.add('F5'); control.update(h.player, new Vector3(), .016, []);
  assert.equal(control.mode, 'shoulder'); assert.equal(h.player.model.visible, true);
  h.edges.add('F5'); control.update(h.player, new Vector3(), .016, []);
  assert.equal(control.mode, 'first'); assert.equal(h.player.model.visible, false);
  assert.ok(Math.abs(h.camera.position.y - h.player.position.y - 1.94) < 1e-6);
  h.edges.add('F5'); control.update(h.player, new Vector3(), .016, []);
  assert.equal(control.mode, 'front'); assert.equal(h.player.model.visible, true);
  assert.ok(h.camera.position.z < h.player.position.z);
  h.edges.add('F5'); control.update(h.player, new Vector3(), .016, []);
  assert.equal(control.mode, 'lookBack'); assert.equal(h.player.model.visible, false);
  assert.ok(h.camera.getWorldDirection(new Vector3()).z > .9);
  assert.equal(control.yaw, 0);
  h.edges.add('F5'); control.update(h.player, new Vector3(), .016, []);
  assert.equal(control.mode, 'rear'); assert.equal(h.player.model.visible, true);
});

test('double jump permits two impulses and landing restores them', () => {
  const h = harness(); h.player.teleport(new Vector3());
  h.player.update(.016, [], 0);
  h.edges.add('Space'); h.player.update(.016, [], 0); assert.ok(h.player.velocity.y > 9);
  for(let i=0;i<15;i++)h.player.update(.016, [], 0);
  h.edges.add('Space'); h.player.update(.016, [], 0); assert.ok(h.player.velocity.y > 9);
  const previous = h.player.velocity.y;
  h.edges.add('Space'); h.player.update(.016, [], 0); assert.ok(h.player.velocity.y < previous);
  for(let i=0;i<150;i++)h.player.update(.016, [], 0);
  h.edges.add('Space'); h.player.update(.016, [], 0); assert.ok(h.player.velocity.y > 9);
});

test('parkour boosts a reachable ledge jump but never passes through a ceiling', () => {
  const h = harness(); h.player.teleport(new Vector3()); h.player.update(.016, [], 0);
  h.held.add('KeyW'); h.edges.add('Space');
  const ledge = {x:0,y:1,z:-1.6,width:4,height:2,depth:1};
  h.player.update(.016, [ledge], 0); assert.ok(h.player.velocity.y > 10);
  const lowRoof = {x:0,y:2.5,z:0,width:10,height:.2,depth:10};
  for(let i=0;i<20;i++)h.player.update(.016,[ledge,lowRoof],0);
  assert.ok(h.player.position.y + 2.1 <= 2.4 + .001);
});

test('mega running invokes destruction before collision and keeps ground movement', () => {
  const h = harness(); h.player.teleport(new Vector3()); h.player.megaMode = true;
  h.held.add('KeyW'); h.held.add('KeyB'); let calls = 0;
  h.player.beforeMove = () => {calls++; return [];};
  for(let i=0;i<80;i++)h.player.update(.016,[],0);
  assert.ok(calls > 0); assert.ok(-h.player.velocity.z > 640); assert.equal(h.player.state,'Grounded');
});

test('melee mode delays contact, hits the forward obstacle, and does not fire energy', () => {
  const impacts: Vector3[] = [];
  const h = harness({getColliders:()=>[{id:'wall',x:0,y:10,z:-2,width:3,height:4,depth:1}],damage:p=>{impacts.push(p.clone());return 1;}});
  h.edges.add('KeyX');h.held.add('Mouse0');h.powers.update(.016,.016);
  assert.equal(h.powers.combatMode,'melee');assert.equal(impacts.length,0);assert.equal(h.powers.cooldowns.energy,0);
  h.powers.update(.15,.15);assert.equal(impacts.length,1);assert.ok(impacts[0].z < 0);
  h.held.clear();h.powers.update(.6,.6);h.held.add('Mouse2');h.powers.update(.01,.01);h.powers.update(.25,.25);
  assert.equal(impacts.length,2);assert.equal(h.powers.selected,'kick');
});

test('melee attacks do not damage empty space or objects behind the player', () => {
  let damage = 0;
  const h = harness({getColliders:()=>[{id:'rear',x:0,y:10,z:2,width:1,height:4,depth:1}],damage:()=>++damage});
  h.powers.use('kick');h.powers.update(.3,.3);assert.equal(damage,0);
});

test('melee cycles three distinct punches and kicks, including airborne attacks', () => {
  const h=harness(); const poses:string[]=[];
  h.player.powerPose=(name:string)=>{poses.push(name);};
  for(const kind of ['punch','kick'])for(let i=0;i<3;i++){h.powers.use(kind);h.powers.update(.8,.8);}
  assert.deepEqual(poses,['punch','punchCross','punchUpper','kick','kickSide','kickRound']);
});

test('hover, cruise and boost have distinct animated flight poses', () => {
  const h=harness(), c=h.player.character;
  for(let i=0;i<90;i++)c.animate(.016,0,true,false,'');
  const hover=c.leftArm.rotation.x, knee=c.leftShin.rotation.x;
  c.animate(.1,0,true,false,'');assert.notEqual(c.leftArm.rotation.x,hover);
  for(let i=0;i<90;i++)c.animate(.016,120,true,false,'',20,.3);
  const cruise=c.leftArm.rotation.x;
  assert.ok(cruise>hover+1); assert.ok(c.leftShin.rotation.x<knee); assert.ok(c.body.rotation.z<0);
  for(let i=0;i<90;i++)c.animate(.016,2000,true,true,'');
  assert.ok(c.leftArm.rotation.x>cruise+.3);assert.ok(c.body.rotation.x< -1.3);
  for(const pose of ['punchUpper','kickSide','kickRound']){
    for(let i=0;i<12;i++)c.animate(.016,0,false,false,pose);
    assert.ok(Number.isFinite(c.body.quaternion.lengthSq()));
  }
});
