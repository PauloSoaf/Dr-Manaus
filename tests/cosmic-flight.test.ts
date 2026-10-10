import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import {
  BASE_THRUST_ACCEL, CosmicCruiseController, CRUISE_ALIGNMENT_THRESHOLD,
  cruiseAccelerationMps2, cruiseSecondsFor, LIGHT_SPEED_MPS, radialApproachSpeed,
  sweepSegmentSphere, WARP_STEPS_C, warpLabel, warpSpeedMps,
  type CosmicCruiseContext, type ResolvedTarget,
} from '../src/world/travel/CosmicFlight.ts';
import type { InterplanetaryState } from '../src/world/travel/TravelDomain.ts';
import { FLIGHT } from '../src/player/flightConfig.ts';
import { formatDistance, formatDuration, formatSpeed } from '../src/ui/format.ts';

const EARTH_R = 6_378_137;
const MOON_R = 1_738_100;
const MOON_DISTANCE = 384_400_000;

// Low orbit, not the planet's centre: [0,0,0] is inside the Earth, where the envelope pins you.
const state = (over: Partial<InterplanetaryState> = {}): InterplanetaryState => ({
  systemId: 'sol',
  positionM: [0, EARTH_R + 1_000_000, 0],
  velocityMps: [0, 0, 0],
  referenceBodyId: 'earth',
  ...over,
});

const target = (over: Partial<ResolvedTarget> = {}): ResolvedTarget => ({
  bodyId: 'moon',
  positionM: [0, MOON_DISTANCE, 0],
  radiusM: MOON_R,
  arrivalMarginM: 50_000,
  ...over,
});

const context = (over: Partial<CosmicCruiseContext> = {}): CosmicCruiseContext => ({
  altitudeM: 1_000_000,
  speedMps: 0,
  requested: true,
  nearestColliderM: Infinity,
  bodyRadiusM: EARTH_R,
  bodyPositionM: [0, 0, 0],
  bodyVelocityMps: [0, 0, 0],
  bodyId: 'earth',
  systemId: 'sol',
  envelopeMarginM: 1_000,
  cameraForwardBary: new Vector3(0, 1, 0),
  inputBoost: false,
  inputBrake: false,
  ...over,
});

// ---------------------------------------------------------------- T_APPROACH_SPEED_SIGN
test('T_APPROACH_SPEED_SIGN: closing on a target is positive', () => {
  const toTarget: [number, number, number] = [0, 1_000_000, 0];
  // Flying straight at it.
  assert.ok(radialApproachSpeed(toTarget, [0, 5_000, 0]) > 0, 'toward the target must be positive');
  // Flying away.
  assert.ok(radialApproachSpeed(toTarget, [0, -5_000, 0]) < 0, 'away must be negative');
  // Sideways.
  assert.ok(Math.abs(radialApproachSpeed(toTarget, [5_000, 0, 0])) < 1e-9, 'perpendicular is zero');
  // Magnitude is the component, not the speed.
  assert.ok(Math.abs(radialApproachSpeed(toTarget, [0, 5_000, 0]) - 5_000) < 1e-6);
  // Degenerate input does not produce NaN.
  assert.equal(radialApproachSpeed([0, 0, 0], [1, 1, 1]), 0);
});

test('T_COSMIC_TELEMETRY_FINITE: an ETA exists exactly while approaching', () => {
  const controller = new CosmicCruiseController();
  // Moving at the Moon.
  controller.update(
    state({ velocityMps: [0, 100_000, 0] }),
    1 / 60, new Vector3(), context({ target: target() }),
  );
  const approaching = controller.getTelemetry();
  assert.ok(approaching.timeToTargetS !== undefined, 'flying at the target must give an ETA');
  assert.ok(Number.isFinite(approaching.timeToTargetS), 'and it must be a number');
  assert.ok(approaching.timeToTargetS > 0);

  // Moving away from it.
  const retreating = new CosmicCruiseController();
  retreating.update(
    state({ velocityMps: [0, -100_000, 0] }),
    1 / 60, new Vector3(), context({ target: target() }),
  );
  assert.equal(retreating.getTelemetry().timeToTargetS, undefined, 'retreating has no arrival');

  for (const value of [approaching.speedMps, approaching.accelerationMps2, approaching.distanceToTargetM ?? 0]) {
    assert.ok(Number.isFinite(value), 'telemetry must never carry NaN');
  }
});

// ------------------------------------------------------------- T_CAMERA_TARGET_SAME_FRAME
test('T_CAMERA_TARGET_SAME_FRAME: alignment is measured in one frame', () => {
  const controller = new CosmicCruiseController();
  const moon = target();

  // Looking straight at the Moon, in the same frame the target is expressed in.
  const aligned = controller.update(
    state(), 1 / 60, new Vector3(),
    context({ target: moon, inputBoost: true, cameraForwardBary: new Vector3(0, 1, 0) }),
  );
  assert.notEqual(controller.getTelemetry().phase, 'align', 'looking at it must engage');
  assert.ok(aligned.velocityMps[1] > 0, 'and accelerate toward it');

  // The same camera vector as it would have been in render space, where +Y is not the Moon.
  // This is the bug the test exists for: a render-space forward dotted with a barycentric
  // direction gave a number that could pass or fail the alignment test by accident.
  const misaligned = new CosmicCruiseController();
  misaligned.update(
    state(), 1 / 60, new Vector3(),
    context({ target: moon, inputBoost: true, cameraForwardBary: new Vector3(1, 0, 0) }),
  );
  assert.equal(misaligned.getTelemetry().phase, 'align', 'looking elsewhere must refuse to cruise');
});

test('the alignment threshold is a cone, not a hemisphere', () => {
  const controller = new CosmicCruiseController();
  // Just inside the cone.
  const angle = Math.acos(CRUISE_ALIGNMENT_THRESHOLD) - 0.05;
  const forward = new Vector3(Math.sin(angle), Math.cos(angle), 0).normalize();
  controller.update(state(), 1 / 60, new Vector3(), context({ target: target(), inputBoost: true, cameraForwardBary: forward }));
  assert.notEqual(controller.getTelemetry().phase, 'align');

  const outside = new CosmicCruiseController();
  const wide = Math.acos(CRUISE_ALIGNMENT_THRESHOLD) + 0.05;
  outside.update(state(), 1 / 60, new Vector3(),
    context({ target: target(), inputBoost: true, cameraForwardBary: new Vector3(Math.sin(wide), Math.cos(wide), 0).normalize() }));
  assert.equal(outside.getTelemetry().phase, 'align');
});

// ------------------------------------------------- T_COSMIC_BRAKING_USES_COSMIC_CAPABILITY
test('T_COSMIC_BRAKING_USES_COSMIC_CAPABILITY: the brake matches the engine', () => {
  const remaining = MOON_DISTANCE;
  const seconds = cruiseSecondsFor(remaining);
  const accel = cruiseAccelerationMps2(remaining, seconds);
  assert.ok(accel > BASE_THRUST_ACCEL, 'a cosmic trip needs more than the manual thrust');

  // The stopping distance the plan is built on must use that same capability. With the old fixed
  // 100 000 m/s² the stopping distance was hundreds of times too long and the cruise overshot.
  const cruiseSpeed = accel * (seconds / 2);
  const stoppingWithCosmic = (cruiseSpeed * cruiseSpeed) / (2 * accel);
  const stoppingWithFixed = (cruiseSpeed * cruiseSpeed) / (2 * 100_000);
  assert.ok(stoppingWithCosmic < remaining, 'the trip must be stoppable within its own length');
  assert.ok(stoppingWithFixed > stoppingWithCosmic * 10, 'the old model was off by orders of magnitude');
});

test('T_MOON_TRAVEL_SECONDS_SCALE: Earth to the Moon arrives in seconds and stops', () => {
  const controller = new CosmicCruiseController();
  let current = state();
  const dt = 1 / 60;
  let elapsed = 0;
  let arrived = false;

  for (let frame = 0; frame < 60 * 120 && !arrived; frame++) {
    const moon = target();
    current = controller.update(current, dt, new Vector3(),
      context({ target: moon, inputBoost: true, cameraForwardBary: new Vector3(0, 1, 0) }));
    elapsed += dt;
    const gap = controller.getTelemetry().distanceToTargetM ?? Infinity;
    if (gap < 200_000) arrived = true;
  }

  assert.ok(arrived, 'the Moon must be reachable');
  assert.ok(elapsed < 90, `took ${elapsed.toFixed(1)} s to reach the Moon`);

  // And it does not sail through: the player ends outside the body.
  const distanceFromMoonCentre = Math.abs(MOON_DISTANCE - current.positionM[1]);
  assert.ok(distanceFromMoonCentre >= MOON_R, `ended ${(distanceFromMoonCentre / 1000).toFixed(0)} km from the centre`);
});

test('T_OUTER_PLANET_TRAVEL_SECONDS_SCALE: Neptune stays tens of seconds', () => {
  const neptune = target({ bodyId: 'neptune', positionM: [0, 4.5e12, 0], radiusM: 24_622_000 });
  const seconds = cruiseSecondsFor(4.5e12);
  assert.ok(seconds <= 25, `a trip plan of ${seconds} s is not tens of seconds`);
  const accel = cruiseAccelerationMps2(4.5e12, seconds);
  assert.ok(Number.isFinite(accel) && accel > 0);
  // And the controller actually closes on it rather than stalling.
  const controller = new CosmicCruiseController();
  let current = state();
  for (let i = 0; i < 600; i++) {
    current = controller.update(current, 1 / 60, new Vector3(),
      context({ target: neptune, inputBoost: true, cameraForwardBary: new Vector3(0, 1, 0) }));
  }
  assert.ok(current.positionM[1] > 0, 'it must have set off at all');
});

// -------------------------------------------------------- T_TARGET_SWEEP_PREVENTS_TUNNEL
test('T_TARGET_SWEEP_PREVENTS_TUNNEL: a step past the Moon still hits it', () => {
  // The segment starts short of the Moon and ends beyond it; both endpoints are outside.
  const from: [number, number, number] = [0, MOON_DISTANCE - 5_000_000, 0];
  const step: [number, number, number] = [0, 10_000_000, 0];
  const hit = sweepSegmentSphere(from, step, [0, MOON_DISTANCE, 0], MOON_R);
  assert.ok(hit !== undefined, 'an endpoint test would miss this entirely');
  assert.ok(hit >= 0 && hit <= 1);

  // A segment that misses by a wide margin does not report a hit.
  assert.equal(
    sweepSegmentSphere([0, 0, 0], [0, 10_000_000, 0], [1e9, MOON_DISTANCE, 0], MOON_R),
    undefined,
  );

  // And the controller applies it: flying at the Moon at cosmic speed does not pass through.
  const controller = new CosmicCruiseController();
  const moon = target();
  const next = controller.update(
    state({ positionM: [0, MOON_DISTANCE - 5_000_000, 0], velocityMps: [0, 600_000_000, 0] }),
    1 / 60, new Vector3(),
    // Earth is still the dominant body here, which is exactly the case the old sweep missed.
    context({ target: moon, bodyId: 'earth', bodyPositionM: [0, 0, 0] }),
  );
  const gap = Math.abs(MOON_DISTANCE - next.positionM[1]);
  assert.ok(gap >= MOON_R, `tunnelled to ${(gap / 1000).toFixed(0)} km from the Moon's centre`);
});

test('T_TARGET_POSITION_UPDATES_WITH_EPHEMERIS: the target is resolved, not remembered', () => {
  const controller = new CosmicCruiseController();
  const early = controller.update(
    state({ velocityMps: [0, 1_000, 0] }), 1 / 60, new Vector3(),
    context({ target: target({ positionM: [0, MOON_DISTANCE, 0] }) }),
  );
  const firstDistance = controller.getTelemetry().distanceToTargetM ?? 0;

  // The same player, the same frame, but the body has moved on its orbit.
  const moved = new CosmicCruiseController();
  moved.update(
    state({ velocityMps: [0, 1_000, 0] }), 1 / 60, new Vector3(),
    context({ target: target({ positionM: [0, MOON_DISTANCE * 2, 0] }) }),
  );
  const secondDistance = moved.getTelemetry().distanceToTargetM ?? 0;

  assert.ok(secondDistance > firstDistance * 1.5, 'a moved body must change the distance');
  void early;
});

test('T_X_SPACE_BRAKE: the brake kills relative speed in every axis', () => {
  const controller = new CosmicCruiseController();
  let current = state({ velocityMps: [100_000, -50_000, 25_000] });
  for (let i = 0; i < 120; i++) {
    current = controller.update(current, 1 / 60, new Vector3(), context({ inputBrake: true }));
  }
  const speed = Math.hypot(...current.velocityMps);
  assert.ok(speed < 1, `the brake left ${speed.toFixed(1)} m/s`);
});

test('the brake stops relative to the body, not to the barycentre', () => {
  const controller = new CosmicCruiseController();
  const earthVelocity: [number, number, number] = [0, 29_780, 0];
  let current = state({ velocityMps: [50_000, 29_780, 0] });
  for (let i = 0; i < 120; i++) {
    current = controller.update(current, 1 / 60, new Vector3(),
      context({ inputBrake: true, bodyVelocityMps: earthVelocity }));
  }
  // Stopped with respect to Earth means still orbiting the Sun with it.
  assert.ok(Math.abs(current.velocityMps[0]) < 1);
  assert.ok(Math.abs(current.velocityMps[1] - 29_780) < 1, 'must not have stopped dead in space');
});

// ------------------------------------------------------------------ flight tier ladder
test('flight config defines all tiers with progressive speeds', () => {
  for (const tier of ['fast', 'super', 'mega', 'interplanetary'] as const) {
    assert.ok(FLIGHT.speeds[tier] > 0, `${tier} must have a speed`);
  }
  assert.ok(FLIGHT.speeds.super > FLIGHT.speeds.fast);
  assert.ok(FLIGHT.speeds.mega > FLIGHT.speeds.super);
  assert.ok(FLIGHT.speeds.interplanetary > FLIGHT.speeds.mega);
  assert.ok(FLIGHT.maxSpeed >= FLIGHT.speeds.interplanetary, 'the cap must not clip the top tier');
});

// ------------------------------------------------------------------- T_SPEED_FORMAT_FINITE
test('T_SPEED_FORMAT_FINITE: every readout survives every magnitude', () => {
  for (const speed of [0, 12, 500, 8_000, 222_222, 3e8, 1e12, Number.NaN, Number.POSITIVE_INFINITY]) {
    const formatted = formatSpeed(speed);
    assert.equal(typeof formatted.value, 'string');
    assert.ok(!formatted.value.includes('NaN'), `speed ${speed} formatted as ${formatted.value}`);
  }
  for (const distance of [0, 900, 384_400_000, 4.5e12, Number.NaN, Number.POSITIVE_INFINITY]) {
    const formatted = formatDistance(distance);
    assert.ok(!formatted.includes('NaN'), `distance ${distance} formatted as ${formatted}`);
  }
  for (const seconds of [undefined, 0, 12.5, 3_600, Number.NaN, -1]) {
    const formatted = formatDuration(seconds);
    assert.ok(!formatted.includes('NaN'), `duration ${seconds} formatted as ${formatted}`);
  }
  // The speed of light gets its own unit rather than an unreadable number of km/s.
  assert.equal(formatSpeed(299_792_458).unit, 'c');
  assert.equal(formatSpeed(1_000).unit, 'km/s');
});

// ------------------------------------------------------------------------- warp gear
test('T_WARP_DOUBLES_EACH_STEP: every press is twice the last', () => {
  assert.equal(warpSpeedMps(0), 0, 'step zero is the gear being out');
  assert.equal(warpSpeedMps(1), LIGHT_SPEED_MPS, 'the first press is lightspeed');
  assert.equal(warpSpeedMps(2), 2 * LIGHT_SPEED_MPS);
  assert.equal(warpSpeedMps(3), 4 * LIGHT_SPEED_MPS);
  for (let step = 2; step <= WARP_STEPS_C.length; step++) {
    assert.equal(warpSpeedMps(step), warpSpeedMps(step - 1) * 2, `step ${step} must double step ${step - 1}`);
  }
  // Past the last gear it holds rather than running off into infinity.
  assert.equal(warpSpeedMps(WARP_STEPS_C.length + 5), warpSpeedMps(WARP_STEPS_C.length));
  assert.equal(warpLabel(2), '2c');
  assert.equal(warpLabel(0), '');
});

test('T_WARP_REACHES_ITS_SPEED: the gear is reached in about a second, not a minute', () => {
  const controller = new CosmicCruiseController();
  let current = state();
  const forward = new Vector3(0, 1, 0);
  let elapsed = 0;
  const wanted = warpSpeedMps(3); // 4c

  for (let i = 0; i < 60 * 10; i++) {
    current = controller.update(current, 1 / 60, forward, context({ warpStep: 3 }));
    elapsed += 1 / 60;
    if (controller.getTelemetry().speedMps >= wanted * 0.95) break;
  }

  assert.ok(controller.getTelemetry().speedMps >= wanted * 0.95, 'the gear must actually be reached');
  assert.ok(elapsed < 3, `took ${elapsed.toFixed(2)} s to reach 4c`);
  // And it does not sail past the gear it was given.
  for (let i = 0; i < 300; i++) current = controller.update(current, 1 / 60, forward, context({ warpStep: 3 }));
  assert.ok(controller.getTelemetry().speedMps <= wanted * 1.001, 'the gear is a ceiling, not a suggestion');
});

test('warp still stops at a planet rather than through it', () => {
  const controller = new CosmicCruiseController();
  const moon = target();
  // At 8c a frame covers four million kilometres: ten times the Earth-Moon distance.
  const next = controller.update(
    state({ positionM: [0, MOON_DISTANCE - 5_000_000, 0], velocityMps: [0, warpSpeedMps(4), 0] }),
    1 / 60, new Vector3(),
    context({ target: moon, warpStep: 4, bodyId: 'earth', bodyPositionM: [0, 0, 0] }),
  );
  const gap = Math.abs(MOON_DISTANCE - next.positionM[1]);
  assert.ok(gap >= MOON_R, `warp tunnelled to ${(gap / 1000).toFixed(0)} km from the Moon's centre`);
});

test('the warp readout survives every gear', () => {
  for (let step = 0; step <= WARP_STEPS_C.length + 2; step++) {
    const label = warpLabel(step);
    assert.ok(!label.includes('NaN') && !label.includes('undefined'), `step ${step} rendered as ${label}`);
    const speed = formatSpeed(warpSpeedMps(step));
    assert.ok(!speed.value.includes('NaN'));
  }
  // At warp the readout is in multiples of c rather than an unreadable number of km/s.
  assert.equal(formatSpeed(warpSpeedMps(1)).unit, 'c');
});
