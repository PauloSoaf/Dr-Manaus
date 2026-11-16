import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AudioManager,
  earthAtmosphericDensity01,
  environmentalAudioMix,
  hypersonicAudioMix,
  warpCruiseAudioMix,
  blackHoleAudioMix,
} from '../src/audio/AudioManager.ts';

test('AUDIO-SYNTH: earthAtmosphericDensity01 falls smoothly and hits zero at high altitude', () => {
  const ground = earthAtmosphericDensity01(0);
  assert.equal(ground, 1);

  const km10 = earthAtmosphericDensity01(10000);
  assert.ok(km10 < 0.4 && km10 > 0.2);

  const karman = earthAtmosphericDensity01(100000);
  assert.ok(karman < 1e-4);

  const space = earthAtmosphericDensity01(150000);
  assert.equal(space, 0);
});

test('AUDIO-SYNTH: hypersonicAudioMix scales with dynamic pressure above Mach 1', () => {
  // In vacuum: no hypersonic roar
  const vac = hypersonicAudioMix(2000, 0);
  assert.equal(vac.active, false);
  assert.equal(vac.gain, 0);

  // At low speed in atmosphere: no hypersonic roar
  const subsonic = hypersonicAudioMix(150, 1.0);
  assert.equal(subsonic.active, false);
  assert.equal(subsonic.gain, 0);

  // Mach 2 in dense atmosphere
  const mach2 = hypersonicAudioMix(680, 0.9);
  assert.equal(mach2.active, true);
  assert.ok(mach2.gain > 0.05);
  assert.ok(mach2.rumbleGain > 0.05);

  // Mach 10 re-entry has higher frequency and higher gain than Mach 2
  const mach10 = hypersonicAudioMix(3400, 0.5);
  assert.equal(mach10.active, true);
  assert.ok(mach10.gain >= mach2.gain);
  assert.ok(mach10.frequency > mach2.frequency);
});

test('AUDIO-SYNTH: warpCruiseAudioMix scales frequency and gain with warp factor', () => {
  const off = warpCruiseAudioMix(false, 1);
  assert.equal(off.active, false);
  assert.equal(off.gain, 0);

  const warp1c = warpCruiseAudioMix(true, 1);
  assert.equal(warp1c.active, true);
  assert.ok(warp1c.gain > 0.15);
  assert.ok(warp1c.frequency >= 44);

  const warp256c = warpCruiseAudioMix(true, 256);
  assert.equal(warp256c.active, true);
  assert.ok(warp256c.gain > warp1c.gain);
  assert.ok(warp256c.frequency > warp1c.frequency);
  assert.ok(warp256c.modulationRateHz > warp1c.modulationRateHz);
});

test('AUDIO-SYNTH: blackHoleAudioMix swells monotonically with proximity', () => {
  const far = blackHoleAudioMix(0);
  assert.equal(far.active, false);
  assert.equal(far.gain, 0);

  const mid = blackHoleAudioMix(0.4);
  assert.equal(mid.active, true);
  assert.ok(mid.gain > 0.05);

  const near = blackHoleAudioMix(0.95);
  assert.equal(near.active, true);
  assert.ok(near.gain > mid.gain);
  assert.ok(near.frequency > mid.frequency);
});

test('AUDIO-SYNTH: AudioManager initializes safely headlessly and executes sound events without throwing', () => {
  const audio = new AudioManager();
  audio.setEnabled(true);
  audio.setVolumes(0.8, 0.7, 0.9);
  assert.equal(audio.mix.master, 0.8);

  // Update in headless Node without AudioContext
  audio.update({
    medium: 'earth-atmosphere',
    atmosphericDensity01: 1,
    speedMps: 450,
    altitudeM: 500,
    rain: false,
    river: false,
    hypersonicActive: true,
    warpActive: false,
    blackHoleProximity: 0,
  });

  // Calling play without AudioContext does not throw
  audio.play('planet-crack');
  audio.play('warp-engage');
  audio.play('warp-disengage');
  audio.play('hypersonic-boom');
  audio.play('colossus-roar');
  audio.play('discovery');
});
