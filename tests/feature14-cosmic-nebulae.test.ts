import test from 'node:test';
import assert from 'node:assert/strict';
import { Color, Vector3 } from 'three';
import { CosmicNebulaeSystem, JWST_NIRCAM_FILTERS } from '../src/world/sky/CosmicNebulaeSystem';

test('CT-14-01: CosmicNebulaeSystem registers the 4 canonical JWST nebulae with NIRCam color palettes', () => {
  const system = new CosmicNebulaeSystem();
  const list = system.getNebulaeList();

  assert.strictEqual(list.length, 4, 'Should contain exactly 4 canonical JWST nebulae');

  const ids = list.map(n => n.id);
  assert.ok(ids.includes('pillars_of_creation'), 'Must contain Pillars of Creation');
  assert.ok(ids.includes('carina_cosmic_cliffs'), 'Must contain Carina Cosmic Cliffs');
  assert.ok(ids.includes('southern_ring'), 'Must contain Southern Ring Nebula');
  assert.ok(ids.includes('tarantula_30_doradus'), 'Must contain Tarantula 30 Doradus');

  // Verify JWST optical filter specs
  assert.strictEqual(JWST_NIRCAM_FILTERS.length, 5);
  const filterCodes = JWST_NIRCAM_FILTERS.map(f => f.code);
  assert.ok(filterCodes.includes('F090W'));
  assert.ok(filterCodes.includes('F444W'));

  system.dispose();
});

test('CT-14-02: Volumetric immersion detection and Beer-Lambert ambient tinting', () => {
  const system = new CosmicNebulaeSystem();
  const tintColor = new Color();

  // Test 1: Camera far away at origin (Earth vicinity)
  const outsidePos = new Vector3(0, 0, 0);
  const isOutside = system.getAtmosphereTint(outsidePos, tintColor);
  assert.strictEqual(isOutside, false, 'Origin is in clear space outside all nebulae');

  // Test 2: Camera placed inside Pillars of Creation volume
  const pillars = system.getNebulaeList().find(n => n.id === 'pillars_of_creation')!;
  const insidePillarsPos = pillars.position.clone(); // Exactly at center
  const isInside = system.getAtmosphereTint(insidePillarsPos, tintColor);

  assert.strictEqual(isInside, true, 'Camera at center must be detected as immersed in nebula gas');
  // Tint color should have non-zero RGB components blending primary and core
  assert.ok(tintColor.r > 0 || tintColor.g > 0 || tintColor.b > 0, 'Nebula gas must emit ambient tint');

  system.dispose();
});

test('CT-14-03: Nearest nebula spatial distance and volume detection', () => {
  const system = new CosmicNebulaeSystem();
  const carina = system.getNebulaeList().find(n => n.id === 'carina_cosmic_cliffs')!;

  // Point placed 50,000 km outside Carina
  const nearCarina = carina.position.clone().add(new Vector3(50_000_000, 0, 0));
  const telemetry = system.getNearestNebula(nearCarina);

  assert.ok(telemetry !== null);
  assert.strictEqual(telemetry!.id, 'carina_cosmic_cliffs');
  assert.ok(
    Math.abs(telemetry!.distanceM - 50_000_000) < 1.0,
    `Distance to Carina should be 50,000 km: got ${telemetry!.distanceM}`
  );

  system.dispose();
});

test('CT-14-04: Embedded star cluster pulsation and clean disposal', () => {
  const system = new CosmicNebulaeSystem();

  // Update over frames
  system.update(new Vector3(0, 0, 0), 0.016);
  system.update(new Vector3(0, 0, 0), 0.016);

  assert.ok(system.root.children.length > 0, 'Nebula root must contain meshes');

  system.dispose();
  assert.strictEqual(system.root.children.length, 0, 'Disposal must clear all child meshes from scene');
});

