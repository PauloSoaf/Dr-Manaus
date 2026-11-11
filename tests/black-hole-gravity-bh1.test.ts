import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newtonianAccelerationMps2,
  paczynskiWiitaAccelerationMps2,
  blackHoleEscapeVelocityMps,
  gravitationalTimeDilation,
  lenseThirringVelocityMps,
  evaluateBlackHoleProximity,
  applyBlackHoleDynamics,
  evaluateEmergencyEscape,
} from '../src/world/celestial/BlackHoleGravity';
import {
  SAGITTARIUS_A_STAR,
  M31_CENTRAL_BLACK_HOLE,
  SPEED_OF_LIGHT,
  SOLAR_MASS_KG,
  schwarzschildRadiusM,
  createBlackHoleDescriptor,
} from '../src/world/celestial/BlackHoleDescriptor';

test('T_BH1_01_NEWTONIAN_VS_PACZYNSKI_WIITA_ASYMPTOTICS', () => {
  const sgra = SAGITTARIUS_A_STAR;
  const rs = sgra.schwarzschildRadiusM;

  // 1. At very far distances (r = 1000 * rs), Paczyński-Wiita matches Newtonian within < 0.5%
  const farDist = 1000 * rs;
  const aNewtonFar = newtonianAccelerationMps2(sgra.massKg, farDist);
  const aPWFar = paczynskiWiitaAccelerationMps2(sgra.massKg, farDist);
  const diffRelativeFar = Math.abs(aPWFar - aNewtonFar) / aNewtonFar;
  assert.ok(diffRelativeFar < 0.005, `Far field PW should match Newtonian within 0.5%, got ${diffRelativeFar}`);

  // 2. At ISCO (r = 3 * rs), Paczyński-Wiita acceleration is exactly 2.25x Newtonian
  // a_PW(3*rs) = GM / (2*rs)^2 = GM / 4*rs^2
  // a_Newton(3*rs) = GM / (3*rs)^2 = GM / 9*rs^2
  // Ratio = 9 / 4 = 2.25
  const iscoDist = 3 * rs;
  const aNewtonIsco = newtonianAccelerationMps2(sgra.massKg, iscoDist);
  const aPWIsco = paczynskiWiitaAccelerationMps2(sgra.massKg, iscoDist);
  const ratio = aPWIsco / aNewtonIsco;
  assert.ok(Math.abs(ratio - 2.25) < 1e-4, `ISCO acceleration ratio should be 2.25, got ${ratio}`);

  // 3. Steep increase near horizon (r = 1.05 * rs)
  const nearDist = 1.05 * rs;
  const aPWNear = paczynskiWiitaAccelerationMps2(sgra.massKg, nearDist);
  assert.ok(aPWNear > aPWIsco * 100, 'Acceleration near horizon must be vastly higher than at ISCO');
});

test('T_BH1_02_GRAVITATIONAL_TIME_DILATION_AND_ESCAPE_VELOCITY', () => {
  const sgra = SAGITTARIUS_A_STAR;
  const rs = sgra.schwarzschildRadiusM;

  // 1. Time dilation at r = 1000 * rs is ~1.0 (unperturbed)
  const tdFar = gravitationalTimeDilation(sgra.massKg, 1000 * rs);
  assert.ok(Math.abs(tdFar - 1.0) < 1e-3);

  // 2. Time dilation at r = 2 * rs is sqrt(1 - 0.5) = sqrt(0.5) ~= 0.7071
  const tdMid = gravitationalTimeDilation(sgra.massKg, 2 * rs);
  assert.ok(Math.abs(tdMid - Math.SQRT1_2) < 1e-3, `Time dilation at 2*rs should be ~0.7071, got ${tdMid}`);

  // 3. Time dilation at or inside horizon is 0.0
  const tdHorizon = gravitationalTimeDilation(sgra.massKg, rs);
  assert.equal(tdHorizon, 0.0);
  const tdInside = gravitationalTimeDilation(sgra.massKg, 0.5 * rs);
  assert.equal(tdInside, 0.0);

  // 4. Escape velocity at r = 4 * rs is 0.5 * c
  const vEsc4 = blackHoleEscapeVelocityMps(sgra.massKg, 4 * rs);
  assert.ok(Math.abs(vEsc4 - SPEED_OF_LIGHT * 0.5) < 1e3);

  // 5. Escape velocity at r = rs is exactly c
  const vEscRs = blackHoleEscapeVelocityMps(sgra.massKg, rs);
  assert.equal(vEscRs, SPEED_OF_LIGHT);
});

test('T_BH1_03_PROXIMITY_ZONES_AND_LENSING_INTENSITY', () => {
  const sgra = SAGITTARIUS_A_STAR;
  const rs = sgra.schwarzschildRadiusM;

  // 1. Distant zone: r = 200 * rs
  const pDistant = evaluateBlackHoleProximity([200 * rs, 0, 0], sgra);
  assert.equal(pDistant.zone, 'distant');
  assert.equal(pDistant.isCaptured, false);
  assert.equal(pDistant.lensingIntensity01, 0);
  assert.equal(pDistant.canEscapeNormally, true);

  // 2. Influence zone: r = 50 * rs
  const pInfluence = evaluateBlackHoleProximity([50 * rs, 0, 0], sgra);
  assert.equal(pInfluence.zone, 'influence');
  assert.equal(pInfluence.isCaptured, false);
  assert.ok(pInfluence.lensingIntensity01 > 0 && pInfluence.lensingIntensity01 < 0.5);

  // 3. Strong field zone: r = 5 * rs
  const pStrong = evaluateBlackHoleProximity([5 * rs, 0, 0], sgra);
  assert.equal(pStrong.zone, 'strong-field');
  assert.equal(pStrong.isCaptured, false);
  assert.ok(pStrong.lensingIntensity01 > 0.5);
  assert.equal(pStrong.canEscapeNormally, true);

  // 4. ISCO zone: r = 2 * rs (inside ISCO at 3*rs, but outside horizon)
  const pIsco = evaluateBlackHoleProximity([2 * rs, 0, 0], sgra);
  assert.equal(pIsco.zone, 'isco-zone');
  assert.equal(pIsco.isCaptured, false);
  assert.equal(pIsco.canEscapeNormally, false);

  // 5. Captured zone: r = 0.5 * rs
  const pCaptured = evaluateBlackHoleProximity([0.5 * rs, 0, 0], sgra);
  assert.equal(pCaptured.zone, 'captured');
  assert.equal(pCaptured.isCaptured, true);
  assert.equal(pCaptured.lensingIntensity01, 1.0);
  assert.equal(pCaptured.canEscapeNormally, false);
});

test('T_BH1_04_LENSE_THIRRING_FRAME_DRAGGING', () => {
  const sgra = SAGITTARIUS_A_STAR; // spin = 0.90
  const rs = sgra.schwarzschildRadiusM;

  // Frame dragging at 2*rs is substantial
  const vDragNear = lenseThirringVelocityMps(sgra.massKg, sgra.spin01, 2 * rs);
  assert.ok(vDragNear > 1e6, 'Frame dragging velocity near horizon should be > 1000 km/s');

  // Frame dragging at 100*rs drops off as 1/r^2
  const vDragFar = lenseThirringVelocityMps(sgra.massKg, sgra.spin01, 100 * rs);
  assert.ok(vDragNear / vDragFar > 1000, 'Frame dragging must diminish quadratically with distance');

  // Non-rotating black hole has zero frame dragging
  const vDragZero = lenseThirringVelocityMps(sgra.massKg, 0, 2 * rs);
  assert.equal(vDragZero, 0);
});

test('T_BH1_05_TRAJECTORY_BENDING_AND_DYNAMICS', () => {
  const sgra = SAGITTARIUS_A_STAR;
  const rs = sgra.schwarzschildRadiusM;

  // Particle at [10*rs, 0, 0] with purely tangential velocity [0, 50_000, 0] (m/s)
  const initialPos: [number, number, number] = [10 * rs, 0, 0];
  const initialVel: [number, number, number] = [0, 50_000, 0];
  const dt = 0.1; // 100 ms step

  const result = applyBlackHoleDynamics(initialPos, initialVel, dt, sgra);

  // Gravity pulls in -X direction towards Sgr A* at origin
  assert.ok(result.nextVelocityMps[0] < 0, 'Velocity must gain inward component (-X) due to gravity');
  // Tangential velocity in Y is preserved / perturbed
  assert.ok(result.nextVelocityMps[1] > 0);
  // Trajectory bent towards singularity
  assert.ok(result.nextPositionM[0] < initialPos[0], 'Particle must move closer to singularity in X');
  // Speed stays subluminal
  const speed = Math.hypot(...result.nextVelocityMps);
  assert.ok(speed < SPEED_OF_LIGHT);
});

test('T_BH1_06_EVENT_HORIZON_CAPTURE_AND_IRREVERSIBILITY', () => {
  const sgra = SAGITTARIUS_A_STAR;
  const rs = sgra.schwarzschildRadiusM;

  // Particle inside Kerr horizon at [0.4 * rs, 0, 0]
  const insidePos: [number, number, number] = [0.4 * rs, 0, 0];
  // Attempting to fly outward with +X velocity
  const outwardVel: [number, number, number] = [100_000, 0, 0];

  const result = applyBlackHoleDynamics(insidePos, outwardVel, 0.1, sgra);

  // Irreversibility: inside horizon, velocity is forced inward (-X) towards singularity
  assert.ok(result.nextVelocityMps[0] < 0, 'Outward motion must be reversed to inward motion inside horizon');
  assert.ok(result.nextPositionM[0] < insidePos[0], 'Position must converge closer to singularity');
  assert.equal(result.proximity.isCaptured, true);
});

test('T_BH1_07_EMERGENCY_ESCAPE_FEASIBILITY', () => {
  const sgra = SAGITTARIUS_A_STAR;
  const rs = sgra.schwarzschildRadiusM;

  // 1. Far outside at 20 * rs: moderate hero thrust can escape
  const pSafe = evaluateBlackHoleProximity([20 * rs, 0, 0], sgra);
  const escapeSafe = evaluateEmergencyEscape(pSafe, pSafe.effectiveAccelerationMps2 * 2.0);
  assert.equal(escapeSafe.canEscape, true);

  // Zero or tiny thrust fails
  const escapeWeak = evaluateEmergencyEscape(pSafe, pSafe.effectiveAccelerationMps2 * 0.5);
  assert.equal(escapeWeak.canEscape, false);

  // 2. Inside event horizon (0.5 * rs): even extreme thrust fails
  const pInside = evaluateBlackHoleProximity([0.5 * rs, 0, 0], sgra);
  const escapeInside = evaluateEmergencyEscape(pInside, 1e12); // Trillion m/s^2 thrust
  assert.equal(escapeInside.canEscape, false);
  assert.ok(escapeInside.reason.includes('singularidade'));
});
