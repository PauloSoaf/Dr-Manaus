import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Vector3 } from 'three/webgpu';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { BuildingGeneratorContext } from '../src/world/spatial/ActiveSurfaceOrigin';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer';
import { manausBathymetry } from '../src/world/water/ManausBathymetry';
import { OceanHorizonPresentation } from '../src/world/water/OceanHorizonPresentation';
import { foundationLab } from './helpers/foundation-lab';

const schedules = [
  [1 / 30], [1 / 60], [1 / 120], [1 / 144], [.005, .022, .011, .037], [.010, .060, .014],
];

function drive(lab: ReturnType<typeof foundationLab>, schedule: number[], duration: number, sample?: (elapsed: number) => void) {
  for (let elapsed = 0, frame = 0; elapsed < duration - 1e-10; frame++) {
    const dt = Math.min(duration - elapsed, schedule[frame % schedule.length]);
    lab.step(dt);
    elapsed += dt;
    sample?.(elapsed);
  }
}

test('foundation course preserves walking, jump and wall contact across frame schedules', t => {
  PhysicsWorld.setTerrain({ heightAt: () => 0 });
  const samples: { distance: number; apex: number; landed: number }[] = [];
  try {
    for (const schedule of schedules) {
      const lab = foundationLab(new Vector3(), [{ x: 0, y: 2.5, z: -20, width: 8, height: 5, depth: .2 }]);
      lab.player.waterVolumeActive = false;
      lab.step(1 / 60);
      lab.held.add('KeyW');
      drive(lab, schedule, 1);
      const distance = -lab.player.position.z;
      assert.ok(distance > 6 && distance < 6.5, `walk: ${distance} for ${schedule}`);
      lab.edges.add('Space');
      let apex = 0, landed = 0;
      drive(lab, schedule, 3, elapsed => {
        apex = Math.max(apex, lab.player.position.y);
        if (!landed && apex > .1 && lab.player.state === 'Grounded') landed = elapsed;
      });
      assert.ok(apex > 1.65 && apex < 1.81, `jump apex: ${apex} for ${schedule}`);
      assert.ok(landed > .7 && landed < .82, `landing: ${landed} for ${schedule}`);
      assert.equal(lab.player.state, 'Grounded');
      assert.ok(Math.abs(lab.player.position.z + 19.578) < .025, `wall: ${lab.player.position.z}`);
      assert.ok(Math.abs(lab.player.velocity.z) < .01);
      samples.push({ distance, apex, landed });
      lab.player.character.dispose();
    }
    const reference = samples[1];
    for (const sample of samples) {
      assert.ok(Math.abs(sample.distance - reference.distance) < .04, JSON.stringify(sample));
      assert.ok(Math.abs(sample.apex - reference.apex) < .07, JSON.stringify(sample));
      assert.ok(Math.abs(sample.landed - reference.landed) < .06, JSON.stringify(sample));
    }
    t.diagnostic(JSON.stringify(samples));
  } finally {
    PhysicsWorld.setTerrain(null);
  }
});

test('shallow wading and deep buoyancy remain consistent across frame schedules', t => {
  PhysicsWorld.setTerrain({ heightAt: (x, z) => manausBathymetry.sampleRiverbedHeight(x, z) });
  try {
    const bank = manausBathymetry.findShorelineZ(0, 1200, 2500, .5);
    const shallowZ = bank + 8, deepZ = bank + 120;
    const results = [];
    for (const schedule of schedules) {
      const lab = foundationLab(new Vector3(0, PhysicsWorld.terrainHeight(0, shallowZ), shallowZ));
      drive(lab, schedule, .5);
      assert.equal(lab.player.state, 'Grounded');
      assert.equal(lab.player.swimmingVisualState, 'Wading');
      const surface = manausBathymetry.sampleWaterSurface(0, deepZ, .5);
      lab.player.teleport(new Vector3(0, surface - 1.18, deepZ));
      drive(lab, schedule, 1);
      assert.equal(lab.player.state, 'Swimming');
      assert.equal(lab.player.position.z, deepZ);
      const relativeY = lab.player.position.y - lab.player.submersion.surfaceY;
      assert.ok(Math.abs(relativeY + 1.18) < .4);
      results.push(relativeY);
      lab.player.character.dispose();
    }
    assert.ok(Math.max(...results) - Math.min(...results) < .04);
    t.diagnostic(JSON.stringify(results));
  } finally {
    PhysicsWorld.setTerrain(null);
  }
});

test('teleport samples liquid with the same phase as the last simulation and visual frame', () => {
  const previousOrigin = BuildingGeneratorContext.activeOrigin;
  BuildingGeneratorContext.activeOrigin = { latDeg: 0, lonDeg: 0, isManaus: false, bodyId: 'thalassa' };
  const lab = foundationLab(new Vector3(10, 30, 20));
  try {
    lab.player.waterVolumeActive = true;
    const time = 73.5;
    const destination = new Vector3(300, 0, 200);
    const surface = manausBathymetry.sampleWaterSurface(destination.x, destination.z, time);
    destination.y = surface - .2;
    lab.player.updateLocalFrame(1 / 60, [], 0, 0, time);
    lab.player.teleport(destination);
    assert.equal(lab.player.submersion.surfaceY, surface);
    assert.equal(lab.player.state, 'Swimming');
  } finally {
    lab.player.character.dispose();
    BuildingGeneratorContext.activeOrigin = previousOrigin;
  }
});

test('ocean horizon retains the cap while only part of its snapped footprint is resident', async () => {
  const previousOrigin = BuildingGeneratorContext.activeOrigin;
  const streamer = new WorldStreamer(new Group());
  const horizon = new OceanHorizonPresentation();
  const cap = horizon.group.getObjectByName('ocean-horizon-inner-cap')!;
  const focus = new Vector3(-17, 0, 15);
  try {
    streamer.setRegion({ bodyId: 'thalassa', isManaus: false, surfaceType: 'megawave-ocean' });
    await streamer.prepare(focus);
    assert.ok(streamer.activeKeys.size >= 9);
    horizon.update(focus, true, streamer);
    assert.equal(cap.visible, true, 'the prepared 3×3 neighborhood cannot cover the disk');
    for (let i = 0; i < 150 && cap.visible; i++) {
      streamer.update(focus, new Vector3(), 1 / 60);
      horizon.update(focus, true, streamer);
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    assert.equal(cap.visible, false, 'the cap retires once every intersected ocean tile is active');
    streamer.setRegion({ bodyId: 'earth', latDeg: 0, lonDeg: -30, isManaus: false, surfaceType: 'ocean' });
    horizon.update(focus, true, streamer);
    assert.equal(cap.visible, true, 'a new region starts with its fallback');
  } finally {
    streamer.dispose();
    BuildingGeneratorContext.activeOrigin = previousOrigin;
  }
});

test('clearing a pending destination rejects that preparation and allows a retry at the same coordinates', async () => {
  const streamer = new WorldStreamer(new Group());
  try {
    const focus = new Vector3();
    const obsolete = assert.rejects(streamer.prepare(focus), /region changed/);
    streamer.clear();
    await streamer.prepare(focus);
    await obsolete;
    assert.ok(streamer.activeKeys.size >= 9);
  } finally {
    streamer.dispose();
  }
});
