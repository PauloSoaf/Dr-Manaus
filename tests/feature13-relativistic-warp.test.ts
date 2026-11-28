import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { RelativisticWarpController } from '../src/world/travel/BodyNavigation';

test('CT-13-01: RelativisticWarpController accelerates smoothly in deep space up to 10c', () => {
  const warp = new RelativisticWarpController();
  const forward = new Vector3(0, 0, -1);
  const velocity = new Vector3();

  // In deep space (> 500 km from any celestial body)
  const deepSpaceDistanceM = 100_000_000; // 100,000 km
  let telemetry = warp.updateFlightVelocity(0.1, 1.0, deepSpaceDistanceM, forward, velocity);

  assert.strictEqual(telemetry.inGravityWell, false, 'Should be in clear deep space');
  assert.strictEqual(telemetry.speedCapMps, RelativisticWarpController.MAX_WARP_SPEED_MPS);
  assert.ok(telemetry.currentSpeedMps > 0, 'Should start accelerating');

  // Accelerate over several seconds of simulated flight
  for (let step = 0; step < 50; step++) {
    telemetry = warp.updateFlightVelocity(0.1, 1.0, deepSpaceDistanceM, forward, velocity);
  }

  // Speed should approach 10c (~2.998e9 m/s)
  assert.ok(
    telemetry.currentSpeedMps > 2_500_000_000,
    `Warp speed should reach relativistic cruise: got ${telemetry.currentSpeedMps}`
  );
  assert.ok(telemetry.effectiveC > 8.0, `Effective speed should exceed 8c: got ${telemetry.effectiveC}`);
  assert.ok(velocity.z < -2_500_000_000, 'Velocity vector must match forward heading');
});

test('CT-13-02: RelativisticWarpController gravitational well auto-brake clamps speed below 500 km', () => {
  const warp = new RelativisticWarpController();
  const forward = new Vector3(0, 0, -1);
  const velocity = new Vector3();

  // Inside gravitational well (< 500 km, e.g. 150 km above surface)
  const wellDistanceM = 150_000;
  let telemetry = warp.updateFlightVelocity(0.1, 1.0, wellDistanceM, forward, velocity);

  assert.strictEqual(telemetry.inGravityWell, true, 'Must detect gravitational well');
  assert.strictEqual(
    telemetry.speedCapMps,
    RelativisticWarpController.MAX_SUBLIGHT_SPEED_MPS,
    'Speed cap must be clamped to sublight limit in gravity well'
  );

  // Even with sustained max throttle, speed cannot exceed 10 km/s in gravity well
  for (let step = 0; step < 50; step++) {
    telemetry = warp.updateFlightVelocity(0.1, 1.0, wellDistanceM, forward, velocity);
  }

  assert.ok(
    telemetry.currentSpeedMps <= RelativisticWarpController.MAX_SUBLIGHT_SPEED_MPS + 1e-4,
    `Speed must be clamped below 10 km/s in gravity well: got ${telemetry.currentSpeedMps}`
  );
  assert.ok(telemetry.warpRatio < 0.0001, 'Warp ratio must remain near zero in gravity well');
});

test('CT-13-03: Relativistic dynamic FoV expands from 60 degrees to 95 degrees based on warp factor', () => {
  const warp = new RelativisticWarpController();
  const forward = new Vector3(0, 0, -1);
  const velocity = new Vector3();

  // At rest (0 m/s)
  const restFoV = warp.getRelativisticFoV();
  assert.strictEqual(restFoV, 60.0, 'Base FoV should be 60 degrees');

  // Accelerate to maximum warp speed (10c)
  for (let i = 0; i < 60; i++) {
    warp.updateFlightVelocity(0.1, 1.0, 50_000_000, forward, velocity);
  }

  const maxWarpFoV = warp.getRelativisticFoV();
  assert.ok(
    maxWarpFoV >= 94.0 && maxWarpFoV <= 95.0,
    `Maximum warp FoV should expand to near 95 degrees: got ${maxWarpFoV}`
  );
});

test('CT-13-04: Relativistic aberration deflects photons forward into headlight cone', () => {
  const warp = new RelativisticWarpController();
  const heading = new Vector3(0, 0, -1);
  // Photon approaching perpendicular to heading (e.g. from the right at +X)
  const photonPerp = new Vector3(1, 0, 0);
  const deflected = new Vector3();

  // At beta = 0 (no motion), direction is unchanged
  warp.computeAberrationDirection(photonPerp, heading, 0.0, deflected);
  assert.ok(Math.abs(deflected.x - 1.0) < 1e-4);
  assert.ok(Math.abs(deflected.z) < 1e-4);

  // At relativistic speed (beta = 0.95), perpendicular photon is deflected sharply forward (headlight effect)
  warp.computeAberrationDirection(photonPerp, heading, 0.95, deflected);
  assert.ok(
    deflected.dot(heading) > 0.85,
    `Perpendicular photon must be deflected forward along heading: got dot=${deflected.dot(heading)}`
  );
  assert.ok(Math.abs(deflected.length() - 1.0) < 1e-4, 'Deflected direction must remain normalized');
});
