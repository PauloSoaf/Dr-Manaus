import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { PlanetaryRupturePresentation } from '../src/rendering/celestial/PlanetaryRupturePresentation';
import { MacroBodyFractureService } from '../src/world/destruction/MacroBodyFractureService';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface';
import { SaveManager } from '../src/core/SaveManager';
import { CosmicAtlasModel } from '../src/world/exploration/CosmicAtlasModel';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';

const mockEarthBody: CelestialBody = {
  id: 'earth',
  name: 'Earth',
  frameId: 'earth-frame',
  equatorialRadiusM: 6378137,
  polarRadiusM: 6356752,
  massKg: 5.972e24,
};

test('T_VIVO18_01_SEVEN_PHASE_RUPTURE_PRESENTATION_SEQUENCE', () => {
  const root = new Group();
  const presentation = new PlanetaryRupturePresentation(root);
  const camera = new PerspectiveCamera(60, 1.77, 10, 1e9);
  const bodyPos = new Vector3(0, 0, 0);

  const edits = new PlanetVolumeEditStore();
  const fractureService = new MacroBodyFractureService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
    bodyById: id => (id === 'earth' ? mockEarthBody : undefined),
  });

  const plan = fractureService.rupturePlanet('earth', 1e28);
  assert.ok(plan, 'Rupture plan must exist');

  // Trigger live rupture sequence
  presentation.startRupture('earth', plan, 6378137);
  assert.equal(presentation.isRuptured('earth'), true);
  assert.equal(presentation.isGlobeSuppressed('earth'), false, 'Intact globe visible at start of rupture');

  // Phase 1: Glowing fissure network (t = 0.5s)
  presentation.update(0.5, camera, bodyPos);
  assert.equal(presentation.currentPhase('earth'), 1);
  assert.equal(presentation.isGlobeSuppressed('earth'), false);

  // Phase 2: Incandescent core glow exposure (t = 2.0s)
  presentation.update(1.5, camera, bodyPos); // cumulative t = 2.0s
  assert.equal(presentation.currentPhase('earth'), 2);
  assert.equal(presentation.isGlobeSuppressed('earth'), false);

  // Phase 3: Macroscopic crust chunks splitting & detachment (t = 3.5s)
  presentation.update(1.5, camera, bodyPos); // cumulative t = 3.5s
  assert.equal(presentation.currentPhase('earth'), 3);
  assert.equal(presentation.isGlobeSuppressed('earth'), false);

  // Phase 4 & 5: Intact globe suppressed, chunks drifting (t = 5.0s)
  presentation.update(1.5, camera, bodyPos); // cumulative t = 5.0s
  assert.equal(presentation.currentPhase('earth'), 5);
  assert.equal(presentation.isGlobeSuppressed('earth'), true, 'Intact globe must be hidden in Phase 4/5');

  // Phase 6: Expanding shockwave shell (t = 6.5s)
  presentation.update(1.5, camera, bodyPos); // cumulative t = 6.5s
  assert.equal(presentation.currentPhase('earth'), 6);
  assert.equal(presentation.isGlobeSuppressed('earth'), true);

  // Phase 7: Persistent Keplerian Debris Ring (t = 8.0s)
  presentation.update(1.5, camera, bodyPos); // cumulative t = 8.0s
  assert.equal(presentation.currentPhase('earth'), 7);
  assert.equal(presentation.isGlobeSuppressed('earth'), true, 'Intact globe remains hidden in persistent ring phase');

  // Restoration clears presentation and unhides globe
  presentation.restore('earth');
  assert.equal(presentation.isRuptured('earth'), false);
  assert.equal(presentation.isGlobeSuppressed('earth'), false);
  assert.equal(presentation.currentPhase('earth'), 0);

  presentation.dispose();
});

test('T_VIVO18_02_PERSISTED_RUPTURE_IMMEDIATE_PHASE_SEVEN', () => {
  const root = new Group();
  const presentation = new PlanetaryRupturePresentation(root);
  const camera = new PerspectiveCamera();
  const bodyPos = new Vector3(1000, 2000, 3000);

  const edits = new PlanetVolumeEditStore();
  const fractureService = new MacroBodyFractureService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
    bodyById: id => (id === 'earth' ? mockEarthBody : undefined),
  });

  const plan = fractureService.rupturePlanet('earth', 1e28)!;

  // Load persisted rupture from save
  presentation.loadPersistedRupture('earth', plan, 6378137);
  assert.equal(presentation.isRuptured('earth'), true);
  assert.equal(presentation.currentPhase('earth'), 7, 'Persisted rupture must immediately be in Phase 7');
  assert.equal(presentation.isGlobeSuppressed('earth'), true, 'Persisted rupture must immediately suppress intact globe');

  presentation.update(0.016, camera, bodyPos);
  assert.equal(presentation.currentPhase('earth'), 7);
  assert.equal(presentation.isGlobeSuppressed('earth'), true);

  presentation.dispose();
});

test('T_VIVO18_03_COSMIC_ATLAS_RUPTURED_BODY_METADATA', () => {
  const save = new SaveManager();
  save.reset();
  const catalog = new UniversalTargetCatalog();
  const universe = new UniverseRuntime();
  const resolver = new UniversalTargetResolver(catalog, universe);
  const atlas = new CosmicAtlasModel(catalog, save, catalog.discovery, resolver);

  // Initial state of Mars in Atlas
  let res = atlas.query({ query: 'Mars' });
  const initialMars = res.entries.find(e => e.bodyId === 'mars');
  assert.ok(initialMars, 'Mars must exist in Atlas');
  assert.ok(!initialMars.displayName.includes('MUNDO EM RUÍNAS'));
  assert.equal(initialMars.canLand, true);

  // Rupture Mars in save
  save.recordBodyRupture('mars');
  atlas.invalidateCache();

  res = atlas.query({ query: 'Mars' });
  const rupturedMars = res.entries.find(e => e.bodyId === 'mars');
  assert.ok(rupturedMars, 'Mars must exist in Atlas');
  assert.ok(
    rupturedMars.displayName.includes('[MUNDO EM RUÍNAS - CINTURÃO DE DESTROÇOS]'),
    'Atlas must display ruptured world tag in title'
  );
  assert.equal(rupturedMars.canLand, false, 'Landing must be disabled on ruptured world');
  assert.equal(rupturedMars.landingMode, 'none', 'Landing mode must be none on ruptured world');
  assert.equal(rupturedMars.worldType, 'Cinturão de Destroços Cósmicos (Mundo Rupturado)');

  // Restore Mars
  save.recordBodyRestoration('mars');
  atlas.invalidateCache();

  res = atlas.query({ query: 'Mars' });
  const restoredMars = res.entries.find(e => e.bodyId === 'mars');
  assert.ok(restoredMars);
  assert.ok(!restoredMars.displayName.includes('MUNDO EM RUÍNAS'));
  assert.equal(restoredMars.canLand, true);
});
