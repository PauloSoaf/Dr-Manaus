/**
 * FluidRegistry — the single public entry point for every liquid surface in DR-MANAUS.
 *
 * It does not render anything. It is the shared CONTRACT that renderers (WaterSystem today; planetary
 * oceans and containers in later milestones), physics (buoyancy, swimming) and diagnostics all read:
 *
 *   solvent  -> physical/optical preset (`FLUID_PRESETS`)
 *   profile  -> wave spectrum (`WATER_WAVE_PROFILES`) evaluated by the ONE Gerstner solver
 *               (`sampleGerstnerSpectrum`) on both CPU and GPU
 *   scale    -> which wave sizes are physically plausible (a cup must not get ocean swells)
 *
 * New liquids must be registered here instead of introducing a private wave model or shader.
 */
import { Vector3 } from 'three';
import {
  FLUID_PRESETS, WATER_WAVE_PROFILES, sampleGerstnerSpectrum,
  type GerstnerWaveHarmonic, type LiquidSampleResult, type LiquidSolventType, type WaterWaveProfileId,
} from './UniversalLiquidSystem';

export type FluidScale = 'MICRO' | 'SMALL' | 'LOCAL' | 'REGIONAL' | 'PLANETARY';
export type FluidGeometryType = 'river' | 'lake' | 'pool' | 'planetary-ocean' | 'container' | 'puddle' | 'waterfall' | 'flooded-cave';

/**
 * Upper bound of the largest harmonic's amplitude / wavelength per scale. Enforced at registration so
 * the wrong spectrum for a scale fails loudly in tests instead of looking wrong in game.
 */
export const FLUID_SCALE_LIMITS: Readonly<Record<FluidScale, { maxAmplitudeM: number; maxWavelengthM: number }>> = {
  MICRO: { maxAmplitudeM: 0.01, maxWavelengthM: 0.5 },
  SMALL: { maxAmplitudeM: 0.05, maxWavelengthM: 4 },
  LOCAL: { maxAmplitudeM: 0.35, maxWavelengthM: 60 },
  REGIONAL: { maxAmplitudeM: 0.8, maxWavelengthM: 120 },
  PLANETARY: { maxAmplitudeM: 8, maxWavelengthM: 600 },
};

export interface FluidDefinition {
  readonly id: string;
  readonly solvent: LiquidSolventType;
  readonly geometryType: FluidGeometryType;
  readonly scale: FluidScale;
  /** Named profile, or a live provider when a legacy module owns a mutable spectrum (Manaus). */
  readonly profileId?: WaterWaveProfileId;
  readonly waves?: () => readonly GerstnerWaveHarmonic[];
  readonly bodyId?: string;
  /** Current still-water level in the fluid's own frame (metres). */
  readonly surfaceY: () => number;
  /** Distance to the nearest bank (m) used to damp waves near land. Omit for unbounded surfaces. */
  readonly shoreDistance?: (x: number, z: number) => number;
  /** Called on unregister so owners release GPU/geometry resources. */
  readonly onDispose?: () => void;
}

export interface FluidHandle {
  readonly id: string;
  readonly definition: FluidDefinition;
}

const SHORE_BAND_M = 140;

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
function smoothstep(a: number, b: number, v: number): number { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }

/** Shoreline wave damping shared by CPU and the shader (`smoothstep(0.008, 0.18, d / 140)`). */
export function shoreWaveDamping(shoreDistanceM?: number): number {
  if (shoreDistanceM === undefined) return 1;
  if (shoreDistanceM <= 0) return 0;
  return smoothstep(0.008, 0.18, clamp01(shoreDistanceM / SHORE_BAND_M));
}

/** Distance filter on harmonics i >= 2 shared by CPU and the shader (`1 - smoothstep(300, 6000, d)`). */
export function nearWaveDistanceFilter(cameraDistanceM = 0): number {
  if (!Number.isFinite(cameraDistanceM) || cameraDistanceM <= 0) return 1;
  return 1 - smoothstep(300, 6000, cameraDistanceM);
}

function resolveWaves(def: FluidDefinition): readonly GerstnerWaveHarmonic[] {
  if (def.waves) return def.waves();
  return WATER_WAVE_PROFILES[def.profileId ?? 'RIO_NEGRO_CALM'];
}

/** Throws when the definition is malformed or its spectrum is implausible for its scale. */
export function validateFluidDefinition(def: FluidDefinition): void {
  if (!def.id) throw new Error('Fluid id is required');
  if (!(def.solvent in FLUID_PRESETS)) throw new Error(`Fluid ${def.id}: unknown solvent ${def.solvent}`);
  if (!def.profileId && !def.waves) throw new Error(`Fluid ${def.id}: profileId or waves provider is required`);
  if (def.profileId && !(def.profileId in WATER_WAVE_PROFILES)) throw new Error(`Fluid ${def.id}: unknown wave profile ${def.profileId}`);
  const limits = FLUID_SCALE_LIMITS[def.scale];
  if (!limits) throw new Error(`Fluid ${def.id}: unknown scale ${def.scale}`);
  for (const w of resolveWaves(def)) {
    if (w.amplitude > limits.maxAmplitudeM) {
      throw new Error(`Fluid ${def.id}: wave amplitude ${w.amplitude} m exceeds ${def.scale} limit ${limits.maxAmplitudeM} m`);
    }
    if (w.wavelength > limits.maxWavelengthM) {
      throw new Error(`Fluid ${def.id}: wavelength ${w.wavelength} m exceeds ${def.scale} limit ${limits.maxWavelengthM} m`);
    }
  }
}

const fluids = new Map<string, FluidDefinition>();
const scratch: LiquidSampleResult = { height: 0, displacementX: 0, displacementZ: 0, normal: new Vector3(0, 1, 0) };

export function registerFluid(def: FluidDefinition): FluidHandle {
  if (fluids.has(def.id)) throw new Error(`Fluid ${def.id} is already registered`);
  validateFluidDefinition(def);
  fluids.set(def.id, def);
  return { id: def.id, definition: def };
}

export function unregisterFluid(id: string): boolean {
  const def = fluids.get(id);
  if (!def) return false;
  fluids.delete(id);
  def.onDispose?.();
  return true;
}

export function getFluid(id: string): FluidDefinition | undefined { return fluids.get(id); }
export function listFluids(): readonly FluidDefinition[] { return [...fluids.values()]; }
export function clearFluidRegistry(): void { for (const id of [...fluids.keys()]) unregisterFluid(id); }

/**
 * The surface of a registered fluid at (x, z, t): the same value buoyancy, swimming and the shader
 * evaluate. Non-finite input yields the still-water level rather than NaN.
 */
export function sampleFluid(
  id: string, x: number, z: number, timeSec: number, out?: LiquidSampleResult, cameraDistanceM = 0,
): LiquidSampleResult {
  const def = fluids.get(id);
  if (!def) throw new Error(`Fluid ${id} is not registered`);
  const result = out ?? { height: 0, displacementX: 0, displacementZ: 0, normal: new Vector3(0, 1, 0) };
  const base = def.surfaceY();
  if (!Number.isFinite(x + z + timeSec)) {
    result.height = base; result.displacementX = 0; result.displacementZ = 0; result.normal.set(0, 1, 0);
    return result;
  }
  const shore = def.shoreDistance ? Math.max(0, def.shoreDistance(x, z)) : undefined;
  return sampleGerstnerSpectrum(
    resolveWaves(def), x, z, timeSec, base, result, shoreWaveDamping(shore), nearWaveDistanceFilter(cameraDistanceM),
  );
}

export function fluidSurfaceHeight(id: string, x: number, z: number, timeSec: number): number {
  return sampleFluid(id, x, z, timeSec, scratch).height;
}

