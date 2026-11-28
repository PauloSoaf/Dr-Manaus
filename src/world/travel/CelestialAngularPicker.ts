import type { CelestialSystemRuntime } from '../celestial/CelestialSystemRuntime';
import type { Vec3 } from '../spatial/units';

export interface CelestialPickResult {
  readonly bodyId: string;
  readonly name: string;
  readonly distanceM: number;
  readonly apparentRadiusRad: number;
  readonly angleRad: number;
  readonly systemPositionM: Vec3;
}

export const DEFAULT_RETICLE_CONE_RAD = 15 * Math.PI / 180; // 15 degrees

/**
 * Picks a celestial body from a camera ray direction in the celestial system frame
 * using analytical angular separation and apparent body radius.
 * Does not raycast 3D meshes or rely on loaded LODs.
 */
export function pickCelestialBodyFromRay(
  system: CelestialSystemRuntime,
  observerSystemPositionM: Vec3,
  rayDirectionSystem: Vec3,
  reticleAngleRad = DEFAULT_RETICLE_CONE_RAD,
  excludedBodyId?: string,
): CelestialPickResult | null {
  const dirLen = Math.hypot(rayDirectionSystem[0], rayDirectionSystem[1], rayDirectionSystem[2]);
  if (dirLen <= 1e-12 || !Number.isFinite(dirLen)) return null;

  const rdx = rayDirectionSystem[0] / dirLen;
  const rdy = rayDirectionSystem[1] / dirLen;
  const rdz = rayDirectionSystem[2] / dirLen;

  let best: CelestialPickResult | null = null;
  let bestScore = Infinity;

  for (const body of system.bodies) {
    if (body.id === excludedBodyId) continue;

    const pos = system.positionOf(body.id);
    if (!pos || !pos.every(Number.isFinite)) continue;

    const vx = pos[0] - observerSystemPositionM[0];
    const vy = pos[1] - observerSystemPositionM[1];
    const vz = pos[2] - observerSystemPositionM[2];

    const dist = Math.hypot(vx, vy, vz);
    if (dist <= body.equatorialRadiusM || !Number.isFinite(dist)) continue;

    const ux = vx / dist;
    const uy = vy / dist;
    const uz = vz / dist;

    const dot = Math.max(-1, Math.min(1, ux * rdx + uy * rdy + uz * rdz));
    const angleRad = Math.acos(dot);

    const apparentRadiusRad = Math.asin(Math.min(1, body.equatorialRadiusM / dist));
    const maxAllowedAngle = Math.max(apparentRadiusRad, reticleAngleRad);

    if (angleRad <= maxAllowedAngle) {
      // Score: normalized angle in reticle cone, with bonus for larger apparent size
      const score = (angleRad / maxAllowedAngle) - 0.1 * Math.min(1, apparentRadiusRad / reticleAngleRad);
      if (score < bestScore) {
        bestScore = score;
        best = {
          bodyId: body.id,
          name: body.name ?? body.id,
          distanceM: dist,
          apparentRadiusRad,
          angleRad,
          systemPositionM: [pos[0], pos[1], pos[2]],
        };
      }
    }
  }

  return best;
}

