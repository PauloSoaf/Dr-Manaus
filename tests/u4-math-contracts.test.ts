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
} from '../src/world/spatial/units.ts';
import { FloatingOrigin3D } from '../src/world/spatial/FloatingOrigin3D.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';

/**
 * U4 Architectural Mathematical Contracts Test Suite
 * Validates mathematical specifications, Float32 numerical precision boundaries,
 * angular projection, reference frame reversibility, cosmic scale arithmetic,
 * and spiral arm density invariants prior to procedural galaxy generation.
 */

/* ========================================================================== */
/* Helper Functions for U4 Mathematical Contracts                             */
/* ========================================================================== */

/**
 * Apparent angular diameter (radians) of an extended spherical/galactic volume.
 * Handles external viewing (d > R_gal) and observer immersion (d <= R_gal).
 */
export function calculateAngularSize(radiusM: number, distanceM: number): number {
  if (distanceM <= radiusM) {
    // Observer is immersed within or intersecting galaxy envelope:
    // angular diameter subtends the full hemispheric sky dome (pi rad = 180 deg).
    return Math.PI;
  }
  return 2 * Math.atan(radiusM / distanceM);
}

/**
 * Projected diameter on viewport in pixels under perspective projection.
 * D_px = (H_viewport / tan(FOVy / 2)) * tan(theta / 2).
 * Satures smoothly to viewport height when observer is immersed.
 */
export function calculateProjectedPixelDiameter(
  radiusM: number,
  distanceM: number,
  viewportHeightPx: number,
  fovYRad: number,
): number {
  if (distanceM <= radiusM) {
    return viewportHeightPx;
  }
  const halfFovTan = Math.tan(fovYRad / 2);
  const halfThetaTan = radiusM / distanceM; // tan(theta / 2) = R / d
  return (viewportHeightPx / halfFovTan) * halfThetaTan;
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
/* 1. Angular Projection & Projected Pixel Dimensions                        */
/* ========================================================================== */

test('U4 Math: angular size formula theta = 2 * atan(R_gal / d) for external observer', () => {
  const rGal = 50_000 * LIGHT_YEAR_M; // 50 kly radius
  const dAndromeda = 2_500_000 * LIGHT_YEAR_M; // 2.5 Mly distance

  const theta = calculateAngularSize(rGal, dAndromeda);
  assert.ok(Number.isFinite(theta));
  assert.ok(theta > 0 && theta < Math.PI);

  // Exact value: 2 * atan(50000 / 2500000) = 2 * atan(0.02)
  const expected = 2 * Math.atan(0.02);
  assert.ok(Math.abs(theta - expected) < 1e-12);

  // Small-angle approximation: for d >> R, theta ~= 2 * (R / d) = 0.04 rad
  const approx = (2 * rGal) / dAndromeda;
  assert.ok(Math.abs(theta - approx) < 1e-5, 'small-angle approximation must hold for distant galaxies');
  assert.ok(radToDeg(theta) > 2.2 && radToDeg(theta) < 2.3, 'Andromeda apparent size is ~2.29 degrees');
});

test('U4 Math: projected pixel diameter D_px and LOD classification', () => {
  const rGal = 50_000 * LIGHT_YEAR_M;
  const dAndromeda = 2_500_000 * LIGHT_YEAR_M;
  const viewportH = 900;
  const fovY = degToRad(60);

  const dPx = calculateProjectedPixelDiameter(rGal, dAndromeda, viewportH, fovY);
  assert.ok(Number.isFinite(dPx));

  // D_px = (900 / tan(30 deg)) * (50000 / 2500000) = (900 / (1 / sqrt(3))) * 0.02 ~= 31.177 px
  const expectedPx = (viewportH / Math.tan(fovY / 2)) * (50_000 / 2_500_000);
  assert.ok(Math.abs(dPx - expectedPx) < 1e-9);
  assert.ok(dPx > 30 && dPx < 32);

  // LOD Classification check:
  // LOD 0: D_px < 12 px (Cosmological)
  // LOD 1: 12 px <= D_px < 300 px (Distant Galactic)
  // LOD 2: D_px >= 300 px (Regional Point Cloud)
  assert.ok(dPx >= 12 && dPx < 300, 'Andromeda from Earth resides in LOD 1 (Distant Galactic)');

  // Very distant galaxy at 50 Mpc (~163 Mly)
  const dDistant = 50_000_000 * PARSEC_M;
  const dPxDistant = calculateProjectedPixelDiameter(rGal, dDistant, viewportH, fovY);
  assert.ok(dPxDistant < 12, 'Galaxy at 50 Mpc must resolve to LOD 0 (impostor/point)');
});

test('U4 Math: immersion condition (d <= R_gal) avoids singularities without division by zero', () => {
  const rGal = 50_000 * LIGHT_YEAR_M;
  const viewportH = 900;
  const fovY = degToRad(60);

  // Boundary case d = R_gal
  const thetaEdge = calculateAngularSize(rGal, rGal);
  assert.equal(thetaEdge, Math.PI);
  const pxEdge = calculateProjectedPixelDiameter(rGal, rGal, viewportH, fovY);
  assert.equal(pxEdge, viewportH);

  // Inside galaxy d = 0.5 * R_gal
  const thetaInside = calculateAngularSize(rGal, 0.5 * rGal);
  assert.equal(thetaInside, Math.PI);
  const pxInside = calculateProjectedPixelDiameter(rGal, 0.5 * rGal, viewportH, fovY);
  assert.equal(pxInside, viewportH);

  // Exact center d = 0
  const thetaCenter = calculateAngularSize(rGal, 0);
  assert.equal(thetaCenter, Math.PI);
  const pxCenter = calculateProjectedPixelDiameter(rGal, 0, viewportH, fovY);
  assert.equal(pxCenter, viewportH);
  assert.ok(Number.isFinite(thetaCenter) && Number.isFinite(pxCenter));
});

test('U4 Math: LOD 15% directional hysteresis band prevents thrashing', () => {
  const thresholdDIn = 100_000; // Refinement distance threshold
  const hysteresisFactor = 1.15;
  const thresholdDOut = thresholdDIn * hysteresisFactor; // 115,000 m

  let currentLOD = 0;
  const evaluateLOD = (dist: number): number => {
    if (currentLOD === 0 && dist <= thresholdDIn) {
      currentLOD = 1; // Refine
    } else if (currentLOD === 1 && dist > thresholdDOut) {
      currentLOD = 0; // Simplify
    }
    return currentLOD;
  };

  // Approach: 120k -> 105k -> 95k (should refine at 95k)
  assert.equal(evaluateLOD(120_000), 0);
  assert.equal(evaluateLOD(105_000), 0, 'must not refine before reaching d_in');
  assert.equal(evaluateLOD(95_000), 1, 'must refine when d <= d_in');

  // Retreat: 105k -> 110k -> 116k (should stay at LOD 1 until strictly exceeding 115k)
  assert.equal(evaluateLOD(105_000), 1, 'hysteresis must keep LOD 1 within deadband');
  assert.equal(evaluateLOD(110_000), 1, 'hysteresis must keep LOD 1 within deadband');
  assert.equal(evaluateLOD(114_999), 1, 'hysteresis must keep LOD 1 below 1.15 * d_in');
  assert.equal(evaluateLOD(115_001), 0, 'must simplify back to LOD 0 once past 1.15 * d_in');
});

/* ========================================================================== */
/* 2. Float32 Precision and ULP Across Magnitudes                             */
/* ========================================================================== */

test('U4 Math: bit-level validation of IEEE-754 Float32 ULP spacing', () => {
  // Helper to compute exact bitwise ULP using Float32Array
  const bitwiseFloat32ULP = (val: number): number => {
    const f32Buf = new Float32Array(1);
    f32Buf[0] = val;
    const base = f32Buf[0];
    const u32Buf = new Uint32Array(f32Buf.buffer);
    u32Buf[0] += 1;
    return f32Buf[0] - base;
  };

  // 1. At 100,000 meters, Float32 spacing is exactly 2^-7 m = 7.8125 mm
  const ulp100k = bitwiseFloat32ULP(100_000);
  assert.equal(ulp100k, 0.0078125, 'ULP at 100,000 m must be exactly 7.8125 mm');
  assert.notEqual(ulp100k, 0.001, '100,000 m DOES NOT have 1 mm resolution');

  // 2. Sub-millimeter resolution (< 0.001 m) requires magnitude < 8,388.608 m
  const ulp1k = bitwiseFloat32ULP(1_000);
  assert.ok(ulp1k < 0.0001, 'ULP at 1,000 m is ~0.061 mm (< 0.1 mm)');

  const ulp2048 = bitwiseFloat32ULP(2_048);
  assert.ok(Math.abs(ulp2048 - 0.000244140625) < 1e-12, 'ULP at 2,048 m is ~0.244 mm');

  const ulp8192 = bitwiseFloat32ULP(8_192);
  assert.ok(ulp8192 < 0.001, 'ULP at 8,192 m is 1/1024 m ~= 0.976 mm (< 1 mm)');

  const ulp16384 = bitwiseFloat32ULP(16_384);
  assert.ok(ulp16384 > 0.001, 'ULP at 16,384 m is 1/512 m ~= 1.953 mm (> 1 mm)');
});

test('U4 Math: relative camera subtraction preserves local precision before Float32 conversion', () => {
  // Scenario: Camera and object at cosmic distance from world origin
  const cameraZ = 100_000.0;
  const objectZ = 100_000.125; // 12.5 cm apart

  // Direct conversion of raw world coordinates to Float32 introduces quantization error
  const rawObjF32 = Math.fround(objectZ);
  const rawCamF32 = Math.fround(cameraZ);
  const rawSubtracted = rawObjF32 - rawCamF32;
  // Due to 7.8125 mm quantization, exact 12.5 cm is degraded if subtracted after Float32 conversion
  assert.ok(Number.isFinite(rawSubtracted));

  // Correct architectural pattern: Subtraction in Float64 FIRST, then convert relative delta to Float32
  const relativeDeltaF64 = objectZ - cameraZ; // 0.125 in Float64
  const relativeDeltaF32 = Math.fround(relativeDeltaF64); // Float32 on small delta

  assert.equal(relativeDeltaF32, 0.125, 'relative delta in Float32 preserves exact millimeter offset');
  assert.equal(Math.abs(relativeDeltaF32 - 0.125), 0);
});

/* ========================================================================== */
/* 3. Reference Frame Reversibility & Coordinate Preservation                 */
/* ========================================================================== */

test('U4 Math: FloatingOrigin3D roundtrip reversibility toRenderLocal <-> toLogical', () => {
  const frame = 'galaxy/milky_way/sector/0,0,0';
  const initialOrigin = pose(frame, [10_000, 20_000, 30_000]);
  const floating = new FloatingOrigin3D(initialOrigin, { thresholdM: 2048, gridM: 1024 });

  // Test set of sample points
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

/* ========================================================================== */
/* 4. Cosmic Distance Arithmetic & Prevention of Catastrophic Cancellation    */
/* ========================================================================== */

test('U4 Math: UniverseAddress.separationM avoids Float32 cancellation at 2.5 Mly', () => {
  // Earth in Milky Way (origin sector)
  const earth = {
    sector: sectorIndex(0n, 0n, 0n),
    offsetM: [0, 0, 0] as [number, number, number],
  };

  // Andromeda at 2.5 million light years (~25,000 sectors along X)
  const andromedaSectorsX = 25_000n;
  const andromeda = {
    sector: sectorIndex(andromedaSectorsX, 0n, 0n),
    offsetM: [100, 200, 300] as [number, number, number],
  };

  const distM = separationM(earth, andromeda);
  assert.ok(Number.isFinite(distM));
  assert.ok(distM > 2.3e22 && distM < 2.4e22, 'distance must be ~2.36e22 m');

  // BigInt difference in sectors is exact:
  const exactSectorDiff = andromeda.sector.x - earth.sector.x;
  assert.equal(exactSectorDiff, 25_000n);

  // In contrast, direct Float32 subtraction of such cosmic distances loses all precision
  const distF32 = Math.fround(2.365e22);
  const perturbedF32 = Math.fround(2.365e22 + 100);
  assert.equal(perturbedF32 - distF32, 0, 'raw Float32 completely annihilates sub-kilometer deltas at cosmic scale');
});

test('U4 Math: normalizeSectorOffset keeps sub-sector coordinates canonical', () => {
  const originSector = sectorIndex(100n, 200n, 300n);
  // Offset exceeding sector boundary by 2.5 sector lengths
  const largeOffset = [2.5 * SECTOR_SIZE_M, -1.2 * SECTOR_SIZE_M, 0.4 * SECTOR_SIZE_M] as [number, number, number];

  const norm = normalizeSectorOffset(originSector, largeOffset);

  // Exact BigInt sector indexing:
  // X advances by 2 sectors (floor(2.5) = 2)
  assert.equal(norm.sector.x, 102n);
  // At SECTOR_SIZE_M (~9.46e17 m), Float64 ULP is 128 m; relative precision is < 1e-15
  const relErrorX = Math.abs(norm.offsetM[0] - 0.5 * SECTOR_SIZE_M) / SECTOR_SIZE_M;
  assert.ok(relErrorX < 1e-14, 'Float64 relative error on sub-sector remainder must be < 1e-14');
  assert.ok(Math.abs(norm.offsetM[0] - 0.5 * SECTOR_SIZE_M) <= 128, 'absolute discrepancy within 1 ULP Float64 (128 m)');

  // Y retreats by 2 sectors (floor(-1.2) = -2), remaining offset is 0.8 * SECTOR_SIZE_M
  assert.equal(norm.sector.y, 198n);
  const relErrorY = Math.abs(norm.offsetM[1] - 0.8 * SECTOR_SIZE_M) / SECTOR_SIZE_M;
  assert.ok(relErrorY < 1e-14, 'Float64 relative error on negative sub-sector remainder must be < 1e-14');
  assert.ok(Math.abs(norm.offsetM[1] - 0.8 * SECTOR_SIZE_M) <= 256, 'absolute discrepancy within 2 ULP Float64');

  // All normalized offsets must be within [0, SECTOR_SIZE_M)
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

  // addressKey invariance
  const keyA = addressKey(addrA);
  const keyB = addressKey(addrB);
  assert.equal(keyA, 'milky_way/42,-99,1024/sol');
  assert.equal(keyA, keyB);

  // sectorSeed invariance across distinct evaluations
  const seed1 = sectorSeed('milky_way', s);
  const seed2 = sectorSeed('milky_way', sectorIndex(42n, -99n, 1024n));
  assert.equal(seed1, seed2);
  assert.equal(typeof seed1, 'bigint');

  // Avalanche effect: small change in sector index produces completely different seed
  const seedAdjacent = sectorSeed('milky_way', sectorIndex(43n, -99n, 1024n));
  assert.notEqual(seed1, seedAdjacent);
});

/* ========================================================================== */
/* 6. Spiral Arm Modulation Density Function Invariants                       */
/* ========================================================================== */

test('U4 Math: spiral arm modulation M_arms is strictly positive (non-negativity)', () => {
  // Test across a radial and angular grid
  const radiiLy = [1_000, 8_500, 26_000, 50_000, 80_000];
  const angles = [-Math.PI, -Math.PI / 2, 0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI];

  for (const r of radiiLy) {
    for (const theta of angles) {
      const density = calculateSpiralArmModulation(r, theta);
      assert.ok(Number.isFinite(density));
      assert.ok(density >= 0.25, `density at r=${r}, theta=${theta} must be >= 0.25 (got ${density})`);
      assert.ok(density <= 1.0, `density at r=${r}, theta=${theta} must be <= 1.0 (got ${density})`);
    }
  }
});

test('U4 Math: spiral arm modulation exhibits strict 2*pi periodicity in theta', () => {
  const r = 26_000; // Solar galactic radius
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

  // For each of the 4 arms, sample exactly on the ridge
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

  // Arm 0 ridge and Arm 1 ridge
  const ridge0 = Math.log(rTest / r0Ly) / b;
  const ridge1 = (2 * Math.PI / numArms) + Math.log(rTest / r0Ly) / b;

  // Sweep 50 points between ridge 0 and ridge 1
  for (let step = 0; step <= 50; step++) {
    const t = step / 50;
    const theta = ridge0 + t * (ridge1 - ridge0);
    const val = calculateSpiralArmModulation(rTest, theta, numArms, pitchAngle);

    // Minimum inter-arm floor is (1 - A_arm) = 0.25; value must NEVER cancel out to 0 or negative
    assert.ok(val >= 0.25, `value between arms must remain >= 0.25 (got ${val})`);
    assert.ok(val <= 1.0, `value between arms must remain <= 1.0 (got ${val})`);
  }
});

/* ========================================================================== */
/* 7. Robustness and Absence of NaN / Infinity Across Extreme Sweeps          */
/* ========================================================================== */

test('U4 Math: extreme parameter sweeps produce finite valid outputs without NaN or Infinity', () => {
  // Test angular size with extreme values
  const extremeDistances = [1e-12, 1, 1e10, 1e25, 1e30];
  const extremeRadii = [1e-6, 100, 1e21];

  for (const r of extremeRadii) {
    for (const d of extremeDistances) {
      const ang = calculateAngularSize(r, d);
      assert.ok(Number.isFinite(ang), `angular size must be finite for r=${r}, d=${d}`);
      assert.ok(ang >= 0 && ang <= Math.PI);

      const px = calculateProjectedPixelDiameter(r, d, 1080, degToRad(60));
      assert.ok(Number.isFinite(px), `pixel diameter must be finite for r=${r}, d=${d}`);
      assert.ok(px >= 0);
    }
  }

  // Test spiral arm modulation with extreme inputs
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
