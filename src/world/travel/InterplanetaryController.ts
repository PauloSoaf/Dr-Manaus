import { Vector3 } from 'three/webgpu';
import { type InterplanetaryState, type TravelContext } from './TravelDomain';
import {
  type GravitySource,
  netGravityAcceleration,
  dominantGravitySource,
  isZeroG,
  GAMEPLAY_ZERO_G_ACCEL_THRESHOLD,
} from '../celestial/GravitySource';
import type { Vec3 } from '../spatial/units';

function finite(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export interface InterplanetaryControllerOptions {
  thrustAcceleration?: number;
  maxRelativeSpeedMps?: number;
  envelopeMarginM?: number;
  zeroGThresholdMps2?: number;
}

/**
 * Controller responsible for interplanetary flight dynamics:
 * - 64-bit system coordinates and velocity
 * - Directional thrust
 * - Inertial drift (zero-g: velocity continues without artificial drag or global -Y downward gravity)
 * - Celestial gravitational acceleration (point-mass Newton / N-body dominant)
 * - Active braking (action-driven, not implicit drag)
 * - Exclusion envelope collision
 * - Domain handoff
 *
 * Implements specs/dr-manaus-cosmic-night-specs/06-ZERO-G-AND-GRAVITY-DOMAINS.md.
 */
export class InterplanetaryController {
  private readonly thrustAcceleration: number;
  private readonly maxRelativeSpeedMps: number;
  private readonly envelopeMarginM: number;
  private readonly zeroGThresholdMps2: number;

  constructor(options: InterplanetaryControllerOptions = {}) {
    this.thrustAcceleration = finite(options.thrustAcceleration, 50_000);
    this.maxRelativeSpeedMps = finite(options.maxRelativeSpeedMps, 222_222);
    this.envelopeMarginM = finite(options.envelopeMarginM, 1_000);
    this.zeroGThresholdMps2 = finite(options.zeroGThresholdMps2, GAMEPLAY_ZERO_G_ACCEL_THRESHOLD);
  }

  /**
   * Evaluates the net gravitational acceleration at a given position.
   */
  gravityAt(positionM: Vec3, context: TravelContext): Vec3 {
    if (context.netGravityMps2) {
      return [
        finite(context.netGravityMps2[0]),
        finite(context.netGravityMps2[1]),
        finite(context.netGravityMps2[2]),
      ];
    }
    if (context.gravitySources && context.gravitySources.length > 0) {
      return netGravityAcceleration(context.gravitySources, positionM);
    }
    return [0, 0, 0];
  }

  /**
   * Determines if the position is in the zero-g realm (net gravity < threshold).
   */
  isZeroG(positionM: Vec3, context: TravelContext, threshold?: number): boolean {
    const grav = this.gravityAt(positionM, context);
    const mag = Math.hypot(grav[0], grav[1], grav[2]);
    return mag < (threshold ?? this.zeroGThresholdMps2);
  }

  /**
   * Returns the dominant celestial gravity source at the position, if any.
   */
  dominantGravity(positionM: Vec3, context: TravelContext): { source: GravitySource; accelMagnitude: number } | undefined {
    if (!context.gravitySources || context.gravitySources.length === 0) return undefined;
    return dominantGravitySource(context.gravitySources, positionM);
  }

  update(
    state: InterplanetaryState,
    dtS: number,
    thrustDirection: Vector3,
    brake: boolean,
    context: TravelContext
  ): InterplanetaryState {
    const dt = Math.max(0, Math.min(0.25, finite(dtS)));
    const positionM: [number, number, number] = [
      finite(state.positionM[0]),
      finite(state.positionM[1]),
      finite(state.positionM[2]),
    ];
    const velocityMps: [number, number, number] = [
      finite(state.velocityMps[0]),
      finite(state.velocityMps[1]),
      finite(state.velocityMps[2]),
    ];

    const bodyVel: [number, number, number] = context.bodyVelocityMps
      ? [finite(context.bodyVelocityMps[0]), finite(context.bodyVelocityMps[1]), finite(context.bodyVelocityMps[2])]
      : [0, 0, 0];

    // Relative velocity to reference / dominant body
    const relVel: [number, number, number] = [
      velocityMps[0] - bodyVel[0],
      velocityMps[1] - bodyVel[1],
      velocityMps[2] - bodyVel[2],
    ];

    // 1. Gravitational acceleration from celestial bodies
    const gravity = this.gravityAt(positionM, context);
    relVel[0] += gravity[0] * dt;
    relVel[1] += gravity[1] * dt;
    relVel[2] += gravity[2] * dt;

    // 2. Thrust applied to relative velocity
    const thrustLenSq = finite(thrustDirection.lengthSq());
    if (thrustLenSq > 0.01) {
      relVel[0] += finite(thrustDirection.x) * this.thrustAcceleration * dt;
      relVel[1] += finite(thrustDirection.y) * this.thrustAcceleration * dt;
      relVel[2] += finite(thrustDirection.z) * this.thrustAcceleration * dt;
    }

    // 3. Active braking relative to body (action/power driven, never implicit drag)
    if (brake) {
      const relSpeed = Math.hypot(relVel[0], relVel[1], relVel[2]);
      if (relSpeed > 0) {
        const drop = Math.max(relSpeed * 2.5 * dt, 40_000 * dt);
        const factor = Math.max(0, relSpeed - drop) / relSpeed;
        relVel[0] *= factor;
        relVel[1] *= factor;
        relVel[2] *= factor;
      }
    }

    // 4. Speed limit clamp
    const maxSpeed = context.maxRelativeSpeedMps ?? this.maxRelativeSpeedMps;
    const currentRelSpeed = Math.hypot(relVel[0], relVel[1], relVel[2]);
    if (currentRelSpeed > maxSpeed && currentRelSpeed > 0) {
      const scale = maxSpeed / currentRelSpeed;
      relVel[0] *= scale;
      relVel[1] *= scale;
      relVel[2] *= scale;
    }

    // 5. Reconstruct system player velocity
    velocityMps[0] = bodyVel[0] + relVel[0];
    velocityMps[1] = bodyVel[1] + relVel[1];
    velocityMps[2] = bodyVel[2] + relVel[2];

    // 6. Inertial drift (system coordinates)
    positionM[0] += velocityMps[0] * dt;
    positionM[1] += velocityMps[1] * dt;
    positionM[2] += velocityMps[2] * dt;

    // 7. Envelope collision against reference body
    const margin = context.envelopeMarginM ?? this.envelopeMarginM;
    const floor = (Number.isFinite(context.bodyRadiusM) ? context.bodyRadiusM : 0) + margin;
    const bx = context.bodyPositionM ? context.bodyPositionM[0] : 0;
    const by = context.bodyPositionM ? context.bodyPositionM[1] : 0;
    const bz = context.bodyPositionM ? context.bodyPositionM[2] : 0;
    const dx = positionM[0] - bx;
    const dy = positionM[1] - by;
    const dz = positionM[2] - bz;
    const radius = Math.hypot(dx, dy, dz);

    if (floor > 0 && radius > 0 && radius < floor) {
      const scale = floor / radius;
      positionM[0] = bx + dx * scale;
      positionM[1] = by + dy * scale;
      positionM[2] = bz + dz * scale;
      const nx = dx / radius, ny = dy / radius, nz = dz / radius;
      const intoRel = relVel[0] * nx + relVel[1] * ny + relVel[2] * nz;
      if (intoRel < 0) {
        relVel[0] -= intoRel * nx;
        relVel[1] -= intoRel * ny;
        relVel[2] -= intoRel * nz;
        velocityMps[0] = bodyVel[0] + relVel[0];
        velocityMps[1] = bodyVel[1] + relVel[1];
        velocityMps[2] = bodyVel[2] + relVel[2];
      }
    }

    return {
      systemId: state.systemId,
      positionM,
      velocityMps,
      referenceBodyId: state.referenceBodyId,
    };
  }
}
