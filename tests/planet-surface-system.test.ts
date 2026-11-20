import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { createPlanetSurfaceSystem } from '../src/world/planet/PlanetSurfaceProvider';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';

test('T_PLANET_SURFACE_SYSTEM_01_SOLID_SURFACES_MOON_MARS', () => {
  const runtime = new UniverseRuntime({ epochS: 0 });
  const root = new Group();

  const moonBody = runtime.solarSystem.bodies.find(b => b.id === 'moon')!;
  const moonSystem = createPlanetSurfaceSystem(moonBody, root, runtime.frames, runtime.renderSpace);

  assert.equal(moonSystem.body.id, 'moon');
  assert.equal(moonSystem.visualProfile.surfaceType, 'rocky');
  assert.ok(moonSystem.surfaceGenerator, 'Moon must have an active surface generator');
  assert.ok(moonSystem.provider, 'Moon must have a RockyPlanetProvider');
  assert.ok(moonSystem.terrainProvider, 'Moon must have a PlanetTerrainProvider for physics');

  const marsBody = runtime.solarSystem.bodies.find(b => b.id === 'mars')!;
  const marsSystem = createPlanetSurfaceSystem(marsBody, root, runtime.frames, runtime.renderSpace);

  assert.equal(marsSystem.body.id, 'mars');
  assert.equal(marsSystem.visualProfile.surfaceType, 'rocky');
  assert.ok(marsSystem.surfaceGenerator, 'Mars must have an active surface generator');
  assert.ok(marsSystem.provider, 'Mars must have a RockyPlanetProvider');
  assert.ok(marsSystem.terrainProvider, 'Mars must have a PlanetTerrainProvider for physics');

  moonSystem.dispose();
  marsSystem.dispose();
});

test('T_PLANET_SURFACE_SYSTEM_02_GAS_GIANTS_NO_SURFACE_GENERATOR', () => {
  const runtime = new UniverseRuntime({ epochS: 0 });
  const root = new Group();

  const jupiterBody = runtime.solarSystem.bodies.find(b => b.id === 'jupiter')!;
  const jupiterSystem = createPlanetSurfaceSystem(jupiterBody, root, runtime.frames, runtime.renderSpace);

  assert.equal(jupiterSystem.body.id, 'jupiter');
  assert.equal(jupiterSystem.visualProfile.surfaceType, 'gas');
  assert.equal(jupiterSystem.surfaceGenerator, undefined, 'Gas giants must not instantiate solid surface generators');
  assert.equal(jupiterSystem.provider, undefined, 'Gas giants must not instantiate RockyPlanetProviders');
  assert.equal(jupiterSystem.terrainProvider, undefined, 'Gas giants must not instantiate physical terrain collision');

  jupiterSystem.dispose();
});

