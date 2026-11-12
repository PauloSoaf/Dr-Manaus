import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveSeedChannels,
  generatePlanetaryBiosphere,
} from '../src/world/life/PlanetaryBiosphere';
import { bodyProfile, SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import { generateSystem } from '../src/world/celestial/SystemGenerator';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { GeneratedStar } from '../src/world/celestial/StarSector';

const mockEarth: CelestialBody = {
  id: 'earth',
  name: 'Terra',
  frameId: 'earth-frame',
  equatorialRadiusM: 6378137,
  polarRadiusM: 6356752,
  massKg: 5.972e24,
};

const mockMoon: CelestialBody = {
  id: 'moon',
  name: 'Lua',
  frameId: 'moon-frame',
  equatorialRadiusM: 1737400,
  massKg: 7.342e22,
};

const mockMars: CelestialBody = {
  id: 'mars',
  name: 'Marte',
  frameId: 'mars-frame',
  equatorialRadiusM: 3389500,
  massKg: 6.417e23,
};

const mockSun: CelestialBody = {
  id: 'sun',
  name: 'Sol',
  frameId: 'sun-frame',
  equatorialRadiusM: 6.9634e8,
  massKg: 1.98847e30,
};

test('T_VIVO01_01_INDEPENDENT_SEED_CHANNELS', () => {
  const seeds1 = deriveSeedChannels('planet_alpha');
  const seeds2 = deriveSeedChannels('planet_alpha');
  const seeds3 = deriveSeedChannels('planet_beta');

  // Exact reproducibility
  assert.deepEqual(seeds1, seeds2, 'Channels must be strictly reproducible for same body ID');

  // Channels within a body must be distinct
  const channelValues = [
    seeds1.rootSeed,
    seeds1.climateSeed,
    seeds1.lifeSeed,
    seeds1.floraSeed,
    seeds1.faunaSeed,
    seeds1.factionSeed,
  ];
  const uniqueChannels = new Set(channelValues);
  assert.equal(uniqueChannels.size, channelValues.length, 'Each channel must have an orthogonal, unique seed');

  // Distinct bodies produce distinct channels
  assert.notEqual(seeds1.rootSeed, seeds3.rootSeed, 'Different body IDs must produce different root seeds');
  assert.notEqual(seeds1.lifeSeed, seeds3.lifeSeed, 'Different body IDs must produce different life seeds');
});

test('T_VIVO01_02_CANONICAL_SOLAR_PROFILES', () => {
  const earthBio = generatePlanetaryBiosphere(mockEarth, SOLAR_BODY_PROFILES.earth);
  assert.equal(earthBio.lifeTier, 'civilized', 'Earth must harbor civilized life');
  assert.equal(earthBio.biochemistry, 'carbon-water');
  assert.equal(earthBio.habitabilityScore, 1.0);
  assert.equal(earthBio.dominantVegetationType, 'chlorophyll-broadleaf');
  assert.equal(earthBio.dominantFaunaType, 'bipedal-predators');
  assert.equal(earthBio.civilizationStage, 'advanced-industrial');
  assert.equal(earthBio.atmosphereBreathability, 'breathable');
  assert.equal(earthBio.radiationLevel, 'negligible');

  const moonBio = generatePlanetaryBiosphere(mockMoon, SOLAR_BODY_PROFILES.moon);
  assert.equal(moonBio.lifeTier, 'sterile', 'Moon must be sterile');
  assert.equal(moonBio.biochemistry, 'none');
  assert.equal(moonBio.habitabilityScore, 0.0);
  assert.equal(moonBio.atmosphereBreathability, 'vacuum-sealed-suit');

  const marsBio = generatePlanetaryBiosphere(mockMars, SOLAR_BODY_PROFILES.mars);
  assert.equal(marsBio.lifeTier, 'microbial', 'Mars has subsurface microbial extremophiles');
  assert.ok(marsBio.habitabilityScore > 0 && marsBio.habitabilityScore < 0.3);
  assert.equal(marsBio.atmosphereBreathability, 'toxic-respirator-required');

  const sunBio = generatePlanetaryBiosphere(mockSun, SOLAR_BODY_PROFILES.sun);
  assert.equal(sunBio.lifeTier, 'sterile');
  assert.equal(sunBio.radiationLevel, 'lethal-cosmic');
});

test('T_VIVO01_03_PROCEDURAL_DETERMINISM_AND_INVARIANCE', () => {
  const mockProcedural: CelestialBody = {
    id: 'MW_SEC_0_0_0_SYS_42_P_1',
    name: 'Kepler-186f',
    frameId: 'kepler-frame',
    equatorialRadiusM: 7000000,
    massKg: 6e24,
  };

  const bioA = generatePlanetaryBiosphere(mockProcedural, undefined, 0x12345678n);
  const bioB = generatePlanetaryBiosphere(mockProcedural, undefined, 0x12345678n);
  assert.deepEqual(bioA, bioB, 'Procedural biosphere must be 100% deterministic');

  // Changing system seed alters the resulting biosphere deterministically
  const bioC = generatePlanetaryBiosphere(mockProcedural, undefined, 0x98765432n);
  assert.notEqual(bioA.seeds.rootSeed, bioC.seeds.rootSeed);
});

test('T_VIVO01_04_SYSTEM_GENERATOR_ATTACHMENT', () => {
  const star: GeneratedStar = {
    id: 'test_star_bio',
    name: 'G-Type Test Star',
    positionLightYears: [0, 0, 0],
    spectralClass: 'G',
    temperatureK: 5778,
    luminositySolar: 1.0,
    massSolar: 1.0,
    color: '#fff5ea',
    apparentMagnitude: 4.8,
    planetCount: 4,
  };

  const system = generateSystem('test_star_bio', 0x44524d414e415553n, star);
  assert.ok(system.bodies.length >= 4, 'System must contain bodies');

  // Verify that solid planets and moons receive a valid biosphere profile
  let solidBodiesChecked = 0;
  for (const body of system.bodies) {
    if (body.profile?.environment) {
      assert.ok(body.profile.environment.biosphere, `Body ${body.id} must have biosphere attached`);
      assert.equal(body.profile.environment.biosphere.schemaVersion, 1);
      assert.ok(body.profile.environment.biosphere.seeds.lifeSeed !== undefined);
      solidBodiesChecked++;
    }
  }

  assert.ok(solidBodiesChecked >= 4, 'At least 4 system bodies must have verified biospheres');
});

test('T_VIVO01_05_BODY_PROFILE_LAZY_ATTACHMENT', () => {
  const pEarth = bodyProfile(mockEarth);
  assert.ok(pEarth.environment?.biosphere, 'bodyProfile(earth) must lazily resolve biosphere');
  assert.equal(pEarth.environment.biosphere.lifeTier, 'civilized');

  const pMoon = bodyProfile(mockMoon);
  assert.ok(pMoon.environment?.biosphere, 'bodyProfile(moon) must lazily resolve biosphere');
  assert.equal(pMoon.environment.biosphere.lifeTier, 'sterile');
});
