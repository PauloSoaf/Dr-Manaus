import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Group } from 'three/webgpu';
import { ManausAerialPresentation, manausAerialWeights, MANAUS_AERIAL } from '../src/rendering/ManausAerialPresentation.ts';
import type { WaterFile } from '../src/rendering/WaterSystem.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { EARTH_FIXED_FRAME_ID, MANAUS_FRAME_ID, MANAUS_ANCHOR_ECEF, legacyLocalToGeodetic } from '../src/world/spatial/ManausFrameAdapter.ts';
import { ecefToGeodetic } from '../src/world/spatial/ECEF.ts';
import { createRenderOrigin } from '../src/world/spatial/RenderOrigin.ts';
import { EarthRiverLayer } from '../src/world/planet/EarthRiverLayer.ts';

const read = (name: string) => JSON.parse(readFileSync(`public/geodata/real-city/${name}.json`, 'utf8'));
const water = read('water') as WaterFile;
const data = read('aerial');

const universe = new UniverseRuntime({ streaming: false });
const parent = new Group();
const aerial = new ManausAerialPresentation(parent, universe.frames, universe.renderSpace);
parent.name = 'planetary';
aerial.build(water, data);

test.after(() => {
  aerial.dispose();
  universe.dispose();
});

const update = (distM: number, altM = distM) => {
  universe.renderSpace.setOrigin(createRenderOrigin(MANAUS_FRAME_ID, [0, 0, 0]));
  aerial.update(altM, true, [0, distM, 0], Math.PI / 3, 900, [0, 1, 0]);
};

test('T_MANAUS_FAR_TIER_EXISTS', () => {
  assert.ok(aerial.ready, 'Aerial presentation must be ready');
  assert.ok(aerial.stats.triangles.far > 0, `Far tier triangles must be > 0, got ${aerial.stats.triangles.far}`);
  assert.equal(aerial.stats.physics, false, 'Far tier must never register physics colliders');
});

test('T_MANAUS_FAR_BODY_FIXED', () => {
  // Far marker is positioned in Earth-fixed frame at MANAUS_ANCHOR_ECEF
  const geo = ecefToGeodetic(MANAUS_ANCHOR_ECEF);
  const anchor = legacyLocalToGeodetic(0, 0, 0);
  assert.ok(Math.abs(geo.latRad - anchor.latRad) < 1e-6);
  assert.ok(Math.abs(geo.lonRad - anchor.lonRad) < 1e-6);
});

test('T_MANAUS_FAR_POINT_DOES_NOT_POP', () => {
  // Test smooth transition across distance range 80 km to 600 km
  let prevTotalOpacity = 1.0;
  for (let dist = 80000; dist <= 600000; dist += 10000) {
    const w = manausAerialWeights(dist, dist, Math.PI / 3, 900, true);
    const totalOpacity = Math.max(w.opacity, w.farOpacity);
    // Smoothness: total visibility should remain continuous without steep cliffs
    assert.ok(totalOpacity > 0.3, `Visibility dropped excessively at dist ${dist}: ${totalOpacity}`);
    const delta = Math.abs(totalOpacity - prevTotalOpacity);
    assert.ok(delta < 0.25, `Popping detected at dist ${dist}: delta=${delta}`);
    prevTotalOpacity = totalOpacity;
  }
});

test('T_MANAUS_VISIBLE_100KM', () => {
  update(100000);
  assert.ok(aerial.stats.visible, 'Manaus must be visible at 100 km');
  const effectiveOpacity = Math.max(aerial.stats.opacity, aerial.stats.farOpacity);
  assert.ok(effectiveOpacity > 0.9, `At 100 km, effective opacity should be > 0.9, got ${effectiveOpacity}`);
});

test('T_MANAUS_VISIBLE_500KM', () => {
  update(500000);
  assert.ok(aerial.stats.visible, 'Manaus must be visible at 500 km');
  assert.ok(aerial.stats.farOpacity > 0.9, `At 500 km, far tier opacity must be > 0.9, got ${aerial.stats.farOpacity}`);
});

test('T_MANAUS_VISIBLE_1000KM', () => {
  update(1000000);
  assert.ok(aerial.stats.visible, 'Manaus must be visible at 1000 km');
  assert.ok(aerial.stats.farOpacity > 0.9, `At 1000 km, far tier opacity must be > 0.9, got ${aerial.stats.farOpacity}`);
});

test('T_MANAUS_MARKER_GEOSPATIAL_ALIGNMENT', () => {
  const geo = ecefToGeodetic(MANAUS_ANCHOR_ECEF);
  const latDeg = geo.latRad * 180 / Math.PI;
  const lonDeg = geo.lonRad * 180 / Math.PI;
  // Manaus is at roughly -3.119° lat, -60.022° lon
  assert.ok(Math.abs(latDeg - (-3.119)) < 0.05, `Latitude should be near -3.119, got ${latDeg}`);
  assert.ok(Math.abs(lonDeg - (-60.022)) < 0.05, `Longitude should be near -60.022, got ${lonDeg}`);
});

test('T_MANAUS_LOCAL_CITY_NOT_RENDERED_TO_ORBIT', () => {
  // At 500 km and 1000 km, local detailed meshes (urban, mass, roads) must have opacity === 0
  const w500 = manausAerialWeights(500000, 500000, Math.PI / 3, 900, true);
  assert.equal(w500.opacity, 0, 'Local aerial mesh opacity must be 0 at 500 km orbit');
  assert.equal(w500.mass, 0, 'Sky mass opacity must be 0 at 500 km orbit');

  const w1000 = manausAerialWeights(1000000, 1000000, Math.PI / 3, 900, true);
  assert.equal(w1000.opacity, 0, 'Local aerial mesh opacity must be 0 at 1000 km orbit');
  assert.equal(w1000.mass, 0, 'Sky mass opacity must be 0 at 1000 km orbit');
});

test('T_RIO_NEGRO_LOCAL_AUTHORITY_PRESERVED', () => {
  // Local water source preserves real geometry and dual muddy/dark classes
  assert.ok(water.polygons.length > 0);
  assert.ok(water.polygons.some(p => !p.muddy), 'Rio Negro dark water class preserved');
  assert.ok(water.polygons.some(p => p.muddy), 'Solimões muddy water class preserved');
});

test('T_AMAZON_CONTINENTAL_LAYER_HANDOFF', () => {
  // Continental layer contains the Amazon and connects with regional coordinates
  const amazon = EarthRiverLayer.getAmazonMainStem();
  assert.ok(amazon, 'Amazon main stem exists in continental river layer');
  const rioNegro = EarthRiverLayer.getRioNegro();
  assert.ok(rioNegro, 'Rio Negro tributary exists in continental river layer');

  // Verify confluence coords near Manaus (-60.0° lon, -3.1° lat)
  const confluence = rioNegro.coordinates.find(([lon, lat]) => Math.hypot(lon - (-60.0), lat - (-3.1)) < 2.0);
  assert.ok(confluence, 'Confluence coordinates must exist near Manaus');
});
