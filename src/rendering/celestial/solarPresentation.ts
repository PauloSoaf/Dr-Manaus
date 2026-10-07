import { angularRadiusRad } from './math';
import { smoothRange } from './presentation';
import type { QualityPreset } from '../../core/config';

export function solarPresentation(angle: number, quality: QualityPreset = 'High') {
  const degrees = Math.max(0, Math.min(Math.PI / 2, angle)) * 180 / Math.PI;
  return { mode: degrees < 1 ? 'DISTANT' : degrees < 12 ? 'DISC' : degrees < 45 ? 'CLOSE' : 'IMMERSIVE',
    detail: smoothRange(degrees, .3, 4),
    prominence: quality === 'High' || quality === 'Ultra' ? smoothRange(degrees, 1, 8) : 0 };
}

/** Exact ray/sphere boundary, also used to verify the screen shader at wide angular sizes. */
export function solarRaySurface(ray: readonly number[], centreDirection: readonly number[], ratio: number) {
  const r = Math.max(1e-8, Math.min(1, ratio));
  const mu = ray.reduce((sum, v, i) => sum + v * centreDirection[i], 0);
  const discriminant = mu * mu - (1 - r * r);
  if (mu <= 0 || discriminant < 0) return undefined;
  const t = (1 - r * r) / Math.max(1e-12, mu + Math.sqrt(discriminant));
  return ray.map((v, i) => (v * t - centreDirection[i]) / r);
}

export function solarDiagnostics(radiusM: number, distanceM: number, fovRad: number, height: number) {
  const angle = angularRadiusRad(radiusM, distanceM);
  const tangent = Math.tan(Math.min(Math.PI / 2 - 1e-6, angle));
  return { distanceM, photosphereClearanceM: distanceM - radiusM, radiusM,
    angularDiameterDeg: angle * 360 / Math.PI,
    projectedDiameterPx: Math.max(1, height) * tangent / Math.tan(fovRad / 2) };
}
