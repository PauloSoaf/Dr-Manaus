/**
 * LocalSurface.ts
 *
 * Where the ground and mean sea level lie inside a tangent chart, evaluated one way for everybody.
 *
 * A chart is the local frame gameplay runs in: +X east, +Y up, +Z south, anchored on the reference
 * ellipsoid. Physics, chunk generation in workers, water sampling and distant terrain all call
 * these functions, so what is drawn is what is collided with, including the curvature that makes
 * the ground sink below the tangent plane away from the anchor. Pure arithmetic: worker safe.
 */
import { geodeticToEcef } from '../spatial/ECEF';
import { enuBasis } from '../spatial/ENU';
import type { GeodeticPosition } from '../spatial/Geodetic';
import { degToRad, type Vec3 } from '../spatial/units';
import { directionToGeodetic } from './CubeSphere';
import { polarRadiusM, type PlanetBody } from './PlanetBody';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from './PlanetSurfaceField';

export interface LocalSurfaceChart {
  readonly latDeg: number;
  readonly lonDeg: number;
  /** Anchor in body-fixed coordinates, on the reference ellipsoid. */
  readonly origin: Readonly<Vec3>;
  /** Body-fixed unit vectors of local +X, +Y and +Z. */
  readonly east: Readonly<Vec3>;
  readonly up: Readonly<Vec3>;
  readonly south: Readonly<Vec3>;
}

/** The same anchor construction the surface reference frames of the Earth are registered with. */
export function earthSurfaceChart(latDeg: number, lonDeg: number): LocalSurfaceChart {
  const anchor = { latRad: degToRad(latDeg), lonRad: degToRad(lonDeg), heightM: 0 };
  const ecef = geodeticToEcef(anchor);
  const basis = enuBasis(anchor);
  return {
    latDeg, lonDeg,
    origin: [ecef.xM, ecef.yM, ecef.zM],
    east: [basis.east[0], basis.east[1], basis.east[2]],
    up: [basis.up[0], basis.up[1], basis.up[2]],
    south: [-basis.north[0], -basis.north[1], -basis.north[2]],
  };
}

export function chartToFixed(chart: LocalSurfaceChart, x: number, y: number, z: number, out: Vec3 = [0, 0, 0]): Vec3 {
  for (let i = 0; i < 3; i++) out[i] = chart.origin[i] + chart.east[i] * x + chart.up[i] * y + chart.south[i] * z;
  return out;
}

export function fixedToChart(chart: LocalSurfaceChart, point: Readonly<Vec3>, out: Vec3 = [0, 0, 0]): Vec3 {
  const dx = point[0] - chart.origin[0], dy = point[1] - chart.origin[1], dz = point[2] - chart.origin[2];
  out[0] = chart.east[0] * dx + chart.east[1] * dy + chart.east[2] * dz;
  out[1] = chart.up[0] * dx + chart.up[1] * dy + chart.up[2] * dz;
  out[2] = chart.south[0] * dx + chart.south[1] * dy + chart.south[2] * dz;
  return out;
}

/** Distance along `up` from `origin` to the reference ellipsoid; -Infinity past the tangent horizon. */
export function verticalEllipsoidHeight(body: PlanetBody, origin: Readonly<Vec3>, up: Readonly<Vec3>): number {
  const a2 = body.semiMajorAxisM ** 2, b2 = polarRadiusM(body) ** 2;
  const aa = (up[0] * up[0] + up[1] * up[1]) / a2 + up[2] * up[2] / b2;
  const bb = 2 * ((origin[0] * up[0] + origin[1] * up[1]) / a2 + origin[2] * up[2] / b2);
  const cc = (origin[0] * origin[0] + origin[1] * origin[1]) / a2 + origin[2] * origin[2] / b2 - 1;
  const discriminant = bb * bb - 4 * aa * cc;
  // The tangent chart has no floor beyond the horizon. Never invent a plane there.
  return discriminant < 0 ? Number.NEGATIVE_INFINITY : (-bb + Math.sqrt(discriminant)) / (2 * aa);
}

const scratchPoint: Vec3 = [0, 0, 0];
const scratchDirection: Vec3 = [0, 0, 0];

function radialClearance(body: PlanetBody, surface: PlanetSurfaceGenerator, origin: Readonly<Vec3>, up: Readonly<Vec3>,
  distance: number, solid: boolean): number {
  for (let i = 0; i < 3; i++) scratchPoint[i] = origin[i] + up[i] * distance;
  const radius = Math.hypot(scratchPoint[0], scratchPoint[1], scratchPoint[2]);
  if (radius < 1) return -body.semiMajorAxisM;
  for (let i = 0; i < 3; i++) scratchDirection[i] = scratchPoint[i] / radius;
  return radius - planetSurfaceRadius(surface, scratchDirection, false, solid);
}

/**
 * Height along the vertical through `origin` at which the relief surface lies.
 *
 * Starts at the exact ellipsoid intersection and solves the shared relief field along the local
 * vertical, because sampling only the anchor's direction would miss both slopes and sag.
 */
export function verticalSurfaceHeight(body: PlanetBody, surface: PlanetSurfaceGenerator, origin: Readonly<Vec3>,
  up: Readonly<Vec3>, solid = true): number {
  let height = verticalEllipsoidHeight(body, origin, up);
  if (!Number.isFinite(height)) return height;
  for (let i = 0; i < 12; i++) {
    const error = radialClearance(body, surface, origin, up, height, solid);
    if (Math.abs(error) < 0.0001) return height;
    const above = radialClearance(body, surface, origin, up, height + 0.5, solid);
    const derivative = above - radialClearance(body, surface, origin, up, height - 0.5, solid);
    if (derivative < 0.01) return Number.NEGATIVE_INFINITY;
    height -= error / derivative;
  }
  return Math.abs(radialClearance(body, surface, origin, up, height, solid)) < 0.01 ? height : Number.NEGATIVE_INFINITY;
}

const chartOrigin: Vec3 = [0, 0, 0];

/** Local Y of the solid (or drawn) surface under (x, z). */
export function localSurfaceY(chart: LocalSurfaceChart, body: PlanetBody, surface: PlanetSurfaceGenerator,
  x: number, z: number, solid = true): number {
  chartToFixed(chart, x, 0, z, chartOrigin);
  return verticalSurfaceHeight(body, surface, chartOrigin, chart.up, solid);
}

/** Local Y of mean sea level under (x, z): the ellipsoid, which sags below the tangent plane. */
export function localSeaLevelY(chart: LocalSurfaceChart, body: PlanetBody, x: number, z: number): number {
  chartToFixed(chart, x, 0, z, chartOrigin);
  return verticalEllipsoidHeight(body, chartOrigin, chart.up);
}

const geodeticPoint: Vec3 = [0, 0, 0];

/** Geodetic coordinate of the local point (x, y, z), using the convention the relief field samples. */
export function localGeodetic(chart: LocalSurfaceChart, x: number, y: number, z: number): GeodeticPosition {
  chartToFixed(chart, x, y, z, geodeticPoint);
  const radius = Math.hypot(geodeticPoint[0], geodeticPoint[1], geodeticPoint[2]) || 1;
  geodeticPoint[0] /= radius; geodeticPoint[1] /= radius; geodeticPoint[2] /= radius;
  return directionToGeodetic(geodeticPoint);
}
