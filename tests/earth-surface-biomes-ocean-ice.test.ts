import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyEarthSurface,
  EarthSurfaceClass,
  isLandAt,
  surfaceColour,
  SURFACE_COLOURS,
} from '../src/world/planet/EarthLandMask';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface';
import { DEG_TO_RAD, type Vec3 } from '../src/world/spatial/units';

test('T_EARTH_SURFACE_01_CLASSIFICATION_DETERMINISM', () => {
  const latRad = -3.119 * DEG_TO_RAD;
  const lonRad = -60.021 * DEG_TO_RAD;

  const first = classifyEarthSurface(latRad, lonRad);
  const second = classifyEarthSurface(latRad, lonRad);
  const third = classifyEarthSurface(latRad, lonRad);

  assert.equal(first, second, 'Classification must be deterministic');
  assert.equal(second, third, 'Repeated calls must yield identical results');
});

test('T_EARTH_SURFACE_02_REGIONAL_CLASSES', () => {
  // Amazon interior (rainforest): -3.0° S, -65.0° W
  const amazonClass = classifyEarthSurface(-3.0 * DEG_TO_RAD, -65.0 * DEG_TO_RAD);
  assert.equal(amazonClass, EarthSurfaceClass.Land, 'Amazon interior must classify as Land');

  // Atlantic Ocean: 0.0° N, -30.0° W
  const atlanticClass = classifyEarthSurface(0.0, -30.0 * DEG_TO_RAD);
  assert.equal(atlanticClass, EarthSurfaceClass.Ocean, 'Atlantic ocean must classify as Ocean');

  // Antarctica interior: -80.0° S, 0.0° E
  const antarcticaClass = classifyEarthSurface(-80.0 * DEG_TO_RAD, 0.0);
  assert.equal(antarcticaClass, EarthSurfaceClass.Ice, 'Antarctica interior must classify as Ice');

  // Greenland interior: 72.0° N, -40.0° W
  const greenlandClass = classifyEarthSurface(72.0 * DEG_TO_RAD, -40.0 * DEG_TO_RAD);
  assert.equal(greenlandClass, EarthSurfaceClass.Ice, 'Greenland ice sheet must classify as Ice');

  // Manaus anchor: -3.119° S, -60.021° W
  const manausClass = classifyEarthSurface(-3.119 * DEG_TO_RAD, -60.021 * DEG_TO_RAD);
  assert.equal(manausClass, EarthSurfaceClass.Urban, 'Manaus coverage area must classify as Urban');
});

test('T_EARTH_SURFACE_03_COLOUR_CONSISTENCY', () => {
  const colour: [number, number, number] = [0, 0, 0];

  // Manaus anchor colour
  surfaceColour(-3.119 * DEG_TO_RAD, -60.021 * DEG_TO_RAD, colour);
  assert.deepEqual(colour, [...SURFACE_COLOURS.urban], 'Manaus must render with urban palette');

  // Antarctica interior colour
  surfaceColour(-80.0 * DEG_TO_RAD, 0.0, colour);
  assert.deepEqual(colour, [...SURFACE_COLOURS.ice], 'Antarctica must render with ice palette');

  // Atlantic ocean colour
  surfaceColour(0.0, -30.0 * DEG_TO_RAD, colour);
  assert.deepEqual(colour, [...SURFACE_COLOURS.ocean], 'Deep Atlantic must render with ocean palette');

  // Amazon interior colour
  surfaceColour(-3.0 * DEG_TO_RAD, -65.0 * DEG_TO_RAD, colour);
  assert.deepEqual(colour, [...SURFACE_COLOURS.land], 'Equatorial Amazon land must render with lush green palette');
});

test('T_EARTH_SURFACE_04_SURFACE_ADAPTER_INTEGRATION', () => {
  // Test direction pointing towards Manaus: lat ~ -3.119°, lon ~ -60.021°
  const lat = -3.119 * DEG_TO_RAD;
  const lon = -60.021 * DEG_TO_RAD;
  const dir: Vec3 = [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];

  const manausClass = EarthSurfaceGenerator.classAt(dir);
  assert.equal(manausClass, EarthSurfaceClass.Urban, 'EarthSurfaceGenerator.classAt must identify Urban');

  const colour: [number, number, number] = [0, 0, 0];
  EarthSurfaceGenerator.colourAt(dir, colour);
  assert.deepEqual(colour, [...SURFACE_COLOURS.urban], 'EarthSurfaceGenerator.colourAt must match Urban palette');
});
