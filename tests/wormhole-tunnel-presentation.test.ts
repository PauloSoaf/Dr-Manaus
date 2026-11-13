import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera } from 'three/webgpu';
import {
  WormholeTunnelPresentation,
  resolveWormholePhaseProfile,
} from '../src/rendering/WormholeTunnelPresentation';

test('T_WORMHOLE_01_INITIAL_STATE_IDLE', () => {
  const parent = new Group();
  const presentation = new WormholeTunnelPresentation(parent);

  assert.equal(presentation.root.visible, false);
  assert.equal(presentation.snapshot, undefined);
  assert.equal(parent.children.includes(presentation.root), true);

  presentation.dispose();
  assert.equal(parent.children.includes(presentation.root), false);
});

test('T_WORMHOLE_02_PHASE_PROFILES_AND_PALETTES', () => {
  // 1. Entry phase
  const entry = resolveWormholePhaseProfile('event-horizon-entry', 0.1);
  assert.ok(entry.throatRadiusM > 0);
  assert.ok(entry.opacity > 0);
  assert.ok(entry.swirlSpeedRadPerS > 0);
  assert.equal(entry.primaryColor[0], 0.55); // Violet

  // 2. Tunnel phase
  const tunnel = resolveWormholePhaseProfile('wormhole-tunnel', 0.5);
  assert.ok(tunnel.throatRadiusM < entry.throatRadiusM, 'Throat in tunnel must be contracted');
  assert.ok(tunnel.streamSpeedMps > entry.streamSpeedMps, 'Stream speed in tunnel must be extreme');
  assert.equal(tunnel.primaryColor[0], 0.10); // Cyan
  assert.equal(tunnel.secondaryColor[0], 0.75); // Lavender

  // 3. Emergence phase
  const emergence = resolveWormholePhaseProfile('destination-emergence', 0.9);
  assert.ok(emergence.throatRadiusM > tunnel.throatRadiusM, 'Emergence flaring must expand throat');
  assert.equal(emergence.primaryColor[0], 1.0); // Gold
  assert.equal(emergence.secondaryColor[0], 1.0); // White

  // 4. Idle/completed
  const idle = resolveWormholePhaseProfile('idle', 0);
  assert.equal(idle.opacity, 0);
  assert.equal(idle.streamSpeedMps, 0);
});

test('T_WORMHOLE_03_REDUCED_MOTION_SAFETY', () => {
  const normal = resolveWormholePhaseProfile('wormhole-tunnel', 0.5, false);
  const reduced = resolveWormholePhaseProfile('wormhole-tunnel', 0.5, true);

  assert.ok(reduced.streamSpeedMps < normal.streamSpeedMps);
  assert.ok(reduced.swirlSpeedRadPerS < normal.swirlSpeedRadPerS);
  assert.ok(reduced.opacity <= 0.5);
});

test('T_WORMHOLE_04_PRESENTATION_LIFECYCLE_AND_UPDATE', () => {
  const parent = new Group();
  const camera = new PerspectiveCamera(60, 1.0, 0.1, 1000);
  camera.position.set(100, 200, 300);
  camera.updateMatrixWorld();

  const presentation = new WormholeTunnelPresentation(parent);

  // 1. Update in entry phase
  presentation.update({ phase: 'event-horizon-entry', progress01: 0.15 }, camera, 0.016);
  assert.equal(presentation.root.visible, true);
  assert.ok(presentation.snapshot);
  assert.equal(presentation.snapshot?.phase, 'event-horizon-entry');
  assert.equal(presentation.snapshot?.progress01, 0.15);
  assert.equal(presentation.root.position.x, 100);
  assert.equal(presentation.root.position.y, 200);
  assert.equal(presentation.root.position.z, 300);

  // 2. Update in tunnel phase
  presentation.update({ phase: 'wormhole-tunnel', progress01: 0.50 }, camera, 0.016);
  assert.equal(presentation.root.visible, true);
  assert.equal(presentation.snapshot?.phase, 'wormhole-tunnel');

  // 3. Update in emergence phase
  presentation.update({ phase: 'destination-emergence', progress01: 0.85 }, camera, 0.016);
  assert.equal(presentation.root.visible, true);
  assert.equal(presentation.snapshot?.phase, 'destination-emergence');

  // 4. Update in completed / undefined phase
  presentation.update(undefined, camera, 0.016);
  assert.equal(presentation.root.visible, false);
  assert.equal(presentation.snapshot, undefined);

  presentation.dispose();
});

