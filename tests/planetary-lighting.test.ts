import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_SUN_ELEVATION_RAD, NIGHT_FILL_INTENSITY, localLightPlan, sunAboveHorizon } from '../src/rendering/SolarElevation.ts';
import { isAngularlyOccluded, occludingBodyId, type OcclusionBody } from '../src/rendering/celestial/occlusion.ts';
import { angularRadiusRad } from '../src/rendering/celestial/math.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

const EARTH_R = 6_378_137, SUN_R = 695_700_000, AU = 1.495978707e11;
const body = (id: string, delta: Vec3, radius: number): OcclusionBody => {
  const d = Math.hypot(...delta);
  return { id, delta, distanceM: d, angularRadiusRad: angularRadiusRad(radius, d) };
};

test('T_NIGHT_LOCAL_SUN_BELOW_HORIZON night sun elevation is negative by rule', () => {
  assert.ok(LOCAL_SUN_ELEVATION_RAD.Night < 0);
  assert.equal(sunAboveHorizon(LOCAL_SUN_ELEVATION_RAD.Night), false);
  assert.equal(localLightPlan('Night').sunUp, false);
  for (const t of ['Morning', 'Noon', 'Golden Hour'] as const) assert.equal(localLightPlan(t).sunUp, true);
});

test('T_NIGHT_LOCAL_DIRECT_LIGHT_ZERO_OR_MINIMAL night direct light is a faint fill above the horizon', () => {
  const plan = localLightPlan('Night');
  assert.ok(NIGHT_FILL_INTENSITY <= .15);
  assert.equal(plan.directIntensityScale, 0);
  assert.ok(plan.lightElevationRad > 0, 'the fill never lights surfaces from below');
});

test('T_SUN_OCCLUDED_BY_EARTH sun directly behind Earth is hidden', () => {
  const earth = body('earth', [0, 0, -(EARTH_R + 400_000)], EARTH_R);
  const sun = body('sun', [0, 0, -AU], SUN_R);
  assert.equal(isAngularlyOccluded(sun, earth), true);
  assert.equal(occludingBodyId(sun, [earth, sun]), 'earth');
});

test('T_SUN_VISIBLE_IN_SPACE_WHEN_NOT_OCCLUDED sun beside Earth is visible', () => {
  const earth = body('earth', [0, 0, -(EARTH_R + 400_000)], EARTH_R);
  const sun = body('sun', [AU, 0, 0], SUN_R);
  assert.equal(isAngularlyOccluded(sun, earth), false);
  assert.equal(occludingBodyId(sun, [earth, sun]), undefined);
});

test('T_SUN_OCCLUDED_BY_EARTH on the ground the Sun below the horizon is hidden, above is visible', () => {
  const earth = body('earth', [0, -EARTH_R, 0], EARTH_R);
  assert.equal(isAngularlyOccluded(body('sun', [0, -AU, 0], SUN_R), earth), true);
  assert.equal(isAngularlyOccluded(body('sun', [0, AU, 0], SUN_R), earth), false);
});

test('T_SPACE_NOT_CONTROLLED_BY_NIGHT_SETTING occlusion depends on geometry only', () => {
  const earth = body('earth', [0, 0, -(EARTH_R + 400_000)], EARTH_R);
  const sun = body('sun', [AU, 0, 0], SUN_R);
  localLightPlan('Night');
  assert.equal(isAngularlyOccluded(sun, earth), false);
  localLightPlan('Noon');
  assert.equal(isAngularlyOccluded(sun, earth), false);
});

test('occlusion rejects a farther occluder and non-finite input', () => {
  const near = body('moon', [0, 0, -1e6], 1.7e6 * .5);
  const far = body('earth', [0, 0, -3.8e8], EARTH_R);
  assert.equal(isAngularlyOccluded(near, far), false);
  assert.equal(isAngularlyOccluded({ ...near, distanceM: NaN }, far), false);
});
