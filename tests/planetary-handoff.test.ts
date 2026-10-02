import test from 'node:test';
import assert from 'node:assert/strict';
import { UniverseRuntime, TRAVEL_VIEW_FRAME } from '../src/world/runtime/UniverseRuntime.ts';
import { EARTH, MARS, MOON, bodyGeodeticToFixed } from '../src/world/planet/PlanetBody.ts';
import { geodetic } from '../src/world/spatial/Geodetic.ts';
import { MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter.ts';
import type { Quat, Vec3 } from '../src/world/spatial/units.ts';

const closeVec = (actual: Vec3, expected: Vec3, epsilon: number, message: string): void => {
  const error = Math.hypot(
    actual[0] - expected[0], actual[1] - expected[1], actual[2] - expected[2],
  );
  assert.ok(error <= epsilon, `${message}: error ${error} m; ${actual} vs ${expected}`);
};

const closeQuat = (actual: Quat, expected: Quat, epsilon: number, message: string): void => {
  const dot = Math.abs(actual[0] * expected[0] + actual[1] * expected[1]
    + actual[2] * expected[2] + actual[3] * expected[3]);
  assert.ok(1 - dot <= epsilon, `${message}: |dot|=${dot}`);
};

test('Moon ENU location uses the body ellipsoid after handoff, without hard-coded radii', () => {
  const runtime = new UniverseRuntime({ epochS: 0 });
  const fixed = bodyGeodeticToFixed(MOON, geodetic(0.61, -1.12, 12_345.678));
  const bary = runtime.frames.convertPosition(
    'solar-system/moon-fixed', 'solar-system/barycentric', [fixed.xM, fixed.yM, fixed.zM],
  );
  const moonVelocity = runtime.activeSystem.stateOf(MOON.id)!.velocityMps;

  runtime.updateSystemPose(bary, moonVelocity, 0, [0, 0, -1]);
  const local = runtime.handoffTo(MOON.id);

  assert.equal(runtime.player.frame, 'moon/local-enu');
  assert.equal(runtime.navigationState.bodyId, MOON.id);
  assert.ok(Math.abs(local[0]) < 1e-7 && Math.abs(local[2]) < 1e-7);
  assert.ok(Math.abs(local[1] - 12_345.678) < 1e-4, `ENU altitude was ${local[1]}`);
  assert.ok(runtime.location.surface);
  assert.ok(Math.abs(runtime.location.surface.latDeg - 0.61 * 180 / Math.PI) < 1e-8);
  assert.ok(Math.abs(runtime.location.surface.lonDeg + 1.12 * 180 / Math.PI) < 1e-8);
  assert.ok(Math.abs(runtime.location.surface.altitudeM - 12_345.678) < 1e-4);
});

test('Earth -> Mars surface -> departure -> Earth preserves logical pose, velocity and orientation', () => {
  const runtime = new UniverseRuntime({ epochS: 0 });
  const earthLocal: Vec3 = [123.5, 6_000, -456.25];
  const earthVelocity: Vec3 = [17, 23, -31];
  const initialOrientation: Quat = [0.1025978352, -0.2051956704, 0.3077935056, 0.9233805169];
  runtime.player.orientation[0] = initialOrientation[0];
  runtime.player.orientation[1] = initialOrientation[1];
  runtime.player.orientation[2] = initialOrientation[2];
  runtime.player.orientation[3] = initialOrientation[3];
  runtime.update(earthLocal, earthVelocity, 0, [0.2, 0.3, -0.9]);

  const earthBary = runtime.frames.convertPosition(MANAUS_FRAME_ID, 'solar-system/barycentric', earthLocal);
  const earthSystemVelocity = runtime.systemVelocityMps();
  runtime.updateSystemPose(earthBary, earthSystemVelocity, 0, [0.2, 0.3, -0.9]);

  const marsFixed = bodyGeodeticToFixed(MARS, geodetic(-0.37, 2.21, 321.125));
  const marsBary = runtime.frames.convertPosition(
    'solar-system/mars-fixed', 'solar-system/barycentric', [marsFixed.xM, marsFixed.yM, marsFixed.zM],
  );
  const marsRelativeFixed: Vec3 = [11, -7, 5];
  const marsRelativeSystem = runtime.frames.convertDirection(
    'solar-system/mars-fixed', 'solar-system/barycentric', marsRelativeFixed,
  );
  const marsOrbital = runtime.activeSystem.stateOf(MARS.id)!.velocityMps;
  const marsSystemVelocity: Vec3 = [
    marsOrbital[0] + marsRelativeSystem[0],
    marsOrbital[1] + marsRelativeSystem[1],
    marsOrbital[2] + marsRelativeSystem[2],
  ];

  runtime.updateSystemPose(marsBary, marsSystemVelocity, 0, [0, -0.2, -1]);
  runtime.handoffTo(MARS.id);
  assert.equal(runtime.player.frame, 'mars/local-enu');
  assert.equal(runtime.navigationState.bodyId, MARS.id);
  assert.ok(Math.abs(runtime.location.surface!.altitudeM - 321.125) < 1e-4);
  const velocityBeforeDeparture = runtime.systemVelocityMps();
  closeVec(velocityBeforeDeparture, marsSystemVelocity, 1e-8, 'Mars relative velocity round trip');

  const marsDeparturePosition = runtime.frames.convertPosition(runtime.player.frame, 'solar-system/barycentric', runtime.player.position);
  runtime.updateSystemPose(marsDeparturePosition, velocityBeforeDeparture, 0, [0, 1, 0]);
  assert.equal(runtime.player.frame, 'solar-system/barycentric');
  assert.equal(runtime.renderSpace.currentOrigin.frame, TRAVEL_VIEW_FRAME);
  assert.equal(runtime.navigationState.bodyId, undefined, 'space navigation must not retain Mars');
  closeVec(
    runtime.frames.convertDirection('mars/local-enu', TRAVEL_VIEW_FRAME, [0, 1, 0]),
    [0, 1, 0], 1e-12, 'travel/view preserves departure axes',
  );

  runtime.updateSystemPose(earthBary, earthSystemVelocity, 0, [0.2, 0.3, -0.9]);
  runtime.handoffTo(EARTH.id);
  assert.equal(runtime.player.frame, MANAUS_FRAME_ID);
  assert.equal(runtime.navigationState.bodyId, EARTH.id);
  closeVec(runtime.player.position, earthLocal, 2e-5, 'Earth return position');
  closeVec(runtime.localVelocityMps, earthVelocity, 1e-8, 'Earth return velocity');
  closeQuat(runtime.player.orientation, initialOrientation, 1e-10, 'Earth return orientation');
});

test('handoff is idempotent and does not recreate or move an active landing frame', () => {
  const runtime = new UniverseRuntime({ epochS: 0 });
  const fixed = bodyGeodeticToFixed(MARS, geodetic(0.2, 0.4, 50));
  const bary = runtime.frames.convertPosition(
    'solar-system/mars-fixed', 'solar-system/barycentric', [fixed.xM, fixed.yM, fixed.zM],
  );
  runtime.updateSystemPose(bary, runtime.activeSystem.stateOf(MARS.id)!.velocityMps, 0);
  const first = runtime.handoffTo(MARS.id);
  const frame = runtime.frames.get('mars/local-enu');
  const origin = [...frame.originInParent];
  const second = runtime.handoffTo(MARS.id);
  assert.deepEqual(second, first);
  assert.strictEqual(runtime.frames.get('mars/local-enu'), frame);
  assert.deepEqual(frame.originInParent, origin);
});
