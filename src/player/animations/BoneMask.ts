import { BONES, type BoneId, type BoneMaskName } from './types';

export class BoneMask {
  private static readonly MASKS: Record<BoneMaskName, readonly boolean[]> = {
    FULL_BODY: Array(19).fill(true),
    UPPER_BODY: [
      false, true, true, true, true, // 0-4: Hips, Spine, Chest, Neck, Head
      true, true, true, true,        // 5-8: Left Arm
      true, true, true, true,        // 9-12: Right Arm
      false, false, false,           // 13-15: Left Leg
      false, false, false            // 16-18: Right Leg
    ],
    LOWER_BODY: [
      true, false, false, false, false,
      false, false, false, false,
      false, false, false, false,
      true, true, true,
      true, true, true
    ],
    LEFT_ARM: [
      false, false, false, false, false,
      true, true, true, true,
      false, false, false, false,
      false, false, false,
      false, false, false
    ],
    RIGHT_ARM: [
      false, false, false, false, false,
      false, false, false, false,
      true, true, true, true,
      false, false, false,
      false, false, false
    ],
    LEGS: [
      false, false, false, false, false,
      false, false, false, false,
      false, false, false, false,
      true, true, true,
      true, true, true
    ],
    SPINE: [
      true, true, true, true, true,
      false, false, false, false,
      false, false, false, false,
      false, false, false,
      false, false, false
    ],
  };

  /** Returns whether a given bone is affected by the specified mask */
  static affects(mask: BoneMaskName, boneId: BoneId): boolean {
    return this.MASKS[mask][boneId];
  }

  /** Gets the weight multiplier (0 or 1) for this bone given mask and layer weight */
  static getWeight(mask: BoneMaskName, boneId: BoneId, layerWeight = 1): number {
    return this.MASKS[mask][boneId] ? layerWeight : 0;
  }
}
