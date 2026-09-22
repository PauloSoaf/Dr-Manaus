import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD } from '../src/core/config';
import { BUILDING_STRIDE, TREE_STRIDE } from '../src/world/chunks/Chunk';
import { generateChunk, urbanDensity } from '../src/world/chunks/BuildingGenerator';
import { buildingAllowed, isLand, isUrban, LANDMARKS, riverWidth, shoreZ } from '../src/world/geodata/geodata';
import { planChunks } from '../src/world/streaming/ChunkPriority';
import { Group, Vector3 } from 'three/webgpu';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer';
import { HLODManager } from '../src/world/lod/HLODManager';

test('procedural records remain deterministic across unload/reload and worker transfer', () => {
  const first = generateChunk(3, -5), second = generateChunk(3, -5);
  assert.deepEqual(first.buildings, second.buildings);
  assert.deepEqual(first.trees, second.trees);
  assert.equal(first.buildings.length % BUILDING_STRIDE, 0);
  assert.equal(first.trees.length % TREE_STRIDE, 0);
  assert.ok(first.buildings.length > 0, 'fixture must exercise actual city generation');
  assert.notDeepEqual(first.buildings, generateChunk(4, -5).buildings);
  const transferred = structuredClone(first, { transfer: [first.buildings.buffer, first.trees.buffer] });
  assert.equal(first.buildings.byteLength, 0);
  assert.deepEqual(transferred.buildings, second.buildings);
});

test('every generated footprint respects shoreline, roads and landmark reservations', () => {
  let count = 0;
  for (let cz = -7; cz <= 13; cz++) for (let cx = -8; cx <= 8; cx++) {
    const chunk = generateChunk(cx, cz);
    for (let p = 0; p < chunk.buildings.length; p += BUILDING_STRIDE) {
      const data = chunk.buildings, x = data[p], z = data[p + 1];
      assert.ok(buildingAllowed(x, z, Math.max(data[p + 2], data[p + 4]) * .59));
      assert.ok(x > cx * WORLD.chunkSize && x < (cx + 1) * WORLD.chunkSize);
      assert.ok(z > cz * WORLD.chunkSize && z < (cz + 1) * WORLD.chunkSize);
      for (const landmark of LANDMARKS) assert.ok(Math.hypot(x - landmark.x, z - landmark.z) >= landmark.radius);
      count++;
    }
  }
  assert.ok(count > 1000, 'the urban fixture must contain a meaningful sample');
});

test('the bridge reaches an urbanized Iranduba bank instead of an empty horizon', () => {
  const iranduba = LANDMARKS.find(landmark => landmark.id === 'iranduba');
  assert.ok(iranduba, 'Iranduba landmark must exist');
  assert.ok(isLand(iranduba.x, iranduba.z));
  assert.ok(iranduba.z > shoreZ(iranduba.x) + riverWidth(iranduba.x));
  const x = iranduba.x + 760, z = iranduba.z + 260;
  assert.ok(isUrban(x, z));
  assert.ok(urbanDensity(x, z) > .4);
  const cx = Math.floor(x / WORLD.chunkSize), cz = Math.floor(z / WORLD.chunkSize);
  const chunk = generateChunk(cx, cz);
  assert.ok(chunk.buildings.length > 0, 'opposite-bank urban chunks must generate buildings');
});

test('nearby requests precede directional prefetch and all request plans obey the memory budget', () => {
  const position = { x: 64, z: 64 };
  const requests = planChunks(position, { x: 300, z: 0 }, WORLD.detailRadius);
  assert.equal(requests[0].key, '0,0');
  assert.ok(requests.length <= WORLD.maxActiveChunks + WORLD.maxCachedChunks);
  assert.equal(new Set(requests.map(request => request.key)).size, requests.length);
  assert.ok(requests.some(request => request.cx >= 5 && !request.immediate));
  assert.ok(!requests.some(request => request.cx <= -5), 'prediction must not inflate the radius behind the player');
  for (let i = 1; i < requests.length; i++) assert.ok(requests[i].priority >= requests[i - 1].priority);
});

test('supersonic and negative-coordinate plans remain finite, directional and centered correctly', () => {
  const requests = planChunks({ x: -1, z: -1 }, { x: 0, z: -1200 }, 390);
  assert.ok(requests.some(request => request.key === '-1,-1'));
  assert.ok(requests.some(request => request.cz < -8 && !request.immediate));
  assert.ok(requests.length <= WORLD.maxActiveChunks + WORLD.maxCachedChunks);
  assert.ok(requests.every(request => Number.isFinite(request.priority)));
});

test('stationary streaming performs no speculative generation', () => {
  const requests = planChunks({ x: 0, z: 0 }, { x: 0, z: 0 }, 210);
  assert.ok(requests.every(request => request.immediate));
  assert.ok(requests.length < WORLD.maxActiveChunks);
});

test('teleport preparation and repeated neighbourhood replacement obey active/cache limits', async () => {
  // No GPU is needed to verify lifecycle, actual instance allocation and collision readiness.
  const previousDocument = globalThis.document;
  const context = { fillStyle: '', fillRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const root = new Group(), streamer = new WorldStreamer(root);
  try {
    for (const [x, z] of [[0, 0], [-530, -5200], [-9200, -7400], [-5600, -1800], [0, 0]]) {
      const position = new Vector3(x, 60, z);
      await streamer.prepare(position);
      const cx = Math.floor(x / WORLD.chunkSize), cz = Math.floor(z / WORLD.chunkSize);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        assert.ok(streamer.activeKeys.has(`${cx + dx},${cz + dz}`), 'minimum teleport neighbourhood must be active before resolving');
      }
      for (let frame = 0; frame < 8; frame++) {
        streamer.update(position, new Vector3(120, 0, 0), .1);
        await new Promise(resolve => setTimeout(resolve, 1));
        assert.ok(streamer.stats.active <= WORLD.maxActiveChunks);
        assert.ok(streamer.stats.cached <= WORLD.maxCachedChunks);
      }
      assert.ok(root.children.length <= WORLD.maxActiveChunks + 1, 'cached GPU groups must be detached from the scene');
    }
    assert.ok(streamer.colliders.length > 0);
    streamer.dispose();
    assert.equal(root.children.length, 0);
    assert.equal(streamer.colliders.length, 0);
  } finally {
    streamer.dispose(); globalThis.document = previousDocument;
  }
});

test('stale generation completions cannot reactivate the old area after teleport', async () => {
  const previousDocument = globalThis.document;
  const context = { fillStyle: '', fillRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const root = new Group(), streamer = new WorldStreamer(root);
  try {
    streamer.update(new Vector3(), new Vector3(0, 0, -500), .2);
    assert.ok(streamer.stats.queued > 0);
    const destination = new Vector3(-9400, 40, -7800);
    await streamer.prepare(destination);
    await new Promise(resolve => setTimeout(resolve, 12));
    streamer.update(destination, new Vector3(), .2);
    assert.ok(!streamer.activeKeys.has('0,0'));
    assert.ok(streamer.stats.active <= WORLD.maxActiveChunks);
    assert.ok(streamer.stats.cached <= WORLD.maxCachedChunks);
    for (const key of streamer.activeKeys) {
      const [cx, cz] = key.split(',').map(Number);
      assert.ok(Math.hypot(cx * WORLD.chunkSize - destination.x, cz * WORLD.chunkSize - destination.z) < 650);
    }
  } finally { streamer.dispose(); globalThis.document = previousDocument; }
});

test('HLOD changes detailed coverage in the same frame and keeps local proxy storage bounded', async t => {
  const root = new Group();
  const started = performance.now();
  const hlod = new HLODManager(root);
  t.diagnostic(`Distant hierarchy construction: ${(performance.now() - started).toFixed(1)} ms; ${hlod.nodeCount} visible aggregate instances`);
  try {
    const position = new Vector3(448, 50, -576), coverage = new Set<string>();
    for (let i = 0; i < 180; i++) hlod.update(position, coverage);
    await new Promise(resolve => setTimeout(resolve, 90)); hlod.update(position, coverage);
    const before = hlod.stats.medium;
    const chunk = generateChunk(3, -5);
    coverage.add(chunk.key); hlod.update(position, coverage);
    assert.equal(hlod.stats.medium, before - chunk.buildings.length / BUILDING_STRIDE,
      'a detailed activation must remove its exact proxy immediately, without an overlap frame');
    coverage.clear(); hlod.update(position, coverage);
    assert.equal(hlod.stats.medium, before);
    for (const [x, z] of [[0, 0], [-9200, -7400], [6000, -11000], [0, 0]]) {
      position.set(x, 80, z);
      for (let i = 0; i < 80; i++) hlod.update(position, coverage);
      assert.ok(hlod.stats.cached <= 450);
      assert.ok(hlod.stats.medium <= 10000 && hlod.stats.aggregate <= 8000 && hlod.stats.horizon <= 2400);
    }
    assert.equal(root.children[0].children.length, 4, 'the hierarchy uses four instanced draws regardless of node count');
  } finally { hlod.dispose(); }
  assert.equal(root.children.length, 0);
});
