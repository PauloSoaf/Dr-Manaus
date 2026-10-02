import type { Vec3 } from '../spatial/units';
import { polarRadiusM, type PlanetBody } from './PlanetBody';

export interface PlanetSurfaceGenerator {
  readonly body: PlanetBody;
  readonly radiusM: number;
  /** Optional bounded detail for orbital appearance; local streamed tiles stay at the default. */
  readonly coarseResolution?: number;
  /** Conservative radial envelope for fallback facets, never used for physics. */
  fallbackRadiusAt?(direction: Vec3, angularNeighbourhoodRad: number): number;
  /** Radial relief above the body's ellipsoid, sampled by geocentric direction. */
  heightAt(direction: Vec3): number;
  normalEnu(direction: Vec3, out: Vec3): void;
  colourAt(direction: Vec3, out: [number, number, number]): void;
}

/** Shared ellipsoid/relief model for streamed vertices and local terrain collision. */
export function planetSurfaceRadius(surface: PlanetSurfaceGenerator, direction: Vec3, flat = false): number {
  const a = surface.body.semiMajorAxisM, b = polarRadiusM(surface.body);
  const radius = 1 / Math.sqrt((direction[0] ** 2 + direction[1] ** 2) / (a * a) + direction[2] ** 2 / (b * b));
  return radius + (flat ? 0 : surface.heightAt(direction));
}
