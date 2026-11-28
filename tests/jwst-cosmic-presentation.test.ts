import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import {
  JWSTCosmicPresentation,
  CURATED_JWST_NEBULAE,
} from '../src/rendering/JWSTCosmicPresentation.ts';

test('JWST-COSMIC: Curated nebulae contain iconic JWST targets', () => {
  assert.ok(CURATED_JWST_NEBULAE.length >= 4);

  const pillars = CURATED_JWST_NEBULAE.find(n => n.type === 'pillars-of-creation');
  assert.ok(pillars, 'Must include Pillars of Creation');
  assert.ok(pillars.name.includes('Pilares'));

  const cliffs = CURATED_JWST_NEBULAE.find(n => n.type === 'cosmic-cliffs');
  assert.ok(cliffs, 'Must include Cosmic Cliffs');

  const tarantula = CURATED_JWST_NEBULAE.find(n => n.type === 'tarantula-starburst');
  assert.ok(tarantula, 'Must include Tarantula Nebula');

  const lens = CURATED_JWST_NEBULAE.find(n => n.type === 'gravitational-arcs');
  assert.ok(lens, 'Must include Deep Field gravitational arcs');
});

test('JWST-COSMIC: Presentation builds starbursts and nebulae attached to root', () => {
  const presentation = new JWSTCosmicPresentation();

  // Root contains starbursts and nebulae
  assert.ok(presentation.root.children.length >= 8);

  // Update in atmosphere (spaceFactor = 0): should be invisible
  presentation.update(new Vector3(0, 100, 0), 0);
  assert.equal(presentation.root.visible, false);

  // Update in space (spaceFactor = 1.0): should be visible and ride camera position
  const camPos = new Vector3(5000, 200000, -12000);
  presentation.update(camPos, 1.0);
  assert.equal(presentation.root.visible, true);
  assert.deepEqual(presentation.root.position, camPos);

  presentation.dispose();
});
