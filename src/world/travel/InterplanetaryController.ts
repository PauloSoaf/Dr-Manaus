import { Vector3 } from 'three/webgpu';
import { type InterplanetaryState, type TravelContext } from './TravelDomain';

function finite(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export interface InterplanetaryControllerOptions {
  thrustAcceleration?: number;
  maxRelativeSpeedMps?: number;
  envelopeMarginM?: number;
}

export class InterplanetaryController {
  private readonly thrustAcceleration: number;
  private readonly maxRelativeSpeedMps: number;
  private readonly envelopeMarginM: number;

  constructor(options: InterplanetaryControllerOptions = {}) {
    this.thrustAcceleration = finite(options.thrustAcceleration, 50_000);
    this.maxRelativeSpeedMps = finite(options.maxRelativeSpeedMps, 222_222);
    this.envelopeMarginM = finite(options.envelopeMarginM, 1_000);
  }

  update(
    state: InterplanetaryState,
    dtS: number,
    thrustDirection: Vector3,
    brake: boolean,
    context: TravelContext
  ): InterplanetaryState {
    const dt = Math.max(0, Math.min(0.25, finite(dtS)));
    const positionM: [number, number, number] = [finite(state.positionM[0]), finite(state.positionM[1]), finite(state.positionM[2])];
    const velocityMps: [number, number, number] = [finite(state.velocityMps[0]), finite(state.velocityMps[1]), finite(state.velocityMps[2])];

    const bodyVel: [number, number, number] = context.bodyVelocityMps
      ? [finite(context.bodyVelocityMps[0]), finite(context.bodyVelocityMps[1]), finite(context.bodyVelocityMps[2])]
      : [0, 0, 0];

    // Relative velocity to dominant body
    const relVel: [number, number, number] = [
      velocityMps[0] - bodyVel[0],
      velocityMps[1] - bodyVel[1],
      velocityMps[2] - bodyVel[2],
    ];

    // Thrust applied to relative velocity
    const thrustLenSq = finite(thrustDirection.lengthSq());
    if (thrustLenSq > 0.01) {
      relVel[0] += finite(thrustDirection.x) * this.thrustAcceleration * dt;
      relVel[1] += finite(thrustDirection.y) * this.thrustAcceleration * dt;
      relVel[2] += finite(thrustDirection.z) * this.thrustAcceleration * dt;
    }

    // Braking relative to body
    if (brake) {
      const relSpeed = Math.hypot(relVel[0], relVel[1], relVel[2]);
      if (relSpeed > 0) {
        const drop = relSpeed * 0.5 * dt; // simple exponential braking
        const factor = Math.max(0, relSpeed - drop) / relSpeed;
        relVel[0] *= factor;
        relVel[1] *= factor;
        relVel[2] *= factor;
      }
    }

    // Clamp relative speed to maxRelativeSpeedMps
    const maxSpeed = context.maxRelativeSpeedMps ?? this.maxRelativeSpeedMps;
    const currentRelSpeed = Math.hypot(relVel[0], relVel[1], relVel[2]);
    if (currentRelSpeed > maxSpeed && currentRelSpeed > 0) {
      const scale = maxSpeed / currentRelSpeed;
      relVel[0] *= scale;
      relVel[1] *= scale;
      relVel[2] *= scale;
    }

    // Reconstruct player velocity
    velocityMps[0] = bodyVel[0] + relVel[0];
    velocityMps[1] = bodyVel[1] + relVel[1];
    velocityMps[2] = bodyVel[2] + relVel[2];

    // Inertial drift
    positionM[0] += velocityMps[0] * dt;
    positionM[1] += velocityMps[1] * dt;
    positionM[2] += velocityMps[2] * dt;

    // Envelope collision
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
      referenceBodyId: state.referenceBodyId
    };
  }
}
