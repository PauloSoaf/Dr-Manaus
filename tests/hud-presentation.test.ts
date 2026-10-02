import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { resolveHUDPresentation } from '../src/ui/HUD.ts';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation.ts';

function earthLocation(withSurface: boolean): UniverseLocation {
  return {
    address: {
      galaxyId: 'milky_way',
      sector: { x: 0n, y: 0n, z: 0n },
      systemId: 'sol',
      bodyId: 'earth',
    },
    frameId: withSurface ? 'earth/fixed' : 'solar-system/barycentric',
    surface: withSurface ? { latDeg: -3.13, lonDeg: -60.02, altitudeM: 20_000 } : undefined,
  };
}

test('explicit planetary presentation retires Manaus landmarks and local minimap context', () => {
  const presentation = resolveHUDPresentation({
    // Deliberately place the player at the local origin and leave the legacy mission flag on.
    // The shared presentation domain must still win once planetary ground owns the view.
    position: new Vector3(0, 20_000, 0),
    location: earthLocation(true),
    missionMarkerActive: true,
    presentationDomain: 'planetary',
    district: 'CENTRO-SUL',
  });

  assert.equal(presentation.domain, 'planetary');
  assert.equal(presentation.localUiVisible, false);
  assert.equal(presentation.place, 'Sobre: Terra');
  assert.equal(presentation.domainLabel, 'PLANETA');
  assert.equal(presentation.contextLabel, 'TERRA');
  assert.match(presentation.coordinates, /3\.1300° S/);
  assert.match(presentation.coordinates, /60\.0200° O/);
});

test('orbital presentation never reuses surface coordinates or city labels', () => {
  const presentation = resolveHUDPresentation({
    position: new Vector3(),
    location: earthLocation(true),
    missionMarkerActive: true,
    presentationDomain: 'orbital',
    district: 'CENTRO',
  });

  assert.equal(presentation.localUiVisible, false);
  assert.equal(presentation.place, 'Órbita: Terra');
  assert.equal(presentation.coordinates, '—');
  assert.equal(presentation.domainLabel, 'NAVEGAÇÃO');
  assert.equal(presentation.locationState, 'NAVEGAÇÃO ORBITAL');
});

