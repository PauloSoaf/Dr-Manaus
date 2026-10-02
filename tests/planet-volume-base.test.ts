import test from 'node:test';
import assert from 'node:assert/strict';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface.ts';
import { MarsSurfaceGenerator } from '../src/world/planet/MarsSurface.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface.ts';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

/** Deterministic, nearly uniform directions with no random state or pole duplicates. */
function fibonacciDirections(count: number): Vec3[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const z = 1 - 2 * ((index + 0.5) / count);
    const radial = Math.sqrt(1 - z * z);
    const angle = index * goldenAngle;
    return [Math.cos(angle) * radial, Math.sin(angle) * radial, z];
  });
}

const surfaces: readonly PlanetSurfaceGenerator[] = [
  EarthSurfaceGenerator,
  MoonSurfaceGenerator,
  MarsSurfaceGenerator,
];

for (const surface of surfaces) {
  test(`${surface.body.id} volume base agrees with its surface generator in thousands of directions`, () => {
    const field = new PlanetVolumeField(surface);
    for (const direction of fibonacciDirections(2_048)) {
      const radius = planetSurfaceRadius(surface, direction);
      const at = direction.map(component => component * radius) as Vec3;
      const outside = direction.map(component => component * (radius + 100)) as Vec3;
      const inside = direction.map(component => component * (radius - 100)) as Vec3;

      assert.ok(Math.abs(field.signedDistanceBodyFixed(at)) < 1e-6, `${surface.body.id} surface drifted`);
      assert.ok(field.signedDistanceBodyFixed(outside) > 99.999, `${surface.body.id} outside was not empty`);
      assert.ok(field.signedDistanceBodyFixed(inside) < -99.999, `${surface.body.id} inside was not solid`);
    }
    assert.equal(field.body, surface.body);
    assert.ok(field.signedDistanceBodyFixed([0, 0, 0]) < 0, 'the body centre is solid before edits');
    const reusable = { distanceM: Number.NaN, material: '' };
    assert.equal(field.sampleBodyFixed([0, 0, 0], reusable), reusable);
    assert.equal(reusable.distanceM, field.signedDistanceBodyFixed([0, 0, 0]));
    assert.equal(reusable.material, `${surface.body.id}:interior`);
  });
}
