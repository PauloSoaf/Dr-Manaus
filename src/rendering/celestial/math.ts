export const CELESTIAL_PROXY_DISTANCE_M = 5_000_000;
export const CELESTIAL_RENDER_SAFE_RADIUS_M = 10_000_000;

export function angularRadiusRad(radiusM: number, distanceM: number): number {
  const radius = Math.max(0, radiusM);
  const distance = Math.max(1e-6, distanceM);
  if (distance <= radius) return Math.PI / 2;
  return Math.asin(Math.min(1, radius / distance));
}
