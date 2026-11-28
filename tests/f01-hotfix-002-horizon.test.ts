import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { EARTH_HORIZON, EarthHorizonPresentation } from '../src/world/lod/EarthHorizonPresentation';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer';
import { createRegionId } from '../src/world/chunks/Chunk';
import { BuildingGeneratorContext } from '../src/world/spatial/ActiveSurfaceOrigin';
import { bindEarthSite, findEastCoast } from './helpers/earth-surface';

const SITES: ReadonlyArray<readonly [string, number, number]> = [
  ['Amazon interior', -5, -65], ['Central Brazil', -15.7939, -47.8828], ['Sahara', 23, 12],
  ['Central Europe', 50, 10], ['Himalaya', 28, 86.9], ['Antarctica', -80, 0], ['Open Atlantic', 10, -35],
];

const meshOf = (horizon: EarthHorizonPresentation, name: string) => horizon.group.getObjectByName(name) as Mesh;
const PARTS = ['far-land', 'far-water', 'near-land', 'near-water', 'near-water-cap'].map(part => `earth-horizon-${part}`);

/** Drawn triangles of every horizon mesh as horizontal projections in surface-frame metres. */
function triangles(horizon: EarthHorizonPresentation): number[][] {
  const result: number[][] = [];
  for (const name of PARTS) {
    const mesh = meshOf(horizon, name);
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index!;
    for (let t = 0; t < mesh.geometry.drawRange.count; t += 3) {
      const corners: number[] = [];
      for (let k = 0; k < 3; k++) {
        const v = index.getX(t + k);
        corners.push(mesh.position.x + position.getX(v), mesh.position.z + position.getZ(v));
      }
      result.push(corners);
    }
  }
  return result;
}

function contains([ax, az, bx, bz, cx, cz]: number[], x: number, z: number): boolean {
  const e = (px: number, pz: number, qx: number, qz: number) => (qx - px) * (z - pz) - (qz - pz) * (x - px);
  const a = e(ax, az, bx, bz), b = e(bx, bz, cx, cz), c = e(cx, cz, ax, az);
  const tolerance = 1e-6 * Math.max(1, Math.abs(bx - ax) + Math.abs(cx - ax));
  return (a >= -tolerance && b >= -tolerance && c >= -tolerance) || (a <= tolerance && b <= tolerance && c <= tolerance);
}

for (const [name, latDeg, lonDeg] of SITES) {
  test(`${name}: terrain and sea surround the player in every direction out to 250 km`, t => {
    const horizon = new EarthHorizonPresentation();
    t.after(() => horizon.dispose());
    horizon.update({ x: 0, z: 0 }, { latDeg, lonDeg }, () => false);
    const drawn = triangles(horizon);
    const missing: string[] = [];
    for (let azimuth = 0; azimuth < 360; azimuth += 7.5) {
      for (const distance of [15, 100, 300, 500, 900, 2_400, 5_500, 9_000, 12_000, 30_000, 70_000, 150_000, 250_000]) {
        const x = Math.cos(azimuth * Math.PI / 180) * distance, z = Math.sin(azimuth * Math.PI / 180) * distance;
        if (!drawn.some(triangle => contains(triangle, x, z))) missing.push(`${azimuth}°@${distance}`);
      }
    }
    assert.deepEqual(missing.slice(0, 5), []);
    for (const meshName of PARTS) {
      const position = meshOf(horizon, meshName).geometry.getAttribute('position');
      for (let i = 0; i < position.count * 3; i++) assert.ok(Number.isFinite(position.array[i]));
    }
    t.diagnostic(horizon.stats.levels.map(level => `${level.name} ${level.lastBuildMs.toFixed(1)} ms`).join(', '));
  });
}

test('near horizon vertices lie on the collision ground, sunk only under the chunks, and never above physics', t => {
  const site = bindEarthSite(-15.7939, -47.8828);
  const horizon = new EarthHorizonPresentation();
  t.after(() => { horizon.dispose(); site.restore(); });
  horizon.update({ x: 0, z: 0 }, { latDeg: -15.7939, lonDeg: -47.8828 }, () => false);
  const mesh = meshOf(horizon, 'earth-horizon-near-land');
  const position = mesh.geometry.getAttribute('position');
  const radii = EARTH_HORIZON.near.radii, segments = EARTH_HORIZON.segments;
  let worst = 0;
  for (let ring = 1; ring < radii.length; ring++) for (let segment = 0; segment < segments; segment += 5) {
    const v = ring * segments + segment;
    const x = mesh.position.x + position.getX(v), z = mesh.position.z + position.getZ(v);
    const y = mesh.position.y + position.getY(v);
    const physics = site.terrain.heightAt(x, z);
    const sink = radii[ring] <= 700 ? 1.5 : radii[ring] >= 2500 ? 0 : undefined;
    if (sink !== undefined) assert.ok(Math.abs(physics - sink - y) < .05, `ring ${radii[ring]}: horizon ${y} physics ${physics}`);
    assert.ok(y <= physics + .05, 'the coarse surface never rises above the collision ground');
    worst = Math.max(worst, physics - y);
  }
  // Between vertices, within a few kilometres, the drawn triangle stays close to the real ground.
  const index = mesh.geometry.index!;
  let interpolation = 0;
  for (let t = 0; t < mesh.geometry.drawRange.count; t += 3 * 37) {
    const corners = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(position, index.getX(t + k)).add(mesh.position));
    const centre = corners[0].clone().add(corners[1]).add(corners[2]).divideScalar(3);
    if (Math.hypot(centre.x, centre.z) < 2_500) interpolation = Math.max(interpolation, Math.abs(site.terrain.heightAt(centre.x, centre.z) - centre.y));
  }
  assert.ok(interpolation < 3, `interpolation error ${interpolation}`);
  t.diagnostic(`max sink ${worst.toFixed(2)} m, interpolation within 2.5 km ${interpolation.toFixed(2)} m`);
});

test('sea is drawn only where the ground is under water, and a coast has both', t => {
  const horizon = new EarthHorizonPresentation();
  t.after(() => horizon.dispose());
  const counts = () => Object.fromEntries(PARTS.map(name => [name, meshOf(horizon, name).geometry.drawRange.count]));
  horizon.update({ x: 0, z: 0 }, { latDeg: 23, lonDeg: 12 }, () => false);
  const desert = counts();
  assert.equal(desert['earth-horizon-near-water'] + desert['earth-horizon-far-water'] + desert['earth-horizon-near-water-cap'], 0, 'no sea in the Sahara');
  horizon.update({ x: 0, z: 0 }, { latDeg: 10, lonDeg: -35 }, () => false);
  const ocean = counts();
  assert.equal(ocean['earth-horizon-near-land'] + ocean['earth-horizon-far-land'], 0, 'open Atlantic has no land within 262 km');
  assert.ok(ocean['earth-horizon-near-water'] > 0 && ocean['earth-horizon-far-water'] > 0);
  const coastLon = findEastCoast(-8.05, -36.5, -33.5);
  horizon.update({ x: 0, z: 0 }, { latDeg: -8.05, lonDeg: coastLon }, () => false);
  const coast = counts();
  assert.ok(coast['earth-horizon-near-land'] > 0 && coast['earth-horizon-near-water'] > 0, JSON.stringify(coast));
  assert.ok(coast['earth-horizon-far-land'] > 0 && coast['earth-horizon-far-water'] > 0);
});

for (const speed of [300, 3_000, 10_000]) {
  test(`flying at ${speed} m/s under a tight budget never opens a hole between the levels`, t => {
    const horizon = new EarthHorizonPresentation();
    t.after(() => horizon.dispose());
    const anchor = { latDeg: -5, lonDeg: -65 };
    // Inscribed radii of the 128-sided rings.
    const shrink = Math.cos(Math.PI / EARTH_HORIZON.segments);
    const nearOuter = EARTH_HORIZON.near.radii.at(-1)! * shrink, farInner = EARTH_HORIZON.far.radii[0];
    const farOuter = EARTH_HORIZON.far.radii.at(-1)! * shrink;
    const position = new Vector3();
    let pendingFrames = 0, snapshot: string | null = null;
    for (let frame = 0; frame < 900; frame++) {
      position.set(frame * speed / 60 * .8, 0, frame * speed / 60 * .6);
      horizon.update(position, anchor, () => false, .6);
      const [far, near] = horizon.stats.levels;
      const nearDrift = Math.hypot(position.x - near.centre!.x, position.z - near.centre!.z);
      const farDrift = Math.hypot(position.x - far.centre!.x, position.z - far.centre!.z);
      assert.ok(farInner + farDrift <= nearOuter - nearDrift, `frame ${frame}: overlap lost (near ${nearDrift.toFixed(0)}, far ${farDrift.toFixed(0)})`);
      assert.ok(250_000 + farDrift <= farOuter, `frame ${frame}: outer edge inside 250 km`);
      const nearMesh = meshOf(horizon, 'earth-horizon-near-land');
      const key = `${near.publishes}:${nearMesh.position.x}:${nearMesh.geometry.getAttribute('position').getX(500)}`;
      if (near.pending) { pendingFrames++; if (snapshot?.startsWith(`${near.publishes}:`)) assert.equal(key, snapshot, 'a pending rebuild never changes the published surface'); }
      snapshot = key;
    }
    const [far, near] = horizon.stats.levels;
    t.diagnostic(`near ${near.publishes} publishes, far ${far.publishes}, ${pendingFrames} pending frames, ${horizon.stats.immediateBuilds} immediate`);
    assert.ok(near.publishes > 3);
  });
}

test('a new surface anchor rebuilds the whole horizon in the same call, and a still observer rebuilds nothing', t => {
  const horizon = new EarthHorizonPresentation();
  t.after(() => horizon.dispose());
  horizon.update({ x: 0, z: 0 }, { latDeg: -5, lonDeg: -65 }, () => false);
  const initial = horizon.stats.levels.map(level => level.publishes);
  for (let i = 0; i < 20; i++) horizon.update({ x: 10, z: -5 }, { latDeg: -5, lonDeg: -65 }, () => false);
  assert.deepEqual(horizon.stats.levels.map(level => level.publishes), initial, 'floating-origin frames rebuild nothing');
  horizon.update({ x: 400, z: 0 }, { latDeg: 50, lonDeg: 10 }, () => false, 0);
  for (const level of horizon.stats.levels) {
    assert.equal(level.pending, false);
    assert.deepEqual(level.centre, { x: 400, z: 0 }, 'the new frame is covered immediately');
  }
});

test('the horizon follows the ground handoff and retires its inner water only under resident chunks', t => {
  const horizon = new EarthHorizonPresentation();
  t.after(() => horizon.dispose());
  let covered = false;
  horizon.update({ x: 0, z: 0 }, { latDeg: 10, lonDeg: -35 }, () => covered);
  const cap = meshOf(horizon, 'earth-horizon-near-water-cap');
  assert.ok(cap.visible && cap.geometry.drawRange.count > 0);
  covered = true;
  horizon.update({ x: 0, z: 0 }, { latDeg: 10, lonDeg: -35 }, () => covered);
  assert.equal(cap.visible, false);
  const material = (meshOf(horizon, 'earth-horizon-near-land') as Mesh).material as MeshStandardMaterial;
  horizon.setOpacity(1);
  assert.ok(horizon.group.visible && !material.transparent && material.depthWrite);
  horizon.setOpacity(.4);
  assert.ok(horizon.group.visible && material.transparent && !material.depthWrite && material.opacity === .4);
  horizon.setOpacity(0);
  assert.equal(horizon.group.visible, false);
});

test('resident relief chunks count as surface coverage outside Manaus', async t => {
  const previousDocument = globalThis.document, previousOrigin = BuildingGeneratorContext.activeOrigin;
  const context = { fillStyle: '', fillRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const streamer = new WorldStreamer(new Group());
  t.after(() => { streamer.dispose(); globalThis.document = previousDocument; BuildingGeneratorContext.activeOrigin = previousOrigin; });
  streamer.setRegion({ bodyId: 'earth', latDeg: -15.7939, lonDeg: -47.8828, isManaus: false, surfaceType: 'terrestrial',
    regionId: createRegionId('earth', false, -15.7939, -47.8828) });
  await streamer.prepare(new Vector3());
  assert.equal(streamer.coversSurfaceDisk(0, 0, 128), true);
  assert.equal(streamer.coversSurfaceDisk(0, 0, EARTH_HORIZON.capRadiusM), false, 'only the 3×3 neighbourhood is resident yet');
  assert.equal(streamer.coversOceanDisk(0, 0, 128), false, 'dry relief is not an ocean cover');
});
