import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { EarthRiverLayer, EARTH_RIVERS, EARTH_RIVER_METADATA } from '../src/world/planet/EarthRiverLayer.ts';

test('T_EARTH_RIVER_SOURCE_HAS_PROVENANCE', () => {
  // Source attribution exists and declares Natural Earth public domain
  assert.equal(EARTH_RIVER_METADATA.source, 'Natural Earth 1:110m / 1:50m Rivers & Lake Centerlines');
  assert.equal(EARTH_RIVER_METADATA.licence.toLowerCase(), 'public domain');
  assert.ok(EARTH_RIVER_METADATA.homepage.includes('naturalearthdata.com'));

  // Check public ATTRIBUTION.txt has entry for Natural Earth rivers
  const attributionPath = 'public/geodata/ATTRIBUTION.txt';
  assert.ok(existsSync(attributionPath), 'ATTRIBUTION.txt must exist');
  const attributionText = readFileSync(attributionPath, 'utf8');
  assert.ok(attributionText.includes('Natural Earth'), 'ATTRIBUTION.txt must credit Natural Earth');
  assert.ok(attributionText.includes('Public Domain'), 'ATTRIBUTION.txt must note Public Domain licence');
});

test('T_EARTH_AMAZON_NOT_INVENTED', () => {
  const amazon = EarthRiverLayer.getAmazonMainStem();
  assert.ok(amazon, 'Amazon main stem must be defined in dataset');
  assert.equal(amazon.name, 'Rio Amazonas / Solimões');
  assert.equal(amazon.basin, 'Amazon');
  assert.equal(amazon.continent, 'South America');
  assert.equal(amazon.tier, 'main');

  // Verify coordinates are realistic, non-trivial, and have enough fidelity
  assert.ok(amazon.coordinates.length >= 20, `Amazon should have at least 20 vertices, got ${amazon.coordinates.length}`);
  for (const pt of amazon.coordinates) {
    const [lon, lat] = pt;
    assert.ok(lon >= -80 && lon <= -45, `Longitude ${lon} should be within South American Amazon basin`);
    assert.ok(lat >= -15 && lat <= 5, `Latitude ${lat} should be within Amazon equatorial band`);
  }
});

test('T_EARTH_AMAZON_CROSSES_SOUTH_AMERICA', () => {
  const amazon = EarthRiverLayer.getAmazonMainStem();
  assert.ok(amazon);
  const headwaters = amazon.coordinates[0];
  const mouth = amazon.coordinates[amazon.coordinates.length - 1];

  // Headwaters in Peruvian/Colombian Andes (west, ~ -73°)
  assert.ok(headwaters[0] < -70, `Headwaters longitude should be west of -70°, got ${headwaters[0]}`);

  // River flows eastward across South America to Atlantic ocean (east, ~ -50°)
  assert.ok(mouth[0] > -52, `Mouth longitude should be east of -52°, got ${mouth[0]}`);

  // Longitude strictly increases overall (eastward flow)
  assert.ok(mouth[0] > headwaters[0], 'River must flow from west to east');

  // Also check Rio Negro tributary exists and connects near Manaus
  const rioNegro = EarthRiverLayer.getRioNegro();
  assert.ok(rioNegro, 'Rio Negro tributary must exist in dataset');
  assert.equal(rioNegro.basin, 'Amazon');
  // Near confluence with Amazon at Manaus (lon ~ -60.0°, lat ~ -3.1°)
  const nearManaus = rioNegro.coordinates.some(([lon, lat]) => Math.hypot(lon - (-60.0), lat - (-3.1)) < 2.0);
  assert.ok(nearManaus, 'Rio Negro vertices must include the Manaus confluence region');
});

test('T_EARTH_RIVER_LAYER_PRESENTATION_ONLY', () => {
  // Pure presentation layer contract: no colliders, no physics bodies, no damage voxels
  assert.equal(EarthRiverLayer.presentationOnly, true);
  assert.equal('colliders' in EarthRiverLayer, false);
  assert.equal('physics' in EarthRiverLayer, false);
  assert.equal('volume' in EarthRiverLayer, false);

  // LOD filtering works deterministically
  const far = EarthRiverLayer.getRiversForLOD('far');
  const medium = EarthRiverLayer.getRiversForLOD('medium');
  assert.ok(far.length > 0);
  assert.ok(medium.length >= far.length);
  assert.ok(far.every(r => r.tier === 'main'));
});
