import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUBBLE_CONSTANT_KM_S_MPC,
  OMEGA_MATTER,
  OMEGA_LAMBDA,
  OMEGA_K,
  OBSERVABLE_HORIZON_MPC,
  CMB_RECOMBINATION_REDSHIFT,
  CMB_TEMPERATURE_K,
  hubbleParameterH,
  lookbackTimeGyr,
  comovingDistanceMpc,
  redshiftFromComovingDistanceMpc,
  evaluateObservableHorizon,
  cosmologicalDistanceMpc,
  evaluateCosmicFilament,
  evaluateCosmicWebCell,
  KNOWN_COSMIC_ANCHORS,
  type CosmicAnchor,
} from '../src/world/cosmology/CosmologicalStructure';
import {
  evaluateCosmologicalNavigation,
  getCosmicAnchorDescriptor,
  isObserverRelativeHorizon,
  resolveCosmologicalAnchorArrival,
} from '../src/world/cosmology/CosmologicalNavigation';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { LargeScaleStructureProvider } from '../src/world/providers/LargeScaleStructureProvider';
import { Group } from 'three/webgpu';

test('T_U6_01_PHYSICAL_COSMOLOGICAL_CONSTANTS_AND_HUBBLE', () => {
  // 1. Cosmological parameters (Planck consensus)
  assert.equal(HUBBLE_CONSTANT_KM_S_MPC, 67.4);
  assert.equal(OMEGA_MATTER, 0.315);
  assert.equal(OMEGA_LAMBDA, 0.685);
  assert.equal(OMEGA_K, 0.0);
  assert.equal(OMEGA_MATTER + OMEGA_LAMBDA + OMEGA_K, 1.0); // Flat universe
  assert.equal(CMB_RECOMBINATION_REDSHIFT, 1089.9);
  assert.equal(CMB_TEMPERATURE_K, 2.7255);

  // 2. Hubble parameter evolution H(z)
  const h0 = hubbleParameterH(0);
  assert.equal(Math.round(h0 * 10) / 10, 67.4);

  const h1 = hubbleParameterH(1);
  // At z = 1: E(1) = sqrt(0.315 * 8 + 0.685) = sqrt(2.52 + 0.685) = sqrt(3.205) ~= 1.790
  // H(1) = 67.4 * 1.790 ~= 120.66 km/s/Mpc
  assert.ok(h1 > 115 && h1 < 125, `Expected H(1) around 120 km/s/Mpc, got ${h1}`);
  assert.ok(h1 > h0, 'H(z) must expand backward in time');

  // 3. Lookback time
  const t0 = lookbackTimeGyr(0);
  assert.equal(t0, 0);

  const t1 = lookbackTimeGyr(1);
  assert.ok(t1 > 7.0 && t1 < 8.5, `Expected lookback time at z=1 around 7.8 Gyr, got ${t1}`);

  const tCmb = lookbackTimeGyr(1089.9);
  assert.ok(tCmb > 13.5 && tCmb < 13.85, `Expected lookback time at CMB near 13.78 Gyr, got ${tCmb}`);
});

test('T_U6_02_OBSERVER_RELATIVE_HORIZON_INVARIANT', () => {
  // Observer A at Local Group
  const observerLocalGroup = {
    cell: { x: 0n, y: 0n, z: 0n },
    localMpc: [0, 0, 0] as [number, number, number],
  };
  const horizonA = evaluateObservableHorizon(observerLocalGroup);

  assert.equal(horizonA.radiusMpc, OBSERVABLE_HORIZON_MPC); // 14,200 Mpc
  assert.ok(horizonA.radiusBly > 45 && horizonA.radiusBly < 47); // ~46.3 Bly
  assert.ok(horizonA.radiusM > 4.3e26 && horizonA.radiusM < 4.5e26); // ~4.38e26 m
  assert.equal(horizonA.cmbRedshift, 1089.9);
  assert.equal(horizonA.cmbTemperatureK, 2.7255);

  // STRICT INVARIANTS:
  // 1. Not a physical container wall
  assert.equal(horizonA.isPhysicalWall, false);
  // 2. No absolute universal center
  assert.equal(horizonA.hasUniversalCenter, false);
  // 3. Horizon center coincides with observer
  assert.deepEqual(horizonA.horizonCenterLocalMpc, [0, 0, 0]);

  // Observer B at distant cosmic cell (e.g. 500 cells away in the cosmic web)
  const observerDeepSpace = {
    cell: { x: 500n, y: -200n, z: 100n },
    localMpc: [1.2, 0.5, -0.8] as [number, number, number],
  };
  const horizonB = evaluateObservableHorizon(observerDeepSpace);

  // Cosmological Principle: Observer B has the exact same physics and horizon radius!
  assert.equal(horizonB.radiusMpc, OBSERVABLE_HORIZON_MPC);
  assert.equal(horizonB.isPhysicalWall, false);
  assert.equal(horizonB.hasUniversalCenter, false);
  assert.deepEqual(horizonB.horizonCenterLocalMpc, [1.2, 0.5, -0.8]);
});

test('T_U6_03_COSMOLOGICAL_DISTANCE_BIGINT_ROUNDTRIP', () => {
  // 1. Invertible comoving distance D_C(z) <-> z
  const testZ = 0.5;
  const dMpc = comovingDistanceMpc(testZ);
  assert.ok(dMpc > 1800 && dMpc < 2100, `Expected D_C(0.5) around 1950 Mpc, got ${dMpc}`);

  const recoveredZ = redshiftFromComovingDistanceMpc(dMpc);
  assert.ok(Math.abs(recoveredZ - testZ) < 0.001, `Recovered z ${recoveredZ} must match ${testZ}`);

  // 2. Cosmological distance with exact BigInt cell coordinates
  const a = {
    cell: { x: 0n, y: 0n, z: 0n },
    localMpc: [0, 0, 0] as [number, number, number],
  };
  const b = {
    cell: { x: 10n, y: 0n, z: 0n }, // 10 cells * 2 Mpc/cell = 20 Mpc
    localMpc: [0, 0, 0] as [number, number, number],
  };
  const dist = cosmologicalDistanceMpc(a, b);
  assert.equal(dist, 20.0);

  // Large BigInt coordinates without truncation
  const distantA = {
    cell: { x: 1000000000n, y: 0n, z: 0n },
    localMpc: [0, 0, 0] as [number, number, number],
  };
  const distantB = {
    cell: { x: 1000000050n, y: 0n, z: 0n }, // 50 cells = 100 Mpc
    localMpc: [0, 0, 0] as [number, number, number],
  };
  const distLarge = cosmologicalDistanceMpc(distantA, distantB);
  assert.equal(distLarge, 100.0);
});

test('T_U6_04_CURATED_COSMIC_ANCHORS_AND_CATALOG_RESOLUTION', () => {
  const catalog = new UniversalTargetCatalog();
  const observer = {
    cell: { x: 0n, y: 0n, z: 0n },
    localMpc: [0, 0, 0] as [number, number, number],
  };

  // 1. Curated Anchors
  assert.ok(KNOWN_COSMIC_ANCHORS.length >= 4);
  const virgo = getCosmicAnchorDescriptor('virgo_cluster');
  assert.ok(virgo);
  assert.equal(virgo.name, 'Virgo Cluster');
  assert.equal(virgo.positionMpc[0], 16.5);

  const norma = getCosmicAnchorDescriptor('norma_cluster');
  assert.ok(norma);
  assert.ok(norma.name.includes('Great Attractor'));
  assert.equal(norma.positionMpc[0], 68);

  const shapley = getCosmicAnchorDescriptor('shapley_supercluster');
  assert.ok(shapley);
  assert.equal(shapley.positionMpc[0], 200);

  // 2. Universal Navigation Target evaluation for Great Attractor
  const normaTarget = catalog.target('norma_cluster')!;
  assert.ok(normaTarget);
  assert.equal(normaTarget.kind, 'cosmic-anchor');

  const navNorma = evaluateCosmologicalNavigation(normaTarget, observer);
  assert.equal(navNorma.isAnchor, true);
  assert.equal(navNorma.isHorizon, false);
  assert.ok(navNorma.distanceMpc! > 60 && navNorma.distanceMpc! < 75);
  assert.equal(navNorma.observationalOnly, true);

  // 3. Observable Horizon navigation evaluation
  const horizonTarget = catalog.target('observable-horizon')!;
  assert.ok(horizonTarget);
  assert.equal(isObserverRelativeHorizon(horizonTarget), true);

  const navHorizon = evaluateCosmologicalNavigation(horizonTarget, observer);
  assert.equal(navHorizon.isHorizon, true);
  assert.equal(navHorizon.distanceMpc, OBSERVABLE_HORIZON_MPC);
  assert.equal(navHorizon.horizonState.isPhysicalWall, false);
});

test('T_U6_05_COSMIC_FILAMENT_DENSITY_FIELD', () => {
  const localGroup: CosmicAnchor = {
    id: 'local_group',
    name: 'Local Group',
    positionMpc: [0, 0, 0],
    massSolar: 2e12,
  };
  const virgo: CosmicAnchor = {
    id: 'virgo_cluster',
    name: 'Virgo Cluster',
    positionMpc: [16.5, 0, 0],
    massSolar: 1.2e15,
  };

  // 1. Sampling exactly along the filament spine
  const spineSample: [number, number, number] = [8.25, 0, 0];
  const spineEval = evaluateCosmicFilament(spineSample, localGroup, virgo);
  assert.equal(spineEval.distanceToSpineMpc, 0);
  assert.equal(spineEval.density01, 1.0);

  // 2. Sampling 1.5 Mpc away from spine (1 core radius)
  const offSpineSample: [number, number, number] = [8.25, 1.5, 0];
  const offSpineEval = evaluateCosmicFilament(offSpineSample, localGroup, virgo, 1.5);
  assert.equal(Math.round(offSpineEval.distanceToSpineMpc * 100) / 100, 1.5);
  // Gaussian at 1 sigma: exp(-0.5) ~= 0.6065
  assert.ok(Math.abs(offSpineEval.density01 - Math.exp(-0.5)) < 0.001);

  // 3. Sampling 10 Mpc away into the void
  const voidSample: [number, number, number] = [8.25, 10, 0];
  const voidEval = evaluateCosmicFilament(voidSample, localGroup, virgo, 1.5);
  assert.ok(voidEval.density01 < 1e-4, 'Void density must drop to near zero');
});

test('T_U6_06_COSMOLOGICAL_ANCHOR_ARRIVAL_RESOLUTION', () => {
  const norma = getCosmicAnchorDescriptor('norma_cluster')!;
  const arrival = resolveCosmologicalAnchorArrival(norma, [0.1, 0.2, 0.3]);

  // Position: [68.1, -9.8, 20.3] Mpc
  // In 2 Mpc cells: cellX = floor(68.1 / 2) = 34n
  assert.equal(arrival.cell.x, 34n);
  assert.ok(arrival.localMpc[0] >= 0 && arrival.localMpc[0] < 2.0);
  assert.ok(arrival.comovingDistanceM! > 60 * 3e22);
});

test('T_U6_07_LSS_PROVIDER_LIFECYCLE_AND_HORIZON_STATE', () => {
  const root = new Group();
  const lss = new LargeScaleStructureProvider(root, { drawCMB: true });

  assert.equal(lss.stats.clusters, KNOWN_COSMIC_ANCHORS.length);
  assert.equal(lss.stats.filaments, 3);

  const normaField = lss.sampleCell([68, -10, 20], 1);
  assert.ok(normaField.density01 > 0.5, 'known Norma anchor must be a dense real cell');
  assert.ok(normaField.voidFactor01 < 0.5);
  assert.ok(normaField.clusterCandidates.includes('norma_cluster'));

  const voidField = evaluateCosmicWebCell([500, 500, 500], 1);
  assert.ok(voidField.density01 < 1e-6, 'distant empty cells must remain sparse');
  assert.ok(voidField.voidFactor01 > 0.99);
  assert.deepEqual(voidField.filamentDirection, [0, 0, 0]);

  // Evaluates horizon descriptor without throwing
  const horizonDesc = lss.getHorizonDescriptor();
  assert.equal(horizonDesc.radiusMpc, OBSERVABLE_HORIZON_MPC);
  assert.equal(horizonDesc.isPhysicalWall, false);
  assert.equal(horizonDesc.hasUniversalCenter, false);

  // Visibility when not in cosmological domain -> hidden
  lss.update({ galaxyId: 'milky_way', sector: { x: 0n, y: 0n, z: 0n }, bodyId: 'earth' }, [0, 0, 0], 100);
  assert.equal(lss.stats.visible, false);

  // Visibility when in cosmological domain -> visible
  lss.update({ galaxyId: 'cosmology', sector: { x: 0n, y: 0n, z: 0n } }, [0, 0, 0], 100);
  assert.equal(lss.stats.visible, true);

  // Disposal
  lss.dispose();
  assert.equal(root.children.length, 0);
});

