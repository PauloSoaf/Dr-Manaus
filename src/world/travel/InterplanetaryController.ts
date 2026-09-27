import { Vector3 } from 'three/webgpu';
import { type InterplanetaryState, type TravelTransition } from './TravelDomain';

export class InterplanetaryController {
  private readonly thrustAcceleration = 50000; // arbitrary strong thrust for space travel

  update(
    state: InterplanetaryState,
    dtS: number,
    thrustDirection: Vector3,
    brake: boolean
  ): InterplanetaryState {
    const positionM = [...state.positionM] as [number, number, number];
    const velocityMps = [...state.velocityMps] as [number, number, number];

    // Thrust
    if (thrustDirection.lengthSq() > 0.01) {
      velocityMps[0] += thrustDirection.x * this.thrustAcceleration * dtS;
      velocityMps[1] += thrustDirection.y * this.thrustAcceleration * dtS;
      velocityMps[2] += thrustDirection.z * this.thrustAcceleration * dtS;
    }

    // Braking
    if (brake) {
      const speed = Math.hypot(velocityMps[0], velocityMps[1], velocityMps[2]);
      if (speed > 0) {
        const drop = speed * 0.5 * dtS; // simple exponential braking
        const factor = Math.max(0, speed - drop) / speed;
        velocityMps[0] *= factor;
        velocityMps[1] *= factor;
        velocityMps[2] *= factor;
      }
    }

    // Inertial drift
    positionM[0] += velocityMps[0] * dtS;
    positionM[1] += velocityMps[1] * dtS;
    positionM[2] += velocityMps[2] * dtS;

    return {
      systemId: state.systemId,
      positionM,
      velocityMps,
      referenceBodyId: state.referenceBodyId
    };
  }
}
