import { EarthProvider } from './EarthProvider';

export interface EarthTransitionState {
  localWeight: number;
  regionalWeight: number;
  planetWeight: number;
  atmosphereWeight: number;
  targetCoverageReady: boolean;
}

export class EarthTransitionController {
  update(altitudeM: number, earth: EarthProvider): EarthTransitionState {
    let localWeight = 1;
    let regionalWeight = 0;
    let planetWeight = 0;

    // As specified in 04-EARTH-ALTITUDE-TRANSITION.md
    if (altitudeM < 8000) {
      localWeight = 1;
    } else if (altitudeM < 20000) {
      const t = (altitudeM - 8000) / 12000;
      localWeight = 1 - t;
      regionalWeight = t;
    } else if (altitudeM < 60000) {
      const t = (altitudeM - 20000) / 40000;
      regionalWeight = 1 - t;
      planetWeight = t;
    } else {
      planetWeight = 1;
      localWeight = 0;
      regionalWeight = 0;
    }

    // Wait until the Earth has loaded at least the coarse tiles
    // If we are high enough, require lower LOD, if lower require higher LOD
    // But since cityOwnsGround skips level >= 8, max required is 7.
    let requiredLod = 0;
    if (altitudeM < 60000) requiredLod = 4;
    if (altitudeM < 20000) requiredLod = 6;
    
    const targetCoverageReady = earth.isCoverageReady(requiredLod);

    // "Nunca desligar representação atual e depois esperar a nova carregar"
    // "O blend não avança além do peso seguro se os tiles target não estiverem ativos."
    if (!targetCoverageReady) {
      // If the target representation is not ready, we hold onto the local representation
      localWeight = Math.max(localWeight, 1);
      regionalWeight = 0;
      planetWeight = 0;
    }

    return {
      localWeight,
      regionalWeight,
      planetWeight,
      atmosphereWeight: 1, // Atmosphere fades are handled separately or later
      targetCoverageReady,
    };
  }
}
