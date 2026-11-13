import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampPlanetTileCap, clampRepresentativeGalaxyPoints, clampStarSectorRing,
  clampStarsPerSector, COSMIC_LOD_HARD_CAPS, sectorCountForRing,
} from '../src/world/streaming/CosmicLodBudget.ts';
import { GALAXY_POINT_BUDGETS } from '../src/world/galaxy/GalaxyPointCloudProvider.ts';

test('LOD-STREAM-01 applies the High residency caps', () => {
  assert.equal(clampPlanetTileCap(999), COSMIC_LOD_HARD_CAPS.planetTiles);
  assert.equal(clampStarSectorRing(2), 1);
  assert.equal(sectorCountForRing(clampStarSectorRing(2)), COSMIC_LOD_HARD_CAPS.starSectors);
  assert.equal(
    clampStarsPerSector(999, 1) * COSMIC_LOD_HARD_CAPS.starSectors <= COSMIC_LOD_HARD_CAPS.localVisibleStars,
    true,
  );
  assert.equal(clampRepresentativeGalaxyPoints(999_999), COSMIC_LOD_HARD_CAPS.representativeGalaxyPoints);
  assert.equal(GALAXY_POINT_BUDGETS.High, COSMIC_LOD_HARD_CAPS.representativeGalaxyPoints);
});

test('LOD-STREAM-01 keeps invalid requests finite and bounded', () => {
  assert.equal(clampPlanetTileCap(Number.NaN), COSMIC_LOD_HARD_CAPS.planetTiles);
  assert.equal(clampStarSectorRing(Number.POSITIVE_INFINITY), 0);
  assert.equal(clampStarsPerSector(Number.NaN, 1), 592);
  assert.equal(clampRepresentativeGalaxyPoints(Number.NaN), COSMIC_LOD_HARD_CAPS.representativeGalaxyPoints);
});
