import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group } from 'three/webgpu';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog.ts';
import { CosmicAtlasModel } from '../src/world/exploration/CosmicAtlasModel.ts';
import { CURATED_JWST_NEBULAE } from '../src/rendering/JWSTCosmicPresentation.ts';
import { PlanetaryHazardRenderer } from '../src/world/life/PlanetaryHazardRenderer.ts';
import type { PlanetaryHazardState } from '../src/world/life/PlanetaryHazardService.ts';

test('COSMIC-ATLAS: CosmicAtlasModel queries and inspects titan and JWST nebulae', () => {
  const catalog = new UniversalTargetCatalog();
  const atlas = new CosmicAtlasModel(catalog);

  // 1. Query Astral Titan
  const titanDesc = catalog.find('titan-astral-leviathan-01');
  assert.ok(titanDesc, 'UniversalTargetCatalog must resolve Astral Titan');
  assert.equal(titanDesc.objectId, 'titan-astral-leviathan-01');

  // Test Atlas query for titan
  const titanQuery = atlas.query({ query: 'Leviatã Astral' });
  assert.ok(titanQuery.entries.length >= 1);
  const titanEntry = titanQuery.entries.find(e => e.objectId === 'titan-astral-leviathan-01');
  assert.ok(titanEntry, 'Atlas must contain entry for Astral Titan');
  assert.equal(titanEntry.canLand, false);
  assert.ok(titanEntry.worldType?.includes('Leviatã Astral'));

  // 2. Query JWST Nebulae
  for (const neb of CURATED_JWST_NEBULAE) {
    const query = atlas.query({ query: neb.name });
    assert.ok(query.entries.length >= 1, `Atlas should find JWST nebula: ${neb.name}`);
    const entry = query.entries[0];
    assert.equal(entry.canLand, false);
    assert.ok(entry.worldType?.includes('JWST'));
  }

  // 3. Toggle favorite on Astral Titan
  const key = titanEntry.key;
  assert.equal(atlas.isFavorite(key), false);
  const favState = atlas.toggleFavorite(key);
  assert.equal(favState, true);
  assert.equal(atlas.isFavorite(key), true);

  const favQuery = atlas.query({ statusFilter: 'favorites' });
  assert.ok(favQuery.entries.some(e => e.key === key), 'Astral Titan must appear in favorites filter');
});

test('PLANETARY-HAZARD-RENDERER: Dynamic state inspections and hazard type tracking', () => {
  const parent = new Group();
  const renderer = new PlanetaryHazardRenderer(parent);

  assert.equal(renderer.isEmitting, false);
  assert.equal(renderer.hazardType, 'none');

  const playerPos = new Vector3(50, 10, -50);
  const blizzardHazard: PlanetaryHazardState = {
    type: 'cryogenic-blizzard',
    alertLevel: 'critical',
    intensity: 0.9,
    label: 'Blizzard Criogênica',
    description: 'Ventos gelados',
    damagePerSecond: 12,
    mitigationHint: 'Aqueça-se',
  };

  renderer.update(0.016, playerPos, blizzardHazard);
  assert.equal(renderer.isEmitting, true);
  assert.equal(renderer.hazardType, 'cryogenic-blizzard');

  renderer.dispose();
  assert.equal(parent.children.includes(renderer.root), false);
});

