import { finite, type Vec3 } from '../spatial/units';

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
}

export interface TravelDomainOptions {
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
  entryAltitudeM: 9_000,
  returnAltitudeM: 7_000,
  safeAltitudeM: 9_000,
  colliderClearanceM: 2_000,
  maxLocalReturnSpeedMps: 10_000,
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

  constructor(options: TravelDomainOptions = {}) {
    const entryAlt = options.entryAltitudeM ?? options.safeAltitudeM ?? DEFAULTS.entryAltitudeM;
    const returnAlt = options.returnAltitudeM ?? Math.min(entryAlt - 2000, DEFAULTS.returnAltitudeM);
    const maxReturnSpeed = options.maxLocalReturnSpeedMps ?? DEFAULTS.maxLocalReturnSpeedMps;

    this.options = {
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
    this.travel = {
      systemId: context.systemId ?? 'sol',
      // Altitude above the body is all the local frame can tell us; the caller replaces this with
      // a real system position when it has one.
      positionM: [0, finite(context.bodyRadiusM) + finite(context.altitudeM), 0],
      velocityMps: [0, 0, 0],
      referenceBodyId: context.bodyId,
    };
    return { kind: 'departed', reason: 'requested' };
  }

  private considerReturning(context: TravelContext): TravelTransition {
    // Releasing requested (e.g. B key) does NOT return to local: the player coasts in space.
    // Returning to local only occurs when the player approaches a body and reaches safe altitude AND safe relative speed.
    const alt = finite(context.altitudeM);
    const speed = finite(context.speedMps);

    if (alt <= this.options.returnAltitudeM && speed <= this.options.maxLocalReturnSpeedMps) {
      this.toLocal();
      return { kind: 'returned', reason: 'altitude' };
    }
    return { kind: 'none' };
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
  reset(): void {
    this.toLocal();
    this.lastTransition = { kind: 'none' };
  }
}
