import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector2, Vector3 } from 'three/webgpu';
import {
  projectToScreen,
  ZeroReflowDOMCache,
  DiegeticHUD,
} from '../src/ui/DiegeticHUD.ts';
import type { Target } from '../src/core/types.ts';
import type { SpeciesProfile } from '../src/world/life/CosmicSpeciesScanner.ts';

test('FEATURE 17: 1. projectToScreen maps 3D world to 2D viewport with frustum culling (CT-18-01 & CT-18-02)', () => {
  const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1); // Looking along negative Z
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const screenWidth = 1920;
  const screenHeight = 1080;
  const screenPos = new Vector2();

  // 1. Point straight ahead (at -10m along camera view): must project to center of screen (CT-18-01)
  const centerTarget = new Vector3(0, 0, -10);
  const visible = projectToScreen(centerTarget, camera, screenWidth, screenHeight, screenPos);
  assert.equal(visible, true, 'Point in front of camera must project');
  assert.ok(Math.abs(screenPos.x - screenWidth / 2) < 1.0, 'Center point maps to screen width / 2');
  assert.ok(Math.abs(screenPos.y - screenHeight / 2) < 1.0, 'Center point maps to screen height / 2');

  // 2. Point behind the camera (at +10m behind camera): must be culled (CT-18-02)
  const behindTarget = new Vector3(0, 0, 10);
  const behindVisible = projectToScreen(behindTarget, camera, screenWidth, screenHeight, screenPos);
  assert.equal(behindVisible, false, 'Target behind camera must return false and not render in HUD');
});

test('FEATURE 17: 2. ZeroReflowDOMCache eliminates layout thrashing and avoids redundant DOM writes (CT-18-03)', () => {
  const cache = new ZeroReflowDOMCache();

  // Mock DOM Element
  const mockElement = {
    textContent: '',
    style: { transform: '' },
  } as unknown as HTMLElement;

  // Initial write: executed
  cache.setCachedText(mockElement, '120 km/h');
  assert.equal(mockElement.textContent, '120 km/h');
  assert.equal(cache.metrics.domWritesExecuted, 1);
  assert.equal(cache.metrics.domWritesAvoided, 0);

  // 1,000 subsequent frames with identical speed: zero DOM writes!
  for (let i = 0; i < 1000; i++) {
    cache.setCachedText(mockElement, '120 km/h');
  }
  assert.equal(cache.metrics.domWritesExecuted, 1, 'DOM textContent should not have been updated');
  assert.equal(cache.metrics.domWritesAvoided, 1000, 'All 1,000 redundant writes avoided without layout thrashing');

  // Change value: executed once
  cache.setCachedText(mockElement, '125 km/h');
  assert.equal(mockElement.textContent, '125 km/h');
  assert.equal(cache.metrics.domWritesExecuted, 2);

  // Transform3d caching: avoids style recalc when transform unchanged
  cache.setCachedTransform3d(mockElement, 150.0, 200.0, 0, 1.0);
  assert.ok(mockElement.style.transform.includes('translate3d(150.0px, 200.0px, 0.0px)'));
  assert.equal(cache.metrics.domWritesExecuted, 3);

  // 500 identical transform updates: zero style recalculations
  for (let i = 0; i < 500; i++) {
    cache.setCachedTransform3d(mockElement, 150.0, 200.0, 0, 1.0);
  }
  assert.equal(cache.metrics.domWritesExecuted, 3);
  assert.equal(cache.metrics.domWritesAvoided, 1500);
});

test('FEATURE 17: 3. DiegeticHUD in-world 3D brackets billboarding and color coding', () => {
  const diegetic = new DiegeticHUD();
  const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.set(0, 0, 0);

  const targets: Target[] = [
    {
      id: 'target-creature-01',
      kind: 'creature',
      position: new Vector3(0, 0, 50),
      radius: 5,
      active: true,
    },
    {
      id: 'planet-titan-core',
      kind: 'creature',
      position: new Vector3(100, 20, 500),
      radius: 40000,
      active: true,
    },
  ];

  // Update diegetic HUD with target-creature-01 soft-target locked
  diegetic.update(camera, 0.016, targets, 'target-creature-01');

  // Root should contain brackets
  assert.equal(diegetic.root.children.length, 8);

  // First bracket: soft-target locked (Cyan 0x00f0ff)
  const b0 = (diegetic as any).brackets[0];
  assert.equal(b0.active, true);
  assert.equal(b0.mesh.visible, true);
  assert.equal(b0.material.color.getHex(), 0x00f0ff);

  // Second bracket: boss vulnerable core (Magenta 0xff3366)
  const b1 = (diegetic as any).brackets[1];
  assert.equal(b1.active, true);
  assert.equal(b1.mesh.visible, true);
  assert.equal(b1.material.color.getHex(), 0xff3366);

  // Third bracket (unused): deactivated
  const b2 = (diegetic as any).brackets[2];
  assert.equal(b2.active, false);
  assert.equal(b2.mesh.visible, false);

  diegetic.dispose();
});

test('FEATURE 17: 4. Cosmic Species Scanner taxonomic visor profile lifecycle', () => {
  const diegetic = new DiegeticHUD();

  const profile: SpeciesProfile = {
    speciesId: 'drm:species:creature:aerovoador',
    commonName: 'Aerovoador da Nebulosa',
    scientificName: 'Aeroavis nebulosa',
    category: 'fauna',
    originBodyId: 'carina_cliffs',
    morphology: 'flying-mantis',
    diet: 'stellar-plasma',
    temperament: 'curious',
    threatLevel: 2,
    description: 'Criatura bioluminescente nativa dos pilares cósmicos.',
  };

  // Show taxonomic profile
  diegetic.showTaxonomicProfile(profile, 1450, true);
  assert.equal((diegetic as any).activeProfile, profile);
  assert.equal((diegetic as any).profileDistanceM, 1450);
  assert.equal((diegetic as any).profileIsNew, true);

  const camera = new PerspectiveCamera(60, 1, 0.1, 100);

  // Advance time by 3 seconds: profile still active
  diegetic.update(camera, 3.0, []);
  assert.ok((diegetic as any).profileTimer > 0);
  assert.equal((diegetic as any).activeProfile, profile);

  // Advance time past 6 seconds: auto-dismissed
  diegetic.update(camera, 4.0, []);
  assert.equal((diegetic as any).activeProfile, null);

  diegetic.dispose();
});

