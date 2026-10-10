/**
 * Structural readiness contract for planetary surface coverage.
 *
 * Replaces boolean LOD checks with a factual, view-demand aware assessment
 * of whether required surface representation is loaded and active.
 */
export interface EarthCoverageReadiness {
  /** All keys planned by quadtree selection for the current camera view. */
  readonly requestedKeys: readonly string[];
  /** Bounded subset of keys deemed critical/required for the current view. */
  readonly requiredKeys: readonly string[];
  /** Required keys that are currently active in the scene. */
  readonly activeRequiredKeys: readonly string[];
  /** Required keys that have not yet been activated. */
  readonly missingRequiredKeys: readonly string[];
  /** Ratio of active required keys to total required keys (0 to 1). */
  readonly coverageRatio: number;
  /** Whether the coarse fallback (whole-planet base) is ready. */
  readonly coarseFallbackReady: boolean;
  /** Whether every required detailed tile is active, without relying on the coarse base. */
  readonly detailedCoverageReady: boolean;
  /** Which representation currently closes the view coverage contract. */
  readonly coverageSource: 'none' | 'coarse' | 'mixed' | 'detailed';
  /** Whether view coverage meets readiness threshold for retiring previous representation. */
  readonly viewCoverageReady: boolean;
  /** Target LOD for the current altitude regime. */
  readonly targetLod: number;
}

export function createDefaultReadiness(targetLod = 0): EarthCoverageReadiness {
  return {
    requestedKeys: [],
    requiredKeys: [],
    activeRequiredKeys: [],
    missingRequiredKeys: [],
    coverageRatio: 0,
    coarseFallbackReady: false,
    detailedCoverageReady: false,
    coverageSource: 'none',
    viewCoverageReady: false,
    targetLod,
  };
}
