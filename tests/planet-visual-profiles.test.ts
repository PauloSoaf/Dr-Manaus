import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlanetVisualProfile } from '../src/world/celestial/PlanetVisualProfile';
import { resolveRendererProfile } from '../src/rendering/celestial/CelestialBodyVisualLayer';
import type { CelestialBodyProfile } from '../src/world/celestial/CelestialBodyProfile';

test('T_PLANET_PROFILE_01_SOLAR_COVERAGE', () => {
  const bodies = [
    { id: 'sun', surfaceType: 'star' },
    { id: 'mercury', surfaceType: 'rocky' },
    { id: 'venus', surfaceType: 'rocky' },
    { id: 'earth', surfaceType: 'rocky' },
    { id: 'moon', surfaceType: 'rocky' },
    { id: 'mars', surfaceType: 'rocky' },
    { id: 'jupiter', surfaceType: 'gas' },
    { id: 'saturn', surfaceType: 'gas' },
    { id: 'uranus', surfaceType: 'ice' },
    { id: 'neptune', surfaceType: 'ice' },
  ];

  for (const b of bodies) {
    const profile = getPlanetVisualProfile(b.id);
    assert.equal(profile.bodyId, b.id);
    assert.equal(profile.surfaceType, b.surfaceType, `Body ${b.id} must have surfaceType ${b.surfaceType}`);
    assert.ok(profile.albedo.length === 3, `Body ${b.id} must have 3-component albedo`);
  }
});

test('T_PLANET_PROFILE_02_SATURN_RINGS', () => {
  const saturn = getPlanetVisualProfile('saturn');
  assert.ok(saturn.rings, 'Saturn must have rings');
  assert.equal(saturn.rings.hasRings, true);
  assert.ok(saturn.rings.innerRadiusM > 50_000_000, 'Ring inner radius in millions of metres');
  assert.ok(saturn.rings.outerRadiusM > saturn.rings.innerRadiusM, 'Ring outer radius > inner radius');
  assert.equal(saturn.rings.innerRadiusScale, 1.25);
  assert.equal(saturn.rings.outerRadiusScale, 2.3);
});

test('T_PLANET_PROFILE_03_ATMOSPHERE_AND_TERRAIN', () => {
  const earth = getPlanetVisualProfile('earth');
  assert.equal(earth.atmosphere.hasAtmosphere, true);
  assert.equal(earth.terrain.hasSolidSurface, true);
  assert.equal(earth.terrain.canLand, true);
  assert.equal(earth.terrain.landingMode, 'surface');
  assert.equal(earth.terrain.surfaceKind, 'earth');
  assert.equal(earth.terrain.maxElevationM, 8_848);
  assert.equal(earth.terrain.minElevationM, -11_034);

  const moon = getPlanetVisualProfile('moon');
  assert.equal(moon.atmosphere.hasAtmosphere, false);
  assert.equal(moon.terrain.surfaceKind, 'moon');
  assert.equal(moon.terrain.canLand, true);

  const mars = getPlanetVisualProfile('mars');
  assert.equal(mars.atmosphere.hasAtmosphere, true);
  assert.equal(mars.terrain.surfaceKind, 'mars');
  assert.equal(mars.terrain.maxElevationM, 21_287);
});

test('T_PLANET_PROFILE_04_GAS_GIANTS_CANNOT_LAND', () => {
  const jupiter = getPlanetVisualProfile('jupiter');
  assert.equal(jupiter.terrain.canLand, false);
  assert.equal(jupiter.terrain.hasSolidSurface, false);
  assert.equal(jupiter.terrain.landingMode, 'none');

  const sun = getPlanetVisualProfile('sun');
  assert.equal(sun.terrain.hasSolidSurface, false);
  assert.equal(sun.terrain.canLand, true);
  assert.equal(sun.terrain.landingMode, 'photosphere');
});

test('T_PLANET_PROFILE_05_PROCEDURAL_VISUAL_DIVERSITY_IS_PRESERVED', () => {
  const makeSource = (albedo: [number, number, number], rings?: { innerRadius: number; outerRadius: number }): CelestialBodyProfile => ({
    bodyClass: 'rocky',
    hasSolidSurface: true,
    canLand: true,
    landingMode: 'surface',
    hasAtmosphere: false,
    supportsVolumeDestruction: true,
    surfaceKind: 'synthetic-base',
    visual: { albedo, rings, bands: 3, pointBrightness: 0.8 },
  });
  const procedural = [
    resolveRendererProfile('milky-way-proc-a', makeSource([0.8, 0.2, 0.1])),
    resolveRendererProfile('milky-way-proc-b', makeSource([0.1, 0.7, 0.3], { innerRadius: 1.2, outerRadius: 2.1 })),
    resolveRendererProfile('andromeda-proc-a', makeSource([0.2, 0.3, 0.9])),
  ];

  assert.deepEqual(procedural.map(profile => profile.visual.albedo), [
    [0.8, 0.2, 0.1],
    [0.1, 0.7, 0.3],
    [0.2, 0.3, 0.9],
  ]);
  assert.deepEqual(procedural[1].visual.rings, { innerRadius: 1.2, outerRadius: 2.1 });
  assert.equal(procedural[0].visual.bands, 3);
});

