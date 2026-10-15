import type { Vec3 } from '../../world/spatial/units';

/**
 * Presentation-only angular occlusion between celestial bodies, evaluated from the observer in
 * logical (Float64) coordinates. No mesh ray casts and no render-space astronomical values.
 */
export interface OcclusionBody {
  readonly id: string;
  /** Observer -> body centre, logical metres. */
  readonly delta: Vec3;
  readonly distanceM: number;
  /** Geometric angular radius of the body disc as seen by the observer. */
  readonly angularRadiusRad: number;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * True when `occluder` covers the whole disc of `target`.
 * The occluder must be nearer. A disc of at least a hemisphere (observer on or inside the body)
 * is treated as the local horizon half-space: everything towards the body centre is hidden.
 */
export function isAngularlyOccluded(target: OcclusionBody, occluder: OcclusionBody): boolean {
  if (target.id === occluder.id) return false;
  if (!(target.distanceM > 0) || !(occluder.distanceM > 0)) return false;
  if (!Number.isFinite(target.distanceM + occluder.distanceM + target.angularRadiusRad + occluder.angularRadiusRad)) return false;
  if (occluder.distanceM >= target.distanceM) return false;
  const cos = dot(target.delta, occluder.delta) / (target.distanceM * occluder.distanceM);
  const separation = Math.acos(Math.min(1, Math.max(-1, cos)));
  if (occluder.angularRadiusRad >= Math.PI / 2 - 1e-9) return separation < Math.PI / 2;
  return separation + target.angularRadiusRad <= occluder.angularRadiusRad;
}

export function occludingBodyId(target: OcclusionBody, others: readonly OcclusionBody[]): string | undefined {
  for (const other of others) if (isAngularlyOccluded(target, other)) return other.id;
  return undefined;
}
