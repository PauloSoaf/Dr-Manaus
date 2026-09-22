import { MathUtils, Vector3 } from 'three/webgpu';
import type { Collider, Target } from '../../core/types';
import { PhysicsWorld } from '../../physics/PhysicsWorld';

export interface SoftTargetCandidate {
  readonly id: string;
  readonly position: Vector3;
  readonly radius: number;
  readonly priority: number; // Higher is better (e.g. enemy: 100, anomaly: 80, vehicle: 40, building: 10)
}

export interface SoftTargetResult {
  readonly target: SoftTargetCandidate | null;
  readonly assistedDirection: Vector3;
  readonly assistAngleDeg: number;
  readonly score: number;
}

export class SoftTargeting {
  private static readonly MAX_ASSIST_ANGLE_RAD = MathUtils.degToRad(18); // Max 18 degrees assist
  private static readonly tempDir = new Vector3();
  private static readonly toTarget = new Vector3();

  /**
   * Find the best candidate within the forward assist cone and compute an assisted direction.
   */
  static findTarget(
    origin: Vector3,
    aimDirection: Vector3,
    candidates: readonly SoftTargetCandidate[],
    maxDistance: number,
    colliders?: readonly Collider[]
  ): SoftTargetResult {
    const forward = this.tempDir.copy(aimDirection).normalize();
    let bestTarget: SoftTargetCandidate | null = null;
    let bestScore = -Infinity;
    let bestAngleRad = 0;
    const bestDir = new Vector3().copy(forward);

    for (const candidate of candidates) {
      this.toTarget.subVectors(candidate.position, origin);
      const distance = this.toTarget.length();
      if (distance < 0.1 || distance > maxDistance) continue;

      this.toTarget.normalize();
      const dot = MathUtils.clamp(forward.dot(this.toTarget), -1, 1);
      const angleRad = Math.acos(dot);

      // Must be within assist cone
      if (angleRad > this.MAX_ASSIST_ANGLE_RAD) continue;

      // Visibility check if colliders provided
      if (colliders && colliders.length > 0) {
        const hit = PhysicsWorld.raycast(origin, this.toTarget, colliders, distance * 0.95, 0.2);
        if (hit && hit.distance < distance - candidate.radius - 0.2) {
          continue; // Obstructed by building/terrain
        }
      }

      // Scoring: center alignment (0 to 1), proximity (0 to 1), priority weight
      const angleFactor = Math.cos(angleRad); // 1.0 at center, ~0.95 at cone edge
      const distanceFactor = Math.max(0, 1 - distance / maxDistance);
      const score = (candidate.priority * 2.0) + (angleFactor * 40.0) + (distanceFactor * 20.0);

      if (score > bestScore) {
        bestScore = score;
        bestTarget = candidate;
        bestAngleRad = angleRad;
        bestDir.copy(this.toTarget);
      }
    }

    if (!bestTarget) {
      return {
        target: null,
        assistedDirection: forward.clone(),
        assistAngleDeg: 0,
        score: 0,
      };
    }

    // Blend gently toward target, clamped to MAX_ASSIST_ANGLE_RAD
    const assisted = new Vector3().copy(forward);
    if (bestAngleRad > 1e-4) {
      const blendFactor = Math.min(1.0, this.MAX_ASSIST_ANGLE_RAD / bestAngleRad);
      assisted.lerp(bestDir, blendFactor * 0.75).normalize();
    }

    const finalAngleDeg = MathUtils.radToDeg(Math.acos(MathUtils.clamp(forward.dot(assisted), -1, 1)));

    return {
      target: bestTarget,
      assistedDirection: assisted,
      assistAngleDeg: finalAngleDeg,
      score: bestScore,
    };
  }
}
