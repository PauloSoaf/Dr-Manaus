import { Vector3, Quaternion, Object3D, Box3 } from 'three';
import {
  WATER_WAVE_PROFILES,
  sampleGerstnerSpectrum,
  type GerstnerWaveHarmonic,
  type WaterWaveProfileId,
} from './UniversalLiquidSystem';

import { shoreWaveDamping, nearWaveDistanceFilter } from './FluidRegistry';

export type GerstnerWaveDefinition = GerstnerWaveHarmonic;
export { WATER_WAVE_PROFILES, type WaterWaveProfileId };

export const MANAUS_SHORE_BAND_M = 140;

let activeWaveProfileId: WaterWaveProfileId = 'RIO_NEGRO_CALM';

/**
 * Harmonic Gerstner wave profile shared across UniversalLiquidSystem, ManausHydrology,
 * WaterSystem TSL shaders, and WaterBuoyancyService.
 */
export const MANAUS_RIVER_WAVES: GerstnerWaveDefinition[] = [
  ...WATER_WAVE_PROFILES.RIO_NEGRO_CALM.map(w => ({ ...w, direction: [w.direction[0], w.direction[1]] as [number, number] })),
];

export function getActiveManausWaveProfile(): WaterWaveProfileId {
  return activeWaveProfileId;
}

export function setActiveManausWaveProfile(profileId: WaterWaveProfileId): readonly GerstnerWaveDefinition[] {
  const waves = WATER_WAVE_PROFILES[profileId] ?? WATER_WAVE_PROFILES.RIO_NEGRO_CALM;
  activeWaveProfileId = WATER_WAVE_PROFILES[profileId] ? profileId : 'RIO_NEGRO_CALM';
  MANAUS_RIVER_WAVES.length = 0;
  for (const w of waves) {
    MANAUS_RIVER_WAVES.push({
      direction: [w.direction[0], w.direction[1]],
      amplitude: w.amplitude,
      wavelength: w.wavelength,
      speed: w.speed,
      steepness: w.steepness,
    });
  }
  return MANAUS_RIVER_WAVES;
}

export interface WaterSurfaceSample {
  height: number;
  displacementX: number;
  displacementZ: number;
  normal: Vector3;
}

export { shoreWaveDamping, nearWaveDistanceFilter };

/**
 * Reusable scratch variables to guarantee ZERO allocation inside the animation loop.
 */
const _scratchPos = new Vector3();
const _scratchNormal = new Vector3();
const _scratchTargetQ = new Quaternion();
const _up = new Vector3(0, 1, 0);

/**
 * Analytical computation of Gerstner displacement and normal vector.
 * Uses the exact same harmonic spectrum, normalized wave vectors, dispersion relation,
 * shoreline damping, and distance filter as the GPU TSL shader in `WaterSystem.ts`.
 */
export function sampleManausWater(
  x: number,
  z: number,
  timeSec: number,
  baseSurfaceY: number = 0.06,
  out?: WaterSurfaceSample,
  shoreDistanceM?: number,
  cameraDistanceM: number = 0,
  profileOverride?: WaterWaveProfileId,
): WaterSurfaceSample {
  const result = out || { height: baseSurfaceY, displacementX: 0, displacementZ: 0, normal: new Vector3(0, 1, 0) };
  const waves = profileOverride ? (WATER_WAVE_PROFILES[profileOverride] ?? MANAUS_RIVER_WAVES) : MANAUS_RIVER_WAVES;
  return sampleGerstnerSpectrum(
    waves, x, z, timeSec, baseSurfaceY, result,
    shoreWaveDamping(shoreDistanceM), nearWaveDistanceFilter(cameraDistanceM),
  );
}
export interface BuoyantBody {
  object: Object3D;
  hullOffsets: Vector3[];
  verticalOffset: number;
  damping: number;
  alignment: number;
  surge?: boolean;
}

/**
 * Hydrodynamic floater service (adapted from references/threejs-water-free/src/physics/buoyancy.js).
 * Operates in O(1) allocation using 4-point hull sampling.
 */
export class WaterBuoyancyService {
  private readonly bodies: BuoyantBody[] = [];
  private readonly tempSample: WaterSurfaceSample = {
    height: 0,
    displacementX: 0,
    displacementZ: 0,
    normal: new Vector3(0, 1, 0)
  };

  /**
   * Registers a floating body with automatic Box3 hull point extraction if offsets are omitted.
   * Matches references/threejs-water-free/src/physics/buoyancy.js API.
   */
  public add(
    object: Object3D,
    options: {
      points?: Vector3[];
      hullOffsets?: Vector3[];
      offset?: number;
      verticalOffset?: number;
      damping?: number;
      alignment?: number;
      surge?: boolean;
    } = {}
  ): BuoyantBody {
    let offsets = options.points || options.hullOffsets;
    if (!offsets) {
      const box = new Box3().setFromObject(object);
      if (box.isEmpty()) {
        offsets = [
          new Vector3(-1.8, 0, -2.8),
          new Vector3(1.8, 0, -2.8),
          new Vector3(-1.8, 0, 2.8),
          new Vector3(1.8, 0, 2.8)
        ];
      } else {
        const min = box.min, max = box.max;
        const cy = 0;
        offsets = [
          new Vector3(min.x, cy, min.z),
          new Vector3(max.x, cy, min.z),
          new Vector3(min.x, cy, max.z),
          new Vector3(max.x, cy, max.z),
        ].map(pt => object.worldToLocal(pt.clone()));
      }
    }

    const body: BuoyantBody = {
      object,
      hullOffsets: offsets,
      verticalOffset: options.offset ?? options.verticalOffset ?? 0,
      damping: options.damping ?? 5.0,
      alignment: options.alignment ?? 0.85,
      surge: options.surge ?? false,
    };
    this.bodies.push(body);
    return body;
  }

  public register(
    object: Object3D,
    options: {
      hullOffsets?: Vector3[];
      verticalOffset?: number;
      damping?: number;
      alignment?: number;
      surge?: boolean;
    } = {}
  ): void {
    this.add(object, options);
  }

  public remove(object: Object3D): void {
    const idx = this.bodies.findIndex(b => b.object === object);
    if (idx !== -1) {
      this.bodies.splice(idx, 1);
    }
  }

  public unregister(object: Object3D): void {
    this.remove(object);
  }

  public update(dt: number, timeSec: number, baseSurfaceY: number = 0.06): void {
    const bodyCount = this.bodies.length;
    if (bodyCount === 0) return;

    for (let b = 0; b < bodyCount; b++) {
      const item = this.bodies[b];
      const obj = item.object;
      const count = item.hullOffsets.length;

      let avgHeight = 0;
      let avgDispX = 0;
      let avgDispZ = 0;
      _scratchNormal.set(0, 0, 0);

      for (let p = 0; p < count; p++) {
        _scratchPos.copy(item.hullOffsets[p]).applyQuaternion(obj.quaternion).add(obj.position);
        sampleManausWater(_scratchPos.x, _scratchPos.z, timeSec, baseSurfaceY, this.tempSample);
        avgHeight += this.tempSample.height;
        avgDispX += this.tempSample.displacementX;
        avgDispZ += this.tempSample.displacementZ;
        _scratchNormal.add(this.tempSample.normal);
      }

      avgHeight /= count;
      _scratchNormal.divideScalar(count).normalize();

      // Smooth vertical lerp (critically damped)
      const targetY = avgHeight + item.verticalOffset;
      const lerpFactor = Math.min(1.0, dt * item.damping);
      obj.position.y += (targetY - obj.position.y) * lerpFactor;

      // Hydrodynamic horizontal wave orbital surge
      if (item.surge) {
        avgDispX /= count;
        avgDispZ /= count;
        obj.position.x += avgDispX * lerpFactor * 0.15;
        obj.position.z += avgDispZ * lerpFactor * 0.15;
      }

      // Smooth rotational alignment with water surface normal
      if (item.alignment > 0) {
        _scratchTargetQ.setFromUnitVectors(_up, _scratchNormal);
        obj.quaternion.slerp(_scratchTargetQ, lerpFactor * item.alignment);
      }
    }
  }
}

