export type AtmosphericMedium =
  | 'earth-atmosphere'
  | 'alien-dense'
  | 'alien-thin'
  | 'alien-toxic'
  | 'cryogenic-winds'
  | 'vacuum'
  | 'airless-surface';

export interface AudioEnvironment {
  medium: AtmosphericMedium;
  atmosphericDensity01: number;
  speedMps: number;
  altitudeM: number;
  rain: boolean;
  river: boolean;
  hazardIntensity?: number;
  hypersonicActive?: boolean;
  warpActive?: boolean;
  warpFactor?: number;
  blackHoleProximity?: number;
}

/** A continuous atmosphere fade with an inaudible tail rounded to exact vacuum silence. */
export function earthAtmosphericDensity01(altitudeM: number): number {
  const density = Math.exp(-Math.max(0, altitudeM) / 8500);
  return density < 1e-5 ? 0 : density;
}

export function environmentalAudioMix(environment: AudioEnvironment) {
  const isAtmospheric = environment.medium !== 'vacuum' && environment.medium !== 'airless-surface';
  const density = isAtmospheric && Number.isFinite(environment.atmosphericDensity01)
    ? Math.max(0, Math.min(1, environment.atmosphericDensity01)) : 0;
  const speed = Number.isFinite(environment.speedMps) ? Math.max(0, environment.speedMps) : 0;

  let baseGain = 0.12;
  let baseCutoff = 280;
  let windScale = 1.0;

  switch (environment.medium) {
    case 'alien-dense':
      baseGain = 0.22;
      baseCutoff = 210;
      windScale = 1.35;
      break;
    case 'alien-thin':
      baseGain = 0.05;
      baseCutoff = 490;
      windScale = 0.45;
      break;
    case 'alien-toxic':
      baseGain = 0.18;
      baseCutoff = 620;
      windScale = 1.25;
      break;
    case 'cryogenic-winds':
      baseGain = 0.16;
      baseCutoff = 390;
      windScale = 1.3;
      break;
    case 'earth-atmosphere':
    default:
      baseGain = 0.12;
      baseCutoff = 280;
      windScale = 1.0;
      break;
  }

  const windGain = Math.min((speed / 400) * windScale, 0.42) * density;
  const ambienceGain = (environment.rain ? 0.55 : baseGain) * density + (environment.rain ? 0 : windGain);
  const frequency = environment.rain ? 2400 : environment.altitudeM > 70 ? baseCutoff + Math.min(speed * 4, 1500) : environment.river ? 550 : baseCutoff;
  return { windGain, ambienceGain, frequency };
}

export function hypersonicAudioMix(speedMps: number, atmosphericDensity01: number) {
  const density = Number.isFinite(atmosphericDensity01) ? Math.max(0, Math.min(1, atmosphericDensity01)) : 0;
  const speed = Number.isFinite(speedMps) ? Math.max(0, speedMps) : 0;
  if (density <= 0.005 || speed < 340) {
    return { active: false, gain: 0, frequency: 75, rumbleGain: 0 };
  }
  const mach = speed / 340;
  const dynPressure = density * Math.min(30, mach * mach) / 16;
  const gain = Math.min(0.55, dynPressure * 0.45);
  const frequency = Math.min(650, 75 + mach * 22);
  const rumbleGain = Math.min(0.65, dynPressure * 0.55);
  return { active: true, gain, frequency, rumbleGain };
}

export function warpCruiseAudioMix(warpActive: boolean, warpFactor: number) {
  if (!warpActive) {
    return { active: false, gain: 0, frequency: 44, modulationRateHz: 1.0 };
  }
  const factor = Number.isFinite(warpFactor) ? Math.max(1, warpFactor) : 1;
  const frequency = 44 + Math.min(76, Math.log2(factor + 1) * 7.5);
  const gain = 0.18 + Math.min(0.24, Math.log10(factor + 1) * 0.055);
  const modulationRateHz = 1.5 + Math.min(6, Math.log2(factor + 1) * 0.35);
  return { active: true, gain, frequency, modulationRateHz };
}

export function blackHoleAudioMix(proximity01: number) {
  const prox = Number.isFinite(proximity01) ? Math.max(0, Math.min(1, proximity01)) : 0;
  if (prox <= 0.001) {
    return { active: false, gain: 0, frequency: 32 };
  }
  const gain = Math.pow(prox, 1.55) * 0.32;
  const frequency = 32 + prox * 14;
  return { active: true, gain, frequency };
}

/** Environment noise has its own bus; stylized power/impact effects survive in vacuum. */
export class AudioManager {
  enabled = true;
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: GainNode;
  private effects?: GainNode;
  private filter?: BiquadFilterNode;

  // Dedicated procedural continuous synth buses
  private warpBus?: GainNode;
  private warpOsc?: OscillatorNode;
  private blackHoleBus?: GainNode;
  private blackHoleOsc?: OscillatorNode;
  private hypersonicBus?: GainNode;
  private hypersonicFilter?: BiquadFilterNode;

  /** Mixer buses, 0..1, set from the pause menu. `enabled` mutes the master independently. */
  private volumes = { master: 0.7, ambience: 0.6, effects: 0.8 };
  private ambienceLevel = 0;

  async unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') await this.context.resume();
      return;
    }
    if (typeof AudioContext === 'undefined') return;
    const ctx = (this.context = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = this.masterGain();
    this.master.connect(ctx.destination);

    // Continuous brown noise buffer for atmospheric wind
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.018) / 1.02;
      data[i] = brown * 3;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 340;

    this.ambience = ctx.createGain();
    this.ambience.gain.value = this.ambienceLevel * this.volumes.ambience;

    this.effects = ctx.createGain();
    this.effects.gain.value = this.volumes.effects;
    this.effects.connect(this.master);

    source.connect(this.filter);
    this.filter.connect(this.ambience);
    this.ambience.connect(this.master);
    source.start();

    // Setup Hypersonic Re-entry Roar synthesizer
    try {
      const hyperBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const hyperData = hyperBuffer.getChannelData(0);
      let pink = 0;
      for (let i = 0; i < hyperData.length; i++) {
        pink = pink * 0.95 + (Math.random() * 2 - 1) * 0.05;
        hyperData[i] = pink * 4.5;
      }
      const hyperSource = ctx.createBufferSource();
      hyperSource.buffer = hyperBuffer;
      hyperSource.loop = true;

      this.hypersonicFilter = ctx.createBiquadFilter();
      this.hypersonicFilter.type = 'bandpass';
      this.hypersonicFilter.frequency.value = 120;
      this.hypersonicFilter.Q.value = 2.0;

      this.hypersonicBus = ctx.createGain();
      this.hypersonicBus.gain.value = 0;

      hyperSource.connect(this.hypersonicFilter);
      this.hypersonicFilter.connect(this.hypersonicBus);
      this.hypersonicBus.connect(this.master);
      hyperSource.start();
    } catch {
      // Audio node setup resilient in restricted contexts
    }

    // Setup Warp / Hypercruise Spacetime Drone
    try {
      this.warpOsc = ctx.createOscillator();
      this.warpOsc.type = 'sine';
      this.warpOsc.frequency.value = 44;
      this.warpBus = ctx.createGain();
      this.warpBus.gain.value = 0;
      this.warpOsc.connect(this.warpBus);
      this.warpBus.connect(this.master);
      this.warpOsc.start();
    } catch {
      // Audio node setup resilient
    }

    // Setup Black Hole Infrasound Resonator
    try {
      this.blackHoleOsc = ctx.createOscillator();
      this.blackHoleOsc.type = 'triangle';
      this.blackHoleOsc.frequency.value = 32;
      this.blackHoleBus = ctx.createGain();
      this.blackHoleBus.gain.value = 0;
      this.blackHoleOsc.connect(this.blackHoleBus);
      this.blackHoleBus.connect(this.master);
      this.blackHoleOsc.start();
    } catch {
      // Audio node setup resilient
    }
  }

  private masterGain() {
    return this.enabled ? this.volumes.master * 0.4 : 0;
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    this.applyMix();
  }

  setVolumes(master: number, ambience: number, effects: number) {
    const clamp = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
    this.volumes = { master: clamp(master), ambience: clamp(ambience), effects: clamp(effects) };
    this.applyMix();
  }

  get mix() {
    return { ...this.volumes };
  }

  private applyMix() {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master?.gain.setTargetAtTime(this.masterGain(), t, 0.15);
    this.ambience?.gain.setTargetAtTime(this.ambienceLevel * this.volumes.ambience, t, 0.15);
    this.effects?.gain.setTargetAtTime(this.volumes.effects, t, 0.1);
  }

  update(environment: AudioEnvironment) {
    const mix = environmentalAudioMix(environment);
    this.ambienceLevel = mix.ambienceGain;
    if (!this.context) return;
    const t = this.context.currentTime;

    if (this.ambience && this.filter) {
      this.filter.frequency.setTargetAtTime(mix.frequency, t, 0.4);
      this.ambience.gain.setTargetAtTime(this.ambienceLevel * this.volumes.ambience, t, 0.2);
    }

    // Continuous hypersonic re-entry synthesis update
    if (this.hypersonicBus && this.hypersonicFilter) {
      const hyper = hypersonicAudioMix(environment.speedMps, environment.atmosphericDensity01);
      const hyperGain = hyper.active ? hyper.gain * this.volumes.ambience : 0;
      this.hypersonicFilter.frequency.setTargetAtTime(hyper.frequency, t, 0.25);
      this.hypersonicBus.gain.setTargetAtTime(hyperGain, t, 0.2);
    }

    // Continuous warp hypercruise resonance synthesis update
    if (this.warpBus && this.warpOsc) {
      const warp = warpCruiseAudioMix(Boolean(environment.warpActive), environment.warpFactor ?? 1);
      const warpGain = warp.active ? warp.gain * this.volumes.ambience : 0;
      this.warpOsc.frequency.setTargetAtTime(warp.frequency, t, 0.25);
      this.warpBus.gain.setTargetAtTime(warpGain, t, 0.25);
    }

    // Continuous black hole proximity infrasound update
    if (this.blackHoleBus && this.blackHoleOsc) {
      const bh = blackHoleAudioMix(environment.blackHoleProximity ?? 0);
      const bhGain = bh.active ? bh.gain * this.volumes.ambience : 0;
      this.blackHoleOsc.frequency.setTargetAtTime(bh.frequency, t, 0.3);
      this.blackHoleBus.gain.setTargetAtTime(bhGain, t, 0.25);
    }
  }

  play(name: string) {
    if (!this.context || !this.effects || !this.enabled) return;
    const ctx = this.context;
    const t = ctx.currentTime;

    // Specialized procedural sound synthesis by event
    if (name === 'planet-crack') {
      // Massive cosmic tectonic fissure: dual sub-bass sine sweep + deep rumble
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(85, t);
      osc1.frequency.exponentialRampToValueAtTime(18, t + 2.4);
      osc2.frequency.setValueAtTime(42, t);
      osc2.frequency.exponentialRampToValueAtTime(14, t + 2.5);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.75, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.effects);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 2.6);
      osc2.stop(t + 2.6);
      osc1.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        gain.disconnect();
      };
      return;
    }

    if (name === 'warp-engage') {
      // Fast swept ascending chirp + spacetime latch
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(920, t + 0.45);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
      osc.connect(gain);
      gain.connect(this.effects);
      osc.start(t);
      osc.stop(t + 0.48);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      return;
    }

    if (name === 'warp-disengage') {
      // Sub-bass spatial decompression thump
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.72);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.48, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      osc.connect(gain);
      gain.connect(this.effects);
      osc.start(t);
      osc.stop(t + 0.75);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      return;
    }

    if (name === 'hypersonic-boom') {
      // Sonic boom double transient
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.85, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain);
      gain.connect(this.effects);
      osc.start(t);
      osc.stop(t + 0.5);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      return;
    }

    if (name === 'colossus-roar') {
      // Titanic astral leviathan / planetary colossus roar
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 1.8);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.38, t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
      osc.connect(gain);
      gain.connect(this.effects);
      osc.start(t);
      osc.stop(t + 1.9);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      return;
    }

    // Default synthesis fallback for alarms, radiation, teleport, shockwaves, and discovery
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const low = name.includes('shock') || name.includes('giant') || name.includes('blizzard');
    const isAlarm = name.includes('hazard') || name.includes('alarm');
    const isRadiation = name.includes('radiation');
    const isDiscovery = name.includes('discovery');

    osc.type = isDiscovery ? 'sine' : isAlarm ? 'sawtooth' : isRadiation ? 'square' : low ? 'sine' : 'triangle';
    const startFreq = isDiscovery
      ? 523.25
      : isAlarm
        ? 880
        : isRadiation
          ? 1200
          : low
            ? name.includes('blizzard')
              ? 110
              : 85
            : name.includes('teleport')
              ? 440
              : 680;
    const endFreq = isDiscovery ? 783.99 : isAlarm ? 440 : isRadiation ? 300 : low ? 24 : 70;
    const dur = isRadiation ? 0.08 : isAlarm ? 0.4 : isDiscovery ? 0.9 : 0.75;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur * 0.8);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(isDiscovery ? 0.28 : low ? 0.45 : isAlarm ? 0.35 : 0.16, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.effects);
    osc.start(t);
    osc.stop(t + dur);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}
