import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { TravelDomain } from '../src/world/travel/TravelDomain';
import { UniversalTeleportService } from '../src/world/travel/UniversalTeleportService';
import { MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame';
import { cloneVec3 } from '../src/world/spatial/units';

function setupInterplanetaryTestEnvironment() {
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

  // Add a procedural planet to the active system for testing
  const proceduralPlanet: CelestialBody = {
    id: 'procedural-planet-alpha',
    name: 'Kepler-452b',
    frameId: 'kepler-452b-frame',
    equatorialRadiusM: 4_500_000,
    polarRadiusM: 4_480_000,
    massKg: 3.0e25,
  };
  universe.activeSystem.bodies.push(proceduralPlanet);
  universe.frames.register(
    referenceFrame({
      id: proceduralPlanet.frameId,
      parentId: universe.activeSystem.systemFrameId,
      kind: 'body-inertial',
      label: 'Kepler-452b (frame)',
    }),
  );

  let systemPrepared = false;
  const notifications: string[] = [];

  const service = new UniversalTeleportService({
    universe,
    travelDomain,
    player,
    getColliders: () => [],
    prepareManaus: async () => {},
    prepareSystem: target => {
      systemPrepared = true;
      return {
        commit: () => {
          // Mock system activation
          universe.address = {
            ...universe.address,
            systemId: target.systemId,
          };
        },
      };
    },
    notify: msg => notifications.push(msg),
    sound: () => {},
    burstVfx: () => {},
  });

  return { universe, travelDomain, player, service, proceduralPlanet, getSystemPrepared: () => systemPrepared };
}

test('T_VIVO10_01_MARS_SURFACE_TELEPORT: Direct surface arrival on Mars with dynamic surface frame', async () => {
  const { service, player, universe, travelDomain } = setupInterplanetaryTestEnvironment();

  const result = await service.teleport({
    kind: 'surface-geodetic',
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: 'mars',
    latDeg: -14.5684,
    lonDeg: 175.4729,
    altitudeM: 2.0,
  });

  assert.equal(result.success, true, 'Mars surface teleport must succeed');
  assert.equal(result.transitionKind, 'local');
  assert.ok(result.message.includes('Marte'), 'Notice must reference Marte');

  // Verify frame registration and player pose
  const expectedFrame = 'mars/surface/-14.5684_175.4729';
  assert.ok(universe.frames.has(expectedFrame), 'Dynamic Mars surface frame must be registered');
  assert.equal(universe.player.frame, expectedFrame, 'Player must be bound to Mars surface frame');
  assert.equal(universe.address.bodyId, 'mars', 'Cosmic address bodyId must be mars');
  assert.equal(player.position.y, 2.0, 'Player Y must match requested safe altitude');
  assert.equal(player.velocity.x, 0);
  assert.equal(player.velocity.y, 0);
  assert.equal(player.velocity.z, 0);
});

test('T_VIVO10_02_PROCEDURAL_PLANET_SURFACE_TELEPORT: Direct surface landing on procedural celestial bodies', async () => {
  const { service, player, universe, proceduralPlanet } = setupInterplanetaryTestEnvironment();

  const result = await service.teleport({
    kind: 'surface-geodetic',
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: proceduralPlanet.id,
    latDeg: 23.45,
    lonDeg: -45.67,
    altitudeM: 3.5,
  });

  assert.equal(result.success, true, 'Procedural planet surface teleport must succeed');
  assert.ok(result.message.includes('Kepler-452b'), 'Notice must reference procedural planet name');

  const expectedFrame = `${proceduralPlanet.id}/surface/23.4500_-45.6700`;
  assert.ok(universe.frames.has(expectedFrame), 'Dynamic surface frame must be registered');
  assert.equal(universe.player.frame, expectedFrame);
  assert.equal(universe.address.bodyId, proceduralPlanet.id);
  assert.equal(player.position.y, 3.5);
});

test('T_VIVO10_03_CROSS_SYSTEM_HANDOFF_WITH_PREPARE_SYSTEM: Cross-system surface teleport commits system transition', async () => {
  const { service, universe, getSystemPrepared } = setupInterplanetaryTestEnvironment();

  const result = await service.teleport({
    kind: 'body-orbit',
    galaxyId: 'milky_way',
    systemId: 'trappist-1',
    bodyId: 'earth', // Earth alias for solar bodies or valid body in mock
    altitudeM: 150_000,
  });

  assert.equal(getSystemPrepared(), true, 'prepareSystem must be invoked for cross-system target');
  assert.equal(result.success, true);
  assert.equal(result.transitionKind, 'interplanetary');
});

test('T_VIVO10_04_TRANSACTIONAL_ROLLBACK_ON_INVALID_DESTINATION: State is fully restored upon destination failure', async () => {
  const { service, player, universe } = setupInterplanetaryTestEnvironment();

  // Establish known initial state
  universe.setPlayerPose(MANAUS_FRAME_ID, [100, 20, -150]);
  player.teleport({ x: 100, y: 20, z: -150 });
  player.velocity.set(5, -2, 10);
  const initialFrame = universe.player.frame;
  const initialPos = cloneVec3(universe.player.position);

  // Attempt teleport to non-existent body
  const result = await service.teleport({
    kind: 'surface-geodetic',
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: 'non-existent-planet-xyz',
    latDeg: 0,
    lonDeg: 0,
    altitudeM: 10,
  });

  assert.equal(result.success, false, 'Teleport to non-existent body must fail cleanly');
  assert.ok(result.message.includes('não encontrado'), 'Error must report body not found');

  // Verify 100% transactional rollback
  assert.equal(universe.player.frame, initialFrame, 'Frame must be rolled back to original');
  assert.deepEqual(universe.player.position, initialPos, 'Player pose must be rolled back');
  assert.equal(player.position.x, 100);
  assert.equal(player.position.y, 20);
  assert.equal(player.position.z, -150);
  assert.equal(player.velocity.x, 5);
  assert.equal(player.velocity.y, -2);
  assert.equal(player.velocity.z, 10);
});

test('T_VIVO10_05_STAGE_2_MARS_AND_PROCEDURAL_AIM_RESOLUTION: Raycast from Mars orbit resolves surface-geodetic aim', () => {
  const { service, universe } = setupInterplanetaryTestEnvironment();

  // Register Mars fixed frame
  const mars = universe.activeSystem.bodies.find(b => b.id === 'mars')!;
  if (!universe.frames.has('mars/fixed')) {
    universe.frames.register(
      referenceFrame({
        id: 'mars/fixed',
        parentId: mars.frameId,
        kind: 'body-fixed',
        label: 'mars (fixo)',
      }),
    );
  }

  // Set dominant body to Mars and place player in Mars fixed frame looking straight down toward (0, 0, 0)
  universe.telemetry.dominantBody = 'mars';
  universe.setPlayerPose('mars/fixed', [0, 0, 5_000_000]); // 5000 km altitude on +Z

  const rayOrigin = new Vector3(0, 0, 5_000_000);
  const rayDirection = new Vector3(0, 0, -1); // looking down towards Mars center

  const resolution = service.resolveFromAim(rayOrigin, rayDirection);
  assert.ok(resolution, 'Aim toward Mars from Mars frame must resolve');
  assert.equal(resolution.kind, 'surface-geodetic', 'Resolution must be surface-geodetic');
  assert.equal(resolution.target?.bodyId, 'mars', 'Target bodyId must be mars');
  assert.ok(resolution.displayName.includes('Marte'));
});

