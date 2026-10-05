import type { Vec3 } from '../spatial/units';
import { LANDING_SPEED_LIMITS } from './LandingCapture';

/**
 * Landing intent and the inelastic capture that serves it.
 *
 * This belongs to the travel layer, not to terrain physics: it decides what the player's
 * *cosmic* velocity does when they say "I want to stop flying and land here". The terrain
 * physics only takes over after the TravelDomain handoff, with a safe local speed.
 */

/** How a contact between the player and a celestial exclusion envelope is resolved. */
export type ContactResponseMode =
  /** Ordinary unassisted contact with a body the player did not ask to land on. */
  | 'graze'
  /** The player asked to land (F) or an assisted target capture is in progress. */
  | 'landing-capture'
  /** Reserved for the later destruction checkpoint. Not implemented and never selected. */
  | 'future-catastrophic';

export type LandingPhase = 'idle' | 'capture' | 'hold';

export const LANDING_POLICY = {
  /** F is accepted when clearance above the surface is within this many body radii... */
  captureRangeRadii: 4,
  /** ...and never beyond this, however large the body. */
  captureRangeMaxM: 30_000_000,
  /** The intent drops if the player is flung beyond range * this. */
  releaseRangeFactor: 1.5,
  /** Brake rate, per second of relative speed. Fast enough that 256c does not reach the shell. */
  brakeRatePerS: 20,
  minBrakeMps2: 100_000,
  /** Fraction of the TravelDomain return altitude to hold at once the surface is ready. */
  readyHoldFraction: 0.8,
  /** Hold above the return gate by this much while the surface is still loading. */
  waitingHoldMarginM: 1000,
  /** Finish a clamped approach before exponential convergence stalls the capture phase. */
  holdPositionToleranceM: 0.05,
  /**
   * Residual tangential speed left after a LANDING_CAPTURE contact. Half the safe local handoff
   * speed: the player arrives able to be handed to local physics, never carrying a cosmic tangent.
   */
  captureContactTangentCapMps: LANDING_SPEED_LIMITS.localHandoffSpeedMps * 0.5,
  /**
   * TEMPORARY celestial-contact policy for an unassisted GRAZE.
   *
   * There is no restitution anywhere: the inward component is removed and nothing is ever added
   * outward. The tangential component used to survive whole, which at 256c turned a graze into a
   * 256c sideways slingshot. It is now bounded to the fastest speed local terrain sweeps can be
   * trusted at. The later catastrophic-impact checkpoint is expected to replace this policy.
   */
  grazeTangentCapMps: LANDING_SPEED_LIMITS.maxLocalTerrainSweepMps,
  /** Prefetch the landing patch when the contact ETA is at most this long. */
  prefetchHorizonS: 900,
  /** Radial speed below this is treated as zero by the no-bounce invariant. */
  radialEpsilonMps: 1e-3,
} as const;

export interface LandingBody {
  readonly id: string;
  readonly canLand: boolean;
  /** Height above the surface, metres. */
  readonly clearanceM: number;
  readonly radiusM: number;
}

export type LandingCandidate =
  | { readonly ok: true; readonly bodyId: string }
  | { readonly ok: false; readonly reason: 'no-body' | 'not-landable' | 'out-of-range'; readonly bodyId?: string };

export function landingCaptureRangeM(radiusM: number): number {
  return Math.min(LANDING_POLICY.captureRangeMaxM, Math.max(0, radiusM) * LANDING_POLICY.captureRangeRadii);
}

/**
 * Whether F means "land" right now.
 *
 * Only logical body information is consulted: the body must exist, be landable, be the dominant
 * body or the navigation target, and be inside the bounded capture range. Nothing here can invent
 * a floor under deep space or under a gas giant.
 */
export function resolveLandingCandidate(
  bodies: readonly LandingBody[], dominantBodyId: string | undefined, targetBodyId: string | undefined,
): LandingCandidate {
  const ids = [targetBodyId, dominantBodyId].filter((id, i, all): id is string => !!id && all.indexOf(id) === i);
  let rejected: LandingCandidate = { ok: false, reason: 'no-body' };
  for (const id of ids) {
    const body = bodies.find(candidate => candidate.id === id);
    if (!body) continue;
    const inRange = Number.isFinite(body.clearanceM) && body.clearanceM <= landingCaptureRangeM(body.radiusM);
    if (!inRange) {
      if (rejected.ok === false && rejected.reason === 'no-body') rejected = { ok: false, reason: 'out-of-range', bodyId: id };
      continue;
    }
    if (!body.canLand) { rejected = { ok: false, reason: 'not-landable', bodyId: id }; continue; }
    return { ok: true, bodyId: id };
  }
  return rejected;
}

/** Explicit intent state. Owned by Game's navigation layer; consumed by the cosmic controller. */
export class PlanetaryLandingIntent {
  bodyId?: string;
  phase: LandingPhase = 'idle';

  get active(): boolean { return this.bodyId !== undefined; }
  request(bodyId: string): void { this.bodyId = bodyId; this.phase = 'capture'; }
  cancel(): void { this.bodyId = undefined; this.phase = 'idle'; }
}

/** What the cosmic controller needs to run the capture for one body. Barycentric metres. */
export interface LandingIntentContext {
  readonly bodyId: string;
  readonly centreM: Vec3;
  readonly velocityMps: Vec3;
  readonly radiusM: number;
  /** Height above the real (measured) surface. */
  readonly clearanceM: number;
  /** The critical landing patch is loaded and local handoff may proceed. */
  readonly surfaceReady: boolean;
  readonly returnAltitudeM: number;
}

/** Clearance at which the capture holds the player. Above the return gate while loading. */
export function landingHoldClearanceM(surfaceReady: boolean, returnAltitudeM: number): number {
  return surfaceReady
    ? returnAltitudeM * LANDING_POLICY.readyHoldFraction
    : returnAltitudeM + LANDING_POLICY.waitingHoldMarginM;
}

/**
 * One step of landing capture, in the landing body's frame of reference.
 *
 * `relVel` is the player's velocity minus the body's, and is rewritten in place. It is driven
 * toward a small inward approach speed (zero once at the hold clearance) with no tangential
 * component. The move is a clamped fraction of the way to that target, so the radial component
 * can only ever approach it from where it is: it never overshoots and never turns outward.
 */
export function landingCaptureStep(relVel: [number, number, number], offset: Vec3, clearanceM: number,
  surfaceReady: boolean, returnAltitudeM: number, dt: number): { phase: 'capture' | 'hold'; accelerationMps2: number } {
  const distance = Math.hypot(offset[0], offset[1], offset[2]);
  const n: Vec3 = distance > 0 ? [offset[0] / distance, offset[1] / distance, offset[2] / distance] : [0, 1, 0];
  const gap = clearanceM - landingHoldClearanceM(surfaceReady, returnAltitudeM);
  const approaching = gap > LANDING_POLICY.holdPositionToleranceM;
  const a = LANDING_POLICY.minBrakeMps2;
  const inward = approaching
    ? Math.min(LANDING_SPEED_LIMITS.approachCaptureSpeedMps, Math.sqrt(2 * a * gap * 0.35), gap / 1.5)
    : 0;
  const delta: Vec3 = [-n[0] * inward - relVel[0], -n[1] * inward - relVel[1], -n[2] * inward - relVel[2]];
  const change = Math.hypot(delta[0], delta[1], delta[2]);
  const speed = Math.hypot(relVel[0], relVel[1], relVel[2]);
  const authority = Math.max(LANDING_POLICY.minBrakeMps2, speed * LANDING_POLICY.brakeRatePerS);
  const factor = change > 0 ? Math.min(1, authority * Math.max(0, dt) / change) : 0;
  for (let i = 0; i < 3; i++) relVel[i] += delta[i] * factor;
  return { phase: approaching ? 'capture' : 'hold', accelerationMps2: change > 0 ? -Math.min(authority, change / Math.max(dt, 1e-9)) : 0 };
}

/**
 * Inelastic celestial contact. `relVel` is relative to the body and is rewritten in place.
 *
 * - the inward component is removed;
 * - nothing is ever added outward, and nothing is reflected;
 * - the tangential component is bounded by the mode's policy instead of surviving whole.
 *
 * Returns the resulting radial and tangential speeds, for telemetry and the no-bounce invariant.
 */
export function resolveCelestialContact(mode: ContactResponseMode, relVel: [number, number, number], normal: Vec3):
  { radialSpeedMps: number; tangentialSpeedMps: number } {
  const radial = relVel[0] * normal[0] + relVel[1] * normal[1] + relVel[2] * normal[2];
  // Inward motion is absorbed. Outward motion at contact is a separating body: leave it alone.
  const absorbed = radial < 0 ? radial : 0;
  for (let i = 0; i < 3; i++) relVel[i] -= absorbed * normal[i];
  const radialAfter = relVel[0] * normal[0] + relVel[1] * normal[1] + relVel[2] * normal[2];
  const tangent: Vec3 = [relVel[0] - radialAfter * normal[0], relVel[1] - radialAfter * normal[1], relVel[2] - radialAfter * normal[2]];
  const tangentSpeed = Math.hypot(tangent[0], tangent[1], tangent[2]);
  const cap = mode === 'landing-capture' ? LANDING_POLICY.captureContactTangentCapMps : LANDING_POLICY.grazeTangentCapMps;
  if (tangentSpeed > cap) {
    const scale = cap / tangentSpeed;
    for (let i = 0; i < 3; i++) relVel[i] = radialAfter * normal[i] + tangent[i] * scale;
  }
  return { radialSpeedMps: radialAfter, tangentialSpeedMps: Math.min(tangentSpeed, cap) };
}

/**
 * Where the player would touch down, as a body-fixed direction.
 *
 * Works in the body's fixed frame, never in render space. A closing velocity that hits the
 * sphere gives the hit point; anything else falls back to the sub-observer direction, which is
 * what a mostly radial approach, a hold, or a lock approach amounts to.
 */
export function predictTouchdownDirection(positionFixed: Vec3, relVelocityFixed: Vec3, radiusM: number): Vec3 {
  const distance = Math.hypot(positionFixed[0], positionFixed[1], positionFixed[2]);
  const sub: Vec3 = distance > 0
    ? [positionFixed[0] / distance, positionFixed[1] / distance, positionFixed[2] / distance] : [0, 0, 1];
  const speed = Math.hypot(relVelocityFixed[0], relVelocityFixed[1], relVelocityFixed[2]);
  if (!(speed > 1e-6) || !(radiusM > 0)) return sub;
  const d: Vec3 = [relVelocityFixed[0] / speed, relVelocityFixed[1] / speed, relVelocityFixed[2] / speed];
  const b = positionFixed[0] * d[0] + positionFixed[1] * d[1] + positionFixed[2] * d[2];
  const c = distance * distance - radiusM * radiusM;
  const disc = b * b - c;
  if (b >= 0 || disc < 0 || c <= 0) return sub;
  const t = -b - Math.sqrt(disc);
  const hit: Vec3 = [positionFixed[0] + d[0] * t, positionFixed[1] + d[1] * t, positionFixed[2] + d[2] * t];
  const length = Math.hypot(hit[0], hit[1], hit[2]) || 1;
  return [hit[0] / length, hit[1] / length, hit[2] / length];
}

/** Time to contact along the closing velocity, or Infinity when not closing. */
export function landingEtaS(clearanceM: number, closingSpeedMps: number): number {
  return closingSpeedMps > 1e-6 && Number.isFinite(clearanceM) ? Math.max(0, clearanceM) / closingSpeedMps : Number.POSITIVE_INFINITY;
}
