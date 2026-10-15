import { Bone, Euler, Quaternion, Vector3 } from 'three/webgpu';
import type { FlightPoseName } from './types';

export interface ProceduralFlightPoseWeights {
  chestArch: number;
  headTilt: number;
  armSweepBack: number;
  armSweepOut: number;
  legStraighten: number;
}

/**
 * Aerodynamic procedural offsets applied additively to the base animation.
 *
 * Safe bounds:
 * - Upper arms: strictly limited to <= 0.25 rad (14 deg) backward and <= 0.12 rad outward.
 * - Clavicles: NEVER rotated, avoiding shoulder deformation.
 * - Chest: subtle extension <= 0.26 rad.
 * - Head: pitch up <= 0.28 rad to keep view aligned with forward velocity.
 */
export const FLIGHT_POSE_CONFIG: Readonly<Record<FlightPoseName, ProceduralFlightPoseWeights>> = {
  hover: { chestArch: 0, headTilt: 0, armSweepBack: 0, armSweepOut: 0, legStraighten: 0 },
  takeoff: { chestArch: -0.06, headTilt: 0.08, armSweepBack: -0.06, armSweepOut: 0.04, legStraighten: 0.06 },
  cruise: { chestArch: -0.08, headTilt: 0.10, armSweepBack: -0.08, armSweepOut: 0.05, legStraighten: 0.08 },
  fast: { chestArch: -0.14, headTilt: 0.16, armSweepBack: -0.14, armSweepOut: 0.07, legStraighten: 0.14 },
  super: { chestArch: -0.18, headTilt: 0.20, armSweepBack: -0.18, armSweepOut: 0.09, legStraighten: 0.18 },
  mega: { chestArch: -0.22, headTilt: 0.24, armSweepBack: -0.22, armSweepOut: 0.10, legStraighten: 0.22 },
  interplanetary: { chestArch: -0.26, headTilt: 0.28, armSweepBack: -0.25, armSweepOut: 0.12, legStraighten: 0.26 },
  braking: { chestArch: 0.02, headTilt: -0.04, armSweepBack: 0.04, armSweepOut: 0.02, legStraighten: 0 },
  dash: { chestArch: -0.15, headTilt: 0.15, armSweepBack: -0.20, armSweepOut: 0.08, legStraighten: 0.15 },
};

const tmpQ = new Quaternion();
const tmpEuler = new Euler();
const tmpAxisX = new Vector3(1, 0, 0);

export class ProceduralFlightPoseLayer {
  private currentWeights: ProceduralFlightPoseWeights = { ...FLIGHT_POSE_CONFIG.hover };

  apply(bonesByName: ReadonlyMap<string, Bone>, pose: FlightPoseName, dt: number, activeCombat = false): void {
    if (activeCombat) return; // Never interfere with combat strikes
    const target = FLIGHT_POSE_CONFIG[pose] ?? FLIGHT_POSE_CONFIG.cruise;
    const blend = 1 - Math.exp(-Math.max(0, dt) * 10);

    this.currentWeights.chestArch += (target.chestArch - this.currentWeights.chestArch) * blend;
    this.currentWeights.headTilt += (target.headTilt - this.currentWeights.headTilt) * blend;
    this.currentWeights.armSweepBack += (target.armSweepBack - this.currentWeights.armSweepBack) * blend;
    this.currentWeights.armSweepOut += (target.armSweepOut - this.currentWeights.armSweepOut) * blend;
    this.currentWeights.legStraighten += (target.legStraighten - this.currentWeights.legStraighten) * blend;

    const spine = bonesByName.get('spine02') ?? bonesByName.get('spine03');
    if (spine && Math.abs(this.currentWeights.chestArch) > 0.001) {
      tmpQ.setFromAxisAngle(tmpAxisX, this.currentWeights.chestArch);
      spine.quaternion.multiply(tmpQ);
    }
    const head = bonesByName.get('head');
    if (head && Math.abs(this.currentWeights.headTilt) > 0.001) {
      tmpQ.setFromAxisAngle(tmpAxisX, this.currentWeights.headTilt);
      head.quaternion.multiply(tmpQ);
    }
    const leftArm = bonesByName.get('upperarml');
    if (leftArm && (Math.abs(this.currentWeights.armSweepBack) > 0.001 || Math.abs(this.currentWeights.armSweepOut) > 0.001)) {
      tmpEuler.set(this.currentWeights.armSweepBack, 0, -this.currentWeights.armSweepOut);
      tmpQ.setFromEuler(tmpEuler);
      leftArm.quaternion.multiply(tmpQ);
    }
    const rightArm = bonesByName.get('upperarmr');
    if (rightArm && (Math.abs(this.currentWeights.armSweepBack) > 0.001 || Math.abs(this.currentWeights.armSweepOut) > 0.001)) {
      tmpEuler.set(this.currentWeights.armSweepBack, 0, this.currentWeights.armSweepOut);
      tmpQ.setFromEuler(tmpEuler);
      rightArm.quaternion.multiply(tmpQ);
    }
    const leftCalf = bonesByName.get('calfl');
    if (leftCalf && Math.abs(this.currentWeights.legStraighten) > 0.001) {
      tmpQ.setFromAxisAngle(tmpAxisX, this.currentWeights.legStraighten * 0.5);
      leftCalf.quaternion.multiply(tmpQ);
    }
    const rightCalf = bonesByName.get('calfr');
    if (rightCalf && Math.abs(this.currentWeights.legStraighten) > 0.001) {
      tmpQ.setFromAxisAngle(tmpAxisX, this.currentWeights.legStraighten * 0.5);
      rightCalf.quaternion.multiply(tmpQ);
    }
  }

  get weights(): Readonly<ProceduralFlightPoseWeights> { return this.currentWeights; }
}
