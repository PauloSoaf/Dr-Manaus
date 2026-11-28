import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { CameraController } from '../src/player/CameraController';
import { EARTH, bodyFixedToGeodetic } from '../src/world/planet/PlanetBody';
import { EarthGroundSurface } from '../src/world/planet/EarthSurface';
import { earthSurfaceChart, localSeaLevelY } from '../src/world/planet/LocalSurface';
import { PlanetTerrainProvider } from '../src/world/planet/PlanetTerrainProvider';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { BuildingGeneratorContext } from '../src/world/spatial/ActiveSurfaceOrigin';
import { legacyLocalToGeodetic, geodeticToLegacyLocal, MANAUS_ANCHOR, MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter';
import { followDecision, followSurface, FOLLOW_FRAMES, SURFACE_FOLLOW, surfaceDistanceM } from '../src/world/spatial/SurfaceFollow';
import { radToDeg, type Vec3 } from '../src/world/spatial/units';
import { foundationLab } from './helpers/foundation-lab';

/** Production player, camera and universe, with collision bound as the game binds it. */
function journey(start: Vector3) {
  const previousOrigin = BuildingGeneratorContext.activeOrigin;
  const universe = new UniverseRuntime({ streaming: false, epochS: 0 });
  universe.setPlayerPose(MANAUS_FRAME_ID, [start.x, start.y, start.z]);
  const lab = foundationLab(start);
  const camera = new CameraController(new PerspectiveCamera(), lab.player.input);
  camera.skipIntro();
  const bindPhysics = () => {
    const frame = universe.player.frame;
    PhysicsWorld.setTerrain(frame === MANAUS_FRAME_ID
      ? { heightAt: () => 0, heightfieldOnly: true }
      : new PlanetTerrainProvider(universe.frames, EARTH, EarthGroundSurface, frame));
  };
  bindPhysics();
  const restore = () => {
    PhysicsWorld.setTerrain(null);
    BuildingGeneratorContext.activeOrigin = previousOrigin;
    universe.dispose();
  };
  const move = () => {
    bindPhysics();
    return followSurface({ universe, player: lab.player, camera, bindPhysics });
  };
  /** Where the player is on the Earth, and how high above the ground or sea under them. */
  const where = () => {
    const frame = universe.player.frame, p = lab.player.position;
    let geo;
    if (frame === MANAUS_FRAME_ID) geo = legacyLocalToGeodetic(p.x, p.y, p.z);
    else {
      const f = universe.frames.convertPosition(frame, 'earth/fixed', [p.x, p.y, p.z]);
      geo = bodyFixedToGeodetic(EARTH, { xM: f[0], yM: f[1], zM: f[2] });
    }
    let support = PhysicsWorld.terrainHeight(p.x, p.z);
    if (frame !== MANAUS_FRAME_ID) {
      const anchor = anchorOf(frame);
      support = Math.max(support, localSeaLevelY(earthSurfaceChart(anchor.latDeg, anchor.lonDeg), EARTH, p.x, p.z));
    }
    return { latDeg: radToDeg(geo.latRad), lonDeg: radToDeg(geo.lonRad), aboveM: p.y - support };
  };
  const anchorOf = (frame: string) => {
    const [xM, yM, zM] = universe.frames.get(frame).originInParent;
    const g = bodyFixedToGeodetic(EARTH, { xM, yM, zM });
    return { latDeg: radToDeg(g.latRad), lonDeg: radToDeg(g.lonRad) };
  };
  /** Angle between the frame's up and the true vertical under the player, degrees. */
  const lean = () => {
    const frame = universe.player.frame, p = lab.player.position;
    if (frame === MANAUS_FRAME_ID) return 0;
    const up = universe.frames.convertDirection(frame, 'earth/fixed', [0, 1, 0]);
    const f = universe.frames.convertPosition(frame, 'earth/fixed', [p.x, p.y, p.z]);
    const g = bodyFixedToGeodetic(EARTH, { xM: f[0], yM: f[1], zM: f[2] });
    const normal = [Math.cos(g.latRad) * Math.cos(g.lonRad), Math.cos(g.latRad) * Math.sin(g.lonRad), Math.sin(g.latRad)];
    return radToDeg(Math.acos(Math.min(1, up[0] * normal[0] + up[1] * normal[1] + up[2] * normal[2])));
  };
  const velocityFixed = (): Vec3 => universe.frames.convertDirection(universe.player.frame, 'earth/fixed', lab.player.velocity.toArray() as Vec3);
  return { universe, lab, camera, move, where, lean, anchorOf, velocityFixed, restore };
}

test('the follow decision leaves the city far out, returns closer and re-anchors by distance', () => {
  const city = MANAUS_ANCHOR;
  const east = (km: number) => ({ latDeg: city.latDeg, lonDeg: city.lonDeg + km / 111.1 });
  assert.equal(followDecision(east(70), city, true), null);
  assert.equal(followDecision(east(81), city, true), 'follow');
  assert.equal(followDecision(east(70), east(65), false), null, 'between the two thresholds the frame stays');
  assert.equal(followDecision(east(59), east(75), false), 'manaus');
  assert.equal(followDecision(east(300), east(300 - SURFACE_FOLLOW.spanM / 1000 + .5), false), null);
  assert.equal(followDecision(east(300), east(300 - SURFACE_FOLLOW.spanM / 1000 - .5), false), 'follow');
  // Mega flight moves the anchor every ten seconds at most; slowing down re-centres it.
  assert.equal(followDecision(east(300), east(240), false, 8_000), null);
  assert.equal(followDecision(east(300), east(219), false, 8_000), 'follow');
  assert.equal(followDecision(east(300), east(240), false, 10), 'follow');
});

test('leaving Manaus keeps the place, the height over the ground, the velocity and the view', t => {
  const j = journey(new Vector3(90_000, 640, -12_000));
  t.after(j.restore);
  j.lab.player.state = 'FlyingFast';
  j.lab.player.velocity.set(480, 12, -35);
  j.camera.setLocalView(new Vector3(1, -.2, -.1).normalize().toArray());
  const before = j.where(), view = j.camera.camera.getWorldDirection(new Vector3());
  const moved = j.move()!;
  assert.equal(moved.from, MANAUS_FRAME_ID);
  assert.equal(j.universe.player.frame, FOLLOW_FRAMES[0]);
  const after = j.where();
  assert.ok(surfaceDistanceM(before, after) < 1, `moved ${surfaceDistanceM(before, after)} m`);
  assert.ok(Math.abs(after.aboveM - before.aboveM) < .5, `${before.aboveM} -> ${after.aboveM} m above ground`);
  assert.deepEqual(j.lab.player.velocity.toArray(), [480, 12, -35]);
  assert.ok(j.camera.camera.getWorldDirection(new Vector3()).angleTo(view) < 1e-6);
  assert.equal(j.lab.player.state, 'FlyingFast', 'the move is not a teleport');
  assert.equal(BuildingGeneratorContext.activeOrigin.isManaus, false);
  assert.ok(j.lean() < .01, 'down is vertical again');
  assert.deepEqual(j.universe.player.position, j.lab.player.position.toArray());
});

test('a 1,000 km flight from Manaus keeps the ground, the vertical and one frame all the way, and returns home', t => {
  const j = journey(new Vector3(70_000, 800, 0));
  t.after(j.restore);
  j.lab.player.velocity.set(2_000, 0, 0);
  const dt = .5;
  let moves = 0, worstLean = 0;
  const fly = () => {
    j.lab.player.position.addScaledVector(j.lab.player.velocity, dt);
    // Level flight over a curved planet: the height over the ground is held at 800 m.
    const here = j.where();
    j.lab.player.position.y += 800 - here.aboveM;
    const before = j.where(), speed = j.lab.player.velocity.length();
    const velocityBefore = j.universe.player.frame === MANAUS_FRAME_ID ? undefined : j.velocityFixed();
    const moved = j.move();
    if (moved) {
      moves++;
      const after = j.where();
      assert.ok(surfaceDistanceM(before, after) < 1, 'same place');
      assert.ok(Math.abs(after.aboveM - before.aboveM) < .5, 'same height over the ground');
      assert.ok(Math.abs(j.lab.player.velocity.length() - speed) < 1e-6, 'same speed');
      if (velocityBefore && moved.to !== MANAUS_FRAME_ID) {
        const turned = new Vector3(...j.velocityFixed()).angleTo(new Vector3(...velocityBefore));
        assert.ok(turned < 1e-6, `velocity keeps its direction in the world (${turned} rad)`);
      }
    }
    worstLean = Math.max(worstLean, j.lean());
    const follows = FOLLOW_FRAMES.filter(frame => j.universe.frames.has(frame));
    assert.ok(follows.length <= 1, 'old follow frames are removed');
  };
  for (let step = 0; step < 1_000; step++) fly();
  const far = j.where();
  assert.ok(surfaceDistanceM(far, MANAUS_ANCHOR) > 950_000, `${surfaceDistanceM(far, MANAUS_ANCHOR)} m out`);
  assert.ok(moves >= 40, `${moves} moves`);
  assert.ok(worstLean < SURFACE_FOLLOW.spanM / 111_000 + .05, `gravity leaned ${worstLean.toFixed(2)}°`);

  // Home again: turn around by flying the reverse velocity in the world.
  j.lab.player.velocity.negate();
  for (let step = 0; step < 1_100 && j.universe.player.frame !== MANAUS_FRAME_ID; step++) fly();
  assert.equal(j.universe.player.frame, MANAUS_FRAME_ID);
  const p = j.lab.player.position;
  const city = geodeticToLegacyLocal(legacyLocalToGeodetic(p.x, p.y, p.z));
  assert.ok(Math.abs(city[0] - p.x) < 1e-6 && Math.abs(city[2] - p.z) < 1e-6);
  assert.ok(surfaceDistanceM(j.where(), MANAUS_ANCHOR) < SURFACE_FOLLOW.returnManausM);
  assert.ok(!FOLLOW_FRAMES.some(frame => j.universe.frames.has(frame)), 'no follow frame is left behind');
  t.diagnostic(`${moves} moves, worst lean ${worstLean.toFixed(3)}°`);
});

test('production flight continues across a move exactly as it would without one', () => {
  const fly = (follow: boolean) => {
    const j = journey(new Vector3(80_100, 900, 0));
    try {
      j.lab.held.add('KeyW');
      j.lab.player.state = 'FlyingFast';
      j.lab.player.velocity.set(300, 0, 0);
      assert.equal(!!(follow && j.move()), follow);
      const heightAbove = j.where().aboveM;
      let previous = j.lab.player.position.clone(), travelled = 0;
      const steps: number[] = [];
      for (let frame = 0; frame < 60; frame++) {
        j.lab.step(1 / 60, -Math.PI / 2, 0);
        const step = j.lab.player.position.distanceTo(previous);
        steps.push(step);
        travelled += step;
        previous = j.lab.player.position.clone();
      }
      return { travelled, steps, rise: j.where().aboveM - heightAbove, speed: j.lab.player.velocity.length(), state: j.lab.player.state };
    } finally { j.restore(); }
  };
  const stayed = fly(false), moved = fly(true);
  assert.equal(moved.state, stayed.state);
  assert.ok(Math.abs(moved.travelled - stayed.travelled) < .5, `${moved.travelled} against ${stayed.travelled} m`);
  assert.ok(Math.abs(moved.speed - stayed.speed) < .5);
  // The new frame measures height over curved ground, so the heights agree within the curvature.
  assert.ok(Math.abs(moved.rise - stayed.rise) < 1, `${moved.rise} against ${stayed.rise} m`);
  moved.steps.forEach((step, i) => assert.ok(Math.abs(step - stayed.steps[i]) < .5, `frame ${i}: ${step} against ${stayed.steps[i]} m`));
});
