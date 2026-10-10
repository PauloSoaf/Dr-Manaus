import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCelestialImpact, CELESTIAL_IMPACT_POLICY } from '../src/world/travel/CelestialImpactPolicy.ts';
import { LIGHT_SPEED_MPS as C } from '../src/world/travel/TravelConstants.ts';
import { SOLAR_SYSTEM_BODIES } from '../src/world/celestial/CelestialBody.ts';
import { bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { SolarSystem } from '../src/world/celestial/SolarSystem.ts';
import { contact } from './helpers/celestial-impact.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';
const context = { autopilotActive: false, warpStep: 0, simulationTimeS: 0 };
const profile = (id = 'earth') => bodyProfile(SOLAR_SYSTEM_BODIES.find(b => b.id === id)!);
const classify = (v: Vec3, id = 'earth', overrides = {}) =>
  classifyCelestialImpact(contact(v, id), profile(id), { ...context, ...overrides });

test('T_IMPACT_BODY_RELATIVE_SPEED', () => {
  assert.equal(classify([3, -4, 0]).relativeSpeedMps, 5);
});
test('T_IMPACT_EARTH_ORBITAL_VELOCITY_NOT_IMPACT_SPEED', () => {
  const earth = new SolarSystem().stateOf('earth')!;
  assert.ok(Math.hypot(...earth.velocityMps) > 25_000);
  const result = classifyCelestialImpact(contact([0, 0, 0], 'earth', earth.velocityMps), profile(), context);
  assert.equal(result.relativeSpeedMps, 0); assert.equal(result.classification, 'GRAZE');
});
test('T_IMPACT_NORMAL_DECOMPOSITION', () => {
  const result = classify([3, -4, 0]);
  assert.equal(result.inwardRadialSpeedMps, 4); assert.equal(result.tangentialSpeedMps, 3);
  assert.equal(result.radialFraction, .8); assert.ok(Math.abs(result.incidenceAngleRad - Math.acos(.8)) < 1e-12);
  assert.equal(classify([3, 4, 0]).inwardRadialSpeedMps, 0);
});
test('T_IMPACT_GRAZE_RADIAL_FRACTION', () => {
  assert.equal(classify([1e6, -1, 0]).classification, 'GRAZE');
  assert.equal(classify([0, 1e6, 0]).classification, 'GRAZE');
});
test('T_IMPACT_MINOR_CLASSIFICATION', () => {
  assert.equal(classify([0, -119, 0]).classification, 'GRAZE');
  assert.equal(classify([0, -120, 0]).classification, 'MINOR_IMPACT');
  assert.equal(classify([0, -7999, 0]).classification, 'MINOR_IMPACT');
});
test('T_IMPACT_MAJOR_CLASSIFICATION', () => {
  assert.equal(classify([0, -8000, 0]).classification, 'MAJOR_IMPACT');
  assert.equal(classify([0, -(C - 1), 0]).classification, 'MAJOR_IMPACT');
});
for (const [name, speed] of [['1C', C], ['256C', 256 * C]] as const) {
  test(`T_IMPACT_CATASTROPHIC_AT_${name}`, () => {
    const r = classify([0, -speed, 0]); assert.equal(r.classification, 'CATASTROPHIC_IMPACT');
    assert.equal(r.effectiveC, speed / C); assert.equal(r.radialFraction, 1);
  });
}
for (const id of ['earth', 'moon', 'mars']) test(`T_IMPACT_DIRECT_1C_${id.toUpperCase()}`, () => {
  assert.equal(classify([0, -C, 0], id).classification, 'CATASTROPHIC_IMPACT');
});
test('T_IMPACT_GRAZING_1C_NOT_DIRECT', () => {
  assert.equal(classify([C, -1, 0]).classification, 'GRAZE');
  assert.equal(classify([C, -C * .3, 0]).classification, 'MAJOR_IMPACT');
});
test('T_IMPACT_LOCKED_AUTOPILOT_SAFE', () => {
  for (const speed of [C, 256 * C]) {
    assert.equal(classify([0, -speed, 0], 'moon', { lockedBodyId: 'moon', autopilotActive: true }).classification, 'SAFE_CAPTURE');
    assert.equal(classify([0, -speed, 0], 'moon', { lockedBodyId: 'earth', autopilotActive: true }).classification, 'CATASTROPHIC_IMPACT');
  }
});
test('T_IMPACT_LOCKED_MANUAL_CAN_BE_CATASTROPHIC', () => {
  assert.equal(classify([0, -C, 0], 'earth', { lockedBodyId: 'earth' }).classification, 'CATASTROPHIC_IMPACT');
});
test('T_IMPACT_LANDING_INTENT_SAFE', () => {
  assert.equal(classify([0, -256 * C, 0], 'moon', { landingIntentBodyId: 'moon' }).classification, 'SAFE_CAPTURE');
  assert.equal(classify([0, -C, 0], 'moon', { landingIntentBodyId: 'mars' }).classification, 'CATASTROPHIC_IMPACT');
});
for (const [id, name, bodyClass] of [['jupiter', 'WITHOUT_TERRAIN', 'gas-giant'],
  ['neptune', 'WITHOUT_TERRAIN', 'ice-giant'], ['sun', 'WITHOUT_ROCKY_VOLUME', 'star']] as const) {
  test(`T_IMPACT_${id.toUpperCase()}_CLASSIFIED_${name}`, () => {
    const r = classify([0, -C, 0], id); assert.equal(r.classification, 'CATASTROPHIC_IMPACT');
    assert.equal(r.bodyClass, bodyClass); assert.equal(profile(id).hasSolidSurface, false);
    assert.equal(profile(id).canLand, false); assert.equal(profile(id).supportsVolumeDestruction, false);
  });
}
test('T_IMPACT_MOVING_MOON_RELATIVE_SPEED', () => {
  const system = new SolarSystem({ epochS: 86400 }), moon = system.stateOf('moon')!;
  assert.notDeepEqual(moon.velocityMps, system.stateOf('earth')!.velocityMps);
  const r = classifyCelestialImpact(contact([0, -10, 0], 'moon', moon.velocityMps), profile('moon'), context);
  assert.ok(Math.abs(r.relativeSpeedMps - 10) < 1e-9); assert.equal(r.classification, 'GRAZE');
});
test('T_IMPACT_NO_NAN_EXTREME_SPEED', () => {
  for (const speed of [0, 119, 120, 8000, C, 256 * C, 1e12]) for (const fraction of [0, .01, .1, .3, .5, 1]) {
    const r = classify([speed * Math.sqrt(1 - fraction ** 2), -speed * fraction, 0]);
    for (const value of [r.relativeSpeedMps, r.inwardRadialSpeedMps, r.tangentialSpeedMps,
      r.radialFraction, r.incidenceAngleRad, r.effectiveC]) assert.ok(Number.isFinite(value) && value >= 0);
    assert.ok(r.radialFraction <= 1); assert.ok(r.classification);
  }
});
test('direct severity is monotonic and thresholds are centrally configurable', () => {
  const ranks = ['GRAZE', 'MINOR_IMPACT', 'MAJOR_IMPACT', 'CATASTROPHIC_IMPACT']; let previous = -1;
  for (const speed of [0, 119, 120, 2000, 8000, C - 1, C, 256 * C]) {
    const rank = ranks.indexOf(classify([0, -speed, 0]).classification); assert.ok(rank >= previous); previous = rank;
  }
  assert.equal(classifyCelestialImpact(contact([0, -1000, 0]), profile(), context,
    { ...CELESTIAL_IMPACT_POLICY, catastrophicSpeedMps: 1000 }).classification, 'CATASTROPHIC_IMPACT');
});
