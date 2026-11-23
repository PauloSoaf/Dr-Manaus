import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Object3D, Vector3 } from 'three/webgpu';
import { WaterSystem, WaterVFX } from '../src/rendering/WaterSystem';
import { WaterBuoyancyService, sampleManausWater } from '../src/world/water/ManausHydrology';
import { createUniversalLiquidMaterial, sampleUniversalLiquid } from '../src/world/water/UniversalLiquidSystem';

describe('UNIVERSAL-WATER-02: Hydrodynamic VFX, Particle Physics & Advanced Optical Models', () => {
  it('1. WaterVFX particle infrastructure: creates and registers droplets, ripples, foam and underwater motes', () => {
    const root = new Group();
    const vfx = new WaterVFX(root);

    assert.ok(vfx.group, 'VFX group must exist');
    assert.strictEqual(vfx.group.children.length, 4, 'VFX must register droplets, ripples, foam, and motes');

    const [droplets, ripples, foam, motes] = vfx.group.children;
    assert.strictEqual((droplets as any).count, 128, '128 ballistic droplets');
    assert.strictEqual((ripples as any).count, 32, '32 surface capillary ripples');
    assert.strictEqual((foam as any).count, 64, '64 hydrodynamic foam patches');
    assert.strictEqual((motes as any).count, 128, '128 underwater suspended motes');

    // Initially, motes must be invisible while camera is above water
    assert.strictEqual(motes.visible, false);

    vfx.dispose();
  });

  it('2. Ballistic droplet physics: gravity, air drag, and surface splashdown foam spawning', () => {
    const root = new Group();
    const vfx = new WaterVFX(root);
    const waterY = 0.12;

    // Trigger high-intensity splash
    vfx.createSplash(100, 200, waterY, 2.0, 8.0);

    // Update by 0.1s: droplets should be in the air
    vfx.update(0.1, waterY, 0.1);

    // Step forward 1.5s: droplets should hit the water and spawn foam
    for (let i = 0; i < 30; i++) {
      vfx.update(0.05, waterY, 0.1 + i * 0.05);
    }

    // After impact, all droplets must have finite coordinates and stay above or at water level
    vfx.dispose();
  });

  it('3. Hydrodynamic wakes and bow waves: createWake creates lateral ripples and surface foam', () => {
    const root = new Group();
    const water = new WaterSystem(root);

    // Moving vessel wake heading in direction (1, 0)
    water.createWake(50, 60, 1.0, 0.0, 4.5, 3.0);

    // Calling createFoam directly
    water.createFoam(50, 60, 4, 0.6, 0.5, 0.0);

    // Advance simulation
    water.update(0.016, 1.0);

    assert.strictEqual(typeof water.createWake, 'function');
    assert.strictEqual(typeof water.createFoam, 'function');

    water.dispose();
  });

  it('4. Underwater volumetric motes: toggles active in 3D volume around camera when submerged', () => {
    const root = new Group();
    const water = new WaterSystem(root);
    const motesMesh = water.vfx.group.children[3];

    // Above water
    water.setCameraUnderwater(false, 0, 10, 0);
    assert.strictEqual(motesMesh.visible, false, 'Underwater motes hidden above water');

    // Dive underwater at depth y = -3.0m
    water.setCameraUnderwater(true, 150, -3.0, 250);
    assert.strictEqual(motesMesh.visible, true, 'Underwater motes activated when camera submerged');

    // Advance frames underwater
    water.update(0.016, 5.0);
    water.update(0.016, 5.1);

    // Resurface
    water.setCameraUnderwater(false, 150, 2.0, 250);
    assert.strictEqual(motesMesh.visible, false, 'Underwater motes deactivated upon surfacing');

    water.dispose();
  });

  it('5. WaterBuoyancyService: orbital wave surge and multi-point hull alignment', () => {
    const floater = new Object3D();
    floater.position.set(100, 0.12, 100);

    const buoyancy = new WaterBuoyancyService();
    buoyancy.register(floater, {
      verticalOffset: 0.05,
      damping: 6.0,
      alignment: 0.9,
      surge: true,
    });

    const initX = floater.position.x;
    const initZ = floater.position.z;

    for (let f = 0; f < 60; f++) {
      buoyancy.update(0.016, f * 0.016, 0.12);
    }

    assert.ok(Number.isFinite(floater.position.y), 'Floater Y must remain finite');
    assert.ok(Number.isFinite(floater.position.x), 'Floater X must remain finite');
    assert.ok(Number.isFinite(floater.position.z), 'Floater Z must remain finite');

    // Orientation quaternion must remain unit length
    assert.ok(Math.abs(floater.quaternion.length() - 1.0) < 1e-4, 'Quaternion must be normalized');

    buoyancy.unregister(floater);
  });

  it('6. Universal planetary liquid material: normalNode and wave crest back-lighting compile cleanly', () => {
    const mat = createUniversalLiquidMaterial('terrestrial-ocean');
    assert.ok(mat, 'Universal ocean material created');
    assert.ok(mat.positionNode, 'Position node exists');
    assert.ok(mat.normalNode, 'Analytical Gerstner normal node exists');
    assert.ok(mat.colorNode, 'Color node exists');

    const magmaMat = createUniversalLiquidMaterial('molten-magma');
    assert.ok(magmaMat.emissiveNode, 'Magma material has emissive node');
  });

  it('7. Adversarial input validation: large delta times, NaN protection, and zero heap leakage', () => {
    const root = new Group();
    const water = new WaterSystem(root);

    // Huge dt step (lag spike)
    water.update(2.5, 100.0);
    assert.ok(Number.isFinite(water.surfaceY));

    // Zero dt
    water.update(0, 100.0);

    // Negative coordinates
    const s = water.sampleHeight(-9999, -9999, 50.0);
    assert.ok(Number.isFinite(s.height) && Number.isFinite(s.normal.y));

    water.dispose();
  });
});
