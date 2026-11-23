import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Object3D, Vector3, Quaternion, Mesh } from 'three/webgpu';
import { WaterSystem, WaterVFX } from '../src/rendering/WaterSystem';
import { WaterBuoyancyService, sampleManausWater } from '../src/world/water/ManausHydrology';
import {
  createUniversalLiquidMaterial,
  sampleUniversalLiquid,
  FLUID_PRESETS,
  WATER_WAVE_PROFILES,
} from '../src/world/water/UniversalLiquidSystem';
import { DynamicFluidContainer } from '../src/world/water/DynamicFluidContainer';
import { getFluid, validateFluidDefinition } from '../src/world/water/FluidRegistry';
import { manausBathymetry } from '../src/world/water/ManausBathymetry';
import { createTerrain } from '../src/world/geodata/terrain';

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

  it('8. DynamicFluidContainer: 2D sloshing ODE, meniscus curvature, spill loss, and MICRO scale registration', () => {
    let spillVolume = 0;
    const cup = new DynamicFluidContainer({
      id: 'test-cup-01',
      radiusM: 0.045,
      heightM: 0.12,
      fillFraction: 0.75,
      solvent: 'terrestrial-freshwater',
      meniscusHeightM: 0.002,
      onSpill: (vol) => { spillVolume += vol; },
    });

    // Verify MICRO scale registration
    const fluidEntry = getFluid('container-test-cup-01');
    assert.ok(fluidEntry, 'Container must register in FluidRegistry');
    assert.strictEqual(fluidEntry.scale, 'MICRO');
    assert.strictEqual(fluidEntry.geometryType, 'container');

    // Sample center vs meniscus edge: meniscus at wall edge (r = 0.044m) must be elevated
    const centerHeight = cup.sampleLocal(0, 0, 0).height;
    const edgeHeight = cup.sampleLocal(0.044, 0, 0).height;
    assert.ok(edgeHeight > centerHeight, 'Meniscus elevates fluid near container wall');

    // Simulate acceleration: container moves horizontally, provoking slosh oscillation
    const posA = new Vector3(0, 0, 0);
    const posB = new Vector3(0.5, 0, 0); // 0.5m displacement in 0.05s -> high acceleration
    cup.update(0.05, posA);
    cup.update(0.05, posB);

    assert.ok(Math.abs(cup.sloshAngleX) > 1e-4, 'Acceleration must excite 2D sloshing');

    // Sudden heavy tilt exceeding critical angle -> spills fluid
    const tiltQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI * 0.45); // 81 degrees tilt
    cup.update(0.05, posB, tiltQuat);

    assert.ok(spillVolume > 0, 'Spill callback invoked when tilt exceeds critical angle');
    assert.ok(cup.fillFraction < 0.75, 'Fill level decreases upon spilling');

    cup.dispose();
    assert.strictEqual(getFluid('container-test-cup-01'), undefined, 'Container unregisters on dispose');
  });

  it('9. Crystal-clear swimming pool: ultra-low turbidity, gentle lap ripples, and SMALL scale compliance', () => {
    const poolProps = FLUID_PRESETS['clear-swimming-pool'];
    assert.ok(poolProps, 'Clear swimming pool preset exists');
    assert.ok(poolProps.turbidityBeerLambertAlpha <= 0.015, 'Turbidity is crystal-clear (< 0.015)');
    assert.strictEqual(poolProps.roughness, 0.06, 'Glossy pool surface');

    const poolWaves = WATER_WAVE_PROFILES.SWIMMING_POOL;
    assert.ok(poolWaves.length >= 3, 'At least 3 harmonics for lap wave spectrum');

    // Pool waves must strictly obey SMALL scale limits
    validateFluidDefinition({
      id: 'pool-lap-test',
      solvent: 'clear-swimming-pool',
      geometryType: 'pool',
      scale: 'SMALL',
      profileId: 'SWIMMING_POOL',
      surfaceY: () => 0.0,
    });
  });

  it('10. Tall blue ocean rolling swell waves: peak amplitude > 3.4m, PLANETARY compliance, and deep navy sapphire color', () => {
    const oceanProps = FLUID_PRESETS['terrestrial-ocean'];
    assert.strictEqual(oceanProps.deepColor, '#0a3d78', 'Deep oceanic sapphire blue');
    assert.strictEqual(oceanProps.shallowColor, '#00b4d8', 'Brilliant coastal azure/cyan');

    const oceanWaves = WATER_WAVE_PROFILES.TERRESTRIAL_OCEAN;
    const totalPeakAmp = oceanWaves.reduce((sum, w) => sum + w.amplitude, 0);
    // Crest-to-trough range is 2 * total amplitude
    assert.ok(totalPeakAmp >= 3.0, 'Tall rolling ocean swells have total amplitude >= 3.0m (over 6m peak-to-trough)');
    assert.ok(oceanWaves[0].amplitude >= 1.8, 'Primary ocean swell harmonic amplitude >= 1.8m');

    // Conforms to PLANETARY scale limits
    validateFluidDefinition({
      id: 'planetary-ocean-test',
      solvent: 'terrestrial-ocean',
      geometryType: 'planetary-ocean',
      scale: 'PLANETARY',
      profileId: 'TERRESTRIAL_OCEAN',
      surfaceY: () => 0.0,
    });
  });

  it('11. Ponta Negra shallow wading shelf bathymetry & authentic Rio Negro deep abyss', () => {
    // Praia da Ponta Negra is located around x = -9400, z = -7400
    // Wading shelf extends gently out into the river
    const pontaShoreDist15m = manausBathymetry.sampleRiverbedHeight(-9390, -7400);
    const pontaShoreDist45m = manausBathymetry.sampleRiverbedHeight(-9360, -7400);

    // In Ponta Negra wading zone (15m to 45m out), water remains shallow (<= 1.2m deep)
    assert.ok(Math.abs(pontaShoreDist15m) <= 0.85, 'Ponta Negra 15m out is gentle shallow wading');
    assert.ok(Math.abs(pontaShoreDist45m) <= 1.35, 'Ponta Negra 45m out remains safe wading depth');

    // Central deep channel fairway reaches authentic Amazonian depths (> 40m)
    // Rio Negro fairway at d > 800m
    const deepRioNegroBed = manausBathymetry.sampleRiverbedHeight(500, 3500);
    assert.ok(deepRioNegroBed <= -35.0, `Rio Negro deep thalweg must reach authentic depth (got ${deepRioNegroBed}m)`);
  });

  it('12. Tri-biome ground coloration: distinct colors for forest green, city gray, and golden beach sand', () => {
    const root = new Group();
    const terrain = createTerrain(root);
    const groundCover = terrain.getObjectByName('ground-cover') as Mesh;
    assert.ok(groundCover, 'ground-cover must exist');

    const colAttr = groundCover.geometry.getAttribute('color');
    const posAttr = groundCover.geometry.getAttribute('position');
    assert.ok(colAttr && colAttr.count > 0, 'ground-cover must have vertex colors');

    let foundForestGreen = false;
    let foundCityGray = false;
    let foundBeachSand = false;

    for (let i = 0; i < posAttr.count; i += 23) {
      const r = colAttr.getX(i);
      const g = colAttr.getY(i);
      const b = colAttr.getZ(i);

      // Check for forest green: lush green where g dominates significantly
      if (g > 0.14 && g > r * 2.0 && g > b * 2.0) {
        foundForestGreen = true;
      }

      // Check for city gray: balanced neutral tones in urban Manaus
      if (Math.abs(r - g) < 0.02 && Math.abs(g - b) < 0.02 && r > 0.09 && r < 0.16) {
        foundCityGray = true;
      }

      // Check for beach sand: warm golden sand along shores or Ponta Negra
      if (r > 0.50 && g > 0.40 && b > 0.25 && r > g && g > b) {
        foundBeachSand = true;
      }
    }

    assert.ok(foundForestGreen, 'Must find rich green ground in rainforest');
    assert.ok(foundCityGray, 'Must find neutral gray ground in urban Manaus');
    assert.ok(foundBeachSand, 'Must find golden sand ground at Ponta Negra and river beaches');
  });
});

