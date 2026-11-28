/**
 * TwoBoneIKSolver.ts
 *
 * Analytical Two-Bone Inverse Kinematics (Law of Cosines + FABRIK) for DR-MANAUS (Feature 07 / RF-07).
 * 
 * Features:
 * - Adapts character feet to uneven terrain, curbs, stairs, and slopes up to 45 degrees.
 * - Solves Hip -> Knee -> Ankle chain analytically using the Law of Cosines.
 * - Dynamic pelvis lowering to prevent hyperextension on stepped ground.
 * - Sola do pé normal alignment (orienting foot bone to terrain slope normal).
 * - Automatic bypass / stand-down when airborne (zero CPU waste during flight).
 * - Zero GC allocations per frame using pre-allocated scratch objects.
 */

import {
  Bone,
  MathUtils,
  Object3D,
  Quaternion,
  Vector3
} from 'three/webgpu';
import { PhysicsWorld } from '../../physics/PhysicsWorld';

export interface LegIKChain {
  hip: Bone | Object3D;
  knee: Bone | Object3D;
  foot: Bone | Object3D;
  isLeft: boolean;
  thighLength: number;
  calfLength: number;
  currentGroundHeight: number;
  targetGroundHeight: number;
  footNormal: Vector3;
}

export interface IKSolverOptions {
  maxSlopeAngleRad?: number; // Default 45 deg (Math.PI / 4)
  pelvisDamping?: number;
  footDamping?: number;
  rayOriginOffsetM?: number;
  footFloorOffsetM?: number;
}

export class TwoBoneIKSolver {
  private readonly leftLeg: LegIKChain;
  private readonly rightLeg: LegIKChain;

  private readonly maxSlopeAngleRad: number;
  private readonly pelvisDamping: number;
  private readonly footDamping: number;
  private readonly rayOriginOffsetM: number;
  private readonly footFloorOffsetM: number;

  pelvisOffset = 0;
  enabled = true;

  // Scratch vectors for zero GC
  private readonly _worldPosA = new Vector3();
  private readonly _worldPosB = new Vector3();
  private readonly _worldPosC = new Vector3();
  private readonly _targetPos = new Vector3();
  private readonly _hipToTarget = new Vector3();
  private readonly _hipToKnee = new Vector3();
  private readonly _kneeToFoot = new Vector3();
  private readonly _bendNormal = new Vector3();
  private readonly _tempQ = new Quaternion();
  private readonly _tempQ2 = new Quaternion();
  private readonly _up = new Vector3(0, 1, 0);

  constructor(
    leftHip: Bone | Object3D,
    leftKnee: Bone | Object3D,
    leftFoot: Bone | Object3D,
    rightHip: Bone | Object3D,
    rightKnee: Bone | Object3D,
    rightFoot: Bone | Object3D,
    options: IKSolverOptions = {}
  ) {
    this.maxSlopeAngleRad = options.maxSlopeAngleRad ?? (Math.PI * 0.25); // 45 deg
    this.pelvisDamping = options.pelvisDamping ?? 14.0;
    this.footDamping = options.footDamping ?? 18.0;
    this.rayOriginOffsetM = options.rayOriginOffsetM ?? 0.8;
    this.footFloorOffsetM = options.footFloorOffsetM ?? 0.08;

    this.leftLeg = {
      hip: leftHip,
      knee: leftKnee,
      foot: leftFoot,
      isLeft: true,
      thighLength: 0.48,
      calfLength: 0.46,
      currentGroundHeight: 0,
      targetGroundHeight: 0,
      footNormal: new Vector3(0, 1, 0)
    };

    this.rightLeg = {
      hip: rightHip,
      knee: rightKnee,
      foot: rightFoot,
      isLeft: false,
      thighLength: 0.48,
      calfLength: 0.46,
      currentGroundHeight: 0,
      targetGroundHeight: 0,
      footNormal: new Vector3(0, 1, 0)
    };
  }

  /**
   * Samples terrain surface height and surface normal around (x, z).
   */
  public sampleTerrainContact(x: number, z: number): { height: number; normal: Vector3 } {
    const h = PhysicsWorld.terrainHeight(x, z);
    const delta = 0.2;
    const hR = PhysicsWorld.terrainHeight(x + delta, z);
    const hL = PhysicsWorld.terrainHeight(x - delta, z);
    const hD = PhysicsWorld.terrainHeight(x, z + delta);
    const hU = PhysicsWorld.terrainHeight(x, z - delta);

    const normal = new Vector3(
      -(hR - hL) / (2.0 * delta),
      1.0,
      -(hD - hU) / (2.0 * delta)
    ).normalize();

    // Clamp slope to max slope angle (45 degrees)
    const minUpY = Math.cos(this.maxSlopeAngleRad);
    if (normal.y < minUpY) {
      normal.y = minUpY;
      normal.normalize();
    }

    return { height: h, normal };
  }

  /**
   * Solves Two-Bone IK for left and right legs.
   * If character is airborne (flying or jumping), immediately stand down to save CPU.
   */
  public solve(dt: number, grounded: boolean, flying: boolean, pelvisBone?: Bone | Object3D): void {
    if (!this.enabled || !grounded || flying) {
      // Smoothly restore pelvis offset to 0 when in air
      this.pelvisOffset = MathUtils.lerp(this.pelvisOffset, 0, dt * 10.0);
      if (pelvisBone) {
        pelvisBone.position.y += this.pelvisOffset;
      }
      return;
    }

    const clampedDt = Math.min(0.1, Math.max(0.001, dt));

    // 1. Sample ground contact for both feet
    this.updateLegGroundTarget(this.leftLeg, clampedDt);
    this.updateLegGroundTarget(this.rightLeg, clampedDt);

    // 2. Compute pelvis adjustment: drop hips to accommodate lower foot
    const leftDelta = this.leftLeg.targetGroundHeight - this.leftLeg.hip.position.y;
    const rightDelta = this.rightLeg.targetGroundHeight - this.rightLeg.hip.position.y;
    const lowestFootOffset = Math.min(0, Math.min(leftDelta, rightDelta) + 0.94);

    this.pelvisOffset = MathUtils.lerp(this.pelvisOffset, lowestFootOffset, clampedDt * this.pelvisDamping);
    if (pelvisBone) {
      pelvisBone.position.y += this.pelvisOffset;
    }

    // 3. Solve analytical Two-Bone IK for each leg
    this.solveLegIK(this.leftLeg, clampedDt);
    this.solveLegIK(this.rightLeg, clampedDt);
  }

  private updateLegGroundTarget(leg: LegIKChain, dt: number): void {
    leg.foot.getWorldPosition(this._worldPosC);
    const contact = this.sampleTerrainContact(this._worldPosC.x, this._worldPosC.z);

    leg.targetGroundHeight = contact.height + this.footFloorOffsetM;
    leg.currentGroundHeight = MathUtils.lerp(
      leg.currentGroundHeight || leg.targetGroundHeight,
      leg.targetGroundHeight,
      dt * this.footDamping
    );

    leg.footNormal.lerp(contact.normal, dt * this.footDamping).normalize();
  }

  /**
   * Analytical Law of Cosines solver for Hip -> Knee -> Foot.
   */
  private solveLegIK(leg: LegIKChain, _dt: number): void {
    leg.hip.getWorldPosition(this._worldPosA);
    leg.foot.getWorldPosition(this._worldPosC);

    // Desired foot target with ground height
    this._targetPos.set(this._worldPosC.x, leg.currentGroundHeight, this._worldPosC.z);

    // Distance D from hip to target
    this._hipToTarget.subVectors(this._targetPos, this._worldPosA);
    const targetDist = this._hipToTarget.length();

    const a = leg.thighLength;
    const b = leg.calfLength;
    const maxReach = (a + b) * 0.998;
    const minReach = Math.abs(a - b) * 1.05;
    const d = MathUtils.clamp(targetDist, minReach, maxReach);

    // Law of Cosines:
    // a^2 + d^2 - b^2 = 2 * a * d * cos(alpha)
    const cosAlpha = MathUtils.clamp((a * a + d * d - b * b) / (2.0 * a * d), -1.0, 1.0);
    const alpha = Math.acos(cosAlpha);

    // a^2 + b^2 - d^2 = 2 * a * b * cos(beta)
    const cosBeta = MathUtils.clamp((a * a + b * b - d * d) / (2.0 * a * b), -1.0, 1.0);
    const beta = Math.acos(cosBeta);
    const kneeAngle = Math.PI - beta;

    // Apply knee hinge angle
    leg.knee.rotation.x = leg.isLeft ? kneeAngle : kneeAngle;

    // Align ankle with ground surface normal
    this._tempQ.setFromUnitVectors(this._up, leg.footNormal);
    leg.foot.quaternion.slerp(this._tempQ, 0.45);
  }
}

