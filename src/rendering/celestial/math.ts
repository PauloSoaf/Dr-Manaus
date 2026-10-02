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

export function celestialProxyGeometry(angularRadiusRad: number, cameraFarM: number, extent = 1): CelestialProxyGeometry {
  // Fit the full proxy, rings/corona included, inside the far plane without astronomical meshes.
  const farM = Number.isFinite(cameraFarM) && cameraFarM > 0 ? cameraFarM : 100_000;
  const tangent = Math.tan(Math.max(0, Math.min(Math.PI / 2 - 1e-6, angularRadiusRad)));
  const outerScale = Math.max(1, extent);
  return boundedCelestialProxy(tangent, tangent * outerScale, farM);
}

/** Fit even a screen-space point or wide optical corona, preserving the physical tangent. */
export function boundedCelestialProxy(tangent: number, outerTangent: number, cameraFarM: number): CelestialProxyGeometry {
  const farM = Number.isFinite(cameraFarM) && cameraFarM > 0 ? cameraFarM : 100_000;
  const distanceM = Math.min(CELESTIAL_PROXY_DISTANCE_M,
    farM * 0.9 / (1 + outerTangent), CELESTIAL_RENDER_SAFE_RADIUS_M / (1 + outerTangent));
  const radiusM = tangent * distanceM;
  const safe = Number.isFinite(radiusM) && Number.isFinite(distanceM)
    && outerTangent * distanceM <= CELESTIAL_RENDER_SAFE_RADIUS_M;
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
