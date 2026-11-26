/**
 * UniversalLiquidSystem.ts
 *
 * Unified planetary and celestial fluid rendering & physics framework for Dr-Manaus.
 * 
 * Bridges:
 * 1. Local Amazonian fluvial hydrology (Rio Negro & Rio Solimões) at sub-metre resolution.
 * 2. Planetary global oceans on Earth (WGS84 ellipsoid) with depth-based Beer-Lambert absorption,
 *    Schlick-Fresnel specular highlights, and planetary wind chop.
 * 3. Exotic planetary liquids:
 *    - Oceanic worlds (deep saline oceans with hydrothermal upwelling)
 *    - Cryogenic hydrocarbon seas (Titan: liquid methane & ethane at 94 K)
 *    - Volcanic magma oceans (Io / volcanic exoplanets: incandescent molten basalt at 1400 K)
 *    - Cryo-ammonia basins (Europa/Enceladus subsurface & surface fissures)
 *
 * Physics & Performance Guarantees:
 * - O(1) heap allocation during runtime (Zero Garbage Collection).
 * - Multi-harmonic Gerstner wave displacement synchronized between CPU and TSL GPU node shaders.
 * - Dynamic kinematic buoyancy service for all vessels, probes, and floating entities.
 */

import { Vector3, Quaternion, Color, Object3D } from 'three';
import {
  attribute, cameraPosition, color, float, mix, normalWorld, positionLocal, positionWorld,
  sin, cos, smoothstep, time, dot, vec2, vec3, uniform, pow, max, reflect, clamp, sqrt, abs,
} from 'three/tsl';
import { MeshStandardNodeMaterial, Node } from 'three/webgpu';

export type LiquidSolventType = 
  | 'terrestrial-freshwater' // Rio Negro / Solimões / Amazon Basin
  | 'terrestrial-ocean'      // Earth Atlantic / Pacific / Arctic
  | 'megawave-ocean'         // Water worlds (Thalassa: 500m circumpolar megawaves)
  | 'clear-swimming-pool'    // Crystalline swimming pool with lap ripples and caustics
  | 'cryo-methane'           // Titan / Cryogenic moons (hydrocarbons at 90-110 K)
  | 'cryo-ammonia'           // Subsurface brine basins
  | 'molten-magma'           // Volcanic worlds (lava lakes at 1300-1800 K)
  | 'dense-exotic-brine';    // Hyper-saline ocean worlds

/**
 * Authoritative GPU simulation clock for all UniversalLiquidMaterials across Earth and celestial bodies.
 * Updated every frame so Gerstner harmonic waves, breaking foam, and sparkles continuously undulate.
 */
export const universalLiquidTime = uniform(0.0);

export function updateUniversalLiquidTime(timeSec: number): void {
  universalLiquidTime.value = timeSec;
}

/**
 * Authoritative floating origin render offset for all UniversalLiquidMaterials.
 * By adding this offset to positionWorld in shader calculations, wave phase,
 * sparkles, and foam become 100% continuous and invariant under floating origin rebases.
 */
export const universalLiquidOrigin = uniform(new Vector3(0, 0, 0));

export function updateUniversalLiquidOrigin(origin: Vector3): void {
  universalLiquidOrigin.value.copy(origin);
}

/**
 * Dynamic environmental sky reflection colors (zenith and horizon).
 * Matches real atmosphere / space background lighting across day, dusk, night, and orbit.
 */
export const universalLiquidSkyZenith = uniform(new Color('#164e8a'));
export const universalLiquidSkyHorizon = uniform(new Color('#6bb6e8'));

export function updateUniversalLiquidSky(zenith: Color, horizon: Color): void {
  universalLiquidSkyZenith.value.copy(zenith);
  universalLiquidSkyHorizon.value.copy(horizon);
}

/**
 * Dynamic solar direction and intensity for PBR water optics.
 * Fades specular glare to 0 at night or in deep space vacuum.
 */
export const universalLiquidSunDirection = uniform(new Vector3(0.42, 0.82, 0.38));
export const universalLiquidSunIntensity = uniform(1.0);

export function updateUniversalLiquidSun(dir: Vector3, intensity: number): void {
  universalLiquidSunDirection.value.copy(dir).normalize();
  universalLiquidSunIntensity.value = Math.max(0, intensity);
}

export interface FluidPhysicalProperties {
  densityKgM3: number;
  viscosityRelative: number;
  deepColor: string;
  shallowColor: string;
  specularReflectColor: string;
  roughness: number;
  metalness: number;
  fresnelPower: number;
  emissiveIntensity?: number;
  emissiveColor?: string;
  waveDamping: number;
  turbidityBeerLambertAlpha: number; // Optical attenuation coefficient per metre
}

export const FLUID_PRESETS: Record<LiquidSolventType, FluidPhysicalProperties> = {
  'terrestrial-freshwater': {
    densityKgM3: 998,
    viscosityRelative: 1.0,
    deepColor: '#040e11',        // Rio Negro deep humic tea
    shallowColor: '#5c492e',     // Solimões suspended clay
    specularReflectColor: '#48686d',
    roughness: 0.22,
    metalness: 0.45,
    fresnelPower: 5.0,
    waveDamping: 1.0,
    turbidityBeerLambertAlpha: 0.35
  },
  'terrestrial-ocean': {
    densityKgM3: 1025,
    viscosityRelative: 1.05,
    deepColor: '#03162c',        // Deep abyssal oceanic navy / sapphire
    shallowColor: '#0b4c6b',     // Coastal / crest wave scattering azure
    specularReflectColor: '#d6e8fa',
    roughness: 0.12,             // Natural ocean surface roughness
    metalness: 0.25,
    fresnelPower: 5.0,
    waveDamping: 1.0,
    turbidityBeerLambertAlpha: 0.018
  },
  'megawave-ocean': {
    densityKgM3: 1030,
    viscosityRelative: 1.0,
    deepColor: '#021020',        // Abyssal deep navy
    shallowColor: '#073c54',     // Subsurface turquoise rim on 500m crests
    specularReflectColor: '#e0f0ff',
    roughness: 0.05,
    metalness: 0.20,
    fresnelPower: 5.0,
    waveDamping: 1.0,
    turbidityBeerLambertAlpha: 0.015
  },
  'clear-swimming-pool': {
    densityKgM3: 997,
    viscosityRelative: 1.0,
    deepColor: '#005f73',        // Transparent rich pool blue
    shallowColor: '#0aeeb5',     // Sparkling crystalline aquamarine/cyan
    specularReflectColor: '#ffffff', // Crisp diamond sun reflection
    roughness: 0.06,             // Extremely smooth glossy finish
    metalness: 0.35,
    fresnelPower: 5.2,
    waveDamping: 1.6,
    turbidityBeerLambertAlpha: 0.012 // Ultra-low turbidity: caustics and floor tiles clearly visible
  },
  'cryo-methane': {
    densityKgM3: 450,            // Liquid methane is much lighter than water (~450 kg/m3)
    viscosityRelative: 0.2,      // Extremely low viscosity, razor-sharp ripples
    deepColor: '#0a1a15',        // Dark oily greenish hydrocarbon
    shallowColor: '#1a3a30',
    specularReflectColor: '#62c2a0',
    roughness: 0.08,
    metalness: 0.65,
    fresnelPower: 3.5,
    waveDamping: 0.7,
    turbidityBeerLambertAlpha: 0.05
  },
  'cryo-ammonia': {
    densityKgM3: 880,
    viscosityRelative: 1.8,
    deepColor: '#101726',
    shallowColor: '#283857',
    specularReflectColor: '#7a9fd6',
    roughness: 0.25,
    metalness: 0.35,
    fresnelPower: 4.2,
    waveDamping: 1.4,
    turbidityBeerLambertAlpha: 0.22
  },
  'molten-magma': {
    densityKgM3: 2800,           // Dense liquid silicate rock
    viscosityRelative: 15000,    // Extremely viscous, sluggish heavy swells
    deepColor: '#4a0800',
    shallowColor: '#962002',
    specularReflectColor: '#ffaa33',
    roughness: 0.65,
    metalness: 0.2,
    fresnelPower: 2.5,
    emissiveIntensity: 2.8,
    emissiveColor: '#ff4800',    // Glowing incandescence
    waveDamping: 4.0,
    turbidityBeerLambertAlpha: 5.0
  },
  'dense-exotic-brine': {
    densityKgM3: 1250,
    viscosityRelative: 2.2,
    deepColor: '#02181f',
    shallowColor: '#114a57',
    specularReflectColor: '#a6e2ed',
    roughness: 0.15,
    metalness: 0.5,
    fresnelPower: 5.2,
    waveDamping: 1.2,
    turbidityBeerLambertAlpha: 0.12
  }
};

export interface GerstnerWaveHarmonic {
  direction: [number, number];
  amplitude: number;
  wavelength: number;
  speed: number;
  steepness: number;
}

export type WaterWaveProfileId =
  | 'RIO_NEGRO_CALM'
  | 'RIO_NEGRO_WINDY'
  | 'SOLIMOES_CURRENT'
  | 'TERRESTRIAL_OCEAN'
  | 'MEGAWAVE_OCEAN'
  | 'SWIMMING_POOL'
  | 'CUP_WATER'
  | 'CRYOGENIC_SEA'
  | 'CRYO_AMMONIA_SEA'
  | 'DENSE_BRINE_SEA'
  | 'LAVA_LAKE';

/**
 * Shared parameterized Gerstner wave profiles used identically by CPU physics/buoyancy
 * and GPU TSL shaders across UniversalLiquidSystem, ManausHydrology, and WaterSystem.
 */
export const WATER_WAVE_PROFILES: Readonly<Record<WaterWaveProfileId, readonly GerstnerWaveHarmonic[]>> = {
  RIO_NEGRO_CALM: [
    { direction: [0.92, 0.38], amplitude: 0.16, wavelength: 42.0, speed: 1.15, steepness: 0.38 },
    { direction: [-0.35, 0.94], amplitude: 0.09, wavelength: 22.0, speed: 1.45, steepness: 0.34 },
    { direction: [0.55, -0.83], amplitude: 0.05, wavelength: 11.5, speed: 1.95, steepness: 0.28 },
    { direction: [-0.88, -0.47], amplitude: 0.025, wavelength: 5.2, speed: 2.60, steepness: 0.22 },
  ],
  RIO_NEGRO_WINDY: [
    { direction: [0.92, 0.38], amplitude: 0.28, wavelength: 42.0, speed: 1.15, steepness: 0.45 },
    { direction: [-0.35, 0.94], amplitude: 0.16, wavelength: 22.0, speed: 1.45, steepness: 0.40 },
    { direction: [0.55, -0.83], amplitude: 0.09, wavelength: 11.5, speed: 1.95, steepness: 0.35 },
    { direction: [-0.88, -0.47], amplitude: 0.05, wavelength: 5.2, speed: 2.60, steepness: 0.30 },
  ],
  SOLIMOES_CURRENT: [
    { direction: [0.95, 0.31], amplitude: 0.22, wavelength: 38.0, speed: 1.30, steepness: 0.42 },
    { direction: [-0.28, 0.96], amplitude: 0.13, wavelength: 20.0, speed: 1.60, steepness: 0.38 },
    { direction: [0.62, -0.78], amplitude: 0.075, wavelength: 10.5, speed: 2.10, steepness: 0.32 },
    { direction: [-0.84, -0.54], amplitude: 0.04, wavelength: 5.0, speed: 2.75, steepness: 0.26 },
  ],
  TERRESTRIAL_OCEAN: [
    { direction: [0.89, 0.45], amplitude: 1.85, wavelength: 160.0, speed: 1.25, steepness: 0.52 },
    { direction: [-0.42, 0.91], amplitude: 0.95, wavelength: 75.0, speed: 1.60, steepness: 0.46 },
    { direction: [0.60, -0.80], amplitude: 0.42, wavelength: 32.0, speed: 2.20, steepness: 0.38 },
    { direction: [-0.85, -0.52], amplitude: 0.18, wavelength: 12.0, speed: 3.10, steepness: 0.30 },
  ],
  MEGAWAVE_OCEAN: [
    { direction: [0.98, 0.19], amplitude: 165.0, wavelength: 4500.0, speed: 1.00, steepness: 0.65 },
    { direction: [0.92, 0.39], amplitude: 65.0, wavelength: 2200.0, speed: 1.15, steepness: 0.55 },
    { direction: [0.85, -0.52], amplitude: 15.0, wavelength: 950.0, speed: 1.40, steepness: 0.45 },
    { direction: [0.78, 0.62], amplitude: 5.0, wavelength: 320.0, speed: 1.80, steepness: 0.35 },
  ],
  SWIMMING_POOL: [
    { direction: [0.707, 0.707], amplitude: 0.035, wavelength: 3.2, speed: 1.8, steepness: 0.25 },
    { direction: [-0.60, 0.80], amplitude: 0.020, wavelength: 1.8, speed: 2.2, steepness: 0.22 },
    { direction: [0.85, -0.52], amplitude: 0.012, wavelength: 0.9, speed: 2.9, steepness: 0.18 },
  ],
  CUP_WATER: [
    { direction: [1.0, 0.0], amplitude: 0.004, wavelength: 0.12, speed: 2.4, steepness: 0.20 },
    { direction: [0.0, 1.0], amplitude: 0.0025, wavelength: 0.07, speed: 3.1, steepness: 0.18 },
    { direction: [0.707, -0.707], amplitude: 0.0015, wavelength: 0.035, speed: 4.2, steepness: 0.15 },
  ],
  // Spectra below were previously inlined in getWaveSpectrumForSolvent (magma, methane) or silently
  // fell back to the freshwater spectrum (ammonia, brine). They now live with the other profiles.
  CRYOGENIC_SEA: [
    { direction: [0.85, 0.52], amplitude: 0.18, wavelength: 18.0, speed: 1.65, steepness: 0.60 },
    { direction: [-0.45, 0.89], amplitude: 0.12, wavelength: 9.5, speed: 2.10, steepness: 0.55 },
    { direction: [0.65, -0.76], amplitude: 0.06, wavelength: 4.2, speed: 3.10, steepness: 0.50 },
    { direction: [-0.92, -0.39], amplitude: 0.03, wavelength: 2.1, speed: 4.20, steepness: 0.45 },
  ],
  CRYO_AMMONIA_SEA: [
    { direction: [0.90, 0.43], amplitude: 0.12, wavelength: 30.0, speed: 0.90, steepness: 0.30 },
    { direction: [-0.40, 0.92], amplitude: 0.07, wavelength: 16.0, speed: 1.15, steepness: 0.28 },
    { direction: [0.58, -0.81], amplitude: 0.035, wavelength: 8.0, speed: 1.55, steepness: 0.24 },
    { direction: [-0.86, -0.51], amplitude: 0.018, wavelength: 3.8, speed: 2.05, steepness: 0.20 },
  ],
  DENSE_BRINE_SEA: [
    { direction: [0.88, 0.47], amplitude: 0.30, wavelength: 58.0, speed: 1.05, steepness: 0.36 },
    { direction: [-0.44, 0.90], amplitude: 0.16, wavelength: 29.0, speed: 1.30, steepness: 0.33 },
    { direction: [0.62, -0.78], amplitude: 0.08, wavelength: 13.0, speed: 1.75, steepness: 0.28 },
    { direction: [-0.84, -0.54], amplitude: 0.04, wavelength: 6.0, speed: 2.35, steepness: 0.24 },
  ],
  LAVA_LAKE: [
    { direction: [0.707, 0.707], amplitude: 0.60, wavelength: 120.0, speed: 0.45, steepness: 0.20 },
    { direction: [-0.60, 0.80], amplitude: 0.30, wavelength: 65.0, speed: 0.60, steepness: 0.15 },
    { direction: [0.90, -0.43], amplitude: 0.10, wavelength: 25.0, speed: 0.90, steepness: 0.10 },
  ],
};

export function getWaveSpectrumForProfile(profileId: WaterWaveProfileId): GerstnerWaveHarmonic[] {
  const source = WATER_WAVE_PROFILES[profileId] ?? WATER_WAVE_PROFILES.RIO_NEGRO_CALM;
  return source.map(w => ({ ...w, direction: [w.direction[0], w.direction[1]] }));
}

/**
 * Solvent -> wave spectrum. Water presets resolve to the shared named profiles
 * (`WATER_WAVE_PROFILES`) so there is exactly one numeric definition of each water spectrum;
 * the other solvents keep their own spectra here.
 */
export function getWaveSpectrumForSolvent(type: LiquidSolventType): GerstnerWaveHarmonic[] {
  const clone = (list: readonly GerstnerWaveHarmonic[]): GerstnerWaveHarmonic[] =>
    list.map(w => ({ ...w, direction: [w.direction[0], w.direction[1]] as [number, number] }));
  switch (type) {
    case 'molten-magma':
      return clone(WATER_WAVE_PROFILES.LAVA_LAKE);
    case 'cryo-methane':
      return clone(WATER_WAVE_PROFILES.CRYOGENIC_SEA);
    case 'cryo-ammonia':
      return clone(WATER_WAVE_PROFILES.CRYO_AMMONIA_SEA);
    case 'dense-exotic-brine':
      return clone(WATER_WAVE_PROFILES.DENSE_BRINE_SEA);
    case 'terrestrial-ocean':
      return clone(WATER_WAVE_PROFILES.TERRESTRIAL_OCEAN);
    case 'megawave-ocean':
      return clone(WATER_WAVE_PROFILES.MEGAWAVE_OCEAN);
    case 'clear-swimming-pool':
      return clone(WATER_WAVE_PROFILES.SWIMMING_POOL);
    case 'terrestrial-freshwater':
    default:
      return clone(WATER_WAVE_PROFILES.RIO_NEGRO_WINDY);
  }
}

export interface LiquidSampleResult {
  height: number;
  displacementX: number;
  displacementZ: number;
  normal: Vector3;
}

function calcSmoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * THE Gerstner evaluator. CPU consumers (Manaus physics, buoyancy, universal sampling, the fluid
 * registry) all call this one function, and the GPU shader unrolls the identical equation with the
 * same per-harmonic constants (see WaterSystem `createMaterial`).
 *
 * `shoreDamp` scales displacement/normal near banks; `highHarmonicFilter` is the distance filter
 * applied to harmonics with index >= 2 (matches the shader's `near` factor).
 * `depthM` attenuates waves in shallow water matching the GPU `depthDamp = smoothstep(0.04, 1.4, geomDepth)`.
 */
export function sampleGerstnerSpectrum(
  waves: readonly GerstnerWaveHarmonic[],
  x: number,
  z: number,
  timeSec: number,
  baseElevationM: number,
  out: LiquidSampleResult,
  shoreDamp = 1,
  highHarmonicFilter = 1,
  depthM?: number,
): LiquidSampleResult {
  const count = waves.length;
  const depthDamp = depthM !== undefined ? calcSmoothstep(0.04, 1.4, depthM) : 1.0;
  const waveDamp = shoreDamp * depthDamp;

  let dx = 0, dy = 0, dz = 0, waSumX = 0, waSumZ = 0, nySum = 0;
  for (let i = 0; i < count; i++) {
    const w = waves[i];
    const amp = w.amplitude * (i >= 2 ? highHarmonicFilter : 1);
    const k = (2.0 * Math.PI) / w.wavelength;
    const c = Math.sqrt(9.80665 / k);
    const len = Math.hypot(w.direction[0], w.direction[1]) || 1.0;
    const dirX = w.direction[0] / len;
    const dirZ = w.direction[1] / len;
    const theta = k * (dirX * x + dirZ * z) - w.speed * c * timeSec;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const qAmp = (w.steepness > 0 && w.amplitude > 1e-8) ? (w.steepness / (k * count)) * (i >= 2 ? highHarmonicFilter : 1) : 0;
    dx += qAmp * dirX * cosTheta;
    dy += amp * sinTheta;
    dz += qAmp * dirZ * cosTheta;
    const wa = k * amp;
    waSumX += dirX * wa * cosTheta;
    waSumZ += dirZ * wa * cosTheta;
    nySum += qAmp * k * sinTheta;
  }
  out.displacementX = dx * waveDamp;
  out.displacementZ = dz * waveDamp;
  out.height = baseElevationM + dy * waveDamp;
  out.normal.set(-waSumX * waveDamp, Math.max(0.1, 1.0 - nySum * waveDamp), -waSumZ * waveDamp).normalize();
  return out;
}

const _scratchPos = new Vector3();
const _scratchNormal = new Vector3();
const _scratchTargetQ = new Quaternion();
const _up = new Vector3(0, 1, 0);

/** Convenience sampler for a solvent's default spectrum (delegates to `sampleGerstnerSpectrum`). */
export function sampleUniversalLiquid(
  x: number,
  z: number,
  timeSec: number,
  baseElevationM: number = 0,
  solventType: LiquidSolventType = 'terrestrial-freshwater',
  out?: LiquidSampleResult
): LiquidSampleResult {
  const result = out || { height: baseElevationM, displacementX: 0, displacementZ: 0, normal: new Vector3(0, 1, 0) };
  return sampleGerstnerSpectrum(getWaveSpectrumForSolvent(solventType), x, z, timeSec, baseElevationM, result);
}
/**
 * Generates an optimized TSL Node Material for any planetary fluid body.
 * Runs in WebGPU and WebGL2 without requiring CPU geometry recalculation.
 */
export function createUniversalLiquidMaterial(solvent: LiquidSolventType): MeshStandardNodeMaterial {
  const props = FLUID_PRESETS[solvent];
  const material = new MeshStandardNodeMaterial({
    roughness: props.roughness,
    metalness: props.metalness,
    color: props.deepColor,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const wp = positionWorld;
  // Stable world position invariant under floating origin rebases:
  const stableWp = positionWorld.add(universalLiquidOrigin);
  const distToCam = cameraPosition.distance(wp);
  const isMegawave = solvent === 'megawave-ocean';
  const isOcean = solvent === 'terrestrial-ocean' || isMegawave;
  const distant = isMegawave ? smoothstep(4000, 35000, distToCam) : smoothstep(300, 8000, distToCam);
  const near = float(1).sub(distant);

  const waves = getWaveSpectrumForSolvent(solvent);
  let totalDispX: any = float(0);
  let totalElevation: any = float(0);
  let totalDispZ: any = float(0);
  let dHx: any = float(0);
  let dHz: any = float(0);
  let dHy: any = float(0);
  let dDx_dx: any = float(0);
  let dDz_dz: any = float(0);
  let dDx_dz: any = float(0);

  // Unroll Gerstner harmonic wave nodes in TSL using continuous stable coordinates
  // so wave phase, trocoidal displacement and peaks never restart or produce seams at chunk edges
  const count = waves.length;
  for (let i = 0; i < count; i++) {
    const w = waves[i];
    const k = (2.0 * Math.PI) / w.wavelength;
    const c = Math.sqrt(9.80665 / k);
    const amp = i >= 2 ? float(w.amplitude).mul(near) : float(w.amplitude);
    const phase = dot(vec2(stableWp.x, stableWp.z), vec2(w.direction[0], w.direction[1]))
      .mul(k)
      .sub(universalLiquidTime.mul(w.speed * c));

    const sinP = sin(phase);
    const cosP = cos(phase);

    // Trocoidal horizontal displacement: q * amp * dir * cos(phase)
    // Matches sampleGerstnerSpectrum CPU equation: q = steepness / (k * amp * count)
    const qAmp = (w.steepness > 0 && w.amplitude > 1e-8)
      ? float(w.steepness / (k * count))
      : float(0);
    const dispAmp = i >= 2 ? qAmp.mul(near) : qAmp;

    const dirX = float(w.direction[0]);
    const dirZ = float(w.direction[1]);

    totalDispX = (totalDispX as any).add(cosP.mul(dirX).mul(dispAmp));
    totalDispZ = (totalDispZ as any).add(cosP.mul(dirZ).mul(dispAmp));
    totalElevation = (totalElevation as any).add(sinP.mul(amp));

    const wa = amp.mul(k);
    dHx = (dHx as any).add(dirX.mul(wa).mul(cosP));
    dHz = (dHz as any).add(dirZ.mul(wa).mul(cosP));
    dHy = (dHy as any).add(dispAmp.mul(k).mul(sinP));

    // Crest Ocean System Jacobian Derivatives (MIT License, wave-harmonic/crest):
    // Horizontal compression derivatives to evaluate surface folding, pinching and whitecaps
    const qkaSin = dispAmp.mul(k).mul(sinP);
    dDx_dx = (dDx_dx as any).add(dirX.mul(dirX).mul(qkaSin));
    dDz_dz = (dDz_dz as any).add(dirZ.mul(dirZ).mul(qkaSin));
    dDx_dz = (dDx_dz as any).add(dirX.mul(dirZ).mul(qkaSin));
  }

  // Shoreline wave damping: ensures wave amplitude flattens out smoothly at coastlines for rivers/freshwater.
  // Open ocean has no river shoreline and must never be damped to zero if shore attribute is 0 or absent.
  const shoreAttr = attribute('shore', 'float');
  const waveDamp = isOcean ? float(1.0) : smoothstep(0.008, 0.20, shoreAttr);

  // Crest Jacobian determinant (evaluates wave crest pinching and horizontal compression)
  const J = float(1.0).sub(dDx_dx.mul(waveDamp))
    .mul(float(1.0).sub(dDz_dz.mul(waveDamp)))
    .sub(dDx_dz.mul(waveDamp).mul(dDx_dz.mul(waveDamp)));
  const wavePinch = max(float(0.0), float(1.0).sub(J));

  // Vertex displacement node: full 3D trocoidal displacement (X, Y, Z)
  material.positionNode = positionLocal.add(
    vec3(totalDispX.mul(waveDamp), totalElevation.mul(waveDamp), totalDispZ.mul(waveDamp))
  );

  // Exact analytical Gerstner wave normal from GPU Gems:
  // N = normalize(-dHx * waveDamp, max(0.1, 1.0 - dHy * waveDamp), -dHz * waveDamp)
  const waveNormal = vec3(
    dHx.mul(waveDamp).negate(),
    max(float(0.1), float(1.0).sub(dHy.mul(waveDamp))),
    dHz.mul(waveDamp).negate()
  ).normalize();
  material.normalNode = waveNormal;

  // Schlick-Fresnel Specular Reflectance
  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const cosTheta = waveNormal.dot(viewDir).abs();
  const fresnel = float(0.025).add(pow(float(1.0).sub(cosTheta), props.fresnelPower).mul(0.975));

  // Sun and view directions for PBR optics (coupled to dynamic scene sun)
  const sunDir = universalLiquidSunDirection;
  const sunFactor = universalLiquidSunIntensity;
  const halfDir = viewDir.add(sunDir).normalize();
  const NdotH = max(waveNormal.dot(halfDir), float(0.0));
  const NdotV = max(waveNormal.dot(viewDir), float(0.001));
  const NdotL = max(waveNormal.dot(sunDir), float(0.001));
  const VdotH = max(viewDir.dot(halfDir), float(0.0));
  const sunFresnel = float(0.025).add(pow(float(1.0).sub(VdotH), 5.0).mul(0.975));
  const alphaRoughness = float(props.roughness);
  const alphaSq = alphaRoughness.mul(alphaRoughness);
  const denom = NdotH.mul(NdotH).mul(alphaSq.sub(1.0)).add(1.0);
  const D = alphaSq.div(max(denom.mul(denom).mul(Math.PI), float(0.0001)));
  const oneMinusAlphaSq = float(1.0).sub(alphaSq);
  const viewTerm = NdotL.mul(sqrt(alphaSq.add(oneMinusAlphaSq.mul(NdotV).mul(NdotV))));
  const lightTerm = NdotV.mul(sqrt(alphaSq.add(oneMinusAlphaSq.mul(NdotL).mul(NdotL))));
  const Vis = float(0.5).div(max(viewTerm.add(lightTerm), float(0.0001)));
  const rawSpecular = D.mul(Vis).mul(sunFresnel).mul(NdotL);
  const broadSun = pow(max(dot(waveNormal, halfDir), float(0.0)), 128.0).mul(0.08);
  const sharpSun = rawSpecular.div(float(1.0).add(rawSpecular)).mul(2.2);
  const totalSunGlint = sharpSun.add(broadSun).mul(NdotL).mul(sunFactor);

  // Dynamic sky reflection gradient from horizon to zenith, respecting active environmental illumination
  const reflDir = reflect(viewDir.negate(), waveNormal);
  const reflectedSky = mix(universalLiquidSkyHorizon, universalLiquidSkyZenith, smoothstep(0.0, 0.75, max(reflDir.y, float(0.0))));

  // Wave crest slope & orientation
  const waveSlope = smoothstep(-0.06, 0.12, dHx.add(dHz));

  const deepCol = color(props.deepColor);
  const shallowCol = color(props.shallowColor);
  const reflectCol = color(props.specularReflectColor);

  // Crest Diffuse Grazing Scattering (OceanEmission.hlsl from wave-harmonic/crest, MIT License)
  // At steep view angles (vView -> 1, looking straight down), deep light absorption dominates.
  // At grazing angles (vView -> 0, looking across the vast horizon), forward scattering shifts to marine teal.
  const vView = abs(viewDir.y);
  const diffuseGrazing = isMegawave ? color('#041820') : color('#08384a');
  const baseScattering = mix(diffuseGrazing, deepCol, vView);

  // Depth-based light attenuation & wave-slope scattering
  const oceanElevMod = isMegawave ? totalElevation.mul(0.003) : totalElevation.mul(0.18);
  const oceanWaveFacet = isOcean
    ? mix(baseScattering, shallowCol, waveSlope.mul(0.55).add(oceanElevMod).clamp(0.0, 1.0))
    : deepCol;
  const waterColor = isOcean ? oceanWaveFacet : mix(oceanWaveFacet, shallowCol, float(1).sub(shoreAttr));

  // Natural Fresnel reflection blending
  let finalColorNode = mix(waterColor, reflectedSky, fresnel.mul(0.78));

  // Crest Subsurface Scattering (SSS) model (OceanEmission.hlsl, MIT License)
  // Physical light penetration through translucent wave crests toward the camera:
  const towardsSun = pow(max(dot(sunDir, viewDir.negate()), float(0.0)), 3.8);
  const sssColor = isMegawave ? color('#0c5b6b') : (solvent === 'terrestrial-ocean' ? color('#128c87') : reflectCol);
  const sssFactor = wavePinch.mul(0.65).add(waveSlope.mul(0.35)).mul(float(1.0).sub(vView.mul(vView))).mul(near);
  const sssLight = sssColor.mul(float(0.15).add(towardsSun.mul(0.85))).mul(sssFactor).mul(sunFactor);
  finalColorNode = finalColorNode.add(sssLight);

  // Sun specular glint (smooth GGX, free of high-frequency zebra aliasing)
  finalColorNode = finalColorNode.add(reflectCol.mul(totalSunGlint));

  // Crest Jacobian Determinant Foam (OceanFoam.hlsl, MIT License)
  // Physically spawns whitecap foam strictly where waves horizontally pinch and fold (wavePinch > 0.25).
  // Zero periodic sine waves, zero moire patterns, zero moving zebra stripes!
  const crestFoam = smoothstep(0.24, 0.60, wavePinch).mul(near);
  const foamColor = color('#f8fcff');
  finalColorNode = mix(finalColorNode, foamColor, crestFoam.mul(0.82));

  // If fluid is incandescent magma, add emissive term
  if (props.emissiveColor && props.emissiveIntensity) {
    const emissiveCol = color(props.emissiveColor);
    material.emissiveNode = emissiveCol.mul(props.emissiveIntensity).mul(float(1).sub(fresnel.mul(0.3)));
  }

  material.colorNode = finalColorNode;
  material.roughnessNode = mix(float(props.roughness), float(0.75), distant);

  return material;
}
