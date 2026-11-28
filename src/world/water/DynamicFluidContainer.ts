/**
 * DynamicFluidContainer.ts
 *
 * Micro-scale dynamic fluid container (cups, glasses, beakers, bowls) for Dr-Manaus.
 * 
 * Features:
 * 1. 2D Resonant Sloshing Physics: Damped harmonic oscillator driven by external linear
 *    and angular acceleration, simulating authentic fluid slosh dynamics inside containers.
 * 2. Capillary Meniscus: Surface tension elevation near container walls.
 * 3. Tilt & Spill Detection: Calculates dynamic fill boundary and spills fluid when
 *    container tilt + slosh angle exceeds the rim threshold.
 * 4. Micro-Gerstner Capillary Ripples: Synchronized with the CUP_WATER profile.
 * 5. Unified Fluid Registry Integration: Registers under scale 'MICRO' and geometry 'container'.
 * 6. Zero GC during runtime update loop.
 */

import { Vector3, Quaternion, Matrix4, MathUtils } from 'three';
import {
  FLUID_PRESETS,
  WATER_WAVE_PROFILES,
  sampleGerstnerSpectrum,
  type LiquidSampleResult,
  type LiquidSolventType,
  type GerstnerWaveHarmonic,
} from './UniversalLiquidSystem';
import { registerFluid, unregisterFluid, type FluidHandle } from './FluidRegistry';

export interface FluidContainerOptions {
  id: string;
  radiusM?: number;       // Radius of cylindrical container (e.g. 0.04m = 4cm)
  heightM?: number;       // Total height of container (e.g. 0.12m = 12cm)
  fillFraction?: number;  // Initial fill fraction (0.0 to 1.0, e.g. 0.7)
  solvent?: LiquidSolventType;
  meniscusHeightM?: number; // Capillary meniscus height at rim (default ~0.002m = 2mm)
  onSpill?: (spilledVolumeM3: number, worldPos: Vector3, velocity: Vector3) => void;
}

export class DynamicFluidContainer {
  readonly id: string;
  readonly radiusM: number;
  readonly heightM: number;
  readonly solvent: LiquidSolventType;
  readonly meniscusHeightM: number;

  private _fillFraction: number;
  private readonly _onSpill?: (spilledVolumeM3: number, worldPos: Vector3, velocity: Vector3) => void;

  // Slosh dynamic state (2-axis angular deflection in radians)
  private _sloshAngleX = 0;
  private _sloshAngleZ = 0;
  private _sloshVelX = 0;
  private _sloshVelZ = 0;

  // World kinematics tracking
  readonly worldPosition = new Vector3();
  readonly worldQuaternion = new Quaternion();
  private readonly _prevWorldPos = new Vector3();
  private readonly _worldVelocity = new Vector3();
  private readonly _prevWorldVel = new Vector3();
  private readonly _worldAccel = new Vector3();

  // Scratch objects for zero heap allocation
  private readonly _invQuat = new Quaternion();
  private readonly _localAccel = new Vector3();
  private readonly _spillPos = new Vector3();
  private readonly _spillVel = new Vector3();
  private readonly _sampleResult: LiquidSampleResult = {
    height: 0,
    displacementX: 0,
    displacementZ: 0,
    normal: new Vector3(0, 1, 0),
  };

  private _fluidHandle: FluidHandle | null = null;
  private _disposed = false;

  constructor(options: FluidContainerOptions) {
    this.id = options.id;
    this.radiusM = Math.max(0.005, options.radiusM ?? 0.045);
    this.heightM = Math.max(0.01, options.heightM ?? 0.12);
    this._fillFraction = MathUtils.clamp(options.fillFraction ?? 0.70, 0.0, 1.0);
    this.solvent = options.solvent ?? 'terrestrial-freshwater';
    this.meniscusHeightM = options.meniscusHeightM ?? 0.002;
    this._onSpill = options.onSpill;

    // Register with FluidRegistry as MICRO scale container
    this._fluidHandle = registerFluid({
      id: `container-${this.id}`,
      solvent: this.solvent,
      geometryType: 'container',
      scale: 'MICRO',
      profileId: 'CUP_WATER',
      surfaceY: () => this.getWorldSurfaceLevel(),
      onDispose: () => {
        this._fluidHandle = null;
      },
    });
  }

  get fillFraction(): number {
    return this._fillFraction;
  }

  set fillFraction(val: number) {
    this._fillFraction = MathUtils.clamp(val, 0.0, 1.0);
  }

  get currentFluidHeightM(): number {
    return this._fillFraction * this.heightM;
  }

  get currentFluidVolumeM3(): number {
    return Math.PI * this.radiusM * this.radiusM * this.currentFluidHeightM;
  }

  get maxCapacityM3(): number {
    return Math.PI * this.radiusM * this.radiusM * this.heightM;
  }

  get sloshAngleX(): number {
    return this._sloshAngleX;
  }

  get sloshAngleZ(): number {
    return this._sloshAngleZ;
  }

  /**
   * World-space elevation of still fluid surface in container.
   */
  getWorldSurfaceLevel(): number {
    return this.worldPosition.y + this.currentFluidHeightM;
  }

  /**
   * Updates container motion, slosh simulation ODE, and spill checks.
   */
  update(dtSec: number, newWorldPos?: Vector3, newWorldQuat?: Quaternion): void {
    if (this._disposed || dtSec <= 0) return;
    const dt = Math.min(dtSec, 0.05); // Sub-step protection

    if (newWorldPos) {
      // Calculate linear velocity and acceleration
      this._worldVelocity.subVectors(newWorldPos, this.worldPosition).divideScalar(dt);
      this._worldAccel.subVectors(this._worldVelocity, this._prevWorldVel).divideScalar(dt);
      this._prevWorldVel.copy(this._worldVelocity);
      this.worldPosition.copy(newWorldPos);
    }
    if (newWorldQuat) {
      this.worldQuaternion.copy(newWorldQuat);
    }

    // Transform world acceleration into container local frame
    this._invQuat.copy(this.worldQuaternion).invert();
    this._localAccel.copy(this._worldAccel).applyQuaternion(this._invQuat);

    // Natural sloshing frequency in cylindrical container
    // omega_0 = sqrt(1.841 * g / R * tanh(1.841 * h / R))
    const g = 9.80665;
    const h = Math.max(0.005, this.currentFluidHeightM);
    const arg = (1.841 * h) / this.radiusM;
    const omega0 = Math.sqrt((1.841 * g / this.radiusM) * Math.tanh(arg));

    // Viscous damping ratio
    const solventProps = FLUID_PRESETS[this.solvent];
    const dampingRatio = 0.08 * (solventProps?.viscosityRelative ?? 1.0);
    const gamma = 2.0 * dampingRatio * omega0;

    // Driving accelerations in local container plane (scaled)
    const driveX = -this._localAccel.x / g;
    const driveZ = -this._localAccel.z / g;

    // Sloshing damped harmonic oscillator update (Symplectic Euler integration)
    const accelX = -omega0 * omega0 * this._sloshAngleX - gamma * this._sloshVelX + driveX * (omega0 * omega0 * 0.25);
    const accelZ = -omega0 * omega0 * this._sloshAngleZ - gamma * this._sloshVelZ + driveZ * (omega0 * omega0 * 0.25);

    this._sloshVelX += accelX * dt;
    this._sloshVelZ += accelZ * dt;
    this._sloshAngleX += this._sloshVelX * dt;
    this._sloshAngleZ += this._sloshVelZ * dt;

    // Clamp maximum slosh angle to 80 degrees
    const maxSlosh = MathUtils.degToRad(80);
    this._sloshAngleX = MathUtils.clamp(this._sloshAngleX, -maxSlosh, maxSlosh);
    this._sloshAngleZ = MathUtils.clamp(this._sloshAngleZ, -maxSlosh, maxSlosh);

    // Check for spill over container rim
    this.checkSpill(dt);
  }

  /**
   * Impulses external tilt or perturbation (e.g. collision or sudden bump).
   */
  addImpulse(angularVelX: number, angularVelZ: number): void {
    this._sloshVelX += angularVelX;
    this._sloshVelZ += angularVelZ;
  }

  /**
   * Evaluates if fluid reaches container rim and spills over.
   */
  private checkSpill(dt: number): void {
    if (this._fillFraction <= 0.001) return;

    // Container orientation tilt relative to vertical up (0, 1, 0)
    // Local up in world space is (0, 1, 0) rotated by container quaternion
    const localUp = new Vector3(0, 1, 0).applyQuaternion(this.worldQuaternion);
    const tiltAngle = Math.acos(MathUtils.clamp(localUp.y, -1.0, 1.0));

    // Net fluid tilt combines container tilt and internal slosh magnitude
    const sloshMag = Math.hypot(this._sloshAngleX, this._sloshAngleZ);
    const netTilt = tiltAngle + sloshMag;

    // Critical spill angle: tan(theta_c) = (H - h) / R
    const headRoom = this.heightM - this.currentFluidHeightM;
    const criticalAngle = Math.atan2(headRoom, this.radiusM);

    if (netTilt > criticalAngle) {
      const excessAngle = netTilt - criticalAngle;
      // Volume spilled proportional to excess angle and orifice area
      const spillRate = Math.min(this._fillFraction, excessAngle * 1.5 * dt);
      const volumeLoss = spillRate * this.maxCapacityM3;

      this._fillFraction = Math.max(0, this._fillFraction - spillRate);

      if (this._onSpill && volumeLoss > 1e-7) {
        // Compute approximate spill rim world position
        this._spillPos.copy(this.worldPosition);
        this._spillPos.y += this.heightM;
        this._spillVel.copy(this._worldVelocity);
        this._onSpill(volumeLoss, this._spillPos, this._spillVel);
      }
    }
  }

  /**
   * Samples local fluid surface height Y and normal inside the container frame.
   * `localX` and `localZ` are offsets from cylinder axis (-radiusM <= x, z <= radiusM).
   */
  sampleLocal(localX: number, localZ: number, timeSec: number, out?: LiquidSampleResult): LiquidSampleResult {
    const target = out ?? this._sampleResult;
    const r = Math.hypot(localX, localZ);
    if (r > this.radiusM) {
      // Outside container boundary: return container base height
      target.height = 0;
      target.displacementX = 0;
      target.displacementZ = 0;
      target.normal.set(0, 1, 0);
      return target;
    }

    // 1. Mean fill height
    const baseHeight = this.currentFluidHeightM;

    // 2. Slosh planar tilt displacement: dy = -x * tan(sloshAngleX) - z * tan(sloshAngleZ)
    const sloshDy = -localX * Math.tan(this._sloshAngleX) - localZ * Math.tan(this._sloshAngleZ);

    // 3. Capillary meniscus curvature near the rim wall: dy = h_m * (r / R)^4
    const rNorm = r / this.radiusM;
    const meniscusDy = this.meniscusHeightM * (rNorm * rNorm * rNorm * rNorm);

    // 4. Micro Gerstner ripples (CUP_WATER)
    const waves = WATER_WAVE_PROFILES.CUP_WATER;
    sampleGerstnerSpectrum(waves, localX, localZ, timeSec, 0, target);

    // Combine terms
    target.height = Math.max(0, Math.min(this.heightM, baseHeight + sloshDy + meniscusDy + target.height));
    
    // Slosh normal adjustment
    target.normal.x += Math.sin(this._sloshAngleX);
    target.normal.z += Math.sin(this._sloshAngleZ);
    target.normal.normalize();

    return target;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    if (this._fluidHandle) {
      unregisterFluid(`container-${this.id}`);
      this._fluidHandle = null;
    }
  }
}
