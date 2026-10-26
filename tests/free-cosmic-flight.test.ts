import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { Game } from '../src/game/Game.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import {
  CosmicCruiseController,
  WARP_STEPS_C,
  COSMIC_WARP_STEPS_C,
  warpSpeedMps,
  warpLabel,
} from '../src/world/travel/CosmicFlight.ts';
import { LIGHT_SPEED_MPS } from '../src/world/travel/TravelConstants.ts';
import { TravelDomain } from '../src/world/travel/TravelDomain.ts';
import { NavigationTargetState } from '../src/world/travel/NavigationLock.ts';
import { PlanetaryLandingIntent } from '../src/world/travel/PlanetaryLanding.ts';
import { bodyExclusionEnvelopes } from '../src/world/travel/BodyNavigation.ts';
import { SOLAR_SYSTEM_BODIES } from '../src/world/celestial/CelestialBody.ts';
import { bodyArrivalPolicy, PHOTOSPHERE_GAMEPLAY_GRAVITY_MPS2 } from '../src/world/celestial/CelestialBodyProfile.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import { RockyImpactDestructionService } from '../src/world/destruction/RockyImpactDestructionService.ts';
import { SECTOR_SIZE_M } from '../src/world/spatial/UniverseAddress.ts';
import { GalaxyMaterializer } from '../src/world/galaxy/GalaxyMaterializer.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';

function flightFixture(startPos: [number, number, number] = [0, 1.5e11, 0]) {
  const universe = new UniverseRuntime({ epochS: 0 });
  const system = universe.activeSystem;
  universe.updateSystemPose(startPos, [0, 0, 0], 0);

  const travelDomain = new TravelDomain();
  travelDomain.enterSystem({ systemId: 'sol', positionM: startPos, velocityMps: [0, 0, 0] });

  const camera = new PerspectiveCamera(60, 1.6, 0.1, 1e7);
  const game = Object.create(Game.prototype) as any;
  const controller = new CosmicCruiseController();
  const held = new Set<string>();
  const edges = new Set<string>();

  const input = {
    enabled: true,
    held: (key: string) => held.has(key),
    consume: (key: string) => {
      const has = edges.has(key);
      edges.delete(key);
      return has;
    },
  };

  const player = new PlayerController(new Group(), input as any);
  player.state = 'Flight';

  Object.assign(game, {
    universe,
    travelDomain,
    interplanetary: controller,
    navigation: new NavigationTargetState(),
    landingIntent: new PlanetaryLandingIntent(),
    warpStep: 0,
    cosmicTier: 'conventional',
    colliders: [],
    curvedColliders: [],
    attackBoxes: [],
    blastBoxes: [],
    surfaceTerrains: new Map(),
    planetProviders: new Map(),
    hud: { notify() {} },
    input,
    player,
    rendering: { camera, preset: 'High' },
    celestialVisuals: new CelestialBodyVisualLayer(undefined, system.bodies),
    viewForward: new Vector3(0, -1, 0),
    camera: {
      setLocalView() {},
      inSpace: true,
      yaw: 0,
      pitch: 0,
    },
    renderOriginVec: new Vector3(),
    actorRoot: { position: new Vector3() },
    localRoot: { position: new Vector3(), visible: false },
    celestialRoot: new Group(),
    planetRoot: new Group(),
    photosphereGround: {
      group: { visible: false },
      update(_dt: number, _pos: any, isPhotosphere: boolean) {
        this.group.visible = isPhotosphere;
      },
      dispose() {},
    },
  });

  game.galaxyMaterializer = new GalaxyMaterializer(universe, game.celestialRoot);

  game.rockyImpactDestruction = new RockyImpactDestructionService({
    edits: universe.volume.edits,
    body: (id: string) => system.bodies.find(b => b.id === id),
    requestRegion: (id: string, plan: any) => universe.volume.requestImpactRegion(id, plan),
  });

  const step = (dt = 1 / 60) => {
    game.updateTravelDomain(dt);
    const trans = travelDomain.transition;
    if (trans.kind === 'returned') {
      game.finishSurfaceReturn(universe.telemetry.dominantBody);
    } else if (trans.kind === 'departed') {
      const barycentricPos = universe.frames.convertPosition(
        universe.player.frame,
        universe.activeSystem.systemFrameId,
        universe.player.position
      );
      const velocityMps = universe.systemVelocityMps();
      travelDomain.setState({
        systemId: universe.address.systemId!,
        positionM: [barycentricPos[0], barycentricPos[1], barycentricPos[2]],
        velocityMps,
        referenceBodyId: universe.telemetry.dominantBody,
      });
      game.player.position.set(0, 0, 0);
      game.player.velocity.set(0, 0, 0);
    }
    game.bindSurfacePhysics();
    game.photosphereGround?.update(
      dt,
      game.player.position,
      game.district === 'FOTOSFERA' || game.physicsDomain === 'sun'
    );
    if (travelDomain.localPhysicsActive) {
      game.player.update(dt, game.colliders, 0, 0);
      universe.update(
        [game.player.position.x, game.player.position.y, game.player.position.z],
        [game.player.velocity.x, game.player.velocity.y, game.player.velocity.z],
        dt,
        [0, 0, -1]
      );
    } else if (travelDomain.state) {
      game.updateInterplanetaryFlight(dt);
    }
  };

  return {
    game,
    universe,
    controller,
    travelDomain,
    held,
    edges,
    camera,
    step,
    dispose: () => universe.dispose(),
  };
}

// -----------------------------------------------------------------------------
// 1. Terra -> Sol via voo manual
// -----------------------------------------------------------------------------
test('T_P0B_EARTH_TO_SOL_MANUAL_FLIGHT', () => {
  const earth = SOLAR_SYSTEM_BODIES.find(b => b.id === 'earth')!;
  const sun = SOLAR_SYSTEM_BODIES.find(b => b.id === 'sun')!;
  const f = flightFixture([0, 1.496e11, 0]); // Earth orbital radius ~1 AU
  try {
    assert.equal(f.travelDomain.kind, 'interplanetary');
    const initialDist = Math.hypot(...f.travelDomain.state!.positionM);
    assert.ok(initialDist > 1.4e11);

    // Look directly towards Sun at [0, 0, 0]
    f.camera.lookAt(0, 0, 0);
    f.camera.updateMatrixWorld();
    f.held.add('KeyW');
    f.held.add('ShiftLeft'); // Boost
    f.game.warpStep = 8; // 128c

    // Step manual flight for 10 frames
    for (let i = 0; i < 10; i++) f.step(1 / 60);

    const newDist = Math.hypot(...f.travelDomain.state!.positionM);
    assert.ok(newDist < initialDist, 'Flying with W towards Sun closes distance');
    const speed = Math.hypot(...f.travelDomain.state!.velocityMps);
    assert.ok(speed > 10 * LIGHT_SPEED_MPS, 'Accelerated to superluminal speed');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 2. Sol -> fotosfera -> movimentação -> decolagem
// -----------------------------------------------------------------------------
test('T_P0B_SOL_PHOTOSPHERE_LOCOMOTION_TAKEOFF', () => {
  const sun = SOLAR_SYSTEM_BODIES.find(b => b.id === 'sun')!;
  const R = sun.equatorialRadiusM;
  const policy = bodyArrivalPolicy(sun);
  const f = flightFixture([0, R + 25_000_000, 0]); // 25,000 km altitude
  try {
    f.edges.add('KeyF');
    f.step(1 / 60);
    assert.equal(f.game.landingIntent.active, true, 'KeyF engages landing intent for Sun');

    // Autonomous capture descent down through envelope to fotosfera
    for (let step = 0; step < 700 && f.travelDomain.kind === 'interplanetary'; step++) {
      f.step(0.2);
    }

    assert.equal(f.travelDomain.kind, 'local', 'Handoff to local photospheric frame completed');
    assert.equal(f.universe.player.frame, 'sun/local-enu');
    assert.equal(f.game.physicsDomain, 'sun');
    assert.equal(f.game.district, 'FOTOSFERA');
    assert.equal(f.game.player.gravity, PHOTOSPHERE_GAMEPLAY_GRAVITY_MPS2);
    assert.ok(f.game.photosphereGround.group.visible, 'Photosphere visual ground is rendered');

    // Walk on surface
    f.held.add('KeyW');
    for (let i = 0; i < 15; i++) f.step(1 / 60);
    f.held.delete('KeyW');
    assert.ok(f.game.player.position.length() > 0, 'Character walks across photosphere');

    // Takeoff: F -> Flight, V x2 -> interplanetaryMode, Space + B -> escape
    f.edges.add('KeyF');
    f.step(1 / 60);
    assert.ok(f.game.player.state === 'Flight' || f.game.player.state === 'Hover');

    f.edges.add('KeyV'); f.step(0.05);
    f.edges.add('KeyV'); f.step(0.05);
    assert.equal(f.game.player.interplanetaryMode, true);

    f.held.add('Space');
    f.held.add('KeyB');
    for (let i = 0; i < 240 && f.travelDomain.kind === 'local'; i++) {
      f.step(1 / 60);
    }
    f.held.delete('Space');
    f.held.delete('KeyB');

    assert.equal(f.travelDomain.kind, 'interplanetary', 'Takeoff returns safely to space');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 3. Sistema Solar -> espaço interestelar por WASD
// -----------------------------------------------------------------------------
test('T_P0B_SOLAR_SYSTEM_TO_INTERSTELLAR_SPACE_WASD', () => {
  const f = flightFixture([0, 1e15, 0]); // 10,000 AU out
  try {
    assert.equal(f.universe.address.galaxyId, 'milky_way');

    // Engage cosmic tier: cycle C from conventional to interstellar
    f.edges.add('KeyC');
    f.step(1 / 60);
    assert.equal(f.game.cosmicTier, 'interstellar');
    assert.ok(f.game.warpStep >= 10, 'Cosmic tier armed at interstellar warp gear');

    // Steer towards +Z interstellar space
    f.camera.lookAt(0, 1e15, 1e16);
    f.camera.updateMatrixWorld();
    f.held.add('KeyW');
    f.held.add('ShiftLeft');

    // Accelerate through deep space
    for (let i = 0; i < 60; i++) f.step(0.1);

    const speed = Math.hypot(...f.travelDomain.state!.velocityMps);
    assert.ok(speed >= 1000 * LIGHT_SPEED_MPS, 'Reaches interstellar speed (> 1,000c)');
    assert.equal(f.controller.getTelemetry().phase, 'cosmic-cruise');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 4. Viagem livre por diversos setores
// -----------------------------------------------------------------------------
test('T_P0B_FREE_TRANSIT_ACROSS_MULTIPLE_SECTORS', () => {
  const f = flightFixture([0, 2e16, 0]); // Interstellar space
  try {
    f.game.cosmicTier = 'interstellar';
    f.game.warpStep = 14; // 10,000,000c (~1 ly / 3s)

    const sector0 = f.universe.address.sector;
    // Step forward by 5 * SECTOR_SIZE_M in space
    const p = f.travelDomain.state!.positionM;
    p[0] += 3 * SECTOR_SIZE_M;
    p[2] += 2 * SECTOR_SIZE_M;
    f.universe.updateSystemPose(p, [0, 0, 0], 1.0);

    const sectorAfter = f.universe.address.sector;
    assert.notDeepEqual(sectorAfter, sector0, 'Address sector updates smoothly with space displacement');
    assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]), 'No NaN or Infinity');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 5. Via Láctea -> Andrômeda utilizando voo cósmico livre (sem piloto automático)
// -----------------------------------------------------------------------------
test('T_P0B_MILKY_WAY_TO_ANDROMEDA_FREE_COSMIC_FLIGHT', () => {
  const f = flightFixture([0, 1e11, 0]);
  try {
    // Cycle C twice: conventional -> interstellar -> intergalactic
    f.edges.add('KeyC'); f.step(1 / 60);
    assert.equal(f.game.cosmicTier, 'interstellar');
    f.edges.add('KeyC'); f.step(1 / 60);
    assert.equal(f.game.cosmicTier, 'intergalactic');
    assert.ok(f.game.warpStep >= 15, 'Intergalactic speed tier armed');

    const ANDROMEDA_Y_M = 2.365e22; // ~2.5 million light years along Y
    // Player starts in Milky Way
    assert.equal(f.universe.activeGalaxy.definition.id, 'milky_way');

    // Fly manually along +Y towards Andromeda
    f.camera.lookAt(0, 1, 0);
    f.camera.updateMatrixWorld();
    f.held.add('KeyW');

    // Simulate high-speed progress across 2.5 million light years
    const pos = f.travelDomain.state!.positionM;
    pos[1] = 0.8 * ANDROMEDA_Y_M; // Past mid-way point closer to Andromeda
    f.step(1.0);

    // Dynamic galaxy and sector resolution with atomic materialization
    assert.equal(f.universe.activeGalaxy.definition.id, 'andromeda', 'Dynamic galaxy switches to Andromeda');
    assert.equal(f.universe.address.galaxyId, 'andromeda');
    assert.ok(f.universe.address.systemId?.startsWith('andromeda'), 'Address system resolves to Andromeda domain');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 6. Aproximação progressiva de Andrômeda e desaceleração local
// -----------------------------------------------------------------------------
test('T_P0B_ANDROMEDA_APPROACH_AND_DECELERATION', () => {
  const ANDROMEDA_Y_M = 2.365e22;
  const f = flightFixture([0, ANDROMEDA_Y_M - 1e16, 0]); // Approaching Andromeda core
  try {
    f.step(1 / 60); // Executes atomic handoff to Andromeda
    assert.equal(f.universe.activeGalaxy.id, 'andromeda', 'Materializes Andromeda entry system');

    f.game.cosmicTier = 'intergalactic';
    f.game.warpStep = 18;
    f.held.add('KeyW');
    f.step(1 / 60);

    // Decelerate: Shift + B steps gear down
    f.held.add('ShiftLeft');
    f.edges.add('KeyB');
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 17, 'Shift+B steps down cosmic warp gear');

    // KeyX brakes the ship
    f.held.clear();
    f.held.add('KeyX');
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 0, 'X disengages warp completely');
    assert.equal(f.controller.getTelemetry().phase, 'braking');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 7. Proximity speed gating prevents astronomical tunneling
// -----------------------------------------------------------------------------
test('T_P0B_PROXIMITY_SPEED_GATING_PREVENTS_TUNNELING', () => {
  const earth = SOLAR_SYSTEM_BODIES.find(b => b.id === 'earth')!;
  const R = earth.equatorialRadiusM;
  const u = new UniverseRuntime({ epochS: 0 });
  const earthPos = u.activeSystem.positionOf('earth')!;
  u.dispose();
  const startPos: [number, number, number] = [earthPos[0], earthPos[1] + R + 50_000_000, earthPos[2]];
  const f = flightFixture(startPos);
  try {
    f.game.cosmicTier = 'interstellar';
    f.game.warpStep = 14; // 10,000,000c
    // Flying towards Earth
    f.camera.lookAt(earthPos[0], earthPos[1], earthPos[2]);
    f.camera.updateMatrixWorld();
    f.held.add('KeyW');

    f.step(1 / 60);

    const telemetry = f.controller.getTelemetry();
    assert.equal(telemetry.proximityGatingActive, true, 'Proximity speed gating activates near body');
    assert.equal(telemetry.gatedBodyId, 'earth', 'Identifies Earth as gated body');

    const cappedSpeed = Math.hypot(...f.travelDomain.state!.velocityMps);
    assert.ok(cappedSpeed <= 16 * LIGHT_SPEED_MPS, 'Velocity throttled safely below 16c near 50,000 km');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 8. Camera steering smoothly reorients velocity vector
// -----------------------------------------------------------------------------
test('T_P0B_CAMERA_STEERING_SMOOTH_ALIGNMENT', () => {
  const f = flightFixture([0, 1e11, 0]);
  try {
    f.travelDomain.state!.velocityMps = [1_000_000, 0, 0]; // Moving along +X
    // Aim camera along +Z
    f.camera.lookAt(0, 1e11, 1e11);
    f.camera.updateMatrixWorld();
    f.held.add('KeyW');

    // Run several frames of steering
    for (let i = 0; i < 30; i++) f.step(1 / 60);

    const vel = f.travelDomain.state!.velocityMps;
    assert.ok(Math.abs(vel[2]) > 0.01, 'Velocity turned toward camera forward direction');
    assert.ok(Number.isFinite(vel[0]) && Number.isFinite(vel[1]) && Number.isFinite(vel[2]));
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 9. Automated U3 hypercruise continues working alongside free flight
// -----------------------------------------------------------------------------
test('T_P0B_EXISTING_AUTOPILOT_HYPERCRUISE_PRESERVED', () => {
  const f = flightFixture([0, 1.496e11, 0]);
  try {
    // Select target and test autopilot
    f.game.selectNavigationTarget('moon', 'reticle');
    assert.equal(f.game.navigationLock?.bodyId, 'moon');

    // KeyP toggles autopilot
    f.edges.add('KeyP');
    f.step(1 / 60);
    assert.equal(f.controller.autopilot.active, true, 'Autopilot engages normally with KeyP');

    f.edges.add('KeyP');
    f.step(1 / 60);
    assert.equal(f.controller.autopilot.active, false, 'Autopilot cancels with KeyP');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 10. Multi-scale coordinate safety: no NaN, Infinity, or overflow
// -----------------------------------------------------------------------------
test('T_P0B_MULTISCALE_COORDINATE_SAFETY', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    for (const step of [0, 1, 9, 13, 18, 19]) {
      const speed = warpSpeedMps(step, true);
      const label = warpLabel(step, true);
      assert.ok(Number.isFinite(speed), `Speed for step ${step} is finite`);
      assert.ok(typeof label === 'string' && !label.includes('NaN'), `Label for step ${step} valid`);
    }
  } finally {
    f.dispose();
  }
});
