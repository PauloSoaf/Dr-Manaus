/**
 * Starting High-quality residency caps from spec 14.
 *
 * These are policy limits, not renderer capacities: providers clamp their requested residency
 * before the global scheduler sees it, so one provider cannot silently consume the whole frame.
 */
export const COSMIC_LOD_HARD_CAPS = {
  planetTiles: 160,
  starSectors: 27,
  localVisibleStars: 16_000,
  representativeGalaxyPoints: 80_000,
  highDetailGalaxies: 1,
  fullBlackHoleLenses: 1,
  highDetailPlanetSurfaces: 1,
} as const;

export function clampPlanetTileCap(requested: number, fallback = COSMIC_LOD_HARD_CAPS.planetTiles): number {
  return Math.max(6, Math.min(COSMIC_LOD_HARD_CAPS.planetTiles, Math.floor(Number.isFinite(requested) ? requested : fallback)));
}

/** Number of cells in a cubic sector ring. Ring 1 is the canonical 3x3x3 neighbourhood. */
export function sectorCountForRing(ring: number): number {
  const clamped = Math.max(0, Math.floor(Number.isFinite(ring) ? ring : 0));
  return (clamped * 2 + 1) ** 3;
}

export function clampStarSectorRing(requested: number): number {
  let ring = Math.max(0, Math.floor(Number.isFinite(requested) ? requested : 0));
  while (ring > 0 && sectorCountForRing(ring) > COSMIC_LOD_HARD_CAPS.starSectors) ring--;
  return ring;
}

export function clampStarsPerSector(requested: number, ring: number): number {
  const sectors = sectorCountForRing(clampStarSectorRing(ring));
  const perSector = Math.floor(COSMIC_LOD_HARD_CAPS.localVisibleStars / sectors);
  return Math.max(1, Math.min(Math.floor(Number.isFinite(requested) ? requested : perSector), perSector));
}

export function clampRepresentativeGalaxyPoints(requested: number): number {
  return Math.max(100, Math.min(COSMIC_LOD_HARD_CAPS.representativeGalaxyPoints,
    Math.floor(Number.isFinite(requested) ? requested : COSMIC_LOD_HARD_CAPS.representativeGalaxyPoints)));
}


export type BlackHoleRenderTier = 'full-lens' | 'mid-detail' | 'far-point';

export interface BlackHoleLodCandidate {
  readonly id: string;
  readonly distanceRs: number;
  readonly lensingIntensity01: number;
}

/**
 * Enforces the Black Hole rendering budget from 11-BLACK-HOLES.md:
 * - full lensing BH: max 1 (only when within lens threshold distanceRs <= 60 and lensingIntensity01 > 0)
 * - mid-detail BH (shadow + disk): <= 4
 * - far BH: point/impostor
 */
export function selectBlackHoleLodTiers(
  candidates: readonly BlackHoleLodCandidate[],
  quality: 'Low' | 'Medium' | 'High' | 'Ultra' = 'High',
): Map<string, BlackHoleRenderTier> {
  const sorted = [...candidates].sort((a, b) => {
    if (b.lensingIntensity01 !== a.lensingIntensity01) {
      return b.lensingIntensity01 - a.lensingIntensity01;
    }
    return a.distanceRs - b.distanceRs;
  });

  const maxFullLens = quality === 'Low' ? 0 : COSMIC_LOD_HARD_CAPS.fullBlackHoleLenses;
  const maxMidDetail = 4;
  let fullCount = 0;
  let midCount = 0;
  const result = new Map<string, BlackHoleRenderTier>();

  for (const c of sorted) {
    const withinLensThreshold = c.distanceRs <= 60 && c.lensingIntensity01 > 0;
    if (withinLensThreshold && fullCount < maxFullLens) {
      result.set(c.id, 'full-lens');
      fullCount++;
    } else if (c.distanceRs <= 10_000 && midCount < maxMidDetail) {
      result.set(c.id, 'mid-detail');
      midCount++;
    } else {
      result.set(c.id, 'far-point');
    }
  }

  return result;
}
