import { Vector3, Quaternion, Object3D } from 'three';

export interface GerstnerWaveDefinition {
  direction: [number, number];
  amplitude: number;
  wavelength: number;
  speed: number;
  steepness: number;
}

/**
 * Harmonic Gerstner wave profile designed for authentic Amazonian river hydrology:
 * - Rio Negro: Calm, glassy, viscous surface tension with gentle downstream drift ripples.
 * - Rio Solimões: Smooth laminar flow with subtle capillary wind ripples (total peak-to-peak < 9cm).
 */
export const MANAUS_RIVER_WAVES: GerstnerWaveDefinition[] = [
  // Primary gentle river drift current aligned downstream toward Encontro das Águas
  { direction: [0.82, 0.57], amplitude: 0.035, wavelength: 28.0, speed: 0.65, steepness: 0.05 },
  // Secondary gentle transverse river fairway ripple
  { direction: [0.60, 0.80], amplitude: 0.022, wavelength: 14.0, speed: 0.85, steepness: 0.04 },
  // Subtle capillary river breeze ripple
  { direction: [0.95, 0.31], amplitude: 0.014, wavelength: 6.5, speed: 1.10, steepness: 0.03 },
  // Fine surface tension capillary ripple
  { direction: [0.45, 0.89], amplitude: 0.007, wavelength: 2.8, speed: 1.40, steepness: 0.02 }
];

export interface WaterSurfaceSample {
  height: number;
  displacementX: number;
  displacementZ: number;
  normal: Vector3;
}

/**
 * Reusable scratch variables to guarantee ZERO allocation inside the animation loop.
 */
const _scratchPos = new Vector3();
const _scratchNormal = new Vector3();
const _scratchTargetQ = new Quaternion();
const _up = new Vector3(0, 1, 0);

/**
 * Analytical computation of Gerstner displacement and normal vector.
 * Runs identically on CPU and matches the TSL GPU vertex displacement.
 */
export function sampleManausWater(
  x: number,
  z: number,
  timeSec: number,
  baseSurfaceY: number = 0.06,
  out?: WaterSurfaceSample
): WaterSurfaceSample {
  const result = out || {
    height: baseSurfaceY,
    displacementX: 0,
    displacementZ: 0,
    normal: new Vector3(0, 1, 0)
  };

  let dx = 0;
  let dy = 0;
  let dz = 0;

  // Tangent and Binormal derivatives to compute true surface normal
  let waSumX = 0;
  let waSumZ = 0;

  const count = MANAUS_RIVER_WAVES.length;
  for (let i = 0; i < count; i++) {
    const w = MANAUS_RIVER_WAVES[i];
    const k = (2.0 * Math.PI) / w.wavelength;
    const c = Math.sqrt(9.80665 / k);
    const len = Math.hypot(w.direction[0], w.direction[1]) || 1.0;
    const dirX = w.direction[0] / len;
    const dirZ = w.direction[1] / len;
    const dot = dirX * x + dirZ * z;
    const theta = k * dot - w.speed * c * timeSec;

    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const q = w.steepness / (k * w.amplitude * count);

    dx += q * w.amplitude * dirX * cosTheta;
    dy += w.amplitude * sinTheta;
    dz += q * w.amplitude * dirZ * cosTheta;

    // Normal derivatives: N = (-dD/dx, 1, -dD/dz)
    const wa = k * w.amplitude;
    waSumX += dirX * wa * cosTheta;
    waSumZ += dirZ * wa * cosTheta;
  }

  result.displacementX = dx;
  result.displacementZ = dz;
  result.height = baseSurfaceY + dy;

  // Normal vector: (-waSumX, 1, -waSumZ) normalized
  result.normal.set(-waSumX, 1.0, -waSumZ).normalize();

  return result;
}

export interface BuoyantBody {
  object: Object3D;
  hullOffsets: Vector3[];
  verticalOffset: number;
  damping: number;
  alignment: number;
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

  public register(
    object: Object3D,
    options: {
      hullOffsets?: Vector3[];
      verticalOffset?: number;
      damping?: number;
      alignment?: number;
    } = {}
  ): void {
    const offsets = options.hullOffsets || [
      new Vector3(-2, 0, -3),
      new Vector3(2, 0, -3),
      new Vector3(-2, 0, 3),
      new Vector3(2, 0, 3)
    ];

    this.bodies.push({
      object,
      hullOffsets: offsets,
      verticalOffset: options.verticalOffset ?? 0,
      damping: options.damping ?? 5.0,
      alignment: options.alignment ?? 0.85
    });
  }

  public unregister(object: Object3D): void {
    const idx = this.bodies.findIndex(b => b.object === object);
    if (idx !== -1) {
      this.bodies.splice(idx, 1);
    }
  }

  public update(dt: number, timeSec: number, baseSurfaceY: number = 0.06): void {
    const bodyCount = this.bodies.length;
    if (bodyCount === 0) return;

    for (let b = 0; b < bodyCount; b++) {
      const item = this.bodies[b];
      const obj = item.object;
      const count = item.hullOffsets.length;

      let avgHeight = 0;
      _scratchNormal.set(0, 0, 0);

      for (let p = 0; p < count; p++) {
        _scratchPos.copy(item.hullOffsets[p]).applyQuaternion(obj.quaternion).add(obj.position);
        sampleManausWater(_scratchPos.x, _scratchPos.z, timeSec, baseSurfaceY, this.tempSample);
        avgHeight += this.tempSample.height;
        _scratchNormal.add(this.tempSample.normal);
      }

      avgHeight /= count;
      _scratchNormal.divideScalar(count).normalize();

      // Smooth vertical lerp (critically damped)
      const targetY = avgHeight + item.verticalOffset;
      const lerpFactor = Math.min(1.0, dt * item.damping);
      obj.position.y += (targetY - obj.position.y) * lerpFactor;

      // Smooth rotational alignment with water surface normal
      if (item.alignment > 0) {
        _scratchTargetQ.setFromUnitVectors(_up, _scratchNormal);
        obj.quaternion.slerp(_scratchTargetQ, lerpFactor * item.alignment);
      }
    }
  }
}

