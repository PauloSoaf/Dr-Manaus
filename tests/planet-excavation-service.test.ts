import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PlanetExcavationService,
  intersectRayPlanetEllipsoid,
} from '../src/world/destruction/PlanetExcavationService';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface';
import type { BodyFixedPoint } from '../src/world/planet/volume/PlanetVolumeEdit';

test('T_D2_01_ANALYTICAL_RAY_ELLIPSOID_INTERSECTION', () => {
  const semiAxes: [number, number, number] = [6378137, 6356752, 6378137];

  // 1. Central head-on piercing ray along +X: from outside [10e6, 0, 0] directed [-1, 0, 0]
  const hit = intersectRayPlanetEllipsoid([10_000_000, 0, 0], [-1, 0, 0], semiAxes);
  assert.ok(hit, 'Must intersect planet ellipsoid');
  const [tEntry, tExit] = hit;
  assert.ok(tEntry > 0 && tExit > tEntry);

  const entryX = 10_000_000 - tEntry;
  const exitX = 10_000_000 - tExit;
  assert.ok(Math.abs(entryX - 6378137) < 1.0, `Entry at equator must match semiMajorAxis (~6378137m), got ${entryX}`);
  assert.ok(Math.abs(exitX - (-6378137)) < 1.0, `Exit at antipode must match -semiMajorAxis (~ -6378137m), got ${exitX}`);

  // 2. Off-planet missing ray
  const miss = intersectRayPlanetEllipsoid([10_000_000, 10_000_000, 0], [-1, 0, 0], semiAxes);
  assert.equal(miss, undefined, 'Ray passing outside envelope must not intersect');
});

test('T_D2_02_THROUGH_BODY_PLANET_TUNNEL_CARVE', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new PlanetExcavationService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
  });
  const field = new PlanetVolumeField(EarthSurfaceGenerator, edits);

  const startRayOrigin: BodyFixedPoint = [0, 8_000_000, 0];
  const startRayDir: BodyFixedPoint = [0, -1, 0];
  const tunnelRadiusM = 30;

  // Carve through-body tunnel North Pole -> South Pole
  const plan = service.carveDirectionalTunnel({
    bodyId: 'earth',
    rayOriginBodyFixedM: startRayOrigin,
    rayDirectionBodyFixed: startRayDir,
    radiusM: tunnelRadiusM,
  });

  assert.ok(plan, 'Through-body tunnel must be planned');
  assert.equal(plan.isThroughBody, true);
  assert.ok(plan.lengthM > 12_000_000, 'Earth piercing diameter > 12,000 km');
  assert.equal(edits.editCount, 1);

  // Verification 1: Planetary core at (0, 0, 0) is now empty
  assert.ok(field.signedDistanceBodyFixed([0, 0, 0]) > 0, 'Core on centerline must be empty');

  // Verification 2: Points along the axis are empty
  assert.ok(field.signedDistanceBodyFixed([0, 1_000_000, 0]) > 0);
  assert.ok(field.signedDistanceBodyFixed([0, -1_000_000, 0]) > 0);

  // Verification 3: Off-axis interior rock beyond tunnel radius remains solid
  assert.ok(field.signedDistanceBodyFixed([tunnelRadiusM * 2.5, 0, 0]) < 0, 'Off-axis interior remains solid rock');
  assert.ok(field.signedDistanceBodyFixed([0, 0, tunnelRadiusM * 2.5]) < 0);
});

test('T_D2_03_BLIND_SUBTERRANEAN_BOREHOLE', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new PlanetExcavationService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
  });
  const field = new PlanetVolumeField(EarthSurfaceGenerator, edits);

  const rSurface = planetSurfaceRadius(EarthSurfaceGenerator, [1, 0, 0]);
  const rayOrigin: BodyFixedPoint = [rSurface + 1000, 0, 0];
  const rayDir: BodyFixedPoint = [-1, 0, 0];
  const depthM = 2000;
  const radiusM = 15;

  // Carve a 2000m deep vertical borehole into the surface
  const plan = service.carveDirectionalTunnel({
    bodyId: 'earth',
    rayOriginBodyFixedM: rayOrigin,
    rayDirectionBodyFixed: rayDir,
    radiusM,
    maxDepthM: depthM,
  });

  assert.ok(plan);
  assert.equal(plan.isThroughBody, false);
  assert.equal(plan.lengthM, depthM);

  // Surface entry point is empty
  assert.ok(field.signedDistanceBodyFixed([rSurface - 10, 0, 0]) > 0);

  // Inside the 2000m borehole (e.g. 1000m deep) is empty
  assert.ok(field.signedDistanceBodyFixed([rSurface - 1000, 0, 0]) > 0);

  // Beyond the bottom of the borehole (e.g. 3000m deep) remains solid rock
  assert.ok(field.signedDistanceBodyFixed([rSurface - 3000, 0, 0]) < 0, 'Rock beyond borehole end must remain solid');
});

test('T_D2_04_SUBTERRANEAN_CAVE_NETWORK_WAYPOINTS', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new PlanetExcavationService({
    edits,
    surfaceForBody: id => (id === 'moon' ? MoonSurfaceGenerator : undefined),
  });
  const field = new PlanetVolumeField(MoonSurfaceGenerator, edits);

  const rMoon = MoonSurfaceGenerator.body.semiMajorAxisM;
  // Cave network 500m below Moon surface
  const w0: BodyFixedPoint = [rMoon - 500, 0, 0];
  const w1: BodyFixedPoint = [rMoon - 500, 200, 0];
  const w2: BodyFixedPoint = [rMoon - 600, 200, 150];
  const w3: BodyFixedPoint = [rMoon - 700, 400, 150];

  const plans = service.carveTunnelPath('moon', [w0, w1, w2, w3], 20, 'moon:lava_tube');
  assert.equal(plans.length, 3, 'Must create 3 connected tunnel segments');
  assert.equal(edits.editCount, 3);

  // Every waypoint along the cave is empty
  for (const w of [w0, w1, w2, w3]) {
    assert.ok(field.signedDistanceBodyFixed(w) > 0, `Cave waypoint ${w.join(',')} must be empty`);
  }

  // Midpoints of segments are also empty
  const mid01: BodyFixedPoint = [rMoon - 500, 100, 0];
  assert.ok(field.signedDistanceBodyFixed(mid01) > 0, 'Segment midpoint must be hollow');
});

test('T_D2_05_SPARSE_MEMORY_RESIDENCY_INVARIANT', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new PlanetExcavationService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
  });

  // Carve 5 different planetary tunnels
  for (let i = 0; i < 5; i++) {
    service.carveDirectionalTunnel({
      bodyId: 'earth',
      rayOriginBodyFixedM: [0, 8_000_000, i * 100],
      rayDirectionBodyFixed: [0, -1, 0],
      radiusM: 20,
    });
  }

  assert.equal(edits.editCount, 5, 'Must store exactly 5 sparse CSG edits without grid explosion');
});

test('T_D2_06_SERIALIZE_RESTORE_ROUNDTRIP', () => {
  const edits1 = new PlanetVolumeEditStore();
  const service1 = new PlanetExcavationService({
    edits: edits1,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
  });

  service1.carveDirectionalTunnel({
    bodyId: 'earth',
    rayOriginBodyFixedM: [0, 8_000_000, 0],
    rayDirectionBodyFixed: [0, -1, 0],
    radiusM: 25,
    tunnelId: 'earth:main_borehole',
  });

  const json = service1.serializeBodyEdits('earth');
  assert.ok(json.includes('earth:main_borehole'));
  assert.ok(json.includes('subtract-capsule'));

  // Restore into fresh store and service
  const edits2 = new PlanetVolumeEditStore();
  const service2 = new PlanetExcavationService({
    edits: edits2,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
  });

  service2.restoreBodyEdits(json);
  assert.equal(edits2.editCount, 1);
  const restoredEdit = edits2.get('earth:main_borehole');
  assert.ok(restoredEdit);
  assert.equal(restoredEdit.type, 'subtract-capsule');
  assert.equal(restoredEdit.radiusM, 25);
});

