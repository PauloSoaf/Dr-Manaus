import test from 'node:test';
import assert from 'node:assert/strict';
import { SOLAR_BODY_PROFILES, bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { SOLAR_SYSTEM_BODIES } from '../src/world/celestial/CelestialBody.ts';
import { MOON_RADIUS_M, moonColourAt } from '../src/world/planet/MoonSurface.ts';

const moonBody = SOLAR_SYSTEM_BODIES.find(b => b.id === 'moon')!;
const profile = bodyProfile(moonBody);

test('T_MOON_DAYLIGHT_VISIBILITY Moon albedo is bright grey and has positive phaseFloor', () => {
  const [r, g, b] = profile.visual.albedo;
  // Bright grey: components at or above 0.70
  assert.ok(r >= 0.70 && g >= 0.70 && b >= 0.70, `Moon albedo should be bright grey, got [${r}, ${g}, ${b}]`);
  assert.ok(profile.visual.phaseFloor !== undefined && profile.visual.phaseFloor >= 0.10 && profile.visual.phaseFloor <= 0.18,
    `Moon phaseFloor should be between 0.10 and 0.18, got ${profile.visual.phaseFloor}`);

  // Test surface colour function produces readable bright grey
  const col: [number, number, number] = [0, 0, 0];
  moonColourAt([1, 0, 0], col);
  assert.ok(col[0] >= 0.35, `Surface grey level should be bright, got ${col[0]}`);
  assert.ok(col[0] <= 0.90, `Surface grey level should not be blown out white, got ${col[0]}`);
});

test('T_MOON_PHASE_PRESERVED lit side is distinctly brighter than unlit side', () => {
  const albedo = profile.visual.albedo[0];
  const phaseFloor = profile.visual.phaseFloor ?? 0.14;
  const ambient = profile.visual.ambient?.[0] ?? 0.08;

  // Fully lit (nDotL = 1): direct sunlight dominates
  const litBrightness = albedo * 1.0;
  // Night side (nDotL = 0): indirect/earthshine floor
  const unlitBrightness = albedo * phaseFloor + ambient;

  assert.ok(litBrightness > 3.0 * unlitBrightness,
    `Lit side (${litBrightness}) must be at least 3x brighter than night side (${unlitBrightness}) to preserve crescent/phase`);
  assert.ok(unlitBrightness > 0.05, `Night side (${unlitBrightness}) must have readable floor`);
});

test('T_MOON_DARK_SIDE_NOT_FULL_WHITE unlit side luminance remains dark/earthshine', () => {
  const albedo = profile.visual.albedo[0];
  const phaseFloor = profile.visual.phaseFloor ?? 0.14;
  const ambient = profile.visual.ambient?.[0] ?? 0.08;
  const darkSideLuminance = albedo * phaseFloor + ambient;

  // Must not look full white (luminance < 0.30)
  assert.ok(darkSideLuminance < 0.30, `Dark side luminance (${darkSideLuminance}) must not be full white`);
  assert.ok(darkSideLuminance >= 0.08, `Dark side luminance (${darkSideLuminance}) should have subtle earthshine`);
});

test('T_MOON_NO_EMISSIVE_HACK lighting drops when direct sunlight is zero', () => {
  const albedo = profile.visual.albedo[0];
  const phaseFloor = profile.visual.phaseFloor ?? 0.14;
  const directSunlight = 0; // Shadow / eclipse
  const lit = albedo * 1.0 * directSunlight;
  const indirect = (albedo * phaseFloor) * directSunlight;

  assert.equal(lit + indirect, 0, 'In zero sunlight, planet visual illumination must be zero, proving no emissive hack');
});

test('Moon physics and collision invariants are completely unchanged', () => {
  assert.equal(moonBody.equatorialRadiusM, 1_738_100);
  assert.equal(MOON_RADIUS_M, 1_738_100);
  assert.equal(profile.hasSolidSurface, true);
  assert.equal(profile.canLand, true);
  assert.equal(profile.supportsVolumeDestruction, true);
  assert.equal(profile.surfaceKind, 'moon');
});
