import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Group, Mesh, MeshStandardMaterial, Raycaster, Vector2, Vector3 } from 'three/webgpu';
import { TerrainDestruction, TERRAIN_DAMAGE, terrainSurfaceKind } from '../src/world/destruction/TerrainDestruction.ts';
import { createAirport } from '../src/world/realcity/airport.ts';
import { createLargoPavement } from '../src/world/landmarks/largo/plaza.ts';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';

const GRID = TERRAIN_DAMAGE.cells + 1;
interface MaskState {
  pixels: Uint8Array;
  step: number;
  uMinimum: { value: Vector2 };
  uOrigin: { value: Vector3 };
}

// Independent reference for the current GPU's bilinear binary mask, including texel-centre UVs.
function maskAtWorld(terrain: TerrainDestruction, point: Vector3): number {
  const state = terrain as unknown as MaskState;
  const gx = (point.x + state.uOrigin.value.x - state.uMinimum.value.x) / state.step;
  const gz = (point.z + state.uOrigin.value.z - state.uMinimum.value.y) / state.step;
  if (gx < 0 || gz < 0 || gx > TERRAIN_DAMAGE.cells || gz > TERRAIN_DAMAGE.cells) return 0;
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
  const pixel = (x: number, z: number) => state.pixels[(Math.min(z, GRID - 1) * GRID + Math.min(x, GRID - 1)) * 4] / 255;
  return pixel(ix, iz) * (1 - u) * (1 - v) + pixel(ix + 1, iz) * u * (1 - v)
    + pixel(ix, iz + 1) * (1 - u) * v + pixel(ix + 1, iz + 1) * u * v;
}

function craterFixture(radius = 640) {
  const root = new Group(), terrain = new TerrainDestruction(root);
  const centre = new Vector3(19_973.3, 0, -10_021.7);
  terrain.damageAt(centre, radius, 80_000);
  terrain.damageAt(centre.clone().add(new Vector3(300, 0, 450)), 185, 20_000);
  terrain.update(centre, new Vector3());
  return { root, terrain, centre };
}

test('T_CRATER_MASK_AND_BOWL_COVERAGE_MATCH', () => {
  const { terrain } = craterFixture();
  try {
    const state = terrain as unknown as MaskState;
    const geometry = terrain.bowl.geometry, index = geometry.getIndex()!;
    const drawn = new Set<number>();
    for (let i = 0; i < geometry.drawRange.count; i += 6) {
      const a = index.getX(i), d = index.getX(i + 1), b = index.getX(i + 2);
      assert.equal(d, a + GRID); assert.equal(b, a + 1);
      assert.equal(index.getX(i + 3), b); assert.equal(index.getX(i + 4), d);
      assert.equal(index.getX(i + 5), d + 1);
      drawn.add(a);
    }
    let covered = 0;
    for (let z = 0; z < TERRAIN_DAMAGE.cells; z++) for (let x = 0; x < TERRAIN_DAMAGE.cells; x++) {
      const world = new Vector3(state.uMinimum.value.x + (x + .37) * state.step, 0,
        state.uMinimum.value.y + (z + .71) * state.step);
      const masked = maskAtWorld(terrain, world) > .0001;
      assert.equal(masked, drawn.has(z * GRID + x), `mask and indexed bowl cell disagree at ${x},${z}`);
      if (masked) covered++;
    }
    assert.ok(covered > 10_000, 'large overlapping crater coverage must be exercised');
  } finally { terrain.dispose(); }
});

test('T_CRATER_NO_BLACK_VOID', () => {
  const { root, terrain, centre } = craterFixture();
  const ray = new Raycaster(), down = new Vector3(0, -1, 0);
  try {
    // Rebase at several large city coordinates and force both span growth and recentering.
    for (const offset of [0, 280, 850]) {
      const player = centre.clone().add(new Vector3(offset, 0, -offset));
      const origin = new Vector3(Math.round(player.x / 1024) * 1024, 512, Math.round(player.z / 1024) * 1024);
      root.position.copy(origin).negate();
      terrain.update(player, origin); root.updateMatrixWorld(true);
      let hits = 0;
      for (let i = 0; i < 72; i++) {
        const angle = i * Math.PI * 2 / 72, radius = [0, 200, 480, 620, 642, 650][i % 6];
        const logical = centre.clone().add(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
        const scene = logical.clone().sub(origin);
        if (maskAtWorld(terrain, scene) <= .0001) continue;
        ray.set(scene.clone().add(new Vector3(0, 400, 0)), down);
        const hit = ray.intersectObject(terrain.bowl, false)[0];
        assert.ok(hit, `clipped sheet has no visible bowl at ${logical.toArray()} after ${offset} m recenter`);
        assert.ok(Math.abs(hit.point.y + origin.y - terrain.heightAt(logical.x, logical.z)) < 1e-4);
        hits++;
      }
      assert.ok(hits > 35, 'centre, walls and rim must each have actual rendered triangle intersections');
    }
  } finally { terrain.dispose(); }
});

test('T_CRATER_ROAD_HANDLING_CONSISTENT', () => {
  const { root, terrain, centre } = craterFixture(90);
  const shared = new MeshStandardMaterial();
  const leaf = (name: string) => { const mesh = new Mesh(new BufferGeometry(), shared); mesh.name = name; return mesh; };
  const road = leaf('real-roads-local'), paint = leaf('real-roads-markings');
  const legacy = leaf('legacy-osm-roads'), sheet = leaf('ground-cover');
  const wall = leaf('building-wall'), roof = leaf('building-roof'), lamp = leaf('real-roads-lamps');
  const district = new Group(); district.name = 'largo-sao-sebastiao';
  const plaza = createLargoPavement();
  district.add(road, paint, legacy, sheet, wall, roof, lamp, plaza); root.add(district);
  try {
    terrain.attach(district); terrain.attach(district);
    assert.equal(terrain.stats.surfaces, 5, 'only ground leaves register, once each');
    for (const mesh of [road, paint, legacy, plaza]) {
      assert.ok((mesh.material as MeshStandardMaterial).name.includes(':crater-band'));
      assert.ok((mesh.material as unknown as { maskNode: unknown }).maskNode);
    }
    assert.ok((sheet.material as MeshStandardMaterial).name.includes(':crater-sheet'));
    for (const mesh of [wall, roof, lamp]) {
      assert.equal(terrainSurfaceKind(mesh), undefined);
      assert.equal(mesh.material, shared, 'structures retain their original material');
    }
    assert.ok(maskAtWorld(terrain, centre) > .999, 'roads and ground share the excavated footprint');
    assert.equal(maskAtWorld(terrain, centre.clone().add(new Vector3(150, 0, 0))), 0);
    road.geometry.dispose(); assert.equal(terrain.stats.surfaces, 4);
    terrain.detach(district); assert.equal(terrain.stats.surfaces, 0);
    assert.equal(paint.material, shared);
  } finally { terrain.dispose(); shared.dispose(); plaza.geometry.dispose(); }
});

test('T_CRATER_GROUND_COLLISION_MATCHES_VISIBLE_BOWL', () => {
  const { root, terrain, centre } = craterFixture(200);
  const ray = new Raycaster(), down = new Vector3(0, -1, 0);
  root.updateMatrixWorld(true); PhysicsWorld.setTerrain(terrain);
  try {
    for (let i = 0; i < 48; i++) {
      const angle = i * Math.PI * 2 / 48, radius = [0, 45, 120, 192][i % 4];
      const x = centre.x + Math.cos(angle) * radius, z = centre.z + Math.sin(angle) * radius;
      const origin = new Vector3(x, 300, z);
      ray.set(origin, down);
      const visual = ray.intersectObject(terrain.bowl, false)[0];
      const collision = PhysicsWorld.raycast(origin, down, [], 600, 0, true);
      assert.ok(visual && collision, 'visual bowl and local physics both supply the floor');
      assert.ok(Math.abs(visual.point.y - collision.point.y) < 1e-4, `${visual.point.y} != ${collision.point.y}`);
      assert.ok(Math.abs(terrain.heightAt(x, z) - visual.point.y) < 1e-4);
    }
  } finally { PhysicsWorld.setTerrain(null); terrain.dispose(); }
});

test('airport pavement classification excludes hangars, tanks, roofs and poles', () => {
  const airport = createAirport(), terrain = new TerrainDestruction(new Group());
  let surfaces = 0, structures = 0;
  try {
    terrain.attach(airport);
    airport.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const role = terrainSurfaceKind(object);
      const positions = object.geometry.getAttribute('position');
      if (role) {
        assert.equal(role, 'road'); surfaces++;
        for (let i = 0; i < positions.count; i++) assert.ok(positions.getY(i) <= .611,
          'only pavement and authored lane paint can enter ground batches');
      } else {
        structures++;
        assert.ok(!(object.material as MeshStandardMaterial).name.includes(':crater-'));
      }
    });
    assert.ok(surfaces >= 5 && structures >= 5);
    assert.equal(terrain.stats.surfaces, surfaces);
  } finally {
    terrain.dispose();
    airport.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
  }
});
