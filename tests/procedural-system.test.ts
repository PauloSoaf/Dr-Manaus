import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSystem } from '../src/world/celestial/SystemGenerator.ts';
import { ProceduralSystemRuntime } from '../src/world/celestial/ProceduralSystemRuntime.ts';
import { circularOrbitRateRadS } from '../src/world/celestial/CelestialBody.ts';

const SEED = 0x1234_5678_9abc_def0n;

test('every generated body carries the orbit it was generated with', () => {
  const system = generateSystem('alpha', SEED, 1.1);
  const star = system.bodies[0];
  assert.equal(star.id, 'alpha');
  assert.equal(star.orbit, undefined, 'the star is the centre and orbits nothing');
  // A star drawn with two independent radii is not oblate, it is arbitrary.
  assert.equal(star.equatorialRadiusM, star.polarRadiusM);

  const orbiting = system.bodies.filter(b => b.parentId);
  assert.ok(orbiting.length >= 2, 'a system with no planets is not a system');
  for (const body of orbiting) {
    assert.ok(body.orbit, `${body.id} must carry its elements`);
    assert.ok(body.orbit.semiMajorAxisM > 0, `${body.id} must orbit at a real distance`);
    assert.ok(Number.isFinite(body.orbit.angularRateRadS));
    assert.ok(body.orbit.angularRateRadS > 0, `${body.id} must actually move`);
  }
});

test('a generated body is where its elements put it, and never at the origin', () => {
  const system = generateSystem('beta', SEED, 1);
  const runtime = new ProceduralSystemRuntime(system, 0);

  for (const body of system.bodies) {
    const position = runtime.positionOf(body.id);
    assert.ok(position, `${body.id} must resolve`);
    if (!body.parentId) continue;
    const distance = Math.hypot(position[0], position[1], position[2]);
    // The bug this exists for: bodies whose orbits were never recorded resolved to [0,0,0], so a
    // whole system sat inside its own star.
    assert.ok(distance > 0, `${body.id} fell to the origin`);
  }

  // A planet's distance from its star is the radius it was given.
  const planet = system.bodies.find(b => b.parentId === 'beta');
  assert.ok(planet?.orbit);
  const at = runtime.positionOf(planet.id);
  const star = runtime.positionOf('beta');
  assert.ok(at && star);
  const radius = Math.hypot(at[0] - star[0], at[1] - star[1], at[2] - star[2]);
  assert.ok(
    Math.abs(radius - planet.orbit.semiMajorAxisM) < planet.orbit.semiMajorAxisM * 1e-9,
    `planet sits at ${radius.toExponential(3)} m, elements say ${planet.orbit.semiMajorAxisM.toExponential(3)} m`,
  );
});

test('a moon travels with its planet rather than around the star', () => {
  const system = generateSystem('gamma', SEED, 1);
  const moon = system.bodies.find(b => b.parentId && b.parentId !== 'gamma');
  if (!moon) return; // this seed produced no moons; the other assertions still stand
  const runtime = new ProceduralSystemRuntime(system, 0);

  const planet = system.bodies.find(b => b.id === moon.parentId);
  assert.ok(planet?.orbit && moon.orbit);
  const moonAt = runtime.positionOf(moon.id);
  const planetAt = runtime.positionOf(planet.id);
  assert.ok(moonAt && planetAt);

  const separation = Math.hypot(
    moonAt[0] - planetAt[0], moonAt[1] - planetAt[1], moonAt[2] - planetAt[2],
  );
  assert.ok(
    Math.abs(separation - moon.orbit.semiMajorAxisM) < moon.orbit.semiMajorAxisM * 1e-6,
    'a moon is its own orbital radius from its planet, wherever the planet is',
  );
  // And it is far from the star, because it went with the planet.
  const fromStar = Math.hypot(moonAt[0], moonAt[1], moonAt[2]);
  assert.ok(fromStar > moon.orbit.semiMajorAxisM * 10);
});

test('the same seed gives the same system, and time moves it', () => {
  const a = generateSystem('delta', SEED, 1);
  const b = generateSystem('delta', SEED, 1);
  assert.deepEqual(a.bodies.map(x => x.id), b.bodies.map(x => x.id));
  assert.deepEqual(a.bodies.map(x => x.orbit?.semiMajorAxisM), b.bodies.map(x => x.orbit?.semiMajorAxisM));

  const runtime = new ProceduralSystemRuntime(a, 0);
  const planet = a.bodies.find(x => x.parentId === 'delta');
  assert.ok(planet?.orbit);
  const before = [...runtime.positionOf(planet.id)!];

  // A quarter of this planet's own year: it cannot possibly be in the same place.
  runtime.update((Math.PI / 2) / planet.orbit.angularRateRadS);
  const after = runtime.positionOf(planet.id)!;
  const moved = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
  assert.ok(moved > planet.orbit.semiMajorAxisM, 'a quarter orbit is more than a radius of travel');
});

test('the orbital rate is the circular one for the parent it was given', () => {
  // v = sqrt(GM/r), rate = v/r. Checked against the Earth: one year, near enough.
  const yearS = 365.256 * 86_400;
  const rate = circularOrbitRateRadS(1.495_978_707e11, 1.988_5e30);
  const period = (2 * Math.PI) / rate;
  assert.ok(
    Math.abs(period - yearS) / yearS < 0.01,
    `a circular orbit at 1 AU around the Sun came out at ${(period / 86_400).toFixed(1)} days`,
  );
  // Degenerate inputs sit still rather than dividing by zero.
  assert.equal(circularOrbitRateRadS(0, 1e30), 0);
  assert.equal(circularOrbitRateRadS(1e11, 0), 0);
  assert.equal(circularOrbitRateRadS(Number.NaN, 1e30), 0);
});
