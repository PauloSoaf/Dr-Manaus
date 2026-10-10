import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { TravelDomain, type TravelContext } from '../src/world/travel/TravelDomain.ts';
import { InterplanetaryController } from '../src/world/travel/InterplanetaryController.ts';

const EARTH_R = 6_378_137;

const context = (over: Partial<TravelContext> = {}): TravelContext => ({
  altitudeM: 100_000,
  speedMps: 222_222,
  requested: true,
  nearestColliderM: Infinity,
  bodyRadiusM: EARTH_R,
  bodyId: 'earth',
  systemId: 'sol',
  surfaceReady: true,
  ...over,
});

test('the local domain is where the game starts and stays by default', () => {
  const domain = new TravelDomain();
  assert.equal(domain.kind, 'local');
  assert.equal(domain.localPhysicsActive, true);

  domain.update(context({ requested: false }), 1 / 60);
  assert.equal(domain.kind, 'local');
  assert.equal(domain.state, undefined);
});

test('leaving the local domain needs altitude, clearance and a request', () => {
  const domain = new TravelDomain();

  // Too low: the city is down there.
  assert.deepEqual(domain.update(context({ altitudeM: 500 }), 1 / 60), { kind: 'refused', reason: 'altitude' });
  assert.equal(domain.kind, 'local');

  // High enough, but something to hit. Leaving now means the thing to hit stops existing.
  assert.deepEqual(
    domain.update(context({ nearestColliderM: 50 }), 1 / 60),
    { kind: 'refused', reason: 'collider' },
  );
  assert.equal(domain.kind, 'local');

  // Clear.
  assert.deepEqual(domain.update(context(), 1 / 60), { kind: 'departed', reason: 'requested' });
  assert.equal(domain.kind, 'interplanetary');
  assert.equal(domain.localPhysicsActive, false, 'urban physics is off out here');
  assert.equal(domain.state?.systemId, 'sol');
  assert.equal(domain.state?.referenceBodyId, 'earth');
});

test('local physics is off exactly while travelling, and on either side of it', () => {
  const domain = new TravelDomain();
  assert.equal(domain.localPhysicsActive, true);
  domain.update(context(), 1 / 60);
  assert.equal(domain.localPhysicsActive, false);
  domain.update(context({ altitudeM: 5_000, speedMps: 120, requested: false }), 1 / 60);
  assert.equal(domain.localPhysicsActive, true);
});

test('T3: releasing boost does not return to local in space (coasting)', () => {
  const domain = new TravelDomain();
  domain.update(context({ altitudeM: 100_000, speedMps: 222_222, requested: true }), 1 / 60);
  assert.equal(domain.kind, 'interplanetary');

  // Release requested
  const transition = domain.update(context({ altitudeM: 100_000, speedMps: 222_222, requested: false }), 1 / 60);
  assert.deepEqual(transition, { kind: 'none' });
  assert.equal(domain.kind, 'interplanetary');
  assert.equal(domain.localPhysicsActive, false);
  assert.ok(domain.state, 'coasting keeps travel state');
});

test('T4: reentry requires both low altitude and safe relative speed', () => {
  // Case 1: altitude 5 km, relative speed 100 km/s -> continues interplanetary
  const domain1 = new TravelDomain();
  domain1.update(context({ altitudeM: 100_000, requested: true }), 1 / 60);
  assert.equal(domain1.kind, 'interplanetary');
  const t1 = domain1.update(context({ altitudeM: 5_000, speedMps: 100_000, requested: false }), 1 / 60);
  assert.deepEqual(t1, { kind: 'none' });
  assert.equal(domain1.kind, 'interplanetary');

  // Case 2: altitude 100 km, relative speed 2 km/s -> continues interplanetary
  const domain2 = new TravelDomain();
  domain2.update(context({ altitudeM: 100_000, requested: true }), 1 / 60);
  assert.equal(domain2.kind, 'interplanetary');
  const t2 = domain2.update(context({ altitudeM: 100_000, speedMps: 2_000, requested: false }), 1 / 60);
  assert.deepEqual(t2, { kind: 'none' });
  assert.equal(domain2.kind, 'interplanetary');

  // Case 3: altitude 5 km, ordinary-flight inward speed -> returned
  const domain3 = new TravelDomain();
  domain3.update(context({ altitudeM: 100_000, requested: true }), 1 / 60);
  assert.equal(domain3.kind, 'interplanetary');
  const t3 = domain3.update(context({ altitudeM: 5_000, speedMps: 120, requested: false }), 1 / 60);
  assert.deepEqual(t3, { kind: 'returned', reason: 'altitude' });
  assert.equal(domain3.kind, 'local');
  assert.equal(domain3.state, undefined);
});

test('a solid-body landing waits for the matching surface coverage', () => {
  const domain = new TravelDomain();
  domain.update(context({ bodyId: 'moon', altitudeM: 100_000 }), 1 / 60);
  assert.equal(domain.kind, 'interplanetary');

  const waiting = domain.update(context({
    bodyId: 'moon', altitudeM: 100, speedMps: 20, requested: false, surfaceReady: false,
  }), 1 / 60);
  assert.deepEqual(waiting, { kind: 'none' });
  assert.equal(domain.kind, 'interplanetary');

  const landed = domain.update(context({
    bodyId: 'moon', altitudeM: 100, speedMps: 20, requested: false, surfaceReady: true,
  }), 1 / 60);
  assert.deepEqual(landed, { kind: 'returned', reason: 'altitude' });
  assert.equal(domain.kind, 'local');
});

test('T5: altitude hysteresis prevents ping-pong between 8.8 km and 9.2 km', () => {
  const domain = new TravelDomain();
  // Enter at 9.2 km
  const dep = domain.update(context({ altitudeM: 9_200, requested: true }), 1 / 60);
  assert.deepEqual(dep, { kind: 'departed', reason: 'requested' });
  assert.equal(domain.kind, 'interplanetary');

  // Oscillate altitude 20 times between 8.8 km and 9.2 km
  for (let i = 0; i < 20; i++) {
    const alt = i % 2 === 0 ? 8_800 : 9_200;
    const trans = domain.update(context({ altitudeM: alt, speedMps: 5_000, requested: true }), 1 / 60);
    assert.deepEqual(trans, { kind: 'none' }, `failed hysteresis at cycle ${i} with alt ${alt}`);
    assert.equal(domain.kind, 'interplanetary');
  }
});

test('T6: brake in InterplanetaryController is relative to dominant body', () => {
  const controller = new InterplanetaryController();
  const earthVelocity: [number, number, number] = [0, 29_780, 0]; // Earth orbital speed ~30 km/s
  let state = {
    systemId: 'sol',
    positionM: [0, EARTH_R + 100_000, 0] as [number, number, number],
    velocityMps: [0, 29_780, 0] as [number, number, number], // exactly matching Earth
    referenceBodyId: 'earth',
  };

  // Player velocity equals Earth velocity -> relative velocity is 0
  // Apply brake for 60 frames
  for (let i = 0; i < 60; i++) {
    state = controller.update(
      state,
      1 / 60,
      new Vector3(),
      true, // brake
      context({ altitudeM: 100_000, bodyVelocityMps: earthVelocity }),
    );
  }

  // Relative velocity must remain 0, and barycentric velocity continues following Earth
  assert.ok(Math.abs(state.velocityMps[0]) < 1e-3);
  assert.ok(Math.abs(state.velocityMps[1] - 29_780) < 1e-3);
  assert.ok(Math.abs(state.velocityMps[2]) < 1e-3);
});

test('T7: InterplanetaryController clamps relative speed to maximum', () => {
  const controller = new InterplanetaryController();
  let state = {
    systemId: 'sol',
    positionM: [0, EARTH_R + 100_000_000, 0] as [number, number, number],
    velocityMps: [0, 0, 0] as [number, number, number],
    referenceBodyId: 'sun',
  };

  // Thrust forward continuously for 1000 frames
  for (let i = 0; i < 1000; i++) {
    state = controller.update(
      state,
      1 / 60,
      new Vector3(0, 1, 0), // thrust up
      false,
      context({ altitudeM: 100_000_000, maxRelativeSpeedMps: 222_222 }),
    );
  }

  const speed = Math.hypot(...state.velocityMps);
  assert.ok(speed <= 222_222 + 1e-3, `speed ${speed} exceeded max 222,222`);
  assert.ok(speed >= 222_221, `speed ${speed} reached max`);
});

test('travel integrates in metres, not in whatever the renderer can hold', () => {
  const controller = new InterplanetaryController();
  let state = {
    systemId: 'sol',
    positionM: [0, EARTH_R + 1_000_000, 0] as [number, number, number],
    velocityMps: [222_222, 0, 0] as [number, number, number],
    referenceBodyId: 'earth',
  };
  for (let i = 0; i < 60; i++) {
    state = controller.update(state, 1 / 60, new Vector3(), false, context({ altitudeM: 1_000_000 }));
  }

  assert.ok(
    Math.abs(state.positionM[0] - 222_222) < 1,
    `a second of travel moved ${state.positionM[0].toFixed(1)} m`,
  );
});

test('the envelope stops the player at the surface rather than inside the planet', () => {
  const controller = new InterplanetaryController();
  // Aimed straight at the centre of the Earth at full speed.
  let state = {
    systemId: 'sol',
    positionM: [0, EARTH_R + 500_000, 0] as [number, number, number],
    velocityMps: [0, -222_222, 0] as [number, number, number],
    referenceBodyId: 'earth',
  };

  for (let i = 0; i < 300; i++) {
    state = controller.update(state, 1 / 60, new Vector3(), false, context({ altitudeM: 1_000_000 }));
  }
  const radius = Math.hypot(...state.positionM);
  assert.ok(radius >= EARTH_R, `the player reached ${(radius / 1000).toFixed(0)} km from the centre`);
  assert.ok(state.velocityMps[1] >= -1, 'the inward speed is spent, not carried through the planet');
});

test('a grazing pass keeps its speed instead of being stopped by the envelope', () => {
  const controller = new InterplanetaryController();
  let state = {
    systemId: 'sol',
    positionM: [0, EARTH_R + 1_000, 0] as [number, number, number],
    velocityMps: [100_000, 0, 0] as [number, number, number],
    referenceBodyId: 'earth',
  };
  state = controller.update(state, 1 / 60, new Vector3(), false, context({ altitudeM: 1_000_000 }));
  assert.ok(state.velocityMps[0] > 99_000, 'tangential speed survives');
});

test('a reset puts the player back in the local game, whatever it was doing', () => {
  const domain = new TravelDomain();
  domain.update(context(), 1 / 60);
  assert.equal(domain.kind, 'interplanetary');
  domain.reset();
  assert.equal(domain.kind, 'local');
  assert.equal(domain.state, undefined);
  assert.deepEqual(domain.transition, { kind: 'none' });
});

test('rubbish in the context does not move the player anywhere', () => {
  const controller = new InterplanetaryController();
  let state = {
    systemId: 'sol',
    positionM: [Number.NaN, EARTH_R, Number.POSITIVE_INFINITY] as [number, number, number],
    velocityMps: [Number.NaN, 0, 0] as [number, number, number],
    referenceBodyId: 'earth',
  };
  state = controller.update(state, Number.NaN, new Vector3(), false, context({ altitudeM: 1_000_000 }));
  for (const value of [...state.positionM, ...state.velocityMps]) {
    assert.ok(Number.isFinite(value), 'a non-finite coordinate must never survive the boundary');
  }
});

test('T_ENTRY_KEEPS_THE_PLAYER_WHERE_THEY_WERE: departure is not a teleport to the Sun', () => {
  const domain = new TravelDomain();
  // Where the player actually is: in orbit around an Earth that is one AU from the barycentre.
  const earthBary: [number, number, number] = [1.496e11, 0, 0];
  const entry: [number, number, number] = [earthBary[0], earthBary[1] + EARTH_R + 400_000, earthBary[2]];
  const earthVelocity: [number, number, number] = [0, 29_780, 0];

  domain.update({
    altitudeM: 400_000,
    speedMps: 8_000,
    requested: true,
    nearestColliderM: Infinity,
    bodyRadiusM: EARTH_R,
    bodyPositionM: earthBary,
    bodyVelocityMps: earthVelocity,
    bodyId: 'earth',
    systemId: 'sol',
    entryPositionM: entry,
    entryVelocityMps: earthVelocity,
  }, 1 / 60);

  const state = domain.state;
  assert.ok(state, 'the domain must have been entered');
  // The bug this exists for: the entry position was [0, radius + altitude, 0], measured from the
  // Earth's centre but read as barycentric. The barycentre is the Sun, so the player arrived a
  // few thousand kilometres from the Sun with the Earth an astronomical unit behind them.
  const fromBarycentre = Math.hypot(...state.positionM);
  assert.ok(
    fromBarycentre > 1e11,
    `departure put the player ${(fromBarycentre / 1e9).toFixed(2)} million km from the barycentre`,
  );
  const fromEarth = Math.hypot(
    state.positionM[0] - earthBary[0],
    state.positionM[1] - earthBary[1],
    state.positionM[2] - earthBary[2],
  );
  assert.ok(Math.abs(fromEarth - (EARTH_R + 400_000)) < 1, 'and exactly where they were above the Earth');

  // Standing still relative to the Earth is 30 km/s relative to the Sun; zeroing that is a shove.
  assert.ok(Math.abs(state.velocityMps[1] - 29_780) < 1, 'the body\'s orbital motion is kept');
});
