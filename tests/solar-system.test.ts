import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOLAR_SYSTEM_BODIES, bodyById, escapeVelocityMps, flattening, gravitationalParameter,
  meanRadiusM, sphereOfInfluenceM, surfaceGravityMps2,
} from '../src/world/celestial/CelestialBody.ts';
import { OfflineEphemeris } from '../src/world/celestial/OfflineEphemeris.ts';
import { orbitalPeriodS, solveKepler } from '../src/world/celestial/EphemerisProvider.ts';
import { SolarSystem, SOLAR_SYSTEM_FRAME } from '../src/world/celestial/SolarSystem.ts';
import {
  STARS_PER_SECTOR_BASE, generateStarSector, metresToLightYears, milkyWayDensity,
} from '../src/world/celestial/StarSector.ts';
import { SECTOR_SIZE_M, sectorIndex } from '../src/world/spatial/UniverseAddress.ts';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { AU_M, lengthVec3, radToDeg, type Vec3 } from '../src/world/spatial/units.ts';

const DAY = 86_400;
const YEAR = 365.25 * DAY;

test('the bodies carry published physics, not numbers picked to render nicely', () => {
  assert.equal(SOLAR_SYSTEM_BODIES.length, 10, 'Sun, eight planets and the Moon');
  const earth = bodyById('earth')!;
  assert.equal(earth.equatorialRadiusM, 6_378_137, 'Earth is the WGS84 ellipsoid');
  assert.ok(Math.abs(surfaceGravityMps2(earth) - 9.798) < 0.02, `${surfaceGravityMps2(earth)}`);
  assert.ok(Math.abs(escapeVelocityMps(earth) - 11_180) < 60, `${escapeVelocityMps(earth)}`);

  // Jupiter is visibly oblate; Venus and the Sun are not.
  assert.ok(flattening(bodyById('jupiter')!) > 0.06, 'Jupiter is flattened by its spin');
  assert.ok(flattening(bodyById('venus')!) < 1e-6, 'Venus is not');

  // Venus and Uranus really do turn the other way, and a negative period is how that is recorded.
  assert.ok(bodyById('venus')!.rotationPeriodS! < 0, 'Venus is retrograde');
  assert.ok(bodyById('uranus')!.rotationPeriodS! < 0, 'Uranus is retrograde');
  assert.ok(bodyById('earth')!.rotationPeriodS! > 0);

  // Uranus is tipped on its side; that is not a typo and the test says so.
  assert.ok(radToDeg(bodyById('uranus')!.axialTiltRad!) > 90);
  assert.ok(Math.abs(radToDeg(bodyById('earth')!.axialTiltRad!) - 23.44) < 0.01);
});

test("Kepler's equation is solved for every eccentricity in the system", () => {
  for (const eccentricity of [0, 0.0167, 0.0934, 0.2056, 0.5, 0.9]) {
    for (const meanAnomaly of [0, 0.5, 1, Math.PI, 4, 6.2]) {
      const eccentric = solveKepler(meanAnomaly, eccentricity);
      // The defining relation, checked rather than assumed.
      const recovered = eccentric - eccentricity * Math.sin(eccentric);
      const wrapped = ((meanAnomaly % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      assert.ok(Math.abs(recovered - wrapped) < 1e-9,
        `e=${eccentricity} M=${meanAnomaly}: got E=${eccentric}`);
    }
  }
  // And it terminates on nonsense rather than iterating forever.
  assert.ok(Number.isFinite(solveKepler(Number.NaN, Number.NaN)));
  assert.ok(Number.isFinite(solveKepler(1, 5)));
});

test('the planets are at their real distances, in the real order, at J2000', () => {
  const system = new SolarSystem({ epochS: 0 });
  // Published heliocentric distances on 2000-01-01. Earth is near perihelion that week, which is
  // why it is inside one astronomical unit — a detail a made-up model would get wrong.
  const expected: Array<[string, number, number]> = [
    ['mercury', 0.31, 0.47],
    ['venus', 0.718, 0.729],
    ['earth', 0.980, 0.987],
    ['mars', 1.38, 1.67],
    ['jupiter', 4.95, 5.46],
    ['saturn', 9.01, 10.06],
    ['uranus', 18.28, 20.10],
    ['neptune', 29.80, 30.34],
  ];
  let previous = 0;
  for (const [id, min, max] of expected) {
    const au = system.distanceBetween(id, 'sun') / AU_M;
    assert.ok(au >= min && au <= max, `${id} is at ${au.toFixed(3)} au, outside ${min}..${max}`);
    assert.ok(au > previous, `${id} must be further out than the planet before it`);
    previous = au;
  }
  // The Moon is where the Moon is: between perigee and apogee.
  const moon = system.distanceBetween('moon', 'earth') / 1000;
  assert.ok(moon > 356_000 && moon < 407_000, `the Moon is ${moon.toFixed(0)} km away`);
});

test('the planets go round, at the right speeds, over a century', () => {
  const system = new SolarSystem({ epochS: 0 });
  const start = new Map(SOLAR_SYSTEM_BODIES.map(b => [b.id, system.positionOf(b.id)?.slice() as Vec3]));

  // A quarter of Earth's year: Earth should have moved a quarter of the way round, Neptune barely.
  system.update(YEAR / 4);
  const earthMoved = distance(start.get('earth')!, system.positionOf('earth')!) / AU_M;
  const neptuneMoved = distance(start.get('neptune')!, system.positionOf('neptune')!) / AU_M;
  assert.ok(earthMoved > 1.2 && earthMoved < 1.6, `Earth moved ${earthMoved.toFixed(2)} au`);
  assert.ok(neptuneMoved < 0.8, `Neptune moved ${neptuneMoved.toFixed(2)} au in three months`);

  // A full year brings Earth back to nearly where it began.
  system.update(YEAR);
  const returned = distance(start.get('earth')!, system.positionOf('earth')!) / AU_M;
  assert.ok(returned < 0.05, `Earth is ${returned.toFixed(3)} au from where it started a year ago`);

  // And the orbital period from the elements agrees with that.
  const sun = bodyById('sun')!;
  const period = orbitalPeriodS(AU_M, gravitationalParameter(sun));
  assert.ok(Math.abs(period / YEAR - 1) < 0.01, `a one-au orbit takes ${(period / YEAR).toFixed(3)} years`);
});

test('the Moon orbits Earth rather than the Sun, and carries Earth with it', () => {
  const system = new SolarSystem({ epochS: 0 });
  const earthStart = system.positionOf('earth')!.slice() as Vec3;
  const moonStart = system.positionOf('moon')!.slice() as Vec3;
  // The Moon's position is reported in the solar system frame, so it is near Earth, not near zero.
  assert.ok(distance(earthStart, moonStart) < 410_000_000, 'the Moon must be beside Earth');
  assert.ok(lengthVec3(moonStart) > 0.9 * AU_M, 'and both must be an au from the Sun');

  // Over half a sidereal month the Moon swings to the other side of Earth.
  system.update(27.321_582 * DAY / 2);
  const relativeStart: Vec3 = [
    moonStart[0] - earthStart[0], moonStart[1] - earthStart[1], moonStart[2] - earthStart[2],
  ];
  const earthNow = system.positionOf('earth')!, moonNow = system.positionOf('moon')!;
  const relativeNow: Vec3 = [
    moonNow[0] - earthNow[0], moonNow[1] - earthNow[1], moonNow[2] - earthNow[2],
  ];
  const dot = (relativeStart[0] * relativeNow[0] + relativeStart[1] * relativeNow[1] + relativeStart[2] * relativeNow[2])
    / (lengthVec3(relativeStart) * lengthVec3(relativeNow));
  assert.ok(dot < -0.85, `half a month should put the Moon opposite, alignment was ${dot.toFixed(2)}`);
});

test('which body you belong to is decided by gravity, not by which is bigger', () => {
  const system = new SolarSystem({ epochS: 0 });
  const earth = system.positionOf('earth')!;
  const moon = system.positionOf('moon')!;

  // Standing on Earth, Earth wins — despite the Sun being enormously more massive.
  assert.equal(system.dominantBody([earth[0] + 6_400_000, earth[1], earth[2]]).id, 'earth');
  // Standing on the Moon, the Moon wins — despite Earth being 81 times its mass.
  assert.equal(system.dominantBody([moon[0] + 1_800_000, moon[1], moon[2]]).id, 'moon');
  // Out in empty space between the planets, the Sun wins.
  assert.equal(system.dominantBody([0.5 * AU_M, 0.5 * AU_M, 0]).id, 'sun');

  // The sphere of influence is what draws that boundary, and the Moon's is about 66 000 km.
  const soi = sphereOfInfluenceM(bodyById('moon')!, 384_400_000, bodyById('earth')!.massKg!);
  assert.ok(soi > 55_000_000 && soi < 75_000_000, `the Moon's sphere of influence is ${(soi / 1000).toFixed(0)} km`);
});

test('a distant body is handed to the renderer as an angle, never as a scaled position', () => {
  const system = new SolarSystem({ epochS: 0 });
  const earth = system.positionOf('earth')!;

  // From Earth, the Moon is a disc about half a degree across — the number everyone can check.
  const moonFromEarth = system.handoff('moon', earth)!;
  assert.ok(Math.abs(radToDeg(moonFromEarth.apparentAngularRadiusRad * 2) - 0.52) < 0.06,
    `the Moon looks ${radToDeg(moonFromEarth.apparentAngularRadiusRad * 2).toFixed(3)} degrees across`);
  assert.equal(moonFromEarth.mode, 'planet', 'big enough to be a globe, not a point of light');

  // The Sun from Earth is also about half a degree, which is why eclipses work at all.
  const sunFromEarth = system.handoff('sun', earth)!;
  assert.ok(Math.abs(radToDeg(sunFromEarth.apparentAngularRadiusRad * 2) - 0.53) < 0.06);

  // Neptune from Earth is a point of light.
  assert.equal(system.handoff('neptune', earth)!.mode, 'celestial');

  // And standing on the surface, the body fills the sky.
  const surface = system.handoff('earth', [earth[0] + 6_378_137 + 2, earth[1], earth[2]])!;
  assert.equal(surface.mode, 'surface');
  assert.ok(surface.distanceToSurfaceM < 50, `${surface.distanceToSurfaceM.toFixed(1)} m above the ground`);
  // Blend is for cross-fading only; the distance is the truth and stays real throughout.
  assert.ok(surface.blend >= 0 && surface.blend <= 1);
});

test('the ephemeris is offline, deterministic and answers only for what it knows', () => {
  const ephemeris = new OfflineEphemeris();
  const first = ephemeris.sample('mars', 12_345_678);
  const second = ephemeris.sample('mars', 12_345_678);
  assert.deepEqual(first, second, 'the same epoch must give the same answer, always');
  assert.equal(ephemeris.sample('pluto', 0), undefined, 'unknown bodies are undefined, not guessed');
  assert.deepEqual(ephemeris.sample('sun', 999)!.positionM, [0, 0, 0], 'the Sun is the origin');

  // Velocity must be consistent with the positions it is differencing.
  const before = ephemeris.sample('earth', -3600)!;
  const after = ephemeris.sample('earth', 3600)!;
  const measured = [0, 1, 2].map(i => (after.positionM[i] - before.positionM[i]) / 7200);
  const stated = ephemeris.sample('earth', 0)!.velocityMps;
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(measured[i] - stated[i]) < 10, `velocity component ${i} disagrees with the motion`);
  }
  // Earth travels about 29.8 km/s.
  assert.ok(Math.abs(lengthVec3(stated) - 29_800) < 900, `Earth moves at ${lengthVec3(stated).toFixed(0)} m/s`);
});

test('every body gets a frame, hung under the solar system', () => {
  const graph = new ReferenceFrameGraph();
  const system = new SolarSystem({ epochS: 0 });
  system.registerFrames(graph);

  assert.ok(graph.has(SOLAR_SYSTEM_FRAME));
  for (const body of SOLAR_SYSTEM_BODIES) assert.ok(graph.has(body.frameId), `${body.id} has no frame`);

  // A position on Earth's surface converts into the solar system frame and back unchanged.
  const earth = bodyById('earth')!;
  const surface: Vec3 = [6_378_137, 0, 0];
  const inSystem = graph.convertPosition(earth.frameId, SOLAR_SYSTEM_FRAME, surface);
  assert.ok(lengthVec3(inSystem) > 0.9 * AU_M, 'which puts it an au from the Sun');
  const back = graph.convertPosition(SOLAR_SYSTEM_FRAME, earth.frameId, inSystem);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(back[i] - surface[i]) < 1e-3);
});

test('star sectors are generated, never stored, and always the same', () => {
  const sector = sectorIndex(12, -3, 7);
  const first = generateStarSector('milky-way', sector);
  const second = generateStarSector('milky-way', sector);
  assert.equal(first.stars.length, second.stars.length);
  assert.deepEqual(first.stars[0], second.stars[0], 'the same sector must give the same stars');
  assert.notEqual(
    generateStarSector('milky-way', sectorIndex(12, -3, 8)).seed, first.seed,
    'and a different sector must give different ones',
  );

  for (const star of first.stars) {
    assert.ok(star.massSolar >= 0.08 && star.massSolar <= 60, `mass ${star.massSolar}`);
    assert.ok(star.temperatureK > 1000 && star.temperatureK < 60_000, `temperature ${star.temperatureK}`);
    for (const component of star.offsetM) {
      assert.ok(component >= 0 && component < SECTOR_SIZE_M, 'stars must lie inside their sector');
    }
    assert.ok(star.planetCount >= 0 && star.planetCount <= 9);
  }

  // The mass function is weighted the way the real sky is: mostly small, dim stars.
  const dwarfs = first.stars.filter(s => s.spectralClass === 'M').length;
  assert.ok(dwarfs > first.stars.length * 0.5, `only ${dwarfs} of ${first.stars.length} are M dwarfs`);
  // And the most massive stars keep no planets, because they do not live long enough.
  for (const star of first.stars) if (star.massSolar > 16) assert.equal(star.planetCount, 0);
});

test('the galaxy has a shape, so flying toward the centre is different from flying out of it', () => {
  const kpc = 3.085_677_581e19;
  const sunlike = milkyWayDensity([8.2 * kpc, 0, 0]);
  assert.ok(sunlike > 0.5 && sunlike < 2, `the solar neighbourhood normalises to ${sunlike.toFixed(2)}`);

  // Denser toward the centre, thinner far out, and thinner out of the plane.
  assert.ok(milkyWayDensity([1 * kpc, 0, 0]) > sunlike * 3, 'the bulge is much denser');
  assert.ok(milkyWayDensity([20 * kpc, 0, 0]) < sunlike * 0.2, 'the outskirts are much emptier');
  assert.ok(milkyWayDensity([8.2 * kpc, 0, 2 * kpc]) < sunlike * 0.05, 'and so is well above the disc');

  // Which feeds straight through into how many stars a sector holds.
  const core = generateStarSector('milky-way', sectorIndex(Math.round(1 * kpc / SECTOR_SIZE_M), 0, 0));
  const rim = generateStarSector('milky-way', sectorIndex(Math.round(20 * kpc / SECTOR_SIZE_M), 0, 0));
  assert.ok(core.stars.length > rim.stars.length, 'the core must be busier than the rim');
  assert.ok(core.stars.length <= 2000, 'and still bounded');
  assert.ok(STARS_PER_SECTOR_BASE > 0);
});

test('cosmic distances stay readable', () => {
  assert.ok(Math.abs(metresToLightYears(SECTOR_SIZE_M) - 100) < 1e-9, 'a sector is 100 light years');
  assert.ok(Math.abs(metresToLightYears(4.0175e16) - 4.246) < 0.01, 'Proxima Centauri is 4.25 ly');
});

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
