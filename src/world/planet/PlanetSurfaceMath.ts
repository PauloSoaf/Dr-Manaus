import type { Vec3 } from '../spatial/units';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from './PlanetSurface';

/** Gradient of the actual ellipsoid + relief field. Shading normals may be exaggerated. */
export function surfaceOutwardNormal(surface: PlanetSurfaceGenerator, fixed: Vec3): Vec3 {
  const sample: Vec3 = [0, 0, 0], direction: Vec3 = [0, 0, 0], normal: Vec3 = [0, 0, 0];
  const clearance = (axis: number, offset: number) => {
    for (let i = 0; i < 3; i++) sample[i] = fixed[i] + (i === axis ? offset : 0);
    const radius = Math.hypot(...sample);
    for (let i = 0; i < 3; i++) direction[i] = sample[i] / (radius || 1);
    return radius - planetSurfaceRadius(surface, direction);
  };
  for (let i = 0; i < 3; i++) normal[i] = clearance(i, .5) - clearance(i, -.5);
  const length = Math.hypot(...normal);
  return length > 1e-12 ? [normal[0] / length, normal[1] / length, normal[2] / length] : [1, 0, 0];
}

