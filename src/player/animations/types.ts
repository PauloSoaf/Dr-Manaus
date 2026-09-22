import type { Quaternion, Vector3 } from 'three/webgpu';

export type BoneId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * 11 Humanoid bones used by DR Manaus skeleton:
 * 0: Body (Pelvis / Torso / Head)
 * 1: Left Upper Arm
 * 2: Right Upper Arm
 * 3: Left Thigh (Upper Leg)
 * 4: Right Thigh (Upper Leg)
 * 5: Left Forearm
 * 6: Right Forearm
 * 7: Left Shin (Lower Leg)
 * 8: Right Shin (Lower Leg)
 * 9: Left Hand
 * 10: Right Hand
 */
export const BONES = {
  BODY: 0,
  LEFT_ARM: 1,
  RIGHT_ARM: 2,
  LEFT_LEG: 3,
  RIGHT_LEG: 4,
  LEFT_FOREARM: 5,
  RIGHT_FOREARM: 6,
  LEFT_SHIN: 7,
  RIGHT_SHIN: 8,
  LEFT_HAND: 9,
  RIGHT_HAND: 10,
} as const;

export type BoneMaskName =
  | 'FULL_BODY'
  | 'UPPER_BODY'
  | 'LOWER_BODY'
  | 'LEFT_ARM'
  | 'RIGHT_ARM'
  | 'LEGS'
  | 'SPINE';

export type CombatContext = 'GROUND' | 'AIR' | 'HIGH_SPEED_AIR';

export type AnimationEventName =
  | 'attack.start'
  | 'attack.activeStart'
  | 'attack.hit'
  | 'attack.activeEnd'
  | 'attack.cancelWindow'
  | 'attack.complete'
  | 'takeoff.launch'
  | 'jump.impulse'
  | 'jump.apex'
  | 'doubleJump.impulse'
  | 'doubleJump.flipStart'
  | 'doubleJump.flipEnd'
  | 'kick.hit'
  | 'meteor.impact'
  | 'footstep.left'
  | 'footstep.right'
  | 'landing.contact'
  | 'shockwave.release'
  | 'repair.release';

export interface AnimationEventDef {
  readonly time: number; // Normalized time (0 to 1)
  readonly event: AnimationEventName;
  readonly payload?: unknown;
}

export type MovePhase = 'startup' | 'active' | 'recovery' | 'cancelWindow';

export interface CombatMove {
  readonly id: string;
  readonly context: CombatContext;
  readonly animation: string;
  readonly startup: number; // in seconds
  readonly active: number; // in seconds
  readonly recovery: number; // in seconds
  readonly cancelAt: number; // in seconds from start
  readonly damage: number;
  readonly radius: number;
  readonly impulse: number;
  readonly speedScaling: boolean;
  readonly sizeScaling: boolean;
  readonly targetAssist: boolean;
  readonly boneMask: BoneMaskName;
  readonly events: readonly AnimationEventDef[];
  readonly nextMoves?: readonly string[];
}

export type FlipDirection = 'front' | 'back' | 'sideLeft' | 'sideRight';

export interface DoubleJumpState {
  active: boolean;
  progress: number;
  duration: number;
  direction: FlipDirection;
}

export type FlightPoseName = 'hover' | 'takeoff' | 'cruise' | 'fast' | 'super' | 'mega' | 'braking';
export type LandingTier = 'soft' | 'hard' | 'super' | 'titan';
