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
  assert.deepEqual(domain.update(context(), 1 / 60), { kind: 'entered', reason: 'requested' });
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
  domain.update(context({ requested: false }), 1 / 60);
  assert.equal(domain.localPhysicsActive, true);
});

test('releasing the request, slowing down or dropping in hands the player back', () => {
  for (const [over, reason] of [
    [{ requested: false }, 'released'],
    [{ speedMps: 10 }, 'speed'],
    [{ altitudeM: 100 }, 'altitude'],
  ] as const) {
    const domain = new TravelDomain();
    domain.update(context(), 1 / 60);
    assert.equal(domain.kind, 'interplanetary');
    const transition = domain.update(context(over), 1 / 60);
    assert.deepEqual(transition, { kind: 'returned', reason });
    assert.equal(domain.kind, 'local');
    assert.equal(domain.state, undefined, 'the travel state goes with the domain');
  }
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
