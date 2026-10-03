import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Matrix4, Vector3 } from 'three/webgpu';
import { FEATURES, WORLD } from '../src/core/config.ts';
import { ChunkMeshes } from '../src/world/chunks/ChunkMeshes.ts';
import type { ChunkPayload } from '../src/world/chunks/Chunk.ts';

function stubDocument(): () => void {
  const previous = globalThis.document;
  const context = { fillStyle: '', fillRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  return () => { globalThis.document = previous; };
}

function payloadAt(distance: number): ChunkPayload {
  const cx = Math.floor(distance / WORLD.chunkSize), cz = -cx || 0;
  const x = cx * WORLD.chunkSize + 24, z = cz * WORLD.chunkSize + 36;
  return {
    key: `${cx},${cz}`, cx, cz, land: true,
    buildings: new Float32Array([x, z, 12, 10, 14, .5, .4, .3, 2]),
    trees: new Float32Array([x + 32, z + 12, 9, 4, 0, x + 46, z + 20, 12, 5, 1]),
  };
}

test('T_FLAT_MANAUS_PROCEDURAL_CHUNKS_NO_SAG: buildings, sidewalks and trees stay in their authored flat frame', () => {
  assert.equal(FEATURES.curvedManaus, false);
  const restoreDocument = stubDocument(), factory = new ChunkMeshes();
  try {
    for (const distance of [0, 5000, 10000, 15000, 20000]) {
      const payload = payloadAt(distance), { group, colliders } = factory.create(payload);
      try {
        const origin = new Vector3().applyMatrix4(group.matrix);
        assert.deepEqual(origin.toArray(), [payload.cx * WORLD.chunkSize, 0, payload.cz * WORLD.chunkSize]);
        const instance = new Matrix4();
        const walls = group.getObjectByName('facades') as InstancedMesh;
        walls.getMatrixAt(0, instance);
        const buildingBase = new Vector3(0, -.5, 0).applyMatrix4(instance).applyMatrix4(group.matrix);
        const buildingCollider = colliders.find(collider => collider.id?.includes('/building/'))!;
        assert.equal(buildingBase.x, buildingCollider.x);
        assert.equal(buildingBase.z, buildingCollider.z);
        // The procedural facade is intentionally seated on its authored 25 cm foundation.
        assert.equal(buildingBase.y, .25);
        assert.equal(buildingCollider.y - buildingCollider.height / 2, 0);

        const sidewalk = group.getObjectByName('sidewalks') as InstancedMesh;
        sidewalk.getMatrixAt(0, instance);
        const sidewalkBase = new Vector3(0, -.5, 0).applyMatrix4(instance).applyMatrix4(group.matrix);
        assert.ok(Math.abs(sidewalkBase.y) < .001);
        const trunks = group.getObjectByName('tree-trunks') as InstancedMesh;
        for (let i = 0; i < trunks.count; i++) {
          trunks.getMatrixAt(i, instance);
          const trunkBase = new Vector3(0, -.5, 0).applyMatrix4(instance).applyMatrix4(group.matrix);
          const treeCollider = colliders.find(collider => collider.id === `${payload.key}/tree/${i}`)!;
          assert.deepEqual(trunkBase.toArray(), [treeCollider.x, 0, treeCollider.z]);
        }
      } finally { factory.disposeChunk(group); }
    }
  } finally { factory.dispose(); restoreDocument(); }
});

for (const curved of [false, true]) {
  test(`T_MANAUS_PROCEDURAL_RESTORE_PRESERVES_TILE_ORIGIN: ${curved ? 'curved' : 'flat'} buildings and every canopy instance restore in place`, () => {
    const flags = FEATURES as unknown as { curvedManaus: boolean }, previous = flags.curvedManaus;
    const restoreDocument = stubDocument(), factory = new ChunkMeshes();
    flags.curvedManaus = curved;
    const payload = payloadAt(20000), { group } = factory.create(payload);
    try {
      const snapshots = new Map<string, number[]>();
      for (const mesh of group.children) {
        assert.ok(mesh instanceof InstancedMesh);
        snapshots.set(mesh.name, Array.from(mesh.instanceMatrix.array).slice(0, mesh.count * 16));
        mesh.instanceMatrix.array.fill(0);
      }
      for (const id of [`${payload.key}/building/0`, `${payload.key}/tree/0`, `${payload.key}/tree/1`]) {
        assert.deepEqual(factory.restore(group, payload, id), ChunkMeshes.collider(payload, id));
      }
      for (const mesh of group.children) {
        assert.ok(mesh instanceof InstancedMesh);
        assert.deepEqual(Array.from(mesh.instanceMatrix.array).slice(0, mesh.count * 16), snapshots.get(mesh.name), `${mesh.name} restores exactly`);
      }
      assert.equal(curved ? group.matrix.elements[13] < -20 : group.matrix.elements[13] === 0, true);
    } finally {
      flags.curvedManaus = previous;
      factory.disposeChunk(group); factory.dispose(); restoreDocument();
    }
  });
}
