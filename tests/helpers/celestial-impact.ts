import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { Game } from '../../src/game/Game.ts';
import { UniverseRuntime } from '../../src/world/runtime/UniverseRuntime.ts';
import { CosmicCruiseController } from '../../src/world/travel/CosmicFlight.ts';
import { LIGHT_SPEED_MPS } from '../../src/world/travel/TravelConstants.ts';
import { TravelDomain } from '../../src/world/travel/TravelDomain.ts';
import { NavigationTargetState } from '../../src/world/travel/NavigationLock.ts';
import { PlanetaryLandingIntent } from '../../src/world/travel/PlanetaryLanding.ts';
import { bodyExclusionEnvelopes } from '../../src/world/travel/BodyNavigation.ts';
import type { CelestialContact } from '../../src/world/travel/CelestialContact.ts';
import type { Vec3 } from '../../src/world/spatial/units.ts';
import { RockyImpactDestructionService } from '../../src/world/destruction/RockyImpactDestructionService.ts';
import { PlayerController } from '../../src/player/PlayerController.ts';

export function contact(relative: Vec3 = [0, -LIGHT_SPEED_MPS, 0], bodyId = 'earth',
  orbital: Vec3 = [12_000, 29_000, -300]): CelestialContact {
  return { bodyId, fraction: .5, contactPositionM: [10, 1_000_000, 30], impactNormalSystem: [0, 1, 0],
    playerVelocityMps: relative.map((v, i) => v + orbital[i]) as Vec3, bodyVelocityMps: [...orbital],
    relativeSpeedMps: Math.hypot(...relative), radialSpeedMps: relative[1], envelopeRadiusM: 1_000_000,
    assisted: false, responseMode: 'graze', responseRadialSpeedMps: 0, responseTangentialSpeedMps: 0 };
}

/** Production Game step, CCD, catalog, ephemerides and frame graph, with no GPU required. */
export function impactFixture(id = 'earth', speed = LIGHT_SPEED_MPS, fps = 60) {
  const universe = new UniverseRuntime({ epochS: 0 }), system = universe.activeSystem;
  const envelope = bodyExclusionEnvelopes(system).find(e => e.bodyId === id)!;
  const body = system.bodies.find(b => b.id === id)!, orbital = envelope.velocityMps!;
  const position: Vec3 = [envelope.centreM[0], envelope.centreM[1] + envelope.radiusM + 1_000,
    envelope.centreM[2]];
  const velocity: Vec3 = [orbital[0], orbital[1] - speed, orbital[2]];
  universe.updateSystemPose(position, velocity, 0);
  const travelDomain = new TravelDomain();
  travelDomain.update({ altitudeM: 1e9, speedMps: speed, requested: true, nearestColliderM: Infinity,
    bodyId: id, bodyRadiusM: body.equatorialRadiusM, entryPositionM: position, entryVelocityMps: velocity }, 0);
  const game = Object.create(Game.prototype) as any;
  const controller = new CosmicCruiseController(), held = new Set<string>();
  const input = {
    held: (key: string) => held.has(key),
    consume: (key: string) => {
      const has = held.has(key);
      held.delete(key);
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
    warpStep: speed > 500_000_000 ? 9 : 0,
    colliders: [],
    curvedColliders: [],
    attackBoxes: [],
    blastBoxes: [],
    surfaceTerrains: new Map(),
    planetProviders: new Map(),
    hud: { notify() {} },
    input,
    player,
    rendering: { camera: new PerspectiveCamera() },
    viewForward: new Vector3(0, -1, 0),
    camera: {
      setLocalView() {},
      inSpace: true,
    },
    renderOriginVec: new Vector3(),
    actorRoot: { position: new Vector3() },
    localRoot: { position: new Vector3(), visible: false },
    photosphereGround: { group: { visible: false }, update(_dt: number, _pos: any, isPhotosphere: boolean) { this.group.visible = isPhotosphere; }, dispose() {} },
  });
  game.rockyImpactDestruction=new RockyImpactDestructionService({edits:universe.volume.edits,
    body:id=>system.bodies.find(b=>b.id===id),requestRegion:(id,plan)=>universe.volume.requestImpactRegion(id,plan)});
  const step = (dt = 1 / fps) => game.updateInterplanetaryFlight(dt);
  const gameStep = (dt = 1 / fps) => {
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
    game.photosphereGround?.update(dt, game.player.position, game.district === 'FOTOSFERA' || game.physicsDomain === 'sun');
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
  const place = (distance: number, inwardSpeed = 0) => {
    const centre = system.positionOf(id)!, v = system.stateOf(id)!.velocityMps;
    const p: Vec3 = [centre[0], centre[1] + distance, centre[2]];
    const velocity: Vec3 = [v[0], v[1] - inwardSpeed, v[2]];
    travelDomain.setState({ systemId: 'sol', positionM: p, velocityMps: velocity });
    universe.updateSystemPose(p, velocity, 0);
  };
  return { game, universe, controller, travelDomain, envelope, body, held, step, gameStep, place,
    event: () => game.lastCelestialImpact, dispose: () => universe.dispose() };
}
