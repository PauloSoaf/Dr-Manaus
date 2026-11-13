import { finite, type Vec3 } from '../spatial/units';
import { GRAVITATIONAL_CONSTANT_SI, SOLAR_SYSTEM_BODIES, type CelestialBody } from './CelestialBody';

/**
 * Standard threshold below which gravitational acceleration is considered zero-g
 * in gameplay (no perceptible drift or gravitational force on the player).
 */
export const GAMEPLAY_ZERO_G_ACCEL_THRESHOLD = 1e-4; // m/s^2

/**
 * Gravity source representing a massive celestial body.
 * Defined in specs/dr-manaus-cosmic-night-specs/06-ZERO-G-AND-GRAVITY-DOMAINS.md.
 */
export interface GravitySource {
  readonly id: string;
  readonly frameId: string;
  readonly mu: number; // Standard gravitational parameter GM (m^3 / s^2)
  readonly collisionRadiusM: number;
  readonly influenceRadiusM: number;

  accelerationAt(positionM: Vec3): Vec3;
}

export interface PointMassGravitySourceConfig {
  id: string;
  frameId: string;
  mu: number;
  collisionRadiusM: number;
  influenceRadiusM: number;
  positionM?: Vec3 | (() => Vec3);
}

/**
 * Creates a point-mass Newtonian gravity source:
 * a = -mu * r / |r|^3
 */
export function createPointMassGravitySource(config: PointMassGravitySourceConfig): GravitySource {
  const { id, frameId, mu, collisionRadiusM, influenceRadiusM } = config;

  return {
    id,
    frameId,
    mu,
    collisionRadiusM,
    influenceRadiusM,
    accelerationAt(positionM: Vec3): Vec3 {
      const bodyPos = typeof config.positionM === 'function'
        ? config.positionM()
        : (config.positionM ?? [0, 0, 0]);

      const rx = finite(positionM[0]) - finite(bodyPos[0]);
      const ry = finite(positionM[1]) - finite(bodyPos[1]);
      const rz = finite(positionM[2]) - finite(bodyPos[2]);

      const distSq = rx * rx + ry * ry + rz * rz;
      const dist = Math.sqrt(distSq);

      // Outside sphere of influence or degenerate center
      if (dist > influenceRadiusM || dist <= 0 || !Number.isFinite(dist)) {
        return [0, 0, 0];
      }

      // Soften / clamp inside collision radius to prevent numerical divergence
      const effDist = Math.max(dist, Math.max(1, collisionRadiusM));
      const accelMag = mu / (effDist * effDist);

      const invDist = 1 / dist;
      return [
        -accelMag * (rx * invDist),
        -accelMag * (ry * invDist),
        -accelMag * (rz * invDist),
      ];
    },
  };
}

/**
 * Creates a GravitySource directly from a catalog CelestialBody and its current system position.
 */
export function gravitySourceFromBody(
  body: CelestialBody,
  bodyPositionM: Vec3 = [0, 0, 0],
  influenceRadiusOverrideM?: number
): GravitySource {
  const massKg = body.massKg ?? 0;
  const mu = GRAVITATIONAL_CONSTANT_SI * massKg;
  const collisionRadiusM = body.equatorialRadiusM;

  // Sphere of influence estimation (approximate Laplace/Hill radius fallback)
  // For the Sun: practically infinite in the solar system. For planets: ~ 10-100x radius.
  let influenceRadiusM = influenceRadiusOverrideM;
  if (influenceRadiusM === undefined) {
    if (body.id === 'sun') {
      influenceRadiusM = 1e13; // 10,000 AU
    } else if (body.id === 'earth') {
      influenceRadiusM = 1.5e9; // ~1.5 million km
    } else if (body.id === 'moon') {
      influenceRadiusM = 6.6e7; // ~66,000 km
    } else if (body.id === 'jupiter') {
      influenceRadiusM = 5.0e10;
    } else {
      influenceRadiusM = Math.max(collisionRadiusM * 50, 1e8);
    }
  }

  return createPointMassGravitySource({
    id: body.id,
    frameId: body.frameId,
    mu,
    collisionRadiusM,
    influenceRadiusM,
    positionM: bodyPositionM,
  });
}

/**
 * Calculates net acceleration vector from multiple gravity sources.
 */
export function netGravityAcceleration(
  sources: readonly GravitySource[],
  positionM: Vec3
): Vec3 {
  let ax = 0;
  let ay = 0;
  let az = 0;

  for (let i = 0; i < sources.length; i++) {
    const a = sources[i].accelerationAt(positionM);
    ax += a[0];
    ay += a[1];
    az += a[2];
  }

  return [ax, ay, az];
}

/**
 * Identifies the dominant gravity source at a given position.
 */
export function dominantGravitySource(
  sources: readonly GravitySource[],
  positionM: Vec3
): { source: GravitySource; accelMagnitude: number } | undefined {
  let bestSource: GravitySource | undefined;
  let maxAccel = 0;

  for (let i = 0; i < sources.length; i++) {
    const a = sources[i].accelerationAt(positionM);
    const mag = Math.hypot(a[0], a[1], a[2]);
    if (mag > maxAccel) {
      maxAccel = mag;
      bestSource = sources[i];
    }
  }

  return bestSource ? { source: bestSource, accelMagnitude: maxAccel } : undefined;
}

/**
 * Checks whether a position is within the zero-g threshold for the given gravity sources.
 */
export function isZeroG(
  sources: readonly GravitySource[],
  positionM: Vec3,
  threshold: number = GAMEPLAY_ZERO_G_ACCEL_THRESHOLD
): boolean {
  const netAccel = netGravityAcceleration(sources, positionM);
  const mag = Math.hypot(netAccel[0], netAccel[1], netAccel[2]);
  return mag < threshold;
}
