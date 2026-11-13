import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3, Bone } from 'three/webgpu';
import { computeFlightOrientation, flightModeFor, uprightBlend } from '../src/player/animations/FlightOrientation.ts';
import { FLIGHT_POSE_CONFIG, ProceduralFlightPoseLayer } from '../src/player/animations/ProceduralFlightPose.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import { Group } from 'three/webgpu';
import type { InputController } from '../src/player/InputController.ts';

function mockInput(): InputController {
  return {
    enabled: true,
    mouseDelta: { x: 0, y: 0 },
    held: () => false,
    pressed: () => false,
    consume: () => false,
  } as unknown as InputController;
}

test('T_FLIGHT_VISUAL_USES_REAL_3D_VELOCITY updateTravelVisual computes real 3D velocity from viewForward and speed', () => {
  const root = new Group();
  const player = new PlayerController(root, mockInput());
  
  // Set viewForward pointing angled up-east: (0.6, 0.8, 0)
  const viewForward = new Vector3(0.6, 0.8, 0).normalize();
  const speedMps = 500;

  // Intercept animate call
  let capturedVelocity: Vector3 | undefined;
  player.character.animate = (dt, speed, flying, boost, pose, vertSpeed, turn, size, velocity) => {
    capturedVelocity = velocity?.clone();
  };

  player.updateTravelVisual(0.016, speedMps, viewForward, 0, 0);

  assert.ok(capturedVelocity !== undefined, 'Velocity must not be undefined');
  assert.ok(Math.abs(capturedVelocity.length() - speedMps) < 0.01, `Velocity magnitude should be ${speedMps}, got ${capturedVelocity.length()}`);
  assert.ok(capturedVelocity.dot(viewForward) > speedMps * 0.999, 'Velocity direction must match viewForward');
});

test('T_FLIGHT_VERTICAL_UP_STABLE and T_FLIGHT_VERTICAL_DOWN_STABLE pure vertical flights remain aligned and finite', () => {
  const current = new Quaternion();
  const outQ = new Quaternion();

  // Pure vertical climb (0, 100, 0)
  computeFlightOrientation(new Vector3(0, 100, 0), current, 1.0, 0, 'fast', outQ, 0, 0);
  const headUp = new Vector3(0, 1, 0).applyQuaternion(outQ);
  assert.ok(headUp.y > 0.999, `Head must point straight UP, got y=${headUp.y}`);
  assert.ok(Number.isFinite(outQ.x + outQ.y + outQ.z + outQ.w));

  // Pure vertical dive (0, -100, 0)
  computeFlightOrientation(new Vector3(0, -100, 0), current, 1.0, 0, 'fast', outQ, 0, 0);
  const headDown = new Vector3(0, 1, 0).applyQuaternion(outQ);
  assert.ok(headDown.y < -0.999, `Head must point straight DOWN, got y=${headDown.y}`);
  assert.ok(Number.isFinite(outQ.x + outQ.y + outQ.z + outQ.w));
});

test('T_FLIGHT_89_90_91_DEG_CONTINUITY orientation is smooth across 89°, 90°, and 91° pitch', () => {
  const current = new Quaternion();
  const q89 = new Quaternion();
  const q90 = new Quaternion();
  const q91 = new Quaternion();

  const deg2rad = Math.PI / 180;
  // Velocity pulling up through 89, 90, 91 degrees from heading -Z
  const v89 = new Vector3(0, Math.sin(89 * deg2rad), -Math.cos(89 * deg2rad)).multiplyScalar(100);
  const v90 = new Vector3(0, Math.sin(90 * deg2rad), -Math.cos(90 * deg2rad)).multiplyScalar(100);
  const v91 = new Vector3(0, Math.sin(91 * deg2rad), -Math.cos(91 * deg2rad)).multiplyScalar(100);

  // High dt for instantaneous target check
  computeFlightOrientation(v89, current, 10.0, 0, 'fast', q89, 0, 0);
  computeFlightOrientation(v90, q89, 10.0, 0, 'fast', q90, 0, 0);
  computeFlightOrientation(v91, q90, 10.0, 0, 'fast', q91, 0, 0);

  const angle89to90 = q89.angleTo(q90);
  const angle90to91 = q90.angleTo(q91);

  // Angular difference for a 1-degree pitch change must be roughly 1 degree (~0.017-0.035 rad), NOT 180°!
  assert.ok(angle89to90 < 0.05, `Angle between 89° and 90° should be small, got ${angle89to90} rad`);
  assert.ok(angle90to91 < 0.05, `Angle between 90° and 91° should be small, got ${angle90to91} rad`);
});

test('T_FLIGHT_NO_QUATERNION_SIGN_FLIP and T_FLIGHT_NO_NAN continuous flight never flips sign or outputs NaN', () => {
  const q = new Quaternion();
  let prevQ = q.clone();

  // Sweep pitch from 0 to 180 degrees in 1-degree steps
  for (let deg = 0; deg <= 180; deg += 1) {
    const rad = (deg * Math.PI) / 180;
    const v = new Vector3(0, Math.sin(rad), -Math.cos(rad)).multiplyScalar(80);
    computeFlightOrientation(v, q, 0.016, 0, 'cruise', q, 0, 0);

    assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w), `NaN at pitch ${deg}°`);
    assert.ok(q.dot(prevQ) >= -1e-6, `Quaternion sign flipped abruptly at pitch ${deg}°: dot = ${q.dot(prevQ)}`);
    prevQ = q.clone();
  }
});

test('T_FLIGHT_DIRECTION_CHANGE_FOLLOWS_VELOCITY character smoothly aligns when turning camera/velocity', () => {
  const q = new Quaternion();
  // Initially flying north (-Z)
  computeFlightOrientation(new Vector3(0, 0, -100), q, 10.0, 0, 'fast', q, 0, 0);

  // Turn to fly east (+X)
  const targetVel = new Vector3(100, 0, 0);
  for (let frame = 0; frame < 30; frame++) {
    computeFlightOrientation(targetVel, q, 0.016, 0, 'fast', q, Math.PI / 2, 0);
  }

  const head = new Vector3(0, 1, 0).applyQuaternion(q);
  assert.ok(head.x > 0.95, `Head should turn towards +X, got x=${head.x}`);
});

test('T_FLIGHT_BANK_STABLE and T_FLIGHT_VERTICAL_NO_RANDOM_ROLL banking occurs horizontally but vanishes near vertical', () => {
  const qHoriz = new Quaternion();
  const qHorizBanked = new Quaternion();
  const qVert = new Quaternion();
  const qVertBanked = new Quaternion();

  // Horizontal flight with and without bank
  computeFlightOrientation(new Vector3(0, 0, -100), qHoriz, 10.0, 0, 'fast', qHoriz, 0, 0);
  computeFlightOrientation(new Vector3(0, 0, -100), qHorizBanked, 10.0, 1.0, 'fast', qHorizBanked, 0, 0);
  const horizBankAngle = qHoriz.angleTo(qHorizBanked);
  assert.ok(horizBankAngle > 0.1, `Horizontal turns must bank, got angle ${horizBankAngle}`);

  // Pure vertical ascent with bank input: bank must fade out so roll does not accumulate
  computeFlightOrientation(new Vector3(0, 100, 0), qVert, 10.0, 0, 'fast', qVert, 0, 0);
  computeFlightOrientation(new Vector3(0, 100, 0), qVertBanked, 10.0, 1.0, 'fast', qVertBanked, 0, 0);
  const vertBankAngle = qVert.angleTo(qVertBanked);
  assert.ok(vertBankAngle < 0.01, `Pure vertical ascent must not bank or roll, got angle ${vertBankAngle}`);
});

test('T_FLIGHT_POSE_* distinct flight poses differentiate hover, cruise, fast, super, mega, interplanetary, braking', () => {
  assert.equal(flightModeFor(0, 0), 'hover');
  assert.equal(flightModeFor(15, 15), 'hover'); // below aeroSpeed (30)
  assert.equal(flightModeFor(50, 50, 'normal'), 'cruise');
  assert.equal(flightModeFor(100, 100, 'fast'), 'fast');
  assert.equal(flightModeFor(100, 10), 'braking');

  // Verify procedural pose configs
  assert.equal(FLIGHT_POSE_CONFIG.hover.chestArch, 0);
  assert.ok(Math.abs(FLIGHT_POSE_CONFIG.cruise.chestArch) < Math.abs(FLIGHT_POSE_CONFIG.fast.chestArch));
  assert.ok(Math.abs(FLIGHT_POSE_CONFIG.fast.chestArch) < Math.abs(FLIGHT_POSE_CONFIG.super.chestArch));
  assert.ok(Math.abs(FLIGHT_POSE_CONFIG.super.chestArch) < Math.abs(FLIGHT_POSE_CONFIG.mega.chestArch));
  assert.ok(Math.abs(FLIGHT_POSE_CONFIG.mega.chestArch) <= Math.abs(FLIGHT_POSE_CONFIG.interplanetary.chestArch));

  // T_FLIGHT_BRAKING_RETURNS_UPRIGHT: braking lifts chest up
  assert.ok(FLIGHT_POSE_CONFIG.braking.chestArch >= 0);
});

test('T_FLIGHT_NO_SHOULDER_DEFORMATION_REGRESSION arm rotation is strictly bounded and clavicles untouched', () => {
  for (const [name, cfg] of Object.entries(FLIGHT_POSE_CONFIG)) {
    // Upper arm sweep backward must be <= 0.26 rad (15 deg)
    assert.ok(Math.abs(cfg.armSweepBack) <= 0.26, `Pose ${name} armSweepBack exceeds safe bound: ${cfg.armSweepBack}`);
    // Upper arm sweep outward must be <= 0.15 rad
    assert.ok(Math.abs(cfg.armSweepOut) <= 0.15, `Pose ${name} armSweepOut exceeds safe bound: ${cfg.armSweepOut}`);
  }

  // Verify ProceduralFlightPoseLayer never modifies clavicles
  const bones = new Map<string, Bone>([
    ['claviclel', new Bone()],
    ['clavicler', new Bone()],
    ['upperarml', new Bone()],
    ['upperarmr', new Bone()],
    ['spine02', new Bone()],
    ['head', new Bone()],
  ]);

  const layer = new ProceduralFlightPoseLayer();
  const initClavicleLQ = bones.get('claviclel')!.quaternion.clone();
  const initClavicleRQ = bones.get('clavicler')!.quaternion.clone();

  layer.apply(bones, 'interplanetary', 0.1);

  assert.ok(bones.get('claviclel')!.quaternion.equals(initClavicleLQ), 'Left clavicle must NEVER be deformed');
  assert.ok(bones.get('clavicler')!.quaternion.equals(initClavicleRQ), 'Right clavicle must NEVER be deformed');
});

test('T_FLIGHT_POSE_NO_ACCUMULATION', () => {
  const bones = new Map<string, Bone>([
    ['spine02', new Bone()],
    ['head', new Bone()],
    ['upperarml', new Bone()],
    ['upperarmr', new Bone()],
    ['calfl', new Bone()],
    ['calfr', new Bone()],
  ]);

  const layer = new ProceduralFlightPoseLayer();
  // Simulate 300 frames of cruise flight, resetting bones each frame as AnimationMixer does
  for (let i = 0; i < 300; i++) {
    for (const b of bones.values()) b.quaternion.identity();
    layer.apply(bones, 'cruise', 1 / 60);
  }

  // Verify bone rotation did NOT accumulate additively across frames
  const headQ = bones.get('head')!.quaternion;
  const headAngle = 2 * Math.acos(Math.min(1, Math.max(-1, headQ.w)));
  assert.ok(headAngle <= FLIGHT_POSE_CONFIG.cruise.headTilt * 1.05, `Head rotation accumulated: ${headAngle}`);
  assert.ok(headAngle > 0.05, 'Head tilt is active and non-zero');
});

test('T_FLIGHT_POSE_IDLE_RECOVERY', () => {
  const bones = new Map<string, Bone>([
    ['spine02', new Bone()],
    ['head', new Bone()],
    ['upperarml', new Bone()],
    ['upperarmr', new Bone()],
    ['calfl', new Bone()],
    ['calfr', new Bone()],
  ]);

  const layer = new ProceduralFlightPoseLayer();
  // Fly in fast pose
  for (let i = 0; i < 60; i++) {
    for (const b of bones.values()) b.quaternion.identity();
    layer.apply(bones, 'fast', 1 / 60);
  }
  assert.ok(Math.abs(layer.weights.chestArch) > 0.1, 'Fast pose has significant chest arch');

  // Transition to hover / idle for 1 second (60 frames)
  for (let i = 0; i < 60; i++) {
    for (const b of bones.values()) b.quaternion.identity();
    layer.apply(bones, 'hover', 1 / 60);
  }

  // Weights must have recovered to near zero
  assert.ok(Math.abs(layer.weights.chestArch) < 0.005, `Chest arch must recover to idle: ${layer.weights.chestArch}`);
  assert.ok(Math.abs(layer.weights.headTilt) < 0.005, `Head tilt must recover to idle: ${layer.weights.headTilt}`);
  assert.ok(Math.abs(layer.weights.armSweepBack) < 0.005, `Arm sweep must recover to idle: ${layer.weights.armSweepBack}`);
});

test('T_FLIGHT_POSE_5MIN_STABILITY', () => {
  const bones = new Map<string, Bone>([
    ['spine02', new Bone()],
    ['head', new Bone()],
    ['upperarml', new Bone()],
    ['upperarmr', new Bone()],
    ['calfl', new Bone()],
    ['calfr', new Bone()],
  ]);

  const layer = new ProceduralFlightPoseLayer();
  const dt = 1 / 60;
  const totalFrames = 60 * 300; // 5 minutes = 18,000 frames
  const cycle = ['cruise', 'hover', 'fast', 'braking', 'hover'] as const;

  for (let frame = 0; frame < totalFrames; frame++) {
    const mode = cycle[Math.floor(frame / 600) % cycle.length];
    for (const b of bones.values()) b.quaternion.identity();
    layer.apply(bones, mode, dt);

    // Assert bounded rotation on every bone
    for (const [name, b] of bones) {
      assert.ok(Number.isFinite(b.quaternion.x + b.quaternion.y + b.quaternion.z + b.quaternion.w), `NaN in ${name} at frame ${frame}`);
      const angle = 2 * Math.acos(Math.min(1, Math.max(-1, b.quaternion.w)));
      assert.ok(angle < 0.5, `Rotation in ${name} exceeded bounds at frame ${frame}: ${angle}`);
    }
  }

  // Return to hover for 60 frames
  for (let i = 0; i < 60; i++) {
    for (const b of bones.values()) b.quaternion.identity();
    layer.apply(bones, 'hover', dt);
  }
  assert.ok(Math.abs(layer.weights.chestArch) < 0.005, 'Chest arch recovers after 5-minute flight');
});

test('T_FLIGHT_VERTICAL_E2E', () => {
  const current = new Quaternion();
  const out = new Quaternion();

  // Test full vertical ascent through 90 degrees
  const climbVel = new Vector3(0, 500, 0);
  computeFlightOrientation(climbVel, current, 1.0, 0, 'fast', out, 0, 0);

  const upDir = new Vector3(0, 1, 0).applyQuaternion(out);
  assert.ok(upDir.y > 0.999, 'Player orientation points strictly up in 90° climb');
  assert.ok(Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z) && Number.isFinite(out.w));

  // Test full vertical dive through -90 degrees
  const diveVel = new Vector3(0, -500, 0);
  computeFlightOrientation(diveVel, out, 1.0, 0, 'fast', out, 0, 0);

  const downDir = new Vector3(0, 1, 0).applyQuaternion(out);
  assert.ok(downDir.y < -0.999, 'Player orientation points strictly down in -90° dive');
});

test('T_FLIGHT_ORIENTATION_30FPS', () => {
  const q = new Quaternion();
  const vel = new Vector3(50, 50, -50);
  for (let i = 0; i < 30; i++) {
    computeFlightOrientation(vel, q, 1 / 30, 0, 'fast', q, 0, 0);
  }
  assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w));
  const dir = new Vector3(0, 1, 0).applyQuaternion(q);
  assert.ok(dir.dot(vel.clone().normalize()) > 0.95, 'Aligned at 30 FPS');
});

test('T_FLIGHT_ORIENTATION_60FPS', () => {
  const q = new Quaternion();
  const vel = new Vector3(50, 50, -50);
  for (let i = 0; i < 60; i++) {
    computeFlightOrientation(vel, q, 1 / 60, 0, 'fast', q, 0, 0);
  }
  assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w));
  const dir = new Vector3(0, 1, 0).applyQuaternion(q);
  assert.ok(dir.dot(vel.clone().normalize()) > 0.95, 'Aligned at 60 FPS');
});

test('T_FLIGHT_ORIENTATION_120FPS', () => {
  const q = new Quaternion();
  const vel = new Vector3(50, 50, -50);
  for (let i = 0; i < 120; i++) {
    computeFlightOrientation(vel, q, 1 / 120, 0, 'fast', q, 0, 0);
  }
  assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w));
  const dir = new Vector3(0, 1, 0).applyQuaternion(q);
  assert.ok(dir.dot(vel.clone().normalize()) > 0.95, 'Aligned at 120 FPS');
});
