/**
 * HypersonicAudioSystem.ts
 *
 * Web Audio procedural spatial synthesis for hypersonic flight, sonic booms,
 * underwater acoustic filtering (Rio Negro / Solimões), impulse-response convolution
 * reverb for Teatro Amazonas, and infrasonic cosmic resonance for the Astral Leviathan.
 *
 * Implements architectural requirements from docs/research/12-procedural-spatial-audio-and-sound-synthesis.md.
 */

export const SPEED_OF_SOUND_MPS = 343;

/**
 * Computes the dimensionless Mach number for a given velocity in meters per second.
 */
export function computeMachNumber(speedMps: number): number {
  if (!Number.isFinite(speedMps) || speedMps <= 0) return 0;
  return speedMps / SPEED_OF_SOUND_MPS;
}

/**
 * Computes procedural hypersonic flight acoustic frequencies and gain curves.
 * Sawtooth oscillator simulates shear layer boundary turbulence.
 * Sine oscillator simulates aerodynamic pressure compression and vortical hum.
 */
export function computeHypersonicAcoustics(
  speedMps: number,
  atmosphericDensity01: number,
): {
  mach: number;
  active: boolean;
  sawFreq: number;
  sineFreq: number;
  gain: number;
  dynamicPressure: number;
} {
  const density = Number.isFinite(atmosphericDensity01) ? Math.max(0, Math.min(1, atmosphericDensity01)) : 0;
  const speed = Number.isFinite(speedMps) ? Math.max(0, speedMps) : 0;
  const mach = computeMachNumber(speed);

  // In vacuum or below atmospheric threshold: silent
  if (density <= 0.005 || speed < 120) {
    return { mach, active: false, sawFreq: 35, sineFreq: 50, gain: 0, dynamicPressure: 0 };
  }

  // Dynamic pressure q = 0.5 * rho * v^2
  const dynamicPressure = 0.5 * density * (speed * speed);

  // Sawtooth shear turbulence frequency: 35 Hz base up to ~450 Hz at extreme Mach
  const sawFreq = Math.min(480, 35 + mach * 32);

  // Sine aerodynamic vortex frequency: 50 Hz base up to ~650 Hz
  const sineFreq = Math.min(650, 50 + mach * 48);

  // Gain scaling: dynamic pressure curve clamped to comfortable listening levels
  const gain = Math.min(0.75, Math.pow(Math.min(1.0, speed / 1500), 1.2) * density * 0.7);

  return {
    mach,
    active: mach >= 0.85 && density > 0.01,
    sawFreq,
    sineFreq,
    gain,
    dynamicPressure,
  };
}

/**
 * Detects whether the velocity crossed the sound barrier threshold (Mach 1.0 = 343 m/s)
 * between the previous and current frame.
 */
export function checkSonicBoomTransition(prevSpeedMps: number, currSpeedMps: number): boolean {
  if (!Number.isFinite(prevSpeedMps) || !Number.isFinite(currSpeedMps)) return false;
  return prevSpeedMps < SPEED_OF_SOUND_MPS && currSpeedMps >= SPEED_OF_SOUND_MPS;
}

/**
 * Computes classic relativistic / acoustic Doppler frequency shift:
 * f' = f * (c - v_listener) / (c - v_source)
 */
export function computeDopplerShift(
  baseFreq: number,
  sourceVel: number,
  listenerVel: number,
  soundSpeed: number = SPEED_OF_SOUND_MPS,
): number {
  if (baseFreq <= 0) return 0;
  const denom = Math.max(1.0, soundSpeed - sourceVel);
  const numer = Math.max(0.1, soundSpeed - listenerVel);
  return Math.max(10, Math.min(22000, baseFreq * (numer / denom)));
}

/**
 * Returns master bus low-pass filter cutoff frequency.
 * When submerged in Rio Negro or Rio Solimões, applies the mandatory 350 Hz cutoff (RF-12-03).
 */
export function getMasterCutoffFrequency(underwater: boolean, _riverName?: 'negro' | 'solimoes'): number {
  if (underwater) {
    return 350; // 350 Hz steep low-pass filter for aquatic muffling
  }
  return 22000; // Open transparent audio spectrum
}

/**
 * Synthesizes a realistic procedural acoustic impulse response (IR) buffer
 * for the interior of Teatro Amazonas (Manaus 1896 Opera House).
 * Characteristics: 2.4s reverberation time (RT60), lush early reflections from gilded tiers,
 * and high-frequency absorption from velvet drapes.
 */
export function generateTeatroAmazonasImpulseResponse(
  sampleRate: number = 44100,
  durationS: number = 2.4,
  decay: number = 2.8,
): Float32Array {
  const length = Math.floor(sampleRate * durationS);
  const impulse = new Float32Array(length);

  // Early reflections delay taps (in seconds)
  const earlyTaps = [
    { timeS: 0.018, gain: 0.75 },
    { timeS: 0.034, gain: 0.58 },
    { timeS: 0.052, gain: 0.45 },
    { timeS: 0.076, gain: 0.32 },
  ];

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Exponential energy decay envelope
    const envelope = Math.exp(-t * decay);
    // Gaussian-like pseudo-random noise
    const noise = (Math.sin(i * 12.9898 + Math.cos(i * 78.233)) * 43758.5453) % 1;
    // High-frequency absorption over time
    const hfDamping = Math.exp(-t * 1.6);

    impulse[i] = (noise * 2.0 - 1.0) * envelope * hfDamping;
  }

  // Inject discrete early reflection spikes
  for (const tap of earlyTaps) {
    const idx = Math.floor(tap.timeS * sampleRate);
    if (idx < length) {
      impulse[idx] += tap.gain;
    }
  }

  return impulse;
}

/**
 * Computes wet/dry mix coefficients for indoor acoustics at Teatro Amazonas.
 */
export function computeTheaterReverbMix(isIndoor: boolean): {
  wetGain: number;
  dryGain: number;
  decayTimeS: number;
} {
  if (isIndoor) {
    return { wetGain: 0.65, dryGain: 0.45, decayTimeS: 2.8 };
  }
  return { wetGain: 0.0, dryGain: 1.0, decayTimeS: 0.0 };
}

/**
 * Computes infrasonic sub-bass resonance parameters emitted by the Astral Leviathan (RF-12-04).
 * Emits deep 18-24 Hz sub-harmonic vibrations that rumble through the cockpit.
 */
export function computeTitanInfrasound(proximity01: number): {
  active: boolean;
  frequency: number;
  gain: number;
  pulseRateHz: number;
} {
  const prox = Number.isFinite(proximity01) ? Math.max(0, Math.min(1, proximity01)) : 0;
  if (prox <= 0.01) {
    return { active: false, frequency: 18, gain: 0, pulseRateHz: 0.2 };
  }

  const frequency = 18 + prox * 6; // 18 Hz to 24 Hz infrasound
  const gain = Math.min(0.65, Math.pow(prox, 1.4) * 0.55);
  const pulseRateHz = 0.2 + prox * 0.8; // Slow breathing pulsation

  return { active: true, frequency, gain, pulseRateHz };
}

/**
 * HypersonicAudioSystem
 * Web Audio node network managing real-time FM/additive synthesis for hypersonic atmospheric flight.
 */
export class HypersonicAudioSystem {
  private prevSpeedMps = 0;
  private sawOsc?: OscillatorNode;
  private sineOsc?: OscillatorNode;
  private synthGain?: GainNode;
  private bandpassFilter?: BiquadFilterNode;

  constructor(
    private readonly ctx?: AudioContext,
    private readonly destination?: AudioNode,
  ) {
    this.initNodes();
  }

  private initNodes(): void {
    if (!this.ctx || !this.destination) return;
    try {
      const t = this.ctx.currentTime;

      // 1. Sawtooth oscillator: shear turbulence
      this.sawOsc = this.ctx.createOscillator();
      this.sawOsc.type = 'sawtooth';
      this.sawOsc.frequency.setValueAtTime(35, t);

      // 2. Sine oscillator: aerodynamic pressure hum
      this.sineOsc = this.ctx.createOscillator();
      this.sineOsc.type = 'sine';
      this.sineOsc.frequency.setValueAtTime(50, t);

      // 3. Bandpass filter to shape aerodynamic envelope
      this.bandpassFilter = this.ctx.createBiquadFilter();
      this.bandpassFilter.type = 'bandpass';
      this.bandpassFilter.frequency.setValueAtTime(120, t);
      this.bandpassFilter.Q.setValueAtTime(1.8, t);

      // 4. Output gain node
      this.synthGain = this.ctx.createGain();
      this.synthGain.gain.setValueAtTime(0, t);

      this.sawOsc.connect(this.bandpassFilter);
      this.sineOsc.connect(this.bandpassFilter);
      this.bandpassFilter.connect(this.synthGain);
      this.synthGain.connect(this.destination);

      this.sawOsc.start(t);
      this.sineOsc.start(t);
    } catch {
      // AudioContext unavailable or restricted
    }
  }

  update(
    speedMps: number,
    atmosphericDensity01: number,
    _dt: number,
    onSonicBoom?: () => void,
  ): void {
    // Sonic boom detection on crossing Mach 1.0 (343 m/s) in atmosphere
    if (atmosphericDensity01 > 0.05 && checkSonicBoomTransition(this.prevSpeedMps, speedMps)) {
      this.triggerSonicBoom();
      onSonicBoom?.();
    }
    this.prevSpeedMps = speedMps;

    if (!this.ctx || !this.sawOsc || !this.sineOsc || !this.synthGain || !this.bandpassFilter) return;

    const acoustics = computeHypersonicAcoustics(speedMps, atmosphericDensity01);
    const t = this.ctx.currentTime;

    if (acoustics.active) {
      this.sawOsc.frequency.setTargetAtTime(acoustics.sawFreq, t, 0.1);
      this.sineOsc.frequency.setTargetAtTime(acoustics.sineFreq, t, 0.1);
      this.bandpassFilter.frequency.setTargetAtTime(acoustics.sawFreq * 1.5, t, 0.15);
      this.synthGain.gain.setTargetAtTime(acoustics.gain, t, 0.12);
    } else {
      this.synthGain.gain.setTargetAtTime(0, t, 0.15);
    }
  }

  /**
   * Synthesizes the characteristic N-wave acoustic signature of an atmospheric sonic boom.
   */
  triggerSonicBoom(): void {
    if (!this.ctx || !this.destination) return;
    try {
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.4);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.9, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

      osc.connect(gain);
      gain.connect(this.destination);

      osc.start(t);
      osc.stop(t + 0.55);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      // Audio context error recovery
    }
  }

  dispose(): void {
    try {
      this.sawOsc?.stop();
      this.sineOsc?.stop();
      this.sawOsc?.disconnect();
      this.sineOsc?.disconnect();
      this.bandpassFilter?.disconnect();
      this.synthGain?.disconnect();
    } catch {
      // Disconnect cleanup
    }
  }
}

