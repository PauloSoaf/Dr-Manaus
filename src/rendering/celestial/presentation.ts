import type { BodyVisualProfile } from '../../world/celestial/CelestialBodyProfile';

export function smoothRange(value: number, low: number, high: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

/** Perspective pixels for presentation only; handoff still uses its existing physical LOD. */
export function bodyPresentation(angle: number, profile: BodyVisualProfile, fovRad: number, heightPx: number) {
  const height = Number.isFinite(heightPx) && heightPx > 0 ? heightPx : 1;
  const fov = Number.isFinite(fovRad) && fovRad > 0 && fovRad < Math.PI ? fovRad : Math.PI / 3;
  const pixelScale = height / Math.tan(fov / 2);
  const physicalTangent = Math.tan(Math.max(0, Math.min(Math.PI / 2 - 1e-6, angle)));
  const physicalProjectedDiameterPx = physicalTangent * pixelScale;
  const floor = Math.max(0, profile.minimumVisiblePx ?? 0);
  const presentationDiameterPx = Math.max(physicalProjectedDiameterPx, floor);
  const pointMix = floor > 0 ? 1 - smoothRange(physicalProjectedDiameterPx, floor, floor * 3) : 0;
  const glowDiameterPx = Math.max(presentationDiameterPx
    + Math.max(0, (profile.pointGlowPx ?? 0) - presentationDiameterPx) * pointMix,
    presentationDiameterPx * (1 + Math.max(0, (profile.haze?.radiusScale ?? 1) - 1) * (1 - pointMix)));
  const presentationTangent = presentationDiameterPx / pixelScale;
  const glowTangent = glowDiameterPx / pixelScale;
  const ringThreshold = profile.rings?.minimumDiameterPx ?? 6;
  const ringsOpacity = profile.rings
    ? smoothRange(physicalProjectedDiameterPx * profile.rings.outerRadius, ringThreshold, ringThreshold * 1.5) : 0;
  // All effects contribute to the bounded proxy budget, never to the physical angular radius.
  const extentTangent = Math.max(glowTangent,
    physicalTangent * Math.max(1, profile.rings?.outerRadius ?? 1, profile.solarGlow?.outerScale ?? 1));
  return { physicalProjectedDiameterPx, presentationDiameterPx, pointMix, ringsOpacity,
    physicalTangent, presentationTangent, glowTangent, extentTangent };
}
