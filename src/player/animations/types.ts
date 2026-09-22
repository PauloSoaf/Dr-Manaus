import type { Quaternion, Vector3 } from 'three/webgpu';

export type BoneId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

/**
 * 19 Humanoid bones used by DR Manaus skeleton:
 */
export const BONES = {
  HIPS: 0,
  SPINE: 1,
  CHEST: 2,
  NECK: 3,
  HEAD: 4,
  LEFT_SHOULDER: 5,
  LEFT_ARM: 6,
  LEFT_FOREARM: 7,
  LEFT_HAND: 8,
  RIGHT_SHOULDER: 9,
  RIGHT_ARM: 10,
  RIGHT_FOREARM: 11,
  RIGHT_HAND: 12,
  LEFT_LEG: 13,
  LEFT_SHIN: 14,
  LEFT_FOOT: 15,
  RIGHT_LEG: 16,
  RIGHT_SHIN: 17,
  RIGHT_FOOT: 18,
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
