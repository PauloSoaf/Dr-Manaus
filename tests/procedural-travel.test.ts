import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { UniversalTargetCatalog, SOLAR_TARGET_ADDRESS } from '../src/world/travel/UniversalTargetCatalog';
import { UniversalTravelController, type PreparedTravelDestination } from '../src/world/travel/UniversalTravelController';
import { createTravelPlan, hypercruiseDuration, type UniversalTravelPlan } from '../src/world/travel/UniversalTravelPlan';
import {
  GalaxyEntryResolver,
  andromedaEntryDescriptor,
  proceduralGalaxyEntryDescriptor,
  hasProceduralGalaxyEntry,
  peekProceduralGalaxyEntry,
  clearGalaxyEntryCache,
} from '../src/world/travel/GalaxyEntryResolver';
import { NavigationTargetState } from '../src/world/travel/NavigationLock';
import { ProceduralSystemMaterializer, safeSystemArrivalM } from '../src/world/runtime/ProceduralSystemMaterializer';
import { GalaxyMaterializer } from '../src/world/galaxy/GalaxyMaterializer';
import { GalaxyProvider } from '../src/world/providers/GalaxyProvider';
import { knownGalaxyRuntime, registerGalaxyRuntime, clearGalaxyRuntimes } from '../src/world/galaxy/GalaxyRuntime';
import { galaxyDefinition, addressSeparationM, galaxyCosmologicalAddress, galaxyLocalPositionM, clearProceduralGalaxyDefinitions } from '../src/world/galaxy/GalaxyCoordinates';
import { generateStarSector, STARS_PER_SECTOR_BASE } from '../src/world/celestial/StarSector';
import { sectorIndex, sectorKey } from '../src/world/spatial/UniverseAddress';
import { LIGHT_YEAR_M } from '../src/world/spatial/units';
import { LOCAL_GROUP_CATALOG } from '../src/world/celestial/GalaxyDefinition';
import { ProceduralGalaxyDiscovery, DEFAULT_UNIVERSE_SEED } from '../src/world/galaxy/ProceduralGalaxyDiscovery';
import { COSMOLOGICAL_CELL_SIZE_M, evaluateProceduralDensity } from '../src/world/galaxy/ProceduralGalaxyGenerator';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver';
import { bodyProfile } from '../src/world/celestial/CelestialBodyProfile';

const safety = { grounded: false, localPhysics: false, landing: false, collision: false };
const fixtures: Array<ReturnType<typeof createTestFixture>> = [];

function createTestFixture(prepareHook?: (plan: UniversalTravelPlan) => PreparedTravelDestination | Promise<PreparedTravelDestination>) {
  const catalog = new UniversalTargetCatalog();
  const u = new UniverseRuntime();
  const root = new Group();
  const g = new GalaxyMaterializer(u, root);
  const initial = g.prepare('milky_way');
  initial.install();
  initial.activate();
  initial.complete?.();
  const noop = { install: () => {}, activate: () => {}, dispose: () => {} };
  const m = new ProceduralSystemMaterializer(u, catalog, noop, () => noop, undefined, g);
  u.installSystem(u.solarSystem, SOLAR_TARGET_ADDRESS, safeSystemArrivalM(u.solarSystem));
  let calls = 0;
  const arrived: UniversalTravelPlan[] = [];
  const c = new UniversalTravelController(u, catalog, {
    prepare: (plan) => {
      calls++;
      return prepareHook ? prepareHook(plan) : m.prepareTravel(plan.resolvedDestination);
    },
    arrived: (plan) => arrived.push(plan),
  });
  const f = { u, g, m, c, catalog, root, arrived, get calls() { return calls; } };
  fixtures.push(f);
  return f;
}

test.afterEach(() => {
  for (const f of fixtures.splice(0)) {
    f.c.dispose();
    f.m.current?.dispose();
    f.g.current?.dispose();
    f.u.dispose();
  }
});

function until(f: ReturnType<typeof createTestFixture>, predicate: () => boolean, dt = 1 / 60) {
  for (let i = 0; i < 10000 && !predicate(); i++) f.c.update(dt);
  assert.ok(predicate(), 'Predicate timed out in test runner');
}

const finish = (f: ReturnType<typeof createTestFixture>, dt = 1 / 60) => until(f, () => !f.c.active, dt);

test('T_U44_01_DYNAMIC_GALAXY_RUNTIME_REGISTRATION', () => {
  // Resolving procedural galaxy ID into definition and runtime
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const def = galaxyDefinition(procGalaxyId);
  assert.ok(def, 'galaxyDefinition must resolve procedural ID');
  assert.equal(def.id, procGalaxyId);
  assert.equal(def.densityProfile, 'procedural');
  assert.ok(def.proceduralMorphology);
  assert.equal(def.proceduralMorphology.cell.x, 10n);
  assert.equal(def.proceduralMorphology.cell.y, 20n);
  assert.equal(def.proceduralMorphology.cell.z, 30n);

  const runtime = knownGalaxyRuntime(procGalaxyId);
  assert.ok(runtime, 'knownGalaxyRuntime must instantiate runtime for procedural galaxy');
  assert.equal(runtime.id, procGalaxyId);
  assert.equal(runtime.definition, def);

  // Re-query returns cached runtime
  const runtime2 = knownGalaxyRuntime(procGalaxyId);
  assert.equal(runtime, runtime2);
});

test('T_U44_02_CANONICAL_GALAXIES_PRESERVATION', () => {
  // Milky Way
  const mw = galaxyDefinition('milky_way');
  assert.ok(mw);
  assert.equal(mw.id, 'milky_way');
  assert.equal(mw.densityProfile, 'milky-way');
  assert.ok(mw.centralBlackHole);
  assert.equal(mw.centralBlackHole.id, 'sgra');
  assert.equal(LOCAL_GROUP_CATALOG[0].id, 'milky_way');

  // Andromeda
  const andromeda = galaxyDefinition('andromeda');
  assert.ok(andromeda);
  assert.equal(andromeda.id, 'andromeda');
  assert.equal(andromeda.densityProfile, 'andromeda');
  assert.ok(andromeda.centralBlackHole);
  assert.equal(andromeda.centralBlackHole.id, 'm31_smbh');

  // Runtimes
  const mwRuntime = knownGalaxyRuntime('milky_way');
  assert.ok(mwRuntime);
  assert.equal(mwRuntime.id, 'milky_way');
  assert.equal(mwRuntime.centralBlackHole?.id, 'sgra');
});

test('T_U44_03_STELLAR_GENERATION_CONFORMS_TO_PROCEDURAL_MORPHOLOGY', () => {
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const galaxy = knownGalaxyRuntime(procGalaxyId)!;
  assert.ok(galaxy);

  // Sector near galactic center: should have stars from bulge / inner disk
  const coreSector = sectorIndex(0n, 0n, 0n);
  const coreContent = galaxy.generateSector(coreSector);
  assert.equal(coreContent.galaxyId, procGalaxyId);
  assert.ok(coreContent.stars.length > 0, 'Core sector should contain stars');

  // Verify evaluateProceduralDensity scale is NOT duplicated in generateStarSector:
  const galacticCentrePosM = galaxyLocalPositionM(galaxy.definition, coreSector);
  const rawDensity = evaluateProceduralDensity(galaxy.definition.proceduralMorphology!, galacticCentrePosM);
  const expectedStars = Math.min(2000, Math.round(STARS_PER_SECTOR_BASE * rawDensity));
  assert.equal(coreContent.stars.length, expectedStars, 'Sector stars must match single-scaled morphology density with cap');

  // Sector far out in halo: density must drop significantly
  const farSector = sectorIndex(1000n, 1000n, 1000n);
  const farContent = galaxy.generateSector(farSector);
  assert.ok(farContent.stars.length < coreContent.stars.length, 'Far halo density must be lower than core density');

  // Determinism check: repeating the generation yields identical star count and IDs
  const coreRepeat = galaxy.generateSector(coreSector);
  assert.equal(coreRepeat.stars.length, coreContent.stars.length);
  assert.equal(coreRepeat.stars[0].id, coreContent.stars[0].id);
  assert.deepEqual(coreRepeat.stars[0].offsetM, coreContent.stars[0].offsetM);
});

test('T_U44_04_DETERMINISTIC_ENTRY_SYSTEM_RESOLUTION', () => {
  const catalog = new UniversalTargetCatalog();
  const procGalaxyId = 'galaxy_c10_20_30_0';

  const entry1 = proceduralGalaxyEntryDescriptor(procGalaxyId, catalog);
  assert.ok(entry1);
  assert.ok(entry1.star.id);
  assert.equal(entry1.address.galaxyId, procGalaxyId);
  assert.ok(entry1.star.planetCount > 0, 'Entry star must have planets');
  assert.ok(entry1.system.bodies.length > 0);
  assert.ok(entry1.system.bodies.some(b => bodyProfile(b).bodyClass === 'rocky'), 'Entry system must have rocky body');
  assert.ok(entry1.system.bodies.some(b => b.id !== entry1.star.id && bodyProfile(b).canLand), 'Entry system must have landable body');

  // Deterministic repeatability across multiple invocations
  const entry2 = proceduralGalaxyEntryDescriptor(procGalaxyId, catalog);
  assert.equal(entry1.star.id, entry2.star.id);
  assert.equal(entry1.address.sector.x, entry2.address.sector.x);
  assert.equal(entry1.address.sector.y, entry2.address.sector.y);
  assert.equal(entry1.address.sector.z, entry2.address.sector.z);

  // Entry resolver integration
  const resolver = new GalaxyEntryResolver(catalog);
  const target = catalog.target(procGalaxyId)!;
  const resolvedTarget = resolver.resolve(target);
  assert.equal(resolvedTarget.kind, 'system');
  assert.equal(resolvedTarget.galaxyId, procGalaxyId);
  assert.equal(resolvedTarget.systemId, entry1.star.id);
});

test('T_U44_05_PROCEDURAL_TRAVEL_ROUTE_PLANNING', () => {
  const f = createTestFixture();
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const target = f.catalog.target(procGalaxyId)!;
  assert.ok(target);

  const plan = createTravelPlan(f.u, f.catalog, target, 'test-proc-plan');
  assert.equal(plan.domain, 'intergalactic');
  assert.ok(plan.logicalDistanceM > 0);
  assert.equal(plan.destination.address.galaxyId, procGalaxyId);
  assert.ok(plan.durationS >= 15 && plan.durationS <= 30);
  assert.equal(plan.arrivalPolicy, 'safe-system-corridor');
});

test('T_U44_06_TRANSACTIONAL_PREPARATION_AND_INSTALLATION', () => {
  const f = createTestFixture();
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const target = f.catalog.target(procGalaxyId)!;

  const plan = createTravelPlan(f.u, f.catalog, target, 'plan-prep');
  const prep = f.m.prepareTravel(plan.resolvedDestination);
  assert.ok(prep.ready);

  // Commit transactional installation
  prep.commit();

  // Universe state after installation
  assert.equal(f.u.activeGalaxy.id, procGalaxyId);
  assert.equal(f.u.address.galaxyId, procGalaxyId);
  assert.equal(f.u.address.systemId, plan.resolvedDestination.systemId);
  assert.equal(f.u.player.frame, f.u.activeSystem.systemFrameId);
  assert.equal(f.g.current?.galaxy.id, procGalaxyId);
});

test('T_U44_07_SAFE_ARRIVAL_CORRIDOR_AND_ZERO_VELOCITY', () => {
  const f = createTestFixture();
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const target = f.catalog.target(procGalaxyId)!;

  assert.equal(f.c.start(target, safety), 'started');
  finish(f);

  assert.equal(f.u.activeGalaxy.id, procGalaxyId);
  assert.equal(f.u.player.frame, f.u.activeSystem.systemFrameId);

  // Position is outside stellar center and orbital extents
  const distFromStar = Math.hypot(...f.u.player.position);
  assert.ok(distFromStar > 1e10, 'Player should arrive outside stellar core');

  // Velocity is exactly zero
  assert.deepEqual(f.u.localVelocityMps, [0, 0, 0], 'Arrival velocity must be zero');
  assert.equal(f.m.qaArrivalMode, false);
});

test('T_U44_08_RETURN_TRIP_TO_SOLAR_SYSTEM', () => {
  const f = createTestFixture();
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const procTarget = f.catalog.target(procGalaxyId)!;

  // 1. Travel from Sol to Procedural Galaxy
  assert.equal(f.c.start(procTarget, safety), 'started');
  finish(f);
  assert.equal(f.u.activeGalaxy.id, procGalaxyId);

  // 2. Return from Procedural Galaxy to Sol
  const solTarget = f.catalog.target('sol')!;
  assert.ok(solTarget);
  assert.equal(f.c.start(solTarget, safety), 'started');
  finish(f);

  // Verify full restoration of Solar System
  assert.equal(f.u.activeGalaxy.id, 'milky_way');
  assert.equal(f.u.activeSystem, f.u.solarSystem);
  assert.equal(f.u.address.galaxyId, 'milky_way');
  assert.equal(f.u.address.systemId, 'sol');
  assert.equal(f.u.player.frame, f.u.solarSystem.systemFrameId);
  assert.deepEqual(f.u.localVelocityMps, [0, 0, 0]);
});

test('T_U44_09_CANCEL_AND_RESUME_PROCEDURAL_HYPERCRUISE', () => {
  const f = createTestFixture();
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const target = f.catalog.target(procGalaxyId)!;

  assert.equal(f.c.start(target, safety), 'started');
  f.c.update(9); // Accelerate into cruise
  assert.ok(f.c.state!.progress > 0.1);

  // Cancel cruise -> emergency deceleration
  f.c.cancel();
  f.c.update(0.2);
  f.c.update(1.0);
  assert.equal(f.c.state!.phase, 'coasting');
  const coastProgress = f.c.state!.progress;

  // Coasting holds progress and keeps transit mode
  f.c.update(50);
  assert.equal(f.c.state!.progress, coastProgress);
  assert.equal(f.u.locationMode, 'transit');

  // Resume flight toward destination
  assert.equal(f.c.start(target, safety), 'resumed');
  assert.equal(f.c.state!.progress, coastProgress);

  finish(f);
  assert.equal(f.u.activeGalaxy.id, procGalaxyId);
});

test('T_U44_10_TRANSACTIONAL_ROLLBACK_ON_PREPARATION_FAILURE', () => {
  const f = createTestFixture(() => {
    throw new Error('Simulated asset materialization failure');
  });
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const target = f.catalog.target(procGalaxyId)!;
  const initialFrames = [...f.u.frames.ids];

  assert.equal(f.c.start(target, safety), 'started');
  f.c.update(100);

  // Hypercruise hits arrival-hold and records preparationError without partial commit
  assert.equal(f.c.state!.phase, 'arrival-hold');
  assert.match(f.c.state!.preparationError!, /Simulated asset materialization failure/);
  assert.equal(f.u.activeGalaxy.id, 'milky_way');
  assert.deepEqual([...f.u.frames.ids], initialFrames);
});

test('T_U44_11_REPEATED_JOURNEYS_WITHOUT_PROVIDER_LEAKS', () => {
  const f = createTestFixture();
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const procTarget = f.catalog.target(procGalaxyId)!;
  const solTarget = f.catalog.target('sol')!;

  // Sol -> Proc
  assert.equal(f.c.start(procTarget, safety), 'started');
  finish(f);
  assert.equal(f.u.activeGalaxy.id, procGalaxyId);

  // Proc -> Sol
  assert.equal(f.c.start(solTarget, safety), 'started');
  finish(f);
  assert.equal(f.u.activeGalaxy.id, 'milky_way');

  // Sol -> Proc again
  assert.equal(f.c.start(procTarget, safety), 'started');
  finish(f);
  assert.equal(f.u.activeGalaxy.id, procGalaxyId);

  // Verify only one star sector provider registered
  const providers = f.u.providers.all;
  const sectorProviders = providers.filter(p => p.id.startsWith('galaxy/star-sectors'));
  assert.equal(sectorProviders.length, 1, 'Only one star sector provider should remain registered');
});

test('T_U44_12_COSMOLOGICAL_DISTANCES_AND_BIGINT_SAFETY', () => {
  // Reachable target in cell (10, 20, 30)
  const reachableDist = addressSeparationM(
    SOLAR_TARGET_ADDRESS,
    [0, 0, 0],
    { galaxyId: 'galaxy_c10_20_30_0', sector: sectorIndex(0n, 0n, 0n) },
    [0, 0, 0],
  );
  assert.ok(reachableDist !== undefined);
  assert.ok(reachableDist > 0);

  // Verify that local offsets in destination alter addressSeparationM
  const distWithOffset = addressSeparationM(
    SOLAR_TARGET_ADDRESS,
    [0, 0, 0],
    { galaxyId: 'galaxy_c10_20_30_0', sector: sectorIndex(500n, 0n, 0n) },
    [1e12, 0, 0],
  );
  assert.ok(distWithOffset !== undefined);
  assert.notEqual(reachableDist, distWithOffset, 'Local sector and offset displacement must affect total separation');

  // Target far outside safe float/conversion domain (> 1024 cells)
  const unreachableDist = addressSeparationM(
    SOLAR_TARGET_ADDRESS,
    [0, 0, 0],
    { galaxyId: 'galaxy_c2000_3000_4000_0', sector: sectorIndex(0n, 0n, 0n) },
    [0, 0, 0],
  );
  assert.equal(unreachableDist, undefined, 'Separation > 1024 cells must return undefined');

  // Travel plan creation for unreachable target must throw
  const f = createTestFixture();
  const unreachableTarget = f.catalog.target('galaxy_c2000_3000_4000_0')!;
  assert.throws(
    () => createTravelPlan(f.u, f.catalog, unreachableTarget, 'unreachable-plan'),
    /Destination distance unavailable/,
  );
});

test('T_U44_13_PRESERVATION_OF_EARTH_ANDROMEDA_HYPERCRUISE', () => {
  const f = createTestFixture();
  const andromedaTarget = f.catalog.target('andromeda')!;
  const andromedaEntry = andromedaEntryDescriptor(f.catalog);

  assert.equal(f.c.start(andromedaTarget, safety), 'started');
  finish(f);

  assert.equal(f.u.activeGalaxy.id, 'andromeda');
  assert.equal(f.u.address.systemId, andromedaEntry.star.id);

  // Cosmological location in Andromeda must report Andromeda's true cosmological coordinates, not (0,0,0) offset 0
  assert.ok(f.u.location.cosmological);
  assert.equal(f.u.location.cosmological.cell.x, 0n);
  assert.equal(f.u.location.cosmological.cell.y, 0n);
  assert.equal(f.u.location.cosmological.cell.z, 0n);
  assert.deepEqual(f.u.location.cosmological.localMpc, [0, 0.767, 0]);

  // Return to Milky Way
  const mwTarget = f.catalog.target('milky_way')!;
  assert.equal(f.c.start(mwTarget, safety), 'started');
  finish(f);
  assert.equal(f.u.activeGalaxy.id, 'milky_way');
  assert.equal(f.u.address.systemId, 'sol');
  assert.deepEqual(f.u.location.cosmological?.localMpc, [0, 0, 0]);
});

test('T_U44_14_HUD_AND_TELEMETRY_INTEGRITY_POST_ARRIVAL', () => {
  const f = createTestFixture();
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const target = f.catalog.target(procGalaxyId)!;

  assert.equal(f.c.start(target, safety), 'started');
  finish(f);

  // Location telemetry
  assert.equal(f.u.locationMode, 'anchored');
  assert.equal(f.u.location.mode, 'anchored');
  assert.equal(f.u.location.address.galaxyId, procGalaxyId);
  assert.ok(f.u.location.cosmological);
  assert.equal(f.u.location.cosmological.cell.x, 10n);
  assert.equal(f.u.location.cosmological.cell.y, 20n);
  assert.equal(f.u.location.cosmological.cell.z, 30n);

  // Telemetry properties
  const telem = f.u.telemetry;
  assert.equal(telem.frame, f.u.activeSystem.systemFrameId);
  assert.ok(Number.isFinite(telem.altitudeM));
});

test('T_U44_15_MORPHOLOGY_DIVERSITY_ENTRY_VALIDATION', () => {
  const discovery = new ProceduralGalaxyDiscovery();
  const catalog = new UniversalTargetCatalog(undefined, discovery);

  // Discover a cluster of procedural galaxies around cell (1, 2, 3)
  const galaxies = discovery.discoverRegion({ x: 1n, y: 2n, z: 3n }, 2, 16);
  assert.ok(galaxies.length >= 4, 'Should discover at least 4 procedural galaxies in region');

  let resolvedCount = 0;
  let controlledErrorCount = 0;

  for (const g of galaxies) {
    try {
      const entry = proceduralGalaxyEntryDescriptor(g.id, catalog);
      assert.ok(entry, `Entry descriptor must resolve for ${g.id} (${g.family})`);
      assert.ok(entry.star.planetCount > 0, `Star in ${g.id} must have planets`);
      assert.ok(entry.system.bodies.length > 0, `System in ${g.id} must have bodies`);
      assert.ok(
        entry.system.bodies.some(b => bodyProfile(b).bodyClass === 'rocky'),
        `System in ${g.id} must contain rocky bodies`,
      );
      assert.ok(
        entry.system.bodies.some(b => b.id !== entry.star.id && bodyProfile(b).canLand),
        `System in ${g.id} must contain landable planetary surfaces`,
      );
      resolvedCount++;
    } catch (err: unknown) {
      assert.ok(err instanceof Error);
      assert.match(err.message, /No populated and landable entry system/);
      controlledErrorCount++;
    }
  }

  assert.ok(resolvedCount > 0, 'At least one galaxy in region must resolve a valid entry system');
});

test('T_U44_16_CUSTOM_SEED_CONSISTENCY_AND_AUTHORITY', () => {
  const seedA = 0x1111_2222_3333_4444n;
  const seedB = 0x9999_8888_7777_6666n;

  // 1. Generate and cache definition under seed A
  const discoveryA = new ProceduralGalaxyDiscovery(seedA);
  const catalogA = new UniversalTargetCatalog(undefined, discoveryA);
  const targetId = 'galaxy_c5_5_5_0';

  const targetA = catalogA.find(targetId);
  assert.ok(targetA);
  const defA = galaxyDefinition(targetId);
  assert.ok(defA);
  const runtimeA = knownGalaxyRuntime(targetId);
  assert.ok(runtimeA);
  assert.equal(runtimeA.definition, defA);
  const diameterA = defA.diameterLy;
  const thicknessA = defA.thicknessLy;

  // 2. Switch to seed B using catalog B
  const discoveryB = new ProceduralGalaxyDiscovery(seedB);
  const catalogB = new UniversalTargetCatalog(undefined, discoveryB);

  const targetB = catalogB.find(targetId);
  assert.ok(targetB);
  const defB = galaxyDefinition(targetId);
  assert.ok(defB);
  const runtimeB = knownGalaxyRuntime(targetId);
  assert.ok(runtimeB);
  assert.equal(runtimeB.definition, defB);

  // Different seed produces different galaxy morphology and invalidates old cached definitions and runtimes
  assert.notEqual(defB.diameterLy, diameterA, 'Galaxy definition must differ across seeds');
  assert.notEqual(runtimeB, runtimeA, 'Runtime cache must be invalidated on seed change');

  // 3. Switch back to seed A
  const targetA2 = catalogA.find(targetId);
  assert.ok(targetA2);
  const defA2 = galaxyDefinition(targetId);
  assert.ok(defA2);
  const runtimeA2 = knownGalaxyRuntime(targetId);
  assert.ok(runtimeA2);

  // Reverting to seed A reproduces the exact original parameters
  assert.equal(defA2.diameterLy, diameterA);
  assert.equal(defA2.thicknessLy, thicknessA);
  assert.equal(runtimeA2.definition, defA2);

  // 4. Verify canonical galaxies remain intact
  const mw = galaxyDefinition('milky_way');
  assert.equal(mw?.id, 'milky_way');
  assert.equal(mw?.densityProfile, 'milky-way');
  const m31 = knownGalaxyRuntime('andromeda');
  assert.equal(m31?.id, 'andromeda');

  // Clean up
  clearProceduralGalaxyDefinitions();
  clearGalaxyRuntimes();
  clearGalaxyEntryCache();
});

test('T_U44_17_NEGATIVE_ENTRY_CACHING_PREVENTS_REPEATED_SEARCHES', () => {
  clearGalaxyEntryCache();
  clearGalaxyRuntimes();
  clearProceduralGalaxyDefinitions();

  const seedA = 0x1234_5678_9ABn;
  const seedB = 0x9876_5432_10Fn;
  const discoveryA = new ProceduralGalaxyDiscovery(seedA);
  const catalogA = new UniversalTargetCatalog(undefined, discoveryA);

  // Deterministic fixture: a procedural galaxy defined with no landable stars in candidate sectors
  const entrylessId = 'galaxy_c999_999_999_0';
  const entrylessDef: GalaxyDefinition = {
    id: entrylessId,
    name: 'Entryless Fixture Galaxy',
    addressOriginM: [0, 0, 0],
    type: 'irregular',
    diameterLy: 50_000,
    thicknessLy: 1_000,
    positionM: [1e20, 1e20, 1e20],
    densityProfile: 'procedural',
    universeSeed: seedA,
  };
  registerProceduralGalaxyDefinition(entrylessDef, seedA);

  const entrylessRuntime = new GalaxyRuntime(entrylessDef, seedA);
  let generateSectorCalls = 0;
  // Controlled deterministic sector generator returning 0 candidate stars
  entrylessRuntime.generateSector = (sector) => {
    generateSectorCalls++;
    return { galaxyId: entrylessId, sector, seed: 0n, stars: [] };
  };
  registerGalaxyRuntime(entrylessRuntime, seedA);

  // 1. First query performs the initial search over the 13 candidate sectors
  assert.equal(hasProceduralGalaxyEntry(entrylessId, catalogA), false);
  assert.equal(generateSectorCalls, 13, 'Initial search must inspect exactly the 13 candidate sectors');

  // 2. Failure is stored in negative cache
  assert.equal(peekProceduralGalaxyEntry(entrylessId, seedA), false);

  // 3. One hundred subsequent queries do NOT generate any new sectors (0 additional calls)
  for (let i = 0; i < 100; i++) {
    const result = hasProceduralGalaxyEntry(entrylessId, catalogA);
    assert.equal(result, false);
  }
  assert.equal(generateSectorCalls, 13, 'Cached negative entry must never trigger new sector generation');

  // proceduralGalaxyEntryDescriptor throws cached error immediately without generating sectors
  assert.throws(
    () => proceduralGalaxyEntryDescriptor(entrylessId, catalogA),
    /No populated and landable entry system/,
  );
  assert.equal(generateSectorCalls, 13);

  // 4. A different universe seed has an independent cache (not cached for seedB)
  assert.equal(peekProceduralGalaxyEntry(entrylessId, seedB), undefined, 'Seed B must have independent cache');

  // 5. Negative cache on entrylessId does not prevent valid galaxies from resolving
  const validGalaxyId = 'galaxy_c10_20_30_0';
  assert.equal(hasProceduralGalaxyEntry(validGalaxyId, catalogA), true, 'Valid galaxy must resolve normally');
  assert.equal(peekProceduralGalaxyEntry(validGalaxyId, seedA), true);
});

test('T_U44_18_INTERLEAVED_MULTI_SEED_CATALOG_ISOLATION', () => {
  const seedA = 0xAAAA_1111_2222_3333n;
  const seedB = 0xBBBB_4444_5555_6666n;
  const discoveryA = new ProceduralGalaxyDiscovery(seedA);
  const catalogA = new UniversalTargetCatalog(undefined, discoveryA);
  const discoveryB = new ProceduralGalaxyDiscovery(seedB);
  const catalogB = new UniversalTargetCatalog(undefined, discoveryB);
  const testGalaxyId = 'galaxy_c10_20_30_0';

  // 1. Initial resolution under seed A
  const targetA = catalogA.find(testGalaxyId)!;
  assert.ok(targetA);
  const defA1 = galaxyDefinition(testGalaxyId, seedA)!;
  const runtimeA1 = knownGalaxyRuntime(testGalaxyId, seedA)!;
  assert.equal(runtimeA1.definition, defA1);
  assert.equal(runtimeA1.universeSeed, seedA);

  // 2. Resolution under seed B
  const targetB = catalogB.find(testGalaxyId)!;
  assert.ok(targetB);
  const defB1 = galaxyDefinition(testGalaxyId, seedB)!;
  const runtimeB1 = knownGalaxyRuntime(testGalaxyId, seedB)!;
  assert.equal(runtimeB1.definition, defB1);
  assert.equal(runtimeB1.universeSeed, seedB);

  // Cross-seed identity validation: different universal seeds produce different morphologies and isolated runtimes
  assert.notEqual(defA1.diameterLy, defB1.diameterLy, 'Morphology diameter must differ across universe seeds');
  assert.notEqual(runtimeA1, runtimeB1, 'Runtimes must be isolated by universe seed');

  // 3. Return to seed A: verify warm cache reuses the exact same definition and runtime instances without regeneration
  const defA2 = galaxyDefinition(testGalaxyId, seedA)!;
  const runtimeA2 = knownGalaxyRuntime(testGalaxyId, seedA)!;
  assert.equal(defA2, defA1, 'Cached galaxy definition must be reused identically under same universe seed');
  assert.equal(runtimeA2, runtimeA1, 'Cached galaxy runtime must be reused identically under same universe seed');

  // 4. Return to seed B: verify warm cache reuses seed B instances
  const defB2 = galaxyDefinition(testGalaxyId, seedB)!;
  const runtimeB2 = knownGalaxyRuntime(testGalaxyId, seedB)!;
  assert.equal(defB2, defB1, 'Cached galaxy definition must be reused identically under same universe seed');
  assert.equal(runtimeB2, runtimeB1, 'Cached galaxy runtime must be reused identically under same universe seed');

  // 5. Verify sectors generated from each runtime conform to their respective morphology without cross-pollution
  const sectorZero = sectorIndex(0n, 0n, 0n);
  const sectorA = runtimeA1.generateSector(sectorZero);
  const sectorB = runtimeB1.generateSector(sectorZero);
  assert.equal(sectorA.galaxyId, testGalaxyId);
  assert.equal(sectorB.galaxyId, testGalaxyId);
  // Compare with direct generation using explicit universe seeds
  const expectedSectorA = generateStarSector(testGalaxyId, sectorZero, { universeSeed: seedA });
  const expectedSectorB = generateStarSector(testGalaxyId, sectorZero, { universeSeed: seedB });
  assert.equal(sectorA.stars.length, expectedSectorA.stars.length);
  assert.equal(sectorB.stars.length, expectedSectorB.stars.length);
});

test('T_U44_19_HUD_PER_FRAME_VALIDATION_ZERO_HEAVY_GENERATION', () => {
  const f = createTestFixture();
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const target = f.catalog.target(procGalaxyId)!;
  assert.ok(target);

  const state = new NavigationTargetState();
  state.select(target);
  const resolver = new UniversalTargetResolver(f.catalog, f.u);

  // Instrument runtime to verify 0 sector generations in HUD validation loop
  const runtime = knownGalaxyRuntime(procGalaxyId, f.catalog.discovery.universeSeed)!;
  let sectorGens = 0;
  const origGen = runtime.generateSector.bind(runtime);
  runtime.generateSector = (s, opts) => {
    sectorGens++;
    return origGen(s, opts);
  };

  // Simulate 120 frames (2 seconds at 60 FPS) of NavigationTargetState.validate()
  for (let frame = 0; frame < 120; frame++) {
    state.validate(resolver);
  }

  assert.equal(sectorGens, 0, 'Per-frame target validation must never generate stellar sectors');
  assert.equal(state.current?.key, target.key);
});

test('T_U44_20_PREPARED_DESTINATION_IDENTITY_PRESERVED_DURING_TRAVEL', () => {
  const f = createTestFixture();
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const target = f.catalog.target(procGalaxyId)!;
  assert.ok(target);
  const primarySeed = f.catalog.discovery.universeSeed;

  // 1. Start travel: preparation resolves the entry system and builds the travel plan
  assert.equal(f.c.start(target, safety), 'started');
  const plan = f.c.state!.plan;
  const resolvedStarId = plan.resolvedDestination.systemId;
  assert.ok(resolvedStarId);

  // Capture prepared destination details and stellar population before background seed disruption
  const origDef = galaxyDefinition(procGalaxyId, primarySeed)!;
  const origRuntime = knownGalaxyRuntime(procGalaxyId, primarySeed)!;
  const origSector = origRuntime.generateSector(plan.resolvedDestination.address!.sector);
  const origStar = origSector.stars.find(s => s.id === resolvedStarId)!;
  assert.ok(origStar, 'Prepared star must exist in original sector generation');

  // Advance flight partway into cruise phase
  f.c.update(5);
  assert.equal(f.c.state!.plan.resolvedDestination.systemId, resolvedStarId);

  // 2. Query a foreign catalog with a completely different seed in the background
  const foreignSeed = 0xDEAD_BEEF_CAFE_0001n;
  const foreignDiscovery = new ProceduralGalaxyDiscovery(foreignSeed);
  const foreignCatalog = new UniversalTargetCatalog(undefined, foreignDiscovery);
  foreignCatalog.find(procGalaxyId);
  const foreignDef = galaxyDefinition(procGalaxyId, foreignSeed)!;
  assert.notEqual(foreignDef.diameterLy, origDef.diameterLy, 'Foreign catalog must have distinct morphology');

  // 3. Complete the flight: verify handoff uses the originally prepared session
  finish(f);
  assert.equal(f.u.activeGalaxy.id, procGalaxyId);
  assert.equal(f.u.activeGalaxy.universeSeed, primarySeed, 'Active galaxy must preserve original universeSeed');
  assert.equal(f.u.activeGalaxy.definition.diameterLy, origDef.diameterLy, 'Active galaxy must retain original morphology');
  assert.equal(f.u.address.systemId, resolvedStarId);

  // Confirm identity of system and stellar population
  assert.equal(f.u.activeSystem.bodies[0].id, origStar.id);
  assert.equal(f.u.activeSystem.bodies[0].massKg > 0, true);

  // 4. Safe return to Sol and verify absence of provider leaks
  const solTarget = f.catalog.target('sol')!;
  assert.equal(f.c.start(solTarget, safety), 'started');
  finish(f);
  assert.equal(f.u.activeGalaxy.id, 'milky_way');
  assert.equal(f.u.address.systemId, 'sol');

  const sectorProviders = f.u.providers.all.filter(p => p.id.startsWith('galaxy/star-sectors'));
  assert.equal(sectorProviders.length, 1, 'Only one star sector provider should remain active after return');
});

test('T_U44_21_ACTIVE_GALAXY_LOCATION_AFTER_FOREIGN_CATALOG_QUERY', () => {
  const f = createTestFixture();
  const seedA = f.catalog.discovery.universeSeed;
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const target = f.catalog.target(procGalaxyId)!;
  assert.ok(target);

  // 1. Travel to procedural galaxy under Seed A
  assert.equal(f.c.start(target, safety), 'started');
  finish(f);
  assert.equal(f.u.activeGalaxy.id, procGalaxyId);
  assert.equal(f.u.activeGalaxy.universeSeed, seedA);

  const locA = f.u.location;
  assert.equal(locA.mode, 'anchored');
  assert.ok(locA.cosmological);
  const cellA = locA.cosmological.cell;
  assert.equal(cellA.x, 10n);
  assert.equal(cellA.y, 20n);
  assert.equal(cellA.z, 30n);
  const defA = f.u.activeGalaxy.definition;

  // 2. Query a completely foreign catalog under Seed B in the background
  const seedB = 0x9999_8888_7777_6666n;
  const discoveryB = new ProceduralGalaxyDiscovery(seedB);
  const catalogB = new UniversalTargetCatalog(undefined, discoveryB);
  const targetB = catalogB.find(procGalaxyId);
  assert.ok(targetB);
  const defB = galaxyDefinition(procGalaxyId, seedB)!;
  assert.notEqual(defB.diameterLy, defA.diameterLy);

  // 3. Verify UniverseRuntime.location and activeGalaxy still report Seed A state
  const locAfter = f.u.location;
  assert.equal(locAfter.cosmological.cell.x, 10n);
  assert.equal(locAfter.cosmological.cell.y, 20n);
  assert.equal(locAfter.cosmological.cell.z, 30n);
  assert.deepEqual(locAfter.cosmological.localMpc, locA.cosmological.localMpc);
  assert.equal(f.u.activeGalaxy.universeSeed, seedA);
  assert.equal(f.u.activeGalaxy.definition.diameterLy, defA.diameterLy);

  // 4. Return to Sol safely
  const solTarget = f.catalog.target('sol')!;
  assert.equal(f.c.start(solTarget, safety), 'started');
  finish(f);
  assert.equal(f.u.activeGalaxy.id, 'milky_way');
  assert.equal(f.u.address.systemId, 'sol');
});

test('T_U44_22_GALAXY_PROVIDER_PRESENTATION_ORIENTATION_MULTI_SEED', () => {
  const seedA = 0x1111_2222_3333_4444n;
  const seedB = 0x5555_6666_7777_8888n;
  const root = new Group();

  const defAndromeda = LOCAL_GROUP_CATALOG.find(g => g.id === 'andromeda')!;
  assert.ok(defAndromeda);

  const providerA = new GalaxyProvider(root, { galaxy: defAndromeda, universeSeed: seedA });
  const providerB = new GalaxyProvider(root, { galaxy: defAndromeda, universeSeed: seedB });

  assert.equal(providerA.universeSeed, seedA);
  assert.equal(providerB.universeSeed, seedB);

  // Address in procedural galaxy under seed A vs seed B
  const addressA: import('../src/world/spatial/UniverseAddress').UniverseAddress = {
    galaxyId: 'galaxy_c10_20_30_0',
    sector: sectorIndex(0n, 0n, 0n),
    systemId: 'star_0',
  };

  const camPos: [number, number, number] = [0, 0, 0];
  const altitudeM = 50_000_000;

  // Update providerA with seedA context
  providerA.update(addressA, camPos, altitudeM, [0, 0, 0], (v) => v, undefined, seedA);

  // Update providerB with seedB context
  providerB.update(addressA, camPos, altitudeM, [0, 0, 0], (v) => v, undefined, seedB);

  // Both providers computed valid positions
  assert.ok(providerA.group.visible);
  assert.ok(providerB.group.visible);

  // Clean up
  providerA.dispose();
  providerB.dispose();
});

test('T_U44_23_ROLLBACK_PRESERVES_ORIGIN_UNIVERSE_SEED', () => {
  const f = createTestFixture();
  const seedA = f.catalog.discovery.universeSeed;
  const procGalaxyId = 'galaxy_c10_20_30_0';
  const targetA = f.catalog.target(procGalaxyId)!;
  assert.ok(targetA);

  // 1. Travel and install destination under Seed A
  assert.equal(f.c.start(targetA, safety), 'started');
  finish(f);
  assert.equal(f.u.activeGalaxy.id, procGalaxyId);
  assert.equal(f.u.activeGalaxy.universeSeed, seedA);
  const originDef = f.u.activeGalaxy.definition;
  const originSystemId = f.u.address.systemId;

  // 2. Prepare a new travel session under Seed B that will fail during activation
  const seedB = 0xCAFE_BABE_1234_5678n;
  const discoveryB = new ProceduralGalaxyDiscovery(seedB);
  const catalogB = new UniversalTargetCatalog(undefined, discoveryB);
  const targetB = catalogB.target(procGalaxyId)!;
  assert.ok(targetB);

  const failResources = {
    install: () => {},
    activate: () => { throw new Error('Simulated hardware failure during system activation'); },
    dispose: () => {},
  };
  const matB = new ProceduralSystemMaterializer(f.u, catalogB, failResources, () => failResources, undefined, f.g);

  // Prepare session with failing activation
  const sessionB = matB.prepare(targetB);
  assert.throws(
    () => matB.install(sessionB, false),
    /Simulated hardware failure during system activation/
  );

  // 3. Verify rollback restored origin system under Seed A perfectly
  assert.equal(f.u.activeGalaxy.id, procGalaxyId);
  assert.equal(f.u.activeGalaxy.universeSeed, seedA, 'Rollback must restore origin universeSeed');
  assert.equal(f.u.activeGalaxy.definition.diameterLy, originDef.diameterLy, 'Origin morphology must be preserved');
  assert.equal(f.u.address.systemId, originSystemId, 'Origin system address must be restored');
});


