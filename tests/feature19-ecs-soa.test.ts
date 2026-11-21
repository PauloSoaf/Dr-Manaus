import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, InstancedMesh, MeshBasicMaterial } from 'three/webgpu';
import { CosmicStateStore } from '../src/core/CosmicStateStore.ts';

test('FEATURE 19: 1. Contiguous kinematic trajectory integration (CT-19-01)', () => {
  const store = new CosmicStateStore(100);

  // Spawn entity at P0 = (100, 50, -200) with velocity V = (10, -5, 20) m/s
  const eid = store.createEntity('vehicle', 100, 50, -200);
  store.velocity.x[eid] = 10;
  store.velocity.y[eid] = -5;
  store.velocity.z[eid] = 20;

  // Integrate for dt = 0.5s
  store.integrate(0.5);

  // Expected position: P0 + V * dt
  // x = 100 + 10 * 0.5 = 105
  // y = 50 + (-5) * 0.5 = 47.5
  // z = -200 + 20 * 0.5 = -190
  assert.ok(Math.abs(store.position.x[eid] - 105.0) < 1e-5);
  assert.ok(Math.abs(store.position.y[eid] - 47.5) < 1e-5);
  assert.ok(Math.abs(store.position.z[eid] - (-190.0)) < 1e-5);

  // Second tick: dt = 1.0s
  store.integrate(1.0);
  assert.ok(Math.abs(store.position.x[eid] - 115.0) < 1e-5);
  assert.ok(Math.abs(store.position.y[eid] - 42.5) < 1e-5);
  assert.ok(Math.abs(store.position.z[eid] - (-170.0)) < 1e-5);
});

test('FEATURE 19: 2. Safe Entity ID Recycling without leaks (CT-19-02)', () => {
  const maxEntities = 10_000;
  const store = new CosmicStateStore(maxEntities);

  // 1. Create 5,000 entities
  const createdIds: number[] = [];
  for (let i = 0; i < 5000; i++) {
    const id = store.createEntity('npc', i, 0, i);
    createdIds.push(id);
  }
  assert.equal(store.activeCount, 5000);

  // 2. Destroy 2,000 entities
  for (let i = 0; i < 2000; i++) {
    const destroyed = store.destroyEntity(createdIds[i]);
    assert.equal(destroyed, true);
  }
  assert.equal(store.activeCount, 3000);

  // 3. Create 2,000 new entities (must recycle the freed IDs)
  const recycledIds: number[] = [];
  for (let i = 0; i < 2000; i++) {
    const newId = store.createEntity('vessel', 500, 0, 500);
    recycledIds.push(newId);
  }
  assert.equal(store.activeCount, 5000);

  // All recycled IDs must be valid and within bounds
  for (const id of recycledIds) {
    assert.ok(id >= 0 && id < maxEntities);
    assert.equal(store.hasEntity(id), true);
  }
});

test('FEATURE 19: 3. Performance stress test with 50,000 entities (CT-19-03)', () => {
  const count = 50_000;
  const store = new CosmicStateStore(count);

  // Initialize 50,000 entities across space
  for (let i = 0; i < count; i++) {
    const id = store.createEntity('projectile', i * 0.1, 0, i * 0.2);
    store.velocity.x[id] = 15.0;
    store.velocity.y[id] = 2.0;
    store.velocity.z[id] = -10.0;
  }

  assert.equal(store.activeCount, count);

  // Run 100 simulation frames
  const t0 = performance.now();
  const frames = 100;
  const dt = 0.016; // 60 FPS tick

  for (let f = 0; f < frames; f++) {
    store.integrate(dt);
  }

  const elapsedMs = performance.now() - t0;
  const avgFrameMs = elapsedMs / frames;

  // Verify positions were advanced
  assert.ok(store.position.x[0] > 0);
  assert.ok(store.position.z[0] < 0);

  // Performance threshold: < 10.0 ms per frame on typical CPU for 50,000 entities in Node.js
  assert.ok(
    avgFrameMs < 10.0,
    `Average simulation frame (${avgFrameMs.toFixed(3)} ms) for 50,000 entities must be fast and cache-friendly`,
  );
});

test('FEATURE 19: 4. Direct matrix synchronization to InstancedMesh buffer (Zero GC)', () => {
  const store = new CosmicStateStore(16);
  const geo = new BoxGeometry(1, 1, 1);
  const mat = new MeshBasicMaterial();
  const instancedMesh = new InstancedMesh(geo, mat, 16);

  const e0 = store.createEntity('vehicle', 10, 20, 30);
  const e1 = store.createEntity('vehicle', 40, 50, 60);

  // Sync straight into buffer
  store.syncToInstancedMesh(instancedMesh, 2, 2.5);

  const array = instancedMesh.instanceMatrix.array as Float32Array;

  // First instance: scale = 2.5, position = (10, 20, 30)
  assert.equal(array[0], 2.5); // scale X
  assert.equal(array[5], 2.5); // scale Y
  assert.equal(array[10], 2.5); // scale Z
  assert.equal(array[12], 10); // pos X
  assert.equal(array[13], 20); // pos Y
  assert.equal(array[14], 30); // pos Z
  assert.equal(array[15], 1.0); // W

  // Second instance: scale = 2.5, position = (40, 50, 60)
  assert.equal(array[16 + 0], 2.5);
  assert.equal(array[16 + 12], 40);
  assert.equal(array[16 + 13], 50);
  assert.equal(array[16 + 14], 60);

  assert.ok(instancedMesh.instanceMatrix.version > 0, 'BufferAttribute version must increment on needsUpdate');
});

test('FEATURE 19: 5. Combat damage with shield absorption and entity lifecycle', () => {
  const store = new CosmicStateStore(10);
  const eid = store.createEntity('vehicle', 0, 0, 0, 100, 50); // HP 100, Shield 50

  assert.equal(store.health.shield[eid], 50);
  assert.equal(store.health.current[eid], 100);

  // Hit 1: 30 damage (fully absorbed by shield)
  const dead1 = store.applyDamage(eid, 30);
  assert.equal(dead1, false);
  assert.equal(store.health.shield[eid], 20);
  assert.equal(store.health.current[eid], 100);

  // Hit 2: 40 damage (breaks 20 shield, penetrates 20 to health)
  const dead2 = store.applyDamage(eid, 40);
  assert.equal(dead2, false);
  assert.equal(store.health.shield[eid], 0);
  assert.equal(store.health.current[eid], 80);

  // Hit 3: Fatal 100 damage (exceeds 80 health, destroys entity)
  const dead3 = store.applyDamage(eid, 100);
  assert.equal(dead3, true);
  assert.equal(store.hasEntity(eid), false);
  assert.equal(store.activeCount, 0);
});
