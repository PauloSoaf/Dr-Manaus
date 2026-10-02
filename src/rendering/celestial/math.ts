export const CELESTIAL_PROXY_DISTANCE_M = 5_000_000;
export const CELESTIAL_RENDER_SAFE_RADIUS_M = 10_000_000;

export function angularRadiusRad(radiusM: number, distanceM: number): number {
  const radius = Math.max(0, radiusM);
  const distance = Math.max(1e-6, distanceM);
  if (distance <= radius) return Math.PI / 2;
  return Math.asin(Math.min(1, radius / distance));
}

export interface CelestialProxyGeometry {
  safe: boolean;
  distanceM: number;
  radiusM: number;
}

export function celestialProxyGeometry(angularRadiusRad: number, cameraFarM: number): CelestialProxyGeometry {
  const distanceM = cameraFarM * 0.90;
  const radiusM = Math.tan(angularRadiusRad) * distanceM;
  const safe = Number.isFinite(radiusM) && radiusM <= CELESTIAL_RENDER_SAFE_RADIUS_M;
  return {
    safe,
    distanceM,
    radiusM
  };
}

export function projectedDiameterPx(
  angularRadiusRad: number,
  verticalFovRad: number,
  viewportHeightPx: number
): number {
  // If the object covers the entire view (or is inside the body), angularRadius is PI/2.
  if (angularRadiusRad >= Math.PI / 2) return Infinity;
  
  // Apparent size in radians is 2 * angularRadiusRad
  // The fraction of the vertical FOV it covers is (2 * angularRadiusRad) / verticalFovRad
  // This is a small-angle approximation that is adequate for LOD selection.
  const fraction = (2 * angularRadiusRad) / verticalFovRad;
  return fraction * viewportHeightPx;
}
