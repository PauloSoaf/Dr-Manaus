import test from 'node:test';
import assert from 'node:assert/strict';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface.ts';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore.ts';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';
import {
  PLANET_VOLUME_EDIT_SCHEMA_VERSION,
  deserializePlanetVolumeEdits,
  serializePlanetVolumeEdits,
} from '../src/world/planet/volume/PlanetVolumePersistence.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

test('a through-planet edit preserves its exact field after JSON persistence', () => {
  const edits = new PlanetVolumeEditStore();
  const extentM = EarthSurfaceGenerator.body.semiMajorAxisM + 20_000;
  edits.subtractCapsule({
    id: 'earth:persistent-tunnel', bodyId: 'earth',
    aBodyFixedM: [extentM, 0, 0], bBodyFixedM: [-extentM, 0, 0], radiusM: 35,
  });
  edits.subtractSphere({
    id: 'earth:persistent-room', bodyId: 'earth', centerBodyFixedM: [0, 0, 0], radiusM: 80,
  });
  const before = new PlanetVolumeField(EarthSurfaceGenerator, edits);
  const samples: Vec3[] = [
    [extentM - 20_000, 0, 0], [0, 0, 0], [-extentM + 20_000, 0, 0],
    [0, 34, 0], [0, 36, 0], [0, 100, 0],
  ];
  const distances = samples.map(point => before.signedDistanceBodyFixed(point));

  const serialized = serializePlanetVolumeEdits(edits, 'earth');
  const document = JSON.parse(serialized) as { schemaVersion: number; bodyId: string };
  assert.equal(document.schemaVersion, PLANET_VOLUME_EDIT_SCHEMA_VERSION);
  assert.equal(document.bodyId, 'earth');

  const restored = deserializePlanetVolumeEdits(serialized);
  const after = new PlanetVolumeField(EarthSurfaceGenerator, restored);
  assert.deepEqual(samples.map(point => after.signedDistanceBodyFixed(point)), distances);
  assert.deepEqual(restored.editsForBody('earth'), edits.editsForBody('earth'));
});

test('deserialization rejects unknown schemas and non-finite body-fixed coordinates', () => {
  assert.throws(
    () => deserializePlanetVolumeEdits('{"schemaVersion":999,"bodyId":"earth","edits":[]}'),
    /schema version/i,
  );
  assert.throws(
    () => deserializePlanetVolumeEdits({
      schemaVersion: PLANET_VOLUME_EDIT_SCHEMA_VERSION,
      bodyId: 'earth',
      edits: [{
        id: 'bad', type: 'subtract-sphere', centerBodyFixedM: [null, 0, 0], radiusM: 1,
      }],
    }),
    /finite/i,
  );
});
