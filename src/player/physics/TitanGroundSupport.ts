import { Vector3 } from 'three/webgpu';
import type { Collider } from '../../core/types';
import { PhysicsWorld } from '../../physics/PhysicsWorld';

export interface FootContact {
  readonly position: Vector3;
  readonly isLeft: boolean;
  readonly supported: boolean;
  readonly crushedCount: number;
}

export class TitanGroundSupport {
  private supportGraceTimer = 0;
  private airTime = 0;
  private lastGroundedY = 0;
  private readonly leftFootPrev = new Vector3();
  private readonly rightFootPrev = new Vector3();
  private initialized = false;

  /**
   * Evaluates footprint support over a broader area for giants.
   */
  evaluateSupport(
    position: Vector3,
    size: number,
    verticalVelocity: number,
    dt: number,
    colliders: readonly Collider[]
  ): { hasSupport: boolean; isFallingVisually: boolean } {
    if (size < 4) {
      // Human or small form uses standard ground check
      const terrain = PhysicsWorld.terrainHeight(position.x, position.z);
      const onTerrain = Math.abs(position.y - terrain) < 0.35;
      const onCollider = colliders.some(
        c => Math.abs(c.x - position.x) < c.width / 2 + 0.32 &&
             Math.abs(c.z - position.z) < c.depth / 2 + 0.32 &&
             Math.abs(c.y + c.height / 2 - position.y) < 0.4
      );
      const grounded = onTerrain || onCollider;
      if (grounded) {
        this.airTime = 0;
        this.lastGroundedY = position.y;
      } else {
        this.airTime += dt;
      }
      return {
        hasSupport: grounded,
        isFallingVisually: !grounded && verticalVelocity < -2 && this.airTime > 0.15,
      };
    }

    // Giant & Titan Support Model
    const footprintRadius = size * 0.45;
    const terrainCenter = PhysicsWorld.terrainHeight(position.x, position.z);
    const terrainNear = Math.max(
      terrainCenter,
      PhysicsWorld.terrainHeight(position.x + footprintRadius, position.z),
      PhysicsWorld.terrainHeight(position.x - footprintRadius, position.z),
      PhysicsWorld.terrainHeight(position.x, position.z + footprintRadius),
      PhysicsWorld.terrainHeight(position.x, position.z - footprintRadius)
    );

    const terrainTolerance = Math.max(1.5, size * 0.12);
    const supportedByTerrain = Math.abs(position.y - terrainNear) <= terrainTolerance;

    let supportedByCollider = false;
    for (const c of colliders) {
      const topY = c.y + c.height / 2;
      if (
        Math.abs(c.x - position.x) < c.width / 2 + footprintRadius &&
        Math.abs(c.z - position.z) < c.depth / 2 + footprintRadius &&
        Math.abs(topY - position.y) < terrainTolerance * 1.5
      ) {
        supportedByCollider = true;
        break;
      }
    }

    const currentlySupported = supportedByTerrain || supportedByCollider;

    if (currentlySupported) {
      this.supportGraceTimer = 0.28; // 280ms grace window while crushing buildings underfoot
      this.airTime = 0;
      this.lastGroundedY = position.y;
    } else {
      this.supportGraceTimer = Math.max(0, this.supportGraceTimer - dt);
      this.airTime += dt;
    }

    const effectiveSupport = currentlySupported || this.supportGraceTimer > 0;

    // Visual fall rule for titans:
    // Only enters fall if:
    // 1. No support (including grace period)
    // 2. Downward velocity significant (< -12 m/s)
    // 3. Fall distance exceeds significant fraction of titan size (e.g. 15% of size)
    // 4. Air time > 0.45s
    const fallDistance = this.lastGroundedY - position.y;
    const significantFall = fallDistance > Math.max(3, size * 0.16);
    const isFallingVisually = !effectiveSupport && verticalVelocity < -12 && significantFall && this.airTime > 0.4;

    return {
      hasSupport: effectiveSupport,
      isFallingVisually,
    };
  }

  /**
   * Sweeps foot volume between steps to crush buildings and obstacles underfoot.
   */
  sweepFootstep(
    footCurrent: Vector3,
    isLeft: boolean,
    size: number,
    damageFn?: (point: Vector3, radius: number, amount: number) => number
  ): FootContact {
    const prev = isLeft ? this.leftFootPrev : this.rightFootPrev;
    if (!this.initialized) {
      this.leftFootPrev.copy(footCurrent);
      this.rightFootPrev.copy(footCurrent);
      this.initialized = true;
    }

    const crushRadius = Math.max(2, size * 0.22);
    const crushPoint = new Vector3().addVectors(prev, footCurrent).multiplyScalar(0.5);
    prev.copy(footCurrent);

    let crushed = 0;
    if (damageFn && size >= 6) {
      crushed = damageFn(crushPoint, crushRadius, 150000 * size);
    }

    const floor = PhysicsWorld.terrainHeight(footCurrent.x, footCurrent.z);
    const supported = Math.abs(footCurrent.y - floor) < Math.max(2.5, size * 0.15);

    return {
      position: footCurrent.clone(),
      isLeft,
      supported,
      crushedCount: crushed,
    };
  }

  reset(): void {
    this.supportGraceTimer = 0;
    this.airTime = 0;
    this.lastGroundedY = 0;
    this.initialized = false;
  }
}
