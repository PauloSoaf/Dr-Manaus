import { Vector3 } from 'three/webgpu';
import { type InterplanetaryState, type TravelContext } from './TravelDomain';
import type { BodyExclusionEnvelope } from './BodyNavigation';
import type { CelestialContact } from './CelestialContact';
import { AutopilotCapture } from './AutopilotCapture';
import { LANDING_SPEED_LIMITS } from './LandingCapture';
import {
  type ContactResponseMode, type LandingIntentContext, landingCaptureStep, resolveCelestialContact,
} from './PlanetaryLanding';

/**
 * Cosmic cruise: crossing a solar system in seconds without leaving the logical frame.
 *
 * Everything in here works in `solar-system/barycentric`. That is not a detail — the previous
 * version compared a camera-forward vector still in render space against a direction computed in
 * barycentric metres, so "am I pointing at the Moon?" was a dot product between two different
 * coordinate systems and could answer either way. Vectors that arrive here carry their frame in
 * their name for that reason.
 */

/**
 * What the player has chosen to fly to.
 *
 * Identity and arrival parameters only. A position snapshot would be wrong by the time it was
 * used: the ephemeris keeps moving the bodies, so a target captured at selection points at where
 * Mars *was*. The live position is resolved every update from `activeSystem.positionOf(bodyId)`.
 */
export interface NavigationTarget {
  readonly bodyId: string;
  /** Clearance above the body's surface to aim for, metres. */
  readonly arrivalMarginM: number;
}

/** The same target, resolved against the current ephemeris. Built fresh each update. */
export interface ResolvedTarget {
  readonly velocityMps?: readonly [number, number, number];
  readonly bodyId: string;
  /** Live position in `solar-system/barycentric`. */
  readonly positionM: readonly [number, number, number];
  readonly radiusM: number;
  readonly arrivalMarginM: number;
}

export interface FlightTelemetry {
  speedMps: number;
  accelerationMps2: number;
  distanceToTargetM?: number;
  timeToTargetS?: number;
  targetBodyId?: string;
  /** The engaged warp step, counting from 1; zero is off. */
  warpStep: number;
  phase: 'idle' | 'align' | 'acceleration' | 'cruise' | 'braking' | 'capture' | 'approach' | 'arrived'
    | 'landing-capture' | 'landing-hold';
  autopilotActive?: boolean;
  relativeSpeedMps?: number;
  closingSpeedMps?: number;
  alignment?: number;
  stoppingDistanceM?: number;
  arrivalRadiusM?: number;
  effectiveSpeedCapMps?: number;
}

export interface CosmicCruiseContext extends TravelContext {
  targetCanLand?: boolean;
  targetSurfaceClearanceM?: number;
  targetSurfaceReady?: boolean;
  returnAltitudeM?: number;
  /**
   * The player pressed F near a landable body. While set, this controller owns the final
   * capture: manual thrust, warp and autopilot are ignored and the relative velocity is braked
   * toward the body's own, so there is exactly one velocity controller.
   */
  landingIntent?: LandingIntentContext;
  /** Live exclusion spheres for all bodies, so an unselected giant cannot be crossed at warp. */
  exclusionEnvelopes?: readonly BodyExclusionEnvelope[];
  /** Resolved live, in barycentric metres. Absent when nothing is selected. */
  target?: ResolvedTarget;
  /**
   * Where the camera looks, **in `solar-system/barycentric`**.
   *
   * The name says the frame because getting this wrong is silent: a render-space vector dotted
   * with a barycentric direction produces a number, and the number is meaningless.
   */
  cameraForwardBary: Vector3;
  /** True while the player is asking for boost *and* giving a forward intent. */
  inputBoost: boolean;
  inputBrake: boolean;
  /**
   * Which warp step is engaged, counting from 1. Zero is off.
   *
   * When set, it overrides the cruise's own speed plan: the player has said how fast they want to
   * go and the assistance's job becomes pointing them at the target, not rationing the throttle.
   */
  warpStep?: number;
}

function finite(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Metres per second. The one constant nothing here is allowed to round. */
export const LIGHT_SPEED_MPS = 299_792_458;

/**
 * Warp: the player's own faster-than-light gear, in multiples of `c`.
 *
 * Each press of the warp key doubles it -- 1c, 2c, 4c, 8c -- which is the only way a solar system
 * crossing is a journey rather than a wait. At 1c the Moon is 1.3 seconds away and Neptune is four
 * hours; at 64c Neptune is four minutes.
 *
 * It lives here and not in `FLIGHT.speeds` on purpose. A speed like this cannot share a `Vector3`
 * with collision sweeps, building queries and actor simulation -- that is the whole reason the
 * travel domain exists, and putting a warp factor into the local flight config would undo it.
 */
export const WARP_STEPS_C = [1, 2, 4, 8, 16, 32, 64, 128, 256] as const;
/** How long the warp takes to reach its set speed. Short, because waiting to go fast is not fun. */
export const WARP_SPOOL_S = 1.2;

/** The speed a warp step means, metres per second. Step 0 is off. */
export function warpSpeedMps(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const index = Math.min(WARP_STEPS_C.length, Math.round(step)) - 1;
  return WARP_STEPS_C[index] * LIGHT_SPEED_MPS;
}

/** The label the HUD shows for a step: `2c`, `64c`, or nothing when the gear is off. */
export function warpLabel(step: number): string {
  const speed = warpSpeedMps(step);
  if (!(speed > 0)) return '';
  const index = Math.min(WARP_STEPS_C.length, Math.round(step)) - 1;
  return `${WARP_STEPS_C[index]}c`;
}

/** Manual thrust outside the cruise assistance, metres per second squared. */
export const BASE_THRUST_ACCEL = 50_000;
/** The space brake's floor. Scales up with speed so stopping never takes longer than starting. */
export const BASE_BRAKE_ACCEL = 100_000;
/** Seconds the assistance aims to take, whatever the distance. */
export const CRUISE_MIN_SECONDS = 6;
export const CRUISE_MAX_SECONDS = 25;
/** Cosine of the half-angle within which the assistance engages. */
export const CRUISE_ALIGNMENT_THRESHOLD = 0.5;

/**
 * How fast the gap to a point is closing, metres per second.
 *
 * Positive when approaching. The sign is the whole function: the previous code negated this and
 * then required it to be positive before computing an ETA, so flying correctly at a target
 * produced no ETA at all and flying away from it produced one.
 */
export function radialApproachSpeed(
  fromTo: readonly [number, number, number],
  relativeVelocity: readonly [number, number, number],
): number {
  const distance = Math.hypot(finite(fromTo[0]), finite(fromTo[1]), finite(fromTo[2]));
  if (!(distance > 0)) return 0;
  const dot = finite(fromTo[0]) * finite(relativeVelocity[0])
    + finite(fromTo[1]) * finite(relativeVelocity[1])
    + finite(fromTo[2]) * finite(relativeVelocity[2]);
  return dot / distance;
}

/**
 * The acceleration a trip of this length is flown at, metres per second squared.
 *
 * Accelerate for half the distance and brake for the other half: `d/2 = ½at²` with `t = T/2`
 * gives `a = 4d/T²`. The same number is used for braking, which is the point — the previous model
 * accelerated at tens of millions of metres per second squared and then computed its stopping
 * distance against a fixed hundred thousand, so it planned to brake with a hundredth of the
 * engine it had just used and sailed past everything.
 */
export function cruiseAccelerationMps2(remainingDistanceM: number, tripSecondsS: number): number {
  const distance = Math.max(0, finite(remainingDistanceM));
  const seconds = Math.max(0.5, finite(tripSecondsS, CRUISE_MIN_SECONDS));
  return Math.max(BASE_THRUST_ACCEL, (4 * distance) / (seconds * seconds));
}

/** How long the assistance should take over a trip of this length. */
export function cruiseSecondsFor(remainingDistanceM: number): number {
  const distance = Math.max(0, finite(remainingDistanceM));
  // A hundred million metres per second of trip, bounded: the Moon stays seconds, Neptune stays
  // tens of seconds, and nothing is ever instantaneous.
  return Math.max(CRUISE_MIN_SECONDS, Math.min(CRUISE_MAX_SECONDS, distance / 100_000_000));
}

/** A sphere the flight must not pass through. */
interface Obstacle {
  readonly captureRadiusM?: number;
  readonly bodyId?: string;
  readonly velocityMps?: readonly [number, number, number];
  readonly centreM: readonly [number, number, number];
  readonly radiusM: number;
}

/**
 * Where along a segment it first enters a sphere, or `undefined` when it never does.
 *
 * Exported because it is the part that has to be right: a frame at cosmic speed is longer than
 * the Moon is wide, so a test that only looks at the endpoints misses the body entirely.
 */
export function sweepSegmentSphere(
  fromM: readonly [number, number, number],
  stepM: readonly [number, number, number],
  centreM: readonly [number, number, number],
  radiusM: number,
): number | undefined {
  const ox = finite(fromM[0]) - finite(centreM[0]);
  const oy = finite(fromM[1]) - finite(centreM[1]);
  const oz = finite(fromM[2]) - finite(centreM[2]);
  const dx = finite(stepM[0]), dy = finite(stepM[1]), dz = finite(stepM[2]);
  const radius = Math.max(0, finite(radiusM));
  if (!(radius > 0)) return undefined;

  const a = dx * dx + dy * dy + dz * dz;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;

  // Already inside: the segment does not need to enter what it never left.
  if (c <= 0) return 0;
  if (a <= 1e-9) return undefined;

  // Equivalent quadratic, measured along the normalized segment. Avoid subtracting two
  // astronomical squared terms: a tiny moon must remain detectable at the 256c gear.
  const length = Math.sqrt(a), ux = dx / length, uy = dy / length, uz = dz / length;
  const along = -(ox * ux + oy * uy + oz * uz);
  const px = ox + ux * along, py = oy + uy * along, pz = oz + uz * along;
  const perpendicularSquared = px * px + py * py + pz * pz;
  if (perpendicularSquared >= radius * radius) return undefined; // Touching a tangent is not entry.
  const t = (along - Math.sqrt(radius * radius - perpendicularSquared)) / length;
  return t >= 0 && t <= 1 ? t : undefined;
}

export class CosmicCruiseController {
  readonly autopilot = new AutopilotCapture();
  private lastContact?: CelestialContact;
  get lastCelestialContact(): CelestialContact | undefined { return this.lastContact; }
  private telemetry: FlightTelemetry = { speedMps: 0, accelerationMps2: 0, warpStep: 0, phase: 'idle' };

  getTelemetry(): Readonly<FlightTelemetry> { return this.telemetry; }

  update(
    state: InterplanetaryState,
    dtS: number,
    thrustDirectionBary: Vector3,
    context: CosmicCruiseContext,
  ): InterplanetaryState {
    const dt = Math.max(0, Math.min(0.25, finite(dtS)));
    const positionM: [number, number, number] = [
      finite(state.positionM[0]), finite(state.positionM[1]), finite(state.positionM[2]),
    ];
    const velocityMps: [number, number, number] = [
      finite(state.velocityMps[0]), finite(state.velocityMps[1]), finite(state.velocityMps[2]),
    ];

    const candidate = context.target;
    const target = candidate && candidate.positionM.every(Number.isFinite)
      && Number.isFinite(candidate.radiusM) && candidate.radiusM > 0
      && Number.isFinite(candidate.arrivalMarginM) && candidate.arrivalMarginM >= 0
      && (!candidate.velocityMps || candidate.velocityMps.every(Number.isFinite)) ? candidate : undefined;
    if (!target && this.autopilot.active) this.autopilot.cancel();
    const assisted = this.autopilot.active;
    const bodyVel: readonly [number, number, number] = assisted ? (target?.velocityMps ?? [0, 0, 0]) : context.bodyVelocityMps
      ? [finite(context.bodyVelocityMps[0]), finite(context.bodyVelocityMps[1]), finite(context.bodyVelocityMps[2])]
      : [0, 0, 0];

    // Everything the player feels is relative to the body they are near. Braking to a stop means
    // matching the Earth, not stopping dead with respect to the Sun.
    const relVel: [number, number, number] = [
      velocityMps[0] - bodyVel[0], velocityMps[1] - bodyVel[1], velocityMps[2] - bodyVel[2],
    ];

    let acceleration = 0;
    let phase: FlightTelemetry['phase'] = 'idle';
    const margin = finite(context.envelopeMarginM, 1000);

    const warpSpeed = warpSpeedMps(finite(context.warpStep));
    const toTarget: [number, number, number] = target
      ? [
        finite(target.positionM[0]) - positionM[0],
        finite(target.positionM[1]) - positionM[1],
        finite(target.positionM[2]) - positionM[2],
      ]
      : [0, 0, 0];
    const distanceToTarget = target ? Math.hypot(toTarget[0], toTarget[1], toTarget[2]) : 0;
    const arrivalRadius = target ? target.radiusM + target.arrivalMarginM : 0;
    const remainingDistance = target ? Math.max(0, distanceToTarget - arrivalRadius) : 0;

    const landing = context.landingIntent && context.landingIntent.centreM.every(Number.isFinite)
      && context.landingIntent.velocityMps.every(Number.isFinite) ? context.landingIntent : undefined;
    if (landing) {
      // Landing capture owns the velocity. Autopilot would be a second controller fighting it.
      if (this.autopilot.active) this.autopilot.cancel();
      const rel: [number, number, number] = [velocityMps[0] - landing.velocityMps[0],
        velocityMps[1] - landing.velocityMps[1], velocityMps[2] - landing.velocityMps[2]];
      const offset: [number, number, number] = [positionM[0] - landing.centreM[0],
        positionM[1] - landing.centreM[1], positionM[2] - landing.centreM[2]];
      const step = landingCaptureStep(rel, offset, landing.clearanceM, landing.surfaceReady,
        landing.returnAltitudeM, dt);
      for (let i = 0; i < 3; i++) {
        velocityMps[i] = landing.velocityMps[i] + rel[i];
        relVel[i] = velocityMps[i] - bodyVel[i];
      }
      acceleration = step.accelerationMps2;
      phase = step.phase === 'hold' ? 'landing-hold' : 'landing-capture';
    } else if (context.inputBrake && assisted) this.autopilot.cancel();
    if (landing) {
      // Handled above.
    } else if (assisted && !context.inputBrake) {
      acceleration = this.autopilot.update(positionM, velocityMps, dt, context, warpSpeed);
      for (let i=0;i<3;i++) relVel[i] = velocityMps[i] - bodyVel[i];
      phase = this.autopilot.phase;
    } else if (context.inputBrake) {
      phase = 'braking';
      acceleration = -this.applyBrake(relVel, BASE_BRAKE_ACCEL, dt);
    } else if (context.inputBoost && target && remainingDistance > 0) {
      const dirToTarget = toTarget[0] || toTarget[1] || toTarget[2]
        ? new Vector3(toTarget[0], toTarget[1], toTarget[2]).normalize()
        : new Vector3();
      // Both vectors are barycentric. See `cameraForwardBary`.
      const alignment = context.cameraForwardBary.dot(dirToTarget);

      if (alignment < CRUISE_ALIGNMENT_THRESHOLD) {
        phase = 'align';
      } else {
        const tripSeconds = cruiseSecondsFor(remainingDistance);
        // With warp engaged the player has already said how fast they want to go, so the trip
        // plan stops rationing the throttle and only decides when to start braking.
        const cruiseAccel = warpSpeed > 0
          ? warpSpeed / WARP_SPOOL_S
          : cruiseAccelerationMps2(remainingDistance, tripSeconds);
        // Closing speed, not total speed: a sideways drift must not be mistaken for progress.
        const closingSpeed = radialApproachSpeed(toTarget, relVel);
        // The same acceleration is available to stop as to start, which is what makes the plan a
        // plan. Half the remaining distance is held back as margin against the ephemeris moving
        // the target while the burn is under way.
        const stoppingDistance = closingSpeed > 0
          ? (closingSpeed * closingSpeed) / (2 * cruiseAccel)
          : 0;

        if (stoppingDistance >= remainingDistance * 0.5) {
          phase = 'braking';
          acceleration = -this.applyBrake(relVel, cruiseAccel, dt);
        } else {
          phase = 'acceleration';
          acceleration = cruiseAccel * alignment;
          relVel[0] += dirToTarget.x * acceleration * dt;
          relVel[1] += dirToTarget.y * acceleration * dt;
          relVel[2] += dirToTarget.z * acceleration * dt;
        }
      }
    } else if (thrustDirectionBary.lengthSq() > 0.01) {
      phase = 'acceleration';
      // Warp sets the throttle; without it, the manual thrust is what it has always been.
      acceleration = warpSpeed > 0 ? warpSpeed / WARP_SPOOL_S : BASE_THRUST_ACCEL;
      relVel[0] += finite(thrustDirectionBary.x) * acceleration * dt;
      relVel[1] += finite(thrustDirectionBary.y) * acceleration * dt;
      relVel[2] += finite(thrustDirectionBary.z) * acceleration * dt;
    }

    // The gear the player selected is the ceiling, not the default half-million.
    const maxRelative = warpSpeed > 0
      ? warpSpeed
      : Math.max(0, finite(context.maxRelativeSpeedMps, 500_000_000));
    const relSpeed = Math.hypot(relVel[0], relVel[1], relVel[2]);
    if (!assisted && relSpeed > maxRelative && relSpeed > 0) {
      const scale = maxRelative / relSpeed;
      relVel[0] *= scale; relVel[1] *= scale; relVel[2] *= scale;
    }

    velocityMps[0] = bodyVel[0] + relVel[0];
    velocityMps[1] = bodyVel[1] + relVel[1];
    velocityMps[2] = bodyVel[2] + relVel[2];

    const step: [number, number, number] = [
      velocityMps[0] * dt, velocityMps[1] * dt, velocityMps[2] * dt,
    ];

    /**
     * Everything solid the step could pass through.
     *
     * Both the body the player is near *and* the one they are flying at. Testing only the
     * dominant body is what let a flight from Earth to the Moon cross the Moon entirely between
     * two frames: while Earth is still dominant, the Moon is not in the list at all.
     */
    const obstacles: Obstacle[] = [...(context.exclusionEnvelopes ?? [])];
    if (context.bodyPositionM && !obstacles.some(obstacle => obstacle.bodyId === context.bodyId)) {
      obstacles.push({
        bodyId: context.bodyId, velocityMps: context.bodyVelocityMps,
        centreM: context.bodyPositionM,
        radiusM: finite(context.bodyRadiusM) + margin,
      });
    }
    if (target && target.bodyId !== context.bodyId && !obstacles.some(obstacle => obstacle.bodyId === target.bodyId)) {
      obstacles.push({ bodyId: target.bodyId, velocityMps: target.velocityMps,
        centreM: target.positionM, radiusM: target.radiusM + target.arrivalMarginM });
    }
    if (landing && !obstacles.some(obstacle => obstacle.bodyId === landing.bodyId)) {
      obstacles.push({ bodyId: landing.bodyId, velocityMps: landing.velocityMps,
        centreM: landing.centreM, radiusM: landing.radiusM + margin });
    }

    let earliest: { fraction: number; obstacle: Obstacle } | undefined;
    for (const envelope of obstacles) {
      const orbital = envelope.velocityMps ?? (envelope.bodyId === context.bodyId ? bodyVel : [0, 0, 0]);
      const speed = Math.hypot(velocityMps[0]-orbital[0],velocityMps[1]-orbital[1],velocityMps[2]-orbital[2]);
      // Decide after thrust/warp acceleration. A previously slow player must not shrink
      // the broad envelope on the same frame in which a cosmic gear accelerates them.
      const radiusM = envelope.captureRadiusM !== undefined && speed <=
        (context.maxLocalTerrainSweepMps ?? LANDING_SPEED_LIMITS.maxLocalTerrainSweepMps)
        ? envelope.captureRadiusM : envelope.radiusM;
      const obstacle = radiusM === envelope.radiusM ? envelope : { ...envelope, radiusM };
      const relativeStep: [number, number, number] = [step[0] - orbital[0] * dt,
        step[1] - orbital[1] * dt, step[2] - orbital[2] * dt];
      // Inside an approach envelope, outward motion remains possible. Inward motion is clamped.
      const offset: [number, number, number] = [positionM[0] - obstacle.centreM[0],
        positionM[1] - obstacle.centreM[1], positionM[2] - obstacle.centreM[2]];
      if (Math.hypot(...offset) <= obstacle.radiusM &&
        offset[0] * relativeStep[0] + offset[1] * relativeStep[1] + offset[2] * relativeStep[2] > 0) continue;
      const hit = sweepSegmentSphere(positionM, relativeStep, obstacle.centreM, obstacle.radiusM);
      if (hit === undefined) continue;
      if (!earliest || hit < earliest.fraction) earliest = { fraction: hit, obstacle };
    }

    if (earliest) {
      // Stop short of the surface rather than on it, and never at the centre.
      const obstacle = earliest.obstacle;
      const orbital = obstacle.velocityMps ?? (obstacle.bodyId === context.bodyId ? bodyVel : [0, 0, 0]);
      const hitCentre: [number, number, number] = [obstacle.centreM[0] + orbital[0] * dt * earliest.fraction,
        obstacle.centreM[1] + orbital[1] * dt * earliest.fraction,
        obstacle.centreM[2] + orbital[2] * dt * earliest.fraction];
      const hitPosition: [number, number, number] = [positionM[0] + step[0] * earliest.fraction,
        positionM[1] + step[1] * earliest.fraction, positionM[2] + step[2] * earliest.fraction];
      const contactRelative: [number, number, number] = [velocityMps[0] - orbital[0],
        velocityMps[1] - orbital[1], velocityMps[2] - orbital[2]];
      const offset = hitPosition.map((value, i) => value - hitCentre[i]);
      const distance = Math.hypot(...offset) || 1;
      const assistedContact = (assisted || (context.isAssistedTarget ?? context.inputBoost)) && target?.bodyId === obstacle.bodyId;
      // Only a request to land, or an assisted capture of a landable target, is a capture. Anything
      // else is a graze. `future-catastrophic` is reserved and deliberately never chosen here.
      const responseMode: ContactResponseMode = landing?.bodyId === obstacle.bodyId
        || (assistedContact && context.targetCanLand === true) ? 'landing-capture' : 'graze';
      this.lastContact = { bodyId: obstacle.bodyId ?? context.bodyId ?? 'unknown', fraction: earliest.fraction,
        contactPositionM: hitPosition, relativeSpeedMps: Math.hypot(...contactRelative),
        radialSpeedMps: contactRelative.reduce((sum, value, i) => sum + value * offset[i] / distance, 0),
        assisted: assistedContact, responseMode, responseRadialSpeedMps: 0, responseTangentialSpeedMps: 0 };
      const relativeStepLength = Math.hypot(...contactRelative) * dt;
      const fraction = Math.max(0, earliest.fraction - 1 / Math.max(1, relativeStepLength));
      positionM[0] += step[0] * fraction;
      positionM[1] += step[1] * fraction;
      positionM[2] += step[2] * fraction;
      // The ephemeris still advances for the whole frame after motion clamping. Carry the
      // arrested player with the contacted body for the unused time, rather than let it overrun us.
      const finalCentre: [number, number, number] = [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        positionM[i] += orbital[i] * dt * (1 - fraction);
        finalCentre[i] = obstacle.centreM[i] + orbital[i] * dt;
      }
      const outward: [number, number, number] = [positionM[0] - finalCentre[0], positionM[1] - finalCentre[1],
        positionM[2] - finalCentre[2]];
      const outwardLength = Math.hypot(...outward);
      const normal: [number, number, number] = outwardLength > 0
        ? [outward[0] / outwardLength, outward[1] / outwardLength, outward[2] / outwardLength] : [0, 1, 0];
      const response = resolveCelestialContact(responseMode, contactRelative, normal);
      this.lastContact = { ...this.lastContact, responseRadialSpeedMps: response.radialSpeedMps,
        responseTangentialSpeedMps: response.tangentialSpeedMps };
      for (let i = 0; i < 3; i++) {
        velocityMps[i] = orbital[i] + contactRelative[i];
        relVel[i] = velocityMps[i] - bodyVel[i];
      }
      if (phase !== 'braking') phase = 'approach';
    } else {
      positionM[0] += step[0];
      positionM[1] += step[1];
      positionM[2] += step[2];
    }

    this.telemetry.targetBodyId = target?.bodyId;
    if (target) {
      const after: [number, number, number] = [
        finite(target.positionM[0]) - positionM[0],
        finite(target.positionM[1]) - positionM[1],
        finite(target.positionM[2]) - positionM[2],
      ];
      const gap = Math.max(0, Math.hypot(after[0], after[1], after[2]) - arrivalRadius);
      this.telemetry.distanceToTargetM = gap;
      const relative: [number,number,number] = [velocityMps[0]-(target.velocityMps?.[0]??0),
        velocityMps[1]-(target.velocityMps?.[1]??0),velocityMps[2]-(target.velocityMps?.[2]??0)];
      const closing = radialApproachSpeed(after, relative);
      this.telemetry.relativeSpeedMps = Math.hypot(...relative);
      this.telemetry.closingSpeedMps = closing;
      this.telemetry.alignment = distanceToTarget > 0 ? (context.cameraForwardBary.x * toTarget[0]
        + context.cameraForwardBary.y * toTarget[1] + context.cameraForwardBary.z * toTarget[2]) / distanceToTarget : 0;
      // Finite only while actually approaching, which is now the case when the player is flying
      // at the target rather than away from it.
      this.telemetry.timeToTargetS = closing > 0 ? gap / closing : undefined;
    } else {
      this.telemetry.distanceToTargetM = undefined;
      this.telemetry.timeToTargetS = undefined;
      this.telemetry.relativeSpeedMps = undefined;
      this.telemetry.closingSpeedMps = undefined;
      this.telemetry.alignment = undefined;
    }

    this.telemetry.autopilotActive = this.autopilot.active;
    this.telemetry.stoppingDistanceM = this.autopilot.stoppingDistanceM;
    this.telemetry.arrivalRadiusM = this.autopilot.arrivalRadiusM;
    this.telemetry.effectiveSpeedCapMps = this.autopilot.effectiveSpeedCapMps;
    this.telemetry.speedMps = Math.hypot(relVel[0], relVel[1], relVel[2]);
    this.telemetry.accelerationMps2 = acceleration;
    this.telemetry.phase = phase;
    this.telemetry.warpStep = Math.max(0, Math.round(finite(context.warpStep)));

    return {
      systemId: state.systemId,
      positionM,
      velocityMps,
      referenceBodyId: state.referenceBodyId,
    };
  }

  /** Sheds relative speed at `capabilityMps2`, never below zero. Returns what was applied. */
  private applyBrake(relVel: [number, number, number], capabilityMps2: number, dt: number): number {
    const speed = Math.hypot(relVel[0], relVel[1], relVel[2]);
    if (!(speed > 0)) return 0;
    // Never slower than the speed itself demands: a brake weaker than the engine is not a brake.
    const accel = Math.max(BASE_BRAKE_ACCEL, capabilityMps2, speed * 2.5);
    const factor = Math.max(0, speed - accel * dt) / speed;
    relVel[0] *= factor; relVel[1] *= factor; relVel[2] *= factor;
    return accel;
  }
}
