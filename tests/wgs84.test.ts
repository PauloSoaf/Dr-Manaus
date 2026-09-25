import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WGS84, WGS84_B, WGS84_E2, WGS84_F, geocentricRadius, meridionalRadius, primeVerticalRadius,
} from '../src/world/spatial/WGS84.ts';
import { ecefToGeodetic, geodeticToEcef } from '../src/world/spatial/ECEF.ts';
import { geodetic, geodeticFromDegrees, haversineDistance } from '../src/world/spatial/Geodetic.ts';
import { ecefToEnu, enuBasis, enuToEcef, geodeticToEnu } from '../src/world/spatial/ENU.ts';
import { degToRad, dotVec3, lengthVec3 } from '../src/world/spatial/units.ts';
import {
  LEGACY_EAST_SCALE, LEGACY_NORTH_SCALE, MANAUS_ANCHOR, ecefToLegacyLocal, geoToLegacyLocal,
  geodeticToTrueLocal, legacyDivergenceM, legacyLocalToEcef, legacyLocalToGeo,
} from '../src/world/spatial/ManausFrameAdapter.ts';
import { GEO_ORIGIN, latLonToWorld, worldToLatLon } from '../src/world/geodata/geodata.ts';

test('the ellipsoid uses the defining WGS84 constants, not fitted ones', () => {
  assert.equal(WGS84.semiMajorAxisM, 6_378_137.0);
  assert.equal(WGS84.inverseFlattening, 298.257_223_563);
  assert.equal(WGS84_F, 1 / 298.257_223_563);
  // The semi-minor axis is derived, and its published value is 6 356 752.314245 m.
  assert.ok(Math.abs(WGS84_B - 6_356_752.314_245) < 1e-6, `b = ${WGS84_B}`);
  assert.ok(Math.abs(WGS84_E2 - 0.006_694_379_990_14) < 1e-12, `e2 = ${WGS84_E2}`);
});

test('the radii of curvature differ, which is why a flat metres-per-degree is wrong', () => {
  // At the equator the prime vertical radius is the semi-major axis exactly.
  assert.ok(Math.abs(primeVerticalRadius(0) - WGS84.semiMajorAxisM) < 1e-9);
  // And the meridional radius there is a(1 - e²), noticeably smaller.
  assert.ok(Math.abs(meridionalRadius(0) - WGS84.semiMajorAxisM * (1 - WGS84_E2)) < 1e-9);
  // Both grow toward the pole, where they meet at a²/b.
  const polar = WGS84.semiMajorAxisM ** 2 / WGS84_B;
  assert.ok(Math.abs(primeVerticalRadius(Math.PI / 2) - polar) < 1e-6);
  assert.ok(Math.abs(meridionalRadius(Math.PI / 2) - polar) < 1e-6);
  // The surface radius runs from a at the equator to b at the pole.
  assert.ok(Math.abs(geocentricRadius(0) - WGS84.semiMajorAxisM) < 1e-6);
  assert.ok(Math.abs(geocentricRadius(Math.PI / 2) - WGS84_B) < 1e-6);
});

test('geodetic to ECEF lands on the published reference points', () => {
  // Latitude 0, longitude 0, height 0 is on the equator at the prime meridian.
  const origin = geodeticToEcef(geodetic(0, 0, 0));
  assert.ok(Math.abs(origin.xM - WGS84.semiMajorAxisM) < 1e-6);
  assert.ok(Math.abs(origin.yM) < 1e-6 && Math.abs(origin.zM) < 1e-6);

  // The north pole sits on the spin axis at the semi-minor axis.
  const pole = geodeticToEcef(geodetic(Math.PI / 2, 0, 0));
  assert.ok(Math.abs(pole.xM) < 1e-6 && Math.abs(pole.yM) < 1e-6);
  assert.ok(Math.abs(pole.zM - WGS84_B) < 1e-6);

  // Ninety degrees east puts the whole radius on +Y.
  const east = geodeticToEcef(geodetic(0, Math.PI / 2, 0));
  assert.ok(Math.abs(east.xM) < 1e-6);
  assert.ok(Math.abs(east.yM - WGS84.semiMajorAxisM) < 1e-6);

  // Height adds along the ellipsoid normal, which at the equator is radially outward.
  const raised = geodeticToEcef(geodetic(0, 0, 1000));
  assert.ok(Math.abs(raised.xM - (WGS84.semiMajorAxisM + 1000)) < 1e-6);
});

test('ECEF inverts geodetic to sub-millimetre everywhere the game can reach', () => {
  const cases: Array<[number, number, number, string]> = [
    [0, 0, 0, 'origin'],
    [MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, 0, 'Manaus'],
    [MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, 140_000, 'Manaus at the old altitude ceiling'],
    [89.9, 179.9, 0, 'near the north pole'],
    [-89.9, -179.9, 0, 'near the south pole'],
    [45, 90, 400_000, 'low orbit'],
    [-33.9, 151.2, -50, 'below the ellipsoid'],
    [51.5, -0.12, 8_848, 'a mountain height'],
    [0, 180, 35_786_000, 'geostationary altitude'],
  ];
  for (const [latDeg, lonDeg, heightM, label] of cases) {
    const source = geodeticFromDegrees(latDeg, lonDeg, heightM);
    const round = ecefToGeodetic(geodeticToEcef(source));
    // Compare on the ground rather than in radians: an angle error means nothing on its own.
    const metresPerRad = WGS84.semiMajorAxisM;
    assert.ok(Math.abs(round.latRad - source.latRad) * metresPerRad < 1e-3, `${label}: latitude`);
    const lonError = Math.abs(round.lonRad - source.lonRad) * metresPerRad * Math.cos(source.latRad);
    assert.ok(lonError < 1e-3, `${label}: longitude off by ${lonError} m`);
    assert.ok(Math.abs(round.heightM - source.heightM) < 1e-3, `${label}: height`);
  }
});

test('the ECEF inverse survives the degenerate inputs rather than returning NaN', () => {
  const centre = ecefToGeodetic({ xM: 0, yM: 0, zM: 0 });
  assert.ok(Number.isFinite(centre.latRad) && Number.isFinite(centre.lonRad) && Number.isFinite(centre.heightM));
  const onAxis = ecefToGeodetic({ xM: 0, yM: 0, zM: WGS84_B });
  assert.ok(Math.abs(onAxis.latRad - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(onAxis.heightM) < 1e-6);
  const broken = ecefToGeodetic({ xM: Number.NaN, yM: 0, zM: 0 });
  assert.ok(Number.isFinite(broken.latRad + broken.lonRad + broken.heightM));
});

test('the ENU basis is orthonormal and points where its name says', () => {
  for (const [latDeg, lonDeg] of [[0, 0], [MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg], [60, -120], [-45, 170]]) {
    const basis = enuBasis(geodeticFromDegrees(latDeg, lonDeg, 0));
    for (const axis of [basis.east, basis.north, basis.up]) {
      assert.ok(Math.abs(lengthVec3(axis) - 1) < 1e-12, 'axes must be unit length');
    }
    assert.ok(Math.abs(dotVec3(basis.east, basis.north)) < 1e-12);
    assert.ok(Math.abs(dotVec3(basis.north, basis.up)) < 1e-12);
    assert.ok(Math.abs(dotVec3(basis.up, basis.east)) < 1e-12);
    // East has no vertical component anywhere: moving east never changes latitude.
    assert.ok(Math.abs(basis.east[2]) < 1e-12);
  }

  // A step north is +Y in ENU, a step east is +X, a step up is +Z.
  const anchor = geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, 0);
  const basis = enuBasis(anchor);
  const north = geodeticToEnu(basis, geodeticFromDegrees(MANAUS_ANCHOR.latDeg + 0.01, MANAUS_ANCHOR.lonDeg, 0));
  assert.ok(north[1] > 1000 && Math.abs(north[0]) < 1, `north step gave ${north}`);
  const east = geodeticToEnu(basis, geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg + 0.01, 0));
  assert.ok(east[0] > 1000 && Math.abs(east[1]) < 1, `east step gave ${east}`);
  const up = geodeticToEnu(basis, geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, 500));
  assert.ok(Math.abs(up[2] - 500) < 1e-6 && Math.hypot(up[0], up[1]) < 1e-6);
});

test('ENU round trips through ECEF exactly', () => {
  const basis = enuBasis(geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, 0));
  for (const enu of [[0, 0, 0], [1200, -3400, 90], [-25_000, 40_000, -120], [1e6, 1e6, 1e5]] as const) {
    const round = ecefToEnu(basis, enuToEcef(basis, [...enu]));
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(round[i] - enu[i]) < 1e-6, `component ${i} of ${enu} came back as ${round[i]}`);
    }
  }
});

test('climbing moves along the local normal, which tilts away from the anchor with distance', () => {
  // Height is added along the ellipsoid normal *at that point*. Away from the anchor that normal
  // is tilted relative to the anchor's own, so a vertical climb does show up as a small sideways
  // shift in the anchor's flat frame. That is the curvature of the planet, not an error — and the
  // size of it is exactly what a flat local frame can be trusted for.
  const basis = enuBasis(geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, 0));
  const ground = geodeticFromDegrees(MANAUS_ANCHOR.latDeg + 0.02, MANAUS_ANCHOR.lonDeg + 0.02, 0);
  const a = geodeticToEnu(basis, ground);
  const b = geodeticToEnu(basis, { ...ground, heightM: 10_000 });

  // The geodetic position itself is untouched: climbing never changes latitude or longitude.
  assert.equal(ground.latRad, ground.latRad);
  assert.ok(Math.abs((b[2] - a[2]) - 10_000) < 1, 'the climb must gain the height it was given');

  // And the sideways shift matches the tilt: height times (distance / Earth radius).
  const distance = Math.hypot(a[0], a[1]);
  const predicted = 10_000 * (distance / WGS84.semiMajorAxisM);
  const actual = Math.hypot(a[0] - b[0], a[1] - b[1]);
  assert.ok(Math.abs(actual - predicted) < predicted * 0.2 + 0.01,
    `sideways shift ${actual.toFixed(2)} m, curvature predicts ${predicted.toFixed(2)} m`);
  assert.ok(actual < 10, 'and it stays small enough that local play never notices');
});

test('the Manaus adapter reproduces the shipped projection exactly', () => {
  // The compiled city — 645 tiles, the road network, the landmask, every landmark — is expressed
  // in this projection. If the adapter disagrees with it by even a metre, the city moves.
  assert.equal(MANAUS_ANCHOR.latDeg, GEO_ORIGIN.lat);
  assert.equal(MANAUS_ANCHOR.lonDeg, GEO_ORIGIN.lon);

  const probes: Array<[number, number]> = [
    [GEO_ORIGIN.lat, GEO_ORIGIN.lon],
    [-3.1302764, -60.0232792],   // Teatro Amazonas
    [-3.08325175, -60.02800465], // Arena da Amazônia
    [-3.06375, -60.10830],       // Ponta Negra
    [-3.1608, -60.0990],         // Iranduba
    [-3.0071889, -59.9398508],   // MUSA
  ];
  for (const [lat, lon] of probes) {
    const legacy = geoToLegacyLocal(lat, lon);
    const shipped = latLonToWorld(lat, lon);
    assert.equal(legacy.x, shipped.x, `x at ${lat},${lon}`);
    assert.equal(legacy.z, shipped.z, `z at ${lat},${lon}`);
  }

  // `latLonToWorld` now delegates to the adapter, so comparing the two would agree no matter what
  // either did. These are the coordinates the shipped game produced before that change, frozen:
  // if the projection ever moves, the city moves, and this is what says so.
  const frozen: Array<[string, number, number, number, number]> = [
    ['monument', -3.130333, -60.022528, 0, 0],
    ['teatro', -3.1302764, -60.0232792, -83.49880929098833, -6.300711999971078],
    ['arena', -3.08325175, -60.02800465, -608.7510036017412, -5241.084749999971],
    ['ponta', -3.06375, -60.1083, -9533.892266429611, -7412.019559999957],
    ['musa', -3.0071889, -59.9398508, 9189.89317831062, -13708.401211999973],
  ];
  for (const [name, lat, lon, x, z] of frozen) {
    const world = latLonToWorld(lat, lon);
    assert.ok(Math.abs(world.x - x) < 1e-9, `${name} x moved to ${world.x}`);
    assert.ok(Math.abs(world.z - z) < 1e-9, `${name} z moved to ${world.z}`);
  }
  for (const [x, z] of [[0, 0], [38, 12], [-83, -6], [5400, -7400], [-9000, 12_000]] as const) {
    const legacy = legacyLocalToGeo(x, z);
    const shipped = worldToLatLon(x, z);
    assert.equal(legacy.lat, shipped.lat);
    assert.equal(legacy.lon, shipped.lon);
  }
});

test('the adapter states how far the legacy projection is from the ellipsoid', () => {
  // The legacy projection assumes 111 320 m per degree on both axes. The ellipsoid gives about
  // 110 574 m per degree of latitude at Manaus, so north-south is stretched by about 0.67%.
  assert.ok(LEGACY_NORTH_SCALE > 1.006 && LEGACY_NORTH_SCALE < 1.008, `north scale ${LEGACY_NORTH_SCALE}`);
  // East-west is far closer, because the prime vertical radius is near the semi-major axis here.
  assert.ok(Math.abs(LEGACY_EAST_SCALE - 1) < 0.001, `east scale ${LEGACY_EAST_SCALE}`);

  // At the anchor the two projections agree exactly. That is what keeps the Largo correct.
  assert.ok(legacyDivergenceM(0, 0) < 1e-6);

  // Everywhere else the gap is the north stretch applied to the north offset, and it grows
  // linearly. Stating it as a formula rather than a magic number is what makes it auditable.
  for (const z of [100, 1_000, 20_000, 40_000]) {
    const predicted = z * (LEGACY_NORTH_SCALE - 1);
    const actual = legacyDivergenceM(0, z);
    assert.ok(Math.abs(actual - predicted) < predicted * 0.05 + 1e-6,
      `${z} m north: ${actual.toFixed(3)} m divergence, the scale predicts ${predicted.toFixed(3)} m`);
  }
  // Which means roughly two thirds of a metre across the Largo, and 135 m at the city edge.
  assert.ok(legacyDivergenceM(0, 100) < 1, 'authored detail near the anchor is unaffected');
  const edge = legacyDivergenceM(0, 20_000);
  assert.ok(edge > 100 && edge < 200, `divergence 20 km north is ${edge.toFixed(1)} m`);
  assert.ok(legacyDivergenceM(0, 40_000) > edge, 'and it grows rather than jumping');
});

test('legacy local coordinates survive a round trip through ECEF', () => {
  for (const [x, y, z] of [[0, 0, 0], [38, 2.2, 12], [5400, 120, -7400], [-12_000, -30, 9000]] as const) {
    const round = ecefToLegacyLocal(legacyLocalToEcef(x, y, z));
    assert.ok(Math.abs(round[0] - x) < 1e-3, `x ${x} -> ${round[0]}`);
    assert.ok(Math.abs(round[1] - y) < 1e-3, `y ${y} -> ${round[1]}`);
    assert.ok(Math.abs(round[2] - z) < 1e-3, `z ${z} -> ${round[2]}`);
  }
});

test('the true local frame keeps the game axis convention', () => {
  // +X east, +Y up, +Z south. North is -Z, and that convention is load-bearing for every tile.
  const north = geodeticToTrueLocal(geodeticFromDegrees(MANAUS_ANCHOR.latDeg + 0.05, MANAUS_ANCHOR.lonDeg, 0));
  assert.ok(north[2] < -5000, `a step north must be -Z, got ${north[2]}`);
  const east = geodeticToTrueLocal(geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg + 0.05, 0));
  assert.ok(east[0] > 5000, `a step east must be +X, got ${east[0]}`);
  const up = geodeticToTrueLocal(geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, 750));
  assert.ok(Math.abs(up[1] - 750) < 1e-6, `a step up must be +Y, got ${up[1]}`);
});

test('haversine distance agrees with the local projection over short ranges', () => {
  const a = geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, 0);
  const b = geodeticFromDegrees(-3.1302764, -60.0232792, 0);
  const sphere = haversineDistance(a, b, WGS84.semiMajorAxisM);
  const local = geoToLegacyLocal(-3.1302764, -60.0232792);
  const flat = Math.hypot(local.x, local.z);
  // The Teatro is about 98 m from the monument; the two methods must agree to a metre there.
  assert.ok(Math.abs(sphere - flat) < 1, `sphere ${sphere.toFixed(2)} m vs flat ${flat.toFixed(2)} m`);
  assert.ok(flat > 75 && flat < 110, `the Teatro is ${flat.toFixed(1)} m from the monument`);
});

test('degrees only appear at the edges, and bad input never becomes NaN', () => {
  const wrapped = geodeticFromDegrees(100, 400, Number.NaN);
  assert.ok(wrapped.latRad <= Math.PI / 2 && wrapped.latRad >= -Math.PI / 2, 'latitude is clamped, not wrapped');
  assert.ok(wrapped.lonRad > -Math.PI && wrapped.lonRad <= Math.PI, 'longitude wraps');
  assert.equal(wrapped.heightM, 0);
  assert.ok(Math.abs(wrapped.lonRad - degToRad(40)) < 1e-12, '400 degrees east is 40 degrees east');
});
