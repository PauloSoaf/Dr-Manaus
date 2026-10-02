import type { CelestialSystemRuntime } from '../celestial/CelestialSystemRuntime';
import { bodyArrivalPolicy } from '../celestial/CelestialBodyProfile';
import type { NavigationTarget, ResolvedTarget } from './CosmicFlight';
import type { Vec3 } from '../spatial/units';

export interface BodyExclusionEnvelope {
  readonly bodyId: string;
  readonly centreM: Vec3;
  readonly radiusM: number;
}

/** Selection stores identity only and cannot teleport or capture stale ephemeris coordinates. */
export function selectBodyDestination(system: CelestialSystemRuntime, bodyId: string): NavigationTarget | undefined {
  const body = system.bodies.find(candidate => candidate.id === bodyId);
  return body ? { bodyId, arrivalMarginM: bodyArrivalPolicy(body).arrivalMarginM } : undefined;
}

export function resolveBodyDestination(system: CelestialSystemRuntime,
  target: NavigationTarget | undefined): ResolvedTarget | undefined {
  const body = system.bodies.find(candidate => candidate.id === target?.bodyId);
  const positionM = body && system.positionOf(body.id);
  if (!body || !positionM) return undefined;
  return { bodyId: body.id, positionM, radiusM: body.equatorialRadiusM,
    arrivalMarginM: bodyArrivalPolicy(body).arrivalMarginM };
}

/** Every body is swept, including unselected bodies crossed at warp speed. */
export function bodyExclusionEnvelopes(system: CelestialSystemRuntime): BodyExclusionEnvelope[] {
  const envelopes: BodyExclusionEnvelope[] = [];
  for (const body of system.bodies) {
    const centreM = system.positionOf(body.id);
    if (centreM) envelopes.push({ bodyId: body.id, centreM,
      radiusM: body.equatorialRadiusM + bodyArrivalPolicy(body).exclusionMarginM });
  }
  return envelopes;
}
