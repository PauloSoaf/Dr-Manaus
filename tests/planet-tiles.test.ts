import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUBE_FACES, directionToFaceUv, directionToGeodetic, faceUvToDirection,
  geocentricToGeodeticLatitude, geodeticToFaceUv,
} from '../src/world/planet/CubeSphere.ts';
import {
  MAX_PLANET_LEVEL, isValidTile, planetTile, tileBounds, tileCentreGeodetic, tileChildren,
  tileContaining, tileExtentM, tileGeometricErrorM, tileParent, tilesPerSide,
} from '../src/world/planet/PlanetTileAddress.ts';
import {
  DEFAULT_SSE, effectiveTargetPx, refinementDistanceM, screenSpaceError, shouldRefine,
} from '../src/world/planet/ScreenSpaceError.ts';
import {
  EARTH, MOON, altitudeAboveSurfaceM, angularRadiusRad, bodyGeodeticToFixed, meanRadiusM,
  polarRadiusM, surfaceGravityMps2,
} from '../src/world/planet/PlanetBody.ts';
import { PlanetQuadtree } from '../src/world/planet/PlanetQuadtree.ts';
import { geodeticFromDegrees } from '../src/world/spatial/Geodetic.ts';
import { geodeticToEcef } from '../src/world/spatial/ECEF.ts';
import { WGS84, WGS84_B } from '../src/world/spatial/WGS84.ts';
import { lengthVec3, radToDeg, type Vec3 } from '../src/world/spatial/units.ts';
import { MANAUS_ANCHOR } from '../src/world/spatial/ManausFrameAdapter.ts';

test('the cube sphere covers the whole body and round trips every direction', () => {
  // Six faces, and every direction belongs to exactly one of them.
  for (const face of CUBE_FACES) {
    for (const u of [-1, -0.5, 0, 0.5, 1]) {
      for (const v of [-1, -0.5, 0, 0.5, 1]) {
        const direction = faceUvToDirection(face, u, v);
        assert.ok(Math.abs(lengthVec3(direction) - 1) < 1e-12, 'directions must be unit length');
        const back = directionToFaceUv(direction);
        // Corners and edges are shared between faces, so only interior points must land back on
        // the same face; everywhere the direction itself must be reproduced.
        const reproduced = faceUvToDirection(back.face, back.u, back.v);
        for (let i = 0; i < 3; i++) {
          assert.ok(Math.abs(reproduced[i] - direction[i]) < 1e-9,
            `face ${face} (${u}, ${v}) came back as face ${back.face} (${back.u}, ${back.v})`);
        }
        if (Math.abs(u) < 1 && Math.abs(v) < 1) assert.equal(back.face, face);
      }
    }
  }
});

test('the poles are ordinary points on the cube sphere, not a singularity', () => {
  // This is the reason for a cube sphere rather than a latitude/longitude grid.
  const north = geodeticToFaceUv(geodeticFromDegrees(90, 0, 0));
  const south = geodeticToFaceUv(geodeticFromDegrees(-90, 0, 0));
  assert.equal(north.face, 4, 'the north pole sits on the +Z face');
  assert.equal(south.face, 5, 'and the south pole on -Z');
  assert.ok(Math.abs(north.u) < 1e-9 && Math.abs(north.v) < 1e-9, 'at that face centre');

  // A tile at the pole is a normal tile with normal neighbours, at every level.
  for (const level of [0, 3, 8]) {
    const tile = tileContaining('earth', geodeticFromDegrees(89.999, 137, 0), level);
    assert.ok(isValidTile(tile), `pole tile at level ${level} is out of range`);
    assert.equal(tile.level, level);
  }
});

test('the tangent warp keeps tiles roughly the same size across a face', () => {
  // A raw cube-to-sphere mapping bunches tiles at face centres and stretches them at corners by
  // nearly a factor of two, which would make one error threshold behave differently by position.
  const level = 4;
  const areas: number[] = [];
  const side = tilesPerSide(level);
  for (const x of [0, Math.floor(side / 2), side - 1]) {
    for (const y of [0, Math.floor(side / 2), side - 1]) {
      const tile = planetTile('earth', 0, level, x, y);
      const { minU, maxU, minV, maxV } = tileBounds(tile);
      // Solid angle, approximated by the quad's corner directions.
      const a = faceUvToDirection(0, minU, minV);
      const b = faceUvToDirection(0, maxU, minV);
      const c = faceUvToDirection(0, minU, maxV);
      const ab = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      const ac = Math.acos(Math.min(1, a[0] * c[0] + a[1] * c[1] + a[2] * c[2]));
      areas.push(ab * ac);
    }
  }
  const spread = Math.max(...areas) / Math.min(...areas);
  assert.ok(spread < 1.6, `tile area varies by ${spread.toFixed(2)}x across a face`);
});

test('geocentric and geodetic latitude are not the same, and the difference is kilometres', () => {
  // Treating one as the other misplaces mid-latitudes by about 0.19 degrees, over 20 km.
  const worst = radToDeg(Math.abs(geocentricToGeodeticLatitude(Math.PI / 4) - Math.PI / 4));
  assert.ok(worst > 0.15 && worst < 0.25, `the largest difference is ${worst.toFixed(3)} degrees`);
  // They coincide at the equator and at the poles.
  assert.ok(Math.abs(geocentricToGeodeticLatitude(0)) < 1e-12);
  assert.ok(Math.abs(geocentricToGeodeticLatitude(Math.PI / 2) - Math.PI / 2) < 1e-9);

  // And a direction converted to geodetic lands where it should on the ellipsoid.
  const manaus = geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, 0);
  const { face, u, v } = geodeticToFaceUv(manaus);
  const round = directionToGeodetic(faceUvToDirection(face, u, v));
  assert.ok(Math.abs(radToDeg(round.latRad) - MANAUS_ANCHOR.latDeg) < 1e-6, 'latitude survives');
  assert.ok(Math.abs(radToDeg(round.lonRad) - MANAUS_ANCHOR.lonDeg) < 1e-6, 'longitude survives');
});

test('the quadtree address is a proper tree: children tile the parent and nothing else', () => {
  const root = planetTile('earth', 2, 0, 0, 0);
  assert.equal(tileParent(root), undefined, 'level zero is a root');

  const children = tileChildren(root);
  assert.equal(children.length, 4);
  const parentBounds = tileBounds(root);
  let covered = 0;
  for (const child of children) {
    assert.deepEqual(tileParent(child), root, 'every child must name its parent');
    const bounds = tileBounds(child);
    assert.ok(bounds.minU >= parentBounds.minU - 1e-12 && bounds.maxU <= parentBounds.maxU + 1e-12);
    assert.ok(bounds.minV >= parentBounds.minV - 1e-12 && bounds.maxV <= parentBounds.maxV + 1e-12);
    covered += (bounds.maxU - bounds.minU) * (bounds.maxV - bounds.minV);
  }
  const parentArea = (parentBounds.maxU - parentBounds.minU) * (parentBounds.maxV - parentBounds.minV);
  assert.ok(Math.abs(covered - parentArea) < 1e-12, 'the four children must exactly tile the parent');

  assert.equal(tileChildren(planetTile('earth', 0, MAX_PLANET_LEVEL, 0, 0)).length, 0, 'the tree ends');
  assert.equal(isValidTile(planetTile('earth', 0, 3, 8, 0)), false, 'out of range is rejected');
  assert.equal(isValidTile(planetTile('earth', 0, 3, 7, 7)), true);
});

test('tile extents and errors shrink by half with every level', () => {
  const radius = meanRadiusM(EARTH);
  // Level 0 is a quarter of the way round the planet.
  const root = tileExtentM(planetTile('earth', 0, 0, 0, 0), radius);
  assert.ok(Math.abs(root - (Math.PI / 2) * radius) < 1, `level 0 is ${(root / 1000).toFixed(0)} km`);
  for (let level = 1; level < 12; level++) {
    const here = tileExtentM(planetTile('earth', 0, level, 0, 0), radius);
    const above = tileExtentM(planetTile('earth', 0, level - 1, 0, 0), radius);
    assert.ok(Math.abs(here * 2 - above) < 1e-6, `level ${level} did not halve`);
    // Geometric error falls faster than extent, as a sagitta does.
    assert.ok(tileGeometricErrorM(planetTile('earth', 0, level, 0, 0), radius)
      < tileGeometricErrorM(planetTile('earth', 0, level - 1, 0, 0), radius));
  }
  // And by level 14 a tile is small enough to hold a city block.
  assert.ok(tileExtentM(planetTile('earth', 0, 14, 0, 0), radius) < 700);
});

test('screen-space error is what drives refinement, not distance', () => {
  const context = { ...DEFAULT_SSE, targetPx: 8, viewportHeightPx: 1080 };
  // The same error is worth more up close and less far away.
  const near = screenSpaceError(1000, 10_000, context);
  const far = screenSpaceError(1000, 1_000_000, context);
  assert.ok(near > far * 50, 'error must fall with distance');
  assert.ok(shouldRefine(1000, 10_000, context));
  assert.ok(!shouldRefine(1000, 100_000_000, context));

  // Doubling the resolution doubles the pixels of error, so the same scene refines further.
  const taller = screenSpaceError(1000, 10_000, { ...context, viewportHeightPx: 2160 });
  assert.ok(Math.abs(taller - near * 2) < 1e-9);

  // A lower quality preset coarsens everything by raising the effective target.
  assert.ok(effectiveTargetPx({ ...context, detailFactor: 0.5 }) > effectiveTargetPx(context));
  assert.ok(!shouldRefine(1000, 200_000, { ...context, detailFactor: 0.1 }));

  // And the distance at which a tile becomes good enough is self-consistent.
  const distance = refinementDistanceM(1000, context);
  assert.ok(Math.abs(screenSpaceError(1000, distance, context) - effectiveTargetPx(context)) < 1e-9);
  assert.equal(refinementDistanceM(0, context), 0);
  assert.ok(Number.isFinite(screenSpaceError(Number.NaN, Number.NaN, context)));
});

test('Earth is the WGS84 ellipsoid, and the Moon is not Earth', () => {
  assert.equal(EARTH.semiMajorAxisM, WGS84.semiMajorAxisM);
  assert.ok(Math.abs(polarRadiusM(EARTH) - WGS84_B) < 1e-6);
  // Surface gravity falls out of the mass, rather than being typed in.
  assert.ok(Math.abs(surfaceGravityMps2(EARTH) - 9.798) < 0.01, `${surfaceGravityMps2(EARTH)}`);
  assert.ok(Math.abs(surfaceGravityMps2(MOON) - 1.62) < 0.02, `${surfaceGravityMps2(MOON)}`);

  // The Moon must not inherit Earth's ellipsoid through a shared conversion.
  const onMoon = bodyGeodeticToFixed(MOON, geodeticFromDegrees(0, 0, 0));
  assert.ok(Math.abs(onMoon.xM - MOON.semiMajorAxisM) < 1, `${onMoon.xM}`);
  const onEarth = bodyGeodeticToFixed(EARTH, geodeticFromDegrees(0, 0, 0));
  assert.ok(Math.abs(onEarth.xM - WGS84.semiMajorAxisM) < 1e-6);
});

test('altitude above the surface is honest at every altitude the game reaches', () => {
  const cases: Array<[number, number, string]> = [
    [0, 0, 'on the equator'],
    [140_000, 140_000, 'the old ceiling'],
    [400_000, 400_000, 'low orbit'],
    [35_786_000, 35_786_000, 'geostationary'],
  ];
  for (const [height, expected, label] of cases) {
    const fixed = geodeticToEcef(geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, height));
    const altitude = altitudeAboveSurfaceM(EARTH, fixed);
    assert.ok(Math.abs(altitude - expected) < 60, `${label}: ${altitude.toFixed(1)} m vs ${expected}`);
  }
  // At the pole the ellipsoid is 21 km closer to the centre, and this must account for it.
  const pole = geodeticToEcef(geodeticFromDegrees(90, 0, 0));
  assert.ok(Math.abs(altitudeAboveSurfaceM(EARTH, pole)) < 1, 'the pole is on the surface, not 21 km up');
});

test('a distant body is sized by the angle it occupies, never by an arbitrary scale', () => {
  // The Moon from Earth is about half a degree across; this is the number that keeps a celestial
  // proxy honest instead of a quad at a made-up distance.
  const apparent = 2 * angularRadiusRad(MOON, 384_400_000);
  assert.ok(Math.abs(radToDeg(apparent) - 0.518) < 0.02, `${radToDeg(apparent).toFixed(3)} degrees`);
  // From the surface, Earth fills the sky.
  assert.ok(angularRadiusRad(EARTH, meanRadiusM(EARTH) * 0.5) === Math.PI / 2);
  // And the angle shrinks with distance as it must.
  assert.ok(angularRadiusRad(EARTH, 1e9) < angularRadiusRad(EARTH, 1e8));
});

test('the quadtree selects a coarse cut from orbit and a fine one from the ground', () => {
  const tree = new PlanetQuadtree(EARTH, { maxTiles: 400, maxLevel: 16 });
  const sse = { ...DEFAULT_SSE, targetPx: 8 };

  // From far out, the whole planet is a handful of tiles.
  const farAway = { xM: 0, yM: 0, zM: 50 * meanRadiusM(EARTH) };
  const distant = tree.select(farAway, sse);
  assert.ok(distant.length > 0 && distant.length <= 24, `${distant.length} tiles from far away`);
  assert.ok(Math.max(...distant.map(t => t.address.level)) <= 3, 'and they are coarse');

  // From just above Manaus, the tiles underneath are fine and the count is still bounded.
  const overhead = geodeticToEcef(geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, 2000));
  const close = tree.select(overhead, sse);
  assert.ok(close.length <= 400, 'the tile cap is a hard cap');
  // This quadtree measures the *shape* error only — how far a flat tile departs from the curved
  // ellipsoid. From 2 km up, the curvature across a 20 km tile is genuinely only a few pixels, so
  // stopping around level 9 is correct here. Terrain elevation, which arrives with the DEM, is
  // what will drive the descent deeper still.
  const deepest = Math.max(...close.map(t => t.address.level));
  assert.ok(deepest >= 9, `closest level was only ${deepest}`);
  const finestExtent = Math.min(...close.map(t => t.extentM));
  assert.ok(finestExtent < 25_000, `the finest tile underfoot is ${(finestExtent / 1000).toFixed(1)} km across`);

  // The deepest tiles are the ones under the camera, not somewhere random.
  const finest = close.reduce((best, tile) => tile.address.level > best.address.level ? tile : best);
  const beneath = tileCentreGeodetic(finest.address);
  assert.ok(Math.abs(radToDeg(beneath.latRad) - MANAUS_ANCHOR.latDeg) < 1, 'refined in the wrong place');
  assert.ok(Math.abs(radToDeg(beneath.lonRad) - MANAUS_ANCHOR.lonDeg) < 1, 'refined in the wrong place');
});

test('the far side of the planet is not streamed', () => {
  const tree = new PlanetQuadtree(EARTH, { maxTiles: 400, maxLevel: 12 });
  const sse = { ...DEFAULT_SSE, targetPx: 8 };
  // Camera over the equator at the prime meridian, a thousand kilometres up.
  const camera = geodeticToEcef(geodeticFromDegrees(0, 0, 1_000_000));
  const selected = tree.select(camera, sse);

  const antipode: Vec3 = [-1, 0, 0];
  for (const tile of selected) {
    const centre = tile.centre;
    const length = Math.hypot(centre.xM, centre.yM, centre.zM);
    const dot = (centre.xM / length) * antipode[0] + (centre.yM / length) * antipode[1];
    assert.ok(dot < 0.75, 'a tile on the far side of the planet was selected');
  }
  assert.ok(selected.length > 4, 'but the visible side is still covered');
});

test('the selection stays bounded however close the camera gets', () => {
  const tree = new PlanetQuadtree(EARTH, { maxTiles: 64, maxLevel: MAX_PLANET_LEVEL });
  const sse = { ...DEFAULT_SSE, targetPx: 1 };
  for (const height of [10, 1000, 100_000, 10_000_000]) {
    const camera = geodeticToEcef(geodeticFromDegrees(MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, height));
    const selected = tree.select(camera, sse);
    assert.ok(selected.length > 0, `nothing selected at ${height} m`);
    assert.ok(selected.length <= 64, `${selected.length} tiles at ${height} m exceeds the cap`);
    for (const tile of selected) assert.ok(isValidTile(tile.address));
  }
});

test('the level needed for a distance agrees with walking the tree', () => {
  const tree = new PlanetQuadtree(EARTH);
  const sse = { ...DEFAULT_SSE, targetPx: 8 };
  let previous = MAX_PLANET_LEVEL + 1;
  for (const distance of [1000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000]) {
    const level = tree.levelForDistance(distance, sse);
    assert.ok(level <= previous, 'a further camera must never need a finer level');
    previous = level;
  }
  assert.ok(tree.levelForDistance(1e12, sse) === 0, 'from far enough, one tile per face will do');
});
