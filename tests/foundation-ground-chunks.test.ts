import assert from 'node:assert/strict';
import test from 'node:test';
import { Frustum, Group, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { WORLD } from '../src/core/config';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import {
  BUILDING_STRIDE, GROUND_SEGMENTS, TREE_STRIDE, createRegionId, defaultChunkGenerationContext,
  interpolateGroundHeight, type ChunkGenerationContext, type ChunkPayload,
} from '../src/world/chunks/Chunk';
import { generateChunk } from '../src/world/chunks/BuildingGenerator';
import { ChunkMeshes, type ChunkCullBounds } from '../src/world/chunks/ChunkMeshes';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer';
import { OceanHorizonPresentation } from '../src/world/water/OceanHorizonPresentation';
import { manausBathymetry } from '../src/world/water/ManausBathymetry';
import { earthSurfaceChart, localSeaLevelY } from '../src/world/planet/LocalSurface';
import { EARTH } from '../src/world/planet/PlanetBody';
import { bindEarthSite, findEastCoast } from './helpers/earth-surface';

function canvasStub(): () => void {
  const previous = globalThis.document;
  const context = { fillStyle: '', fillRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  return () => { globalThis.document = previous; };
}

const remote = (latDeg: number, lonDeg: number): ChunkGenerationContext => ({
  ...defaultChunkGenerationContext(), isManaus: false, latDeg, lonDeg, frameId: 'earth/local-enu',
  regionId: createRegionId('earth', false, latDeg, lonDeg),
});

/** Production meshes of one payload as the game builds them outside Manaus. */
function built(t: test.TestContext, payload: ChunkPayload) {
  const restoreDocument = canvasStub(), previous = ChunkMeshes.isLocalManausActive;
  ChunkMeshes.isLocalManausActive = false;
  const meshes = new ChunkMeshes();
  const result = meshes.create(payload);
  t.after(() => {
    meshes.disposeChunk(result.group); meshes.dispose();
    ChunkMeshes.isLocalManausActive = previous; restoreDocument();
  });
  return { ...result, meshes };
}

for (const [name, latDeg, lonDeg] of [['Brasília', -15.7939, -47.8828], ['La Paz', -16.5, -68.15]] as const) {
  test(`${name}: relief chunks, trees and colliders stand on the collision ground, near and 30 km out`, t => {
    const site = bindEarthSite(latDeg, lonDeg);
    t.after(() => site.restore());
    const size = WORLD.chunkSize, stride = GROUND_SEGMENTS + 1, step = size / GROUND_SEGMENTS;
    for (const [cx, cz] of [[0, 0], [-4, 3], [235, -170]]) {
      const payload = generateChunk(cx, cz, remote(latDeg, lonDeg));
      assert.ok(payload.ground, 'dry highland chunks carry relief');
      const originX = cx * size, originZ = cz * size;
      for (let j = 0; j < stride; j++) for (let i = 0; i < stride; i++) {
        const physics = PhysicsWorld.terrainHeight(originX + i * step, originZ + j * step);
        assert.ok(Math.abs(payload.ground![j * stride + i] - physics) < .01, `vertex ${i},${j} of ${cx},${cz}`);
      }
      // Between vertices the drawn triangle stays on the smooth relief.
      for (const [lx, lz] of [[3, 5], [61.7, 70.2], [120, 9]]) {
        const drawn = interpolateGroundHeight(payload.ground!, lx, lz, size);
        assert.ok(Math.abs(drawn - PhysicsWorld.terrainHeight(originX + lx, originZ + lz)) < .05);
      }
      const { group, colliders, meshes } = built(t, payload);
      const ground = group.getObjectByName('forest-ground') as Mesh;
      const position = ground.geometry.getAttribute('position'), index = ground.geometry.index!;
      const a = new Vector3(), b = new Vector3(), c = new Vector3();
      for (let face = 0; face < GROUND_SEGMENTS * GROUND_SEGMENTS * 2; face++) {
        a.fromBufferAttribute(position, index.getX(face * 3));
        b.fromBufferAttribute(position, index.getX(face * 3 + 1)).sub(a);
        c.fromBufferAttribute(position, index.getX(face * 3 + 2)).sub(a);
        assert.ok(b.cross(c).y > 0, 'relief faces point up');
      }
      const bounds = group.userData.cullBounds as ChunkCullBounds;
      for (let n = 0; n < payload.trees.length / TREE_STRIDE; n++) {
        const x = payload.trees[n * TREE_STRIDE], z = payload.trees[n * TREE_STRIDE + 1], height = payload.trees[n * TREE_STRIDE + 2];
        const collider = colliders.find(item => item.id === `${payload.key}/tree/${n}`)!;
        assert.ok(Math.abs(collider.y - height / 2 - PhysicsWorld.terrainHeight(x, z)) < .1, 'tree stands on the ground');
        const trunk = new Matrix4();
        (group.getObjectByName('tree-trunks') as InstancedMesh).getMatrixAt(n, trunk);
        assert.ok(Math.abs(new Vector3().setFromMatrixPosition(trunk).y - collider.y) < 1e-3);
        assert.ok(collider.y + height / 2 <= bounds.maxY && collider.y - height / 2 >= bounds.minY);
        // Rebuilding after destruction returns the tree to the same height.
        const rebuilt = meshes.restore(group, payload, collider.id!)!;
        assert.ok(Math.abs(rebuilt.y - collider.y) < 1e-3);
      }
    }
  });
}

test('coastal chunks draw water only where the ground is under the curved sea, and grow no trees in it', t => {
  const coastLon = findEastCoast(-8.05, -36.5, -33.5);
  const site = bindEarthSite(-8.05, coastLon);
  t.after(() => site.restore());
  const chart = earthSurfaceChart(-8.05, coastLon);
  let mixed: ChunkPayload | undefined;
  for (let cx = -4; cx <= 4 && !mixed; cx++) {
    const payload = generateChunk(cx, 0, remote(-8.05, coastLon));
    if (payload.ground && payload.seaPlane) mixed = payload;
  }
  assert.ok(mixed, 'a chunk on the shoreline has both ground and water');
  const originX = mixed.cx * WORLD.chunkSize, originZ = mixed.cz * WORLD.chunkSize;
  for (let n = 0; n < mixed.trees.length / TREE_STRIDE; n++) {
    const x = mixed.trees[n * TREE_STRIDE], z = mixed.trees[n * TREE_STRIDE + 1];
    assert.ok(mixed.treeBase![n] - localSeaLevelY(chart, EARTH, x, z) >= 1, 'no tree grows in the water');
  }
  const { group } = built(t, mixed);
  assert.ok(group.getObjectByName('forest-ground'));
  const ocean = group.getObjectByName('ocean-surface') as InstancedMesh;
  assert.ok(ocean, 'the wet part carries water');
  const matrix = new Matrix4();
  ocean.getMatrixAt(0, matrix);
  const centre = new Vector3(64, 0, 64).applyMatrix4(matrix);
  assert.ok(Math.abs(centre.y - localSeaLevelY(chart, EARTH, originX + 64, originZ + 64)) < .01, 'water sits at sea level');
  const position = ocean.geometry.getAttribute('position');
  for (let quad = 0; quad < position.count; quad += 4) {
    let reaches = false;
    for (let corner = 0; corner < 4; corner++) {
      const x = position.getX(quad + corner), z = position.getZ(quad + corner);
      const sea = localSeaLevelY(chart, EARTH, originX + x, originZ + z);
      reaches ||= interpolateGroundHeight(mixed.ground!, x, z, WORLD.chunkSize) < sea + .31;
    }
    assert.ok(reaches, 'no water quad floats over dry ground only');
  }
  // A full 24×24 water grid has 2304 quad vertices; a shoreline tile must need fewer.
  assert.ok(position.count > 0 && position.count < 24 * 24 * 4, `part of the tile is dry (${position.count})`);
});

test('worker transfer keeps every relief buffer', () => {
  const payload = generateChunk(1, 2, remote(-15.7939, -47.8828));
  const expected = Array.from(payload.ground!);
  const transfer = [payload.buildings, payload.trees, payload.ground, payload.groundColors, payload.treeBase]
    .flatMap(array => array ? [array.buffer] : []) as ArrayBuffer[];
  const moved = structuredClone(payload, { transfer });
  assert.equal(payload.ground!.byteLength, 0);
  assert.deepEqual(Array.from(moved.ground!), expected);
  assert.equal(moved.treeBase!.length, moved.trees.length / TREE_STRIDE);
});

test('published volume replacements open the relief beneath them and restore it afterwards', t => {
  const payload = generateChunk(0, 0, remote(23, 12));
  const { group } = built(t, payload);
  const ground = group.getObjectByName('forest-ground') as Mesh;
  const full = ground.geometry.index!.count;
  const hole = (x: number, _y: number, z: number) => Math.hypot(x - 64, z - 64) < 30;
  ChunkMeshes.maskGround(group, hole);
  assert.ok(ground.geometry.index!.count < full);
  const position = ground.geometry.getAttribute('position'), index = ground.geometry.index!;
  for (let t = 0; t < index.count; t += 3) {
    const centre = [0, 1, 2].map(k => index.getX(t + k)).reduce((sum, v) => [sum[0] + position.getX(v) / 3, sum[1] + position.getZ(v) / 3], [0, 0]);
    assert.ok(!hole(centre[0], 0, centre[1]), 'no triangle covers the replaced space');
  }
  ChunkMeshes.maskGround(group, null);
  assert.equal(ground.geometry.index!.count, full);
});

test('a tall building top stays visible when only the top is on screen', async t => {
  const restoreDocument = canvasStub();
  const root = new Group(), streamer = new WorldStreamer(root);
  t.after(() => { streamer.dispose(); restoreDocument(); });
  let tallest = { height: 0, x: 0, z: 0 };
  for (let cz = -20; cz <= 4; cz++) for (let cx = -12; cx <= 12; cx++) {
    const payload = generateChunk(cx, cz);
    for (let p = 0; p < payload.buildings.length; p += BUILDING_STRIDE) {
      if (payload.buildings[p + 3] > tallest.height) tallest = { height: payload.buildings[p + 3], x: payload.buildings[p], z: payload.buildings[p + 1] };
    }
  }
  assert.ok(tallest.height > 52, `fixture needs a tall building, found ${tallest.height}`);
  await streamer.prepare(new Vector3(tallest.x, 2, tallest.z));
  const key = `earth:manaus::${Math.floor(tallest.x / WORLD.chunkSize)},${Math.floor(tallest.z / WORLD.chunkSize)}`;
  const chunk = (streamer as unknown as { records: Map<string, { group: Group }> }).records.get(key)!;
  // A narrow level view from 600 m away at the roof band: everything below 45 m is off screen.
  const camera = new PerspectiveCamera(1, 1, 1, 2000);
  camera.position.set(tallest.x, tallest.height - 2, tallest.z + 600);
  camera.lookAt(tallest.x, tallest.height - 2, tallest.z);
  camera.updateMatrixWorld(true);
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  streamer.cullFrustum(frustum, camera.position, 10);
  assert.equal(chunk.group.visible, true);
});

test('the ocean horizon rides the curved sea far from the frame anchor', t => {
  const site = bindEarthSite(10, -35);
  const horizon = new OceanHorizonPresentation();
  t.after(() => site.restore());
  const player = new Vector3(50_000, 0, 30_000);
  horizon.update(player, true, false, (x, z) => manausBathymetry.seaLevelAt(x, z));
  const outer = horizon.group.getObjectByName('ocean-horizon-outer-clipmap') as Mesh;
  outer.updateMatrixWorld(true);
  const chart = earthSurfaceChart(10, -35);
  assert.ok(outer.position.y < -150, `the sea sags ${outer.position.y} m at 58 km from the anchor`);
  const position = outer.geometry.getAttribute('position');
  // Ring vertices out to a few kilometres lie on the true sea surface, tilted with it.
  for (let v = 0; v < 128 * 6; v += 17) {
    const world = new Vector3().fromBufferAttribute(position, v).applyMatrix4(outer.matrixWorld);
    assert.ok(Math.abs(world.y - localSeaLevelY(chart, EARTH, world.x, world.z)) < .6, `ring vertex ${v} off by ${world.y - localSeaLevelY(chart, EARTH, world.x, world.z)}`);
  }
});
