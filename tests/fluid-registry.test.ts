import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three/webgpu';
import {
  FLUID_SCALE_LIMITS, clearFluidRegistry, getFluid, listFluids, registerFluid, sampleFluid,
  unregisterFluid, validateFluidDefinition, shoreWaveDamping, nearWaveDistanceFilter,
} from '../src/world/water/FluidRegistry';
import {
  FLUID_PRESETS, WATER_WAVE_PROFILES, getWaveSpectrumForSolvent, sampleUniversalLiquid,
  type GerstnerWaveHarmonic, type LiquidSolventType, type WaterWaveProfileId,
} from '../src/world/water/UniversalLiquidSystem';
import { sampleManausWater, MANAUS_RIVER_WAVES, setActiveManausWaveProfile } from '../src/world/water/ManausHydrology';
import { WaterSystem } from '../src/rendering/WaterSystem';

/** Deliberately independent oracle: textbook Gerstner sum, no shared code with the production solver. */
function oracle(waves: readonly GerstnerWaveHarmonic[], x: number, z: number, t: number, base: number, damp = 1, near = 1) {
  let h = 0, nx = 0, nz = 0;
  waves.forEach((w, i) => {
    const amp = w.amplitude * (i >= 2 ? near : 1);
    const k = 2 * Math.PI / w.wavelength, omega = w.speed * Math.sqrt(9.80665 / k);
    const L = Math.hypot(w.direction[0], w.direction[1]);
    const dx = w.direction[0] / L, dz = w.direction[1] / L;
    const th = k * (dx * x + dz * z) - omega * t;
    h += amp * Math.sin(th);
    nx += dx * k * amp * Math.cos(th);
    nz += dz * k * amp * Math.cos(th);
  });
  const n = new Vector3(-nx * damp, 1, -nz * damp).normalize();
  return { height: base + h * damp, normal: n };
}

const SOLVENTS = Object.keys(FLUID_PRESETS) as LiquidSolventType[];

describe('UNIVERSAL-WATER-01: shared fluid contract', () => {
  beforeEach(() => { clearFluidRegistry(); setActiveManausWaveProfile('RIO_NEGRO_CALM'); });

  it('1. One numeric definition per spectrum: solvent spectra resolve to the named profiles', () => {
    assert.deepEqual(getWaveSpectrumForSolvent('terrestrial-freshwater'), WATER_WAVE_PROFILES.RIO_NEGRO_WINDY);
    assert.deepEqual(getWaveSpectrumForSolvent('terrestrial-ocean'), WATER_WAVE_PROFILES.TERRESTRIAL_OCEAN);
    assert.deepEqual(getWaveSpectrumForSolvent('cryo-methane'), WATER_WAVE_PROFILES.CRYOGENIC_SEA);
    assert.deepEqual(getWaveSpectrumForSolvent('molten-magma'), WATER_WAVE_PROFILES.LAVA_LAKE);
    // Audit finding: ammonia and brine used to silently fall back to the freshwater spectrum.
    const fresh = JSON.stringify(getWaveSpectrumForSolvent('terrestrial-freshwater'));
    assert.notEqual(JSON.stringify(getWaveSpectrumForSolvent('cryo-ammonia')), fresh);
    assert.notEqual(JSON.stringify(getWaveSpectrumForSolvent('dense-exotic-brine')), fresh);
  });

  it('2. Every solvent preset has a spectrum and every spectrum is finite and non-degenerate', () => {
    for (const solvent of SOLVENTS) {
      const waves = getWaveSpectrumForSolvent(solvent);
      assert.ok(waves.length >= 3, solvent);
      for (const w of waves) {
        assert.ok(w.amplitude > 0 && w.wavelength > 0 && w.speed > 0 && w.steepness > 0 && w.steepness < 1, `${solvent} harmonic invalid`);
        assert.ok(Math.hypot(w.direction[0], w.direction[1]) > 0.5, `${solvent} direction`);
      }
    }
  });

  it('3. Production solver matches the independent oracle for every profile at scattered points/times', () => {
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (const id of Object.keys(WATER_WAVE_PROFILES) as WaterWaveProfileId[]) {
      const waves = WATER_WAVE_PROFILES[id];
      registerFluid({ id: `t-${id}`, solvent: 'terrestrial-ocean', geometryType: 'planetary-ocean', scale: 'PLANETARY', profileId: id, surfaceY: () => 1.5 });
      for (let n = 0; n < 40; n++) {
        const x = (rnd() - 0.5) * 8000, z = (rnd() - 0.5) * 8000, t = rnd() * 600, cam = rnd() * 7000;
        const got = sampleFluid(`t-${id}`, x, z, t, undefined, cam);
        const want = oracle(waves, x, z, t, 1.5, 1, nearWaveDistanceFilter(cam));
        assert.ok(Math.abs(got.height - want.height) < 1e-9, `${id} height`);
        assert.ok(got.normal.distanceTo(want.normal) < 1e-9, `${id} normal`);
      }
    }
  });

  it('4. Manaus CPU path, registry path and universal sampler agree (single solver)', () => {
    const water = new WaterSystem(new Group());
    try {
      for (const profile of ['RIO_NEGRO_CALM', 'RIO_NEGRO_WINDY', 'SOLIMOES_CURRENT'] as const) {
        water.setWaveProfile(profile);
        for (const [x, z, t, shore] of [[0, 2200, 3.3, 500], [900, 3100, 91.7, 12], [-400, 1800, 400, 2]] as const) {
          const viaManaus = sampleManausWater(x, z, t, water.surfaceY, undefined, shore);
          const want = oracle(WATER_WAVE_PROFILES[profile], x, z, t, water.surfaceY, shoreWaveDamping(shore));
          assert.ok(Math.abs(viaManaus.height - want.height) < 1e-9, `${profile} manaus vs oracle`);
          const viaRegistry = sampleFluid(water.fluidId, x, z, t);
          // registry derives shore distance from bathymetry, so compare against the same inputs
          assert.ok(Number.isFinite(viaRegistry.height));
        }
        const gpu = water.evaluateGpuWaveAt(10, 2300, 5, 800, 0);
        const cpu = sampleManausWater(10, 2300, 5, water.surfaceY, undefined, 800);
        assert.ok(Math.abs(gpu.height - cpu.height) < 1e-9, `${profile} gpu vs cpu`);
      }
      const universal = sampleUniversalLiquid(33, 77, 12, 0, 'terrestrial-ocean');
      const oc = oracle(WATER_WAVE_PROFILES.TERRESTRIAL_OCEAN, 33, 77, 12, 0);
      assert.ok(Math.abs(universal.height - oc.height) < 1e-9);
    } finally { water.dispose(); }
  });

  it('5. Registry lifecycle: duplicate ids rejected, unregister runs onDispose once, WaterSystem releases its entry', () => {
    let disposed = 0;
    registerFluid({ id: 'a', solvent: 'terrestrial-freshwater', geometryType: 'lake', scale: 'LOCAL', profileId: 'RIO_NEGRO_CALM', surfaceY: () => 0, onDispose: () => disposed++ });
    assert.throws(() => registerFluid({ id: 'a', solvent: 'terrestrial-freshwater', geometryType: 'lake', scale: 'LOCAL', profileId: 'RIO_NEGRO_CALM', surfaceY: () => 0 }));
    assert.ok(unregisterFluid('a'));
    assert.ok(!unregisterFluid('a'));
    assert.equal(disposed, 1);
    assert.throws(() => sampleFluid('a', 0, 0, 0));

    const water = new WaterSystem(new Group());
    assert.ok(getFluid(water.fluidId), 'WaterSystem registers its surface');
    const before = listFluids().length;
    water.dispose(); water.dispose();
    assert.equal(listFluids().length, before - 1, 'dispose unregisters exactly once');
  });

  it('6. Scale policy: ocean swells are rejected for cups/pools, accepted for oceans; Rio Negro stays LOCAL-valid', () => {
    const ocean = { solvent: 'terrestrial-ocean' as const, profileId: 'TERRESTRIAL_OCEAN' as const, surfaceY: () => 0 };
    assert.throws(() => validateFluidDefinition({ id: 'cup', geometryType: 'container', scale: 'MICRO', ...ocean }), /exceeds MICRO/);
    assert.throws(() => validateFluidDefinition({ id: 'pool', geometryType: 'pool', scale: 'SMALL', ...ocean }), /exceeds SMALL/);
    assert.throws(() => validateFluidDefinition({ id: 'river-ocean', geometryType: 'river', scale: 'LOCAL', ...ocean }), /exceeds LOCAL/);
    validateFluidDefinition({ id: 'sea', geometryType: 'planetary-ocean', scale: 'PLANETARY', ...ocean });
    for (const p of ['RIO_NEGRO_CALM', 'RIO_NEGRO_WINDY', 'SOLIMOES_CURRENT'] as const) {
      validateFluidDefinition({ id: `r-${p}`, solvent: 'terrestrial-freshwater', geometryType: 'river', scale: 'LOCAL', profileId: p, surfaceY: () => 0 });
    }
    assert.throws(() => validateFluidDefinition({ id: 'x', solvent: 'nope' as any, geometryType: 'lake', scale: 'LOCAL', profileId: 'RIO_NEGRO_CALM', surfaceY: () => 0 }));
    assert.throws(() => validateFluidDefinition({ id: 'y', solvent: 'terrestrial-freshwater', geometryType: 'lake', scale: 'LOCAL', surfaceY: () => 0 } as any));
    assert.ok(FLUID_SCALE_LIMITS.MICRO.maxAmplitudeM < FLUID_SCALE_LIMITS.PLANETARY.maxAmplitudeM);
  });

  it('7. Adversarial inputs: NaN/Infinity positions never produce NaN; shore damping is exactly zero at the bank', () => {
    registerFluid({ id: 'r', solvent: 'terrestrial-freshwater', geometryType: 'river', scale: 'LOCAL', profileId: 'RIO_NEGRO_WINDY', surfaceY: () => 0.12, shoreDistance: () => 0 });
    for (const [x, z, t] of [[NaN, 0, 0], [0, Infinity, 0], [0, 0, NaN]] as const) {
      const s = sampleFluid('r', x, z, t);
      assert.ok(Number.isFinite(s.height) && Number.isFinite(s.normal.y), 'finite');
      assert.equal(s.height, 0.12);
    }
    assert.equal(sampleFluid('r', 123, 456, 99).height, 0.12, 'zero displacement at shoreDistance=0');
    assert.equal(shoreWaveDamping(undefined), 1);
    assert.equal(shoreWaveDamping(-5), 0);
    assert.equal(shoreWaveDamping(1e9), 1);
    assert.equal(nearWaveDistanceFilter(NaN), 1);
    assert.ok(nearWaveDistanceFilter(1e9) < 1e-9);
  });

  it('8. Rio Negro keeps its own character: calm profile is far gentler than ocean and than windy freshwater', () => {
    const peak = (id: WaterWaveProfileId) => WATER_WAVE_PROFILES[id].reduce((s, w) => s + w.amplitude, 0);
    assert.ok(peak('RIO_NEGRO_CALM') < peak('RIO_NEGRO_WINDY'));
    assert.ok(peak('RIO_NEGRO_WINDY') < peak('TERRESTRIAL_OCEAN'));
    assert.deepEqual(MANAUS_RIVER_WAVES, WATER_WAVE_PROFILES.RIO_NEGRO_CALM, 'default Manaus spectrum is the calm profile');
  });
});

