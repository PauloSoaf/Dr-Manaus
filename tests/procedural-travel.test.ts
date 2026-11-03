import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { UniversalTargetCatalog, SOLAR_TARGET_ADDRESS } from '../src/world/travel/UniversalTargetCatalog';
import { UniversalTravelController, type PreparedTravelDestination } from '../src/world/travel/UniversalTravelController';
import { createTravelPlan, hypercruiseDuration } from '../src/world/travel/UniversalTravelPlan';
import {
  GalaxyEntryResolver,
  andromedaEntryDescriptor,
  proceduralGalaxyEntryDescriptor,
} from '../src/world/travel/GalaxyEntryResolver';
import { ProceduralSystemMaterializer, safeSystemArrivalM } from '../src/world/runtime/ProceduralSystemMaterializer';
import { GalaxyMaterializer } from '../src/world/galaxy/GalaxyMaterializer';
import { knownGalaxyRuntime, registerGalaxyRuntime, clearGalaxyRuntimes } from '../src/world/galaxy/GalaxyRuntime';
import { galaxyDefinition, addressSeparationM, galaxyCosmologicalAddress } from '../src/world/galaxy/GalaxyCoordinates';
import { generateStarSector } from '../src/world/celestial/StarSector';
import { sectorIndex, sectorKey } from '../src/world/spatial/UniverseAddress';
import { LIGHT_YEAR_M } from '../src/world/spatial/units';
import { LOCAL_GROUP_CATALOG } from '../src/world/celestial/GalaxyDefinition';
import { ProceduralGalaxyDiscovery, DEFAULT_UNIVERSE_SEED } from '../src/world/galaxy/ProceduralGalaxyDiscovery';
import { COSMOLOGICAL_CELL_SIZE_M } from '../src/world/galaxy/ProceduralGalaxyGenerator';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver';

const safety = { grounded: false, localPhysics: false, landing: false, collision: false };
const fixtures: Array<ReturnType<typeof createTestFixture>> = [];

function createTestFixture(prepareHook?: (p: any) => PreparedTravelDestination | Promise<PreparedTravelDestination>) {
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
  const arrived: any[] = [];
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
  assert.ok(entry1.system.bodies.length > 0);

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

  // Return to Milky Way
  const mwTarget = f.catalog.target('milky_way')!;
  assert.equal(f.c.start(mwTarget, safety), 'started');
  finish(f);
  assert.equal(f.u.activeGalaxy.id, 'milky_way');
  assert.equal(f.u.address.systemId, 'sol');
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
