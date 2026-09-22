import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { BufferAttribute, Group, InstancedMesh, Mesh, Vector3 } from 'three/webgpu';
import { REAL_CITY, WORLD } from '../src/core/config.ts';
import { RealCityLayer } from '../src/world/realcity/RealCityLayer.ts';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer.ts';

const DATA = path.resolve('public/geodata/real-city');

/** Serves the compiled city off disk so the real streaming path is what gets exercised. */
function serveGeodata(): () => void {
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(typeof input === 'object' && 'url' in input ? input.url : input);
    const marker = url.indexOf('geodata/real-city/');
    if (marker < 0) return new Response(null, { status: 404 });
    const file = path.join(DATA, url.slice(marker + 'geodata/real-city/'.length));
    if (!existsSync(file)) return new Response(null, { status: 404 });
    return new Response(await readFile(file), { status: 200 });
  }) as typeof fetch;
  return () => { globalThis.fetch = previous; };
}

function stubDocument(): () => void {
  const previous = globalThis.document;
  const context = { fillStyle: '', fillRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  return () => { globalThis.document = previous; };
}

async function settle(layer: RealCityLayer, position: Vector3, frames = 200): Promise<void> {
  const still = new Vector3();
  for (let i = 0; i < frames; i++) {
    layer.update(position, still, 1 / 60);
    if (i % 10 === 0) await new Promise(resolve => setTimeout(resolve, 4));
  }
}

function positionsOf(mesh: Mesh): Float32Array {
  const attribute = mesh.geometry.getAttribute('position');
  assert.ok(attribute instanceof BufferAttribute);
  return attribute.array as Float32Array;
}

function detailMeshes(root: Group): Mesh[] {
  const found: Mesh[] = [];
  root.traverse(object => { if (object instanceof Mesh && object.name.startsWith('real-detail:')) found.push(object); });
  return found;
}

test('levelling a real building collapses its geometry in place and frees its collider', async () => {
  if (!existsSync(path.join(DATA, 'manifest.json'))) return;
  const restore = serveGeodata();
  const root = new Group(), layer = new RealCityLayer(root);
  try {
    await layer.initialize();
    const position = new Vector3(0, 40, 0);
    await settle(layer, position);
    const meshes = detailMeshes(root);
    assert.ok(meshes.length > 0, 'the near tier must be resident before anything can be destroyed');
    const victim = layer.colliders.find(collider => collider.id?.startsWith('real:'));
    assert.ok(victim?.id, 'a real building must be within collision range of the spawn');

    const before = layer.colliders.length;
    const nonZeroBefore = meshes.reduce((total, mesh) => total + positionsOf(mesh).filter(value => value !== 0).length, 0);
    assert.equal(layer.destroy(victim.id), true, 'destroying a resident real building must succeed');
    assert.equal(layer.isDestroyed(victim.id.slice(5)), true);

    // The collider goes on the next frame's refresh, not lazily at some later rebuild. The total
    // stays pinned at the budget, because another building simply takes the freed slot.
    layer.update(position, new Vector3(), 1 / 60);
    assert.equal(layer.colliders.some(collider => collider.id === victim.id), false,
      'the levelled building must leave the broadphase');
    assert.ok(layer.colliders.length <= Math.max(before, REAL_CITY.maxColliders));
    const nonZeroAfter = meshes.reduce((total, mesh) => total + positionsOf(mesh).filter(value => value !== 0).length, 0);
    assert.ok(nonZeroAfter < nonZeroBefore, 'the building\'s vertex span must be collapsed, not left standing');

    // Collapsing twice is a no-op rather than a double eviction.
    assert.equal(layer.destroy(victim.id), false);
    assert.equal(layer.destroy('landmark:teatro'), false, 'landmarks are not destructible');
    assert.equal(layer.destroy('4,4/building/2'), false, 'procedural ids belong to the streamer');
  } finally {
    layer.dispose(); restore();
  }
});

test('a levelled building stays levelled when its tile rebuilds around the player', async () => {
  if (!existsSync(path.join(DATA, 'manifest.json'))) return;
  const restore = serveGeodata();
  const root = new Group(), layer = new RealCityLayer(root);
  try {
    await layer.initialize();
    const position = new Vector3(0, 40, 0);
    await settle(layer, position);
    const victim = layer.colliders.find(collider => collider.id?.startsWith('real:'));
    assert.ok(victim?.id);
    layer.destroy(victim.id);
    const id = victim.id;

    // Walking away and back demotes the cell to a shell and promotes it again, rebuilding both tiers.
    await settle(layer, new Vector3(1500, 40, 1500), 120);
    await settle(layer, position, 200);
    assert.equal(layer.colliders.some(collider => collider.id === id), false,
      'a rebuilt tier must not resurrect a building the player already levelled');
    assert.equal(layer.isDestroyed(id.slice(5)), true);
  } finally {
    layer.dispose(); restore();
  }
});

test('the levelled set is limitless so a long rampage persists destruction until restored', async () => {
  if (!existsSync(path.join(DATA, 'manifest.json'))) return;
  const restore = serveGeodata();
  const root = new Group(), layer = new RealCityLayer(root);
  try {
    await layer.initialize();
    await settle(layer, new Vector3(0, 40, 0), 60);
    // A building outside the resident set is still permanently gone, so the caller must not retry.
    assert.equal(layer.destroy('real:not-resident-anywhere'), true);
    assert.equal(layer.destroy('real:not-resident-anywhere'), false, 'but only once');
    for (let i = 0; i < REAL_CITY.maxDestroyed + 500; i++) layer.destroy(`real:synthetic-${i}`);
    assert.equal(layer.destroyedCount, REAL_CITY.maxDestroyed + 501);
    // The oldest entries are never released, so all demolition survives.
    assert.equal(layer.isDestroyed('synthetic-0'), true);
    assert.equal(layer.isDestroyed(`synthetic-${REAL_CITY.maxDestroyed + 499}`), true);
  } finally {
    layer.dispose(); restore();
  }
});

test('procedural buildings collapse by zeroing their instance, without rebuilding the chunk', async () => {
  const restoreDocument = stubDocument();
  const root = new Group(), streamer = new WorldStreamer(root);
  try {
    // Far outside the compiled Overture footprint, so the procedural city is what stands here.
    const position = new Vector3(-9200, 60, -7400);
    await streamer.prepare(position);
    for (let frame = 0; frame < 20; frame++) {
      streamer.update(position, new Vector3(), 1 / 30);
      await new Promise(resolve => setTimeout(resolve, 3));
    }
    const victim = streamer.colliders.find(collider => collider.id?.includes('/building/'));
    if (!victim?.id) return; // No procedural block generated here; nothing to assert.

    const before = streamer.colliders.length;
    assert.equal(streamer.destroy(victim.id), true);
    assert.ok(streamer.colliders.length < before);
    assert.equal(streamer.colliders.some(collider => collider.id === victim.id), false);
    assert.equal(streamer.destroy(victim.id), false, 'a second collapse is a no-op');
    assert.equal(streamer.destroy(`hlod:${victim.id}`), false, 'distant proxies are not destructible');

    // The instance must actually be zero-scaled rather than merely dropped from the broadphase.
    const index = Number(victim.id.slice(victim.id.indexOf('/building/') + 10));
    let zeroed = false;
    root.traverse(object => {
      if (!(object instanceof InstancedMesh) || object.name !== 'facades' || index >= object.count) return;
      const matrix = object.instanceMatrix.array as Float32Array;
      const at = index * 16;
      if (matrix[at] === 0 && matrix[at + 5] === 0 && matrix[at + 10] === 0) zeroed = true;
    });
    assert.equal(zeroed, true, 'the facade instance must be collapsed to zero scale');
    assert.ok(streamer.colliders.length <= WORLD.maxActiveChunks * 400);
  } finally {
    streamer.dispose(); restoreDocument();
  }
});

test('trees are solid, fall when hit, and take their own canopy with them', async () => {
  const restoreDocument = stubDocument();
  const root = new Group(), streamer = new WorldStreamer(root);
  try {
    // Deep in the forest north-east of the city, where vegetation is what the chunks generate.
    const position = new Vector3(9000, 60, -14000);
    await streamer.prepare(position);
    for (let frame = 0; frame < 20; frame++) {
      streamer.update(position, new Vector3(), 1 / 30);
      await new Promise(resolve => setTimeout(resolve, 3));
    }
    const tree = streamer.colliders.find(collider => collider.id?.includes('/tree/'));
    if (!tree?.id) return; // No vegetation generated here; nothing to assert.
    assert.ok(tree.height > 2, 'a tree collider must have a real trunk height');
    assert.ok(tree.width > .5, 'a tree must be wide enough for a beam to hit');

    assert.equal(streamer.destroy(tree.id), true, 'a tree must be fellable');
    assert.equal(streamer.colliders.some(collider => collider.id === tree.id), false);
    assert.equal(streamer.destroy(tree.id), false, 'felling twice is a no-op');

    const index = Number(tree.id.slice(tree.id.indexOf('/tree/') + 6));
    // Only the chunk that owns the tree; every other chunk has its own instance at that index.
    const key = tree.id.slice(0, tree.id.indexOf('/tree/'));
    const owner = root.children.find(child => child.name === `chunk:${key}`);
    assert.ok(owner, 'the felled tree must belong to a resident chunk');
    let trunkGone = false, leavesGone = false;
    owner.traverse(object => {
      if (!(object instanceof InstancedMesh)) return;
      const matrix = object.instanceMatrix.array as Float32Array;
      if (object.name === 'tree-trunks' && index < object.count) {
        const at = index * 16;
        trunkGone = matrix[at] === 0 && matrix[at + 5] === 0 && matrix[at + 10] === 0;
      }
      if (object.name === 'tropical-canopy') {
        const start = (owner.userData.canopyStart as Int32Array | undefined)?.[index];
        const span = (owner.userData.canopySpan as Int32Array | undefined)?.[index] ?? 0;
        if (start === undefined || !span) return;
        leavesGone = true;
        for (let n = 0; n < span; n++) {
          const at = (start + n) * 16;
          if (matrix[at] !== 0 || matrix[at + 5] !== 0 || matrix[at + 10] !== 0) leavesGone = false;
        }
      }
    });
    assert.equal(trunkGone, true, 'the trunk instance must be collapsed');
    assert.equal(leavesGone, true, 'the canopy must not be left floating where the tree stood');
  } finally {
    streamer.dispose(); restoreDocument();
  }
});
