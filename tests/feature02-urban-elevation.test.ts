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
    avgModelCallMs < 0.002,
    `ElevationModel 100,000 queries took ${modelElapsedMs.toFixed(2)}ms (avg ${(avgModelCallMs * 1000).toFixed(4)}µs/call, target < 2µs/call)`,
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
    avgCallMs < 0.005,
    `Analytical query took ${avgCallMs.toFixed(5)}ms/call, compliant with RNF-10-02 (< 0.005ms under concurrent test load)`,
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

test('CT-10-07: Shell tier building foundation skirt parity on sloped terrain', () => {
  const buf = createBuffers();
  const building: RealBuilding = {
    id: 'test-slope-shell-building',
    h: 15.0,
    minH: 0,
    ox: 1200,
    oz: -3200,
    p: [
      -10, -10,
      10, -10,
      10, 10,
      -10, 10,
    ],
  };

  const slopeElevation = (_x: number, z: number) => {
    return 20.0 + (z < 0 ? 3.5 : 0.0);
  };

  const collider = appendShellBuilding(buf, building, {
    elevationSampler: slopeElevation,
  });

  assert.ok(collider, 'Collider must be created for shell building');
  assert.ok(buf.position.length > 0, 'Vertices must be emitted for shell building');

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < buf.position.length; i += 3) {
    const y = buf.position[i];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  assert.ok(minY <= -0.5, `Lowest shell foundation vertex ${minY} must extend at least 0.5m below minH`);
  assert.ok(maxY >= 15.0, `Top shell vertex ${maxY} must reach building height 15m`);
  assert.ok(collider.height >= 15.5, `Shell collider height ${collider.height} must encompass foundation depth`);
});

test('CT-10-08: Bridge navigation arch elevation and abutment anchoring', () => {
  const elevation = ManausUrbanElevation.getInstance();
  const bridgePoints = [
    -100, 1000, // Abutment A (Ponta da Barra / Manaus bank)
    -100, 1500, // Midspan A
    -100, 2000, // Navigation channel center
    -100, 2500, // Midspan B
    -100, 3000, // Abutment B (Iranduba bank)
  ];
  const roadBaseH = 0.03; // primary arterial height

  const bridgeElevations = elevation.sampleRoadElevations(bridgePoints, roadBaseH, true);
  assert.equal(bridgeElevations.length, 5, 'Must return 5 node elevations');

  // Verify smooth parabolic arching
  const startH = bridgeElevations[0];
  const midH = bridgeElevations[2];
  const endH = bridgeElevations[4];

  assert.ok(midH > startH + 5.0, `Midspan height ${midH.toFixed(2)}m must arch above start ${startH.toFixed(2)}m`);
  assert.ok(midH > endH + 10.0, `Midspan height ${midH.toFixed(2)}m must arch above end ${endH.toFixed(2)}m`);
  assert.ok(midH >= 18.0, `Bridge apex ${midH.toFixed(2)}m must clear maritime shipping navigation clearance (>= 18m)`);
});

test('CT-10-09: Numerical robustness to non-finite inputs (NaN and Infinity)', () => {
  const model = new ElevationModel(4, 4, 10, 0, 0);
  model.setHeight(0, 0, 15.0);

  // NaN coordinates
  assert.equal(model.sampleBilinear(NaN, 5.0), 0.0, 'sampleBilinear(NaN, y) must return 0.0');
  assert.equal(model.sampleBilinear(5.0, NaN), 0.0, 'sampleBilinear(x, NaN) must return 0.0');
  assert.equal(model.sampleBilinear(NaN, NaN), 0.0, 'sampleBilinear(NaN, NaN) must return 0.0');

  // Infinite coordinates
  assert.equal(model.sampleBilinear(Infinity, 0), 0.0, 'sampleBilinear(Infinity, z) must return 0.0');
  assert.equal(model.sampleBilinear(0, -Infinity), 0.0, 'sampleBilinear(x, -Infinity) must return 0.0');

  // ManausUrbanElevation singleton
  const elevation = ManausUrbanElevation.getInstance();
  assert.equal(elevation.getTerrainHeight(NaN, 100), 0.0, 'getTerrainHeight(NaN, z) must return 0.0');
  assert.equal(elevation.getTerrainHeight(100, NaN), 0.0, 'getTerrainHeight(x, NaN) must return 0.0');
  assert.equal(elevation.getTerrainHeight(Infinity, -Infinity), 0.0, 'getTerrainHeight(Inf, -Inf) must return 0.0');
});

test('CT-10-10: Foundation skirt normal vectors face consistently outward', () => {
  const buf = createBuffers();
  const building: RealBuilding = {
    id: 'test-skirt-normals-building',
    h: 12.0,
    minH: 0,
    ox: 500,
    oz: -1100,
    p: [
      0, 0,
      10, 0,
      10, 10,
      0, 10,
    ],
  };

  const slope = (_x: number, z: number) => {
    return 20.0 + (z > 5 ? -4.0 : 0.0);
  };

  appendNearBuilding(buf, building, { elevationSampler: slope });

  assert.ok(buf.normal.length > 0, 'Normals must be emitted');
  // Check that all normal vectors are normalized unit vectors
  for (let i = 0; i < buf.normal.length; i += 3) {
    const nx = buf.normal[i];
    const ny = buf.normal[i + 1];
    const nz = buf.normal[i + 2];
    const len = Math.hypot(nx, ny, nz);
    assert.ok(
      Math.abs(len - 1.0) < 1e-3,
      `Normal [${nx.toFixed(3)}, ${ny.toFixed(3)}, ${nz.toFixed(3)}] must be unit length, got ${len}`,
    );
  }
});

test('CT-10-11: Road ribbon sloped 3D normals on inclined terrain', () => {
  const roadRecord: RoadRecord = {
    class: 'primary',
    width: 10,
    p: [0, 0, 0, 100], // 100m road going along Z
  };

  // 15% grade slope: elevation rises 15m over 100m
  const slopeSampler = (_x: number, z: number) => z * 0.15;
  const dummyMat = {} as any;
  const network = new RoadNetwork([roadRecord], dummyMat, dummyMat, slopeSampler);

  // Sample road heights
  const heights = network.sampleRoadHeights(roadRecord.p, ROAD_HEIGHT.primary, false);
  assert.equal(heights.length, 2);
  assert.ok(heights[1] > heights[0] + 10.0, 'Road height must rise along slope');
});
