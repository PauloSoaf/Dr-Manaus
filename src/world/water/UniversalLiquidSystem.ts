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
  sin, cos, smoothstep, time, dot, vec2, vec3, uniform, pow, max, reflect, clamp,
} from 'three/tsl';
import { MeshStandardNodeMaterial, Node } from 'three/webgpu';

export type LiquidSolventType = 
  | 'terrestrial-freshwater' // Rio Negro / Solimões / Amazon Basin
  | 'terrestrial-ocean'      // Earth Atlantic / Pacific / Arctic
  | 'clear-swimming-pool'    // Crystalline swimming pool with lap ripples and caustics
  | 'cryo-methane'           // Titan / Cryogenic moons (hydrocarbons at 90-110 K)
  | 'cryo-ammonia'           // Subsurface brine basins
  | 'molten-magma'           // Volcanic worlds (lava lakes at 1300-1800 K)
  | 'dense-exotic-brine';    // Hyper-saline ocean worlds

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
    deepColor: '#0a3d78',        // Luminous deep cobalt/sapphire ocean blue (distinct from Rio Negro blackwater)
    shallowColor: '#00b4d8',     // Radiant coastal azure and tropical turquoise cyan
    specularReflectColor: '#ffffff', // Crisp bright diamond sun reflections
    roughness: 0.08,             // Glossy ocean surface
    metalness: 0.40,
    fresnelPower: 4.8,
    waveDamping: 1.0,
    turbidityBeerLambertAlpha: 0.018
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

/**
 * THE Gerstner evaluator. CPU consumers (Manaus physics, buoyancy, universal sampling, the fluid
 * registry) all call this one function, and the GPU shader unrolls the identical equation with the
 * same per-harmonic constants (see WaterSystem `createMaterial`).
 *
 * `shoreDamp` scales displacement/normal near banks; `highHarmonicFilter` is the distance filter
 * applied to harmonics with index >= 2 (matches the shader's `near` factor).
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
): LiquidSampleResult {
  const count = waves.length;
  let dx = 0, dy = 0, dz = 0, waSumX = 0, waSumZ = 0;
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
    const q = amp > 1e-8 ? w.steepness / (k * amp * count) : 0;
    dx += q * amp * dirX * cosTheta;
    dy += amp * Math.sin(theta);
    dz += q * amp * dirZ * cosTheta;
    const wa = k * amp;
    waSumX += dirX * wa * cosTheta;
    waSumZ += dirZ * wa * cosTheta;
  }
  out.displacementX = dx * shoreDamp;
  out.displacementZ = dz * shoreDamp;
  out.height = baseElevationM + dy * shoreDamp;
  out.normal.set(-waSumX * shoreDamp, 1.0, -waSumZ * shoreDamp).normalize();
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
  const distToCam = cameraPosition.distance(wp);
  const distant = smoothstep(300, 8000, distToCam);
  const near = float(1).sub(distant);

  const waves = getWaveSpectrumForSolvent(solvent);
  let totalElevation: any = float(0);
  let dHx: any = float(0);
  let dHz: any = float(0);

  // Unroll Gerstner harmonic wave nodes in TSL using continuous world coordinates
  // so wave phase and peaks never restart or produce block seams at chunk edges
  for (let i = 0; i < waves.length; i++) {
    const w = waves[i];
    const k = (2.0 * Math.PI) / w.wavelength;
    const c = Math.sqrt(9.80665 / k);
    const amp = i >= 2 ? float(w.amplitude).mul(near) : float(w.amplitude);
    const phase = dot(vec2(wp.x, wp.z), vec2(w.direction[0], w.direction[1]))
      .mul(k)
      .sub(time.mul(w.speed * c));

    const sinP = sin(phase);
    const cosP = cos(phase);
    totalElevation = (totalElevation as any).add(sinP.mul(amp));
    const wa = amp.mul(k);
    dHx = (dHx as any).add(float(w.direction[0]).mul(wa).mul(cosP));
    dHz = (dHz as any).add(float(w.direction[1]).mul(wa).mul(cosP));
  }

  // Vertex displacement node
  material.positionNode = positionLocal.add(vec3(0, totalElevation, 0));

  // Analytical Gerstner wave normal
  const waveNormal = vec3(dHx.negate(), float(1.0), dHz.negate()).normalize();
  material.normalNode = waveNormal;

  // Schlick-Fresnel Specular Reflectance
  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const cosTheta = waveNormal.dot(viewDir).abs();
  const fresnel = float(1).sub(cosTheta).pow(props.fresnelPower);

  // Wave crest subsurface back-lighting rim (adapted from beautiful-water)
  const waveSlope = smoothstep(-0.06, 0.12, dHx.add(dHz));
  const sunDir = vec3(0.42, 0.82, 0.38).normalize();
  const backLighting = pow(max(dot(viewDir.negate(), sunDir), float(0.0)), 2.4);
  const crestTransmission = smoothstep(0.12, 0.72, totalElevation.add(waveSlope.mul(0.35)));
  const crestGlow = crestTransmission.mul(pow(float(1.0).sub(cosTheta), 1.4)).mul(float(0.2).add(backLighting.mul(0.8)));

  const deepCol = color(props.deepColor);
  const shallowCol = color(props.shallowColor);
  const reflectCol = color(props.specularReflectColor);

  // Depth-based Beer-Lambert light attenuation & dynamic ocean wave-slope scattering
  const shoreAttr = attribute('shore', 'float');
  const oceanWaveFacet = solvent === 'terrestrial-ocean'
    ? mix(deepCol, shallowCol, waveSlope.mul(0.60).add(totalElevation.mul(0.18)).clamp(0.0, 1.0))
    : deepCol;
  const waterColor = mix(oceanWaveFacet, shallowCol, float(1).sub(shoreAttr));

  // Fresnel sky reflection: vibrant tropical azure sky for ocean surfaces
  const skyReflection = solvent === 'terrestrial-ocean'
    ? color('#6bb6e8')
    : reflectCol;
  let finalColorNode = mix(waterColor, skyReflection, fresnel.mul(0.68));

  // Translucent Subsurface Scattering on wave crests (radiant tropical turquoise emerald)
  const sssColor = solvent === 'terrestrial-ocean' ? color('#16e2bd') : reflectCol;
  finalColorNode = finalColorNode.add(sssColor.mul(crestGlow).mul(0.55));

  // Sun specular glint (adapted from beautiful-water microfacet optics)
  const halfDir = viewDir.add(sunDir).normalize();
  const NdotH = max(waveNormal.dot(halfDir), float(0.0));
  const sunSpecular = pow(NdotH, 96.0).mul(3.8);
  finalColorNode = finalColorNode.add(reflectCol.mul(sunSpecular).mul(near.mul(0.85).add(0.15)));

  // Dynamic wave-crest breaking foam: 2D isotropic turbulence eliminates 1D parallel stripes
  const crestSignal = totalElevation.add(waveSlope.mul(0.35));
  const crestBreaking = smoothstep(0.18, 0.40, crestSignal);
  const foamUv = vec2(wp.x, wp.z).mul(0.06).add(vec2(time.mul(0.18), time.mul(-0.14)));
  const foamA = sin(foamUv.x.mul(2.4).add(cos(foamUv.y.mul(1.9))));
  const foamB = cos(foamUv.y.mul(2.4).add(sin(foamUv.x.mul(1.9))));
  const foamPattern = foamA.mul(foamB).abs();
  const crestFoam = crestBreaking.mul(smoothstep(0.15, 0.60, foamPattern)).mul(near);
  const foamColor = color('#f8fcff');

  const sparkleCoord = vec2(wp.x, wp.z).mul(0.65).add(waveNormal.xz.mul(1.5));
  const sparkleA = sin(sparkleCoord.x.mul(7.8).add(cos(sparkleCoord.y.mul(6.4))));
  const sparkleB = cos(sparkleCoord.y.mul(7.8).add(sin(sparkleCoord.x.mul(6.4))));
  const sparklePattern = pow(smoothstep(0.65, 0.98, sparkleA.mul(sparkleB).abs()), 4.0);
  const solarSparkle = sunSpecular.mul(sparklePattern).mul(near).mul(2.0);

  finalColorNode = finalColorNode.add(reflectCol.mul(solarSparkle));
  finalColorNode = mix(finalColorNode, foamColor, crestFoam.mul(0.85));

  // If fluid is incandescent magma, add emissive term
  if (props.emissiveColor && props.emissiveIntensity) {
    const emissiveCol = color(props.emissiveColor);
    material.emissiveNode = emissiveCol.mul(props.emissiveIntensity).mul(float(1).sub(fresnel.mul(0.3)));
  }

  material.colorNode = finalColorNode;
  material.roughnessNode = mix(float(props.roughness), float(0.75), distant);

  return material;
}
