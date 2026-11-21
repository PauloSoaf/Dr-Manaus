import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPEED_OF_SOUND_MPS,
  computeMachNumber,
  computeHypersonicAcoustics,
  checkSonicBoomTransition,
  computeDopplerShift,
  getMasterCutoffFrequency,
  generateTeatroAmazonasImpulseResponse,
  computeTheaterReverbMix,
  computeTitanInfrasound,
  HypersonicAudioSystem,
} from '../src/audio/HypersonicAudioSystem.ts';
import { AudioManager, environmentalAudioMix } from '../src/audio/AudioManager.ts';

test('FEATURE 16: 1. Mach number and hypersonic acoustic synthesis (Sawtooth + Sine)', () => {
  assert.equal(SPEED_OF_SOUND_MPS, 343);
  assert.equal(computeMachNumber(343), 1.0);
  assert.equal(computeMachNumber(686), 2.0);
  assert.equal(computeMachNumber(1715), 5.0);

  // In vacuum or below atmospheric threshold: silent
  const vac = computeHypersonicAcoustics(1500, 0);
  assert.equal(vac.active, false);
  assert.equal(vac.gain, 0);

  // Subsonic in atmosphere (150 m/s ~ Mach 0.44)
  const subsonic = computeHypersonicAcoustics(150, 1.0);
  assert.equal(subsonic.active, false);

  // Mach 1.5 in Earth atmosphere
  const mach15 = computeHypersonicAcoustics(343 * 1.5, 0.9);
  assert.equal(mach15.active, true);
  assert.ok(mach15.sawFreq >= 70, 'Sawtooth shear turbulence frequency scaled');
  assert.ok(mach15.sineFreq >= 110, 'Sine pressure hum frequency scaled');
  assert.ok(mach15.gain > 0.1);
  assert.ok(mach15.dynamicPressure > 10000);

  // Mach 6 hypersonic re-entry has higher frequencies and higher dynamic pressure
  const mach6 = computeHypersonicAcoustics(343 * 6.0, 0.4);
  assert.equal(mach6.active, true);
  assert.ok(mach6.sawFreq > mach15.sawFreq);
  assert.ok(mach6.sineFreq > mach15.sineFreq);
  assert.ok(mach6.dynamicPressure > mach15.dynamicPressure);
});

test('FEATURE 16: 2. Sonic boom detection on crossing sound barrier (343 m/s)', () => {
  // Staying subsonic: no boom
  assert.equal(checkSonicBoomTransition(250, 310), false);

  // Staying supersonic: no boom
  assert.equal(checkSonicBoomTransition(400, 500), false);

  // Decelerating through sound barrier: no boom
  assert.equal(checkSonicBoomTransition(380, 320), false);

  // Accelerating across sound barrier (Mach 1.0 = 343 m/s): BOOM!
  assert.equal(checkSonicBoomTransition(320, 360), true);
  assert.equal(checkSonicBoomTransition(342.9, 343.1), true);
});

test('FEATURE 16: 3. Relativistic and acoustic Doppler shift calculation', () => {
  const baseFreq = 440; // A4

  // Stationary source and listener
  const stationary = computeDopplerShift(baseFreq, 0, 0);
  assert.equal(stationary, 440);

  // Source moving toward listener at 100 m/s: blue shift (higher frequency)
  const approaching = computeDopplerShift(baseFreq, 100, 0);
  assert.ok(approaching > baseFreq, 'Approaching source must produce higher pitch');
  // f' = 440 * 343 / (343 - 100) = 440 * 343 / 243 ~ 621 Hz
  assert.ok(Math.abs(approaching - 621) < 2);

  // Source receding from listener at 100 m/s: red shift (lower frequency)
  const receding = computeDopplerShift(baseFreq, -100, 0);
  assert.ok(receding < baseFreq, 'Receding source must produce lower pitch');
  // f' = 440 * 343 / (343 - (-100)) = 440 * 343 / 443 ~ 340.6 Hz
  assert.ok(Math.abs(receding - 340.6) < 2);
});

test('FEATURE 16: 4. Underwater acoustic low-pass filter clamped at 350 Hz in Rio Negro and Solimões', () => {
  // Above water: transparent cutoff (22,000 Hz)
  const surfaceCutoff = getMasterCutoffFrequency(false);
  assert.equal(surfaceCutoff, 22000);

  // Submerged in Rio Negro: 350 Hz low-pass cutoff (RF-12-03)
  const negroCutoff = getMasterCutoffFrequency(true, 'negro');
  assert.equal(negroCutoff, 350, 'Master low-pass filter must be 350 Hz when submerged');

  // Submerged in Rio Solimões: 350 Hz low-pass cutoff
  const solimoesCutoff = getMasterCutoffFrequency(true, 'solimoes');
  assert.equal(solimoesCutoff, 350);

  // Environmental mix when underwater reflects the 350 Hz cutoff
  const underwaterMix = environmentalAudioMix({
    medium: 'earth-atmosphere',
    atmosphericDensity01: 1.0,
    speedMps: 15,
    altitudeM: -2,
    rain: false,
    river: true,
    underwater: true,
    riverName: 'negro',
  });
  assert.equal(underwaterMix.frequency, 350);
  assert.equal(underwaterMix.ambienceGain, 0.28);
});

test('FEATURE 16: 5. Teatro Amazonas Convolution Reverb impulse response and wet/dry mix', () => {
  const sampleRate = 44100;
  const durationS = 2.4;
  const ir = generateTeatroAmazonasImpulseResponse(sampleRate, durationS, 2.8);

  assert.equal(ir.length, Math.floor(sampleRate * durationS));
  assert.ok(ir[0] !== 0, 'Impulse response must start with energy');

  // Verify exponential decay: tail must have lower amplitude than head
  let headEnergy = 0;
  for (let i = 0; i < 1000; i++) headEnergy += Math.abs(ir[i]);

  let tailEnergy = 0;
  for (let i = ir.length - 1000; i < ir.length; i++) tailEnergy += Math.abs(ir[i]);

  assert.ok(tailEnergy < headEnergy * 0.05, 'Reverb energy must decay exponentially');

  // Wet/Dry mix inside Teatro Amazonas vs outdoor
  const indoorMix = computeTheaterReverbMix(true);
  assert.equal(indoorMix.wetGain, 0.65);
  assert.equal(indoorMix.dryGain, 0.45);
  assert.equal(indoorMix.decayTimeS, 2.8);

  const outdoorMix = computeTheaterReverbMix(false);
  assert.equal(outdoorMix.wetGain, 0.0);
  assert.equal(outdoorMix.dryGain, 1.0);
});

test('FEATURE 16: 6. Astral Leviathan Sub-Bass Infrasound (18-24 Hz) resonance', () => {
  // Far from titan: inactive
  const far = computeTitanInfrasound(0);
  assert.equal(far.active, false);
  assert.equal(far.gain, 0);

  // Close to titan (50% proximity): 21 Hz infrasonic rumble
  const mid = computeTitanInfrasound(0.5);
  assert.equal(mid.active, true);
  assert.ok(mid.frequency >= 18 && mid.frequency <= 24, 'Frequency in infrasonic 18-24 Hz range');
  assert.ok(mid.gain > 0.1);
  assert.ok(mid.pulseRateHz >= 0.2);

  // Point blank to titan (100% proximity): maximum sub-bass roar
  const close = computeTitanInfrasound(1.0);
  assert.equal(close.active, true);
  assert.ok(close.frequency === 24);
  assert.ok(close.gain > mid.gain);
});

test('FEATURE 16: 7. HypersonicAudioSystem and AudioManager headless integration and life cycle', () => {
  const hypersonic = new HypersonicAudioSystem();
  let sonicBoomTriggered = false;

  // Simulate acceleration through Mach 1 in atmosphere
  hypersonic.update(300, 1.0, 0.016, () => { sonicBoomTriggered = true; });
  assert.equal(sonicBoomTriggered, false);

  hypersonic.update(380, 1.0, 0.016, () => { sonicBoomTriggered = true; });
  assert.equal(sonicBoomTriggered, true, 'Sonic boom callback triggered on crossing 343 m/s');

  hypersonic.dispose();

  // Test full AudioManager update with underwater, theater, and titan proximity
  const audio = new AudioManager();
  audio.setEnabled(true);
  audio.update({
    medium: 'earth-atmosphere',
    atmosphericDensity01: 1.0,
    speedMps: 420,
    altitudeM: 10,
    rain: false,
    river: true,
    underwater: true,
    riverName: 'negro',
    theaterIndoor: true,
    titanProximity: 0.8,
  });

  // Verify play execution without errors
  audio.play('hypersonic-boom');
  audio.play('colossus-roar');
});
