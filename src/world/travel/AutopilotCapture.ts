import type { Vec3 } from '../spatial/units';
import type { CosmicCruiseContext, FlightTelemetry } from './CosmicFlight';
import { LANDING_SPEED_LIMITS } from './LandingCapture';
const STATIONARY: Vec3 = [0, 0, 0];

export function stoppingDistanceM(speedMps: number, accelerationMps2: number): number {
  return Number.isFinite(speedMps) && accelerationMps2 > 0 && Number.isFinite(accelerationMps2)
    ? speedMps * speedMps / (2 * accelerationMps2) : 0;
}

/** Controller state only; target identity and ephemeris belong to Game's navigation authority. */
export class AutopilotCapture {
  active = false;
  private captured = false;
  private capability = 0;
  phase: FlightTelemetry['phase'] = 'idle';
  stoppingDistanceM = 0;
  arrivalRadiusM = 0;
  effectiveSpeedCapMps = 0;

  engage(): void { this.active = true; this.captured = false; this.capability = 0; this.phase = 'align'; }
  cancel(): void { this.active = false; this.phase = 'idle'; }
  arrive(): void { this.active = false; this.phase = 'arrived'; }

  /** Bounded acceleration, braking before reorientation, no position writes or camera rotation. */
  update(position: Vec3, velocity: Vec3, dt: number, ctx: CosmicCruiseContext, gearCap: number): number {
    const target = ctx.target;
    if (!target) { this.cancel(); return 0; }
    const orbital = target.velocityMps ?? STATIONARY;
    const dx = target.positionM[0] - position[0], dy = target.positionM[1] - position[1],
      dz = target.positionM[2] - position[2];
    const distance = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(distance) || !orbital.every(Number.isFinite)) { this.cancel(); return 0; }
    const nx = dx / (distance || 1), ny = dy / (distance || 1), nz = dz / (distance || 1);
    const rx = velocity[0] - orbital[0], ry = velocity[1] - orbital[1], rz = velocity[2] - orbital[2];
    const speed = Math.hypot(rx, ry, rz);
    const captureRadius = target.radiusM + target.arrivalMarginM;
    if (distance <= captureRadius + 3 && speed <= 3) this.captured = true;
    const approach = this.captured && ctx.targetCanLand === true;
    // First capture at the shared arrival margin. Then descend slowly, waiting above the
    // TravelDomain return gate until its real terrain provider covers the landing site.
    const clearance = ctx.targetSurfaceClearanceM;
    const returnAltitude = ctx.returnAltitudeM ?? 7000;
    this.arrivalRadiusM = approach && Number.isFinite(clearance)
      ? distance - clearance! + (ctx.targetSurfaceReady ? returnAltitude * .8 : returnAltitude + 1000)
      : captureRadius;
    const gap = Math.max(0, distance - this.arrivalRadiusM);
    if (!this.capability) this.capability = Math.max(100_000, 4 * gap / 36);
    const a = this.capability;
    this.stoppingDistanceM = stoppingDistanceM(speed, a);
    // 65% braking reserve; gap/1.5 smooths the last metres without overshoot at 30–120Hz.
    this.effectiveSpeedCapMps = Math.min(gearCap || 500_000_000, Math.sqrt(2 * a * gap * .35),
      gap / 1.5, approach ? Math.max(LANDING_SPEED_LIMITS.localHandoffSpeedMps * .8,
        Math.min(LANDING_SPEED_LIMITS.approachCaptureSpeedMps, ((clearance ?? returnAltitude) - returnAltitude) * .5)) : Infinity);
    let commanded = this.effectiveSpeedCapMps;
    const alignment = speed > 1 ? (rx * nx + ry * ny + rz * nz) / speed : 1;
    // Turn only through <=1rad/s. Large deviations brake to rest before a new burn.
    if (speed > 1 && alignment < Math.cos(Math.min(.25, dt))) {
      this.phase = 'align';
      const factor = Math.max(0, speed - a * dt) / speed;
      velocity[0] = orbital[0] + rx * factor;
      velocity[1] = orbital[1] + ry * factor;
      velocity[2] = orbital[2] + rz * factor;
      return -a;
    }
    if (!approach && this.captured) { commanded = 0; this.phase = 'arrived'; }
    else if (approach) this.phase = 'approach';
    else if (speed > commanded + .1) this.phase = 'braking';
    else if (gap < target.arrivalMarginM) this.phase = 'capture';
    else this.phase = speed + .1 < commanded ? 'acceleration' : 'cruise';
    const cx = nx * commanded - rx, cy = ny * commanded - ry, cz = nz * commanded - rz;
    const change = Math.hypot(cx, cy, cz);
    const factor = change > 0 ? Math.min(1, a * dt / change) : 0;
    velocity[0] += cx * factor; velocity[1] += cy * factor; velocity[2] += cz * factor;
    return (commanded < speed ? -1 : 1) * Math.min(a, dt > 0 ? change / dt : 0);
  }
}
