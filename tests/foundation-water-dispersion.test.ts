import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWaveSpectrumForSolvent, gerstnerAngularFrequency, sampleUniversalLiquid, WATER_WAVE_PROFILES,
} from '../src/world/water/UniversalLiquidSystem';

test('waves follow deep-water dispersion, so the water surface moves at a physical speed', () => {
  // Without a speed multiplier a 160 m swell has the textbook period sqrt(2πL / g), about 10 s.
  const period = (wave: { wavelength: number; speed: number }) => 2 * Math.PI / gerstnerAngularFrequency(wave);
  assert.ok(Math.abs(period({ wavelength: 160, speed: 1 }) - Math.sqrt(2 * Math.PI * 160 / 9.80665)) < 1e-9);
  const limits = { 'terrestrial-ocean': 6, 'terrestrial-freshwater': 2, 'megawave-ocean': 45 } as const;
  for (const [solvent, limit] of Object.entries(limits) as [keyof typeof limits, number][]) {
    // The analytic bound of a Gerstner sum's vertical speed is the sum of amplitude times ω.
    const bound = getWaveSpectrumForSolvent(solvent).reduce((sum, wave) => sum + wave.amplitude * gerstnerAngularFrequency(wave), 0);
    let fastest = 0, previous = sampleUniversalLiquid(10, 20, 0, 0, solvent).height;
    for (let i = 1; i <= 1200; i++) {
      const height = sampleUniversalLiquid(10, 20, i / 60, 0, solvent).height;
      fastest = Math.max(fastest, Math.abs(height - previous) * 60);
      previous = height;
    }
    assert.ok(fastest <= bound * 1.01 && bound < limit, `${solvent} surface moves at ${fastest.toFixed(1)} m/s (bound ${bound.toFixed(1)})`);
  }
});

test('pool and cup ripples keep the angular frequencies they had before the dispersion fix', () => {
  const before = { SWIMMING_POOL: [1.8, 2.2, 2.9], CUP_WATER: [2.4, 3.1, 4.2] } as const;
  for (const [profile, speeds] of Object.entries(before) as [keyof typeof before, readonly number[]][]) {
    WATER_WAVE_PROFILES[profile].forEach((wave, i) => {
      const previous = speeds[i] * Math.sqrt(9.80665 / (2 * Math.PI / wave.wavelength));
      assert.ok(Math.abs(gerstnerAngularFrequency(wave) / previous - 1) < 1e-4, `${profile}[${i}]`);
    });
  }
});
