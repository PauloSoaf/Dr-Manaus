import type { AnimationEventDef, BoneMaskName, CombatContext, CombatMove } from '../animations/types';
import { clipInfo } from '../animations/ClipCatalog';

/**
 * Melee moves, timed from the clips themselves.
 *
 * Each move names the authored clip it plays and a playback rate. Its startup, active window and
 * hit event are derived from the catalogue's measured strike time — the frame where the fist or
 * foot reaches full extension — so damage, hit-stop, sound and camera land on the impact the
 * player sees instead of on a guessed fraction.
 */
interface MoveSpec {
  readonly id: string;
  readonly context: CombatContext;
  readonly clip: string;
  /** Playback rate: >1 is snappier than authored. Kept within ±35% of authored speed. */
  readonly rate: number;
  readonly damage: number;
  readonly radius: number;
  readonly impulse: number;
  readonly boneMask: BoneMaskName;
  readonly hitEvent?: 'attack.hit' | 'kick.hit' | 'meteor.impact';
  /** Normalised time after the hit when the next move may cancel the recovery. */
  readonly cancelAfterHit?: number;
  readonly nextMoves?: readonly string[];
  /** Fallback strike time when the catalogue has none. */
  readonly hit?: number;
}

const SPECS: readonly MoveSpec[] = [
  { id: 'punch', context: 'GROUND', clip: 'Punch_Jab', rate: 1.3, damage: 30000, radius: 1.5, impulse: 25, boneMask: 'UPPER_BODY', nextMoves: ['punchCross'] },
  { id: 'punchCross', context: 'GROUND', clip: 'Punch_Cross', rate: 1.3, damage: 35000, radius: 1.6, impulse: 30, boneMask: 'UPPER_BODY', nextMoves: ['punchUpper'] },
  { id: 'punchUpper', context: 'GROUND', clip: 'Melee_Hook', rate: 1.0, damage: 48000, radius: 2.0, impulse: 40, boneMask: 'UPPER_BODY' },
  { id: 'kick', context: 'GROUND', clip: 'Kick_Front_R', rate: 1.45, damage: 38000, radius: 1.8, impulse: 32, boneMask: 'FULL_BODY', hitEvent: 'kick.hit', nextMoves: ['kickSide'] },
  { id: 'kickSide', context: 'GROUND', clip: 'Kick_Side_R', rate: 1.3, damage: 42000, radius: 2.0, impulse: 38, boneMask: 'FULL_BODY', hitEvent: 'kick.hit', nextMoves: ['kickRoundhouse'] },
  { id: 'kickRoundhouse', context: 'GROUND', clip: 'Kick_Roundhouse_R', rate: 1.2, damage: 52000, radius: 2.3, impulse: 46, boneMask: 'FULL_BODY', hitEvent: 'kick.hit' },
  { id: 'kickSpin', context: 'GROUND', clip: 'Kick_Spin_Jump', rate: 1.0, damage: 60000, radius: 2.6, impulse: 52, boneMask: 'FULL_BODY', hitEvent: 'kick.hit' },
  { id: 'kickPush', context: 'GROUND', clip: 'Kick_Push', rate: 1.2, damage: 36000, radius: 1.8, impulse: 60, boneMask: 'FULL_BODY', hitEvent: 'kick.hit' },
  { id: 'flyingPunch', context: 'AIR', clip: 'Punch_Cross', rate: 1.45, damage: 35000, radius: 1.8, impulse: 35, boneMask: 'UPPER_BODY' },
  { id: 'kineticStrike', context: 'HIGH_SPEED_AIR', clip: 'Melee_Hook', rate: 1.1, damage: 120000, radius: 5.5, impulse: 90, boneMask: 'UPPER_BODY' },
  { id: 'meteorPunch', context: 'AIR', clip: 'OverhandThrow', rate: 1.35, damage: 85000, radius: 4.2, impulse: 70, boneMask: 'FULL_BODY', hitEvent: 'meteor.impact', cancelAfterHit: 0.3 },
  { id: 'flyingKick', context: 'AIR', clip: 'Kick_Front_R', rate: 1.35, damage: 42000, radius: 2.2, impulse: 45, boneMask: 'FULL_BODY', hitEvent: 'kick.hit' },
];

/** Builds a move whose phases are placed around the clip's measured strike. */
export function buildMove(spec: MoveSpec, durationOf: (clip: string) => number = name => clipInfo(name)?.duration ?? 0.6): CombatMove {
  const clipDuration = Math.max(0.2, durationOf(spec.clip));
  const total = clipDuration / spec.rate;
  const hit = Math.min(0.85, Math.max(0.12, clipInfo(spec.clip)?.hit ?? spec.hit ?? 0.45));
  const half = Math.min(0.06, total * 0.08) / total;
  const activeStart = Math.max(0.02, hit - half), activeEnd = Math.min(0.95, hit + half);
  const cancelAt = Math.min(0.98, hit + (spec.cancelAfterHit ?? 0.18));
  const events: AnimationEventDef[] = [
    { time: 0, event: 'attack.start' },
    { time: activeStart, event: 'attack.activeStart' },
    { time: hit, event: spec.hitEvent ?? 'attack.hit' },
    { time: activeEnd, event: 'attack.activeEnd' },
    { time: cancelAt, event: 'attack.cancelWindow' },
    { time: 1, event: 'attack.complete' },
  ];
  return {
    id: spec.id, context: spec.context, animation: spec.clip,
    startup: activeStart * total, active: (activeEnd - activeStart) * total, recovery: (1 - activeEnd) * total,
    cancelAt, damage: spec.damage, radius: spec.radius, impulse: spec.impulse,
    speedScaling: true, sizeScaling: true, targetAssist: true, boneMask: spec.boneMask, events,
    nextMoves: spec.nextMoves,
  };
}

export const COMBAT_MOVES: Record<string, CombatMove> = Object.fromEntries(SPECS.map(spec => [spec.id, buildMove(spec)]));

/** Total seconds a move takes (startup + active + recovery). */
export function moveDuration(move: CombatMove): number { return move.startup + move.active + move.recovery; }
