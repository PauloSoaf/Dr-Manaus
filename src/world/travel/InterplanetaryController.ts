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
    const radius = Math.hypot(positionM[0], positionM[1], positionM[2]);
    if (floor > 0 && radius > 0 && radius < floor) {
      const scale = floor / radius;
      positionM[0] *= scale; positionM[1] *= scale; positionM[2] *= scale;
      const nx = positionM[0] / floor, ny = positionM[1] / floor, nz = positionM[2] / floor;
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
