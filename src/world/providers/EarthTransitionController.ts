import { EarthProvider } from './EarthProvider';
import { type EarthCoverageReadiness, createDefaultReadiness } from './EarthCoverageReadiness';

export type EarthTransitionPhase =
  | 'LOCAL_ONLY'
  | 'REQUESTING_PLANET'
  | 'OVERLAP_SAFE'
  | 'PLANET_DOMINANT'
  | 'PLANET_ONLY'
  | 'RETURNING_LOCAL';

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
}

export class EarthTransitionController {
  private lastAltitudeM = 0;

  update(altitudeM: number, earth?: EarthProvider): EarthTransitionState {
    const alt = Number.isFinite(altitudeM) ? Math.max(0, altitudeM) : 0;
    const isAscending = alt >= this.lastAltitudeM;
    this.lastAltitudeM = alt;

    let localWeight = 1;
    let regionalWeight = 0;
    let planetWeight = 0;
    let phase: EarthTransitionPhase = 'LOCAL_ONLY';

    if (alt < 8000) {
      localWeight = 1;
      regionalWeight = 0;
      planetWeight = 0;
      phase = 'LOCAL_ONLY';
    } else if (alt < 60000) {
      const t = (alt - 8000) / 52000;
      localWeight = 1 - t;
      regionalWeight = 0;
      planetWeight = t;
      phase = t > 0.5 ? 'PLANET_DOMINANT' : 'OVERLAP_SAFE';
    } else {
      planetWeight = 1;
      localWeight = 0;
      regionalWeight = 0;
      phase = 'PLANET_ONLY';
    }

    let requiredLod = 0;
    if (alt < 60000) requiredLod = 4;
    if (alt < 20000) requiredLod = 6;

    const readiness = earth ? earth.readiness(requiredLod) : createDefaultReadiness(requiredLod);
    const targetCoverageReady = readiness.viewCoverageReady;

    // Invariant: Never retire local representation until target representation is ready
    if (!targetCoverageReady && alt >= 8000) {
      localWeight = Math.max(localWeight, 1);
      regionalWeight = 0;
      planetWeight = 0;
      phase = isAscending ? 'REQUESTING_PLANET' : 'RETURNING_LOCAL';
    }

    // Fold regionalWeight into effectiveLocalWeight so no altitude band is left without coverage
    const effectiveLocalWeight = localWeight + regionalWeight;
    const keepLocalFallback = !targetCoverageReady || effectiveLocalWeight > 0.01;

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
    };
  }
}
