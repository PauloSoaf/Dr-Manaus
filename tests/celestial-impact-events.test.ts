import test from 'node:test';
import assert from 'node:assert/strict';
import { CelestialImpactService } from '../src/world/travel/CelestialImpactService.ts';
import { LIGHT_SPEED_MPS as C } from '../src/world/travel/TravelConstants.ts';
import { SOLAR_SYSTEM_BODIES } from '../src/world/celestial/CelestialBody.ts';
import { bodyProfile, SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile.ts';
import { bodyExclusionEnvelopes } from '../src/world/travel/BodyNavigation.ts';
import { contact, impactFixture } from './helpers/celestial-impact.ts';
const context = { autopilotActive: false, warpStep: 1, simulationTimeS: 123 };
const profile = bodyProfile(SOLAR_SYSTEM_BODIES.find(b => b.id === 'earth')!);

test('T_IMPACT_NO_TUNNEL_AFTER_EVENT', () => {
  for (const speed of [C, 256 * C]) {
    const f = impactFixture('earth', speed); try {
      f.step(); assert.equal(f.event().classification, 'CATASTROPHIC_IMPACT');
      const p = f.travelDomain.state!.positionM, centre = f.universe.activeSystem.positionOf('earth')!;
      assert.ok(p[1] > centre[1]);
      assert.ok(Math.hypot(...p.map((v, i) => v - centre[i])) >= f.envelope.radiusM - .1);
      assert.ok(f.travelDomain.state!.velocityMps.every(Number.isFinite));
      assert.ok(f.controller.lastCelestialContact!.responseRadialSpeedMps <= .001);
    } finally { f.dispose(); }
  }
});
test('T_IMPACT_ONE_EVENT_PER_CROSSING', () => {
  const f = impactFixture(); try {
    f.step(); const id = f.event().eventId;
    for (let i = 0; i < 120; i++) { f.place(f.envelope.radiusM, C); f.step(); }
    assert.equal(f.game.celestialImpacts.emittedCount, 1); assert.equal(f.event().eventId, id);
    assert.equal(f.game.celestialImpacts.peek().length, 0, 'Game drains the queue every step');
  } finally { f.dispose(); }
});
test('T_IMPACT_NO_EVENT_SPAM_WHILE_CONTACTING', () => {
  const service = new CelestialImpactService(), c = contact();
  const envelope = { bodyId: c.bodyId, centreM: [0, 0, 0] as [number, number, number], radiusM: c.envelopeRadiusM };
  const first = service.emit(c, profile, context);
  for (let i = 0; i < 1000; i++) {
    service.updateSeparation([0, c.envelopeRadiusM + 5, 0], [envelope]);
    assert.equal(service.emit(c, profile, { ...context, simulationTimeS: i * 100 }), undefined);
  }
  assert.deepEqual(service.peek(), [first]); assert.deepEqual(service.drain(), [first]);
  assert.deepEqual(service.drain(), []); assert.equal(service.activeEpisodeCount, 1);
});
test('T_IMPACT_REARMS_AFTER_SEPARATION', () => {
  const f = impactFixture(); try {
    f.step(); const first = f.event().eventId;
    f.place(f.envelope.radiusM + 5); f.step(); assert.equal(f.game.celestialImpacts.activeEpisodeCount, 1);
    f.place(f.envelope.radiusM + 1000); f.step();
    assert.equal(f.controller.lastCelestialContact, undefined, 'no stale contact after leaving');
    assert.equal(f.game.celestialImpacts.activeEpisodeCount, 0);
    assert.equal(f.game.celestialImpacts.emittedCount, 1, 'separation itself emits nothing');
    f.place(f.envelope.radiusM + 1000, C); f.step();
    assert.equal(f.game.celestialImpacts.emittedCount, 2); assert.notEqual(f.event().eventId, first);
  } finally { f.dispose(); }
});
test('T_IMPACT_EVENT_HAS_SYSTEM_CONTACT', () => {
  const f = impactFixture(); try {
    f.step(); assert.deepEqual(f.event().contactSystemPositionM, f.controller.lastCelestialContact!.contactPositionM);
    assert.deepEqual(JSON.parse(JSON.stringify(f.event())), f.event());
    assert.ok(f.event().simulationTimeS >= 0 && f.event().simulationTimeS <= 1 / 60);
    assert.ok(Object.isFrozen(f.event())); assert.ok(Object.isFrozen(f.event().contactSystemPositionM));
  } finally { f.dispose(); }
});
test('T_IMPACT_EVENT_BODY_FIXED_CONTACT_FOR_SOLID_BODY', () => {
  const f = impactFixture('moon'); try {
    f.step(); const e = f.event();
    assert.ok(e.contactBodyFixedM.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...e.contactBodyFixedM) - f.envelope.radiusM) < .01);
    // Frame graph is now at the end of the step: transport the stored body-fixed point
    // back to system space, comparing to the contact advanced with the moving Moon.
    const systemPoint = f.universe.frames.convertPosition(f.body.frameId, 'solar-system/barycentric', e.contactBodyFixedM);
    const c = f.controller.lastCelestialContact!, remaining = (1 - c.fraction) / 60;
    const expected = e.contactSystemPositionM.map((v: number, i: number) => v + c.bodyVelocityMps[i] * remaining);
    assert.ok(Math.hypot(...systemPoint.map((v, i) => v - expected[i])) < .1);
  } finally { f.dispose(); }
});
test('T_IMPACT_EVENT_ID_UNIQUE', () => {
  const service = new CelestialImpactService(); const first = service.emit(contact(), profile, context)!;
  service.clear(); const second = service.emit(contact(), profile, context)!;
  assert.notEqual(first.eventId, second.eventId); assert.equal(service.emittedCount, 2);
  assert.deepEqual(service.peek(), [second]); assert.equal(service.activeEpisodeCount, 1);
});
for (const fps of [30, 60, 120]) test(`T_IMPACT_${fps}FPS`, () => {
  const f = impactFixture('moon', C, fps); try {
    for (let i = 0; i < fps; i++) f.step();
    assert.equal(f.event().bodyId, 'moon'); assert.equal(f.event().classification, 'CATASTROPHIC_IMPACT');
    assert.equal(f.game.celestialImpacts.emittedCount, 1);
    assert.ok(Math.abs(Math.hypot(...f.event().contactBodyFixedM) - f.envelope.radiusM) < .01);
  } finally { f.dispose(); }
});
test('T_IMPACT_ALL_19_BODIES_HAVE_POLICY', () => {
  assert.equal(SOLAR_SYSTEM_BODIES.length, 19);
  for (const body of [...SOLAR_SYSTEM_BODIES].reverse()) {
    const f = impactFixture(body.id); try {
      f.step(); const e = f.event(); assert.ok(e, body.id); assert.equal(e.bodyId, body.id);
      assert.equal(e.classification, 'CATASTROPHIC_IMPACT'); assert.equal(e.bodyClass, bodyProfile(body).bodyClass);
      assert.ok(f.envelope.centreM.every(Number.isFinite)); assert.ok(f.envelope.velocityMps!.every(Number.isFinite));
      assert.ok(Number.isFinite(f.envelope.radiusM) && f.envelope.radiusM > 0);
      assert.equal(!!e.contactBodyFixedM, bodyProfile(body).hasSolidSurface);
    } finally { f.dispose(); }
  }
});
test('T_IMPACT_PRESENTATION_SCALE_DOES_NOT_CHANGE_COLLISION', () => {
  const f = impactFixture('titan'); const visual = SOLAR_BODY_PROFILES.titan.visual;
  try {
    const before = bodyExclusionEnvelopes(f.universe.activeSystem);
    (SOLAR_BODY_PROFILES.titan as any).visual = { ...visual, minimumVisiblePx: 1e8, pointGlowPx: 1e9,
      haze: { radiusScale: 1e8, strength: 1 } };
    assert.deepEqual(bodyExclusionEnvelopes(f.universe.activeSystem), before);
    f.step(); assert.equal(f.event().bodyId, 'titan'); assert.equal(f.event().classification, 'CATASTROPHIC_IMPACT');
  } finally { (SOLAR_BODY_PROFILES.titan as any).visual = visual; f.dispose(); }
});
test('T_IMPACT_CATALOG_REMAINS_IMMUTABLE', () => {
  const before = JSON.stringify(SOLAR_SYSTEM_BODIES);
  for (const id of ['earth', 'moon', 'jupiter', 'neptune', 'sun', 'europa']) {
    const f = impactFixture(id); try { f.step(); assert.equal(f.event().classification, 'CATASTROPHIC_IMPACT'); }
    finally { f.dispose(); }
  }
  assert.equal(JSON.stringify(SOLAR_SYSTEM_BODIES), before);
});
test('T_IMPACT_DOES_NOT_CREATE_VOLUME_EDIT', () => {
  for (const id of ['earth', 'moon', 'mars', 'jupiter', 'neptune', 'sun', 'titan']) {
    const f = impactFixture(id); try {
      const before = f.universe.volume.metrics;
      f.universe.volume.edits.add = () => { throw new Error('C4 must not edit volume'); };
      f.step(); assert.ok(f.event()); assert.deepEqual(f.universe.volume.metrics, before);
      assert.equal(f.game.planetProviders.size, 0); assert.equal(f.travelDomain.kind, 'interplanetary');
    } finally { f.dispose(); }
  }
});
test('Game captures autopilot ownership before update and X disables same-frame safety', () => {
  for (const cancel of [false, true]) {
    const f = impactFixture('moon', 256 * C); try {
      f.game.selectNavigationTarget('moon'); f.controller.autopilot.engage();
      if (cancel) f.held.add('KeyX');
      f.step(); assert.ok(f.event());
      assert.equal(f.event().classification, cancel ? 'CATASTROPHIC_IMPACT' : 'SAFE_CAPTURE');
      assert.equal(f.event().autopilotActive, !cancel);
    } finally { f.dispose(); }
  }
});
test('Game landing intent dominates even an extreme swept contact', () => {
  const f = impactFixture('moon', 256 * C, 120); try {
    f.game.landingIntent.request('moon'); f.step(); assert.ok(f.event());
    assert.equal(f.event().classification, 'SAFE_CAPTURE'); assert.equal(f.event().landingIntentActive, true);
    assert.equal(f.event().autopilotActive, false);
  } finally { f.dispose(); }
});
