import type { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import { cloneVec3, type Vec3, finite, lengthVec3 } from '../spatial/units';
import { referenceFrame } from '../spatial/ReferenceFrame';
import type { CelestialBody } from './CelestialBody';
import type { CelestialSystemRuntime, BodyHandoffState } from './CelestialSystemRuntime';
import type { ProceduralSystem } from './SystemGenerator';

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

export class ProceduralSystemRuntime implements CelestialSystemRuntime {
  private readonly states = new Map<string, { positionM: Vec3, velocityMps: Vec3 }>();
  private epochS = 0;
  public readonly bodies: readonly CelestialBody[];
  private readonly byId = new Map<string, CelestialBody>();

  /**
   * Positions a generated system from the elements its generator wrote on each body.
   *
   * It used to re-derive them here, by replaying the generator's seeded stream. That cannot work
   * and did not: the generator draws a radius, a gas-giant test, a mass, a rotation period and a
   * moon count per planet, and this replay drew one value per planet. Same seed, different
   * sequence, so the orbit a planet was given and the orbit it was drawn in were unrelated -- and
   * a body whose parent was never resolved fell back to the origin.
   */
  constructor(public readonly system: ProceduralSystem, epochS = 0) {
    this.bodies = system.bodies;
    for (const body of this.bodies) this.byId.set(body.id, body);
    this.update(epochS);
  }

  get time(): number { return this.epochS; }

  update(epochS: number): void {
    this.epochS = finite(epochS);
    this.states.clear();
    for (const body of this.bodies) this.resolve(body);
  }

  /**
   * A body's state, and its parent's first.
   *
   * Recursive with a cache rather than a sorted pass: a moon's position is its planet's plus its
   * own, and the generator emits them in an order that already satisfies that, but nothing should
   * depend on it continuing to.
   */
  private resolve(body: CelestialBody): { positionM: Vec3, velocityMps: Vec3 } {
    const cached = this.states.get(body.id);
    if (cached) return cached;
    // Guard against a cycle in the parent chain: a body that orbits itself would recurse forever.
    this.states.set(body.id, { positionM: [0, 0, 0], velocityMps: [0, 0, 0] });

    const positionM: Vec3 = [0, 0, 0];
    const velocityMps: Vec3 = [0, 0, 0];
    const orbit = body.orbit;
    if (orbit) {
      const radius = finite(orbit.semiMajorAxisM);
      const rate = finite(orbit.angularRateRadS);
      const angle = finite(orbit.phaseRad) + rate * this.epochS;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      // In the orbital plane, then tilted about the x axis so the system is a disc and not a ring.
      const tilt = finite(orbit.inclinationRad);
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      positionM[0] = cos * radius;
      positionM[1] = sin * radius * sinT;
      positionM[2] = sin * radius * cosT;
      const speed = rate * radius;
      velocityMps[0] = -sin * speed;
      velocityMps[1] = cos * speed * sinT;
      velocityMps[2] = cos * speed * cosT;
    }

    const parent = body.parentId ? this.byId.get(body.parentId) : undefined;
    if (parent && parent.id !== body.id) {
      const parentState = this.resolve(parent);
      for (let i = 0; i < 3; i++) {
        positionM[i] += parentState.positionM[i];
        velocityMps[i] += parentState.velocityMps[i];
      }
    }

    const state = { positionM, velocityMps };
    this.states.set(body.id, state);
    return state;
  }

  positionOf(bodyId: string): Vec3 | undefined {
    return this.states.get(bodyId)?.positionM;
  }

  dominantBody(observerM: Vec3): CelestialBody | undefined {
    // Determine the closest body by surface distance
    let closest: CelestialBody | undefined;
    let minDistance = Infinity;
    for (const body of this.bodies) {
      const state = this.states.get(body.id);
      if (!state) continue;
      const dx = observerM[0] - state.positionM[0];
      const dy = observerM[1] - state.positionM[1];
      const dz = observerM[2] - state.positionM[2];
      const distance = Math.hypot(dx, dy, dz);
      if (distance < minDistance) {
        minDistance = distance;
        closest = body;
      }
    }
    return closest;
  }

  handoff(bodyId: string, observerM: Vec3): BodyHandoffState | undefined {
    const state = this.states.get(bodyId);
    if (!state) return undefined;
    const body = this.bodies.find(b => b.id === bodyId);
    if (!body) return undefined;

    const dx = observerM[0] - state.positionM[0];
    const dy = observerM[1] - state.positionM[1];
    const dz = observerM[2] - state.positionM[2];
    const distance = Math.max(1, Math.hypot(dx, dy, dz));
    const radius = directionalRadiusM(body, dz / distance);
    const angularRadius = distance <= radius ? Math.PI / 2 : Math.asin(Math.min(1, radius / distance));
    const surfaceDistance = distance - radius;

    const celestialLimit = 0.001;
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

  registerFrames(graph: ReferenceFrameGraph): void {
    const systemFrame = `system/${this.system.starId}`;
    if (!graph.has(systemFrame)) {
      graph.register(referenceFrame({ id: systemFrame, kind: 'system', label: `System ${this.system.starId}` }));
    }
    for (const body of this.bodies) {
      const state = this.states.get(body.id);
      graph.register(referenceFrame({
        id: body.frameId,
        parentId: systemFrame,
        kind: 'body-fixed',
        originInParent: state ? cloneVec3(state.positionM) : [0, 0, 0],
        label: body.name,
      }));
    }
  }

  speedOf(bodyId: string): number {
    const state = this.states.get(bodyId);
    return state ? lengthVec3(state.velocityMps) : Number.NaN;
  }
}
