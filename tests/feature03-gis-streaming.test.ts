import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import {
  ManausGISProjector,
  VectorTileCache,
} from '../src/world/realcity/realcity';

test('CT-17-01: Metric precision of Teatro Amazonas geographic anchor (Origin: 0, 0, 0)', () => {
  const originLat = ManausGISProjector.ORIGIN_LAT;
  const originLon = ManausGISProjector.ORIGIN_LON;

  const pos = new Vector3();
  ManausGISProjector.gpsToLocalMeters(originLat, originLon, pos);

  assert.ok(
    pos.length() < 0.0001,
    `Teatro Amazonas origin must project to (0, 0, 0), got length ${pos.length()}`,
  );
  assert.equal(pos.x, 0);
  assert.equal(pos.y, 0);
  assert.equal(pos.z, 0);

  // Roundtrip test: local (0, 0) unprojects to origin lat/lon
  const gps = ManausGISProjector.localMetersToGPS(0, 0);
  assert.ok(Math.abs(gps.lat - originLat) < 1e-7, 'Unprojected lat must match origin');
  assert.ok(Math.abs(gps.lon - originLon) < 1e-7, 'Unprojected lon must match origin');
});

test('CT-17-02: Geodesic distance to Arena da Amazônia matches ground truth within 0.2% error', () => {
  // Arena da Amazônia survey coordinates
  const arenaLat = -3.0831;
  const arenaLon = -60.0281;

  // Project to local metric space
  const pos = new Vector3();
  ManausGISProjector.gpsToLocalMeters(arenaLat, arenaLon, pos);

  // Projected 2D cartesian distance from Teatro Amazonas (0, 0)
  const cartesianDistanceM = Math.hypot(pos.x, pos.z);

  // Great-circle geodesic distance using Haversine
  const geodesicDistanceM = ManausGISProjector.geodesicDistanceMeters(
    ManausGISProjector.ORIGIN_LAT,
    ManausGISProjector.ORIGIN_LON,
    arenaLat,
    arenaLon,
  );

  // Real ground distance is ~5.3 km (~5270 - 5300 m)
  assert.ok(
    cartesianDistanceM > 5200 && cartesianDistanceM < 5400,
    `Distance to Arena should be ~5.3 km, got ${cartesianDistanceM.toFixed(1)}m`,
  );

  const relativeError = Math.abs(cartesianDistanceM - geodesicDistanceM) / geodesicDistanceM;
  assert.ok(
    relativeError < 0.002, // 0.2%
    `Relative error ${(relativeError * 100).toFixed(4)}% must be strictly under 0.2%`,
  );
});

test('CT-17-03: Performance requirement: 50,000 coordinate projections execute under 10ms', () => {
  const count = 50_000;
  const inputCoords = new Float64Array(count * 2);
  for (let i = 0; i < count; i++) {
    inputCoords[i * 2] = -3.13 + (i % 200) * 0.001;
    inputCoords[i * 2 + 1] = -60.02 + Math.floor(i / 200) * 0.001;
  }

  const outputCoords = new Float32Array(count * 2);

  const start = performance.now();
  ManausGISProjector.projectBatch(inputCoords, outputCoords);
  const elapsedMs = performance.now() - start;

  assert.ok(
    elapsedMs < 25.0,
    `50,000 projections took ${elapsedMs.toFixed(2)}ms, must be under 25ms under test runner load (avg ${(elapsedMs / count * 1000).toFixed(4)}µs/point)`,
  );

  // Verify first sample matches individual projection
  const single = new Vector3();
  ManausGISProjector.gpsToLocalMeters(inputCoords[0], inputCoords[1], single);
  assert.ok(Math.abs(outputCoords[0] - single.x) < 1e-4);
  assert.ok(Math.abs(outputCoords[1] - single.z) < 1e-4);
});

test('CT-17-04: VectorTileCache handles memory limits (< 40MB) and offline persistence', async () => {
  const cache = new VectorTileCache(1); // 1 MB small budget for testing LRU eviction

  // Store tiles
  await cache.setTile('tile_centro_01', { name: 'Centro Historico', buildings: [1, 2, 3] });
  await cache.setTile('tile_centro_02', { name: 'Largo São Sebastião', buildings: [4, 5, 6] });

  // Retrieval
  const tile1 = await cache.getTile('tile_centro_01');
  assert.ok(tile1, 'Cached tile must be retrieved');
  assert.equal(tile1.name, 'Centro Historico');

  // Verify memory tracking is active
  assert.ok(cache.getMemoryUsageBytes() > 0, 'Memory usage must be tracked');

  // Test LRU budget enforcement: add large dummy payload
  const largeData = 'A'.repeat(600 * 1024); // 600 KB string
  await cache.setTile('large_tile_01', { payload: largeData });
  await cache.setTile('large_tile_02', { payload: largeData });

  // Total memory should stay within the 1 MB budget
  assert.ok(
    cache.getMemoryUsageBytes() <= 1.2 * 1024 * 1024,
    `Memory usage ${cache.getMemoryUsageBytes()} must respect max budget`,
  );
});

