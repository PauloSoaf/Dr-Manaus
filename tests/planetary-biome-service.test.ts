import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PlanetaryBiomeService, type PlanetaryBiomeType } from '../src/world/life/PlanetaryBiomeService';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';

describe('PlanetaryBiomeService (VIVO-02)', () => {
  const earthBody: CelestialBody = {
    id: 'earth',
    name: 'Terra',
    frameId: 'earth-frame',
    equatorialRadiusM: 6378137,
    polarRadiusM: 6356752,
    massKg: 5.972e24,
  };
  const earthBiosphere = generatePlanetaryBiosphere(earthBody, SOLAR_BODY_PROFILES.earth, 1337n);

  const moonBody: CelestialBody = {
    id: 'moon',
    name: 'Lua',
    frameId: 'moon-frame',
    equatorialRadiusM: 1737400,
    massKg: 7.342e22,
  };
  const moonBiosphere = generatePlanetaryBiosphere(moonBody, SOLAR_BODY_PROFILES.moon, 1337n);

  const titanBody: CelestialBody = {
    id: 'titan',
    name: 'Titã',
    frameId: 'titan-frame',
    equatorialRadiusM: 2574700,
    massKg: 1.345e23,
  };
  const titanBiosphere = generatePlanetaryBiosphere(titanBody, SOLAR_BODY_PROFILES.titan, 1337n);

  it('T_VIVO02_01: Sample is strictly deterministic and obeys latitudinal/altitude thermodynamics', () => {
    // 1. Determinism
    const sampleA1 = PlanetaryBiomeService.sampleBiome({
      biosphere: earthBiosphere,
      latRad: 0.0, // Equator
      lonRad: 0.5,
      altitudeM: 100,
      seaLevelM: 0,
    });
    const sampleA2 = PlanetaryBiomeService.sampleBiome({
      biosphere: earthBiosphere,
      latRad: 0.0,
      lonRad: 0.5,
      altitudeM: 100,
      seaLevelM: 0,
    });
    assert.deepStrictEqual(sampleA1, sampleA2, 'Identical coordinates must yield strictly identical samples');

    // 2. Latitude gradient: Equator is significantly warmer than Pole
    const poleSample = PlanetaryBiomeService.sampleBiome({
      biosphere: earthBiosphere,
      latRad: Math.PI / 2, // North Pole
      lonRad: 0.5,
      altitudeM: 100,
      seaLevelM: 0,
    });
    assert.ok(
      sampleA1.temperatureK > poleSample.temperatureK + 30,
      `Equator (${sampleA1.temperatureK.toFixed(1)}K) must be warmer than pole (${poleSample.temperatureK.toFixed(1)}K) by >30K`,
    );

    // 3. Altitude lapse rate: Higher altitude is colder than sea level
    const mountainSample = PlanetaryBiomeService.sampleBiome({
      biosphere: earthBiosphere,
      latRad: 0.0,
      lonRad: 0.5,
      altitudeM: 4000, // 4 km mountain
      seaLevelM: 0,
    });
    assert.ok(
      sampleA1.temperatureK > mountainSample.temperatureK + 15,
      `Sea-level (${sampleA1.temperatureK.toFixed(1)}K) must be warmer than mountain (${mountainSample.temperatureK.toFixed(1)}K)`,
    );
  });

  it('T_VIVO02_02: Aquatic depth stratification correctly identifies ocean layers', () => {
    // Coastal
    const coastal = PlanetaryBiomeService.sampleBiome({
      biosphere: earthBiosphere,
      latRad: 0.2,
      lonRad: 0.1,
      altitudeM: -15, // 15m depth
      seaLevelM: 0,
    });
    assert.strictEqual(coastal.isUnderwater, true);
    assert.strictEqual(coastal.biomeId, 'coastal-waters');
    assert.strictEqual(coastal.moisture, 1.0);

    // Oceanic shelf
    const shelf = PlanetaryBiomeService.sampleBiome({
      biosphere: earthBiosphere,
      latRad: 0.2,
      lonRad: 0.1,
      altitudeM: -100, // 100m depth
      seaLevelM: 0,
    });
    assert.strictEqual(shelf.isUnderwater, true);
    assert.strictEqual(shelf.biomeId, 'oceanic-shelf');

    // Deep abyss
    const abyss = PlanetaryBiomeService.sampleBiome({
      biosphere: earthBiosphere,
      latRad: 0.2,
      lonRad: 0.1,
      altitudeM: -3000, // 3000m depth
      seaLevelM: 0,
    });
    assert.strictEqual(abyss.isUnderwater, true);
    assert.strictEqual(abyss.biomeId, 'deep-abyss');
    assert.strictEqual(abyss.vegetationDensity, 0.0);
  });

  it('T_VIVO02_03: Sterile worlds enforce zero vegetation and geological biomes', () => {
    const moonSample = PlanetaryBiomeService.sampleBiome({
      biosphere: moonBiosphere,
      latRad: 0.1,
      lonRad: 0.2,
      altitudeM: 2000,
      seaLevelM: 0,
    });

    assert.strictEqual(moonSample.vegetationDensity, 0.0, 'Sterile world must have zero vegetation density');
    assert.strictEqual(moonSample.floraArchetype, 'none', 'Sterile world must have floraArchetype none');
    assert.ok(
      ['cratered-highlands', 'basalt-plains', 'barren-rock', 'vacuum-dust'].includes(moonSample.biomeId),
      `Expected sterile moon biome, got ${moonSample.biomeId}`,
    );
  });

  it('T_VIVO02_04: Cryogenic methane world (Titan) assigns cryogenic biomes', () => {
    // Underwater methane sea
    const methaneSea = PlanetaryBiomeService.sampleBiome({
      biosphere: titanBiosphere,
      latRad: 1.2, // northern polar sea (Kraken Mare latitude)
      lonRad: 0.5,
      altitudeM: -50,
      seaLevelM: 0,
    });
    assert.strictEqual(methaneSea.biomeId, 'methane-sea');
    assert.strictEqual(methaneSea.isUnderwater, true);

    // Land tholin / cryo terrain
    const titanLand = PlanetaryBiomeService.sampleBiome({
      biosphere: titanBiosphere,
      latRad: 0.1,
      lonRad: 0.2,
      altitudeM: 1200,
      seaLevelM: 0,
    });
    assert.ok(
      ['tholin-plateaus', 'cryo-dunes', 'nitrogen-plains'].includes(titanLand.biomeId),
      `Expected cryogenic land biome on Titan, got ${titanLand.biomeId}`,
    );
  });

  it('T_VIVO02_05: Habitable worlds support Whittaker matrix flora and color palettes', () => {
    // Equatorial rain belt
    const rainforest = PlanetaryBiomeService.sampleBiome({
      biosphere: earthBiosphere,
      latRad: 0.05,
      lonRad: -1.0,
      altitudeM: 50,
      seaLevelM: 0,
    });
    assert.ok(rainforest.vegetationDensity > 0.4, 'Rainforest must have dense vegetation (>0.4)');
    assert.strictEqual(rainforest.floraArchetype, 'canopy-broadleaf');
    assert.strictEqual(rainforest.biomeId, 'alien-rainforest');

    // Polar ice cap
    const polarCap = PlanetaryBiomeService.sampleBiome({
      biosphere: earthBiosphere,
      latRad: 1.5, // ~86 deg latitude
      lonRad: 0.0,
      altitudeM: 200,
      seaLevelM: 0,
    });
    assert.strictEqual(polarCap.biomeId, 'glacial-cap');
    assert.strictEqual(polarCap.vegetationDensity, 0.0);

    // Every biome definition provides non-empty strings and valid colors
    const allBiomeKeys: PlanetaryBiomeType[] = [
      'deep-abyss', 'oceanic-shelf', 'coastal-waters', 'methane-sea', 'ammonia-basin',
      'barren-rock', 'cratered-highlands', 'basalt-plains', 'vacuum-dust', 'extreme-cryo-ice',
      'magma-fields', 'sulfuric-wastes', 'scorched-crags', 'crystal-desert',
      'tholin-plateaus', 'cryo-dunes', 'nitrogen-plains',
      'alien-rainforest', 'fungal-canopy', 'bioluminescent-wetlands', 'temperate-woodland',
      'savanna-steppe', 'alien-taiga', 'subpolar-lichen', 'glacial-cap',
    ];

    for (const b of allBiomeKeys) {
      const def = PlanetaryBiomeService.getBiomeDefinition(b);
      assert.ok(def, `Definition for ${b} must exist`);
      assert.ok(def.displayName.length > 0, `Display name for ${b} must not be empty`);
      assert.ok(typeof def.palette.surface === 'number', `Palette surface for ${b} must be a number`);
      assert.ok(typeof def.palette.rock === 'number', `Palette rock for ${b} must be a number`);
      assert.ok(typeof def.palette.foliage === 'number', `Palette foliage for ${b} must be a number`);
      assert.ok(typeof def.palette.liquid === 'number', `Palette liquid for ${b} must be a number`);
    }
  });

  it('T_VIVO02_06: Procedural surface generator integrates biome sampling', async () => {
    const { createProceduralPlanetSurface } = await import('../src/world/planet/ProceduralPlanetSurface');
    const { planetBodyFromCelestial } = await import('../src/world/planet/PlanetBodyAdapter');

    const testBody: CelestialBody = {
      id: 'exo_eden',
      name: 'Eden Prime',
      frameId: 'eden-frame',
      equatorialRadiusM: 5800000,
      polarRadiusM: 5800000,
      massKg: 4.8e24,
      profile: {
        bodyClass: 'rocky',
        surfaceKind: 'procedural',
        hasSolidSurface: true,
        canLand: true,
        landingMode: 'surface',
        hasAtmosphere: true,
        visual: { albedo: [0.3, 0.5, 0.3] },
        environment: {
          classification: 'oceanic-rocky',
          temperatureK: 295,
          atmosphericPressureAtm: 1.1,
          biosphere: earthBiosphere,
        },
      },
    };

    const model = planetBodyFromCelestial(testBody);
    const surface = createProceduralPlanetSurface(testBody, model, testBody.profile!);

    assert.ok(typeof surface.biomeAt === 'function', 'Procedural surface with biosphere must expose biomeAt function');

    const sampleEquator = surface.biomeAt([1, 0, 0]);
    assert.ok(sampleEquator, 'Sample at equator direction must return valid sample');
    assert.ok(sampleEquator.temperatureK > 270, 'Equator sample must have realistic temperature');
    assert.ok(typeof sampleEquator.biomeId === 'string');

    const samplePole = surface.biomeAt([0, 0, 1]);
    assert.ok(samplePole, 'Sample at pole direction must return valid sample');
    assert.ok(sampleEquator.temperatureK > samplePole.temperatureK, 'Equator must be warmer than pole on procedural surface');
  });
});
