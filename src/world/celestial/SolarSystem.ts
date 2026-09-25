import { referenceFrame } from '../spatial/ReferenceFrame';
import type { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import { addVec3, cloneVec3, finite, lengthVec3, type Vec3 } from '../spatial/units';
import {
  type CelestialBody, SOLAR_SYSTEM_BODIES, bodyById, gravitationalParameter,
} from './CelestialBody';
import type { EphemerisProvider } from './EphemerisProvider';
import { OfflineEphemeris } from './OfflineEphemeris';

export const SOLAR_SYSTEM_FRAME = 'solar-system/barycentric';

/**
 * Radius of a body's ellipsoid toward a direction, from that direction's polar component:
 * `R = ab / sqrt((a sin)^2 + (b cos)^2)`.
 */
function directionalRadiusM(body: CelestialBody, sinLat: number): number {
  const a = body.equatorialRadiusM;
  const b = finite(body.polarRadiusM, a);
  if (a === b) return a;
  const cosLat = Math.sqrt(Math.max(0, 1 - sinLat * sinLat));
  return (a * b) / Math.sqrt((a * sinLat) ** 2 + (b * cosLat) ** 2);
}

/** Where a body is right now, in the solar system frame. */
export interface BodyState {
  readonly body: CelestialBody;
  readonly positionM: Vec3;
  readonly velocityMps: Vec3;
}

/**
 * How a body should currently be treated: a point of light, a globe, or ground underfoot.
 *
 * `blend` exists only for the renderer to cross-fade with. The specification is explicit that the
 * logical position never depends on it — a body is where it is whichever way it is being drawn.
 */
export interface BodyHandoffState {
  readonly bodyId: string;
  readonly mode: 'celestial' | 'planet' | 'surface';
  readonly blend: number;
  readonly apparentAngularRadiusRad: number;
  readonly distanceToSurfaceM: number;
}

export interface SolarSystemOptions {
  ephemeris?: EphemerisProvider;
  /** Seconds from J2000 at which the game's clock starts. */
  epochS?: number;
}

/**
 * The solar system as a logical model.
 *
 * Positions are real metres from the barycentre. Nothing here is scaled for the renderer: what
 * the render layer receives is a handoff state and an angular size, which is what lets the Sun sit
 * at a genuine astronomical unit without a single astronomical number reaching a vertex buffer.
 */
export class SolarSystem {
  private readonly ephemeris: EphemerisProvider;
  private readonly states = new Map<string, BodyState>();
  private epochS: number;

  constructor(options: SolarSystemOptions = {}) {
    this.ephemeris = options.ephemeris ?? new OfflineEphemeris();
    this.epochS = finite(options.epochS);
    this.update(this.epochS);
  }

  get time(): number { return this.epochS; }
  get bodies(): readonly CelestialBody[] { return SOLAR_SYSTEM_BODIES; }

  /** Advances to an epoch and recomputes every body. Cheap: it is a few dozen Kepler solves. */
  update(epochS: number): void {
    this.epochS = finite(epochS);
    this.states.clear();
    for (const body of SOLAR_SYSTEM_BODIES) this.resolve(body);
  }

  /**
   * Position in the solar system frame, walking up through parents. The Moon's ephemeris is
   * relative to Earth, so its solar-system position is Earth's plus its own.
   */
  private resolve(body: CelestialBody): BodyState {
    const cached = this.states.get(body.id);
    if (cached) return cached;

    const sample = this.ephemeris.sample(body.id, this.epochS);
    const local: Vec3 = sample ? cloneVec3(sample.positionM) : [0, 0, 0];
    const velocity: Vec3 = sample ? cloneVec3(sample.velocityMps) : [0, 0, 0];

    if (body.parentId && body.parentId !== 'sun') {
      const parent = bodyById(body.parentId);
      if (parent) {
        const parentState = this.resolve(parent);
        addVec3(local, parentState.positionM, local);
        addVec3(velocity, parentState.velocityMps, velocity);
      }
    }
    const state: BodyState = { body, positionM: local, velocityMps: velocity };
    this.states.set(body.id, state);
    return state;
  }

  stateOf(bodyId: string): BodyState | undefined { return this.states.get(bodyId); }

  positionOf(bodyId: string): Vec3 | undefined { return this.states.get(bodyId)?.positionM; }

  /** Distance between two bodies right now, metres. */
  distanceBetween(a: string, b: string): number {
    const first = this.states.get(a), second = this.states.get(b);
    if (!first || !second) return Number.NaN;
    return Math.hypot(
      first.positionM[0] - second.positionM[0],
      first.positionM[1] - second.positionM[1],
      first.positionM[2] - second.positionM[2],
    );
  }

  /**
   * Which body the player belongs to, by sphere of influence rather than by raw distance.
   *
   * This is what makes the frame handoff physical: near the Moon the Moon dominates, even though
   * Earth is far more massive, because the Moon is far closer. Falls back to the Sun.
   */
  dominantBody(positionM: Vec3): CelestialBody {
    let best = bodyById('sun')!;
    let bestScore = 0;
    for (const state of this.states.values()) {
      const mu = gravitationalParameter(state.body);
      if (!(mu > 0)) continue;
      const distance = Math.max(1, Math.hypot(
        positionM[0] - state.positionM[0],
        positionM[1] - state.positionM[1],
        positionM[2] - state.positionM[2],
      ));
      // Gravitational acceleration, which is exactly the physical question being asked.
      const score = mu / (distance * distance);
      if (score > bestScore) { bestScore = score; best = state.body; }
    }
    return best;
  }

  /**
   * How a body should be presented from a distance.
   *
   * The bands are angular, not metric: a body becomes a globe when it is big enough on screen to
   * be one, which is the same rule for the Moon at 384 000 km and for Jupiter at 600 million.
   */
  handoff(bodyId: string, observerM: Vec3): BodyHandoffState | undefined {
    const state = this.states.get(bodyId);
    if (!state) return undefined;
    const dx = observerM[0] - state.positionM[0];
    const dy = observerM[1] - state.positionM[1];
    const dz = observerM[2] - state.positionM[2];
    const distance = Math.max(1, Math.hypot(dx, dy, dz));
    // The ellipsoid radius in the observer's own direction, not the mean. On Earth those differ
    // by 7 km at the equator, which would report someone standing on the ground as being in the
    // stratosphere.
    const radius = directionalRadiusM(state.body, dz / distance);
    const angularRadius = distance <= radius ? Math.PI / 2 : Math.asin(Math.min(1, radius / distance));
    const surfaceDistance = distance - radius;

    // A tenth of a degree across is about where a disc stops being a point of light.
    const celestialLimit = 0.001;
    // Twenty degrees across is where the horizon starts to matter more than the disc.
    const surfaceLimit = 0.35;
    const mode = angularRadius < celestialLimit ? 'celestial'
      : angularRadius < surfaceLimit ? 'planet' : 'surface';
    const blend = mode === 'celestial'
      ? Math.min(1, angularRadius / celestialLimit)
      : mode === 'planet'
        ? (angularRadius - celestialLimit) / (surfaceLimit - celestialLimit)
        : 1;

    return {
      bodyId, mode, blend: Math.min(1, Math.max(0, blend)),
      apparentAngularRadiusRad: angularRadius,
      distanceToSurfaceM: surfaceDistance,
    };
  }

  /**
   * Registers a frame per body so positions can be converted without the renderer knowing the
   * hierarchy. Called once; the frames' origins are updated as the bodies move.
   */
  registerFrames(graph: ReferenceFrameGraph): void {
    if (!graph.has(SOLAR_SYSTEM_FRAME)) {
      graph.register(referenceFrame({ id: SOLAR_SYSTEM_FRAME, kind: 'system', label: 'Sistema Solar' }));
    }
    for (const body of SOLAR_SYSTEM_BODIES) {
      const state = this.states.get(body.id);
      graph.register(referenceFrame({
        id: body.frameId,
        parentId: SOLAR_SYSTEM_FRAME,
        kind: 'body-fixed',
        originInParent: state ? cloneVec3(state.positionM) : [0, 0, 0],
        label: body.name,
      }));
    }
  }

  /** Speed of a body relative to the frame origin, for the HUD and for handoff decisions. */
  speedOf(bodyId: string): number {
    const state = this.states.get(bodyId);
    return state ? lengthVec3(state.velocityMps) : Number.NaN;
  }
}
