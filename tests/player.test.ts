import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
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
    held: (code: string) => held.has(code),
    pressed: (code: string) => edges.has(code),
    consume: (code: string) => { const result = edges.has(code); edges.delete(code); return result; },
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
