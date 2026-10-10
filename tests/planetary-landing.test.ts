import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import {
  LANDING_POLICY, PlanetaryLandingIntent, landingCaptureRangeM, landingCaptureStep,
  landingEtaS, landingHoldClearanceM, predictTouchdownDirection, resolveCelestialContact,
  resolveLandingCandidate, type LandingBody,
} from '../src/world/travel/PlanetaryLanding.ts';
import { LANDING_SPEED_LIMITS, relativeSurfaceMotion } from '../src/world/travel/LandingCapture.ts';
import { CosmicCruiseController } from '../src/world/travel/CosmicFlight.ts';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { MOON } from '../src/world/planet/PlanetBody.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

const RADIUS = MOON.semiMajorAxisM;
const RETURN_ALTITUDE = 7000;
const FPS = [30, 60, 120] as const;
const SPEEDS_KMPS = [2, 8, 100, 260] as const;
const NORMAL: Vec3 = [2 / 3, -2 / 3, 1 / 3];
const TANGENT: Vec3 = [Math.SQRT1_2, Math.SQRT1_2, 0];
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const scale = (v: Vec3, amount: number): Vec3 => v.map(value => value * amount) as Vec3;
const add = (a: Vec3, b: Vec3): Vec3 => a.map((value, i) => value + b[i]) as Vec3;
const near = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} must be within ${tolerance} of ${expected}`);
const finite = (v: Vec3) => assert.ok(v.every(Number.isFinite), `finite vector required: ${v}`);
const moon = (over: Partial<LandingBody> = {}): LandingBody =>
  ({ id: 'moon', canLand: true, clearanceM: 100_000, radiusM: RADIUS, ...over });

test('T_LANDING_APPROACH_ENTERS_HOLD_WHILE_PATCH_MISSING', () => {
  for (const fps of FPS) {
    const velocity: [number, number, number] = [-8000, 0, 0];
    let clearance = 15_000, phase: 'capture' | 'hold' = 'capture';
    for (let frame = 0; frame < fps * 30; frame++) {
      phase = landingCaptureStep(velocity, [RADIUS + clearance, 0, 0], clearance,
        false, RETURN_ALTITUDE, 1 / fps).phase;
      clearance += velocity[0] / fps;
    }
    assert.equal(phase, 'hold', `approach at ${fps} FPS must actually enter the waiting phase`);
    assert.ok(Math.abs(clearance - landingHoldClearanceM(false, RETURN_ALTITUDE)) < .1);
    assert.ok(Math.hypot(...velocity) < 1e-6);
  }
});

test('T_LANDING_CANDIDATE_LOCKED_MOON', () => {
  const earth: LandingBody = { id: 'earth', canLand: true, clearanceM: 50_000, radiusM: 6_378_137 };
  assert.deepEqual(resolveLandingCandidate([earth, moon()], 'earth', 'moon'), { ok: true, bodyId: 'moon' });
  assert.deepEqual(resolveLandingCandidate([moon()], undefined, 'moon'), { ok: true, bodyId: 'moon' });
});

test('T_LANDING_CANDIDATE_DOMINANT_MOON', () => {
  assert.deepEqual(resolveLandingCandidate([moon()], 'moon', undefined), { ok: true, bodyId: 'moon' });
  const distantEarth: LandingBody = { id: 'earth', canLand: true, clearanceM: 380_000_000, radiusM: 6_378_137 };
  assert.deepEqual(resolveLandingCandidate([distantEarth, moon()], 'moon', 'earth'), { ok: true, bodyId: 'moon' });
});

test('T_LANDING_REJECTS_DEEP_SPACE', () => {
  assert.deepEqual(resolveLandingCandidate([moon()], undefined, undefined), { ok: false, reason: 'no-body' });
  assert.deepEqual(resolveLandingCandidate([moon({ clearanceM: 380_000_000 })], 'moon', 'moon'),
    { ok: false, reason: 'out-of-range', bodyId: 'moon' });
  for (const clearanceM of [NaN, Infinity, -Infinity]) {
    assert.equal(resolveLandingCandidate([moon({ clearanceM })], 'moon', undefined).ok, false);
  }
});

test('T_LANDING_REJECTS_JUPITER', () => {
  const jupiter: LandingBody = { id: 'jupiter', canLand: false, clearanceM: 1000, radiusM: 71_492_000 };
  assert.deepEqual(resolveLandingCandidate([jupiter], 'jupiter', 'jupiter'),
    { ok: false, reason: 'not-landable', bodyId: 'jupiter' });
});

test('T_LANDING_CAPTURE_RANGE_BOUNDED', () => {
  near(landingCaptureRangeM(RADIUS), RADIUS * 4);
  assert.equal(landingCaptureRangeM(71_492_000), 30_000_000);
  assert.equal(landingCaptureRangeM(-1), 0);
  for (const radiusM of [1, RADIUS, 6_378_137, 71_492_000, 696_340_000]) {
    const limit = landingCaptureRangeM(radiusM);
    assert.ok(limit <= LANDING_POLICY.captureRangeMaxM);
    assert.equal(resolveLandingCandidate([moon({ radiusM, clearanceM: limit })], 'moon', undefined).ok, true);
    assert.equal(resolveLandingCandidate([moon({ radiusM, clearanceM: limit + 1 })], 'moon', undefined).ok, false);
  }
});

test('T_LANDING_CAPTURE_BRAKES_RADIAL', () => {
  for (const fps of FPS) {
    const relVel = scale(NORMAL, -260_000);
    const before = dot(relVel, NORMAL);
    const step = landingCaptureStep(relVel, scale(NORMAL, RADIUS + 100_000), 100_000, false, RETURN_ALTITUDE, 1 / fps);
    assert.equal(step.phase, 'capture');
    assert.ok(step.accelerationMps2 < 0);
    assert.ok(dot(relVel, NORMAL) > before, 'closing speed must fall on the first frame');
    assert.ok(dot(relVel, NORMAL) < 0, 'braking cannot reflect inward velocity');
    finite(relVel);
  }
});

test('T_LANDING_CAPTURE_DAMPS_TANGENTIAL', () => {
  const relVel = add(scale(NORMAL, -100_000), scale(TANGENT, 80_000));
  const before = Math.abs(dot(relVel, TANGENT));
  landingCaptureStep(relVel, scale(NORMAL, RADIUS + 100_000), 100_000, false, RETURN_ALTITUDE, 1 / 60);
  assert.ok(Math.abs(dot(relVel, TANGENT)) < before);
  const contact = resolveCelestialContact('landing-capture', relVel, NORMAL);
  near(dot(relVel, NORMAL), 0);
  near(contact.radialSpeedMps, 0);
  near(Math.hypot(...relVel), LANDING_POLICY.captureContactTangentCapMps);
  near(contact.tangentialSpeedMps, Math.hypot(...relVel));
});

test('T_LANDING_CAPTURE_NEVER_BOUNCES_OUTWARD', () => {
  for (const speedKmps of SPEEDS_KMPS) for (const normal of [NORMAL, [0, 1, 0] as Vec3]) {
    const relVel = scale(normal, -speedKmps * 1000);
    const result = resolveCelestialContact('landing-capture', relVel, normal);
    near(dot(relVel, normal), 0);
    near(Math.hypot(...relVel), 0);
    near(result.radialSpeedMps, 0);
    // Repeated collision resolution must not pump energy into a resting contact.
    for (let i = 0; i < 20; i++) resolveCelestialContact('landing-capture', relVel, normal);
    near(Math.hypot(...relVel), 0);
  }
  const separating: Vec3 = [0, 25, 0];
  resolveCelestialContact('landing-capture', separating, [0, 1, 0]);
  assert.deepEqual(separating, [0, 25, 0], 'existing outward separation must be preserved, not created or amplified');
});

test('T_LANDING_HOLD_RELATIVE_VELOCITY_NEAR_ZERO', () => {
  const bodyVelocity: Vec3 = [29_700, -1022, 131];
  for (const ready of [false, true]) for (const fps of FPS) {
    const hold = landingHoldClearanceM(ready, RETURN_ALTITUDE);
    assert.ok(ready ? hold < RETURN_ALTITUDE : hold > RETURN_ALTITUDE);
    const relVel = add(scale(NORMAL, -260_000), scale(TANGENT, 100_000));
    for (let frame = 0; frame < fps * 2; frame++) {
      const step = landingCaptureStep(relVel, scale(NORMAL, RADIUS + hold), hold, ready, RETURN_ALTITUDE, 1 / fps);
      assert.equal(step.phase, 'hold');
      assert.ok(dot(relVel, NORMAL) <= 1e-8);
      finite(relVel);
    }
    near(Math.hypot(...relVel), 0);
    const motion = relativeSurfaceMotion(add(bodyVelocity, relVel), bodyVelocity, NORMAL);
    near(motion.relativeSpeedMps, 0);
    near(motion.radialSpeedMps, 0);
  }
});

/** The full Cartesian matrix runs through capture, an inelastic contact, and hold. */
function assertLandingMatrix(fps: number, speedKmps: number): void {
  const speed = speedKmps * 1000;
  const initial = add(scale(NORMAL, -speed * 0.8), scale(TANGENT, speed * 0.6));
  const relVel = [...initial] as Vec3;
  for (let frame = 0; frame < fps * 2; frame++) {
    const step = landingCaptureStep(relVel, scale(NORMAL, RADIUS + 100_000), 100_000, false, RETURN_ALTITUDE, 1 / fps);
    assert.equal(step.phase, 'capture');
    assert.ok(dot(relVel, NORMAL) <= 1e-8, `${speedKmps} km/s at ${fps} FPS must not bounce`);
    finite(relVel);
    assert.ok(Number.isFinite(step.accelerationMps2));
  }
  near(dot(relVel, NORMAL), -LANDING_SPEED_LIMITS.approachCaptureSpeedMps);
  near(dot(relVel, TANGENT), 0);
  const impact = [...initial] as Vec3;
  const response = resolveCelestialContact('landing-capture', impact, NORMAL);
  near(dot(impact, NORMAL), 0);
  near(response.radialSpeedMps, 0);
  assert.ok(Math.hypot(...impact) <= LANDING_POLICY.captureContactTangentCapMps + 1e-8);
  finite(impact);
  for (let frame = 0; frame < fps; frame++) {
    const step = landingCaptureStep(impact, scale(NORMAL, RADIUS + 5600), 5600, true, RETURN_ALTITUDE, 1 / fps);
    assert.equal(step.phase, 'hold');
    assert.ok(dot(impact, NORMAL) <= 1e-8);
    finite(impact);
  }
  near(Math.hypot(...impact), 0);
}

for (const fps of FPS) test(`T_LANDING_${fps}FPS`, () => {
  for (const speed of SPEEDS_KMPS) assertLandingMatrix(fps, speed);
});
for (const speed of SPEEDS_KMPS) test(`T_LANDING_${speed}_KMPS`, () => {
  for (const fps of FPS) assertLandingMatrix(fps, speed);
});

test('T_TOUCHDOWN_DIRECTION_BODY_FIXED', () => {
  const frames = new ReferenceFrameGraph();
  frames.register(referenceFrame({ id: 'solar', kind: 'system' }));
  const position: Vec3 = [2 * RADIUS, 0.25 * RADIUS, 0];
  const velocity: Vec3 = [-8000, 0, 0];
  const expected: Vec3 = [Math.sqrt(1 - 0.25 ** 2), 0.25, 0];
  for (const angle of [0, Math.PI / 2, Math.PI]) {
    frames.register(referenceFrame({ id: 'moon/fixed', parentId: 'solar', kind: 'body-fixed',
      originInParent: [150_000_000_000, -380_000_000, 90_000_000],
      rotationToParent: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] }));
    const systemPosition = frames.convertPosition('moon/fixed', 'solar', position);
    const systemVelocity = frames.convertDirection('moon/fixed', 'solar', velocity);
    const touchdown = predictTouchdownDirection(frames.convertPosition('solar', 'moon/fixed', systemPosition),
      frames.convertDirection('solar', 'moon/fixed', systemVelocity), RADIUS);
    touchdown.forEach((value, i) => near(value, expected[i], 1e-9));
    near(Math.hypot(...touchdown), 1);
  }
  assert.deepEqual(predictTouchdownDirection([2 * RADIUS, 0, 0], [1, 0, 0], RADIUS), [1, 0, 0]);
  assert.deepEqual(predictTouchdownDirection([2 * RADIUS, 0, 0], [0, 8000, 0], RADIUS), [1, 0, 0]);
});

test('T_LANDING_ETA_FINITE_WHEN_CLOSING', () => {
  for (const speed of SPEEDS_KMPS) {
    const eta = landingEtaS(100_000, speed * 1000);
    assert.ok(Number.isFinite(eta) && eta > 0);
    near(eta, 100 / speed);
  }
  assert.equal(landingEtaS(0, 1000), 0);
  assert.equal(landingEtaS(-1, 1000), 0);
});

test('T_LANDING_ETA_INFINITY_WHEN_RECEDING', () => {
  for (const speed of [0, -2000, -8000, -100_000, -260_000]) assert.equal(landingEtaS(100_000, speed), Infinity);
});

test('landing intent has explicit capture and cancellation lifetime', () => {
  const intent = new PlanetaryLandingIntent();
  assert.equal(intent.active, false);
  assert.equal(intent.phase, 'idle');
  intent.request('moon');
  assert.equal(intent.active, true);
  assert.equal(intent.bodyId, 'moon');
  assert.equal(intent.phase, 'capture');
  intent.phase = 'hold';
  intent.cancel();
  assert.equal(intent.active, false);
  assert.equal(intent.bodyId, undefined);
  assert.equal(intent.phase, 'idle');
});

test('landing capture contact remains relative to the moving contacted body', () => {
  for (const fps of FPS) {
    const output: Vec3[] = [];
    for (const bodyVelocity of [[0, 0, 0], [29_700, -1022, 131]] as Vec3[]) {
      const centre: Vec3 = [150_000_000_000, -380_000_000, 0];
      const controller = new CosmicCruiseController();
      const result = controller.update({ systemId: 'sol', referenceBodyId: 'moon',
        positionM: add(centre, [RADIUS + 1001, 0, 0]), velocityMps: add(bodyVelocity, [-260_000, 80_000, 0]) },
      1 / fps, new Vector3(), {
        bodyId: 'moon', bodyPositionM: centre, bodyVelocityMps: bodyVelocity, bodyRadiusM: RADIUS,
        altitudeM: 1001, speedMps: 260_000, requested: true, nearestColliderM: Infinity, envelopeMarginM: 1000,
        cameraForwardBary: new Vector3(-1, 0, 0), inputBoost: false, inputBrake: false,
        landingIntent: { bodyId: 'moon', centreM: centre, velocityMps: bodyVelocity, radiusM: RADIUS,
          clearanceM: 1001, surfaceReady: false, returnAltitudeM: RETURN_ALTITUDE },
      });
      const contact = controller.lastCelestialContact;
      assert.ok(contact, 'fixture must exercise actual CCD contact');
      assert.equal(contact.bodyId, 'moon');
      assert.equal(contact.responseMode, 'landing-capture');
      assert.ok(Math.abs(contact.responseRadialSpeedMps!) < 1e-7);
      assert.ok(contact.responseTangentialSpeedMps! <= LANDING_POLICY.captureContactTangentCapMps);
      finite(result.positionM); finite(result.velocityMps);
      const relative = result.velocityMps.map((value, i) => value - bodyVelocity[i]) as Vec3;
      assert.ok(Math.hypot(...relative) <= LANDING_POLICY.captureContactTangentCapMps + 1e-7);
      output.push(relative);
    }
    output[0].forEach((value, i) => near(output[1][i], value, 1e-5));
  }
});

test('degenerate finite landing inputs remain finite without a fabricated bounce', () => {
  const relVel: Vec3 = [0, -8000, 0];
  const paused = landingCaptureStep(relVel, [0, 0, 0], 0, false, RETURN_ALTITUDE, 0);
  assert.deepEqual(relVel, [0, -8000, 0]);
  assert.ok(Number.isFinite(paused.accelerationMps2));
  landingCaptureStep(relVel, [0, 0, 0], 0, false, RETURN_ALTITUDE, 1 / 30);
  finite(relVel);
  assert.ok(relVel[1] <= 0);
  assert.deepEqual(predictTouchdownDirection([0, 0, 0], [0, 0, 0], RADIUS), [0, 0, 1]);
});
