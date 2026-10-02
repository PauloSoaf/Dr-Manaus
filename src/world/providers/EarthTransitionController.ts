import { EarthProvider } from './EarthProvider';
import { type EarthCoverageReadiness, createDefaultReadiness } from './EarthCoverageReadiness';

export type EarthTransitionPhase =
  | 'LOCAL_ONLY'
  | 'REQUESTING_PLANET'
  | 'OVERLAP_SAFE'
  | 'PLANET_DOMINANT'
  | 'PLANET_ONLY'
  | 'RETURNING_LOCAL';

export type EarthGroundOwner = 'local' | 'planet';
export type EarthPresentationDomain = 'local' | 'planetary' | 'orbital';

/**
 * The flat city is useful close to the player, while the ellipsoid is the only honest horizon.
 * Keeping these thresholds together prevents the renderer and HUD from inventing independent
 * interpretations of the same flight state.
 */
export const EARTH_HANDOFF = {
  requestPlanetM: 8_000,
  planetOwnsGroundM: 15_000,
  returnLocalM: 13_000,
  orbitM: 60_000,
} as const;

export interface EarthTransitionState {
  readonly localWeight: number;
  readonly regionalWeight: number;
  readonly planetWeight: number;
  readonly atmosphereWeight: number;
  readonly targetCoverageReady: boolean;
  readonly readiness: EarthCoverageReadiness;
  readonly phase: EarthTransitionPhase;
  readonly effectiveLocalWeight: number;
  readonly keepLocalFallback: boolean;
  /** The sole representation allowed to own the ground under the observer. */
  readonly groundOwner: EarthGroundOwner;
  /** Direct integration flags; unlike blend weights these are deliberately mutually exclusive. */
  readonly localGroundVisible: boolean;
  readonly planetGroundDominant: boolean;
  /** Presentation state shared by the world and HUD. */
  readonly presentationDomain: EarthPresentationDomain;
}

export class EarthTransitionController {
  private lastAltitudeM = 0;
  private groundOwner: EarthGroundOwner = 'local';

  update(altitudeM: number, earth?: EarthProvider): EarthTransitionState {
    // Positive infinity is used while another body is dominant. Preserve it so the presentation
    // cannot accidentally fall back to "local Manaus" merely because Earth is out of scope.
    const alt = Number.isNaN(altitudeM) ? 0 : Math.max(0, altitudeM);
    const isAscending = alt >= this.lastAltitudeM;
    this.lastAltitudeM = alt;

    let localWeight = 1;
    let regionalWeight = 0;
    let planetWeight = 0;
    let phase: EarthTransitionPhase = 'LOCAL_ONLY';

    if (alt < EARTH_HANDOFF.requestPlanetM) {
      localWeight = 1;
      regionalWeight = 0;
      planetWeight = 0;
      phase = 'LOCAL_ONLY';
    } else if (alt < EARTH_HANDOFF.planetOwnsGroundM) {
      const t = (alt - EARTH_HANDOFF.requestPlanetM)
        / (EARTH_HANDOFF.planetOwnsGroundM - EARTH_HANDOFF.requestPlanetM);
      localWeight = 1 - t;
      regionalWeight = 0;
      planetWeight = t;
      phase = 'OVERLAP_SAFE';
    } else {
      planetWeight = 1;
      localWeight = 0;
      regionalWeight = 0;
      phase = alt >= EARTH_HANDOFF.orbitM ? 'PLANET_ONLY' : 'PLANET_DOMINANT';
    }

    let requiredLod = 0;
    if (alt < EARTH_HANDOFF.orbitM) requiredLod = 4;
    if (alt < 20_000) requiredLod = 6;

    const readiness = earth ? earth.readiness(requiredLod) : createDefaultReadiness(requiredLod);
    const targetCoverageReady = readiness.viewCoverageReady;

    // Readiness gates the one-way ascent handoff. Once planetary ground owns the view, transient
    // detailed-tile churn must not resurrect the 240 km flat sheet; the inset coarse fallback is
    // specifically there to keep that state continuous. Only a real descent below the hysteresis
    // threshold returns ownership to local ground.
    if (alt < EARTH_HANDOFF.returnLocalM) {
      this.groundOwner = 'local';
    } else if (
      this.groundOwner === 'local'
      && alt >= EARTH_HANDOFF.planetOwnsGroundM
      && targetCoverageReady
    ) {
      this.groundOwner = 'planet';
    }

    // Invariant: Never retire local representation until target representation is ready
    if (!targetCoverageReady && alt >= EARTH_HANDOFF.requestPlanetM && this.groundOwner === 'local') {
      localWeight = Math.max(localWeight, 1);
      regionalWeight = 0;
      planetWeight = 0;
      phase = isAscending ? 'REQUESTING_PLANET' : 'RETURNING_LOCAL';
    }

    // Ground ownership is a switch, not another alpha. The globe may already be visible in the
    // distance during OVERLAP_SAFE, but the flat patch remains the sole ground until the complete
    // coarse-or-detailed coverage contract is ready. Hysteresis prevents a 15 km camera hover
    // from alternating providers frame by frame.
    const localGroundVisible = this.groundOwner === 'local';
    const planetGroundDominant = !localGroundVisible;
    const presentationDomain: EarthPresentationDomain = alt >= EARTH_HANDOFF.orbitM
      ? 'orbital'
      : (planetWeight >= 0.5 || planetGroundDominant)
        ? 'planetary'
        : 'local';

    // Fold regionalWeight into effectiveLocalWeight so no altitude band is left without coverage
    const effectiveLocalWeight = localWeight + regionalWeight;
    const keepLocalFallback = localGroundVisible;

    return {
      localWeight,
      regionalWeight,
      planetWeight,
      atmosphereWeight: 1,
      targetCoverageReady,
      readiness,
      phase,
      effectiveLocalWeight,
      keepLocalFallback,
      groundOwner: this.groundOwner,
      localGroundVisible,
      planetGroundDominant,
      presentationDomain,
    };
  }
}
