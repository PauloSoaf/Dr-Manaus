import { BONES, type BoneId, type BoneMaskName } from './types';

export class BoneMask {
  private static readonly MASKS: Record<BoneMaskName, readonly boolean[]> = {
    FULL_BODY: [true, true, true, true, true, true, true, true, true, true, true],
    UPPER_BODY: [
      true,  // 0 Body / Spine
      true,  // 1 Left Arm
      true,  // 2 Right Arm
      false, // 3 Left Leg
      false, // 4 Right Leg
      true,  // 5 Left Forearm
      true,  // 6 Right Forearm
      false, // 7 Left Shin
      false, // 8 Right Shin
      true,  // 9 Left Hand
      true,  // 10 Right Hand
    ],
    LOWER_BODY: [
      true,  // 0 Body / Hips
      false, // 1 Left Arm
      false, // 2 Right Arm
      true,  // 3 Left Leg
      true,  // 4 Right Leg
      false, // 5 Left Forearm
      false, // 6 Right Forearm
      true,  // 7 Left Shin
      true,  // 8 Right Shin
      false, // 9 Left Hand
      false, // 10 Right Hand
    ],
    LEFT_ARM: [
      false, // 0 Body
      true,  // 1 Left Arm
      false, // 2 Right Arm
      false, // 3 Left Leg
      false, // 4 Right Leg
      true,  // 5 Left Forearm
      false, // 6 Right Forearm
      false, // 7 Left Shin
      false, // 8 Right Shin
      true,  // 9 Left Hand
      false, // 10 Right Hand
    ],
    RIGHT_ARM: [
      false, // 0 Body
      false, // 1 Left Arm
      true,  // 2 Right Arm
      false, // 3 Left Leg
      false, // 4 Right Leg
      false, // 5 Left Forearm
      true,  // 6 Right Forearm
      false, // 7 Left Shin
      false, // 8 Right Shin
      false, // 9 Left Hand
      true,  // 10 Right Hand
    ],
    LEGS: [
      false, // 0 Body
      false, // 1 Left Arm
      false, // 2 Right Arm
      true,  // 3 Left Leg
      true,  // 4 Right Leg
      false, // 5 Left Forearm
      false, // 6 Right Forearm
      true,  // 7 Left Shin
      true,  // 8 Right Shin
      false, // 9 Left Hand
      false, // 10 Right Hand
    ],
    SPINE: [
      true,  // 0 Body
      false, false, false, false, false, false, false, false, false, false,
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
