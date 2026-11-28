import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { Game } from '../src/game/Game';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { CameraController } from '../src/player/CameraController';
import { TerrainDestruction } from '../src/world/destruction/TerrainDestruction';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { createRenderOrigin } from '../src/world/spatial/RenderOrigin';
import { manausBathymetry } from '../src/world/water/ManausBathymetry';
import { sampleUniversalLiquid, universalLiquidOrigin, updateUniversalLiquidOrigin } from '../src/world/water/UniversalLiquidSystem';
import { foundationLab } from './helpers/foundation-lab';
import type { Vec3 } from '../src/world/spatial/units';

function presentation(t: test.TestContext, lab: ReturnType<typeof foundationLab>) {
  const universe = new UniverseRuntime();
  const renderOriginVec = new Vector3();
  const surface = new Group();
  const manausAnchor = new Group();
  manausAnchor.position.set(20, 30, 40);
  const game = Object.assign(Object.create(Game.prototype), {
    universe,
    renderOriginVec,
    actorRoot: lab.player.sceneRoot,
    activeProceduralSurfaceRoot: surface,
    manausAuthoredRoot: manausAnchor,
  }) as { syncLocalRenderOrigin(): void };
  const camera = new CameraController(new PerspectiveCamera(), lab.player.input);
  const baseline = new CameraController(new PerspectiveCamera(), lab.player.input);
  camera.skipIntro();
  baseline.skipIntro();
  t.after(() => {
    universe.dispose();
    lab.player.character.dispose();
    updateUniversalLiquidOrigin(new Vector3());
  });
  return {
    universe, camera, baseline,
    publish(dt: number, time: number) {
      const { player } = lab;
      const position = player.position.clone(), velocity = player.velocity.clone();
      universe.update(position.toArray(), velocity.toArray(), dt);
      game.syncLocalRenderOrigin();
      camera.update(player, renderOriginVec, dt, []);
      baseline.update(player, new Vector3(), dt, []);

      assert.deepEqual(universe.player.position, position.toArray());
      assert.deepEqual(universe.localVelocityMps, velocity.toArray());
      assert.ok(player.position.equals(position) && player.velocity.equals(velocity));
      const rendered = player.model.getWorldPosition(new Vector3());
      assert.ok(rendered.distanceTo(new Vector3(...universe.renderSpace.logicalToRender(universe.player.frame, position.toArray()))) < 1e-8);
      const cameraRelative = camera.camera.position.clone().sub(rendered);
      assert.ok(cameraRelative.distanceTo(baseline.camera.position.clone().sub(position)) < 1e-8);
      assert.ok(camera.camera.getWorldDirection(new Vector3()).distanceTo(baseline.camera.getWorldDirection(new Vector3())) < 1e-8);

      const probe = new Vector3(80.5, 0, 2700.75);
      const shaderInput = surface.localToWorld(probe.clone()).add(universalLiquidOrigin.value);
      const before = sampleUniversalLiquid(probe.x, probe.z, time, 0, 'terrestrial-ocean');
      const after = sampleUniversalLiquid(shaderInput.x, shaderInput.z, time, 0, 'terrestrial-ocean');
      assert.equal(after.height, before.height);
      assert.ok(manausAnchor.position.equals(new Vector3(20, 30, 40)));
    },
  };
}

test('several live flight rebases across X, Y and Z preserve camera, waves and logical motion', t => {
  const lab = foundationLab(new Vector3(0, 900, 0));
  lab.player.waterVolumeActive = false;
  const view = presentation(t, lab);
  const yaw = -.7;
  view.camera.yaw = yaw;
  view.baseline.yaw = yaw;
  lab.held.add('KeyW');
  lab.held.add('Space');
  lab.held.add('ShiftLeft');
  lab.held.add('KeyB');
  const axes = [false, false, false];
  let rebaseEvents = 0;
  const unsubscribe = view.universe.floatingOrigin.subscribe({ onRebase(event) {
    rebaseEvents++;
    for (let i = 0; i < 3; i++) axes[i] ||= event.localDeltaM[i] !== 0;
  } });
  t.after(unsubscribe);
  for (let i = 1; i <= 300; i++) {
    const time = lab.step(1 / 60, yaw);
    if (i % 10 === 0) view.publish(1 / 6, time);
  }
  assert.ok(rebaseEvents >= 3);
  assert.deepEqual(axes, [true, true, true]);
  assert.equal(lab.player.state, 'Flight');
  t.diagnostic(`${rebaseEvents} rebases crossed all axes`);
});

test('walks into the Rio Negro, swims across a rebase and returns through the same shore', t => {
  const terrain = new TerrainDestruction(new Group());
  PhysicsWorld.setTerrain(terrain);
  t.after(() => {
    PhysicsWorld.setTerrain(null);
    terrain.dispose();
  });
  const bank = manausBathymetry.findShorelineZ(0, 1200, 2500, .5);
  const lab = foundationLab(new Vector3(0, 0, bank - 6));
  const view = presentation(t, lab);
  lab.held.add('KeyS');
  const dt = 1 / 60;
  let swam = false, waded = false;
  for (let i = 0; i < 540; i++) {
    const time = lab.step(dt);
    const atShore = lab.player.swimmingVisualState === 'Wading';
    waded ||= atShore;
    if (!swam && lab.player.state === 'Swimming') {
      // Start from a real, snapped prior origin at the travel threshold.
      const [x, y, z] = view.universe.renderSpace.currentOrigin.position;
      const prior: Vec3 = [x - 3072, y + 3072, z - 3072];
      view.universe.floatingOrigin.reset({ ...view.universe.player, position: prior });
      view.universe.renderSpace.setOrigin(createRenderOrigin(view.universe.player.frame, prior));
      const count = view.universe.floatingOrigin.rebaseCount;
      view.publish(dt, time);
      assert.equal(view.universe.floatingOrigin.rebaseCount, count + 1);
      assert.equal(lab.player.state, 'Swimming');
      swam = true;
    } else if (i % 15 === 0) {
      view.publish(15 * dt, time);
    }
  }
  assert.ok(waded && swam);
  lab.held.delete('KeyS');
  lab.held.add('KeyW');
  for (let i = 0; i < 720 && lab.player.position.z > bank - 3; i++) {
    const lastY = lab.player.position.y;
    const time = lab.step(dt);
    assert.ok(lab.player.position.y - lastY < .12, 'the bank must lift the player progressively');
    if (i % 15 === 0) view.publish(15 * dt, time);
  }
  assert.ok(lab.player.position.z < bank - 2);
  assert.equal(lab.player.state, 'Grounded');
});

test('ground course climbs a ramp and steps onto a platform with the production collision solver', t => {
  PhysicsWorld.setTerrain({ heightAt: (_x, z) => Math.min(1.2, Math.max(0, (-z - 3) * .12)) });
  const lab = foundationLab(new Vector3(), [
    { x: 0, y: 1.3, z: -15, width: 4, height: .2, depth: 1 },
    { x: 0, y: 1.4, z: -16, width: 4, height: .4, depth: 1 },
    { x: 0, y: 1.5, z: -17, width: 4, height: .6, depth: 1 },
    { x: 0, y: 1.6, z: -20.5, width: 4, height: .8, depth: 6 },
  ]);
  t.after(() => { PhysicsWorld.setTerrain(null); lab.player.character.dispose(); });
  lab.player.waterVolumeActive = false;
  lab.held.add('KeyW');
  for (let i = 0; i < 195; i++) lab.step(1 / 60);
  assert.ok(lab.player.position.z < -18 && lab.player.position.z > -23);
  assert.ok(Math.abs(lab.player.position.y - 2) < .03);
  assert.equal(lab.player.state, 'Grounded');
});

test('suspending the frame clock advances the liquid phase by at most one simulation frame', () => {
  const clock = Object.assign(Object.create(Game.prototype), { lastTime: 1000, liquidTimeSec: 0 }) as {
    advanceFrameClock(time: number): number;
    liquidTimeSec: number;
  };
  assert.equal(clock.advanceFrameClock(1016), .016);
  assert.equal(clock.advanceFrameClock(NaN), 0);
  assert.equal(clock.advanceFrameClock(1005), 0);
  assert.equal(clock.advanceFrameClock(11016), 10);
  assert.ok(Math.abs(clock.liquidTimeSec - .076) < 1e-12);
  assert.equal(clock.advanceFrameClock(11032), .016);
  assert.ok(Math.abs(clock.liquidTimeSec - .092) < 1e-12);
});
