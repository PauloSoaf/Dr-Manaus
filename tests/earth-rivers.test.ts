import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { EarthRiverLayer, EARTH_RIVERS, EARTH_RIVER_METADATA } from '../src/world/planet/EarthRiverLayer.ts';
import { SOURCES, computeSha256, verifySourceChecksums, compileRivers, extractFeatureLines, simplifyLineRDP } from '../scripts/geodata/build-earth-rivers.mjs';

test('T_RIVER_COMPILER_READS_REAL_SOURCE', () => {
  // Source files must physically exist in scripts/geodata/sources/
  assert.ok(existsSync(SOURCES.ne10m.path), `10m source file must exist: ${SOURCES.ne10m.path}`);
  assert.ok(existsSync(SOURCES.ne50m.path), `50m source file must exist: ${SOURCES.ne50m.path}`);
});

test('T_RIVER_SOURCE_CHECKSUM_VERIFIED', () => {
  // Checksums of bundled authentic Natural Earth datasets must match exact expected upstream hashes
  const buf10m = readFileSync(SOURCES.ne10m.path);
  const hash10m = computeSha256(buf10m);
  assert.equal(hash10m, SOURCES.ne10m.sha256, '10m GeoJSON checksum must match upstream');

  const buf50m = readFileSync(SOURCES.ne50m.path);
  const hash50m = computeSha256(buf50m);
  assert.equal(hash50m, SOURCES.ne50m.sha256, '50m GeoJSON checksum must match upstream');

  // Helper must not throw
  assert.doesNotThrow(() => verifySourceChecksums());
});

test('T_RIVER_COMPILER_DETERMINISTIC', () => {
  const result1 = compileRivers();
  const result2 = compileRivers();
  assert.deepEqual(result1, result2, 'Compiling twice must produce identical results');
});

test('T_RIVER_OUTPUT_NOT_HANDWRITTEN_PATHS', () => {
  const amazon = EarthRiverLayer.getAmazonMainStem();
  assert.ok(amazon);
  // Authentic 10m Natural Earth Amazon has 675 vertices, definitely not a handwritten 22-point stub
  assert.ok(amazon.coordinates.length > 500, `Amazon must have authentic dense points from 10m dataset, got ${amazon.coordinates.length}`);
  // Points must have floating point precision from GIS coordinates
  assert.ok(amazon.coordinates.some(([lon, lat]) => Math.abs(lon - Math.round(lon)) > 0.0001));
});

test('T_RIVER_FEATURES_TRACE_TO_SOURCE', () => {
  const raw10m = JSON.parse(readFileSync(SOURCES.ne10m.path, 'utf8'));
  const names10m = new Set(raw10m.features.map((f: any) => f.properties?.name).filter(Boolean));

  // Amazon, Negro, Madeira, Tapajós, Xingu, Purús, Juruá must all trace to real 10m features
  assert.ok(names10m.has('Amazonas'));
  assert.ok(names10m.has('Negro'));
  assert.ok(names10m.has('Madeira'));
  assert.ok(names10m.has('Tapajós') || names10m.has('Tapajos'));
  assert.ok(names10m.has('Xingu'));
  assert.ok(names10m.has('Purús') || names10m.has('Purus'));
});

test('T_AMAZON_HAS_AUTHENTIC_CENTERLINE', () => {
  const amazon = EarthRiverLayer.getAmazonMainStem();
  assert.ok(amazon);
  assert.equal(amazon.name, 'Rio Amazonas / Solimões');
  assert.equal(amazon.basin, 'Amazon');
  assert.equal(amazon.continent, 'South America');
  assert.equal(amazon.tier, 'main');
  assert.ok(amazon.coordinates.length >= 600, 'Authentic 10m Amazon has >= 600 points');

  // Verify headwaters in Peruvian Andes (~ -73.48°) and Atlantic mouth (~ -52.71°)
  const lons = amazon.coordinates.map(pt => pt[0]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  assert.ok(minLon < -73.0, `Min lon should reach western Amazon headwaters < -73°, got ${minLon}`);
  assert.ok(maxLon > -53.0, `Max lon should reach eastern Atlantic mouth > -53°, got ${maxLon}`);
});

test('T_RIO_NEGRO_HAS_AUTHENTIC_CENTERLINE', () => {
  const negro = EarthRiverLayer.getRioNegro();
  assert.ok(negro);
  assert.equal(negro.name, 'Rio Negro');
  assert.equal(negro.basin, 'Amazon');
  assert.ok(negro.coordinates.length >= 400, `Authentic 10m Rio Negro has >= 400 points, got ${negro.coordinates.length}`);

  // Rio Negro flows from Colombia/northwest down to Manaus (-60.02°, -3.13°)
  const lats = negro.coordinates.map(pt => pt[1]);
  assert.ok(Math.max(...lats) > 1.0, 'Rio Negro originates north of equator');
  assert.ok(Math.min(...lats) < -3.0, 'Rio Negro reaches confluence south of -3°');
});

test('T_RIVER_LOD_PRESERVES_SHAPE', () => {
  const amazon = EarthRiverLayer.getAmazonMainStem();
  assert.ok(amazon && amazon.lod0Coordinates);
  assert.ok(amazon.lod0Coordinates.length > 20 && amazon.lod0Coordinates.length < amazon.coordinates.length);

  // Endpoints must be strictly preserved by RDP simplification
  assert.deepEqual(amazon.lod0Coordinates[0], amazon.coordinates[0]);
  assert.deepEqual(amazon.lod0Coordinates[amazon.lod0Coordinates.length - 1], amazon.coordinates[amazon.coordinates.length - 1]);
});

test('T_RIVER_LONGITUDE_LATITUDE_VALID', () => {
  for (const river of EARTH_RIVERS) {
    for (const [lon, lat] of river.coordinates) {
      assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180, `Invalid longitude ${lon} in river ${river.id}`);
      assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90, `Invalid latitude ${lat} in river ${river.id}`);
    }
  }
});

test('T_RIVER_GEOJSON_MULTILINE_HANDLING', () => {
  // Mock MultiLineString feature
  const mockMulti = {
    type: 'Feature',
    properties: { name: 'TestRiver' },
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [[-60.0, -3.0], [-59.0, -2.5]],
        [[-59.0, -2.5], [-58.0, -2.0]],
      ],
    },
  };
  const lines = extractFeatureLines(mockMulti);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].length, 2);
  assert.equal(lines[1].length, 2);
  assert.deepEqual(lines[0][0], [-60.0, -3.0]);
});

test('T_NO_RUNTIME_GEODATA_REQUEST', () => {
  // EarthRiverLayer must be completely synchronous, offline, and require no runtime fetch
  assert.equal(EarthRiverLayer.presentationOnly, true);
  assert.ok(Array.isArray(EarthRiverLayer.allRivers));
  assert.ok(EarthRiverLayer.allRivers.length >= 10);
});
