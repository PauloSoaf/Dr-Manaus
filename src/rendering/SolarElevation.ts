/**
 * Local solar geometry for the atmosphere layer.
 *
 * The game's `time` setting selects the *local* sun elevation of the ground sky. It is never an
 * authority for space lighting or for the Solar-system Sun body, which depend only on geometry.
 */
import type { TimeKind } from '../core/types';

/** Local sun elevation (radians above the horizon) for each time-of-day preset. */
export const LOCAL_SUN_ELEVATION_RAD: Readonly<Record<TimeKind, number>> = Object.freeze({
  Morning: .27,
  Noon: 1.1,
  'Golden Hour': .19,
  /** About -11.5 degrees: nautical dusk. The Sun is below the horizon at night. */
  Night: -.2,
});

/** Semantic rule: the Sun is up only above the geometric horizon. */
export const sunAboveHorizon = (elevationRad: number): boolean => elevationRad > 0;

/**
 * Night has no direct sunlight. A faint moonlight/skylight fill keeps the ground readable; it is
 * lifted above the horizon so it never lights surfaces from below.
 */
export const NIGHT_FILL_ELEVATION_RAD = .55;
export const NIGHT_FILL_INTENSITY = .1;

export interface LocalLightPlan {
  /** True sun elevation, may be negative. */
  readonly sunElevationRad: number;
  readonly sunUp: boolean;
  /** Elevation of the directional light actually placed in the scene. */
  readonly lightElevationRad: number;
  /** Multiplier applied to the preset's direct light intensity. */
  readonly directIntensityScale: number;
}

export function localLightPlan(time: TimeKind): LocalLightPlan {
  const sunElevationRad = LOCAL_SUN_ELEVATION_RAD[time];
  const sunUp = sunAboveHorizon(sunElevationRad);
  return {
    sunElevationRad, sunUp,
    lightElevationRad: sunUp ? sunElevationRad : NIGHT_FILL_ELEVATION_RAD,
    directIntensityScale: sunUp ? 1 : 0,
  };
}
