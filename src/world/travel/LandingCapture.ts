import { FLIGHT } from '../../player/flightConfig';
import type { Vec3 } from '../spatial/units';
export { surfaceOutwardNormal } from '../planet/PlanetSurfaceMath';

/** Established character tiers, certified by the CCD regression matrix, not cosmic gear. */
export const LANDING_SPEED_LIMITS = {
  approachCaptureSpeedMps: FLIGHT.speeds.super,
  localHandoffSpeedMps: FLIGHT.speeds.normal,
  maxLocalTerrainSweepMps: FLIGHT.speeds.mega,
} as const;

export function relativeSurfaceMotion(velocityMps: Vec3, bodyVelocityMps: Vec3, outwardNormal: Vec3) {
  const x = velocityMps[0] - bodyVelocityMps[0], y = velocityMps[1] - bodyVelocityMps[1],
    z = velocityMps[2] - bodyVelocityMps[2];
  const radialSpeedMps = x * outwardNormal[0] + y * outwardNormal[1] + z * outwardNormal[2];
  return { relativeSpeedMps: Math.hypot(x, y, z), radialSpeedMps,
    tangentialSpeedMps: Math.hypot(x - radialSpeedMps * outwardNormal[0],
      y - radialSpeedMps * outwardNormal[1], z - radialSpeedMps * outwardNormal[2]) };
}

export interface LandingCaptureContext {
  bodyId?: string;
  isAssistedTarget?: boolean;
  clearanceM: number;
  relativeSpeedMps: number;
  radialSpeedMps: number;
  tangentialSpeedMps?: number;
  surfaceReady: boolean;
}

export function landingCaptureGate(context: LandingCaptureContext, limits: {
  returnAltitudeM: number; localHandoffSpeedMps: number; maxLocalTerrainSweepMps: number;
}): 'surface-stream' | 'altitude' | 'speed' | 'inward-speed' | 'ready' {
  if (!context.surfaceReady) return 'surface-stream';
  if (!Number.isFinite(context.clearanceM) || context.clearanceM > limits.returnAltitudeM) return 'altitude';
  if (!Number.isFinite(context.relativeSpeedMps) || context.relativeSpeedMps > limits.maxLocalTerrainSweepMps) return 'speed';
  if (!Number.isFinite(context.radialSpeedMps) || -context.radialSpeedMps > limits.localHandoffSpeedMps) return 'inward-speed';
  return 'ready';
}
