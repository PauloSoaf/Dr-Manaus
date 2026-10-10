import { finite, type Vec3 } from '../spatial/units';
import { LANDING_SPEED_LIMITS, landingCaptureGate } from './LandingCapture';

/**
 * Which simulation the player is in: the city, or the space between planets.
 *
 * The rule this exists to enforce is the one at the top of the architecture — the logical world
 * may be enormous, the local physics may not. A speed that crosses a solar system cannot share a
 * `Vector3` with collision sweeps, building queries and actor simulation: at 222 km/s a frame
 * covers thirteen kilometres, and a continuous sweep over thirteen kilometres of city is either
 * wrong or ruinous.
 *
 * So there are two domains and the player is in exactly one. Local is the game that already
 * exists. Interplanetary is a different simulation with different rules: float64 position, no
 * urban physics, and collision reduced to an altitude envelope around whichever body is nearest.
 *
 * Nothing here imports Three.js or touches the scene. It decides *which* simulation should be
 * running and holds the state of the one the renderer cannot express, and it is tested as
 * arithmetic.
 */

export type TravelDomainKind = 'local' | 'interplanetary';

/** The interplanetary domain's whole state. Float64 throughout: this is the logical position. */
export interface InterplanetaryState {
  readonly systemId: string;
  /** Metres in the system frame. */
  readonly positionM: Vec3;
  readonly velocityMps: Vec3;
  /** The body the envelope is measured against, when there is one. */
  readonly referenceBodyId?: string;
}

/** What the domain needs to know each frame to decide where the player belongs. */
export interface TravelContext {
  /** Height above the reference body's surface, metres. */
  readonly altitudeM: number;
  /** The player's current speed, metres per second. */
  readonly speedMps: number;
  /** Whether the interplanetary tier is armed *and* the player is asking for it. */
  readonly requested: boolean;
  /**
   * Distance to the nearest local collider, metres; `Infinity` when there is none.
   *
   * The specification asks for this by name. Leaving the local domain while there is still
   * something to hit means the thing to hit stops existing mid-collision.
   */
  readonly nearestColliderM: number;
  /** The reference body's radius toward the player, metres. */
  readonly bodyRadiusM: number;
  readonly bodyPositionM?: Vec3;
  readonly bodyVelocityMps?: Vec3;
  readonly bodyId?: string;
  readonly systemId?: string;
  readonly envelopeMarginM?: number;
  readonly maxRelativeSpeedMps?: number;
  /** A supported ground provider must cover the landing site before local physics can resume. */
  readonly surfaceReady?: boolean;
  readonly radialSpeedMps?: number;
  readonly tangentialSpeedMps?: number;
  readonly isAssistedTarget?: boolean;
  readonly maxLocalTerrainSweepMps?: number;
  /**
   * Where the player is, in `solar-system/barycentric` metres, for the moment of departure.
   *
   * Without it the domain had to invent a position, and what it invented was
   * `[0, bodyRadius + altitude, 0]` -- a position measured from the Earth's centre, handed to a
   * system that reads it as barycentric. The barycentre is the Sun, so entering interplanetary
   * flight put the player a few thousand kilometres from the Sun's surface: the Sun filled the
   * sky, the Earth and Moon were an astronomical unit away, and the navigation readout quite
   * correctly said deep space.
   */
  readonly entryPositionM?: Vec3;
  /** The player's barycentric velocity at departure, so the Earth's orbital motion is kept. */
  readonly entryVelocityMps?: Vec3;
}

export interface TravelDomainOptions {
  approachCaptureSpeedMps?: number;
  localHandoffSpeedMps?: number;
  maxLocalTerrainSweepMps?: number;
  /** No transition below this altitude, whatever else is true. */
  entryAltitudeM?: number;
  /** Altitude below which the player may return to local simulation. */
  returnAltitudeM?: number;
  /** Legacy alias for entryAltitudeM */
  safeAltitudeM?: number;
  /** A collider nearer than this keeps the player local. */
  colliderClearanceM?: number;
  /** Below or equal to this relative speed, returning to local physics is safe. */
  maxLocalReturnSpeedMps?: number;
  /** Deprecated alias */
  minTravelSpeedMps?: number;
  /** How close to the surface the envelope allows before it pushes back. */
  envelopeMarginM?: number;
}

const DEFAULTS: Required<TravelDomainOptions> = {
  ...LANDING_SPEED_LIMITS,
  entryAltitudeM: 9_000,
  returnAltitudeM: 7_000,
  safeAltitudeM: 9_000,
  colliderClearanceM: 2_000,
  maxLocalReturnSpeedMps: LANDING_SPEED_LIMITS.maxLocalTerrainSweepMps,
  minTravelSpeedMps: 2_000,
  envelopeMarginM: 1_000,
};

/** Why the domain did or did not change, so a transition is never a mystery in a log. */
export type TravelTransition =
  | { kind: 'none' }
  | { kind: 'departed'; reason: 'requested' }
  | { kind: 'refused'; reason: 'altitude' | 'collider' | 'speed' }
  | { kind: 'returned'; reason: 'altitude' | 'speed' | 'released' };

export class TravelDomain {
  private current: TravelDomainKind = 'local';
  private travel?: InterplanetaryState;
  private readonly options: Required<TravelDomainOptions>;
  private lastTransition: TravelTransition = { kind: 'none' };
  private returnBlockedReason: 'local' | ReturnType<typeof landingCaptureGate> = 'local';

  constructor(options: TravelDomainOptions = {}) {
    const entryAlt = options.entryAltitudeM ?? options.safeAltitudeM ?? DEFAULTS.entryAltitudeM;
    const returnAlt = options.returnAltitudeM ?? Math.min(entryAlt - 2000, DEFAULTS.returnAltitudeM);
    const maxReturnSpeed = options.maxLocalReturnSpeedMps ?? DEFAULTS.maxLocalReturnSpeedMps;

    this.options = {
      approachCaptureSpeedMps: Math.max(0, finite(options.approachCaptureSpeedMps, DEFAULTS.approachCaptureSpeedMps)),
      localHandoffSpeedMps: Math.max(0, finite(options.localHandoffSpeedMps, DEFAULTS.localHandoffSpeedMps)),
      maxLocalTerrainSweepMps: Math.max(0, finite(options.maxLocalTerrainSweepMps ?? maxReturnSpeed, DEFAULTS.maxLocalTerrainSweepMps)),
      entryAltitudeM: Math.max(0, finite(entryAlt, DEFAULTS.entryAltitudeM)),
      returnAltitudeM: Math.max(0, finite(returnAlt, DEFAULTS.returnAltitudeM)),
      safeAltitudeM: Math.max(0, finite(entryAlt, DEFAULTS.safeAltitudeM)),
      colliderClearanceM: Math.max(0, finite(options.colliderClearanceM, DEFAULTS.colliderClearanceM)),
      maxLocalReturnSpeedMps: Math.max(0, finite(maxReturnSpeed, DEFAULTS.maxLocalReturnSpeedMps)),
      minTravelSpeedMps: Math.max(0, finite(options.minTravelSpeedMps, DEFAULTS.minTravelSpeedMps)),
      envelopeMarginM: Math.max(0, finite(options.envelopeMarginM, DEFAULTS.envelopeMarginM)),
    };
  }

  get kind(): TravelDomainKind { return this.current; }
  get isTravelling(): boolean { return this.current === 'interplanetary'; }
  get state(): InterplanetaryState | undefined { return this.travel; }
  get transition(): TravelTransition { return this.lastTransition; }
  get landingGate() {
    return { returnAltitudeM: this.options.returnAltitudeM, maxRelativeSpeedMps: this.options.maxLocalReturnSpeedMps,
      approachCaptureSpeedMps: this.options.approachCaptureSpeedMps,
      localHandoffSpeedMps: this.options.localHandoffSpeedMps,
      maxLocalTerrainSweepMps: this.options.maxLocalTerrainSweepMps,
      entryAltitudeM: this.options.entryAltitudeM, blockedReason: this.returnBlockedReason };
  }

  /**
   * Whether the local simulation should run this frame.
   *
   * The single question Game needs answered. While travelling, colliders are not gathered, actors
   * are not stepped and the terrain is not queried — not as an optimisation, but because none of
   * them mean anything thirteen kilometres per frame above the atmosphere.
   */
  get localPhysicsActive(): boolean { return this.current === 'local'; }

  /**
   * Decides the domain for this frame and advances the travel state when there is one.
   *
   * Returns what happened. A refusal carries its reason, because "the key did nothing" is the
   * least debuggable sentence in a game.
   */
  update(context: TravelContext, dtS: number): TravelTransition {
    const dt = Math.max(0, Math.min(0.25, finite(dtS)));
    this.lastTransition = this.current === 'local'
      ? this.considerEntering(context)
      : this.considerReturning(context);
    // advance() is now handled externally by InterplanetaryController
    return this.lastTransition;
  }

  private considerEntering(context: TravelContext): TravelTransition {
    if (!context.requested) return { kind: 'none' };
    // Every gate the specification names, checked in the order that makes the reason useful.
    if (finite(context.altitudeM) < this.options.entryAltitudeM) return { kind: 'refused', reason: 'altitude' };
    if (finite(context.nearestColliderM, Infinity) < this.options.colliderClearanceM) {
      return { kind: 'refused', reason: 'collider' };
    }
    this.current = 'interplanetary';
    const entry = context.entryPositionM;
    const entryVelocity = context.entryVelocityMps ?? context.bodyVelocityMps;
    this.travel = {
      systemId: context.systemId ?? 'sol',
      // The caller's real barycentric position. The fallback is the body's own surface along +Y,
      // which is wrong but bounded; see `entryPositionM` for what happened when it was the only
      // option.
      positionM: entry
        ? [finite(entry[0]), finite(entry[1]), finite(entry[2])]
        : [0, finite(context.bodyRadiusM) + finite(context.altitudeM), 0],
      // Departing must not cancel the body's orbital motion: standing still relative to the Earth
      // is thirty kilometres a second relative to the Sun, and zeroing it is a shove.
      velocityMps: entryVelocity
        ? [finite(entryVelocity[0]), finite(entryVelocity[1]), finite(entryVelocity[2])]
        : [0, 0, 0],
      referenceBodyId: context.bodyId,
    };
    return { kind: 'departed', reason: 'requested' };
  }

  private considerReturning(context: TravelContext): TravelTransition {
    // Releasing requested (e.g. B key) does NOT return to local: the player coasts in space.
    // Returning to local only occurs when the player approaches a body and reaches safe altitude AND safe relative speed.
    this.returnBlockedReason = landingCaptureGate({ bodyId: context.bodyId,
      isAssistedTarget: context.isAssistedTarget, clearanceM: context.altitudeM,
      relativeSpeedMps: context.speedMps,
      // Legacy callers without a normal are conservatively treated as direct descent.
      radialSpeedMps: context.radialSpeedMps ?? -context.speedMps,
      tangentialSpeedMps: context.tangentialSpeedMps, surfaceReady: context.surfaceReady === true,
    }, this.options);
    if (this.returnBlockedReason !== 'ready') return { kind: 'none' };

    this.toLocal();
    return { kind: 'returned', reason: 'altitude' };
  }

  private toLocal(): void {
    this.current = 'local';
    this.travel = undefined;
  }


  /** Replaces the travel state, for a caller that knows the real system position and heading. */
  setState(state: InterplanetaryState): void {
    if (this.current !== 'interplanetary') return;
    this.travel = {
      systemId: state.systemId,
      positionM: [finite(state.positionM[0]), finite(state.positionM[1]), finite(state.positionM[2])],
      velocityMps: [finite(state.velocityMps[0]), finite(state.velocityMps[1]), finite(state.velocityMps[2])],
      referenceBodyId: state.referenceBodyId,
    };
  }

  /** Forces the local domain, for a teleport or a load. */
  enterSystem(state: InterplanetaryState): void {
    this.current = 'interplanetary';
    this.lastTransition = {kind:'none'};
    this.setState(state);
  }

  /** Explicit QA compatibility alias; production uses enterSystem. */
  testArrival(state:InterplanetaryState):void {this.enterSystem(state);}
  reset(): void {
    this.toLocal();
    this.lastTransition = { kind: 'none' };
    this.returnBlockedReason = 'local';
  }
}
