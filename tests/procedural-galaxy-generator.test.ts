/**
 * tests/procedural-galaxy-generator.test.ts
 *
 * U4.1 / U4.1.1 Architectural Unit Tests: Deterministic Procedural Galaxy Generator.
 *
 * Validates mathematical contracts, determinism, Hubble sequence morphology,
 * non-negative finite densities, angular periodicity, BigInt coordinate scaling without 2^64 aliasing,
 * canonical astronomical catalog preservation, cosmological spatial identity, and zero-loss runtime compatibility.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ProceduralGalaxyGenerator,
  hashCosmologicalCell,
  DeterministicRNG,
  calculateSpiralArmModulation,
  calculateBulgeDensity,
  calculateBarDensity,
  calculateDiskDensity,
  calculateHaloDensity,
  evaluateProceduralDensity,
  cosmologicalPositionM,
  cosmologicalSeparationVectorM,
  isCellInFloatDomain,
  COSMOLOGICAL_CELL_SIZE_M,
  COSMOLOGICAL_CELL_SIZE_MPC,
  COSMOLOGICAL_FLOAT_DOMAIN_MAX_CELLS,
  GALAXY_GENERATOR_VERSION,
  GALAXY_INDEX_MAX,
  type ProceduralGalaxyDescriptor,
  type HubbleMorphology,
} from '../src/world/galaxy/ProceduralGalaxyGenerator.ts';
import {
  type BigInt3,
  type CosmologicalAddress,
  SECTOR_SIZE_M,
} from '../src/world/spatial/UniverseAddress.ts';
import {
  LIGHT_YEAR_M,
  type Vec3,
  degToRad,
  wrapPi,
} from '../src/world/spatial/units.ts';
import { LOCAL_GROUP_CATALOG } from '../src/world/celestial/GalaxyDefinition.ts';
import { GalaxyRuntime } from '../src/world/galaxy/GalaxyRuntime.ts';

/* ========================================================================== */
/* Test Suite: U4.1 / U4.1.1 Deterministic Procedural Galaxy Generator        */
/* ========================================================================== */

test('T_U41_01_DETERMINISM_IDENTICAL_SEED_AND_COORDINATES: produces identical galaxy descriptors and densities', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0xcafe_babe_dead_beefn;
  const cell: BigInt3 = { x: 42n, y: -108n, z: 256n };
  const index = 1;

  const galA = generator.generateGalaxy(universeSeed, cell, index);
  const galB = generator.generateGalaxy(universeSeed, cell, index);

  // Exact structural identity
  assert.equal(galA.id, galB.id);
  assert.equal(galA.name, galB.name);
  assert.equal(galA.seed, galB.seed);
  assert.equal(galA.morphology, galB.morphology);
  assert.equal(galA.family, galB.family);
  assert.equal(galA.diameterLy, galB.diameterLy);
  assert.equal(galA.thicknessLy, galB.thicknessLy);
  assert.equal(galA.densityScale, galB.densityScale);
  assert.deepEqual(galA.orientationEulerRad, galB.orientationEulerRad);
  assert.deepEqual(galA.localCellMpc, galB.localCellMpc);

  // Exact density evaluation identity across sample positions
  const testPositionsM: Vec3[] = [
    [0, 0, 0],
    [1_000 * LIGHT_YEAR_M, 2_000 * LIGHT_YEAR_M, 100 * LIGHT_YEAR_M],
    [25_000 * LIGHT_YEAR_M, 0, 0],
    [-15_000 * LIGHT_YEAR_M, 30_000 * LIGHT_YEAR_M, -500 * LIGHT_YEAR_M],
    [100_000 * LIGHT_YEAR_M, 100_000 * LIGHT_YEAR_M, 10_000 * LIGHT_YEAR_M],
  ];

  for (const pos of testPositionsM) {
    const densA = generator.calculateDensity(galA, pos);
    const densB = generator.calculateDensity(galB, pos);
    assert.equal(densA, densB, `Density must be strictly identical at [${pos.join(', ')}]`);
  }
});

test('T_U41_02_SEED_AND_COORDINATE_DIVERGENCE: changes in seed, cell, or index produce distinct galaxies', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed1 = 0x1111_2222_3333_4444n;
  const universeSeed2 = 0x1111_2222_3333_4445n;
  const cellA: BigInt3 = { x: 10n, y: 20n, z: 30n };
  const cellB: BigInt3 = { x: 11n, y: 20n, z: 30n };

  const galSeed1 = generator.generateGalaxy(universeSeed1, cellA, 0);
  const galSeed2 = generator.generateGalaxy(universeSeed2, cellA, 0);
  assert.notEqual(galSeed1.seed, galSeed2.seed, 'Different universe seeds must produce different galaxy seeds');

  const galCellA = generator.generateGalaxy(universeSeed1, cellA, 0);
  const galCellB = generator.generateGalaxy(universeSeed1, cellB, 0);
  assert.notEqual(galCellA.id, galCellB.id, 'Different cells must produce distinct galaxy IDs');
  assert.notEqual(galCellA.seed, galCellB.seed, 'Different cells must produce distinct seeds');

  const galIdx0 = generator.generateGalaxy(universeSeed1, cellA, 0);
  const galIdx1 = generator.generateGalaxy(universeSeed1, cellA, 1);
  assert.notEqual(galIdx0.id, galIdx1.id, 'Different indices within the same cell must produce distinct IDs');
  assert.notEqual(galIdx0.seed, galIdx1.seed, 'Different indices within the same cell must produce distinct seeds');
});

test('T_U41_03_INVARIANCE_TO_CALL_ORDER_AND_CAMERA: generator is stateless and order-independent', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0x9999_8888_7777_6666n;

  const cells: BigInt3[] = [
    { x: 1n, y: 2n, z: 3n },
    { x: -5n, y: 10n, z: -15n },
    { x: 100n, y: 200n, z: 300n },
  ];

  // Forward generation
  const forwardResults = cells.map((c, i) => generator.generateGalaxy(universeSeed, c, i));

  // Reverse generation
  const reverseCells = [...cells].reverse();
  const reverseIndices = [2, 1, 0];
  const reverseResults = reverseCells.map((c, i) =>
    generator.generateGalaxy(universeSeed, c, reverseIndices[i]),
  );

  // Compare forward[0] with reverse[2] (both correspond to cells[0], index 0)
  assert.equal(forwardResults[0].id, reverseResults[2].id);
  assert.equal(forwardResults[0].seed, reverseResults[2].seed);
  assert.equal(forwardResults[0].diameterLy, reverseResults[2].diameterLy);

  // Compare forward[1] with reverse[1] (both correspond to cells[1], index 1)
  assert.equal(forwardResults[1].id, reverseResults[1].id);
  assert.equal(forwardResults[1].seed, reverseResults[1].seed);

  // Compare forward[2] with reverse[0] (both correspond to cells[2], index 2)
  assert.equal(forwardResults[2].id, reverseResults[0].id);
  assert.equal(forwardResults[2].seed, reverseResults[0].seed);
});

test('T_U41_04_EXACT_BIGINT_SCALING_BEYOND_2_POW_53: preserves precision for massive and negative coordinates', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0x1234_5678_9abc_def0n;

  // Values exceeding 2^53 (9,007,199,254,740,992) where IEEE-754 Number loses LSB
  const baseCoord = 9_007_199_254_740_993n;
  const adjacentCoord = 9_007_199_254_740_994n;

  const cellA: BigInt3 = { x: baseCoord, y: 0n, z: 0n };
  const cellB: BigInt3 = { x: adjacentCoord, y: 0n, z: 0n };

  const hashA = hashCosmologicalCell(universeSeed, cellA, 0);
  const hashB = hashCosmologicalCell(universeSeed, cellB, 0);

  assert.notEqual(hashA, hashB, 'Adjacent coordinates beyond 2^53 must hash to completely different seeds');

  // Negative coordinates
  const negCellA: BigInt3 = { x: -baseCoord, y: -adjacentCoord, z: -42n };
  const negCellB: BigInt3 = { x: -baseCoord, y: -adjacentCoord, z: -43n };

  const hashNegA = hashCosmologicalCell(universeSeed, negCellA, 0);
  const hashNegB = hashCosmologicalCell(universeSeed, negCellB, 0);

  assert.notEqual(hashNegA, hashNegB, 'Adjacent negative coordinates beyond 2^53 must hash to distinct seeds');

  // Verify generation succeeds without exception
  const galBeyond = generator.generateGalaxy(universeSeed, cellA, 0);
  assert.ok(galBeyond.id.includes('9007199254740993'), 'ID must preserve exact BigInt representation');
});

test('T_U41_05_DENSITY_NON_NEGATIVITY_AND_FINITENESS: densities are >= 0, finite, and non-singular at r=0', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0xa5a5_5a5a_3c3c_c3c3n;

  // Test across multiple morphologies
  for (let i = 0; i < 20; i++) {
    const cell: BigInt3 = { x: BigInt(i * 17), y: BigInt(-i * 31), z: BigInt(i * 7) };
    const gal = generator.generateGalaxy(universeSeed, cell, 0);

    // 1. Center at r = 0 (must be finite, positive, non-singular)
    const densCenter = generator.calculateDensity(gal, [0, 0, 0]);
    assert.ok(Number.isFinite(densCenter), `Density at center must be finite for galaxy ${gal.id}`);
    assert.ok(densCenter >= 0, `Density at center must be >= 0 for galaxy ${gal.id}`);

    // 2. Extreme distances
    const densFar = generator.calculateDensity(gal, [1e25, 1e25, 1e25]);
    assert.ok(Number.isFinite(densFar), 'Far field density must be finite');
    assert.ok(densFar >= 0, 'Far field density must be non-negative');

    // 3. Grid of test points in and out of the plane
    for (let rKly = 0; rKly <= 100; rKly += 20) {
      for (let zKly = -10; zKly <= 10; zKly += 5) {
        for (let angleDeg = 0; angleDeg < 360; angleDeg += 60) {
          const theta = degToRad(angleDeg);
          const xM = rKly * 1_000 * LIGHT_YEAR_M * Math.cos(theta);
          const yM = rKly * 1_000 * LIGHT_YEAR_M * Math.sin(theta);
          const zM = zKly * 1_000 * LIGHT_YEAR_M;

          const d = generator.calculateDensity(gal, [xM, yM, zM]);
          assert.ok(Number.isFinite(d), `Density must be finite at r=${rKly}kly, z=${zKly}kly`);
          assert.ok(d >= 0, `Density must be non-negative at r=${rKly}kly, z=${zKly}kly`);
        }
      }
    }
  }
});

test('T_U41_06_SPIRAL_ARM_MODULATION_INVARIANTS: modulation factor is periodic, non-negative, and crest-aligned', () => {
  const params = {
    active: true,
    numArms: 4,
    pitchAngleRad: degToRad(12.5),
    amplitude: 0.50,
    angularWidthRad: degToRad(10.0),
    referenceRadiusLy: 8_500,
    initialPhasesRad: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
  };

  const rLy = 15_000;

  // Contract 1: Minimum floor >= 1 - amplitude = 1 - 0.50 = 0.50 >= 0.25
  for (let deg = 0; deg < 360; deg += 5) {
    const theta = degToRad(deg);
    const m = calculateSpiralArmModulation(rLy, theta, params);
    assert.ok(m >= 0.50 - 1e-6, `M_arms must not drop below minimum floor at theta=${deg} deg`);
    assert.ok(m <= 1.0 + 1e-6, `M_arms must not exceed 1.0 at theta=${deg} deg`);
  }

  // Contract 2: 2*pi periodicity
  const testTheta = 1.2345;
  const m0 = calculateSpiralArmModulation(rLy, testTheta, params);
  const mPeriodic1 = calculateSpiralArmModulation(rLy, testTheta + 2 * Math.PI, params);
  const mPeriodic2 = calculateSpiralArmModulation(rLy, testTheta - 4 * Math.PI, params);
  assert.ok(Math.abs(m0 - mPeriodic1) < 1e-12, 'M_arms must be invariant under +2pi');
  assert.ok(Math.abs(m0 - mPeriodic2) < 1e-12, 'M_arms must be invariant under -4pi');

  // Contract 3: Crest alignment (theta matches arm ridge exactly)
  const b = Math.tan(params.pitchAngleRad);
  const ridge0 = params.initialPhasesRad[0] + Math.log(rLy / params.referenceRadiusLy) / b;
  const mCrest = calculateSpiralArmModulation(rLy, ridge0, params);
  assert.ok(Math.abs(mCrest - 1.0) < 1e-6, 'M_arms must equal 1.0 at logarithmic spiral crest');
});

test('T_U41_07_HUBBLE_MORPHOLOGY_FAMILY_COVERAGE: covers all required Hubble morphological types', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0xdead_beef_cafe_baben;

  const observedMorphologies = new Set<HubbleMorphology>();
  const observedFamilies = new Set<string>();

  // Sample 200 galaxies across varying cells
  for (let i = 1; i <= 200; i++) {
    const cell: BigInt3 = { x: BigInt(i), y: BigInt(i * 3), z: BigInt(-i * 2) };
    const gal = generator.generateGalaxy(universeSeed, cell, 0);
    observedMorphologies.add(gal.morphology);
    observedFamilies.add(gal.family);

    // Verify morphological structural consistency
    if (gal.family === 'elliptical') {
      assert.equal(gal.disk.hasDisk, false, 'Ellipticals must not have a stellar disk');
      assert.equal(gal.bar.active, false, 'Ellipticals must not have a central bar');
      assert.equal(gal.spiralArms.active, false, 'Ellipticals must not have spiral arms');
    }

    if (gal.family === 'lenticular') {
      assert.equal(gal.disk.hasDisk, true, 'Lenticulars must have a disk');
      assert.equal(gal.spiralArms.active, false, 'Lenticulars must not have spiral arms');
    }

    if (gal.family === 'barred-spiral') {
      assert.equal(gal.bar.active, true, 'Barred spirals must have an active central bar');
      assert.equal(gal.disk.hasDisk, true, 'Barred spirals must have a disk');
      assert.equal(gal.spiralArms.active, true, 'Barred spirals must have active spiral arms');
    }

    if (gal.family === 'spiral') {
      assert.equal(gal.disk.hasDisk, true, 'Spirals must have a disk');
      assert.equal(gal.spiralArms.active, true, 'Spirals must have spiral arms');
    }
  }

  // Verify all 5 families are generated across cosmological cells
  assert.ok(observedFamilies.has('elliptical'), 'Must generate elliptical galaxies');
  assert.ok(observedFamilies.has('lenticular'), 'Must generate lenticular galaxies');
  assert.ok(observedFamilies.has('spiral'), 'Must generate spiral galaxies');
  assert.ok(observedFamilies.has('barred-spiral'), 'Must generate barred spiral galaxies');
  assert.ok(observedFamilies.has('irregular'), 'Must generate irregular galaxies');
});

test('T_U41_08_PRESERVATION_OF_CANONICAL_ENTITIES: Local Group cell preserves Milky Way, Andromeda, M33, LMC, SMC', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0x1234_5678n;
  const localCell: BigInt3 = { x: 0n, y: 0n, z: 0n };

  // 1. Milky Way
  const mw = generator.generateGalaxy(universeSeed, localCell, 0);
  assert.equal(mw.id, 'milky_way');
  assert.equal(mw.name, 'Milky Way');
  assert.equal(mw.isKnownAstronomicalEntity, true);
  assert.equal(mw.family, 'barred-spiral');
  assert.equal(mw.diameterLy, 100_000);
  assert.equal(mw.thicknessLy, 1_000);
  assert.equal(mw.centralBlackHole?.id, 'sgra');
  assert.equal(mw.centralBlackHole?.massSolar, 4.15e6);

  // Verifies adapter returns the EXACT LOCAL_GROUP_CATALOG reference for MW
  const mwDef = generator.toGalaxyDefinition(mw);
  const mwCatalog = LOCAL_GROUP_CATALOG.find((g) => g.id === 'milky_way')!;
  assert.equal(mwDef, mwCatalog, 'Milky Way definition must be returned verbatim from LOCAL_GROUP_CATALOG');

  // 2. Andromeda
  const andromeda = generator.generateGalaxy(universeSeed, localCell, 1);
  assert.equal(andromeda.id, 'andromeda');
  assert.equal(andromeda.name, 'Andromeda');
  assert.equal(andromeda.isKnownAstronomicalEntity, true);
  assert.equal(andromeda.family, 'spiral');
  assert.equal(andromeda.diameterLy, 220_000);
  assert.equal(andromeda.thicknessLy, 2_000);
  assert.equal(andromeda.centralBlackHole?.id, 'm31_smbh');
  assert.equal(andromeda.centralBlackHole?.massSolar, 1.0e8);

  const andDef = generator.toGalaxyDefinition(andromeda);
  const andCatalog = LOCAL_GROUP_CATALOG.find((g) => g.id === 'andromeda')!;
  assert.equal(andDef, andCatalog, 'Andromeda definition must be returned verbatim from LOCAL_GROUP_CATALOG');

  // 3. Triangulum (M33)
  const m33 = generator.generateGalaxy(universeSeed, localCell, 2);
  assert.equal(m33.id, 'triangulum');
  assert.equal(m33.isKnownAstronomicalEntity, true);
  assert.equal(m33.morphology, 'Sc');

  // 4. LMC & SMC
  const lmc = generator.generateGalaxy(universeSeed, localCell, 3);
  const smc = generator.generateGalaxy(universeSeed, localCell, 4);
  assert.equal(lmc.id, 'lmc');
  assert.equal(lmc.family, 'irregular');
  assert.equal(smc.id, 'smc');
  assert.equal(smc.family, 'irregular');

  // Local Group cell count
  assert.equal(generator.getGalaxyCountInCell(universeSeed, localCell), 5);
});

test('T_U41_09_ON_DEMAND_GENERATION_THROUGHPUT: generates galaxies within target timing budget', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0x8888_7777_6666_5555n;

  const count = 500;
  const start = performance.now();

  for (let i = 0; i < count; i++) {
    const cell: BigInt3 = { x: BigInt(i), y: 0n, z: 0n };
    const gal = generator.generateGalaxy(universeSeed, cell, 0);
    // Evaluate density at 3 points
    generator.calculateDensity(gal, [0, 0, 0]);
    generator.calculateDensity(gal, [10_000 * LIGHT_YEAR_M, 0, 0]);
    generator.calculateDensity(gal, [50_000 * LIGHT_YEAR_M, 0, 0]);
  }

  const durationMs = performance.now() - start;
  const avgMsPerGalaxy = durationMs / count;

  // Generous upper ceiling (1.5 ms) prevents CI flakiness while asserting on-demand responsiveness
  assert.ok(
    avgMsPerGalaxy < 1.5,
    `Average generation time must be < 1.5 ms (measured: ${avgMsPerGalaxy.toFixed(4)} ms)`,
  );
});

test('T_U41_10_ADAPTER_TO_GALAXY_DEFINITION_COMPATIBILITY: produces valid GalaxyDefinition objects with procedural profile', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0x4321_8765n;
  const cell: BigInt3 = { x: 7n, y: -14n, z: 21n };

  const proceduralGal = generator.generateGalaxy(universeSeed, cell, 0);
  const galDef = generator.toGalaxyDefinition(proceduralGal);

  assert.equal(galDef.id, proceduralGal.id);
  assert.equal(galDef.name, proceduralGal.name);
  assert.equal(galDef.diameterLy, proceduralGal.diameterLy);
  assert.equal(galDef.thicknessLy, proceduralGal.thicknessLy);
  assert.ok(
    ['barred-spiral', 'spiral', 'elliptical', 'irregular'].includes(galDef.type),
    `galDef.type must be valid: got ${galDef.type}`,
  );
  assert.equal(galDef.densityProfile, 'procedural');
  assert.ok(galDef.proceduralMorphology !== undefined);
  assert.ok(Number.isFinite(galDef.positionM[0]));
  assert.ok(Number.isFinite(galDef.positionM[1]));
  assert.ok(Number.isFinite(galDef.positionM[2]));
});

/* ========================================================================== */
/* U4.1.1 Hardening Tests: Coordinates, Identity, Hash, Runtime Integration   */
/* ========================================================================== */

test('T_U411_01_COSMOLOGICAL_CELL_SPATIAL_IDENTITY: different cells with identical local offset receive distinct positionM', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0x5555_6666_7777_8888n;

  // Create two cells
  const cellA: BigInt3 = { x: 10n, y: 0n, z: 0n };
  const cellB: BigInt3 = { x: 20n, y: 0n, z: 0n };

  const galA = generator.generateGalaxy(universeSeed, cellA, 0);
  const galB = generator.generateGalaxy(universeSeed, cellB, 0);

  // Even if they had the exact same localCellMpc, positionM must differ by cell delta * cell size
  const defA = generator.toGalaxyDefinition(galA);
  const defB = generator.toGalaxyDefinition(galB);

  assert.notEqual(
    defA.positionM[0],
    defB.positionM[0],
    'Galaxies in cell.x=10 and cell.x=20 must have distinct X coordinates in positionM',
  );

  const deltaXMetres = Math.abs(defB.positionM[0] - defA.positionM[0]);
  // 10 cells difference = 10 * 2.0 Mpc = 20 Mpc ≈ 6.17e23 metres. Local offset is at most ±1.8 Mpc
  assert.ok(
    deltaXMetres > 15 * COSMOLOGICAL_CELL_SIZE_MPC * (1_000_000 * 3.08e16),
    'Distance between cells must reflect cosmological cell grid separation',
  );
});

test('T_U411_02_HASH_NO_2_POW_64_ALIASING_AND_CANONICAL_VECTORS: full magnitude encoding prevents 2^64 hash collision', () => {
  const universeSeed = 0x1234_5678n;

  const cellZero: BigInt3 = { x: 0n, y: 0n, z: 0n };
  const cell2Pow64: BigInt3 = { x: 18_446_744_073_709_551_616n, y: 0n, z: 0n }; // 2^64
  const cell2Pow64Plus1: BigInt3 = { x: 18_446_744_073_709_551_617n, y: 0n, z: 0n }; // 2^64 + 1

  const hashZero = hashCosmologicalCell(universeSeed, cellZero, 0);
  const hash2Pow64 = hashCosmologicalCell(universeSeed, cell2Pow64, 0);
  const hash2Pow64Plus1 = hashCosmologicalCell(universeSeed, cell2Pow64Plus1, 0);

  assert.notEqual(
    hashZero,
    hash2Pow64,
    'cell.x=0n and cell.x=2^64 must NOT collide (proves full magnitude encoding)',
  );
  assert.notEqual(
    hash2Pow64,
    hash2Pow64Plus1,
    'cell.x=2^64 and cell.x=2^64+1 must NOT collide',
  );

  // Version check
  assert.equal(GALAXY_GENERATOR_VERSION, 2, 'GALAXY_GENERATOR_VERSION must be 2');
});

test('T_U411_03_GALAXY_INDEX_DOMAIN_VALIDATION: throws RangeError on invalid or out-of-domain indices', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0x9999n;
  const cell: BigInt3 = { x: 5n, y: 5n, z: 5n };

  assert.throws(
    () => generator.generateGalaxy(universeSeed, cell, -1),
    RangeError,
    'Negative index must throw RangeError',
  );

  assert.throws(
    () => generator.generateGalaxy(universeSeed, cell, 1.5),
    RangeError,
    'Fractional index must throw RangeError',
  );

  assert.throws(
    () => generator.generateGalaxy(universeSeed, cell, GALAXY_INDEX_MAX + 1),
    RangeError,
    'Index exceeding GALAXY_INDEX_MAX must throw RangeError',
  );
});

test('T_U411_04_BOUNDED_FLOAT_DOMAIN_AND_EXPLICIT_REFUSAL: rejects cells outside float domain without returning false positions', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0x7777n;

  // Cell at distance > COSMOLOGICAL_FLOAT_DOMAIN_MAX_CELLS (1024 cells)
  const farCell: BigInt3 = { x: 2_000n, y: 0n, z: 0n };
  assert.equal(isCellInFloatDomain(farCell), false);

  const farGal = generator.generateGalaxy(universeSeed, farCell, 0);

  // tryToGalaxyDefinition must return ok: false
  const tryDef = generator.tryToGalaxyDefinition(farGal);
  assert.equal(tryDef.ok, false);
  if (!tryDef.ok) {
    assert.equal(tryDef.reason, 'cell-outside-float-domain');
  }

  // toGalaxyDefinition must throw RangeError
  assert.throws(
    () => generator.toGalaxyDefinition(farGal),
    RangeError,
    'toGalaxyDefinition must throw RangeError for cell outside float domain',
  );

  // But relative separation between two distant cells whose delta is small must succeed
  const addressA: CosmologicalAddress = { cell: { x: 1_000_000n, y: 0n, z: 0n }, localMpc: [0, 0, 0] };
  const addressB: CosmologicalAddress = { cell: { x: 1_000_002n, y: 0n, z: 0n }, localMpc: [0, 0, 0] };

  const deltaM = cosmologicalSeparationVectorM(addressA, addressB);
  assert.ok(deltaM !== undefined);
  assert.ok(Math.abs(deltaM[0] - 2 * COSMOLOGICAL_CELL_SIZE_M) < 1e12);
});

test('T_U411_05_GALAXY_RUNTIME_PRESERVES_PROCEDURAL_MORPHOLOGY: GalaxyRuntime.densityAtLocal delegates to specific morphology', () => {
  const generator = new ProceduralGalaxyGenerator();
  const universeSeed = 0x3333_4444n;
  const cell: BigInt3 = { x: 15n, y: -20n, z: 8n };

  const gal = generator.generateGalaxy(universeSeed, cell, 0);
  const galDef = generator.toGalaxyDefinition(gal);

  assert.ok(galDef.proceduralMorphology !== undefined);
  assert.equal(galDef.densityProfile, 'procedural');

  // Instantiate GalaxyRuntime with the definition
  const runtime = new GalaxyRuntime(galDef);

  // Evaluate density at multiple positions and verify it matches generator.calculateDensity
  const samplePositionsM: Vec3[] = [
    [0, 0, 0],
    [5_000 * LIGHT_YEAR_M, 10_000 * LIGHT_YEAR_M, 500 * LIGHT_YEAR_M],
    [30_000 * LIGHT_YEAR_M, 0, 0],
  ];

  for (const pos of samplePositionsM) {
    const runtimeDensity = runtime.densityAtLocal(pos);
    const directDensity = generator.calculateDensity(gal, pos);
    assert.equal(
      runtimeDensity,
      directDensity,
      'GalaxyRuntime.densityAtLocal must evaluate proceduralMorphology directly',
    );
  }
});
