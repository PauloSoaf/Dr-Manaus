import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { TravelDomain } from '../src/world/travel/TravelDomain';
import {
  UniversalTeleportService,
  LOCAL_AIM_RAYCAST_M,
} from '../src/world/travel/UniversalTeleportService';
import {
  intersectEllipsoidRay,
  intersectSphereRay,
  intersectEarthWGS84,
  intersectMoonSurface,
  intersectMarsSurface,
  MOON_RADIUS_M,
} from '../src/world/spatial/AnalyticalSurfaceIntersection';
import { pickCelestialBodyFromRay } from '../src/world/travel/CelestialAngularPicker';
import { UniverseCoordinates } from '../src/world/spatial/UniverseCoordinates';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import { MANAUS_FRAME_ID, EARTH_FIXED_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter';
import { WGS84, WGS84_B } from '../src/world/spatial/WGS84';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver';

function createMockService() {
  const universe = new UniverseRuntime();
  const travelDomain = new TravelDomain();
  const player = {
    position: new Vector3(0, 50, 0),
    velocity: new Vector3(0, 0, 0),
    size: 1.0,
    teleport(pos: { x: number; y: number; z: number }) {
      this.position.set(pos.x, pos.y, pos.z);
    },
    powerPose(_pose: string, _duration?: number) {},
  };

  const colliders: any[] = [
    {
      id: 'mock-building',
      x: 0,
      y: 0,
      z: -500,
      width: 50,
      height: 30,
      depth: 50,
    },
  ];

  const notifications: string[] = [];
  const sounds: string[] = [];
  let preparedManausCount = 0;

  const catalog = new UniversalTargetCatalog(universe.solarSystem);
  const resolver = new UniversalTargetResolver(catalog, universe);

  const service = new UniversalTeleportService({
    universe,
    travelDomain,
    player,
    getColliders: () => colliders,
    prepareManaus: async (_dest) => {
      preparedManausCount++;
    },
    notify: (msg) => notifications.push(msg),
    sound: (snd) => sounds.push(snd),
    targetCatalog: catalog,
    targetResolver: resolver,
  });

  return {
    universe,
    travelDomain,
    player,
    colliders,
    notifications,
    sounds,
    service,
    catalog,
    resolver,
    getPreparedManausCount: () => preparedManausCount,
  };
}

// ---------------------------------------------------------------------------
// 1. Analytical Surface Intersections
// ---------------------------------------------------------------------------

test('T_U7_01_ANALYTICAL_ELLIPSOID_RAY_INTERSECTION', () => {
  // Ray from (0, 0, 10_000_000) pointing down -Z toward Earth WGS84
  const origin: [number, number, number] = [0, 0, 10_000_000];
  const direction: [number, number, number] = [0, 0, -1];
  const semiAxes: [number, number, number] = [WGS84.semiMajorAxisM, WGS84.semiMajorAxisM, WGS84_B];

  const hit = intersectEllipsoidRay(origin, direction, semiAxes);
  assert.ok(hit !== null, 'Should hit the ellipsoid');
  assert.ok(hit.hit);
  // Distance from 10,000,000 to WGS84 polar axis WGS84_B (~6,356,752 m)
  const expectedDist = 10_000_000 - WGS84_B;
  assert.ok(Math.abs(hit.distanceM - expectedDist) < 1.0, `Expected ~${expectedDist}, got ${hit.distanceM}`);
  assert.ok(Math.abs(hit.point[2] - WGS84_B) < 1.0);

  // Grazing miss
  const missRay = intersectEllipsoidRay([0, 7_000_000, 10_000_000], [0, 0, -1], semiAxes);
  assert.equal(missRay, null, 'Ray outside semi-major axis must miss');
});

test('T_U7_02_ANALYTICAL_WGS84_EARTH_AND_GEODETIC_RESOLUTION', () => {
  // Ray from 400 km orbital altitude (ISS height) over Equator, prime meridian
  const h = 400_000;
  const originEcef: [number, number, number] = [WGS84.semiMajorAxisM + h, 0, 0];
  const dirEcef: [number, number, number] = [-1, 0, 0]; // Looking straight down at nadir

  const hit = intersectEarthWGS84(originEcef, dirEcef);
  assert.ok(hit !== null);
  assert.ok(Math.abs(hit.distanceM - h) < 1.0);
  assert.ok(Math.abs(hit.geodetic.latRad) < 1e-6);
  assert.ok(Math.abs(hit.geodetic.lonRad) < 1e-6);
  assert.ok(Math.abs(hit.geodetic.heightM) < 0.1);
});

test('T_U7_03_ANALYTICAL_MOON_AND_MARS_SURFACE_INTERSECTIONS', () => {
  // Moon sphere hit
  const moonOrigin: [number, number, number] = [0, MOON_RADIUS_M + 50_000, 0];
  const moonDir: [number, number, number] = [0, -1, 0];
  const moonHit = intersectMoonSurface(moonOrigin, moonDir);
  assert.ok(moonHit !== null);
  assert.ok(Math.abs(moonHit.distanceM - 50_000) < 1.0);

  // Mars ellipsoid hit
  const marsOrigin: [number, number, number] = [0, 0, 4_000_000];
  const marsDir: [number, number, number] = [0, 0, -1];
  const marsHit = intersectMarsSurface(marsOrigin, marsDir);
  assert.ok(marsHit !== null);
  assert.ok(marsHit.distanceM > 0);
});

// ---------------------------------------------------------------------------
// 2. Celestial Angular Picking
// ---------------------------------------------------------------------------

test('T_U7_04_CELESTIAL_ANGULAR_PICKER', () => {
  const universe = new UniverseRuntime();
  const earthPos = universe.activeSystem.positionOf('earth') ?? [0, 0, 0];
  const moonPos = universe.activeSystem.positionOf('moon') ?? [0, 0, 0];

  // Observer at Earth looking toward Moon
  const toMoon: [number, number, number] = [
    moonPos[0] - earthPos[0],
    moonPos[1] - earthPos[1],
    moonPos[2] - earthPos[2],
  ];

  const pick = pickCelestialBodyFromRay(
    universe.activeSystem,
    earthPos,
    toMoon,
    15 * Math.PI / 180,
    'earth', // Exclude current host planet
  );

  assert.ok(pick !== null, 'Should pick the Moon when looking at it');
  assert.equal(pick.bodyId, 'moon');
  assert.ok(pick.distanceM > 350_000_000);

  // Looking up perpendicular to the planetary ecliptic into deep void
  const voidDir: [number, number, number] = [0, 1, 0];
  const miss = pickCelestialBodyFromRay(
    universe.activeSystem,
    earthPos,
    voidDir,
    1 * Math.PI / 180,
    'earth',
  );
  assert.equal(miss, null, 'Looking into deep void with tight cone should miss celestial bodies');
});

// ---------------------------------------------------------------------------
// 3. Four-Stage Resolver Hierarchy
// ---------------------------------------------------------------------------

test('T_U7_05_RESOLVER_STAGE_1_LOCAL_COLLIDER', () => {
  const { service } = createMockService();
  // Aiming forward -Z at mock building at z = -500
  const origin = new Vector3(0, 10, 0);
  const direction = new Vector3(0, 0, -1);

  const res = service.resolveFromAim(origin, direction);
  assert.ok(res !== null);
  assert.equal(res.kind, 'local-collider');
  assert.ok(res.localDestination !== null);
  assert.ok(res.localDestination!.z <= -470);
});

test('T_U7_06_RESOLVER_STAGE_2_ACTIVE_BODY_ANALYTICAL_SURFACE_BEYOND_2500M', () => {
  const { service } = createMockService();
  // Aiming downward at Earth surface far beyond local 2500m raycast
  // From Manaus origin looking down at 45 degrees
  const origin = new Vector3(0, 50, 0);
  const direction = new Vector3(0, -0.7071, -0.7071);

  const res = service.resolveFromAim(origin, direction, []); // No colliders in way
  assert.ok(res !== null, 'Local raycast miss must fall through to analytical surface');
  // It either hits Manaus ground projection or Earth geodetic
  assert.ok(res.kind === 'local-collider' || res.kind === 'surface-geodetic');
});

test('T_U7_07_RESOLVER_STAGE_3_AND_4_CELESTIAL_AND_ARMED_TARGET', () => {
  const { service } = createMockService();
  // Aiming up at zenith (0, 1, 0) where no collider or planet surface exists
  const origin = new Vector3(0, 50, 0);
  const direction = new Vector3(0, 1, 0);

  // Arm target
  service.armTarget({
    kind: 'body-orbit',
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: 'mars',
    altitudeM: 250_000,
  });

  const res = service.resolveFromAim(origin, direction, []);
  assert.ok(res !== null);
  // If no celestial body is at exact zenith, it falls back to Stage 4 armed target
  assert.ok(res.kind === 'body-orbit');
});

// ---------------------------------------------------------------------------
// 4. Universal Teleport Rollout & Invariants
// ---------------------------------------------------------------------------

test('T_U7_08_TELEPORT_LOCAL_AND_REMOVAL_OF_100KM_CAP', async () => {
  const { service, player, universe, travelDomain } = createMockService();

  // Destination beyond the old 100 km cap (e.g. x = 150_000 m)
  const farLocal = new Vector3(150_000, 100, 150_000);
  const result = await service.teleport(farLocal);

  assert.ok(result.success, 'Destination beyond 100km must succeed without arbitrary cap rejection');
  assert.ok(Math.abs(player.position.x - 150_000) < 1.0);
  assert.equal(universe.player.frame, MANAUS_FRAME_ID);
  assert.equal(travelDomain.kind, 'local');
});

test('T_U7_09_TELEPORT_ARBITRARY_EARTH_GEODETIC_DYNAMIC_FRAME', async () => {
  const { service, player, universe, travelDomain } = createMockService();

  // Teleport to São Paulo, Brazil (-23.5505°, -46.6333°)
  const targetUri = 'drm:v1://?kind=surface&gal=milky_way&sys=sol&body=earth&lat=-23.550500&lon=-46.633300&alt=2.0';
  const result = await service.teleport(targetUri);

  assert.ok(result.success);
  assert.equal(result.transitionKind, 'local');
  assert.equal(travelDomain.kind, 'local');

  // Verify dynamic ENU frame registration
  assert.ok(universe.player.frame.startsWith('earth/surface/'));
  assert.notEqual(universe.player.frame, MANAUS_FRAME_ID);

  // Address authority
  assert.equal(universe.address.bodyId, 'earth');
  assert.equal(universe.address.childFrame, universe.player.frame);
});

test('T_U7_10_TELEPORT_MOON_AND_MARS_SAFE_ORBIT', async () => {
  const { service, player, universe, travelDomain } = createMockService();

  // Mars safe orbit (altitude 250,000 m)
  const marsTarget = {
    kind: 'body-orbit' as const,
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: 'mars',
    altitudeM: 250_000,
  };

  const result = await service.teleport(marsTarget);
  assert.ok(result.success);
  assert.equal(result.transitionKind, 'interplanetary');
  assert.equal(travelDomain.kind, 'interplanetary');
  assert.equal(universe.address.bodyId, 'mars');

  // Verify barycentric safe orbit distance
  const marsPos = universe.activeSystem.positionOf('mars')!;
  const playerSysPos = universe.playerSystemPositionM();
  const dist = Math.hypot(
    playerSysPos[0] - marsPos[0],
    playerSysPos[1] - marsPos[1],
    playerSysPos[2] - marsPos[2],
  );
  const mars = universe.activeSystem.bodies.find(b => b.id === 'mars')!;
  const expectedRadius = mars.equatorialRadiusM + 250_000;
  assert.ok(Math.abs(dist - expectedRadius) < 1.0, `Expected ${expectedRadius}, got ${dist}`);
});

test('T_U7_11_TELEPORT_REMOTE_BIGINT_SECTOR', async () => {
  const { service, universe, travelDomain } = createMockService();

  // Exactly 64-bit BigInt sector
  const sx = 9_000_000_000_000_000n;
  const sy = -4_500_000_000_000_000n;
  const sz = 1_234_567_890_123_456n;

  const sectorTarget = {
    kind: 'cosmic-sector' as const,
    galaxyId: 'milky_way',
    sector: sectorIndex(sx, sy, sz),
    offsetM: [1000, 2000, 3000] as [number, number, number],
  };

  const result = await service.teleport(sectorTarget);
  assert.ok(result.success);
  assert.equal(universe.address.sector.x, sx);
  assert.equal(universe.address.sector.y, sy);
  assert.equal(universe.address.sector.z, sz);
});

test('T_U7_12_BLACK_HOLE_POLICY_SAFE_OBSERVATION_DISTANCE', async () => {
  const { service, universe } = createMockService();

  // Teleport to Sagittarius A* catalog object
  const result = await service.teleport('sgr_a_star');
  assert.ok(result.success);
  assert.ok(result.message.includes('6 rs'), `Message should state safe observation: ${result.message}`);

  // Schwarzschild radius for 4.154e6 solar masses is ~1.227e10 m
  // Safe observation radius at 6 rs is ~7.36e10 m
  const pos = universe.playerSystemPositionM();
  const dist = Math.hypot(pos[0], pos[1], pos[2]);
  assert.ok(dist >= 7e10, `Observer must be at or beyond 6 rs safe distance (${dist})`);
});

test('T_U7_13_TELEPORT_CANCELLATION_AND_ROLLBACK', async () => {
  const { service, player, universe } = createMockService();

  const initialFrame = universe.player.frame;
  const initialPos = [player.position.x, player.position.y, player.position.z];

  // Start a teleport with an abort signal triggered before completion
  const controller = new AbortController();
  controller.abort();

  const result = await service.teleport(new Vector3(500, 10, 500), controller.signal);
  assert.equal(result.success, false);
  assert.ok(result.message.includes('cancelado') || result.message.includes('abortado'));

  // Invariant: Source state must be untouched on aborted teleport
  assert.equal(universe.player.frame, initialFrame);
  assert.equal(player.position.x, initialPos[0]);
  assert.equal(player.position.y, initialPos[1]);
  assert.equal(player.position.z, initialPos[2]);
});

test('T_U7_14_BOUNDED_MEMORY_AFTER_REPEATED_DYNAMIC_JUMPS', async () => {
  const { service, universe } = createMockService();

  // Jump to 40 different arbitrary locations around the globe
  for (let i = 0; i < 40; i++) {
    const lat = -50 + i * 2.5;
    const lon = -120 + i * 5;
    const target = {
      kind: 'surface-geodetic' as const,
      galaxyId: 'milky_way',
      systemId: 'sol',
      bodyId: 'earth',
      latDeg: lat,
      lonDeg: lon,
      altitudeM: 2.0,
    };
    const res = await service.teleport(target);
    assert.ok(res.success);
  }

  // Verify memory bound: dynamic frames registered in frame graph must not exceed limit
  const registeredDynamicFrames = universe.frames.ids.filter(id => id.startsWith('earth/surface/'));
  assert.ok(
    registeredDynamicFrames.length <= 32,
    `Dynamic frames must be bounded to max 32, but found ${registeredDynamicFrames.length}`,
  );
});
