import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { FEATURES } from '../src/core/config.ts';
import { createTerrain } from '../src/world/geodata/terrain.ts';
import { MANAUS_GROUND_COVER_Y } from '../src/world/spatial/ManausSurfacePresentation.ts';
import { ROAD_HEIGHT } from '../src/world/realcity/roads.ts';
import { TerrainDestruction } from '../src/world/destruction/TerrainDestruction.ts';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';

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
