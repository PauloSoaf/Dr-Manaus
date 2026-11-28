import type { Vec3 } from '../spatial/units';
import { polarRadiusM, type PlanetBody } from './PlanetBody';

/**
 * The ellipsoid-plus-relief field shared by physics, meshes and workers.
 * Free of Three.js so generation workers can evaluate exactly what physics collides with.
 */
export interface PlanetSurfaceGenerator {
  readonly body: PlanetBody;
  readonly radiusM: number;
  readonly coarseResolution?: number;
  fallbackRadiusAt?(direction: Vec3, angularNeighbourhoodRad: number): number;
  heightAt(direction: Vec3): number;
  solidHeightAt?(direction: Vec3): number;
  normalEnu(direction: Vec3, out: Vec3): void;
  colourAt(direction: Vec3, out: [number, number, number]): void;
  biomeAt?(direction: Vec3): import('../life/PlanetaryBiomeService').PlanetaryBiomeSample;
}

/** Shared ellipsoid/relief model for streamed vertices and local terrain collision. */
export function planetSurfaceRadius(surface: PlanetSurfaceGenerator, direction: Vec3, flat = false, solid = false): number {
  const a = surface.body.semiMajorAxisM, b = polarRadiusM(surface.body);
  const radius = 1 / Math.sqrt((direction[0] ** 2 + direction[1] ** 2) / (a * a) + direction[2] ** 2 / (b * b));
  const h = solid && surface.solidHeightAt ? surface.solidHeightAt(direction) : surface.heightAt(direction);
  return radius + (flat ? 0 : h);
}
