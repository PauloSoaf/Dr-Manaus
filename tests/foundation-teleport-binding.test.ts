import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Vector3 } from 'three/webgpu';
import { Game } from '../src/game/Game';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { TerrainDestruction } from '../src/world/destruction/TerrainDestruction';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { TravelDomain } from '../src/world/travel/TravelDomain';
import { UniversalTeleportService } from '../src/world/travel/UniversalTeleportService';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer';
import { surfaceForBody } from '../src/world/planet/BodySurfaceFactory';
import { bodyFixedToGeodetic, surfaceGravityMps2 } from '../src/world/planet/PlanetBody';
import { planetBodyFromCelestial } from '../src/world/planet/PlanetBodyAdapter';
import { earthSolidGroundAt } from '../src/world/planet/EarthElevation';
import { MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter';
import { BuildingGeneratorContext } from '../src/world/spatial/ActiveSurfaceOrigin';
import { degToRad, radToDeg } from '../src/world/spatial/units';
import { WORLD } from '../src/core/config';
import { foundationLab } from './helpers/foundation-lab';

type BoundGame = { bindSurfacePhysics(): void; surfacePhysicsState: { domain: string; frame: string; gravityMps2: number } };

/** Production teleport service, physics binding and player controller around a real universe. */
function world(t: test.TestContext) {
  const previousOrigin = BuildingGeneratorContext.activeOrigin;
  const universe = new UniverseRuntime(), travelDomain = new TravelDomain();
  const lab = foundationLab(new Vector3(WORLD.spawn.x, WORLD.spawn.y, WORLD.spawn.z));
  const cityGround = new TerrainDestruction(new Group());
  const game = Object.assign(Object.create(Game.prototype), {
    universe, travelDomain, player: lab.player, terrain: cityGround, planetProviders: new Map(), surfaceTerrains: new Map(),
    physicsDomain: '', volumePhysicsGeneration: -1, colliders: [], curvedColliders: [], attackBoxes: [], blastBoxes: [], attackTime: 0,
  }) as BoundGame;
  const service = new UniversalTeleportService({
    universe, travelDomain, player: lab.player, getColliders: () => [], prepareManaus: async () => {},
    prepareSystem: () => ({ commit() {} }), bindDestinationPhysics: () => game.bindSurfacePhysics(),
  });
  t.after(() => {
    PhysicsWorld.setTerrain(null);
    PhysicsWorld.setVolumeCollision(null);
    BuildingGeneratorContext.activeOrigin = previousOrigin;
    lab.player.character.dispose();
    cityGround.dispose();
    universe.dispose();
  });
  const teleport = (bodyId: string, latDeg: number, lonDeg: number) => service.teleport({
    kind: 'surface-geodetic', galaxyId: 'milky_way', systemId: 'sol', bodyId, latDeg, lonDeg, altitudeM: 2,
  });
  /** One frame of the game's order: bind, move, publish to the universe. */
  const frame = (dt = 1 / 60) => {
    game.bindSurfacePhysics();
    lab.step(dt);
    universe.update(lab.player.position.toArray(), lab.player.velocity.toArray(), dt);
  };
  const land = () => {
    if (lab.player.state === 'Hover' || lab.player.state === 'Flight') lab.edges.add('KeyF');
    for (let i = 0; i < 180 && lab.player.state !== 'Grounded'; i++) frame();
  };
  return { universe, lab, game, service, teleport, frame, land };
}

test('an Earth teleport outside Manaus binds its own surface frame with gravity and real ground', async t => {
  const w = world(t);
  assert.ok((await w.teleport('earth', -16.5, -68.15)).success);
  w.frame();
  assert.equal(w.game.surfacePhysicsState.domain, 'earth');
  assert.equal(w.game.surfacePhysicsState.frame, w.universe.player.frame);
  assert.ok(w.universe.player.frame.startsWith('earth/surface/'));
  assert.ok(w.game.surfacePhysicsState.gravityMps2 > 9.7);
  const laPaz = PhysicsWorld.terrainHeight(0, 0);
  // The relief field is sampled along the radius (the globe's convention), a few metres off the
  // geodetic normal at this altitude, so allow a metre.
  assert.ok(Math.abs(laPaz - earthSolidGroundAt(degToRad(-16.5), degToRad(-68.15))) < 1 && laPaz > 3000, `ground ${laPaz}`);
  w.land();
  assert.equal(w.lab.player.state, 'Grounded');
  assert.ok(Math.abs(w.lab.player.position.y - PhysicsWorld.terrainHeight(w.lab.player.position.x, w.lab.player.position.z)) < .05);

  // A second teleport on the same body must rebind to the new frame, not keep the old ground.
  assert.ok((await w.teleport('earth', 23, 12)).success);
  w.frame();
  const sahara = PhysicsWorld.terrainHeight(0, 0);
  assert.ok(Math.abs(sahara - earthSolidGroundAt(degToRad(23), degToRad(12))) < 1, `ground ${sahara}`);
  assert.ok(Math.abs(sahara - laPaz) > 1000);
});

for (const bodyId of ['moon', 'mars'] as const) {
  test(`a ${bodyId} teleport stands on the requested site under its own gravity`, async t => {
    const w = world(t);
    const [latDeg, lonDeg] = bodyId === 'moon' ? [.674, 23.47] : [-14.5684, 175.4729];
    assert.ok((await w.teleport(bodyId, latDeg, lonDeg)).success);
    const celestial = w.universe.activeSystem.bodies.find(body => body.id === bodyId)!;
    const model = planetBodyFromCelestial(celestial);
    w.frame();
    assert.equal(w.game.surfacePhysicsState.domain, bodyId);
    assert.ok(Math.abs(w.game.surfacePhysicsState.gravityMps2 - surfaceGravityMps2(surfaceForBody(celestial)!.body)) < 1e-9);
    w.land();
    assert.equal(w.lab.player.state, 'Grounded');
    const fixed = w.universe.frames.convertPosition(w.universe.player.frame, `${bodyId}/fixed`, w.universe.player.position);
    const geodetic = bodyFixedToGeodetic(model, { xM: fixed[0], yM: fixed[1], zM: fixed[2] });
    assert.ok(Math.abs(radToDeg(geodetic.latRad) - latDeg) < .01 && Math.abs(radToDeg(geodetic.lonRad) - lonDeg) < .01,
      `arrived at ${radToDeg(geodetic.latRad)}, ${radToDeg(geodetic.lonRad)}`);
    assert.ok(Math.hypot(...fixed) > .98 * celestial.equatorialRadiusM, 'the player stands on the surface, not inside the body');
  });
}

test('returning from the Andes to Manaus arrives at city height, using city ground', async t => {
  const w = world(t);
  assert.ok((await w.teleport('earth', -16.5, -68.15)).success);
  w.frame();
  assert.ok(w.lab.player.position.y > 3000);
  assert.ok((await w.service.teleport(new Vector3(WORLD.spawn.x, WORLD.spawn.y, WORLD.spawn.z))).success);
  assert.equal(w.universe.player.frame, MANAUS_FRAME_ID);
  assert.ok(Math.abs(w.lab.player.position.y - WORLD.spawn.y) < 1, `arrived at y=${w.lab.player.position.y}`);
  assert.equal(w.universe.address.bodyId, 'earth');
  w.frame();
  assert.equal(w.game.surfacePhysicsState.domain, 'manaus');
});

test('aim destinations carry the frame they are expressed in', async t => {
  const w = world(t);
  assert.ok((await w.teleport('earth', 23, 12)).success);
  w.frame();
  // A ray straight down onto the Sahara ground resolves in the current surface frame.
  const local = w.service.resolveFromAim(new Vector3(0, PhysicsWorld.terrainHeight(0, 0) + 30, 0), new Vector3(0, -1, 0), []);
  assert.equal(local?.kind, 'local-collider');
  assert.equal(local?.frameId, w.universe.player.frame);
  // A city point found on the globe from another frame is expressed in the city frame.
  const manaus = w.universe.frames.convertPosition(MANAUS_FRAME_ID, w.universe.player.frame, [0, 0, 0]);
  const above = w.universe.frames.convertPosition(MANAUS_FRAME_ID, w.universe.player.frame, [0, 400_000, 0]);
  const toCity = new Vector3(manaus[0] - above[0], manaus[1] - above[1], manaus[2] - above[2]).normalize();
  PhysicsWorld.setTerrain(null);
  const city = w.service.resolveFromAim(new Vector3(...above), toCity, []);
  assert.equal(city?.kind, 'local-collider');
  assert.equal(city?.frameId, MANAUS_FRAME_ID);
});

test('a nearby new surface anchor regenerates chunks even when the rounded region id is unchanged', () => {
  const previousDocument = globalThis.document;
  const context = { fillStyle: '', fillRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const previousOrigin = BuildingGeneratorContext.activeOrigin;
  const streamer = new WorldStreamer(new Group());
  try {
    const site = { bodyId: 'earth', latDeg: -15.7939, lonDeg: -47.8828, isManaus: false, surfaceType: 'terrestrial' as const };
    assert.equal(streamer.setRegion(site), true);
    const regionId = streamer.generationContext.regionId;
    assert.equal(streamer.setRegion(site), false, 'the same anchor keeps its chunks');
    assert.equal(streamer.setRegion({ ...site, latDeg: -15.7948 }), true, '100 m away is a different tangent frame');
    assert.equal(streamer.generationContext.regionId, regionId);
    assert.equal(BuildingGeneratorContext.activeOrigin.latDeg, -15.7948);
  } finally {
    streamer.dispose();
    BuildingGeneratorContext.activeOrigin = previousOrigin;
    globalThis.document = previousDocument;
  }
});
