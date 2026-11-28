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


test('T_EARTH_SURFACE_05_TILE_SURFACE_CLASS_ATTRIBUTE_AND_SHALLOW_WATER', async () => {
  const { buildTileMesh } = await import('../src/world/planet/EarthGlobe');
  const { tileContaining } = await import('../src/world/planet/PlanetTileAddress');

  const manausTile = tileContaining(
    'earth',
    { latRad: -3.119 * DEG_TO_RAD, lonRad: -60.021 * DEG_TO_RAD, heightM: 0 },
    7,
  );
  const mesh = buildTileMesh(manausTile);
  const surfaceClassAttr = mesh.geometry.getAttribute('surfaceClass');
  assert.ok(surfaceClassAttr, 'EarthGlobe tile mesh must carry surfaceClass attribute');
  assert.equal(surfaceClassAttr.itemSize, 1);

  const classes = new Set<number>();
  for (let i = 0; i < surfaceClassAttr.count; i++) {
    classes.add(surfaceClassAttr.getX(i));
  }
  assert.ok(
    classes.has(EarthSurfaceClass.Urban) || classes.has(EarthSurfaceClass.Land),
    'Manaus region tile must classify Urban/Land vertices',
  );

  // Scan along the equatorial Atlantic coast (-50°W to -45°W) to find a coastal shelf transition
  let foundShallow = false;
  for (let lonDeg = -52; lonDeg <= -44; lonDeg += 0.25) {
    if (classifyEarthSurface(0.5 * DEG_TO_RAD, lonDeg * DEG_TO_RAD) === EarthSurfaceClass.ShallowWater) {
      foundShallow = true;
      const shallowCol: [number, number, number] = [0, 0, 0];
      surfaceColour(0.5 * DEG_TO_RAD, lonDeg * DEG_TO_RAD, shallowCol);
      assert.deepEqual(shallowCol, [...SURFACE_COLOURS.shallow], 'ShallowWater must use shallow shelf palette');
      break;
    }
  }
  assert.ok(foundShallow, 'Coastal shelf scan must identify ShallowWater');
});


test('T_EARTH_SURFACE_06_HIERARCHICAL_SUBGRID_RELIEF_AT_HIGH_LOD', async () => {
  const {
    EARTH_MAX_ELEVATION_M,
    hierarchicalElevationAt,
    surfaceHeightAt,
  } = await import('../src/world/planet/EarthElevation');

  // Andes cordillera sample: -15.5° S, -70.0° W
  const andesLat = -15.5 * DEG_TO_RAD;
  const andesLon = -70.0 * DEG_TO_RAD;
  const baseElevation = surfaceHeightAt(andesLat, andesLon);
  assert.ok(baseElevation > 1500, 'Andes base elevation must be mountain-scale');

  // Coarse LOD (0..5) must equal base ETOPO5 elevation
  for (let lod = 0; lod <= 5; lod++) {
    assert.equal(
      hierarchicalElevationAt(andesLat, andesLon, lod),
      baseElevation,
      `LOD ${lod} must match canonical ETOPO5 surfaceHeightAt`,
    );
  }

  // High LOD (6..10) must add deterministic multi-scale detail within bounds
  const lod8A = hierarchicalElevationAt(andesLat, andesLon, 8);
  const lod8B = hierarchicalElevationAt(andesLat, andesLon, 8);
  assert.equal(lod8A, lod8B, 'Hierarchical elevation at LOD 8 must be deterministic');
  assert.notEqual(lod8A, baseElevation, 'High-LOD relief must add sub-grid micro-topography on continental land');
  assert.ok(lod8A >= 0 && lod8A <= EARTH_MAX_ELEVATION_M, 'High-LOD relief must stay within [0, EARTH_MAX_ELEVATION_M]');

  // Ocean and Manaus Urban must remain 0 even at high LOD
  assert.equal(hierarchicalElevationAt(0, -30 * DEG_TO_RAD, 10), 0, 'Ocean must have 0 relief at LOD 10');
  assert.equal(
    hierarchicalElevationAt(-3.119 * DEG_TO_RAD, -60.021 * DEG_TO_RAD, 10),
    0,
    'Manaus Urban must remain flat on the ellipsoid at LOD 10 so local city meshes match',
  );
});
