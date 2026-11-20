import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import {
  ElevationModel,
  ManausUrbanElevation,
  getManausTerrainHeight,
  getManausTerrainNormal,
} from '../src/world/realcity/realcity';
import {
  appendNearBuilding,
  appendShellBuilding,
  createBuffers,
  type RealBuilding,
} from '../src/world/realcity/buildings';
import {
  RoadNetwork,
  ROAD_HEIGHT,
  type RoadRecord,
} from '../src/world/realcity/roads';

test('CT-10-01: Bilinear height interpolation on unit cell returns exact mathematical mean', () => {
  // 2x2 grid with step = 1.0, origin = (0, 0)
  const model = new ElevationModel(2, 2, 1.0, 0, 0);
  const h00 = 10.0;
  const h10 = 20.0;
  const h01 = 30.0;
  const h11 = 40.0;

  model.setHeight(0, 0, h00);
  model.setHeight(1, 0, h10);
  model.setHeight(0, 1, h01);
  model.setHeight(1, 1, h11);

  // Exact center (0.5, 0.5)
  const centerHeight = model.sampleBilinear(0.5, 0.5);
  const expectedMean = (h00 + h10 + h01 + h11) / 4.0; // 25.0

  assert.ok(
    Math.abs(centerHeight - expectedMean) < 1e-5,
    `Center height ${centerHeight} must equal exact mean ${expectedMean}`,
  );

  // Quarter points
  const q1 = model.sampleBilinear(0.25, 0.25);
  const expectedQ1 = 0.75 * (0.75 * h00 + 0.25 * h10) + 0.25 * (0.75 * h01 + 0.25 * h11); // 16.25
  assert.ok(Math.abs(q1 - expectedQ1) < 1e-5, `Q1 sample ${q1} must equal ${expectedQ1}`);

  // Out of bounds clamping
  const oobLeft = model.sampleBilinear(-5.0, 0.0);
  assert.equal(oobLeft, h00);
  const oobRight = model.sampleBilinear(5.0, 1.0);
  assert.equal(oobRight, h11);
});

test('CT-10-02: Building foundation skirt eliminates gaps under sloping igarapé terrain', () => {
  const buf = createBuffers();
  // Building with front at z = -10 (elev = 24m) and back at z = 10 (elev = 20.5m) -> delta 3.5m
  const building: RealBuilding = {
    id: 'test-slope-building',
    h: 15.0,
    minH: 0,
    ox: 1200, // Near Adrianópolis / Mindu valley slope
    oz: -3200,
    p: [
      -10, -10, // Corner 0
      10, -10,  // Corner 1
      10, 10,   // Corner 2
      -10, 10,  // Corner 3
    ],
  };

  // Synthetic slope: ground drops 3.5m from north to south
  const slopeElevation = (_x: number, z: number) => {
    return 20.0 + (z < 0 ? 3.5 : 0.0);
  };

  const collider = appendNearBuilding(buf, building, {
    detail: true,
    elevationSampler: slopeElevation,
  });

  assert.ok(collider, 'Collider must be created');
  assert.ok(buf.position.length > 0, 'Vertices must be emitted');

  // Verify that lowest wall / skirt vertex reaches below the ground with anchor embed
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < buf.position.length; i += 3) {
    const y = buf.position[i];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // The foundation skirt must reach down to minH - 0.6 or lower (lowest ground - 0.6m embed)
  assert.ok(minY <= -0.5, `Lowest foundation vertex ${minY} must extend at least 0.5m below minH to seal ground gap`);
  assert.ok(maxY >= 15.0, `Top vertex ${maxY} must reach building height 15m`);

  // Verify collider height covers the foundation skirt
  assert.ok(collider.height >= 15.5, `Collider height ${collider.height} must encompass the foundation depth`);
});

test('CT-10-03: Performance requirement: continuous height queries satisfy RNF-10-02 (< 0.002ms/call)', () => {
  // 1. Bilinear elevation model performance (CT-10-03 spec: 100,000 queries < 20ms)
  const model = new ElevationModel(256, 256, 50, -6400, -6400);
  for (let z = 0; z < 256; z++) {
    for (let x = 0; x < 256; x++) {
      model.setHeight(x, z, (x * 37 + z * 19) % 45);
    }
  }

  const startModel = performance.now();
  let accModel = 0;
  for (let i = 0; i < 100_000; i++) {
    const x = -5000 + (i % 500) * 20;
    const z = -5000 + Math.floor(i / 500) * 30;
    accModel += model.sampleBilinear(x, z);
  }
  const modelElapsedMs = performance.now() - startModel;

  assert.ok(Number.isFinite(accModel), 'Model accumulation must be finite');
  const avgModelCallMs = modelElapsedMs / 100_000;
  assert.ok(
    avgModelCallMs < 0.001,
    `ElevationModel 100,000 queries took ${modelElapsedMs.toFixed(2)}ms (avg ${(avgModelCallMs * 1000).toFixed(4)}µs/call, target < 1µs/call)`,
  );

  // 2. Analytical geomophology pipeline satisfying RNF-10-02 (< 0.002ms per call)
  const elevation = ManausUrbanElevation.getInstance();
  const startAnalytical = performance.now();
  let accAnalytical = 0;
  const sampleCount = 50_000;
  for (let i = 0; i < sampleCount; i++) {
    const x = -10000 + (i % 500) * 40;
    const z = -12000 + Math.floor(i / 500) * 60;
    accAnalytical += elevation.getTerrainHeight(x, z);
  }
  const analyticalElapsedMs = performance.now() - startAnalytical;
  const avgCallMs = analyticalElapsedMs / sampleCount;

  assert.ok(Number.isFinite(accAnalytical), 'Analytical accumulation must be finite');
  assert.ok(
    avgCallMs < 0.002,
    `Analytical query took ${avgCallMs.toFixed(5)}ms/call, strictly compliant with RNF-10-02 (< 0.002ms)`,
  );
});

test('CT-10-04: Road elevation Laplacian smoothing eliminates steep grade steps', () => {
  const elevation = ManausUrbanElevation.getInstance();
  // Raw stepped terrain profile
  const rawElevations = new Float32Array([10, 10, 30, 30, 30, 10, 10]);
  const smoothed = elevation.smoothElevationLaplacian(rawElevations, 2);

  // Maximum step in raw is 20m
  let maxRawStep = 0;
  for (let i = 1; i < rawElevations.length; i++) {
    maxRawStep = Math.max(maxRawStep, Math.abs(rawElevations[i] - rawElevations[i - 1]));
  }

  // Maximum step in smoothed
  let maxSmoothedStep = 0;
  for (let i = 1; i < smoothed.length; i++) {
    maxSmoothedStep = Math.max(maxSmoothedStep, Math.abs(smoothed[i] - smoothed[i - 1]));
  }

  assert.equal(maxRawStep, 20);
  assert.ok(
    maxSmoothedStep < maxRawStep,
    `Smoothed max step ${maxSmoothedStep} must be strictly smoother than raw ${maxRawStep}`,
  );
  assert.ok(smoothed[0] === 10 && smoothed[smoothed.length - 1] === 10, 'Boundary endpoints must be preserved');
});

test('CT-10-05: Falésias fluviais and Igarapé valleys show realistic Amazonian morphology', () => {
  const elevation = ManausUrbanElevation.getInstance();

  // Water level in Rio Negro (far south: z = 5000)
  const waterHeight = elevation.getTerrainHeight(0, 5000);
  assert.equal(waterHeight, 0.0, 'Water level in river must be 0.0m');

  // Downtown plateau near Teatro Amazonas (x = 0, z = 0)
  const downtownHeight = elevation.getTerrainHeight(0, 0);
  assert.ok(
    downtownHeight >= 16.0 && downtownHeight <= 26.0,
    `Downtown plateau ${downtownHeight}m must sit between 16m and 26m above river`,
  );

  // Northern high plateau (Cidade Nova: x = 1800, z = -9500)
  const northHeight = elevation.getTerrainHeight(1800, -9500);
  assert.ok(
    northHeight > downtownHeight + 25.0,
    `North plateau ${northHeight}m must be higher than downtown plateau ${downtownHeight}m`,
  );

  // Igarapé do Mindu valley incision:
  // Mindu waypoint at (1200, -3200) vs ridge 400m away at (1200, -3600)
  const valleyBottom = elevation.getTerrainHeight(1200, -3200);
  const valleyRidge = elevation.getTerrainHeight(1200, -3600);
  assert.ok(
    valleyRidge > valleyBottom + 5.0,
    `Mindu valley ridge ${valleyRidge.toFixed(1)}m must be elevated above valley bottom ${valleyBottom.toFixed(1)}m`,
  );
});

test('CT-10-06: Surface normal calculation via central differences yields normalized vectors', () => {
  const elevation = ManausUrbanElevation.getInstance();
  const normal = new Vector3();

  // Downtown
  elevation.getTerrainNormal(0, 0, normal);
  assert.ok(Math.abs(normal.length() - 1.0) < 1e-4, 'Normal must be normalized unit vector');
  assert.ok(normal.y > 0.8, 'Ground normal must point predominantly upwards');

  // On riverbank bluff (steep transition)
  elevation.getTerrainNormal(0, 1000, normal);
  assert.ok(Math.abs(normal.length() - 1.0) < 1e-4, 'Bluff normal must be unit length');
  assert.ok(normal.y > 0.5, 'Bluff normal y must be positive');
});
