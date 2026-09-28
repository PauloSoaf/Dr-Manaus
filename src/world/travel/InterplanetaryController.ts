import { Vector3 } from 'three/webgpu';
import { type InterplanetaryState, type TravelContext } from './TravelDomain';

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export class InterplanetaryController {
  private readonly thrustAcceleration = 50000; // arbitrary strong thrust for space travel

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

    // Thrust
    const thrustLenSq = finite(thrustDirection.lengthSq());
    if (thrustLenSq > 0.01) {
      velocityMps[0] += finite(thrustDirection.x) * this.thrustAcceleration * dt;
      velocityMps[1] += finite(thrustDirection.y) * this.thrustAcceleration * dt;
      velocityMps[2] += finite(thrustDirection.z) * this.thrustAcceleration * dt;
    }

    // Braking
    if (brake) {
      const speed = Math.hypot(velocityMps[0], velocityMps[1], velocityMps[2]);
      if (speed > 0) {
        const drop = speed * 0.5 * dt; // simple exponential braking
        const factor = Math.max(0, speed - drop) / speed;
        velocityMps[0] *= factor;
        velocityMps[1] *= factor;
        velocityMps[2] *= factor;
      }
    }

    // Inertial drift
    positionM[0] += velocityMps[0] * dt;
    positionM[1] += velocityMps[1] * dt;
    positionM[2] += velocityMps[2] * dt;

    // Envelope collision
    const floor = (Number.isFinite(context.bodyRadiusM) ? context.bodyRadiusM : 0) + 14000; // envelopeMarginM
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
      const into = velocityMps[0] * nx + velocityMps[1] * ny + velocityMps[2] * nz;
      if (into < 0) {
        velocityMps[0] -= into * nx;
        velocityMps[1] -= into * ny;
        velocityMps[2] -= into * nz;
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
