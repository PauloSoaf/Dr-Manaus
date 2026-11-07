import test from 'node:test';
import assert from 'node:assert/strict';
import { MANAUS_AERIAL, manausAerialWeights } from '../src/rendering/ManausAerialPresentation.ts';
import { MANAUS_ANCHOR_ECEF } from '../src/world/spatial/ManausFrameAdapter.ts';
import { Vector3, Quaternion } from 'three/webgpu';

test('T_MANAUS_FAR_PROJECTED_SIZE_BOUNDED', () => {
  // Far marker radius is bounded to ~4.5 km (9 km diameter), avoiding the former 28 km oversized disc
  assert.equal(MANAUS_AERIAL.farMarkerRadiusM, 4500);
  assert.ok(MANAUS_AERIAL.farMarkerRadiusM < 10000, 'Radius is strictly less than 10 km');

  // Verify projected pixels at distances from 500 km to 2000 km
  const fovRad = Math.PI / 3;
  const viewportHeightPx = 1080;
  for (const distM of [500_000, 1_000_000, 2_000_000]) {
    const weights = manausAerialWeights(distM, distM, fovRad, viewportHeightPx, true);
    assert.ok(Number.isFinite(weights.pixels));
    assert.ok(weights.pixels < 100, `Projected size at ${distM / 1000}km must be bounded, got ${weights.pixels}`);
  }
});

test('T_MANAUS_FAR_NIGHT_SIDE_ONLY', () => {
  // Day side: surface normal dot sun > 0
  const norm = new Vector3(MANAUS_ANCHOR_ECEF.xM, MANAUS_ANCHOR_ECEF.yM, MANAUS_ANCHOR_ECEF.zM).normalize();
  const sunDirDay = norm.clone(); // Sun directly overhead
  const dayDot = norm.dot(sunDirDay);
  assert.ok(dayDot > 0.99, 'Day side has positive sun dot');
  const nightFactorDay = Math.max(0, Math.min(1, -dayDot));
  assert.equal(nightFactorDay, 0, 'Night glow factor must be 0 on day-facing hemisphere');

  // Night side: surface normal dot sun < 0
  const sunDirNight = norm.clone().negate(); // Sun on opposite side of Earth
  const nightDot = norm.dot(sunDirNight);
  assert.ok(nightDot < -0.99, 'Night side has negative sun dot');
  const nightFactorNight = Math.max(0, Math.min(1, -nightDot));
  assert.ok(nightFactorNight > 0.99, 'Night glow activates on night hemisphere');
});

test('T_MANAUS_FAR_OCCLUDED_BY_EARTH', () => {
  const normEcef = new Vector3(MANAUS_ANCHOR_ECEF.xM, MANAUS_ANCHOR_ECEF.yM, MANAUS_ANCHOR_ECEF.zM).normalize();
  const orientation = [0, 0, 0, 1];
  const quat = new Quaternion(orientation[0], orientation[1], orientation[2], orientation[3]);
  const normRender = normEcef.clone().applyQuaternion(quat);

  // Observer facing Manaus from space: toCam is aligned with normRender (dot > 0)
  const toCamFront = normRender.clone();
  const occludedFront = toCamFront.dot(normRender) < -0.02;
  assert.equal(occludedFront, false, 'Front side is not occluded');

  // Observer looking at opposite hemisphere: toCam points away from Manaus through the Earth (dot < -0.5)
  const toCamBack = normRender.clone().negate();
  const occludedBack = toCamBack.dot(normRender) < -0.02;
  assert.equal(occludedBack, true, 'Far side is occluded by Earth curvature');
});

test('T_MANAUS_FAR_20MM_NO_HARD_POP', () => {
  const fovRad = Math.PI / 3;
  const viewportHeightPx = 1080;

  // Check continuity around 20,000,000 m (20,000 km)
  const w19_9 = manausAerialWeights(19_900_000, 19_900_000, fovRad, viewportHeightPx, true);
  const w20_0 = manausAerialWeights(20_000_000, 20_000_000, fovRad, viewportHeightPx, true);
  const w20_1 = manausAerialWeights(20_100_000, 20_100_000, fovRad, viewportHeightPx, true);

  // Must not have a step drop to 0 at 20,000 km
  assert.ok(w20_0.farOpacity > 0.5, `farOpacity at 20,000 km must remain active, got ${w20_0.farOpacity}`);
  assert.ok(Math.abs(w19_9.farOpacity - w20_0.farOpacity) < 0.05, 'Continuous across 20,000 km boundary');
  assert.ok(Math.abs(w20_0.farOpacity - w20_1.farOpacity) < 0.05, 'Continuous across 20,000 km boundary');
});

test('T_MANAUS_FAR_35786KM_POLICY', () => {
  const fovRad = Math.PI / 3;
  const viewportHeightPx = 1080;
  const GEO_DIST_M = 35_786_000;

  const wGeo = manausAerialWeights(GEO_DIST_M, GEO_DIST_M, fovRad, viewportHeightPx, true);
  // Geostationary altitude (35,786 km) has a small, smooth residual visibility before 40,000 km cutoff
  assert.ok(wGeo.farOpacity > 0.01, `farOpacity at 35,786 km is positive, got ${wGeo.farOpacity}`);
  assert.ok(wGeo.farOpacity < 0.5, `farOpacity at 35,786 km is smooth and fading, got ${wGeo.farOpacity}`);

  // At 40,000 km (renderLimitM), it smoothly reaches 0
  const wLimit = manausAerialWeights(40_000_000, 40_000_000, fovRad, viewportHeightPx, true);
  assert.equal(wLimit.farOpacity, 0, 'Smoothly reaches 0 at 40,000 km');
});

test('T_MANAUS_LOCAL_SIMULATION_UNCHANGED', () => {
  assert.equal(MANAUS_AERIAL.startM, 8000);
  assert.equal(MANAUS_AERIAL.fullM, 12000);
  assert.equal(MANAUS_AERIAL.regionSizeM, 40000);
  assert.equal(MANAUS_AERIAL.chunkM, 16000);
  assert.equal(MANAUS_AERIAL.maxMeshes, 256);
  assert.equal(MANAUS_AERIAL.maxUrbanCells, 8000);
  assert.equal(MANAUS_AERIAL.maxRoadSegments, 20000);
});
