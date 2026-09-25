/**
 * The somersault, as motion rather than as a constant spin.
 *
 * A real double jump conserves angular momentum: the athlete leaves the ground already turning,
 * tucks to shrink the moment of inertia and speeds up, then opens out and slows back down. So
 * angular velocity follows 1/I, which peaks in the middle and never reaches zero at the ends —
 * unlike an eased curve, which would make the body hang and then snap.
 */

export type FlipPhase = 'takeoff' | 'tuck' | 'rotate' | 'untuck' | 'recovery';

export const FLIP = {
  /** Peak angular velocity is (1 + tuckGain) times the opened-out rate. */
  tuckGain: 1.6,
  /** Phase boundaries in normalised flip time. */
  takeoffEnd: 0.14,
  tuckEnd: 0.32,
  rotateEnd: 0.68,
  untuckEnd: 0.86,
} as const;

const TWO_PI = Math.PI * 2;
const clamp01 = (value: number): number => (value > 1 ? 1 : value < 0 ? 0 : value);

/**
 * Normalised rotation completed at `progress`. Strictly increasing, exactly 0 at 0 and 1 at 1,
 * which is what keeps ten consecutive flips from accumulating any error.
 *
 * The integral of the angular velocity omega(t) = 1 + k·sin²(πt), normalised by its own total.
 */
export function flipEase(progress: number): number {
  const t = clamp01(progress);
  const k = FLIP.tuckGain;
  const total = 1 + k / 2;
  return (t * total - (k * Math.sin(TWO_PI * t)) / (2 * TWO_PI)) / total;
}

/** Radians turned at `progress`, from 0 to a full 2π. */
export function flipAngle(progress: number): number {
  return flipEase(progress) * TWO_PI;
}

/** Instantaneous angular velocity in turns per unit progress, for debugging and tests. */
export function flipRate(progress: number): number {
  const t = clamp01(progress);
  const k = FLIP.tuckGain;
  return (1 + k * Math.sin(Math.PI * t) ** 2) / (1 + k / 2);
}

/** How tucked the body is: 0 opened out, 1 fully compressed at the middle of the rotation. */
export function flipTuck(progress: number): number {
  return Math.sin(Math.PI * clamp01(progress)) ** 2;
}

export function flipPhase(progress: number): FlipPhase {
  const t = clamp01(progress);
  if (t < FLIP.takeoffEnd) return 'takeoff';
  if (t < FLIP.tuckEnd) return 'tuck';
  if (t < FLIP.rotateEnd) return 'rotate';
  if (t < FLIP.untuckEnd) return 'untuck';
  return 'recovery';
}
