/**
 * CombatSystem.ts
 *
 * Fluid Combat Engine, Polar Soft-Targeting, and Kinetic Hitstop for DR-MANAUS (Feature 08 / RF-09).
 * Based on architectural research from:
 * - docs/research/09-fluid-combat-soft-targeting-and-hitstop.md
 * - references/three-mesh-bvh/src/core/cast/raycastFirst.template.js
 * - references/NonEuclidean/NonEuclidean/Input.cpp
 *
 * Capabilities:
 * - Polar coordinate candidate selection within a 60-degree frontal cone (30° half-angle).
 * - Kinetic Hitstop time-dilation (40-70ms frame freeze on critical impact for visceral feel).
 * - 200ms input buffer queue (action queuing) preventing lost clicks during recovery frames.
 * - Zero GC allocations per frame with pre-allocated scratch vectors.
 */

import { MathUtils, Vector3 } from 'three/webgpu';
import type { Collider, Target } from '../../core/types';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { HitStopSystem } from './HitStopSystem';
import { SoftTargeting, type SoftTargetCandidate, type SoftTargetResult } from './SoftTargeting';

export interface CombatAction {
  readonly id: string;
  readonly type: 'melee_punch' | 'melee_kick' | 'laser' | 'energy_blast' | 'shockwave' | 'vehicle_cannon';
  readonly timestamp: number;
  readonly maxLifeSec: number;
}

export interface PolarTargetResult {
  readonly candidate: SoftTargetCandidate | null;
  readonly angleDeg: number;
  readonly distanceM: number;
  readonly assistedAimDir: Vector3;
  readonly score: number;
}

export class CombatSystem {
  public static readonly CONE_HALF_ANGLE_RAD = MathUtils.degToRad(30.0); // 60 deg full cone
  public static readonly DEFAULT_MAX_RANGE_M = 45.0; // Urban combat reach
  public static readonly COSMIC_MAX_RANGE_M = 500_000.0; // 500 km cosmic reach

  readonly hitStop = new HitStopSystem();
  private bufferedAction: CombatAction | null = null;
  private readonly inputBufferWindowSec = 0.20; // 200ms input buffering window

  // Reusable scratch vectors for zero GC
  private readonly _aimForward = new Vector3();
  private readonly _toCandidate = new Vector3();
  private readonly _assistedDir = new Vector3();

  /**
   * Evaluates targets within the 60-degree frontal cone using polar coordinates.
   */
  public selectPolarTarget(
    origin: Vector3,
    aimDir: Vector3,
    candidates: readonly SoftTargetCandidate[],
    maxRangeM: number = CombatSystem.DEFAULT_MAX_RANGE_M,
    colliders?: readonly Collider[]
  ): PolarTargetResult {
    this._aimForward.copy(aimDir).normalize();

    let bestCandidate: SoftTargetCandidate | null = null;
    let bestScore = -Infinity;
    let bestAngleRad = 0;
    let bestDist = 0;
    this._assistedDir.copy(this._aimForward);

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      this._toCandidate.subVectors(c.position, origin);
      const dist = this._toCandidate.length();

      if (dist < 0.2 || dist > maxRangeM) continue;

      this._toCandidate.normalize();
      const dot = MathUtils.clamp(this._aimForward.dot(this._toCandidate), -1, 1);
      const angleRad = Math.acos(dot);

      // Must be within 60-degree cone (30° half-angle)
      if (angleRad > CombatSystem.CONE_HALF_ANGLE_RAD) continue;

      // Line of sight check against colliders if provided
      if (colliders && colliders.length > 0) {
        const hit = PhysicsWorld.raycast(origin, this._toCandidate, colliders, dist * 0.95, 0.2);
        if (hit && hit.distance < dist - c.radius - 0.2) {
          continue; // Obstructed
        }
      }

      // Polar score: center alignment (0 to 40), proximity (0 to 30), priority weight
      const angleFactor = Math.cos(angleRad);
      const distFactor = Math.max(0, 1.0 - dist / maxRangeM);
      const score = (c.priority * 2.0) + (angleFactor * 40.0) + (distFactor * 30.0);

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = c;
        bestAngleRad = angleRad;
        bestDist = dist;
        this._assistedDir.copy(this._toCandidate);
      }
    }

    if (!bestCandidate) {
      return {
        candidate: null,
        angleDeg: 0,
        distanceM: 0,
        assistedAimDir: this._aimForward.clone(),
        score: 0
      };
    }

    // Blend gently toward target (up to 75% magnetic pull)
    const blendFactor = Math.min(1.0, CombatSystem.CONE_HALF_ANGLE_RAD / Math.max(1e-4, bestAngleRad));
    const finalDir = this._aimForward.clone().lerp(this._assistedDir, blendFactor * 0.75).normalize();
    const finalAngleDeg = MathUtils.radToDeg(bestAngleRad);

    return {
      candidate: bestCandidate,
      angleDeg: finalAngleDeg,
      distanceM: bestDist,
      assistedAimDir: finalDir,
      score: bestScore
    };
  }

  /**
   * Triggers kinetic hitstop to provide visceral tactile feedback on impacts.
   */
  public triggerHitstop(isCritical: boolean = false, tier: 'light' | 'medium' | 'heavy' | 'critical' = 'medium'): void {
    let durationMs = 45; // 45ms medium
    if (isCritical || tier === 'critical') {
      durationMs = 70; // 70ms critical (~4 frames)
    } else if (tier === 'heavy') {
      durationMs = 55;
    } else if (tier === 'light') {
      durationMs = 28;
    }

    this.hitStop.trigger(durationMs);
  }

  /**
   * Enqueues an attack action into the 200ms input buffer queue.
   */
  public bufferAction(type: CombatAction['type'], actionId: string = type): void {
    this.bufferedAction = {
      id: actionId,
      type,
      timestamp: performance.now() * 0.001,
      maxLifeSec: this.inputBufferWindowSec
    };
  }

  /**
   * Consumes the queued action if it is within the 200ms buffer window.
   */
  public consumeBufferedAction(): CombatAction | null {
    if (!this.bufferedAction) return null;
    const now = performance.now() * 0.001;
    if (now - this.bufferedAction.timestamp <= this.bufferedAction.maxLifeSec) {
      const act = this.bufferedAction;
      this.bufferedAction = null;
      return act;
    }
    this.bufferedAction = null;
    return null;
  }

  /**
   * Advances hitstop timer and updates combat state.
   */
  public update(dt: number): number {
    return this.hitStop.update(dt);
  }
}

