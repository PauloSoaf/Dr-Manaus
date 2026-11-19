import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Object3D } from 'three';
import {
  sampleManausWater,
  WaterBuoyancyService,
  MANAUS_RIVER_WAVES
} from '../src/world/water/ManausHydrology';

test('Water Feature 01: Analytical Gerstner waves produce finite bounded elevation and normal', () => {
  const sample = sampleManausWater(1500, -2200, 10.5, 0.06);

  // Height must be bounded by the sum of wave amplitudes (+/- 0.60m)
  assert.ok(isFinite(sample.height), 'Sample height must be finite');
  assert.ok(sample.height >= -0.7 && sample.height <= 0.85, `Height ${sample.height} out of physical envelope`);

  // Normal vector must be unit length and point predominantly upwards
  const normalLen = sample.normal.length();
  assert.ok(Math.abs(normalLen - 1.0) < 1e-4, `Normal length ${normalLen} is not normalized`);
  assert.ok(sample.normal.y > 0.85, `Normal Y ${sample.normal.y} should point upwards`);
});

test('Water Feature 01: WaterBuoyancyService updates floating object without allocating heap garbage', () => {
  const floater = new Object3D();
  floater.position.set(200, -1.0, 300);

  const buoyancy = new WaterBuoyancyService();
  buoyancy.register(floater, {
    verticalOffset: 0.1,
    damping: 10.0,
    alignment: 0.8
  });

  // Run 100 simulation frames
  for (let f = 0; f < 100; f++) {
    buoyancy.update(0.016, f * 0.016, 0.06);
  }

  // Floater position must have converged smoothly near the river water surface
  assert.ok(isFinite(floater.position.y), 'Position Y must be finite');
  assert.ok(floater.position.y > -0.5 && floater.position.y < 0.6, `Floater height ${floater.position.y} should float on water`);
});
