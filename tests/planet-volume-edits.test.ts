import test from 'node:test';
import assert from 'node:assert/strict';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface.ts';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface.ts';
import { FloatingOrigin3D } from '../src/world/spatial/FloatingOrigin3D.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';
import { PlanetVolumeEditIndex } from '../src/world/planet/volume/PlanetVolumeEditIndex.ts';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore.ts';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';

test('subtract sphere makes its centre empty and leaves points outside its AABB unchanged', () => {
  const untouched = new PlanetVolumeField(EarthSurfaceGenerator);
  const edits = new PlanetVolumeEditStore();
  const field = new PlanetVolumeField(EarthSurfaceGenerator, edits);
  const surfaceM = planetSurfaceRadius(EarthSurfaceGenerator, [1, 0, 0]);
  const centre: Vec3 = [surfaceM - 5, 0, 0];
  const outsideCut: Vec3 = [surfaceM - 5, 20, 0];

  assert.ok(field.signedDistanceBodyFixed(centre) < 0);
  edits.subtractSphere({
    id: 'earth:test-crater', bodyId: 'earth', centerBodyFixedM: centre, radiusM: 10,
  });

  assert.ok(field.signedDistanceBodyFixed(centre) > 0, 'the removed sphere centre must be empty');
  assert.equal(
    field.signedDistanceBodyFixed(outsideCut),
    untouched.signedDistanceBodyFixed(outsideCut),
    'a point outside the edit bounds must use the untouched base field exactly',
  );

  // CSG difference is still a distance field outside the cut itself. Deep below the crater, its
  // wall is closer than the original surface and therefore raises the negative distance.
  const below: Vec3 = [surfaceM - 100, 0, 0];
  const dBase = untouched.signedDistanceBodyFixed(below);
  const dCut = Math.abs(below[0] - centre[0]) - 10;
  assert.equal(field.signedDistanceBodyFixed(below), Math.max(dBase, -dCut));
});

test('one subtract capsule opens entry, centre and exit through Earth while off-axis rock stays solid', () => {
  const edits = new PlanetVolumeEditStore();
  const field = new PlanetVolumeField(EarthSurfaceGenerator, edits);
  const tunnelRadiusM = 25;
  const extentM = EarthSurfaceGenerator.body.semiMajorAxisM + 20_000;
  edits.subtractCapsule({
    id: 'earth:through-tunnel', bodyId: 'earth',
    aBodyFixedM: [extentM, 0, 0], bBodyFixedM: [-extentM, 0, 0], radiusM: tunnelRadiusM,
  });

  const entryM = planetSurfaceRadius(EarthSurfaceGenerator, [1, 0, 0]);
  const exitM = planetSurfaceRadius(EarthSurfaceGenerator, [-1, 0, 0]);
  assert.ok(field.signedDistanceBodyFixed([entryM, 0, 0]) > 0, 'entry must be empty');
  assert.ok(field.signedDistanceBodyFixed([0, 0, 0]) > 0, 'the planetary centre must be empty');
  assert.ok(field.signedDistanceBodyFixed([-exitM, 0, 0]) > 0, 'exit must be empty');
  assert.ok(field.signedDistanceBodyFixed([0, tunnelRadiusM * 2, 0]) < 0, 'off-axis interior stays solid');
});

test('the spatial edit index stores a planet-wide tunnel as one edit, not diameter-sized chunks', () => {
  const extentM = EarthSurfaceGenerator.body.semiMajorAxisM + 20_000;
  const index = new PlanetVolumeEditIndex('earth');
  index.insert({
    id: 'earth:indexed-tunnel', bodyId: 'earth', type: 'subtract-capsule',
    aBodyFixedM: [extentM, 0, 0], bBodyFixedM: [-extentM, 0, 0], radiusM: 10,
  });

  assert.deepEqual(index.stats, { editCount: 1, nodeCount: 1 });
  assert.equal(index.queryPoint([0, 0, 0]).length, 1);
  assert.equal(index.queryPoint([0, 20, 0]).length, 0);
});

test('body-fixed edits and samples are invariant across repeated floating-origin rebases', () => {
  const edits = new PlanetVolumeEditStore();
  const rawDirection: Vec3 = [0.72, 0.35, -0.6];
  const length = Math.hypot(...rawDirection);
  const direction = rawDirection.map(component => component / length) as Vec3;
  const surfaceM = planetSurfaceRadius(EarthSurfaceGenerator, direction);
  const centre = direction.map(component => component * (surfaceM - 3)) as Vec3;
  edits.subtractSphere({
    id: 'earth:fixed-crater', bodyId: 'earth', centerBodyFixedM: centre, radiusM: 20,
  });
  const field = new PlanetVolumeField(EarthSurfaceGenerator, edits);
  const before = field.signedDistanceBodyFixed(centre);
  const floating = new FloatingOrigin3D(pose('earth/fixed', [0, 0, 0]), {
    thresholdM: 1_000, gridM: 512,
  });

  for (const origin of [
    [1_000_000, 2_000_000, -3_000_000],
    [-6_000_000, 250_000, 4_500_000],
    [surfaceM, 12_000, -99_000],
  ] as Vec3[]) {
    floating.update(pose('earth/fixed', origin));
    const renderLocal = floating.toRenderLocal(centre);
    const logicalAgain = floating.toLogical(renderLocal);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(logicalAgain[axis] - centre[axis]) < 1e-9);
    }
    assert.ok(Math.abs(field.signedDistanceBodyFixed(logicalAgain) - before) < 1e-8);
  }

  const stored = edits.get('earth:fixed-crater');
  assert.ok(stored?.type === 'subtract-sphere');
  assert.deepEqual(stored.centerBodyFixedM, centre);
});
