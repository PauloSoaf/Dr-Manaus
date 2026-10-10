# The Earth and the planet surface

Implements `04-EARTH-WGS84-AND-PLANET-SURFACE.md`. Code: `src/world/planet/`,
`src/world/providers/EarthProvider.ts`. Tests: `tests/planet-tiles.test.ts` (14),
`tests/earth-globe.test.ts` (9).

**Status: drawn.** `FEATURES.earthGlobe` is on: above 15 km the flat backdrop stands down and this
is the ground. What it took to get the geometry onto the screen, and what is still missing, is in
[15-status.md](15-status.md).

## A cube sphere, not a lat/lon grid

Six faces, each its own quadtree, mapped to the ellipsoid.

A latitude/longitude grid degenerates at the poles: tiles narrow to zero width, and Web Mercator
cannot represent the poles at all. In this game the poles have to be ordinary places you can fly
over, so the grid cannot be the one that breaks there.

`faceUvToDirection` applies a **tangent warp** to the cube-to-sphere mapping. Without it a tile at
a face corner covers nearly twice the ground of one at the face centre, and a single error
threshold would mean something different depending on where the player was standing. With it, tile
extent is near enough uniform that one threshold is one threshold.

`directionToFaceUv` is the exact inverse — picking the dominant axis, then untangenting — so a
geodetic position can be turned straight into the tile containing it without a search.

### Geocentric is not geodetic

Kept distinct throughout, with explicit conversions (`geocentricToGeodeticLatitude` and its
inverse). They differ by up to **0.19°**, which is over 20 km of ground. Conflating them is the
classic way to put a planet's tiles in the wrong place, and it looks almost right, which is worse.

## Tile addressing — `PlanetTileAddress.ts`

An address is `{ bodyId, face, level, x, y }`. Level 0 is one tile per face; each level doubles.
`MAX_PLANET_LEVEL` is 20. Measured extents on Earth, from `tileExtentM`:

| Level | Tile extent |
| --- | --- |
| 0 | 10 019 km |
| 4 | 626 km |
| 8 | 39.1 km |
| 12 | 2 446 m |
| 16 | 153 m |
| 20 | 9.6 m |

A tile's four children exactly tile their parent — asserted by test, because an off-by-one here
produces cracks that only show up at one specific altitude.

`tileGeometricErrorM` is what the LOD reads: the sagitta-like error of representing that patch of
curved surface at that tile's resolution, halving with each level.

## Refinement by screen-space error — `ScreenSpaceError.ts`

```
sse = geometricError × viewportHeight / (2 × distance × tan(fov / 2))
```

Refine while `sse > targetPx`. The default target is 8 px at a 58° field of view, scaled by the
quality preset's `detailFactor`.

Distance rings were the alternative and are wrong: the same ring means a different amount of
visible error at a different field of view or a different resolution, so the quality of the horizon
would depend on the window size.

## Selection — `PlanetQuadtree.ts`

Two properties, both of which were bugs before they were properties:

- **Depth first**, not breadth first. Breadth-first descent spends the whole tile budget on shallow
  levels and never reaches the ground under the player — the planet stays a blurry ball no matter
  how long you wait.
- **Distance to the nearest part of a tile**, not to its centre. With centre distance the tile you
  are standing on measures tens of kilometres away and refuses to refine, which is exactly
  backwards. The implementation subtracts the tile's bounding radius.

Faces and children are visited nearest first, so when the budget runs out it has been spent on what
the player is looking at. Tiles over the horizon are culled by the horizon test rather than by the
frustum, because the frustum does not know the planet is in the way.

## The mesh — `EarthGlobe.ts`

`buildTileMesh` produces a `TILE_RESOLUTION` × `TILE_RESOLUTION` (17×17) grid of positions,
normals and vertex colours.

Positions are **relative to the tile centre**. This is the whole precision argument made concrete:
a vertex 6 378 km from the Earth's centre cannot survive float32, but a vertex 40 km from its own
tile's centre has millimetres to spare. Precision then scales with the tile, not with the planet.
The test asserts this by taking each vertex back out through the scene transform to geodetic and
checking it lands on the ellipsoid — the residual it allows is float32 storage of the offset, and
nothing more.

Vertex colours come from the land mask (see [06-geodata-pipeline.md](06-geodata-pipeline.md)):
ocean, land, the polar ice and the arid belt. Not a texture, because a texture at this scale is
either a large download or visibly blurry, and the colours are a per-vertex lookup that is already
being done.

`EarthGlobe.add()` sets the mesh's position **and its orientation**. The orientation is not
decoration: vertex offsets lie along Earth-fixed axes while the scene runs in the city's tangent
plane, and placing a tile without rotating it leaves it lying flat at an arbitrary angle. That bug
shipped a sky full of floating plates, and the test that passed while it did checked only the tile
centre. It now checks every sampled vertex.

### Winding is measured, not assumed

Three of the six cube-face parameterisations mirror, so one fixed index order winds outward on half
the planet and inward on the other half. `buildTileMesh` therefore crosses the first quad's edges,
compares with the surface normal there, and reverses the order for the whole tile when they
disagree. One quad settles it: handedness changes between faces, never inside one.

Drawing both sides was the earlier answer and it was worse than the problem. A renderer shades a
back face with its normal flipped, so mirrored tiles faced the Sun geometrically and were lit as
though the Sun were underneath them — half the globe came out black in full daylight, which reads
as a lighting bug and is a winding bug. With the winding correct the material is `FrontSide`, and
the far side of the planet stops being rasterised at all.

Tiles are `frustumCulled = false`, deliberately and commented in place: the quadtree's horizon test
is stricter and more correct than a bounding sphere on a curved patch.

The globe owns its own `DirectionalLight` and `AmbientLight` on the planet layer, pointed by
`setSunDirection()` from the solar system model — so the terminator is where the Sun actually is,
not where the local time-of-day slider says.

## The provider — `EarthProvider.ts`

Implements `WorldProvider`. It plans from the quadtree, builds patches, and places them through the
frame graph, so a tile's position comes out of the spatial model rather than out of a guess.

Two gates:

- **Altitude.** Below `minAltitudeM` (15 km) the globe stays hidden. The city is still a flat plane
  on a curved planet: 20 km from the anchor the ellipsoid has dropped 31 m below it, and drawing
  both near the ground would show that seam. Above the gate, curvature is the thing being looked at
  and the flat patch is a pixel wide. Removing this gate is what phase 6 buys.
- **Coverage.** `MANAUS_COVERAGE` is a lat/lon box derived from the compiled 645-tile grid —
  roughly 26 km across — and a tile whose centre falls inside it at level ≥ 8 is not built. Level 8
  is where a tile (39.1 km) first becomes comparable with the city itself; anything coarser spans
  far more than Manaus, and skipping it would leave a hole in the planet beside the city, which is
  worse than an overlap the city's own geometry covers anyway. This is the ownership rule made
  concrete: it is what stops a second, coarser Manaus appearing underneath the real one.

The Earth-fixed to Manaus orientation is computed once and cached — it is constant, and it was
showing up in a profile.

## Bodies — `PlanetBody.ts`

| | Earth | Moon |
| --- | --- | --- |
| Semi-major axis | 6 378 137 m | 1 738 100 m |
| Flattening | 1/298.257223563 | 1/1130 |
| Rotation period | 86 164.0905 s (sidereal day) | 2 360 591.5 s (tidally locked) |
| μ | 3.986004418×10¹⁴ | 4.9028×10¹² |

## Not built

- Global terrain. Every tile is currently at `heightM = 0` — an ellipsoid, not a landscape.
  Phase 5 brings a DEM (Copernicus GLO-90).
- Crack-free seams between levels. Currently unaddressed because there is no height variation to
  crack.
- The ocean as a surface rather than as a colour.
