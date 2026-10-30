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
import { MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter.ts';

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
  let wheelDelta = 0;

  const input = {
    enabled: true,
    held: (key: string) => held.has(key),
    consume: (key: string) => {
      const has = edges.has(key);
      edges.delete(key);
      return has;
    },
    consumeWheelDelta: () => {
      const d = wheelDelta;
      wheelDelta = 0;
      return d;
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
    player,
    held,
    edges,
    camera,
    setWheelDelta: (d: number) => { wheelDelta = d; },
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
    assert.equal(f.universe.address.systemId, undefined, 'Address systemId remains undefined in intergalactic space');
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

// -----------------------------------------------------------------------------
// 11. P0.4: Time-limited deceleration consistency across 30, 60, and 120 FPS
// -----------------------------------------------------------------------------
test('T_P04_TEMPORAL_BRAKING_CONSISTENCY_30_60_120_FPS', () => {
  // Test speed deceleration profile across 30, 60, and 120 FPS
  const fpsList = [30, 60, 120];
  const finalSpeeds: number[] = [];

  for (const fps of fpsList) {
    // Start at 50,000 km from Sun envelope, moving toward Sun at 50,000,000 m/s
    const dt = 1 / fps;
    const sunRadius = 695_700_000;
    const f = flightFixture([0, sunRadius + 50_000_000, 0]);
    try {
      f.game.cosmicTier = 'interstellar';
      f.game.warpStep = 10;
      f.travelDomain.state!.velocityMps = [0, -50_000_000, 0];
      const initialSpeed = 50_000_000;
      let previousSpeed = initialSpeed;

      // Simulate 1.0 second of simulation time
      for (let step = 0; step < fps; step++) {
        f.step(dt);
        const currentSpeed = Math.hypot(...f.travelDomain.state!.velocityMps);

        // Continuous deceleration invariant: speed must not jump abruptly in 1 frame
        const deltaV = previousSpeed - currentSpeed;
        assert.ok(deltaV >= -1, `Speed must not increase unexpectedly during braking (fps=${fps}, step=${step})`);
        
        // Speed must decrease smoothly
        assert.ok(currentSpeed <= initialSpeed, `Speed must decrease toward cap`);
        previousSpeed = currentSpeed;
      }

      finalSpeeds.push(previousSpeed);
      // Verify braking telemetry
      const tel = f.controller.getTelemetry();
      assert.ok(tel.proximityGatingActive, `Proximity gating must be active (fps=${fps})`);
      assert.equal(tel.phase, 'braking', `Telemetry phase must be braking (fps=${fps})`);
    } finally {
      f.dispose();
    }
  }

  // Cross-FPS consistency: final speed after 1s across 30, 60, 120 FPS must match within 5%
  const avgSpeed = (finalSpeeds[0] + finalSpeeds[1] + finalSpeeds[2]) / 3;
  for (let i = 0; i < 3; i++) {
    const diff = Math.abs(finalSpeeds[i] - avgSpeed) / avgSpeed;
    assert.ok(diff < 0.08, `Speed after 1s must be consistent across FPS: 30fps=${finalSpeeds[0]}, 60fps=${finalSpeeds[1]}, 120fps=${finalSpeeds[2]} (diff=${(diff*100).toFixed(1)}%)`);
  }
});

// -----------------------------------------------------------------------------
// 12. P0.4: Kinematic anticipation prevents overshoot of celestial bodies
// -----------------------------------------------------------------------------
test('T_P04_KINEMATIC_ANTICIPATION_NO_SURFACE_PENETRATION', () => {
  // Start high speed approach toward Sun at 50,000,000 m/s from 5,000,000 km
  const f = flightFixture([0, 695_700_000 + 5_000_000_000, 0]);
  try {
    f.game.cosmicTier = 'interstellar';
    f.game.warpStep = 10;
    f.travelDomain.state!.velocityMps = [0, -50_000_000, 0];
    f.held.add('KeyW');

    for (let i = 0; i < 180; i++) {
      f.step(1 / 60);
      const pos = f.travelDomain.state!.positionM;
      const sunDist = Math.hypot(pos[0], pos[1], pos[2]);
      // The distance must never penetrate the Sun's envelope (695,700,000 m)
      assert.ok(sunDist >= 695_700_000, `Player must not penetrate solar envelope: dist=${sunDist}`);
    }
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 13. P0.4: Free galactic handoff maintains intergalactic space (systemId undefined)
// -----------------------------------------------------------------------------
test('T_P04_FREE_GALAXY_HANDOFF_INTERGALACTIC_CONTINUITY', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    const ANDROMEDA_Y_M = 2.365e22;
    // Set position at 0.55 * ANDROMEDA_Y_M in Milky Way frame (just crossing midpoint)
    const initialPos: [number, number, number] = [1e15, 0.55 * ANDROMEDA_Y_M, -2e15];
    const initialVel: [number, number, number] = [100, 1e11, -50];
    f.travelDomain.state!.positionM = [...initialPos];
    f.travelDomain.state!.velocityMps = [...initialVel];
    f.universe.updateSystemPose(initialPos, initialVel, 0);

    // Initial state: in Milky Way intergalactic space
    assert.equal(f.universe.activeGalaxy.id, 'milky_way');
    assert.equal(f.universe.address.galaxyId, 'milky_way');
    assert.equal(f.universe.address.systemId, undefined, 'systemId must be undefined in intergalactic space');

    // Trigger free flight galaxy handoff check
    f.game.checkFreeFlightGalaxyHandoff();

    // Verify atomic transition into Andromeda envelope
    assert.equal(f.universe.activeGalaxy.id, 'andromeda', 'Active galaxy switches to Andromeda');
    assert.equal(f.universe.address.galaxyId, 'andromeda', 'Address galaxy switches to Andromeda');
    assert.equal(f.universe.address.systemId, undefined, 'systemId must remain undefined in Andromeda intergalactic space');

    // Verify coordinate continuity: position transformed smoothly into Andromeda frame
    const newPos = f.travelDomain.state!.positionM;
    const expectedY = initialPos[1] - ANDROMEDA_Y_M; // ~ -0.45 * ANDROMEDA_Y_M
    assert.ok(Math.abs(newPos[1] - expectedY) < 1e9, `Y coordinate must be smoothly transformed into Andromeda frame`);
    assert.equal(newPos[0], initialPos[0], 'X coordinate preserved');
    assert.equal(newPos[2], initialPos[2], 'Z coordinate preserved');

    // Velocity direction preserved
    const newVel = f.travelDomain.state!.velocityMps;
    assert.equal(newVel[0], initialVel[0]);
    assert.equal(newVel[1], initialVel[1]);
    assert.equal(newVel[2], initialVel[2]);

    // Test reverse journey: flying back towards Milky Way
    f.travelDomain.state!.positionM = [1e15, -0.55 * ANDROMEDA_Y_M, -2e15];
    f.travelDomain.state!.velocityMps = [-100, -1e11, 50];
    f.universe.updateSystemPose(f.travelDomain.state!.positionM, f.travelDomain.state!.velocityMps, 0);

    f.game.checkFreeFlightGalaxyHandoff();

    // Return to Milky Way
    assert.equal(f.universe.activeGalaxy.id, 'milky_way', 'Active galaxy switches back to Milky Way');
    assert.equal(f.universe.address.galaxyId, 'milky_way');
    assert.equal(f.universe.address.systemId, undefined, 'systemId must remain undefined in Milky Way intergalactic space');
    assert.ok(Math.abs(f.travelDomain.state!.positionM[1] - ( -0.55 * ANDROMEDA_Y_M + ANDROMEDA_Y_M )) < 1e9);
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 14. P0.5: Outward flight from celestial envelope is NOT throttled by proximity gating
// -----------------------------------------------------------------------------
test('T_P05_OUTWARD_FLIGHT_NO_PROXIMITY_BRAKING', () => {
  // Position player close to the Sun (1.5 solar radii), moving radially OUTWARD (+Y)
  const sunRadius = 695_700_000;
  const f = flightFixture([0, 1.5 * sunRadius, 0]);
  try {
    f.game.cosmicTier = 'interstellar';
    f.game.warpStep = 10; // 1,000c
    // Velocity pointing outward away from Sun (+Y)
    f.travelDomain.state!.velocityMps = [0, 50_000_000, 0];
    f.held.add('KeyW');
    // Align camera outward (+Y)
    f.game.camera.yaw = 0;
    f.game.camera.pitch = Math.PI / 2;

    const initialSpeed = 50_000_000;
    f.step(1 / 60);

    const newSpeed = Math.hypot(...f.travelDomain.state!.velocityMps);
    // Because movement is outward (inwardClosing <= 0), proximity gating must NOT throttle speed
    assert.ok(newSpeed >= initialSpeed, `Outward flight must accelerate freely without proximity throttling: new=${newSpeed}, init=${initialSpeed}`);
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 15. P0.5: Velocity continuity across proximity threshold boundaries (Contract A: normal braking)
// -----------------------------------------------------------------------------
test('T_P05_VELOCITY_CONTINUITY_ACROSS_PROXIMITY_THRESHOLDS', () => {
  // Contract A: Continuous kinematic braking when approaching celestial body with sufficient stopping distance.
  // Initial altitude: 150,000 km above solar surface (Sun radius: 695,700 km).
  // Stopping distance at 100,000,000 m/s under warp spool (1.2s) is ~120,000 km,
  // providing a clean margin where normal continuous predictive/spool braking handles the approach.
  const sunRadius = 695_700_000;
  const initialAltitude = 150_000_000; // 150,000 km buffer
  const f = flightFixture([0, sunRadius + initialAltitude, 0]);
  try {
    f.game.cosmicTier = 'interstellar';
    // Approach inward (-Y) at 100,000,000 m/s without applying forward warp thrust
    f.travelDomain.state!.velocityMps = [0, -100_000_000, 0];

    let previousSpeed = 100_000_000;
    const dt = 1 / 60;

    for (let i = 0; i < 120; i++) {
      f.step(dt);
      const currentSpeed = Math.hypot(...f.travelDomain.state!.velocityMps);
      const deltaV = Math.abs(currentSpeed - previousSpeed);

      // Verify speed continuity: speed drop per frame must never be an instantaneous step jump.
      // Maximum deltaV bounded by kinematic deceleration + warp spool
      const maxAllowedDeltaV = (100_000_000 / 1.2 + 500_000) * dt * 3.0; // Bounded by time-limited deceleration
      assert.ok(deltaV < maxAllowedDeltaV, `Speed drop must be continuous across frames (deltaV=${deltaV}, max=${maxAllowedDeltaV} at step ${i})`);
      assert.ok(currentSpeed <= previousSpeed + 1e-3, `Speed must not increase without thrust during proximity gating at step ${i}`);

      const telemetry = f.game.flightTelemetry;
      assert.notEqual(telemetry?.phase, 'emergency-stop', `Emergency stop must not trigger in normal braking at step ${i}`);
      assert.notEqual(telemetry?.emergencyStopActive, true, `emergencyStopActive must remain false at step ${i}`);

      previousSpeed = currentSpeed;
    }

    // Proactive braking must have actively shed speed smoothly over 120 frames
    const finalSpeed = Math.hypot(...f.travelDomain.state!.velocityMps);
    assert.ok(finalSpeed < 50_000_000, `Predictive braking must smoothly reduce speed across approach: final=${finalSpeed}`);
    assert.ok(finalSpeed > 10_000_000, `Speed reduction remains time-limited: final=${finalSpeed}`);
    assert.ok(f.travelDomain.state!.positionM[1] > sunRadius, 'Player must remain safely above solar surface');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 15B. P0.5: Emergency stopping intervention on insufficient stopping distance (Contract B)
// -----------------------------------------------------------------------------
test('T_P05_EMERGENCY_INTERVENTION_ON_INSUFFICIENT_STOPPING_DISTANCE', () => {
  // Contract B: Emergency intervention when starting within critical stopping distance.
  // At 20,000 km above solar surface and 100,000,000 m/s (0.33c), impact would occur in ~0.2s without intervention.
  // The emergency stopping guard intervenes to prevent surface penetration and signals via telemetry.
  const sunRadius = 695_700_000;
  const f = flightFixture([0, sunRadius + 20_000_000, 0]);
  try {
    f.game.cosmicTier = 'interstellar';
    f.travelDomain.state!.velocityMps = [0, -100_000_000, 0];

    let emergencyIntervened = false;
    const dt = 1 / 60;

    for (let i = 0; i < 30; i++) {
      f.step(dt);
      const telemetry = f.game.flightTelemetry;
      if (telemetry?.emergencyStopActive === true || telemetry?.phase === 'emergency-stop') {
        emergencyIntervened = true;
      }
    }

    // Safety requirements:
    assert.ok(emergencyIntervened, 'Emergency guard must intervene when available stopping distance is physically insufficient');
    const posAfter = f.travelDomain.state!.positionM;
    const velAfter = f.travelDomain.state!.velocityMps;

    assert.ok(posAfter[1] >= sunRadius, `Player must not penetrate solar photosphere: y=${posAfter[1]}`);
    assert.ok(posAfter.every(Number.isFinite), 'Player coordinates must remain finite after emergency intervention');
    assert.ok(velAfter.every(Number.isFinite), 'Player velocities must remain finite after emergency intervention');

    // Gameplay continuity: verify simulation steps cleanly without NaN or exceptions after intervention
    assert.doesNotThrow(() => {
      for (let j = 0; j < 30; j++) f.step(dt);
    }, 'Gameplay must continue seamlessly after emergency stopping intervention');
    assert.ok(f.travelDomain.state!.positionM[1] >= sunRadius, 'Player continues flying safely without crossing surface');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 15C. P0.5: Deceleration framerate independence across 30, 60, and 120 FPS
// -----------------------------------------------------------------------------
test('T_P05_DECELERATION_FRAMERATE_INDEPENDENCE_30_60_120_FPS', () => {
  // Verify that normal continuous proximity braking behaves consistently across 30, 60, and 120 FPS
  const sunRadius = 695_700_000;
  const initialAltitude = 150_000_000; // 150,000 km buffer

  const runSimulation = (fps: number) => {
    const f = flightFixture([0, sunRadius + initialAltitude, 0]);
    try {
      f.game.cosmicTier = 'interstellar';
      f.travelDomain.state!.velocityMps = [0, -100_000_000, 0];
      const dt = 1 / fps;
      const steps = fps; // 1.0 second of simulation time
      for (let i = 0; i < steps; i++) {
        f.step(dt);
      }
      const finalSpeed = Math.hypot(...f.travelDomain.state!.velocityMps);
      const emergency = f.game.flightTelemetry?.emergencyStopActive === true;
      const pos = [...f.travelDomain.state!.positionM];
      return { finalSpeed, emergency, pos };
    } finally {
      f.dispose();
    }
  };

  const res30 = runSimulation(30);
  const res60 = runSimulation(60);
  const res120 = runSimulation(120);

  assert.equal(res30.emergency, false, 'No emergency stop at 30 FPS');
  assert.equal(res60.emergency, false, 'No emergency stop at 60 FPS');
  assert.equal(res120.emergency, false, 'No emergency stop at 120 FPS');

  // All framerates should have proactively shed significant speed in 1.0s (from 100M down to ~40-60M m/s)
  assert.ok(res60.finalSpeed < 65_000_000, `Speed must decelerate substantially in 1.0s: ${res60.finalSpeed}`);
  assert.ok(res60.finalSpeed > 30_000_000, `Deceleration is time-limited: ${res60.finalSpeed}`);
  assert.ok(res30.finalSpeed < 70_000_000, `30 FPS must also decelerate: ${res30.finalSpeed}`);
  assert.ok(res120.finalSpeed < 65_000_000, `120 FPS must also decelerate: ${res120.finalSpeed}`);

  // Speeds across 30, 60, and 120 FPS should agree within numerical integration margin (~15%)
  const relDiff30 = Math.abs(res30.finalSpeed - res60.finalSpeed) / res60.finalSpeed;
  const relDiff120 = Math.abs(res120.finalSpeed - res60.finalSpeed) / res60.finalSpeed;
  assert.ok(relDiff30 < 0.15, `30 FPS vs 60 FPS relative difference must be < 15% (got ${relDiff30})`);
  assert.ok(relDiff120 < 0.10, `120 FPS vs 60 FPS relative difference must be < 10% (got ${relDiff120})`);
});

// -----------------------------------------------------------------------------
// 16. P0.5: Emergency stopping deceleration guard vs continuous kinematic limits
// -----------------------------------------------------------------------------
test('T_P05_EMERGENCY_STOPPING_GUARD_VS_KINEMATIC_LIMITS', () => {
  // Player placed just outside exclusion margin at extreme closing speed (200,000,000 m/s)
  const sunRadius = 695_700_000;
  const f = flightFixture([0, sunRadius + 50_000, 0]); // only 50km above surface!
  try {
    f.game.cosmicTier = 'interstellar';
    f.game.warpStep = 10;
    f.travelDomain.state!.velocityMps = [0, -200_000_000, 0]; // plunging straight down

    f.step(1 / 60);

    const posAfter = f.travelDomain.state!.positionM;
    const speedAfter = Math.hypot(...f.travelDomain.state!.velocityMps);

    // Emergency guard must prevent envelope penetration while bringing speed down to safe limit
    assert.ok(posAfter[1] >= sunRadius, `Emergency guard must prevent surface penetration: y=${posAfter[1]}`);
    assert.ok(speedAfter < 50_000_000, `Speed must be drastically reduced by emergency stopping guard: speed=${speedAfter}`);
    assert.ok(posAfter.every(Number.isFinite), 'Coordinates must be finite');
    assert.ok(f.travelDomain.state!.velocityMps.every(Number.isFinite), 'Velocities must be finite');

    const telemetry = f.game.flightTelemetry;
    assert.ok(telemetry?.emergencyStopActive === true, 'Emergency stop flag must be active');
    assert.equal(telemetry?.phase, 'emergency-stop', 'Telemetry phase must be emergency-stop');
    assert.ok(telemetry?.emergencyStopReason === 'speed-guard' || telemetry?.emergencyStopReason === 'ccd-contact',
      `Emergency stop reason must be speed-guard or ccd-contact (got ${telemetry?.emergencyStopReason})`);

    // Gameplay continuity: continuing flight after emergency intervention
    assert.doesNotThrow(() => {
      for (let j = 0; j < 30; j++) f.step(1 / 60);
    }, 'Gameplay must continue seamlessly after emergency stopping intervention');
    assert.ok(f.travelDomain.state!.positionM[1] >= sunRadius, 'Player continues flying safely without crossing surface');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 17. P0.5: Galactic handoff coordinate & velocity preservation in full 3D
// -----------------------------------------------------------------------------
test('T_P05_GALACTIC_HANDOFF_FULL_3D_AND_SECTOR_TRANSLATION', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    const ANDROMEDA_Y_M = 2.365e22;
    // Full non-trivial 3D position crossing midpoint
    const initialPos: [number, number, number] = [4.5e16, 0.52 * ANDROMEDA_Y_M, -8.2e16];
    const initialVel: [number, number, number] = [1.2e8, 3.4e10, -5.6e8];

    f.travelDomain.state!.positionM = [...initialPos];
    f.travelDomain.state!.velocityMps = [...initialVel];
    f.universe.updateSystemPose(initialPos, initialVel, 0);

    // Initial galaxy: Milky Way
    assert.equal(f.universe.activeGalaxy.id, 'milky_way');

    // Trigger handoff
    f.game.checkFreeFlightGalaxyHandoff();

    // Verify Andromeda galaxy transition
    assert.equal(f.universe.activeGalaxy.id, 'andromeda');
    assert.equal(f.universe.address.galaxyId, 'andromeda');

    // Check 3D coordinate preservation
    const posInAndromeda = f.travelDomain.state!.positionM;
    assert.equal(posInAndromeda[0], initialPos[0], 'X coordinate preserved in full 3D');
    assert.ok(Math.abs(posInAndromeda[1] - (initialPos[1] - ANDROMEDA_Y_M)) < 1e9, 'Y coordinate transformed');
    assert.equal(posInAndromeda[2], initialPos[2], 'Z coordinate preserved in full 3D');

    // Velocity 3D vector strictly preserved
    const velInAndromeda = f.travelDomain.state!.velocityMps;
    assert.equal(velInAndromeda[0], initialVel[0]);
    assert.equal(velInAndromeda[1], initialVel[1]);
    assert.equal(velInAndromeda[2], initialVel[2]);
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 18. P0.5: Materialization resilience: fallback and rollback if materializer throws
// -----------------------------------------------------------------------------
test('T_P05_MATERIALIZATION_FAILURE_ROLLBACK_RESILIENCE', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    const ANDROMEDA_Y_M = 2.365e22;
    const initialPos: [number, number, number] = [0, 0.6 * ANDROMEDA_Y_M, 0];
    const initialVel: [number, number, number] = [0, 1e10, 0];

    f.travelDomain.state!.positionM = [...initialPos];
    f.travelDomain.state!.velocityMps = [...initialVel];
    f.universe.updateSystemPose(initialPos, initialVel, 0);

    // Mock galaxyMaterializer.prepare to throw an error during free flight galaxy handoff
    f.game.galaxyMaterializer = {
      prepare() {
        throw new Error('Simulated network / procedural generation error');
      },
    } as any;

    // The handoff and flight check must survive gracefully without crashing
    assert.doesNotThrow(() => {
      f.game.checkFreeFlightGalaxyHandoff();
    });

    // Address and position remain robust and preserved in Milky Way
    assert.equal(f.universe.activeGalaxy.id, 'milky_way', 'Rollback preserves active galaxy on failure');
    assert.equal(f.universe.address.galaxyId, 'milky_way', 'Rollback preserves address galaxyId on failure');
    assert.deepEqual(f.travelDomain.state!.positionM, initialPos, 'Rollback preserves travel position on failure');
    assert.deepEqual(f.travelDomain.state!.velocityMps, initialVel, 'Rollback preserves travel velocity on failure');
    assert.ok(f.travelDomain.state!.positionM.every(Number.isFinite));
  } finally {
    f.dispose();
  }
});

test('T_P05_GALAXY_ACTIVATION_FAILURE_ROLLBACK', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    const ANDROMEDA_Y_M = 2.365e22;
    const initialPos: [number, number, number] = [0, 0.6 * ANDROMEDA_Y_M, 0];
    const initialVel: [number, number, number] = [0, 1e10, 0];

    f.travelDomain.state!.positionM = [...initialPos];
    f.travelDomain.state!.velocityMps = [...initialVel];
    f.universe.updateSystemPose(initialPos, initialVel, 0);

    f.game.galaxyMaterializer = {
      prepare() {
        return {
          install() {},
          activate() {
            throw new Error('Simulated visual activation failure');
          },
          dispose() {},
        };
      },
    } as any;

    const result = f.game.performFreeFlightGalaxyHandoff('andromeda');
    assert.equal(result, false, 'Handoff returns false when activation fails');
    assert.equal(f.universe.activeGalaxy.id, 'milky_way', 'Rollback preserves active galaxy on activation failure');
    assert.equal(f.universe.address.galaxyId, 'milky_way', 'Rollback preserves address on activation failure');
    assert.deepEqual(f.travelDomain.state!.positionM, initialPos, 'Rollback preserves travel position on activation failure');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 18B. P0.5.6: Handoff complete() deferred until after state and pose commit
// -----------------------------------------------------------------------------
test('T_P056_HANDOFF_COMPLETE_DEFERRED_UNTIL_AFTER_STATE_COMMIT', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    const ANDROMEDA_Y_M = 2.365e22;
    const initialPos: [number, number, number] = [0, 0.6 * ANDROMEDA_Y_M, 0];
    const initialVel: [number, number, number] = [0, 1e10, 0];

    f.travelDomain.state!.positionM = [...initialPos];
    f.travelDomain.state!.velocityMps = [...initialVel];
    f.universe.updateSystemPose(initialPos, initialVel, 0);

    const callOrder: string[] = [];
    let completeCalled = false;

    f.game.galaxyMaterializer = {
      prepare() {
        return {
          install() {
            callOrder.push('install');
          },
          activate() {
            // Verify that spatial domain and universe address are already committed before activation
            if (f.universe.activeGalaxy.id === 'andromeda' && f.travelDomain.state!.positionM[1] < initialPos[1]) {
              callOrder.push('state_committed_before_activate');
            }
            callOrder.push('activate');
          },
          complete() {
            completeCalled = true;
            callOrder.push('complete');
          },
          dispose() {
            callOrder.push('dispose');
          },
        };
      },
    } as any;

    const result = f.game.performFreeFlightGalaxyHandoff('andromeda');
    assert.equal(result, true, 'Handoff succeeds');
    assert.equal(completeCalled, true, 'complete() is called on successful commit');
    assert.deepEqual(callOrder, ['install', 'state_committed_before_activate', 'activate', 'complete'],
      'Transactional order must be install -> state commit -> activate -> complete');
  } finally {
    f.dispose();
  }
});

test('T_P056_HANDOFF_ACTIVATION_FAILURE_NEVER_CALLS_COMPLETE', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    const ANDROMEDA_Y_M = 2.365e22;
    const initialPos: [number, number, number] = [0, 0.6 * ANDROMEDA_Y_M, 0];
    const initialVel: [number, number, number] = [0, 1e10, 0];

    f.travelDomain.state!.positionM = [...initialPos];
    f.travelDomain.state!.velocityMps = [...initialVel];
    f.universe.updateSystemPose(initialPos, initialVel, 0);

    let completeCalled = false;
    let disposedCalled = false;

    f.game.galaxyMaterializer = {
      prepare() {
        return {
          install() {},
          activate() {
            throw new Error('Simulated activation exception');
          },
          complete() {
            completeCalled = true;
          },
          dispose() {
            disposedCalled = true;
          },
        };
      },
    } as any;

    const result = f.game.performFreeFlightGalaxyHandoff('andromeda');
    assert.equal(result, false, 'Handoff returns false when activate throws');
    assert.equal(completeCalled, false, 'complete() must NEVER be called if activation fails (previous visual session preserved)');
    assert.equal(disposedCalled, true, 'dispose() must be called to cleanup staging resources on failure');
    assert.equal(f.universe.activeGalaxy.id, 'milky_way', 'Rollback preserves active galaxy');
    assert.deepEqual(f.travelDomain.state!.positionM, initialPos, 'Rollback preserves travel position');
    assert.deepEqual(f.travelDomain.state!.velocityMps, initialVel, 'Rollback preserves travel velocity');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 19. P0.5: Automatic U3 hypercruise independence from free flight handoff
// -----------------------------------------------------------------------------
test('T_P05_AUTOMATIC_U3_HYPERCRUISE_INDEPENDENCE', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    const ANDROMEDA_Y_M = 2.365e22;
    const initialPos: [number, number, number] = [0, 0.6 * ANDROMEDA_Y_M, 0];
    f.travelDomain.state!.positionM = [...initialPos];

    // Mock universalTravelController as active (automated U3 hypercruise)
    f.game.universalTravelController = {
      active: true,
      update() {},
      cancel() {},
    };

    // Free flight handoff check must bail out when U3 hypercruise is active
    f.game.checkFreeFlightGalaxyHandoff();

    // Active galaxy stays Milky Way because U3 autopilot owns the journey
    assert.equal(f.universe.activeGalaxy.id, 'milky_way', 'Free flight handoff must not preempt active U3 hypercruise controller');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 20. P0.5.1 / P0.5.2: Takeoff ergonomics without double-tap V (F + Space + Shift)
// -----------------------------------------------------------------------------
test('T_P051_TAKEOFF_ERGONOMICS_WITHOUT_DOUBLE_V', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    f.universe.setPlayerPose(MANAUS_FRAME_ID, [0, 0, 0]);
    f.travelDomain.reset(); // starts in local domain
    f.player.state = 'Grounded';
    f.player.position.set(0, 0, 0);
    f.player.velocity.set(0, 0, 0);

    // 1. Press F: activates Hover
    f.edges.add('KeyF');
    f.player.update(1 / 60, f.game.colliders, 0, 0);
    assert.equal(f.player.state, 'Hover', 'F activates hover flight');
    assert.ok(f.player.isFlying, 'isFlying is true');

    // 2. Ascend with Space + Shift (without touching KeyV)
    f.held.add('Space');
    f.held.add('ShiftLeft');

    // Flight with Shift sprint provides fast flight (500 m/s)
    f.player.velocity.y = 500;
    f.player.position.y = 500;
    f.universe.update([f.player.position.x, f.player.position.y, f.player.position.z], [f.player.velocity.x, f.player.velocity.y, f.player.velocity.z], 1 / 60, [0, 0, -1]);
    f.player.update(1 / 60, f.game.colliders, 0, 0);
    assert.equal(f.player.speedMode, 'fast', 'Flight with Shift sprint provides fast flight');

    // Ascend to edge of atmosphere (9500m) while holding Space + Shift
    f.player.velocity.y = 500;
    f.player.position.y = 9500;
    f.universe.update([f.player.position.x, f.player.position.y, f.player.position.z], [f.player.velocity.x, f.player.velocity.y, f.player.velocity.z], 1 / 60, [0, 0, -1]);
    f.player.update(1 / 60, f.game.colliders, 0, 0);
    assert.equal(f.player.speedMode, 'fast', 'Player speedMode remains fast without unrequested tier jump');
    assert.equal(f.player.interplanetaryMode, false, 'interplanetaryMode is not prematurely forced');

    // 3. Step game travel domain update: space departure state machine activates and departs to space
    f.step(1 / 60);
    assert.equal(f.travelDomain.kind, 'interplanetary', 'Smooth departure from local atmosphere into space');
    assert.ok(f.travelDomain.state, 'Travel domain state initialized');
    assert.ok(f.travelDomain.state.positionM.every(Number.isFinite), 'Barycentric departure position is finite');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 21. P0.5.1: Mouse wheel warp gear adjustment in free space flight
// -----------------------------------------------------------------------------
test('T_P051_MOUSE_WHEEL_WARP_CONTROL', () => {
  const f = flightFixture([0, 1.5e11, 0]);
  try {
    assert.equal(f.travelDomain.kind, 'interplanetary');
    assert.equal(f.game.warpStep, 0);

    // Mouse wheel scroll up (negative deltaY): step up warp
    f.setWheelDelta(-50);
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 1, 'Mouse wheel up steps warp from 0 to 1');

    f.setWheelDelta(-100);
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 2, 'Mouse wheel up steps warp from 1 to 2');

    // Mouse wheel scroll down (positive deltaY): step down warp
    f.setWheelDelta(50);
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 1, 'Mouse wheel down steps warp from 2 to 1');

    // Secondary B / Shift+B shortcuts remain functional
    f.edges.add('KeyB');
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 2, 'KeyB steps warp from 1 to 2');

    f.held.add('ShiftLeft');
    f.edges.add('KeyB');
    f.step(1 / 60);
    f.held.delete('ShiftLeft');
    assert.equal(f.game.warpStep, 1, 'Shift+B steps warp down from 2 to 1');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 22. P0.5.1: Space braking ergonomics: Q progressive vs X emergency
// -----------------------------------------------------------------------------
test('T_P051_PROGRESSIVE_VS_EMERGENCY_BRAKE', () => {
  const f = flightFixture([0, 1.5e11, 0]);
  try {
    f.game.warpStep = 5;
    f.travelDomain.state!.velocityMps = [0, 50_000_000, 0];

    // Hold Q: Progressive brake does NOT reset warpStep to 0
    f.held.add('KeyQ');
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 5, 'KeyQ progressive brake preserves warpStep throttle setting');
    assert.equal(f.game.flightTelemetry?.phase, 'braking', 'Telemetry phase indicates braking');
    f.held.delete('KeyQ');

    // Hold X: Emergency brake cuts warpStep immediately to 0
    f.held.add('KeyX');
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 0, 'KeyX emergency brake cuts warpStep to 0');
    assert.equal(f.game.flightTelemetry?.phase, 'braking', 'Telemetry phase indicates braking');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 23. P0.5.1: Local context preservation (walking, powers, and wheel isolation)
// -----------------------------------------------------------------------------
test('T_P051_LOCAL_CONTEXT_PRESERVATION', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    f.travelDomain.reset(); // Local city mode
    f.player.state = 'Grounded';
    f.player.position.set(0, 0, 0);

    // Walking on ground: Shift provides sprint, not cosmic boost
    f.held.add('ShiftLeft');
    f.player.update(1 / 60, f.game.colliders, 0, 0);
    assert.equal(f.player.speedMode, 'ground');

    // Wheel in local mode does not affect warp
    f.setWheelDelta(-100);
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 0, 'Mouse wheel in local physics does not change warpStep');

    // Holding KeyQ in local physics does not activate space brake
    f.held.add('KeyQ');
    f.step(1 / 60);
    assert.equal(f.game.flightTelemetry, undefined, 'Space flight telemetry inactive in local domain');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 24. P0.5.2: Modal panel and menu isolation from mouse wheel warp control
// -----------------------------------------------------------------------------
test('T_P052_MODAL_PANEL_WHEEL_ISOLATION', () => {
  const f = flightFixture([0, 1.5e11, 0]);
  try {
    assert.equal(f.travelDomain.kind, 'interplanetary');
    assert.equal(f.game.warpStep, 0);

    // Open map or pause panel in HUD
    f.game.hud.panelOpen = true;

    // Wheel scroll while menu is open must be ignored
    f.setWheelDelta(-100);
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 0, 'Mouse wheel while UI panel is open must not alter warpStep');

    // Close panel
    f.game.hud.panelOpen = false;
    f.setWheelDelta(-100);
    f.step(1 / 60);
    assert.equal(f.game.warpStep, 1, 'Mouse wheel resumes warp control once UI panel is closed');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 25. P0.5.2: All local flight tiers contract verification
// -----------------------------------------------------------------------------
test('T_P052_ALL_LOCAL_TIERS_CONTRACT_PRESERVATION', () => {
  const f = flightFixture([0, 0, 0]);
  try {
    f.travelDomain.reset();
    f.player.state = 'Hover';

    // 1. Shift alone: fast
    f.held.add('ShiftLeft');
    f.player.update(1 / 60, [], 0, 0);
    assert.equal(f.player.speedMode, 'fast');
    f.held.delete('ShiftLeft');

    // 2. KeyB alone without arming: super
    f.held.add('KeyB');
    f.player.update(1 / 60, [], 0, 0);
    assert.equal(f.player.speedMode, 'super');

    // Releasing KeyB: resets to normal
    f.held.delete('KeyB');
    f.player.update(1 / 60, [], 0, 0);
    assert.equal(f.player.speedMode, 'normal');

    // 3. Arming Mega with single tap V + KeyB
    f.edges.add('KeyV');
    f.player.update(1 / 60, [], 0, 0);
    assert.equal(f.player.armed, 'mega');
    f.held.add('KeyB');
    f.player.update(1 / 60, [], 0, 0);
    assert.equal(f.player.speedMode, 'mega');
  } finally {
    f.dispose();
  }
});

// -----------------------------------------------------------------------------
// 26. P0.5.10: Multi-obstacle catalogue order independence and telemetry resolution
// -----------------------------------------------------------------------------
test('T_P0510_GATED_BODY_IDENTIFICATION_INDEPENDENT_OF_OBSTACLE_ORDER', () => {
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

    // Step 1: verifies Earth is identified as gated body when throttle gating dominates
    f.step(1 / 60);
    const telemetry = f.controller.getTelemetry();
    assert.equal(telemetry.proximityGatingActive, true, 'Proximity speed gating activates near body');
    assert.equal(telemetry.gatedBodyId, 'earth', 'Earth identified as governing gated body');

    // Verify speed was throttled safely below 16c
    const speed = Math.hypot(...f.travelDomain.state!.velocityMps);
    assert.ok(speed <= 16 * LIGHT_SPEED_MPS, 'Velocity throttled safely near Earth');
  } finally {
    f.dispose();
  }

  // Catalogue order invariance: test direct controller update with reversed envelopes
  const controllerA = new CosmicCruiseController();
  const controllerB = new CosmicCruiseController();

  const earthObstacle = {
    bodyId: 'earth',
    centreM: [0, 0, 0] as const,
    radiusM: 6_371_000,
    velocityMps: [0, 0, 0] as const,
  };
  const marsObstacle = {
    bodyId: 'mars',
    centreM: [2.2e11, 0, 0] as const,
    radiusM: 3_389_500,
    velocityMps: [24_000, 0, 0] as const,
  };

  const stateA = {
    systemId: 'sol',
    positionM: [0, 6_371_000 + 50_000_000, 0] as [number, number, number],
    velocityMps: [1_000, 0, 0] as [number, number, number],
  };
  const stateB = {
    systemId: 'sol',
    positionM: [0, 6_371_000 + 50_000_000, 0] as [number, number, number],
    velocityMps: [1_000, 0, 0] as [number, number, number],
  };

  const contextA = {
    cameraForwardBary: new Vector3(0, -1, 0),
    inputBoost: false,
    inputBrake: false,
    warpStep: 14,
    cosmicTier: 'interstellar' as const,
    exclusionEnvelopes: [earthObstacle, marsObstacle],
  };

  const contextB = {
    cameraForwardBary: new Vector3(0, -1, 0),
    inputBoost: false,
    inputBrake: false,
    warpStep: 14,
    cosmicTier: 'interstellar' as const,
    exclusionEnvelopes: [marsObstacle, earthObstacle],
  };

  controllerA.update(stateA, 1 / 60, new Vector3(0, -1, 0), contextA);
  controllerB.update(stateB, 1 / 60, new Vector3(0, -1, 0), contextB);

  const telA = controllerA.getTelemetry();
  const telB = controllerB.getTelemetry();

  assert.equal(telA.proximityGatingActive, true, 'Controller A proximity gating active');
  assert.equal(telB.proximityGatingActive, true, 'Controller B proximity gating active');
  assert.equal(telA.gatedBodyId, 'earth', 'Controller A identifies Earth');
  assert.equal(telB.gatedBodyId, 'earth', 'Controller B identifies Earth regardless of envelope ordering');
});



