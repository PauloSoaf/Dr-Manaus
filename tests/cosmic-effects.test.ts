import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, Vector3 } from 'three/webgpu';
import { CosmicAura } from '../src/player/cosmic/CosmicAura.ts';
import { CosmicTrail, COSMIC_TRAIL_BUDGET } from '../src/player/cosmic/CosmicTrail.ts';

const FORWARD = new Vector3(0, 0, -1);

function setup() {
  const root = new Group(), character = new Group(); root.add(character);
  const aura = new CosmicAura(character), trail = new CosmicTrail(character);
  return { root, character, aura, trail };
}

test('cosmic aura stays a subtle immutable accent and vanishes when idle', () => {
  const { aura, trail } = setup();
  const geometry = aura.mesh.geometry, material = aura.mesh.material;
  assert.equal(aura.mesh.visible, false);
  for (let i = 0; i < 180; i++) aura.update(1 / 60, 'mega', 8000, FORWARD);
  assert.ok(aura.mesh.material.opacity <= 0.1);
  assert.equal(aura.mesh.geometry, geometry); assert.equal(aura.mesh.material, material);
  assert.equal(geometry.hasAttribute('anchor'), false, 'the old particle skin has been removed');
  assert.ok(geometry.boundingSphere && geometry.boundingSphere.radius < 0.6);
  for (let i = 0; i < 180; i++) aura.update(1 / 60, 'idle', 0, FORWARD);
  assert.equal(aura.mesh.visible, false); aura.dispose(); trail.dispose();
});

test('mega ribbons and streaks share one fixed mesh and remain within the effect budget', () => {
  const { root, character, aura, trail } = setup();
  const geometry = trail.mesh.geometry, positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
  for (let i = 0; i < 600; i++) {
    character.position.z -= 8000 / 60;
    trail.update(1 / 60, 'mega', 8000, FORWARD); aura.update(1 / 60, 'mega', 8000, FORWARD);
  }
  assert.equal(trail.mesh.visible, true); assert.equal(trail.mesh.parent, root);
  assert.equal(trail.mesh.geometry, geometry); assert.equal(geometry.getAttribute('position'), positions); assert.equal(geometry.getAttribute('color'), colors);
  assert.equal(trail.sampleCount, COSMIC_TRAIL_BUDGET.samples);
  let meshes = 0; root.traverse(object => { if (object instanceof Mesh) meshes++; });
  assert.equal(meshes, 2, 'aura plus trail require only two extra draw calls');
  const liveVertices = geometry.drawRange.count / 6 * 4;
  for (let i = 0; i < liveVertices; i++) {
    const distance = Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i));
    assert.ok(Number.isFinite(distance) && distance <= COSMIC_TRAIL_BUDGET.maxLength + 0.1, `bounded vertex ${i}: ${distance}`);
    assert.ok(colors.getW(i) >= 0 && colors.getW(i) <= 0.32);
  }
  aura.dispose(); trail.dispose();
});

test('trail keeps precise local vertices and unchanged history across floating-origin rebases', () => {
  const { root, character, aura, trail } = setup();
  character.position.set(100000000, 100, -100000000);
  for (let i = 0; i < 12; i++) { character.position.z -= 2; trail.update(1 / 60, 'flight', 120, FORWARD); }
  const before = Array.from(trail.mesh.geometry.getAttribute('position').array);
  const samples = trail.sampleCount;
  root.position.set(-100000000, 0, 100000000);
  trail.update(0, 'flight', 120, FORWARD);
  assert.equal(trail.sampleCount, samples);
  assert.deepEqual(Array.from(trail.mesh.geometry.getAttribute('position').array), before);
  assert.equal(trail.mesh.position.z, character.position.z);
  aura.dispose(); trail.dispose();
});

test('teleport clears ribbon history instead of drawing a line across the city', () => {
  const { character, aura, trail } = setup();
  for (let i = 0; i < 12; i++) { character.position.z -= 20; trail.update(1 / 60, 'boost', 1200, FORWARD); }
  assert.ok(trail.sampleCount > 1 && trail.mesh.visible);
  character.position.x += 14000;
  trail.update(1 / 60, 'boost', 1200, FORWARD);
  assert.equal(trail.sampleCount, 1); assert.equal(trail.mesh.visible, false); assert.equal(trail.mesh.geometry.drawRange.count, 0);
  aura.dispose(); trail.dispose();
});

test('trail expires after stopping and rejects invalid transforms without NaN geometry', () => {
  const { character, aura, trail } = setup();
  for (let i = 0; i < 12; i++) { character.position.z -= 20; trail.update(1 / 60, 'boost', 1200, FORWARD); }
  for (let i = 0; i < 60; i++) trail.update(1 / 60, 'idle', 0, FORWARD);
  assert.equal(trail.mesh.visible, false);
  character.position.x = NaN; trail.update(NaN, 'mega', Infinity, new Vector3(NaN, 0, 0));
  assert.equal(trail.mesh.visible, false); assert.equal(trail.sampleCount, 0);
  for (const value of trail.mesh.geometry.getAttribute('position').array) assert.ok(Number.isFinite(value));
  aura.dispose(); trail.dispose();
});

test('effects dispose their geometry/material once and cannot reattach after disposal', () => {
  const { root, character, aura, trail } = setup();
  trail.update(1 / 60, 'flight', 120, FORWARD);
  let geometries = 0, materials = 0;
  for (const mesh of [aura.mesh, trail.mesh]) {
    mesh.geometry.addEventListener('dispose', () => geometries++);
    mesh.material.addEventListener('dispose', () => materials++);
  }
  aura.dispose(); trail.dispose(); aura.dispose(); trail.dispose();
  aura.update(1 / 60, 'mega', 8000, FORWARD); trail.update(1 / 60, 'mega', 8000, FORWARD);
  assert.equal(geometries, 2); assert.equal(materials, 2);
  assert.equal(character.children.length, 0); assert.equal(root.children.length, 1);
});
