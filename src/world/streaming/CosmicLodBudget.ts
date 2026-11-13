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
