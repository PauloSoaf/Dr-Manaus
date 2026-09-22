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
