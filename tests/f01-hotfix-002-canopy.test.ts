import assert from 'node:assert/strict';
import test from 'node:test';
import { InstancedMesh, Matrix4, Vector3 } from 'three/webgpu';
import { EARTH_CANOPY, EarthCanopyLayer, canopyTile } from '../src/world/lod/EarthCanopyLayer';
import { chartToFixed, earthSurfaceChart, localGeodetic, localSeaLevelY } from '../src/world/planet/LocalSurface';
import { EARTH } from '../src/world/planet/PlanetBody';
import { EARTH_VEGETATION_MIN_M, earthSolidGroundAt } from '../src/world/planet/EarthElevation';
import { bindEarthSite, findEastCoast } from './helpers/earth-surface';

/** Runs enough budgeted frames to fill the ring around the observer. */
function fill(layer: EarthCanopyLayer, x: number, z: number, anchor: { latDeg: number; lonDeg: number }, altitude = 10) {
  for (let frame = 0; frame < 120; frame++) layer.update({ x, z }, anchor, { altitudeAboveGroundM: altitude, hideRadiusM: 450 });
}

function clumpCentres(layer: EarthCanopyLayer): Vector3[] {
  const result: Vector3[] = [];
  for (const child of layer.group.children) {
    const mesh = child as InstancedMesh, matrix = new Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      if (matrix.determinant() === 0) continue;
      result.push(new Vector3().setFromMatrixPosition(matrix));
    }
  }
  return result;
}

test('forest density follows the biome: dense Amazon, almost bare Sahara, nothing on ice or sea', t => {
  const counts: Record<string, number> = {};
  for (const [name, latDeg, lonDeg] of [['amazon', -5, -65], ['sahara', 23, 12], ['antarctica', -80, 0], ['atlantic', 10, -35], ['europe', 50, 10]] as const) {
    const layer = new EarthCanopyLayer();
    t.after(() => layer.dispose());
    fill(layer, 0, 0, { latDeg, lonDeg });
    counts[name] = layer.stats.instances;
  }
  assert.ok(counts.amazon > 12_000, JSON.stringify(counts));
  assert.ok(counts.europe > 2_000 && counts.europe < counts.amazon * .6, JSON.stringify(counts));
  assert.ok(counts.sahara < counts.amazon * .05, JSON.stringify(counts));
  assert.equal(counts.antarctica, 0);
  assert.equal(counts.atlantic, 0);
  t.diagnostic(JSON.stringify(counts));
});

test('clumps stand on the collision ground and never in the water along a coast', t => {
  const coastLon = findEastCoast(-8.05, -36.5, -33.5);
  const site = bindEarthSite(-8.05, coastLon);
  const layer = new EarthCanopyLayer();
  t.after(() => { layer.dispose(); site.restore(); });
  fill(layer, 0, 0, { latDeg: -8.05, lonDeg: coastLon });
  const chart = earthSurfaceChart(-8.05, coastLon);
  const centres = clumpCentres(layer);
  assert.ok(centres.length > 500);
  for (let i = 0; i < centres.length; i += 97) {
    const { x, y, z } = centres[i];
    const geo = localGeodetic(chart, x, y, z);
    const ground = earthSolidGroundAt(geo.latRad, geo.lonRad);
    assert.ok(ground >= EARTH_VEGETATION_MIN_M - .05, `clump over ground ${ground}`);
    const standing = site.terrain.heightAt(x, z);
    assert.ok(y - standing > 1 && y - standing < 22, `clump centre ${y - standing} m above the collision ground`);
    assert.ok(standing > localSeaLevelY(chart, EARTH, x, z), 'dry land under every clump');
  }
});

test('the same place grows the same forest from any anchor and after a revisit', t => {
  const layer = new EarthCanopyLayer();
  t.after(() => layer.dispose());
  const first = { latDeg: -5, lonDeg: -65 }, second = { latDeg: -5.01, lonDeg: -65.012 };
  const fixed = (anchor: { latDeg: number; lonDeg: number }) => {
    const chart = earthSurfaceChart(anchor.latDeg, anchor.lonDeg);
    return clumpCentres(layer).map(p => chartToFixed(chart, p.x, p.y, p.z));
  };
  fill(layer, 0, 0, first);
  const before = fixed(first);
  const tile = canopyTile(earthSurfaceChart(first.latDeg, first.lonDeg), -3, -41);
  assert.deepEqual(canopyTile(earthSurfaceChart(first.latDeg, first.lonDeg), -3, -41), tile, 'deterministic');
  fill(layer, 0, 0, second);
  const index = new Set(fixed(second).map(p => p.map(v => Math.round(v)).join(',')));
  const shared = before.filter(p => index.has(p.map(v => Math.round(v)).join(','))).length;
  // The two anchors are 1.7 km apart, so most of the first ring is also in the second one.
  assert.ok(shared > before.length * .5, `${shared} of ${before.length} clumps kept their place`);
});

test('tiles stream one per frame, nearest first, and distant ones are released', t => {
  const layer = new EarthCanopyLayer();
  t.after(() => layer.dispose());
  const anchor = { latDeg: -5, lonDeg: -65 };
  layer.update({ x: 0, z: 0 }, anchor, { altitudeAboveGroundM: 10, hideRadiusM: 450 });
  assert.equal(layer.stats.tiles, 1);
  fill(layer, 0, 0, anchor);
  const full = layer.stats.tiles;
  assert.ok(full > 20 && full < 80, `${full} tiles`);
  for (let step = 1; step <= 40; step++) fill(layer, step * 1_000, 0, anchor);
  assert.ok(layer.stats.tiles <= full + 20, `tiles stay bounded: ${layer.stats.tiles}`);
  assert.ok(layer.group.children.length <= layer.stats.tiles);
  t.diagnostic(`${full} tiles, ${layer.stats.instances} clumps, last tile ${layer.stats.lastTileMs.toFixed(1)} ms`);
});

test('the shader hole follows the chunk radius, altitude retires the layer and felled trees stay gone', t => {
  const layer = new EarthCanopyLayer();
  t.after(() => layer.dispose());
  const anchor = { latDeg: -5, lonDeg: -65 };
  fill(layer, 120, -40, anchor);
  assert.deepEqual(layer.hiddenWithin, { x: 120, z: -40, radiusM: 450 });
  const before = clumpCentres(layer);
  const victim = before[Math.floor(before.length / 2)];
  layer.setFelled(1, [{ x: victim.x + 2, z: victim.z - 1 }]);
  const after = clumpCentres(layer);
  assert.ok(after.length < before.length);
  assert.ok(!after.some(p => p.distanceTo(victim) < .01), 'the clump over the felled tree is gone');
  fill(layer, 40_000, 0, anchor);
  fill(layer, 120, -40, anchor);
  assert.ok(!clumpCentres(layer).some(p => p.distanceTo(victim) < .01), 'revisiting does not regrow it');
  layer.update({ x: 0, z: 0 }, anchor, { altitudeAboveGroundM: EARTH_CANOPY.maxAltitudeM + 1, hideRadiusM: 450 });
  assert.equal(layer.stats.visible, false);
});
