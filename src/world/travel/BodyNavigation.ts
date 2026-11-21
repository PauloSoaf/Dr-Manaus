import { MathUtils, Vector3 } from 'three/webgpu';
import type { CelestialSystemRuntime } from '../celestial/CelestialSystemRuntime';
import { bodyArrivalPolicy, bodyProfile } from '../celestial/CelestialBodyProfile';
import type { NavigationTarget, ResolvedTarget } from './CosmicFlight';
import type { Vec3 } from '../spatial/units';
import { maximumSurfaceReliefM } from '../planet/BodySurfaceFactory';
import type { CelestialBody } from '../celestial/CelestialBody';
import { TITAN_LEVIATHAN_BODY } from '../celestial/CelestialBody';

const bodyIndexes = new WeakMap<CelestialSystemRuntime, { bodies: readonly CelestialBody[]; index: Map<string, CelestialBody> }>();
function navigationBody(system: CelestialSystemRuntime, id: string | undefined): CelestialBody | undefined {
  if (!id) return undefined;
  if (id === TITAN_LEVIATHAN_BODY.id) return TITAN_LEVIATHAN_BODY;
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
export function bodyExclusionEnvelopes(
  system: CelestialSystemRuntime,
  terminalOrIncludeTitans?: TerminalSurfaceContext | boolean,
  includeTitansOpt = false,
): BodyExclusionEnvelope[] {
  const terminal = typeof terminalOrIncludeTitans === 'object' ? terminalOrIncludeTitans : undefined;
  const includeTitans = typeof terminalOrIncludeTitans === 'boolean' ? terminalOrIncludeTitans : includeTitansOpt;
  const envelopes: BodyExclusionEnvelope[] = [];
  for (const body of system.bodies) {
    const centreM = system.positionOf(body.id);
    if (!centreM) continue;
    const margin = bodyArrivalPolicy(body).exclusionMarginM;
    const captureMargin = Math.min(margin, 1000);
    const measured = terminal?.bodyId === body.id && bodyProfile(body).canLand && Number.isFinite(terminal.clearanceM)
      ? Math.hypot(terminal.observerM[0]-centreM[0],terminal.observerM[1]-centreM[1],terminal.observerM[2]-centreM[2])
        - terminal.clearanceM! + captureMargin : undefined;
    envelopes.push({ bodyId: body.id, centreM, velocityMps: system.stateOf(body.id)?.velocityMps,
      radiusM: body.equatorialRadiusM + maximumSurfaceReliefM(body) + margin,
      captureRadiusM: measured !== undefined && Number.isFinite(measured) && measured > 0 ? measured : undefined });
  }
  if (includeTitans) {
    const titanPos = system.positionOf(TITAN_LEVIATHAN_BODY.id);
    if (titanPos) {
      const margin = bodyArrivalPolicy(TITAN_LEVIATHAN_BODY).exclusionMarginM;
      envelopes.push({
        bodyId: TITAN_LEVIATHAN_BODY.id,
        centreM: titanPos,
        velocityMps: system.stateOf(TITAN_LEVIATHAN_BODY.id)?.velocityMps,
        radiusM: TITAN_LEVIATHAN_BODY.equatorialRadiusM + margin,
      });
    }
  }
  return envelopes;
}

export interface RelativisticFlightTelemetry {
  readonly currentSpeedMps: number;
  readonly warpRatio: number; // 0 to 1
  readonly effectiveC: number;
  readonly fovDeg: number;
  readonly aberrationBeta: number; // 0 to 0.999
  readonly inGravityWell: boolean;
  readonly speedCapMps: number;
}

export class RelativisticWarpController {
  public static readonly LIGHT_SPEED_MPS = 299_792_458;
  public static readonly MAX_SUBLIGHT_SPEED_MPS = 10_000; // 10 km/s safe orbital insertion
  public static readonly MAX_WARP_SPEED_MPS = 299_792_458 * 10; // 10c superluminal cruise
  public static readonly GRAVITY_WELL_RADIUS_M = 500_000; // 500 km proximity threshold
  public static readonly BASE_FOV_DEG = 60.0;
  public static readonly MAX_FOV_DEG = 95.0;

  private currentSpeedMps = 0;
  private targetSpeedMps = 0;
  private readonly _perp = new Vector3();

  public updateFlightVelocity(
    dt: number,
    throttleInput: number,
    distanceToNearestMassM: number,
    forwardDirection: Vector3,
    outVelocity: Vector3
  ): RelativisticFlightTelemetry {
    const inGravityWell = distanceToNearestMassM < RelativisticWarpController.GRAVITY_WELL_RADIUS_M;
    const speedCap = inGravityWell
      ? RelativisticWarpController.MAX_SUBLIGHT_SPEED_MPS
      : RelativisticWarpController.MAX_WARP_SPEED_MPS;

    const clampedThrottle = Math.max(0, Math.min(1, throttleInput));
    this.targetSpeedMps = clampedThrottle * speedCap;

    // Smooth exponential acceleration / deceleration ramp
    const lerpFactor = 1.0 - Math.exp(-2.0 * dt);
    this.currentSpeedMps = MathUtils.lerp(this.currentSpeedMps, this.targetSpeedMps, lerpFactor);

    outVelocity.copy(forwardDirection).multiplyScalar(this.currentSpeedMps);

    const warpRatio = Math.min(1.0, this.currentSpeedMps / RelativisticWarpController.MAX_WARP_SPEED_MPS);
    const fovDeg = RelativisticWarpController.BASE_FOV_DEG + warpRatio * (RelativisticWarpController.MAX_FOV_DEG - RelativisticWarpController.BASE_FOV_DEG);
    const effectiveC = this.currentSpeedMps / RelativisticWarpController.LIGHT_SPEED_MPS;
    const aberrationBeta = Math.min(0.999, this.currentSpeedMps / (RelativisticWarpController.LIGHT_SPEED_MPS * 1.05));

    return {
      currentSpeedMps: this.currentSpeedMps,
      warpRatio,
      effectiveC,
      fovDeg,
      aberrationBeta,
      inGravityWell,
      speedCapMps: speedCap
    };
  }

  public getRelativisticFoV(baseFoV = RelativisticWarpController.BASE_FOV_DEG): number {
    const warpRatio = Math.min(1.0, this.currentSpeedMps / RelativisticWarpController.MAX_WARP_SPEED_MPS);
    return baseFoV + warpRatio * (RelativisticWarpController.MAX_FOV_DEG - RelativisticWarpController.BASE_FOV_DEG);
  }

  public computeAberrationDirection(
    photonDirection: Vector3,
    headingDirection: Vector3,
    beta: number,
    out: Vector3
  ): Vector3 {
    // Einstein/Lorentz aberration of light: cos(theta') = (cos(theta) + beta) / (1 + beta * cos(theta))
    const cosTheta = Math.max(-1, Math.min(1, photonDirection.dot(headingDirection)));
    const denom = 1 + beta * cosTheta;
    if (Math.abs(denom) < 1e-6) return out.copy(headingDirection);

    const cosThetaPrime = Math.max(-1, Math.min(1, (cosTheta + beta) / denom));
    const sinThetaPrime = Math.sqrt(Math.max(0, 1 - cosThetaPrime * cosThetaPrime));

    // Orthogonal component
    this._perp.copy(photonDirection).addScaledVector(headingDirection, -cosTheta);
    const perpLen = this._perp.length();
    if (perpLen > 1e-6) {
      this._perp.divideScalar(perpLen);
    } else {
      this._perp.set(0, 1, 0).cross(headingDirection).normalize();
    }

    return out.copy(headingDirection).multiplyScalar(cosThetaPrime).addScaledVector(this._perp, sinThetaPrime).normalize();
  }
}
