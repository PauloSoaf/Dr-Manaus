import type { CelestialSystemRuntime } from '../celestial/CelestialSystemRuntime';
import { bodyArrivalPolicy, bodyProfile } from '../celestial/CelestialBodyProfile';
import type { NavigationTarget, ResolvedTarget } from './CosmicFlight';
import type { Vec3 } from '../spatial/units';
import { maximumSurfaceReliefM } from '../planet/BodySurfaceFactory';
import type { CelestialBody } from '../celestial/CelestialBody';

const bodyIndexes = new WeakMap<CelestialSystemRuntime, { bodies: readonly CelestialBody[]; index: Map<string, CelestialBody> }>();
function navigationBody(system: CelestialSystemRuntime, id: string | undefined): CelestialBody | undefined {
  let entry = bodyIndexes.get(system);
  if (!entry || entry.bodies !== system.bodies) {
    entry = { bodies: system.bodies, index: new Map(system.bodies.map(body => [body.id, body])) };
    bodyIndexes.set(system, entry);
  }
  return id ? entry.index.get(id) : undefined;
}

export interface BodyExclusionEnvelope {
  readonly bodyId: string;
  readonly centreM: Vec3;
  readonly radiusM: number;
  readonly velocityMps?: Vec3;
  /** Optional measured terminal radius; high-speed motion must still use radiusM. */
  readonly captureRadiusM?: number;
}

export interface TerminalSurfaceContext {
  readonly bodyId: string;
  readonly observerM: Vec3;
  readonly clearanceM: number | undefined;
}

/** Selection stores identity only and cannot teleport or capture stale ephemeris coordinates. */
export function selectBodyDestination(system: CelestialSystemRuntime, bodyId: string): NavigationTarget | undefined {
  const body = navigationBody(system, bodyId);
  return body ? { bodyId, arrivalMarginM: bodyArrivalPolicy(body).arrivalMarginM } : undefined;
}

export function resolveBodyDestination(system: CelestialSystemRuntime,
  target: Pick<NavigationTarget, 'bodyId'> | undefined): ResolvedTarget | undefined {
  const body = navigationBody(system, target?.bodyId);
  const positionM = body && system.positionOf(body.id);
  if (!body || !positionM?.every(Number.isFinite)) return undefined;
  return { bodyId: body.id, positionM, radiusM: body.equatorialRadiusM,
    exclusionMarginM: bodyArrivalPolicy(body).exclusionMarginM,
    arrivalMarginM: bodyArrivalPolicy(body).arrivalMarginM,
    velocityMps: system.stateOf(body.id)?.velocityMps };
}

/** Every body is swept, including unselected bodies crossed at warp speed. */
export function bodyExclusionEnvelopes(system: CelestialSystemRuntime, terminal?: TerminalSurfaceContext): BodyExclusionEnvelope[] {
  const envelopes: BodyExclusionEnvelope[] = [];
  for (const body of system.bodies) {
    const centreM = system.positionOf(body.id);
    if (!centreM) continue;
    const margin = bodyArrivalPolicy(body).exclusionMarginM;
    const measured = terminal?.bodyId === body.id && bodyProfile(body).canLand && Number.isFinite(terminal.clearanceM)
      ? Math.hypot(terminal.observerM[0]-centreM[0],terminal.observerM[1]-centreM[1],terminal.observerM[2]-centreM[2])
        - terminal.clearanceM! + margin : undefined;
    envelopes.push({ bodyId: body.id, centreM, velocityMps: system.stateOf(body.id)?.velocityMps,
      radiusM: body.equatorialRadiusM + maximumSurfaceReliefM(body) + margin,
      captureRadiusM: measured !== undefined && Number.isFinite(measured) && measured > 0 ? measured : undefined });
  }
  return envelopes;
}
