import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Matrix4 } from 'three/webgpu';
import { AlienFloraRenderer, FLORA_POOL_CAPACITY } from '../src/world/life/AlienFloraRenderer';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { Vec3 } from '../src/world/spatial/units';

describe('AlienFloraRenderer (VIVO-03)', () => {
  const earthBody: CelestialBody = {
    id: 'earth',
    name: 'Terra',
    frameId: 'earth-frame',
    equatorialRadiusM: 6378137,
    polarRadiusM: 6356752,
    massKg: 5.972e24,
  };
  const earthBiosphere = generatePlanetaryBiosphere(earthBody, SOLAR_BODY_PROFILES.earth, 1337n);

  const moonBody: CelestialBody = {
    id: 'moon',
    name: 'Lua',
    frameId: 'moon-frame',
    equatorialRadiusM: 1737400,
    massKg: 7.342e22,
  };
  const moonBiosphere = generatePlanetaryBiosphere(moonBody, SOLAR_BODY_PROFILES.moon, 1337n);

  // Fake solid surface generator for testing
  const fakeSurface: PlanetSurfaceGenerator = {
    body: { semiMajorAxisM: 6378137, flattening: 0.0033528 },
    radiusM: 6378137,
    heightAt: (_direction: Vec3) => 50,
    normalEnu: (_direction: Vec3, out: Vec3) => {
      out[0] = 0;
      out[1] = 1;
      out[2] = 0;
    },
    colourAt: (_direction: Vec3, out: [number, number, number]) => {
      out[0] = 0.2;
      out[1] = 0.5;
      out[2] = 0.2;
    },
  };

  it('T_VIVO03_01: Initialization sets up all flora archetype meshes with zero initial count', () => {
    const renderer = new AlienFloraRenderer();
    assert.strictEqual(renderer.root.children.length, 7, 'Must have 7 instanced archetype meshes in root');

    assert.strictEqual(renderer.getActiveCount('canopy-broadleaf'), 0);
    assert.strictEqual(renderer.getActiveCount('alien-conifers'), 0);
    assert.strictEqual(renderer.getActiveCount('giant-spore-trees'), 0);
    assert.strictEqual(renderer.getActiveCount('bioluminescent-fungi'), 0);
    assert.strictEqual(renderer.getActiveCount('crystalline-spires'), 0);
    assert.strictEqual(renderer.getActiveCount('xenoflora-succulents'), 0);
    assert.strictEqual(renderer.getActiveCount('hydrocarbon-tendrils'), 0);

    renderer.dispose();
  });

  it('T_VIVO03_02: Sterile worlds suppress all flora instances', () => {
    const renderer = new AlienFloraRenderer();
    const playerPos = new Vector3(0, 50, 0);

    renderer.update(playerPos, fakeSurface, moonBiosphere);

    let totalActive = 0;
    for (const child of renderer.root.children) {
      const mesh = child as import('three/webgpu').InstancedMesh;
      totalActive += mesh.count;
    }

    assert.strictEqual(totalActive, 0, 'Sterile moon must produce 0 active flora instances');
    renderer.dispose();
  });

  it('T_VIVO03_03: Habitable worlds spawn flora instances with valid transform matrices', () => {
    const renderer = new AlienFloraRenderer();
    const playerPos = new Vector3(0, 50, 0);

    renderer.update(playerPos, fakeSurface, earthBiosphere);

    const broadleafCount = renderer.getActiveCount('canopy-broadleaf');
    assert.ok(broadleafCount > 0, `Expected active broadleaf instances on Earth, got ${broadleafCount}`);
    assert.ok(broadleafCount <= FLORA_POOL_CAPACITY, 'Instance count must not exceed capacity');

    // Verify matrix validity
    const broadleafMesh = renderer.root.getObjectByName('flora-instances-canopy-broadleaf') as import('three/webgpu').InstancedMesh;
    assert.ok(broadleafMesh);

    const m = new Matrix4();
    broadleafMesh.getMatrixAt(0, m);
    for (let i = 0; i < 16; i++) {
      assert.ok(!Number.isNaN(m.elements[i]), 'Matrix element must not be NaN');
      assert.ok(Number.isFinite(m.elements[i]), 'Matrix element must be finite');
    }

    renderer.dispose();
  });

  it('T_VIVO03_04: Destruction in radius suppresses flora instances in impact zone', () => {
    const renderer = new AlienFloraRenderer();
    const playerPos = new Vector3(0, 50, 0);

    renderer.update(playerPos, fakeSurface, earthBiosphere);
    const initialCount = renderer.getActiveCount('canopy-broadleaf');
    assert.ok(initialCount > 0);

    // Blast crater of 70m at player position
    const destroyedCount = renderer.destroyInRadius(playerPos, 70, earthBiosphere);
    assert.ok(destroyedCount > 0, `Expected destroyed flora count > 0, got ${destroyedCount}`);

    // Re-update
    renderer.update(playerPos, fakeSurface, earthBiosphere);
    const postCount = renderer.getActiveCount('canopy-broadleaf');
    assert.ok(postCount < initialCount, `Active count after destruction (${postCount}) must be less than initial (${initialCount})`);

    renderer.dispose();
  });

  it('T_VIVO03_05: Disposal cleans up GPU meshes and clears pools', () => {
    const renderer = new AlienFloraRenderer();
    const playerPos = new Vector3(0, 50, 0);
    renderer.update(playerPos, fakeSurface, earthBiosphere);

    renderer.dispose();
    assert.strictEqual(renderer.root.children.length, 0, 'Disposed renderer must have 0 children in root');
    assert.strictEqual(renderer.getActiveCount('canopy-broadleaf'), 0);
  });
});
