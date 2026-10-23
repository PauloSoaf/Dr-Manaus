import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sectorIndex,
  universeAddress,
  addressKey,
  sectorKey,
  sectorSeed,
  separationM,
  SECTOR_SIZE_M,
  normalizeSectorOffset,
} from '../src/world/spatial/UniverseAddress.ts';
import {
  LIGHT_YEAR_M,
  PARSEC_M,
  AU_M,
  degToRad,
  radToDeg,
  quatFromAxisAngle,
  type Vec3,
} from '../src/world/spatial/units.ts';
import { FloatingOrigin3D } from '../src/world/spatial/FloatingOrigin3D.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';

/**
 * U4 Architectural Mathematical Contracts Test Suite (Revision U4.0.2)
 *
 * Validates:
 * 1. Geometric angular projection: Spherical silhouette (arcsin) vs Flat disk (arctan)
 * 2. Perspective projected pixel dimensions and immersion envelope
 * 3. Float32 ULP quantization matrix across multiple magnitudes and displacements
 * 4. Spatial reference frame transformations: Reversibility, composition and non-commutativity
 * 5. Scale-dependent Float64 resolution (planetary, solar system, sector) and exact BigInt indexing
 * 6. Determinism of sector seeds and address keys (FNV-1a)
 * 7. Spiral arm modulation invariants (non-negativity, periodicity, peak alignment, no phase cancellation)
 * 8. Numerical robustness without NaN or Infinity across extreme parameters
 */

/* ========================================================================== */
/* Mathematical Specifications / Contract Reference for U4.1                 */
/* (Will be integrated into src/world/galaxy/GalaxyProjection.ts and          */
/*  src/world/galaxy/ProceduralGalaxyGenerator.ts in U4.1)                    */
/* ========================================================================== */

/**
 * Apparent angular diameter of a sphere observed externally (d > radius).
 * Formed by rays tangent to the sphere: sin(theta / 2) = radius / distance.
 * When distance <= radius, observer is immersed: theta = pi radians (180 deg).
 */
export function sphericalAngularSize(radiusM: number, distanceM: number): number {
  if (!Number.isFinite(radiusM) || !Number.isFinite(distanceM) || radiusM <= 0 || distanceM <= 0) {
    return (Number.isFinite(distanceM) && distanceM <= radiusM) ? Math.PI : 0;
  }
  if (distanceM <= radiusM) {
    return Math.PI; // Full forward hemisphere immersion
  }
  return 2 * Math.asin(radiusM / distanceM);
}

/**
 * Projected diameter (pixels) of a sphere under perspective projection.
 * Uses distance to the tangent circle plane: d_tangent = sqrt(d^2 - R^2).
 * D_px = (H_viewport * R) / (d_tangent * tan(FOVy / 2)).
 * When distance <= radius, returns viewportHeight (immersion saturation).
 */
export function sphericalProjectedDiameter(
  radiusM: number,
  distanceM: number,
  viewportHeightPx: number,
  fovYRad: number,
): number {
  if (!Number.isFinite(radiusM) || !Number.isFinite(distanceM) || radiusM <= 0 || distanceM <= 0) {
    return (Number.isFinite(distanceM) && distanceM <= radiusM) ? viewportHeightPx : 0;
  }
  if (distanceM <= radiusM) {
    return viewportHeightPx;
  }
  const tangentDistance = Math.sqrt(distanceM * distanceM - radiusM * radiusM);
  if (tangentDistance <= 0) return viewportHeightPx;
  const halfFovTan = Math.tan(fovYRad / 2);
  return (viewportHeightPx * radiusM) / (tangentDistance * halfFovTan);
}

/**
 * Apparent angular diameter of a flat circular disk perpendicular to line of sight.
 * theta_disk = 2 * atan(radius / distance).
 */
export function diskAngularSize(radiusM: number, distanceM: number): number {
  if (!Number.isFinite(radiusM) || !Number.isFinite(distanceM) || radiusM <= 0 || distanceM <= 0) {
    return (Number.isFinite(distanceM) && distanceM <= radiusM) ? Math.PI : 0;
  }
  if (distanceM <= radiusM) return Math.PI;
  return 2 * Math.atan(radiusM / distanceM);
}

/**
 * Projected diameter (pixels) of a flat circular disk perpendicular to line of sight.
 * D_px,disk = (H_viewport * R) / (d * tan(FOVy / 2)).
 */
export function diskProjectedDiameter(
  radiusM: number,
  distanceM: number,
  viewportHeightPx: number,
  fovYRad: number,
): number {
  if (!Number.isFinite(radiusM) || !Number.isFinite(distanceM) || radiusM <= 0 || distanceM <= 0) {
    return (Number.isFinite(distanceM) && distanceM <= radiusM) ? viewportHeightPx : 0;
  }
  if (distanceM <= radiusM) return viewportHeightPx;
  const halfFovTan = Math.tan(fovYRad / 2);
  return (viewportHeightPx * radiusM) / (distanceM * halfFovTan);
}

/**
 * Spiral arm modulation density factor M_arms(r, theta) in [0.25, 1.0].
 * Uses max_k envelope over logarithmic spiral arms to strictly prevent
 * negative densities, phase interference nodes, and harmonic cancellations.
 */
export function calculateSpiralArmModulation(
  rLy: number,
  thetaRad: number,
  numArms = 4,
  pitchAngleRad = degToRad(12.5),
  armAmplitude = 0.75,
  armWidthRad = 0.18,
  r0Ly = 8500,
): number {
  const wrapPi = (a: number): number => {
    let w = (a + Math.PI) % (2 * Math.PI);
    if (w < 0) w += 2 * Math.PI;
    return w - Math.PI;
  };

  const b = Math.tan(pitchAngleRad);
  let maxGaussian = 0;

  for (let k = 0; k < numArms; k++) {
    const thetaK = (2 * Math.PI * k) / numArms;
    // Logarithmic spiral ridge: r = r0 * exp(b * theta) => theta_ridge = theta_k + ln(r / r0) / b
    const ridgeAngle = thetaK + Math.log(Math.max(1, rLy) / r0Ly) / b;
    const deltaTheta = wrapPi(thetaRad - ridgeAngle);
    const gaussian = Math.exp(-(deltaTheta * deltaTheta) / (2 * armWidthRad * armWidthRad));
    if (gaussian > maxGaussian) {
      maxGaussian = gaussian;
    }
  }

  // Guaranteed range: [(1 - A_arm), 1.0], with A_arm <= 0.75 => minimum density >= 0.25 > 0
  return (1 - armAmplitude) + armAmplitude * maxGaussian;
}

/* ========================================================================== */
/* 1. Angular Projection: Spherical Silhouette vs Flat Disk                   */
/* ========================================================================== */

test('U4 Math: distinguishes spherical apparent contour (arcsin) from flat disk (arctan)', () => {
  const R = 50_000 * LIGHT_YEAR_M;

  // Case 1: Moderate distance d = 2 * R
  const dModerate = 2 * R;
  const thetaSphere = sphericalAngularSize(R, dModerate);
  const thetaDisk = diskAngularSize(R, dModerate);

  // Exact analytical values:
  // For sphere: 2 * asin(1/2) = 2 * (pi/6) = pi/3 rad = 60 deg
  assert.ok(Math.abs(thetaSphere - Math.PI / 3) < 1e-12, 'spherical contour at d=2R must be exactly 60 deg (pi/3)');
  // For disk: 2 * atan(1/2) ~= 2 * 0.4636476 ~= 0.927295 rad ~= 53.13 deg
  const expectedDisk = 2 * Math.atan(0.5);
  assert.ok(Math.abs(thetaDisk - expectedDisk) < 1e-12);

  // Spherical apparent contour is strictly larger than flat disk because tangent points lie closer to eye
  assert.ok(thetaSphere > thetaDisk, 'spherical silhouette must be strictly larger than disk at d=2R');
  assert.ok(radToDeg(thetaSphere) - radToDeg(thetaDisk) > 6.8, 'difference at d=2R exceeds 6.8 degrees');

  // Case 2: Asymptotic convergence at large cosmic distance (d >> R)
  const dCosmic = 2_500_000 * LIGHT_YEAR_M; // Andromeda from Earth (d = 50 * R)
  const thetaSphereCosmic = sphericalAngularSize(R, dCosmic);
  const thetaDiskCosmic = diskAngularSize(R, dCosmic);

  // At d = 50R, difference between asin(x) and atan(x) is O(x^3):
  assert.ok(Math.abs(thetaSphereCosmic - thetaDiskCosmic) < 1e-5, 'must asymptotically converge for d >> R');
  assert.ok(radToDeg(thetaSphereCosmic) > 2.29 && radToDeg(thetaSphereCosmic) < 2.30);
});

test('U4 Math: spherical projected pixel diameter uses tangent distance d_tangent = sqrt(d^2 - R^2)', () => {
  const R = 50_000 * LIGHT_YEAR_M;
  const viewportH = 900;
  const fovY = degToRad(60);

  // At d = 2 * R, d_tangent = sqrt(4R^2 - R^2) = R * sqrt(3)
  const dModerate = 2 * R;
  const pxSphere = sphericalProjectedDiameter(R, dModerate, viewportH, fovY);
  const pxDisk = diskProjectedDiameter(R, dModerate, viewportH, fovY);

  // Analytical check:
  // pxSphere = (900 * R) / (R * sqrt(3) * tan(30 deg)) = 900 / (sqrt(3) * (1 / sqrt(3))) = 900 px
  assert.ok(Math.abs(pxSphere - 900) < 1e-9, 'at d=2R and FOV=60deg, spherical diameter projects exactly to 900 px');

  // Disk projected diameter uses d = 2R:
  // pxDisk = (900 * R) / (2R * tan(30 deg)) = 450 * sqrt(3) ~= 779.42 px
  const expectedDiskPx = 450 * Math.sqrt(3);
  assert.ok(Math.abs(pxDisk - expectedDiskPx) < 1e-9);

  assert.ok(pxSphere > pxDisk, 'spherical projected diameter is strictly larger than disk');

  // At cosmic distance (d = 2.5 Mly), both classify in LOD 1 (12 px <= D_px < 300 px)
  const dAndromeda = 2_500_000 * LIGHT_YEAR_M;
  const pxAndromeda = sphericalProjectedDiameter(R, dAndromeda, viewportH, fovY);
  assert.ok(pxAndromeda >= 12 && pxAndromeda < 300, 'Andromeda from Earth must reside in LOD 1');

  // At 50 Mpc (~163 Mly), classifies in LOD 0 (D_px < 12 px)
  const dDistant = 50_000_000 * PARSEC_M;
  const pxDistant = sphericalProjectedDiameter(R, dDistant, viewportH, fovY);
  assert.ok(pxDistant < 12, 'Galaxy at 50 Mpc must resolve to LOD 0');
});

test('U4 Math: observer immersion (d <= R) and tangency limits avoid division by zero and NaN', () => {
  const R = 50_000 * LIGHT_YEAR_M;
  const viewportH = 900;
  const fovY = degToRad(60);

  // 1. Boundary tangency d = R (observer on the bounding sphere surface)
  const thetaEdge = sphericalAngularSize(R, R);
  const pxEdge = sphericalProjectedDiameter(R, R, viewportH, fovY);
  assert.equal(thetaEdge, Math.PI, 'angular size at boundary must saturate to pi');
  assert.equal(pxEdge, viewportH, 'projected diameter at boundary must saturate to viewportHeight');

  // 2. Interior immersion d = 0.5 * R
  const thetaInside = sphericalAngularSize(R, 0.5 * R);
  const pxInside = sphericalProjectedDiameter(R, 0.5 * R, viewportH, fovY);
  assert.equal(thetaInside, Math.PI);
  assert.equal(pxInside, viewportH);

  // 3. Exact center d = 0
  const thetaCenter = sphericalAngularSize(R, 0);
  const pxCenter = sphericalProjectedDiameter(R, 0, viewportH, fovY);
  assert.equal(thetaCenter, Math.PI);
  assert.equal(pxCenter, viewportH);

  // 4. Invalid or non-finite inputs
  assert.equal(sphericalAngularSize(R, -100), Math.PI); // Negative distance inside sphere envelope
  assert.equal(sphericalProjectedDiameter(R, -100, viewportH, fovY), viewportH);
  assert.equal(sphericalAngularSize(0, 1000), 0);
  assert.equal(sphericalProjectedDiameter(0, 1000, viewportH, fovY), 0);
});

test('U4 Math: LOD 15% directional hysteresis band prevents thrashing', () => {
  const thresholdDIn = 100_000;
  const hysteresisFactor = 1.15;
  const thresholdDOut = thresholdDIn * hysteresisFactor; // 115,000

  let currentLOD = 0;
  const evaluateLOD = (dist: number): number => {
    if (currentLOD === 0 && dist <= thresholdDIn) {
      currentLOD = 1;
    } else if (currentLOD === 1 && dist > thresholdDOut) {
      currentLOD = 0;
    }
    return currentLOD;
  };

  assert.equal(evaluateLOD(120_000), 0);
  assert.equal(evaluateLOD(105_000), 0, 'must not refine before reaching d_in');
  assert.equal(evaluateLOD(95_000), 1, 'must refine when d <= d_in');
  assert.equal(evaluateLOD(105_000), 1, 'hysteresis must keep LOD 1 within deadband');
  assert.equal(evaluateLOD(110_000), 1, 'hysteresis must keep LOD 1 within deadband');
  assert.equal(evaluateLOD(114_999), 1, 'hysteresis must keep LOD 1 below 1.15 * d_in');
  assert.equal(evaluateLOD(115_001), 0, 'must simplify back to LOD 0 once past 1.15 * d_in');
});

/* ========================================================================== */
/* 2. Float32 Precision & Quantization Matrix                                 */
/* ========================================================================== */

test('U4 Math: IEEE-754 Float32 ULP spacing across magnitudes', () => {
  const bitwiseFloat32ULP = (val: number): number => {
    const f32Buf = new Float32Array(1);
    f32Buf[0] = val;
    const base = f32Buf[0];
    const u32Buf = new Uint32Array(f32Buf.buffer);
    u32Buf[0] += 1;
    return f32Buf[0] - base;
  };

  // Magnitude 2,048 m (FloatingOrigin3D rebase threshold)
  const ulp2048 = bitwiseFloat32ULP(2_048);
  assert.equal(ulp2048, 0.000244140625, 'ULP at 2,048 m is 2^-12 m (~0.244 mm)');

  // Magnitude 10,000 m
  const ulp10k = bitwiseFloat32ULP(10_000);
  assert.equal(ulp10k, 0.0009765625, 'ULP at 10,000 m is 2^-10 m (~0.976 mm < 1 mm)');

  // Magnitude 100,000 m
  const ulp100k = bitwiseFloat32ULP(100_000);
  assert.equal(ulp100k, 0.0078125, 'ULP at 100,000 m is 2^-7 m (7.8125 mm)');
  assert.notEqual(ulp100k, 0.001, '100,000 m DOES NOT offer 1 mm resolution');
});

test('U4 Math: Float32 quantization error matrix: absolute conversion vs relative pre-subtraction', () => {
  // Test matrix covering key displacements across scales
  const displacementsM = [
    0.001, // 1 mm
    0.003, // 3 mm
    0.010, // 10 mm
    0.125, // 12.5 cm (exact multiple of 100k ULP 0.0078125)
    1.0,   // 1 m
  ];

  // Magnitudes to evaluate:
  // - 2,048 m: Local floating origin envelope
  // - 100,000 m: Far orbital / visual bounds
  // - 1 AU (1.496e11 m): Interplanetary scale
  // - 2.5 Mly (2.365e22 m): Intergalactic scale

  // 1. Tests at 100,000 m (where ULP = 0.0078125 m = 7.8125 mm, half-ULP = 3.90625 mm):
  const pos100k = 100_000.0;

  // Case 1 mm (< half-ULP): absolute conversion completely loses displacement
  const absDiff1mm = Math.fround(pos100k + 0.001) - Math.fround(pos100k);
  const relDiff1mm = Math.fround((pos100k + 0.001) - pos100k);
  assert.equal(absDiff1mm, 0, '1 mm is 100% annihilated by absolute Float32 conversion at 100,000 m');
  assert.ok(Math.abs(relDiff1mm - 0.001) < 1e-9, 'relative Float64 pre-subtraction preserves 1 mm');

  // Case 3 mm (< half-ULP): absolute conversion completely loses displacement
  const absDiff3mm = Math.fround(pos100k + 0.003) - Math.fround(pos100k);
  const relDiff3mm = Math.fround((pos100k + 0.003) - pos100k);
  assert.equal(absDiff3mm, 0, '3 mm is 100% annihilated by absolute Float32 conversion at 100,000 m');
  assert.ok(Math.abs(relDiff3mm - 0.003) < 1e-9, 'relative Float64 pre-subtraction preserves 3 mm');

  // Case 10 mm (> half-ULP): absolute conversion quantizes to 1 ULP (7.8125 mm), introducing ~22% error
  const absDiff10mm = Math.fround(pos100k + 0.010) - Math.fround(pos100k);
  const relDiff10mm = Math.fround((pos100k + 0.010) - pos100k);
  assert.equal(absDiff10mm, 0.0078125, '10 mm is quantized to 7.8125 mm in absolute Float32');
  assert.ok(Math.abs(absDiff10mm - 0.010) > 0.002, 'absolute conversion has > 2 mm quantization error');
  assert.ok(Math.abs(relDiff10mm - 0.010) < 1e-9, 'relative pre-subtraction preserves 10 mm');

  // Case 12.5 cm (0.125 m): exact multiple of 0.0078125 (16 * ULP)
  // Both methods yield exact 0.125 m, proving that power-of-2 subdivisions can produce exact matches
  const absDiff125mm = Math.fround(pos100k + 0.125) - Math.fround(pos100k);
  const relDiff125mm = Math.fround((pos100k + 0.125) - pos100k);
  assert.equal(absDiff125mm, 0.125, '0.125 m is an exact multiple of ULP at 100k; both methods match');
  assert.equal(relDiff125mm, 0.125);

  // Case 1.0 m: exact multiple of 0.0078125 (128 * ULP)
  const absDiff1m = Math.fround(pos100k + 1.0) - Math.fround(pos100k);
  const relDiff1m = Math.fround((pos100k + 1.0) - pos100k);
  assert.equal(absDiff1m, 1.0, '1.0 m is an exact multiple of ULP at 100k; both methods match');
  assert.equal(relDiff1m, 1.0);

  // 2. Tests at 2,048 m (FloatingOrigin3D rebase envelope, ULP ~= 0.244 mm):
  const pos2048 = 2_048.0;
  for (const delta of displacementsM) {
    const absDiff = Math.fround(pos2048 + delta) - Math.fround(pos2048);
    const relDiff = Math.fround((pos2048 + delta) - pos2048);
    // At 2,048 m, even 1 mm has error <= 0.125 mm (< 1 mm), validating sub-millimeter precision
    assert.ok(Math.abs(absDiff - delta) <= 0.00025, `at 2048m, absolute error for delta=${delta} is sub-millimeter`);
    assert.ok(Math.abs(relDiff - delta) < 1e-7);
  }

  // 3. Tests at 10,000 m (ULP = 2^-10 = 0.0009765625 m ~= 0.976 mm):
  const pos10k = 10_000.0;
  for (const delta of displacementsM) {
    const absDiff = Math.fround(pos10k + delta) - Math.fround(pos10k);
    const relDiff = Math.fround((pos10k + delta) - pos10k);
    // At 10,000 m, absolute conversion quantizes to multiples of 0.976 mm:
    if (delta === 0.125 || delta === 1.0) {
      assert.equal(absDiff, delta, `delta=${delta} is an exact multiple of ULP; both match`);
    } else {
      assert.ok(Math.abs(absDiff - delta) <= 0.001, `quantization error for delta=${delta} bounded by 1 ULP (~0.976 mm)`);
    }
    assert.ok(Math.abs(relDiff - delta) < 1e-7, `relative delta=${delta} is preserved exactly in Float32`);
  }

  // 4. Tests at Interplanetary scale (1 AU = 1.496e11 m, Float32 ULP = 16,384 m):
  const posAU = AU_M;
  for (const delta of displacementsM) {
    const absDiff = Math.fround(posAU + delta) - Math.fround(posAU);
    const relDiff = Math.fround((posAU + delta) - posAU);
    assert.equal(absDiff, 0, `at 1 AU, absolute Float32 completely loses delta=${delta}`);
    assert.ok(Math.abs(relDiff - delta) < 0.0001, `relative pre-subtraction preserves delta=${delta} at 1 AU`);
  }

  // 5. Tests at Intergalactic scale (2.5 Mly = 2.365e22 m):
  // Demonstrates why raw global Float64 fails (catastrophic cancellation) and why UniverseAddress BigInt authority is required:
  const rawCosmicPos = 2_500_000 * LIGHT_YEAR_M;
  const rawCosmicDiffF64 = (rawCosmicPos + 1.0) - rawCosmicPos;
  assert.equal(rawCosmicDiffF64, 0, 'raw global Float64 loses 1 meter displacement at 2.5 Mly (ULP = 5,240 km)');

  // Architectural solution: UniverseAddress decomposes into BigInt sector and local Float64 offset
  const localDeltaF64 = 1.0;
  const localDeltaF32 = Math.fround(localDeltaF64);
  assert.equal(localDeltaF32, 1.0, 'sub-sector offset preserves 1 meter exactly');
});

/* ========================================================================== */
/* 3. Reference Frame Transformations: Reversibility, Composition & Non-Comm */
/* ========================================================================== */

test('U4 Math: FloatingOrigin3D roundtrip reversibility toRenderLocal <-> toLogical', () => {
  const frame = 'galaxy/milky_way/sector/0,0,0';
  const initialOrigin = pose(frame, [10_000, 20_000, 30_000]);
  const floating = new FloatingOrigin3D(initialOrigin, { thresholdM: 2048, gridM: 1024 });

  const points = [
    [10_000, 20_000, 30_000],
    [10_500, 20_100, 29_800],
    [11_900, 20_800, 31_200],
  ] as const;

  for (const pt of points) {
    const pLogical: [number, number, number] = [pt[0], pt[1], pt[2]];
    const pLocal = floating.toRenderLocal(pLogical, [0, 0, 0]);
    const pBack = floating.toLogical(pLocal, [0, 0, 0]);

    for (let i = 0; i < 3; i++) {
      assert.ok(
        Math.abs(pBack[i] - pLogical[i]) < 1e-10,
        `axis ${i} must roundtrip reversibly without drift`,
      );
    }
  }
});

test('U4 Math: ReferenceFrameGraph verifies reversibility, composition, and non-commutativity', () => {
  const graph = new ReferenceFrameGraph();
  graph.register(referenceFrame({ id: 'system', kind: 'system' }));
  graph.register(referenceFrame({
    id: 'body', parentId: 'system', kind: 'body-fixed',
    originInParent: [1_000_000, 0, 0],
  }));
  graph.register(referenceFrame({
    id: 'surface', parentId: 'body', kind: 'surface-enu',
    originInParent: [0, 6_378_137, 0],
    rotationToParent: quatFromAxisAngle([0, 0, 1], Math.PI / 2),
  }));

  const testPos: Vec3 = [100, 250, -50];

  // 1. Reversibility: T^-1(T(P)) == P
  const toSystem = graph.convertPosition('surface', 'system', testPos);
  const backToSurface = graph.convertPosition('system', 'surface', toSystem);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(backToSurface[i] - testPos[i]) < 1e-9, `reversibility on axis ${i}`);
  }

  // 2. Composition: converting surface -> system directly matches surface -> body -> system
  const viaBody = graph.convertPosition('body', 'system', graph.convertPosition('surface', 'body', testPos));
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(toSystem[i] - viaBody[i]) < 1e-9, `composition consistency on axis ${i}`);
  }

  // 3. Non-commutativity: spatial transforms do NOT commute in general (T_AB(P) != T_BA(P))
  const forward = graph.convertPosition('surface', 'body', testPos);
  const backward = graph.convertPosition('body', 'surface', testPos);
  assert.notDeepEqual(forward, backward, 'spatial frame transformations are not commutative');
});

/* ========================================================================== */
/* 4. Cosmic Distance Arithmetic & Scale-Dependent Float64 Resolution        */
/* ========================================================================== */

test('U4 Math: Float64 precision resolution varies by scale from nanometric to metric', () => {
  // Float64 bitwise ULP calculation
  const bitwiseFloat64ULP = (val: number): number => {
    const f64Buf = new Float64Array(1);
    f64Buf[0] = val;
    const base = f64Buf[0];
    const u64Buf = new BigUint64Array(f64Buf.buffer);
    u64Buf[0] += 1n;
    return f64Buf[0] - base;
  };

  // 1. Planetary surface scale (r = 6.371e6 m - Earth radius)
  const ulpPlanetary = bitwiseFloat64ULP(6_371_000);
  assert.ok(ulpPlanetary < 2e-9, 'Float64 ULP at planetary surface is < 2 nanometers (~0.93 nm)');

  // 2. Solar system scale (50 AU ~= 7.48e12 m)
  const ulpSolarSystem = bitwiseFloat64ULP(50 * AU_M);
  assert.ok(ulpSolarSystem < 0.002, 'Float64 ULP at 50 AU is ~1.66 mm (millimetric)');

  // 3. Complete sector edge (100 ly ~= 9.46e17 m)
  const ulpSector = bitwiseFloat64ULP(SECTOR_SIZE_M);
  assert.equal(ulpSector, 128, 'Float64 ULP at 100 ly is 128 m (metric/decametric, NOT nanometric)');
  // However, relative precision is strict:
  assert.ok(ulpSector / SECTOR_SIZE_M < 1.5e-16, 'relative precision at sector edge is < 1.5e-16');
});

test('U4 Math: UniverseAddress.separationM avoids Float32 cancellation at 2.5 Mly', () => {
  const earth = {
    sector: sectorIndex(0n, 0n, 0n),
    offsetM: [0, 0, 0] as [number, number, number],
  };
  const andromeda = {
    sector: sectorIndex(25_000n, 0n, 0n),
    offsetM: [100, 200, 300] as [number, number, number],
  };

  const distM = separationM(earth, andromeda);
  assert.ok(Number.isFinite(distM));
  assert.ok(distM > 2.3e22 && distM < 2.4e22, 'distance must be ~2.36e22 m');

  // Exact BigInt difference:
  const exactSectorDiff = andromeda.sector.x - earth.sector.x;
  assert.equal(exactSectorDiff, 25_000n);

  // In contrast, raw Float32 completely loses sub-kilometer offsets
  const distF32 = Math.fround(2.365e22);
  const perturbedF32 = Math.fround(2.365e22 + 100);
  assert.equal(perturbedF32 - distF32, 0);
});

test('U4 Math: normalizeSectorOffset keeps sub-sector coordinates canonical', () => {
  const originSector = sectorIndex(100n, 200n, 300n);
  const largeOffset = [2.5 * SECTOR_SIZE_M, -1.2 * SECTOR_SIZE_M, 0.4 * SECTOR_SIZE_M] as [number, number, number];

  const norm = normalizeSectorOffset(originSector, largeOffset);

  assert.equal(norm.sector.x, 102n);
  const relErrorX = Math.abs(norm.offsetM[0] - 0.5 * SECTOR_SIZE_M) / SECTOR_SIZE_M;
  assert.ok(relErrorX < 1e-14);
  assert.ok(Math.abs(norm.offsetM[0] - 0.5 * SECTOR_SIZE_M) <= 128, 'within 1 ULP Float64 (128 m)');

  assert.equal(norm.sector.y, 198n);
  const relErrorY = Math.abs(norm.offsetM[1] - 0.8 * SECTOR_SIZE_M) / SECTOR_SIZE_M;
  assert.ok(relErrorY < 1e-14);
  assert.ok(Math.abs(norm.offsetM[1] - 0.8 * SECTOR_SIZE_M) <= 256);

  for (let i = 0; i < 3; i++) {
    assert.ok(norm.offsetM[i] >= 0 && norm.offsetM[i] < SECTOR_SIZE_M);
  }
});

/* ========================================================================== */
/* 5. Determinism of Sector Identifiers and Seeds (FNV-1a)                    */
/* ========================================================================== */

test('U4 Math: sectorSeed and addressKey are strictly deterministic and invariant', () => {
  const s = sectorIndex(42n, -99n, 1024n);
  const addrA = universeAddress('milky_way', s, { systemId: 'sol' });
  const addrB = universeAddress('milky_way', sectorIndex(42n, -99n, 1024n), { systemId: 'sol' });

  const keyA = addressKey(addrA);
  const keyB = addressKey(addrB);
  assert.equal(keyA, 'milky_way/42,-99,1024/sol');
  assert.equal(keyA, keyB);

  const seed1 = sectorSeed('milky_way', s);
  const seed2 = sectorSeed('milky_way', sectorIndex(42n, -99n, 1024n));
  assert.equal(seed1, seed2);
  assert.equal(typeof seed1, 'bigint');

  const seedAdjacent = sectorSeed('milky_way', sectorIndex(43n, -99n, 1024n));
  assert.notEqual(seed1, seedAdjacent);
});

/* ========================================================================== */
/* 6. Spiral Arm Modulation Density Function Invariants                       */
/* ========================================================================== */

test('U4 Math: spiral arm modulation M_arms is strictly positive (non-negativity)', () => {
  const radiiLy = [1_000, 8_500, 26_000, 50_000, 80_000];
  const angles = [-Math.PI, -Math.PI / 2, 0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI];

  for (const r of radiiLy) {
    for (const theta of angles) {
      const density = calculateSpiralArmModulation(r, theta);
      assert.ok(Number.isFinite(density));
      assert.ok(density >= 0.25, `density must be >= 0.25 (got ${density})`);
      assert.ok(density <= 1.0, `density must be <= 1.0 (got ${density})`);
    }
  }
});

test('U4 Math: spiral arm modulation exhibits strict 2*pi periodicity in theta', () => {
  const r = 26_000;
  const testThetas = [0.1, 0.75, 1.8, 3.14, 5.2];

  for (const theta of testThetas) {
    const valBase = calculateSpiralArmModulation(r, theta);
    const valPlus2Pi = calculateSpiralArmModulation(r, theta + 2 * Math.PI);
    const valPlus4Pi = calculateSpiralArmModulation(r, theta + 4 * Math.PI);
    const valMinus2Pi = calculateSpiralArmModulation(r, theta - 2 * Math.PI);

    assert.ok(Math.abs(valBase - valPlus2Pi) < 1e-12, 'must be identical under +2pi');
    assert.ok(Math.abs(valBase - valPlus4Pi) < 1e-12, 'must be identical under +4pi');
    assert.ok(Math.abs(valBase - valMinus2Pi) < 1e-12, 'must be identical under -2pi');
  }
});

test('U4 Math: spiral arm peaks align with logarithmic spiral ridges', () => {
  const numArms = 4;
  const pitchAngle = degToRad(12.5);
  const r0Ly = 8500;
  const b = Math.tan(pitchAngle);
  const rTest = 30_000;

  for (let k = 0; k < numArms; k++) {
    const thetaK = (2 * Math.PI * k) / numArms;
    const ridgeTheta = thetaK + Math.log(rTest / r0Ly) / b;
    const peakVal = calculateSpiralArmModulation(rTest, ridgeTheta, numArms, pitchAngle);

    assert.ok(
      Math.abs(peakVal - 1.0) < 1e-5,
      `arm ${k} ridge must reach maximum normalized modulation 1.0 (got ${peakVal})`,
    );
  }
});

test('U4 Math: max envelope formulation prevents destructive cancellation between arms', () => {
  const numArms = 4;
  const pitchAngle = degToRad(12.5);
  const r0Ly = 8500;
  const b = Math.tan(pitchAngle);
  const rTest = 20_000;

  const ridge0 = Math.log(rTest / r0Ly) / b;
  const ridge1 = (2 * Math.PI / numArms) + Math.log(rTest / r0Ly) / b;

  for (let step = 0; step <= 50; step++) {
    const t = step / 50;
    const theta = ridge0 + t * (ridge1 - ridge0);
    const val = calculateSpiralArmModulation(rTest, theta, numArms, pitchAngle);

    assert.ok(val >= 0.25, `value between arms must remain >= 0.25 (got ${val})`);
    assert.ok(val <= 1.0, `value between arms must remain <= 1.0 (got ${val})`);
  }
});

/* ========================================================================== */
/* 7. Robustness and Absence of NaN / Infinity Across Extreme Sweeps          */
/* ========================================================================== */

test('U4 Math: extreme parameter sweeps produce finite valid outputs without NaN or Infinity', () => {
  const extremeDistances = [1e-12, 1, 1e10, 1e25, 1e30];
  const extremeRadii = [1e-6, 100, 1e21];

  for (const r of extremeRadii) {
    for (const d of extremeDistances) {
      const angSph = sphericalAngularSize(r, d);
      assert.ok(Number.isFinite(angSph), `spherical angular size must be finite for r=${r}, d=${d}`);
      assert.ok(angSph >= 0 && angSph <= Math.PI);

      const pxSph = sphericalProjectedDiameter(r, d, 1080, degToRad(60));
      assert.ok(Number.isFinite(pxSph), `spherical pixel diameter must be finite for r=${r}, d=${d}`);
      assert.ok(pxSph >= 0);

      const angDisk = diskAngularSize(r, d);
      assert.ok(Number.isFinite(angDisk));

      const pxDisk = diskProjectedDiameter(r, d, 1080, degToRad(60));
      assert.ok(Number.isFinite(pxDisk));
    }
  }

  const extremeR = [1, 10, 1e6, 1e9];
  const extremeTheta = [-1e6, 0, 1e6];

  for (const r of extremeR) {
    for (const th of extremeTheta) {
      const mod = calculateSpiralArmModulation(r, th);
      assert.ok(Number.isFinite(mod));
      assert.ok(mod >= 0.25 && mod <= 1.0);
    }
  }
});
