import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import {
  createPointMassGravitySource,
  dominantGravitySource,
  GAMEPLAY_ZERO_G_ACCEL_THRESHOLD,
  gravitySourceFromBody,
  isZeroG,
  netGravityAcceleration,
  type GravitySource,
} from '../src/world/celestial/GravitySource';
import { InterplanetaryController } from '../src/world/travel/InterplanetaryController';
import { SOLAR_SYSTEM_BODIES } from '../src/world/celestial/CelestialBody';
import type { InterplanetaryState, TravelContext } from '../src/world/travel/TravelDomain';
import type { Vec3 } from '../src/world/spatial/units';

test('T_ZERO_G_01_NO_SOURCE_VELOCITY_PRESERVED', () => {
  const controller = new InterplanetaryController();
  const initialPos: Vec3 = [1e11, 2e11, 3e11];
  const initialVel: Vec3 = [15_000, -2_500, 8_000];

  const state: InterplanetaryState = {
    systemId: 'sol',
    positionM: [...initialPos],
    velocityMps: [...initialVel],
  };

  const context: TravelContext = {
    altitudeM: 1e11,
    speedMps: Math.hypot(...initialVel),
    requested: true,
    nearestColliderM: Infinity,
    bodyRadiusM: 1e6,
  };

  // With no thrust and no brake (soltar input)
  const dt = 0.1; // 100ms within max frame step (0.25s)
  const nextState = controller.update(state, dt, new Vector3(0, 0, 0), false, context);

  // Velocity must be strictly preserved (inertial drift, no drag, no gravity)
  assert.equal(nextState.velocityMps[0], initialVel[0], 'X velocity preserved');
  assert.equal(nextState.velocityMps[1], initialVel[1], 'Y velocity preserved (no -Y drop)');
  assert.equal(nextState.velocityMps[2], initialVel[2], 'Z velocity preserved');

  // Position advances exactly by velocity * dt
  assert.equal(nextState.positionM[0], initialPos[0] + initialVel[0] * dt);
  assert.equal(nextState.positionM[1], initialPos[1] + initialVel[1] * dt);
  assert.equal(nextState.positionM[2], initialPos[2] + initialVel[2] * dt);
});

test('T_ZERO_G_02_EARTH_ACCELERATION_POINTS_INWARD', () => {
  const earthBody = SOLAR_SYSTEM_BODIES.find((b) => b.id === 'earth')!;
  assert.ok(earthBody, 'Earth body exists in catalog');

  const earthCenter: Vec3 = [1.496e11, 0, 0];
  const earthSource = gravitySourceFromBody(earthBody, earthCenter);

  // Test position 10,000 km along +Y from Earth center
  const rY = 10_000_000;
  const testPos: Vec3 = [earthCenter[0], earthCenter[1] + rY, earthCenter[2]];

  const accel = earthSource.accelerationAt(testPos);

  // Accel should point strictly along -Y toward Earth center
  assert.ok(Math.abs(accel[0]) < 1e-9, 'No X acceleration');
  assert.ok(accel[1] < 0, 'Acceleration points downward toward Earth center');
  assert.ok(Math.abs(accel[2]) < 1e-9, 'No Z acceleration');

  // Magnitude check: a = GM / r^2
  const expectedMag = earthSource.mu / (rY * rY);
  assert.ok(
    Math.abs(Math.abs(accel[1]) - expectedMag) / expectedMag < 1e-6,
    `Acceleration magnitude matches GM/r^2 (got ${Math.abs(accel[1])}, expected ${expectedMag})`
  );
});

test('T_ZERO_G_03_INVERSE_SQUARE_LAW_DOUBLE_DISTANCE', () => {
  const earthBody = SOLAR_SYSTEM_BODIES.find((b) => b.id === 'earth')!;
  const earthSource = gravitySourceFromBody(earthBody, [0, 0, 0]);

  const r1 = 10_000_000; // 10,000 km
  const r2 = 20_000_000; // 20,000 km (double distance)

  const a1 = earthSource.accelerationAt([r1, 0, 0]);
  const a2 = earthSource.accelerationAt([r2, 0, 0]);

  const mag1 = Math.hypot(a1[0], a1[1], a1[2]);
  const mag2 = Math.hypot(a2[0], a2[1], a2[2]);

  // a(2r) should be 1/4 of a(r)
  const ratio = mag2 / mag1;
  assert.ok(
    Math.abs(ratio - 0.25) < 1e-4,
    `Double distance should give ~ 1/4 acceleration (got ${ratio})`
  );
});

test('T_ZERO_G_04_MOON_DOMINANT_NEARBY', () => {
  const earthBody = SOLAR_SYSTEM_BODIES.find((b) => b.id === 'earth')!;
  const moonBody = SOLAR_SYSTEM_BODIES.find((b) => b.id === 'moon')!;

  const earthPos: Vec3 = [0, 0, 0];
  const moonPos: Vec3 = [384_400_000, 0, 0]; // 384,400 km along X

  const earthSource = gravitySourceFromBody(earthBody, earthPos);
  const moonSource = gravitySourceFromBody(moonBody, moonPos);
  const sources: GravitySource[] = [earthSource, moonSource];

  // Position close to Moon: 5,000 km from Moon center towards Earth
  const nearMoonPos: Vec3 = [moonPos[0] - 5_000_000, 0, 0];

  const dominant = dominantGravitySource(sources, nearMoonPos);
  assert.ok(dominant, 'Dominant gravity source identified');
  assert.equal(dominant.source.id, 'moon', 'Moon must be dominant near its surface');

  const netAccel = netGravityAcceleration(sources, nearMoonPos);
  // Net acceleration near Moon should pull towards Moon center (+X direction)
  assert.ok(netAccel[0] > 0, 'Net acceleration pulls toward Moon');
});

test('T_ZERO_G_05_ZERO_G_THRESHOLD_AND_IS_ZERO_G', () => {
  const earthBody = SOLAR_SYSTEM_BODIES.find((b) => b.id === 'earth')!;
  const earthSource = gravitySourceFromBody(earthBody, [0, 0, 0]);

  // Close to Earth: ~10,000 km (high gravity)
  assert.equal(
    isZeroG([earthSource], [10_000_000, 0, 0]),
    false,
    'Near Earth is not zero-g'
  );

  // Far from Earth: 100,000,000 km (negligible gravity < 1e-4 m/s^2)
  assert.equal(
    isZeroG([earthSource], [100_000_000_000, 0, 0]),
    true,
    'Deep interplanetary space qualifies as zero-g'
  );
});

test('T_ZERO_G_06_QUALITATIVE_ORBITAL_MOTION', () => {
  const controller = new InterplanetaryController();
  const earthBody = SOLAR_SYSTEM_BODIES.find((b) => b.id === 'earth')!;
  const earthCenter: Vec3 = [0, 0, 0];
  const earthSource = gravitySourceFromBody(earthBody, earthCenter);

  const orbitalRadius = 10_000_000; // 10,000 km
  // Circular orbit speed v = sqrt(mu / r)
  const vCircular = Math.sqrt(earthSource.mu / orbitalRadius);

  let state: InterplanetaryState = {
    systemId: 'sol',
    positionM: [orbitalRadius, 0, 0],
    velocityMps: [0, vCircular, 0],
    referenceBodyId: 'earth',
  };

  const context: TravelContext = {
    altitudeM: orbitalRadius - earthBody.equatorialRadiusM,
    speedMps: vCircular,
    requested: true,
    nearestColliderM: Infinity,
    bodyRadiusM: earthBody.equatorialRadiusM,
    bodyPositionM: earthCenter,
    gravitySources: [earthSource],
  };

  // Step 50 timesteps of 1s
  for (let i = 0; i < 50; i++) {
    state = controller.update(state, 1.0, new Vector3(0, 0, 0), false, context);
  }

  const currentRadius = Math.hypot(state.positionM[0], state.positionM[1], state.positionM[2]);
  const radiusDelta = Math.abs(currentRadius - orbitalRadius);

  // In 50 seconds at dt=1s, orbital radius should stay very close to circular (~ < 0.5% drift)
  const driftPercent = (radiusDelta / orbitalRadius) * 100;
  assert.ok(
    driftPercent < 0.5,
    `Orbital radius should remain stable (drift: ${driftPercent.toFixed(4)}%)`
  );
});

test('T_ZERO_G_07_SYSTEM_COORDINATES_SEPARATE_FROM_LOCAL', () => {
  const controller = new InterplanetaryController();
  const earthBody = SOLAR_SYSTEM_BODIES.find((b) => b.id === 'earth')!;
  const earthSource = gravitySourceFromBody(earthBody, [0, 0, 0]);

  // System position in millions of meters
  const systemPos: Vec3 = [150_000_000_000, 0, 0]; // 1 AU
  const context: TravelContext = {
    altitudeM: 1e11,
    speedMps: 30_000,
    requested: true,
    nearestColliderM: Infinity,
    bodyRadiusM: earthBody.equatorialRadiusM,
    gravitySources: [earthSource],
  };

  const state: InterplanetaryState = {
    systemId: 'sol',
    positionM: [...systemPos],
    velocityMps: [0, 30_000, 0],
  };

  const next = controller.update(state, 0.1, new Vector3(0, 0, 0), false, context);
  assert.ok(
    next.positionM[0] > 1e11,
    'System coordinates remain in 64-bit astronomical domain without precision loss'
  );
});
