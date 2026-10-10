import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, Vector3 } from 'three/webgpu';
import {
  COARSE_FALLBACK_INSET_M, EARTH_SURFACE_PALETTE, EarthGlobe, TILE_RESOLUTION, buildTileMesh,
} from '../src/world/planet/EarthGlobe.ts';
import { EarthProvider, MANAUS_COVERAGE } from '../src/world/providers/EarthProvider.ts';
import { regionContains } from '../src/world/providers/WorldProvider.ts';
import { planetTile, tileCentreGeodetic, tileContaining } from '../src/world/planet/PlanetTileAddress.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { MANAUS_ANCHOR } from '../src/world/spatial/ManausFrameAdapter.ts';
import { ecefToGeodetic } from '../src/world/spatial/ECEF.ts';
import { surfaceHeightAt } from '../src/world/planet/EarthElevation.ts';
import { WGS84, WGS84_B } from '../src/world/spatial/WGS84.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget.ts';
import type { StreamingContext } from '../src/world/providers/WorldProvider.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

function context(position: Vec3): StreamingContext {
  const frame = referenceFrame({ id: 'earth/manaus/legacy-enu', kind: 'surface-enu' });
  return {
    spatial: {
      timeS: 0,
      player: pose('earth/manaus/legacy-enu', position),
      frame: activeFrame(frame, pose('earth/manaus/legacy-enu')),
      localVelocityMps: [0, 0, 0],
    },
    camera: { fovRad: 1.0, viewportHeightPx: 1080, forward: [0, 0, -1] },
    quality: { sseTargetPx: 8, detailFactor: 1 },
    budget: DEFAULT_STREAMING_BUDGET,
  };
}

test('a tile is built on the ellipsoid, not on a sphere', () => {
  // A tile at the pole and one at the equator must sit at genuinely different radii: 6 356 752 m
  // against 6 378 137 m. On a sphere they would be the same, which is the whole thing being tested.
  const equator = buildTileMesh(planetTile('earth', 0, 0, 0, 0));
  const pole = buildTileMesh(planetTile('earth', 4, 0, 0, 0));
  const equatorRadius = Math.hypot(equator.centre.xM, equator.centre.yM, equator.centre.zM);
  const poleRadius = Math.hypot(pole.centre.xM, pole.centre.yM, pole.centre.zM);
  assert.ok(Math.abs(equatorRadius - WGS84.semiMajorAxisM) < 1, `equator radius ${equatorRadius}`);
  assert.ok(Math.abs(poleRadius - WGS84_B) < 1, `pole radius ${poleRadius}`);
  assert.ok(equatorRadius - poleRadius > 21_000, 'the planet must be visibly oblate');
});

test('tile vertices are small numbers, whatever the tile is', () => {
  // The large number lives once, in the transform. A vertex buffer holding twelve million metres
  // would quantise the surface to metres at float32.
  for (const address of [
    planetTile('earth', 0, 0, 0, 0),
    planetTile('earth', 3, 6, 40, 12),
    planetTile('earth', 5, 9, 300, 200),
  ]) {
    const mesh = buildTileMesh(address);
    const positions = mesh.geometry.getAttribute('position');
    let worst = 0;
    for (let i = 0; i < positions.count; i++) {
      worst = Math.max(worst, Math.abs(positions.getX(i)), Math.abs(positions.getY(i)), Math.abs(positions.getZ(i)));
    }
    // Level 0 is a quarter of the planet across, so a few million metres; anything finer is tiny.
    const bound = address.level === 0 ? 6e6 : 1e6;
    assert.ok(worst < bound, `level ${address.level} vertex reached ${worst.toFixed(0)} m from its centre`);
    assert.ok(Number.isFinite(worst));
  }
});

test('every vertex lands on the surface, and its normal is the plumb line', () => {
  // The bare ellipsoid. Terrain is checked separately, below.
  const mesh = buildTileMesh(planetTile('earth', 2, 4, 5, 9), 0, true);
  const positions = mesh.geometry.getAttribute('position');
  const normals = mesh.geometry.getAttribute('normal');
  assert.equal(positions.count, TILE_RESOLUTION * TILE_RESOLUTION);

  for (let i = 0; i < positions.count; i += 37) {
    const point = {
      xM: positions.getX(i) + mesh.centre.xM,
      yM: positions.getY(i) + mesh.centre.yM,
      zM: positions.getZ(i) + mesh.centre.zM,
    };
    // On the surface by construction — but the offset is stored as float32, so the residual is
    // proportional to how far the vertex sits from its tile centre, not to the planet's radius.
    // That is exactly the trade this layout buys: precision scales with the tile, not the globe.
    const offset = Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i));
    const tolerance = offset * 1e-6 + 0.01;
    assert.ok(Math.abs(ecefToGeodetic(point).heightM) < tolerance,
      `a vertex is ${ecefToGeodetic(point).heightM.toFixed(4)} m off the ellipsoid, ${offset.toFixed(0)} m from its centre`);

    const normal: Vec3 = [normals.getX(i), normals.getY(i), normals.getZ(i)];
    assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-6, 'normals must be unit length');
    // The ellipsoid normal is not the direction to the centre; away from the equator they differ.
    const radial = Math.hypot(point.xM, point.yM, point.zM);
    const geocentric: Vec3 = [point.xM / radial, point.yM / radial, point.zM / radial];
    const alignment = normal[0] * geocentric[0] + normal[1] * geocentric[1] + normal[2] * geocentric[2];
    assert.ok(alignment > 0.999 && alignment <= 1 + 1e-9, `normal points away from the surface (${alignment})`);
  }
  assert.equal(mesh.triangles, (TILE_RESOLUTION - 1) ** 2 * 2);
});

test('a tile carries the real relief, and its normals tilt with the slope', () => {
  // Whichever tile actually contains the Himalayas, asked rather than guessed.
  const address = tileContaining('earth', { latRad: 28 * Math.PI / 180, lonRad: 87 * Math.PI / 180, heightM: 0 }, 5);
  const flat = buildTileMesh(address, 0, true);
  const relief = buildTileMesh(address);
  const flatPositions = flat.geometry.getAttribute('position');
  const reliefPositions = relief.geometry.getAttribute('position');

  let raised = 0, worstM = 0, tiltedNormals = 0;
  const normals = relief.geometry.getAttribute('normal');
  for (let i = 0; i < reliefPositions.count; i++) {
    const point = {
      xM: reliefPositions.getX(i) + relief.centre.xM,
      yM: reliefPositions.getY(i) + relief.centre.yM,
      zM: reliefPositions.getZ(i) + relief.centre.zM,
    };
    const geodetic = ecefToGeodetic(point);
    // Never below sea level: the ocean floor is not the surface of the planet.
    assert.ok(geodetic.heightM > -1, `a vertex sank to ${geodetic.heightM.toFixed(1)} m`);
    // And exactly the height the grid says, which is what makes two tiles agree on a shared edge.
    const expected = surfaceHeightAt(geodetic.latRad, geodetic.lonRad);
    worstM = Math.max(worstM, Math.abs(geodetic.heightM - expected));
    if (geodetic.heightM > 1) raised++;

    const normal: Vec3 = [normals.getX(i), normals.getY(i), normals.getZ(i)];
    assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-6, 'normals must stay unit length');
    // The plumb line for comparison: a sloped vertex must not be shaded as though it were flat.
    const cosLat = Math.cos(geodetic.latRad), sinLat = Math.sin(geodetic.latRad);
    const plumb: Vec3 = [cosLat * Math.cos(geodetic.lonRad), cosLat * Math.sin(geodetic.lonRad), sinLat];
    const alignment = normal[0] * plumb[0] + normal[1] * plumb[1] + normal[2] * plumb[2];
    assert.ok(alignment > 0, 'a terrain normal still points outward');
    if (alignment < 0.995) tiltedNormals++;
  }

  assert.ok(raised > 0, 'a tile over land must sit above sea level somewhere');
  assert.ok(worstM < 1.5, `height disagreed with the grid by ${worstM.toFixed(2)} m`);
  assert.ok(tiltedNormals > 0, 'relief that does not reach the normals is invisible from orbit');

  // The relief is a displacement of the ellipsoid, not a different surface.
  let moved = 0;
  for (let i = 0; i < reliefPositions.count; i++) {
    moved = Math.max(moved, Math.abs(reliefPositions.getX(i) - flatPositions.getX(i)));
  }
  assert.ok(moved > 0, 'the terrain must actually move the vertices');
});

test('two tiles that share an edge agree on its height, without any seam handling', () => {
  // Neighbours on the same face: the right edge of one is the left edge of the other.
  const left = buildTileMesh(planetTile('earth', 0, 3, 3, 4));
  const right = buildTileMesh(planetTile('earth', 0, 3, 4, 4));
  const leftPositions = left.geometry.getAttribute('position');
  const rightPositions = right.geometry.getAttribute('position');

  let worst = 0;
  for (let row = 0; row < TILE_RESOLUTION; row++) {
    const a = row * TILE_RESOLUTION + (TILE_RESOLUTION - 1);
    const b = row * TILE_RESOLUTION;
    const pa = {
      xM: leftPositions.getX(a) + left.centre.xM,
      yM: leftPositions.getY(a) + left.centre.yM,
      zM: leftPositions.getZ(a) + left.centre.zM,
    };
    const pb = {
      xM: rightPositions.getX(b) + right.centre.xM,
      yM: rightPositions.getY(b) + right.centre.yM,
      zM: rightPositions.getZ(b) + right.centre.zM,
    };
    worst = Math.max(worst, Math.hypot(pa.xM - pb.xM, pa.yM - pb.yM, pa.zM - pb.zM));
  }
  // Float32 storage of offsets from two different tile centres is the whole budget here. The
  // noise this replaced seeded itself per tile, so neighbours disagreed by whole mountains.
  assert.ok(worst < 50, `the shared edge is ${worst.toFixed(1)} m apart`);
});

test('the globe holds a tile and gives it back again', () => {
  const parent = new Group();
  const globe = new EarthGlobe(parent);
  try {
    assert.equal(globe.visible, false, 'hidden until something asks for it');
    const mesh = buildTileMesh(planetTile('earth', 1, 2, 1, 1));
    globe.add('a', mesh, [100, 200, 300], [0, 0, 0, 1]);
    assert.equal(globe.stats.tiles, 1);
    assert.ok(globe.stats.triangles > 0);

    // Adding the same key twice replaces rather than accumulating.
    globe.add('a', buildTileMesh(planetTile('earth', 1, 2, 1, 1)), [0, 0, 0], [0, 0, 0, 1]);
    assert.equal(globe.stats.tiles, 1);

    globe.remove('a');
    assert.equal(globe.stats.tiles, 0);
    assert.equal(globe.stats.triangles, 0, 'the triangle count must come back down');
  } finally {
    globe.dispose();
  }
});

test('coarse fallback closes detail gaps below the authoritative surface with coherent shading', () => {
  const parent = new Group();
  const globe = new EarthGlobe(parent);
  try {
    assert.equal(globe.surfaceGroup.parent, globe.group);
    assert.equal(globe.manausSurfaceAnchor.parent, globe.group);
    assert.notEqual(globe.manausSurfaceAnchor.parent, globe.surfaceGroup,
      'surface visibility must never hide the Manaus transform anchor');

    const address = planetTile('earth', 0, 0, 0, 0);
    const detail = globe.add('planet:earth:0:0:0:0', buildTileMesh(address));
    const fallback = globe.fallbackGroup.children.find(child => child.name === 'earth-fallback-face-0') as Mesh;
    assert.ok(fallback?.isMesh);
    assert.equal(detail.parent, globe.surfaceGroup);
    assert.equal(fallback.userData.surfaceInsetM, COARSE_FALLBACK_INSET_M);
    assert.equal(detail.userData.surfaceInsetM, 0);
    assert.ok(fallback.renderOrder < detail.renderOrder, 'coarse coverage must draw below detailed coverage');
    assert.equal(fallback.userData.surfacePalette, EARTH_SURFACE_PALETTE);
    assert.equal(detail.userData.surfacePalette, EARTH_SURFACE_PALETTE,
      'fallback/detail boundary must not change its surface palette');

    const coarsePosition = fallback.geometry.getAttribute('position');
    const detailPosition = detail.geometry.getAttribute('position');
    const coarseRadius = Math.hypot(
      coarsePosition.getX(0) + fallback.position.x,
      coarsePosition.getY(0) + fallback.position.y,
      coarsePosition.getZ(0) + fallback.position.z,
    );
    const detailRadius = Math.hypot(
      detailPosition.getX(0) + detail.position.x,
      detailPosition.getY(0) + detail.position.y,
      detailPosition.getZ(0) + detail.position.z,
    );
    assert.ok(Math.abs((detailRadius - coarseRadius) - COARSE_FALLBACK_INSET_M) < 0.25,
      'coarse/detail overlap needs a deterministic depth separation instead of coplanar z-fighting');
  } finally {
    globe.dispose();
  }
});

test('the globe stays hidden on the ground and appears once altitude makes it honest', () => {
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const earth = new EarthProvider(parent, runtime.frames, { minAltitudeM: 15_000, fadeM: 10_000 });
  try {
    // On the Largo the city is the ground, and a curved patch under it would show a seam.
    assert.equal(earth.covers(context([38, 2.2, 12]).spatial), false);
    assert.equal(earth.globe.visible, false);
    assert.equal(earth.covers(context([38, 14_000, 12]).spatial), false, 'still below the gate');

    assert.equal(earth.covers(context([38, 20_000, 12]).spatial), true);
    assert.ok(Math.abs(earth.globe.opacity - 0.5) < 1e-6, 'fadeM must reach the actual globe material');

    // Above it the curvature is what you are looking at.
    assert.equal(earth.covers(context([38, 40_000, 12]).spatial), true);
    assert.equal(earth.globe.visible, true);
    assert.ok(earth.stats.altitudeM > 39_000, `altitude reported as ${earth.stats.altitudeM}`);
  } finally {
    earth.dispose();
  }
});

test('the globe refuses to draw where the city owns the ground', () => {
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const earth = new EarthProvider(parent, runtime.frames, { minAltitudeM: 0, maxLevel: 12 });
  try {
    // The coverage box really does contain Manaus and really does not contain elsewhere.
    assert.ok(regionContains(MANAUS_COVERAGE, MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg));
    assert.ok(!regionContains(MANAUS_COVERAGE, -23.55, -46.63), 'São Paulo is not Manaus');

    const over = context([0, 3000, 0]);
    earth.covers(over.spatial);
    const demands = earth.plan(over);
    assert.ok(demands.length > 0, 'the planet must still be planned around the city');

    // No fine tile is planned whose centre sits inside the city: that would be a second Manaus.
    for (const demand of demands) {
      const key = demand.key;
      if (key.kind !== 'planet' || key.level < 8) continue;
      const centre = tileCentreGeodetic(planetTile('earth', key.face as 0, key.level, key.x, key.y));
      const inside = regionContains(
        MANAUS_COVERAGE, centre.latRad * 180 / Math.PI, centre.lonRad * 180 / Math.PI,
      );
      assert.ok(!inside, `a level ${key.level} tile was planned inside the city`);
    }
  } finally {
    earth.dispose();
  }
});

test('a planned tile loads, activates and lands where the frame graph says it should', async () => {
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const earth = new EarthProvider(parent, runtime.frames, { minAltitudeM: 0, maxTiles: 96, maxLevel: 6 });
  try {
    const over = context([0, 200_000, 0]);
    earth.covers(over.spatial);
    const demands = earth.plan(over);
    assert.ok(demands.length > 0);

    const payload = await earth.load(demands[0]);
    assert.ok(payload.cpuBytes > 0 && payload.estimatedGpuBytes > 0, 'the cache evicts on these');
    const frame = activeFrame(referenceFrame({ id: 'x', kind: 'render-local' }), pose('x'));
    const active = earth.activate(payload, frame);
    assert.equal(earth.globe.stats.tiles, 1);

    // The tile under the player must be near the city origin in scene metres — that is the whole
    // claim that the globe is positioned by the spatial model rather than by a guess.
    const beneath = demands.reduce((best, d) => d.distanceM < best.distanceM ? d : best);
    const beneathPayload = await earth.load(beneath);
    earth.activate(beneathPayload, frame);
    const centre = (beneathPayload.geometry as { centre: { xM: number; yM: number; zM: number } }).centre;
    const scene = runtime.frames.convertPosition(
      'earth/fixed', 'earth/manaus/legacy-enu', [centre.xM, centre.yM, centre.zM],
    );
    // A level-6 tile is 156 km across, so its centre is within that of the anchor.
    assert.ok(Math.hypot(scene[0], scene[2]) < 400_000, `the nearest tile centre is ${Math.hypot(scene[0], scene[2])} m away`);

    earth.deactivate(active);
    assert.ok(earth.globe.stats.tiles < 2, 'deactivating must take it back out');
  } finally {
    earth.dispose();
  }
});

test('the provider loses every overlap, which is what makes it a fallback', () => {
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const earth = new EarthProvider(parent, runtime.frames);
  try {
    // It claims nothing, so the registry's ownership rule can never resolve in its favour.
    assert.deepEqual(earth.coverage(), []);
    assert.ok(earth.priority < 100, 'and its priority is below the city and the landmarks');
    runtime.providers.register(earth);
    assert.equal(runtime.providers.all[runtime.providers.all.length - 1].id, earth.id);
  } finally {
    earth.dispose();
  }
});

test('an activated tile lands on the planet, vertex by vertex, not just at its centre', async () => {
  // The bug this exists for: the centre was placed correctly while the geometry kept Earth-fixed
  // axes, so every tile sat flat at an arbitrary angle. Checking the centre alone passed happily
  // and the sky filled with plates.
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const earth = new EarthProvider(parent, runtime.frames, { minAltitudeM: 0, maxTiles: 40, maxLevel: 5 });
  try {
    const over = context([0, 300_000, 0]);
    earth.covers(over.spatial);
    const demands = earth.plan(over);
    const nearest = demands.reduce((best, d) => d.distanceM < best.distanceM ? d : best);
    const payload = await earth.load(nearest);
    const frame = activeFrame(referenceFrame({ id: 'x', kind: 'render-local' }), pose('x'));
    earth.activate(payload, frame);

    // By name, not by index or by 'first mesh': the group also holds the atmosphere shell, which
    // is a sphere 60 km up and would fail this test for reasons that have nothing to do with tiles.
    const mesh = earth.globe.surfaceGroup.children.find(child => child.name.startsWith('globe-')) as Mesh;
    assert.ok(mesh?.isMesh, 'the tile must be in the scene');
    parent.updateMatrixWorld(true);

    // Every sampled vertex, taken through the scene transform and back out of the Manaus frame,
    // has to land on the ellipsoid. If the rotation is missing this is wrong by thousands of
    // kilometres on all but the one tile that happens to face the city.
    const positions = mesh.geometry.getAttribute('position');
    const world = new Vector3();
    let worst = 0;
    for (let i = 0; i < positions.count; i += 23) {
      world.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      const ecef = runtime.frames.convertPosition(
        'earth/manaus/legacy-enu', 'earth/fixed', [world.x, world.y, world.z],
      );
      const height = ecefToGeodetic({ xM: ecef[0], yM: ecef[1], zM: ecef[2] }).heightM;
      worst = Math.max(worst, Math.abs(height));
    }
    // Metres, not kilometres: the residual is float32 storage of the vertex offsets and the
    // 0.67% gap between the city's projection and the ellipsoid, nothing more.
    assert.ok(worst < 500, `a vertex sits ${(worst / 1000).toFixed(1)} km off the planet`);

    // And the tile is genuinely curved: its own normals must fan out rather than be parallel.
    const normals = mesh.geometry.getAttribute('normal');
    const first = new Vector3().fromBufferAttribute(normals, 0);
    const last = new Vector3().fromBufferAttribute(normals, normals.count - 1);
    assert.ok(first.dot(last) < 0.9999, 'a planet tile is a curved patch, not a flat plate');
  } finally {
    earth.dispose();
  }
});
