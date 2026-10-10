import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector2, Vector3 } from 'three/webgpu';
import { Game } from '../src/game/Game.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry.ts';
import { CosmicCruiseController } from '../src/world/travel/CosmicFlight.ts';
import { NavigationTargetState } from '../src/world/travel/NavigationLock.ts';
import { TravelDomain } from '../src/world/travel/TravelDomain.ts';
import { PlanetaryLandingIntent, landingHoldClearanceM } from '../src/world/travel/PlanetaryLanding.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import { CameraController } from '../src/player/CameraController.ts';
import type { InputController } from '../src/player/InputController.ts';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { PlanetTerrainProvider } from '../src/world/planet/PlanetTerrainProvider.ts';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface.ts';
import { surfaceGravityMps2 } from '../src/world/planet/PlanetBody.ts';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';
import type { StreamingContext } from '../src/world/providers/WorldProvider.ts';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget.ts';
import { tileKeyToString } from '../src/world/streaming/TileDemand.ts';

/** Use Game's production steps and real providers; only the renderer/HUD are omitted. */
function fixture(bodyId: 'moon' | 'mars') {
  const universe = new UniverseRuntime({ epochS: 0 });
  const root = new Group(), providers = createPlanetProviders(root, universe), provider = providers.get(bodyId)!;
  const held = new Set<string>(), edges = new Set<string>();
  const input = { enabled: true, mouseDelta: new Vector2(), held: (key: string) => held.has(key),
    consume: (key: string) => { const present = edges.has(key); edges.delete(key); return present; } } as unknown as InputController;
  const player = new PlayerController(root, input), camera = new PerspectiveCamera(57, 1, .1, 100_000);
  const cameraController = new CameraController(camera, input); cameraController.skipIntro(); cameraController.inSpace = true;
  const direction: Vec3 = [1, 0, 0];
  const fixedFrame = universe.activeSystem.bodies.find(body => body.id === bodyId)!.frameId;
  const radius = planetSurfaceRadius(provider.surface, direction);
  const position = universe.frames.convertPosition(fixedFrame, 'solar-system/barycentric', [radius + 15_000, 0, 0]);
  const inward = universe.frames.convertDirection(fixedFrame, 'solar-system/barycentric', [-8000, 0, 0]);
  const orbital = universe.activeSystem.stateOf(bodyId)!.velocityMps;
  const velocity = orbital.map((v, i) => v + inward[i]) as Vec3;
  universe.updateSystemPose(position, velocity, 0);
  const travelDomain = new TravelDomain();
  travelDomain.update({ altitudeM: 15_000, speedMps: 8000, requested: true, nearestColliderM: Infinity,
    bodyId, bodyRadiusM: provider.bodyDef.semiMajorAxisM, entryPositionM: position, entryVelocityMps: velocity }, 0);
  const interplanetary = new CosmicCruiseController();
  const game = Object.create(Game.prototype) as any;
  Object.assign(game, { universe, planetProviders: providers, player, input, camera: cameraController, travelDomain,
    interplanetary, navigation: new NavigationTargetState(), landingIntent: new PlanetaryLandingIntent(), warpStep: 3,
    rendering: { camera }, viewForward: new Vector3(0, 0, -1), physicsDomain: 'space', surfaceTerrains: new Map(),
    colliders: [], curvedColliders: [], attackBoxes: [], blastBoxes: [], renderOriginVec: new Vector3(),
    localRoot: new Group(), actorRoot: new Group(), hud: { notify() {} }, celestialController: { renderSamples: [] } });
  game.selectNavigationTarget(bodyId, 'reticle');
  interplanetary.autopilot.engage();
  // Coarse presentation has the fallback, but does not accidentally satisfy the local
  // surface-coverage gate. Only the actual small prefetch patch can unblock this fixture.
  provider.setStreamingMode('coarse');
  let timeS = 0;
  const plan = () => {
    game.updateLandingPrefetch();
    const playerPose = pose('solar-system/barycentric', universe.playerSystemPositionM());
    const context: StreamingContext = { spatial: { timeS, player: playerPose,
      frame: activeFrame(referenceFrame({ id: 'solar-system/barycentric', kind: 'system' }), playerPose),
      localVelocityMps: [0, 0, 0], altitudeM: game.surfaceClearanceM(bodyId), bodyId },
      camera: { fovRad: 1, viewportHeightPx: 1080, forward: [-1, 0, 0] },
      quality: { sseTargetPx: 8, detailFactor: 1 }, budget: DEFAULT_STREAMING_BUDGET };
    return provider.plan(context);
  };
  const step = (dt = 1 / 30) => {
    game.updateTravelDomain(dt);
    if (travelDomain.isTravelling) game.updateInterplanetaryFlight(dt);
    timeS += dt;
    return game.landingMotion(bodyId);
  };
  const dispose = () => {
    PhysicsWorld.setTerrain(null); player.character.dispose(); universe.dispose();
    for (const value of providers.values()) value.globe.dispose();
  };
  return { game, universe, player, travelDomain, interplanetary, provider, held, edges, plan, step, dispose };
}

for (const bodyId of ['moon', 'mars'] as const) test(`T_${bodyId.toUpperCase()}_F_SPACE_TO_GROUNDED_AND_TAKEOFF`, async () => {
  const f = fixture(bodyId);
  try {
    assert.equal(f.universe.telemetry.dominantBody, bodyId);
    assert.ok(Math.abs(f.game.landingMotion(bodyId).relativeSpeedMps - 8000) < 1e-6);
    assert.equal(f.interplanetary.autopilot.active, true);
    f.edges.add('KeyF'); f.step();
    assert.equal(f.edges.has('KeyF'), false, 'the real Game input path consumes F');
    assert.equal(f.game.warpStep, 0);
    assert.equal(f.interplanetary.autopilot.active, false);
    assert.equal(f.game.landingIntent.bodyId, bodyId);
    assert.ok(f.game.landingMotion(bodyId).relativeSpeedMps < 8000, 'capture begins in the contacted body frame');
    f.plan();
    let ready = f.provider.readiness();
    assert.ok(ready.fallbackReady);
    assert.ok(ready.landingPrefetchMissingKeys.length > 0 && ready.landingPrefetchKeys.length <= 5);
    const waitingHeight = landingHoldClearanceM(false, f.travelDomain.landingGate.returnAltitudeM);
    let holdFrames = 0;
    for (let frame = 0; frame < 2400; frame++) {
      const motion = f.step();
      assert.equal(f.travelDomain.kind, 'interplanetary', 'missing real patch forbids local handoff');
      assert.ok(motion.radialSpeedMps < .1, `capture must not bounce outwards: ${motion.radialSpeedMps}`);
      assert.ok(f.travelDomain.state!.positionM.every(Number.isFinite));
      assert.ok(f.travelDomain.state!.velocityMps.every(Number.isFinite));
      if (f.interplanetary.getTelemetry().phase === 'landing-hold' && motion.relativeSpeedMps < 1
        && Math.abs(f.game.surfaceClearanceM(bodyId) - waitingHeight) < 10) holdFrames++;
      if (holdFrames >= 60) break;
    }
    assert.ok(holdFrames >= 60, 'capture must hold close with almost zero body-relative speed while patch is missing');
    assert.ok(Math.hypot(...f.travelDomain.state!.velocityMps) > 5000,
      'body-relative hold preserves orbital motion instead of stopping in the barycentric frame');
    assert.equal(f.travelDomain.landingGate.blockedReason, 'surface-stream');
    const demands = f.plan();
    ready = f.provider.readiness();
    const keys = new Set(ready.landingPrefetchKeys);
    const critical = demands.filter(demand => keys.has(tileKeyToString(demand.key)));
    assert.equal(critical.length, keys.size);
    assert.ok(critical.every(demand => demand.gameplayCritical));
    for (const demand of critical) f.provider.activate(await f.provider.load(demand));
    assert.equal(f.provider.readiness().landingCoverageReady, true);
    assert.equal(f.provider.readiness().surfaceCoverageReady, false, 'coarse visual coverage is not a substitute for the landing patch');
    assert.equal(f.provider.readiness().activeTiles, keys.size, 'handoff requires no unrelated visual tiles');
    for (let frame = 0; frame < 2400 && f.travelDomain.isTravelling; frame++) f.step();
    assert.equal(f.travelDomain.transition.kind, 'returned');
    const before = f.universe.playerSystemPositionM();
    f.game.finishSurfaceReturn(bodyId);
    assert.equal(f.game.landingIntent.active, false);
    assert.equal(f.game.landingState.phase, 'idle', 'completed landing cannot keep reporting a pending capture');
    assert.equal(f.game.hudFlight().phase, 'arrived', 'local destination cannot show a stale surface-loading hold');
    assert.equal(f.universe.player.frame, `${bodyId}/local-enu`);
    assert.equal(f.game.surfacePhysicsState.domain, bodyId);
    assert.ok(f.game.surfaceTerrains.get(bodyId) instanceof PlanetTerrainProvider);
    assert.equal(f.player.surfaceGravityMps2, surfaceGravityMps2(f.provider.bodyDef));
    assert.ok(new Vector3(...before).distanceTo(new Vector3(...f.universe.playerSystemPositionM())) < .001);
    assert.equal(f.player.state, 'Falling');
    let terrainContact = false;
    for (let frame = 0; frame < 12_000 && f.player.state !== 'Grounded'; frame++) {
      f.player.update(1 / 30, [], 0, 0);
      terrainContact ||= f.player.lastTerrainContact !== null;
      assert.ok(f.player.position.toArray().every(Number.isFinite));
      assert.ok(f.player.position.y >= PhysicsWorld.terrainHeight(f.player.position.x, f.player.position.z, .32) - .02);
    }
    assert.equal(f.player.state, 'Grounded');
    assert.ok(terrainContact, 'real terrain CCD must resolve the descent');
    assert.ok(Math.abs(f.player.position.y - PhysicsWorld.terrainHeight(f.player.position.x, f.player.position.z, .32)) < .02);
    const grounded = f.player.position.clone();
    f.held.add('KeyW'); for (let frame = 0; frame < 30; frame++) f.player.update(1 / 30, [], 0, 0); f.held.clear();
    assert.ok(f.player.position.distanceTo(grounded) > .5, 'ordinary local walking works after handoff');
    f.edges.add('Space'); f.player.update(1 / 30, [], 0, 0);
    assert.ok(f.player.velocity.y > 0, 'ordinary jump works on the destination body');
    f.edges.add('KeyF'); f.player.update(1 / 30, [], 0, 0);
    assert.ok(f.player.state === 'Hover' || f.player.state === 'Flight', 'F takes off locally after landing');
  } finally { f.dispose(); }
});
