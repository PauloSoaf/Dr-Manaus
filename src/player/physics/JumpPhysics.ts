import { MathUtils } from 'three/webgpu';

export const JUMP_CONFIG = {
  baseHeight: 1.8, // metres for human (2.07m rig)
  baseGravity: 25, // m/s^2 as configured in PlayerController
  baseDoubleJumpDuration: 0.44, // seconds for full 360 flip
  maxJumpHeight: 240, // Clamp for titan forms (so 1km titan doesn't jump 10km high)
} as const;

/**
 * Height scales sub-linearly with scale for gameplay balance and control.
 * E.g., human (scale 1) -> ~1.8m
 * 15m giant (scale ~7) -> ~9m
 * 46m giant (scale ~22) -> ~22m
 * 200m (scale ~100) -> ~65m
 * 500m (scale ~250) -> ~125m
 * 1000m (scale ~500) -> ~180m (capped at 240m)
 */
export function getJumpHeight(size: number, baseHeight = JUMP_CONFIG.baseHeight): number {
  const scale = Math.max(1, size);
  const scaling = Math.pow(scale, 0.68);
  return Math.min(JUMP_CONFIG.maxJumpHeight, baseHeight * scaling);
}

export function getGravity(size: number, baseGravity = JUMP_CONFIG.baseGravity): number {
  // Gravity can also be slightly higher for giant mass feeling
  return baseGravity * Math.pow(Math.max(1, size), 0.1);
}

/**
 * Calculates vertical velocity from desired height and gravity:
 * v = sqrt(2 * g * h)
 */
export function getJumpVelocity(
  size: number,
  gravity = JUMP_CONFIG.baseGravity,
  baseHeight = JUMP_CONFIG.baseHeight
): number {
  const height = getJumpHeight(size, baseHeight);
  const effectiveGravity = getGravity(size, gravity);
  return Math.sqrt(2 * effectiveGravity * height);
}

/**
 * Double jump animation duration scales moderately with size:
 * rate = baseRate / pow(size, 0.15), meaning duration = baseDuration * pow(size, 0.15)
 * Human: ~0.44s
 * 15m: ~0.59s
 * 200m: ~0.87s
 * 1000m: ~1.12s
 */
export function getDoubleJumpDuration(
  size: number,
  baseDuration = JUMP_CONFIG.baseDoubleJumpDuration
): number {
  const scale = Math.max(1, size);
  return Math.min(1.4, baseDuration * Math.pow(scale, 0.16));
}
