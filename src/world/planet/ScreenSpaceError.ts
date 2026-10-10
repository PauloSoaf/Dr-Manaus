import { finite } from '../spatial/units';

/**
 * Screen-space error: how many pixels of visible wrongness a tile still carries.
 *
 * Distance-based LOD rings work for a city because the camera's field of view and resolution are
 * effectively fixed. They stop working on a planet, where the same tile is a horizon at one
 * moment and a continent at the next. The projected error is the honest measure:
 *
 *   sse = geometricError * viewportHeight / (2 * distance * tan(fov / 2))
 *
 * which is the error's size in pixels if it were a feature of that size at that distance.
 */
export interface ScreenSpaceErrorContext {
  /** Vertical field of view, radians. */
  readonly fovRad: number;
  /** Viewport height, pixels. */
  readonly viewportHeightPx: number;
  /** Pixels of error tolerated before a tile must refine. Lower is sharper and more expensive. */
  readonly targetPx: number;
  /** Quality preset multiplier. Below one raises the effective target, coarsening everything. */
  readonly detailFactor: number;
}

export const DEFAULT_SSE: ScreenSpaceErrorContext = {
  fovRad: 58 * Math.PI / 180,
  viewportHeightPx: 1080,
  targetPx: 8,
  detailFactor: 1,
};

/** Pixels of error a geometric error of `geometricErrorM` subtends at `distanceM`. */
export function screenSpaceError(
  geometricErrorM: number,
  distanceM: number,
  context: ScreenSpaceErrorContext,
): number {
  const error = Math.max(0, finite(geometricErrorM));
  const distance = Math.max(1e-3, finite(distanceM));
  const fov = Math.min(Math.PI - 1e-6, Math.max(1e-6, finite(context.fovRad, DEFAULT_SSE.fovRad)));
  const height = Math.max(1, finite(context.viewportHeightPx, DEFAULT_SSE.viewportHeightPx));
  return (error * height) / (2 * distance * Math.tan(fov / 2));
}

/** The error target after the quality preset has had its say. */
export function effectiveTargetPx(context: ScreenSpaceErrorContext): number {
  const detail = Math.max(0.05, finite(context.detailFactor, 1));
  return Math.max(0.5, finite(context.targetPx, DEFAULT_SSE.targetPx)) / detail;
}

/** Whether a tile is too coarse for where the camera is. */
export function shouldRefine(
  geometricErrorM: number,
  distanceM: number,
  context: ScreenSpaceErrorContext,
): boolean {
  return screenSpaceError(geometricErrorM, distanceM, context) > effectiveTargetPx(context);
}

/**
 * The distance at which a given geometric error exactly meets the target — the radius at which a
 * tile becomes good enough. Useful for prefetching: it says where a tile *will* be wanted, rather
 * than only whether it is wanted now.
 */
export function refinementDistanceM(geometricErrorM: number, context: ScreenSpaceErrorContext): number {
  const error = Math.max(0, finite(geometricErrorM));
  if (error <= 0) return 0;
  const fov = Math.min(Math.PI - 1e-6, Math.max(1e-6, finite(context.fovRad, DEFAULT_SSE.fovRad)));
  const height = Math.max(1, finite(context.viewportHeightPx, DEFAULT_SSE.viewportHeightPx));
  return (error * height) / (2 * effectiveTargetPx(context) * Math.tan(fov / 2));
}
