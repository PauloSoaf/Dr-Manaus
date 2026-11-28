import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { FEATURES } from '../src/core/config.ts';
import { createTerrain, setTerrainOpacity } from '../src/world/geodata/terrain.ts';
import { MANAUS_GROUND_COVER_Y } from '../src/world/spatial/ManausSurfacePresentation.ts';
import { ROAD_HEIGHT } from '../src/world/realcity/roads.ts';
import { TerrainDestruction } from '../src/world/destruction/TerrainDestruction.ts';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { Game } from '../src/game/Game.ts';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore.ts';
import { DestructionSystem } from '../src/world/destruction/DestructionSystem.ts';
import { powerExcavation, type ExcavationFootprint } from '../src/world/destruction/ExcavationFootprint.ts';

test('T9: curvedManaus false means ground-cover, backdrop, and roads remain in flat space', () => {
  assert.equal(FEATURES.curvedManaus, false, 'curvedManaus must remain false');
  const root = new Group();
  const terrain = createTerrain(root);

  const backdrop = terrain.getObjectByName('terrain-backdrop') as Mesh;
  assert.ok(backdrop, 'backdrop exists');
  assert.equal(backdrop.userData.terrainSurface, 'sheet');
  assert.equal(backdrop.userData.terrainFallback, true);
  const backdropAttr = backdrop.geometry.getAttribute('position');
  for (let i = 1; i < backdropAttr.count * 3; i += 3) {
    assert.ok(Math.abs(backdropAttr.array[i] - (-0.6)) < 1e-4, 'backdrop Y must remain at authored -0.6');
  }

  const groundCover = terrain.getObjectByName('ground-cover') as Mesh;
  assert.ok(groundCover, 'ground-cover exists');
  assert.equal(groundCover.userData.terrainSurface, 'sheet');
  const groundAttr = groundCover.geometry.getAttribute('position');
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), normal = new Vector3();
  for (const name of ['ground-cover', 'manaus-riverbed']) {
    const mesh = terrain.getObjectByName(name) as Mesh;
    const pos = mesh.geometry.getAttribute('position');
    const normals = mesh.geometry.getAttribute('normal');
    for (let i = 0; i < pos.count; i += 57) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1).sub(a); c.fromBufferAttribute(pos, i + 2).sub(a);
      assert.ok(b.cross(c).normalize().dot(normal.fromBufferAttribute(normals, i)) > 0, `${name} face ${i / 3}`);
    }
  }
  const destruction = new TerrainDestruction(root);
  destruction.attach(terrain);
  const coverMaterial = groundCover.material as MeshStandardMaterial;
  assert.equal(coverMaterial.vertexColors, true);
  setTerrainOpacity(terrain, .5);
  assert.equal(coverMaterial.depthWrite, false);
  setTerrainOpacity(terrain, 1);
  assert.equal(coverMaterial.transparent, false);
  assert.equal(coverMaterial.depthWrite, true);
  assert.equal(coverMaterial.opacity, 1);
  destruction.dispose();
  for (let i = 1; i < groundAttr.count * 3; i += 3) {
    assert.equal(groundAttr.array[i], MANAUS_GROUND_COVER_Y, 'ground-cover Y follows the single surface authority');
  }
  // The invariant the number exists for: every road class clears the cover by at least 2 cm. The
  // cover used to sit at 0.02, which left service streets exactly level with it.
  for (const [klass, y] of Object.entries(ROAD_HEIGHT)) {
    assert.ok(y - MANAUS_GROUND_COVER_Y >= 0.02, `${klass} asphalt must clear the ground cover`);
  }

  const roads = terrain.getObjectByName('legacy-osm-roads') as Mesh;
  if (roads) {
    assert.equal(roads.userData.terrainSurface, 'road');
    const roadAttr = roads.geometry.getAttribute('position');
    for (let i = 1; i < roadAttr.count * 3; i += 3) {
      const y = roadAttr.array[i];
      assert.ok(y >= 0.159 && y <= 0.171, `road Y (${y}) must remain at authored flat elevation [0.16, 0.17]`);
    }
  }
});

test('T10: terrain-backdrop and ground-cover are masked as sheet without vertical Y restriction', () => {
  const root = new Group();
  const terrain = new TerrainDestruction(root);

  const backdrop = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
  backdrop.name = 'terrain-backdrop';
  backdrop.userData.terrainSurface = 'sheet';

  terrain.registerSurface(backdrop);
  const mat = backdrop.material as any;
  assert.ok(mat.maskNode, 'maskNode must be configured');
  assert.ok(mat.name.includes(':crater-sheet'), 'must use crater-sheet material');

  const regularBox = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
  regularBox.name = 'building-sidewalk';
  regularBox.userData.terrainSurface = 'band';
  terrain.registerSurface(regularBox);
  const boxMat = regularBox.material as any;
  assert.ok(boxMat.name.includes(':crater-band'), 'sidewalk must use crater-band material');

  terrain.dispose();
});

test('T11: crater physics and visual bowl depth agree within grid tolerance', () => {
  const root = new Group();
  const terrain = new TerrainDestruction(root);
  const p = new Vector3(100, 0, 100);
  
  terrain.damageAt(p, 20, 2600);
  terrain.update(p, p);
  PhysicsWorld.setTerrain(terrain);

  try {
    const physicsDepth = terrain.heightAt(p.x, p.z);
    assert.ok(physicsDepth < -5, 'physics floor must be excavated');

    const rayOrigin = new Vector3(p.x, 50, p.z);
    const hit = PhysicsWorld.raycast(rayOrigin, new Vector3(0, -1, 0), [], 100, 0, true);
    assert.ok(hit, 'raycast must hit the crater bottom');
    assert.ok(
      Math.abs(hit.point.y - physicsDepth) < 0.05,
      `raycast hit y (${hit.point.y}) must match physics depth (${physicsDepth})`,
    );
  } finally {
    PhysicsWorld.setTerrain(null);
    terrain.dispose();
  }
});

test('structural damage does not excavate and repeated direct cuts preserve the approved footprint', () => {
  const root = new Group(), terrain = new TerrainDestruction(root);
  const at = new Vector3(80, 0, 80);
  const system = new DestructionSystem(root, { colliders: () => [
    { id: 'wall', x: 80, y: 2, z: 80, width: 3, height: 4, depth: 1 },
  ], destroy: () => true, deform: (...args) => terrain.damageAt(...args) });
  try {
    assert.equal(system.damageAt(at, 48, 500_000), 1);
    assert.equal(terrain.craters.length, 0);
    for (let i = 0; i < 40; i++) terrain.excavateAt(at, powerExcavation('laser', 1, i / 20));
    terrain.update(at, new Vector3());
    assert.equal(terrain.craters.length, 1);
    assert.equal(terrain.craters[0].depth, .9);
    assert.equal(terrain.craters[0].radius, 2);
    assert.ok(terrain.heightAt(at.x, at.z) < -.8);
    assert.equal(terrain.restoreAt(at, 4), 1);
    terrain.update(at, new Vector3());
    assert.equal(terrain.heightAt(at.x, at.z), 0);
  } finally { terrain.dispose(); }
});

test('planetary damage needs a valid footprint, and repeated hits preserve depth relative to the intact surface', () => {
  const edits = new PlanetVolumeEditStore();
  const empty = () => 0;
  const game = Object.assign(Object.create(Game.prototype), {
    physicsDomain: 'moon',
    travelDomain: { localPhysicsActive: true },
    surfaceTerrains: new Map([['moon', { heightAt: () => 0 }]]),
    universe: {
      player: { frame: 'moon/local-enu' },
      navigationState: { bodyId: 'moon' },
      frames: { convertPosition: (_a: string, _b: string, point: number[]) => point,
        convertDirection: (_a: string, _b: string, direction: number[]) => direction },
      volume: { edits },
    },
    alienFlora: { destroyInRadius: empty }, alienFauna: { damageInRadius: empty },
    alienSettlements: { damageInRadius: empty }, cosmicRuins: { damageInRadius: empty },
  }) as { applyPowerDamage(p: Vector3, radius: number, damage: number, excavation?: ExcavationFootprint | 0): number };
  const ground = new Vector3();
  PhysicsWorld.setTerrain({ heightAt: () => 0 });
  try {
    game.applyPowerDamage(ground, 48, 500_000, 0);
    game.applyPowerDamage(new Vector3(0, 60, 0), 48, 500_000, powerExcavation('shockwave', 1));
    assert.equal(edits.editCount, 0);
    const cut = powerExcavation('energy', 1);
    for (let i = 0; i < 20; i++) game.applyPowerDamage(ground, 16, 250_000, cut);
    const [edit] = edits.editsForBody('moon');
    assert.equal(edits.editCount, 1);
    assert.ok(edit.type === 'subtract-sphere');
    assert.equal(edit.impact?.craterDepthM, cut.depthM);
    assert.ok(Math.abs(edit.centerBodyFixedM[1] - edit.radiusM + cut.depthM) < 1e-8);
  } finally { PhysicsWorld.setTerrain(null); }
});
