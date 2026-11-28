import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { Vector3 } from 'three/webgpu';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { earthSurfaceChart, localSeaLevelY, localSurfaceY } from '../src/world/planet/LocalSurface';
import { EARTH } from '../src/world/planet/PlanetBody';
import { PlanetTerrainProvider } from '../src/world/planet/PlanetTerrainProvider';
import { EarthGroundSurface, EarthSurfaceGenerator, localGroundSurface } from '../src/world/planet/EarthSurface';
import { EARTH_GROUND, earthSolidGroundAt, elevationAt } from '../src/world/planet/EarthElevation';
import { EARTH_LAND_MASK, earthLandFraction, isLandAt } from '../src/world/planet/EarthLandMask';
import { manausBathymetry } from '../src/world/water/ManausBathymetry';
import { BuildingGeneratorContext } from '../src/world/spatial/ActiveSurfaceOrigin';
import { degToRad } from '../src/world/spatial/units';
import { bindEarthSite, earthSurfaceFrames, findEastCoast } from './helpers/earth-surface';
import { foundationLab } from './helpers/foundation-lab';

test('the land fraction equals the land mask at pixel centres and the solid ground has no cliffs at the coast', () => {
  for (let row = 3; row < EARTH_LAND_MASK.height; row += 17) for (let column = 5; column < EARTH_LAND_MASK.width; column += 23) {
    const lat = degToRad(90 - (row + .5) / EARTH_LAND_MASK.height * 180);
    const lon = degToRad(-180 + (column + .5) / EARTH_LAND_MASK.width * 360);
    assert.ok(Math.abs(earthLandFraction(lat, lon) - Number(isLandAt(lat, lon))) < 1e-9);
  }
  // Every ~110 m across the Brazilian east coast: steps stay a walkable slope, never a wall.
  let largestStep = 0, previous = earthSolidGroundAt(degToRad(-8.05), degToRad(-36.5));
  for (let lon = -36.5 + .001; lon <= -33.5; lon += .001) {
    const current = earthSolidGroundAt(degToRad(-8.05), degToRad(lon));
    largestStep = Math.max(largestStep, Math.abs(current - previous));
    previous = current;
  }
  assert.ok(largestStep < 8, `coastal ground steps by ${largestStep} m`);
  assert.equal(earthSolidGroundAt(degToRad(10), degToRad(-35)), EARTH_GROUND.oceanFloorM, 'open Atlantic keeps the declared seabed');
  const inland = earthSolidGroundAt(degToRad(-15.7939), degToRad(-47.8828));
  assert.ok(Math.abs(inland - elevationAt(degToRad(-15.7939), degToRad(-47.8828))) < 1e-9, 'inland ground is the real relief');
  assert.equal(localGroundSurface(EarthSurfaceGenerator), EarthGroundSurface, 'local physics binds the ground with a seabed');
  assert.equal(EarthSurfaceGenerator.solidHeightAt, undefined, 'the drawn globe, orbit and volume surface are unchanged');
});

test('physics, the chunk solver and sea level agree inside the same surface frame', () => {
  for (const [lat, lon] of [[-15.7939, -47.8828], [23, 12], [-16.5, -68.15], [10, -35], [-8.05, -34.9], [72, -40]]) {
    const terrain = new PlanetTerrainProvider(earthSurfaceFrames(lat, lon), EARTH, EarthGroundSurface);
    const chart = earthSurfaceChart(lat, lon);
    for (const [x, z] of [[0, 0], [480, -320], [-2500, 1800], [20_000, 15_000]]) {
      const physics = terrain.heightAt(x, z);
      const drawn = localSurfaceY(chart, EARTH, EarthGroundSurface, x, z, true);
      assert.ok(Math.abs(physics - drawn) < 1e-4, `${lat},${lon} at ${x},${z}: physics ${physics} drawn ${drawn}`);
    }
    assert.ok(Math.abs(localSeaLevelY(chart, EARTH, 0, 0)) < 1e-6);
    // The sea sags below the tangent plane by about d² / 2R.
    const sag = -localSeaLevelY(chart, EARTH, 10_000, 0);
    assert.ok(Math.abs(sag - 10_000 ** 2 / (2 * 6_378_137)) < .2, `sag ${sag}`);
  }
});

test('outside Manaus the water bathymetry reads the collision seabed and waves ride sea level', () => {
  const site = bindEarthSite(10, -35);
  try {
    const chart = earthSurfaceChart(10, -35);
    for (const [x, z] of [[0, 0], [900, -700], [-6000, 4000]]) {
      assert.ok(manausBathymetry.isWater(x, z));
      assert.ok(Math.abs(manausBathymetry.sampleRiverbedHeight(x, z) - PhysicsWorld.terrainHeight(x, z)) < 1e-4);
      assert.ok(Math.abs(manausBathymetry.sampleWaterSurface(x, z, 3.5) - localSeaLevelY(chart, EARTH, x, z)) < 4);
    }
    BuildingGeneratorContext.activeOrigin = { latDeg: -14.57, lonDeg: 175.47, isManaus: false, bodyId: 'mars' };
    assert.equal(manausBathymetry.isWater(0, 0), false, 'Mars has no sea, whatever Earth has at that coordinate');
  } finally { site.restore(); }
});

test('in the open Atlantic the production player floats in one steady state, dives and comes back up', () => {
  const site = bindEarthSite(10, -35);
  const lab = foundationLab(new Vector3(0, manausBathymetry.sampleWaterSurface(0, 0, 0) - 1.18, 0));
  try {
    assert.equal(lab.player.state, 'Swimming');
    let time = 0;
    const run = (seconds: number, sample?: () => void) => {
      for (let i = 0; i < seconds * 60; i++) { time = lab.step(1 / 60); sample?.(); }
    };
    run(2);
    const idle = new Set<string>();
    run(2, () => idle.add(lab.player.state));
    assert.deepEqual([...idle], ['Swimming'], 'no flicker between standing, falling and swimming at sea');
    assert.ok(Math.abs(lab.player.position.y - (lab.player.submersion.surfaceY - 1.18)) < .6, 'head stays above the waves');
    lab.held.add('ControlLeft');
    run(3);
    assert.equal(lab.player.state, 'Swimming');
    assert.ok(lab.player.position.y < lab.player.submersion.surfaceY - 12, `dive reached ${lab.player.position.y}`);
    lab.held.delete('ControlLeft');
    run(6);
    assert.ok(lab.player.position.y > lab.player.submersion.surfaceY - 1.8, 'buoyancy returns the player to the surface');
    assert.ok(time > 0);
  } finally {
    lab.player.character.dispose();
    site.restore();
  }
});

test('walking off a beach into the sea and back stays on the shared ground without jumps', () => {
  const coastLon = findEastCoast(-8.05, -36.5, -33.5);
  const site = bindEarthSite(-8.05, coastLon);
  const start = new Vector3(-120, 0, 0);
  start.y = PhysicsWorld.terrainHeight(start.x, start.z);
  const lab = foundationLab(start);
  try {
    const states = new Set<string>();
    let largestStep = 0, deepest = Infinity;
    const walk = (key: string, until: () => boolean) => {
      lab.held.add(key);
      for (let i = 0; i < 60 * 90 && !until(); i++) {
        const lastY = lab.player.position.y;
        lab.step(1 / 60, 0);
        largestStep = Math.max(largestStep, Math.abs(lab.player.position.y - lastY));
        deepest = Math.min(deepest, lab.player.position.y - PhysicsWorld.terrainHeight(lab.player.position.x, lab.player.position.z));
        states.add(lab.player.state);
      }
      lab.held.delete(key);
    };
    walk('KeyD', () => lab.player.position.x > 140);
    assert.ok(lab.player.position.x > 140, `reached ${lab.player.position.x}`);
    assert.equal(lab.player.state, 'Swimming', 'the shelf deepens into swimming water');
    walk('KeyA', () => lab.player.position.x < -100);
    assert.ok(lab.player.position.x < -100, `came back to ${lab.player.position.x}`);
    for (let i = 0; i < 30; i++) lab.step(1 / 60);
    assert.equal(lab.player.state, 'Grounded');
    assert.ok(states.has('Grounded') && states.has('Swimming'), [...states].join(','));
    assert.ok(largestStep < .2, `a frame moved the player ${largestStep} m vertically`);
    assert.ok(deepest > -.02, `the player sank ${-deepest} m into the ground`);
  } finally {
    lab.player.character.dispose();
    site.restore();
  }
});

test('the chunk worker evaluates the same ground without pulling Three.js into its bundle', () => {
  const seen = new Set<string>(), packages = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file) || !file.endsWith('.ts')) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?from\s+)?['"]([^'"]+)['"]/gm)) {
      if (match[1]) continue;
      if (!match[2].startsWith('.')) { packages.add(`${match[2]} <- ${path.relative('.', file)}`); continue; }
      const base = path.resolve(path.dirname(file), match[2]);
      const target = [base, `${base}.ts`, path.join(base, 'index.ts')].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      if (target) walk(target);
    }
  };
  walk(path.resolve('src/workers/chunk.worker.ts'));
  assert.ok(seen.size > 5);
  assert.deepEqual([...packages], []);
});
