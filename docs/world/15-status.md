# Planetary architecture — implementation status

Tracks `dr-manaus-cosmic-world-specs` against the code, phase by phase. Written so that anyone
picking this up knows what is finished, what is half-finished, and what has not been started —
including the things that do not work.

Baseline: `d2e03428b1d9ba90fdc7b2a5112c280e6686fead` (PR #2 merged into `main`).
Branch: `feat/universe-map`.

This is the progress tracker. The subject documents are listed in [README.md](README.md); the
acceptance criteria are checked one by one in [17-acceptance.md](17-acceptance.md).

## Phase status

| # | Phase | State | Where |
| --- | --- | --- | --- |
| 0 | Freeze baseline | **done** | [`../geodata.md`](../geodata.md) corrected; invariants pinned in tests |
| 1 | Spatial core | **done** | `src/world/spatial/` — [03](03-coordinates-and-frames.md) |
| 2 | Manaus compatibility adapter | **done** | `ManausFrameAdapter` — [05](05-manaus-migration.md) |
| 3 | Global streaming scheduler | **done** (not yet driving Manaus) | `src/world/streaming/` — [07](07-streaming.md) |
| 4 | Earth WGS84 low LOD | **partial** — see below | `src/world/planet/` — [04](04-earth-and-planet-surface.md) |
| 5 | Global terrain (DEM) | not started | — |
| 6 | Curve Manaus onto the ellipsoid | not started | — |
| 7 | Atmosphere and render domains | **partial** | `src/rendering/domains/` — [08](08-render-domains.md) |
| 8 | Remove the 140 km ceiling | **done, behind the globe flag** | `SPACE.maxAltitude` |
| 9 | Solar system | **done** (logical model) | `src/world/celestial/` — [10](10-solar-system.md) |
| 10 | Galaxy layer | **partial** — sectors and stars, no rendering | `StarSector.ts` — [11](11-galaxy-and-universe.md) |
| 11 | Universe sectors | **partial** — addressing and seeds only | `UniverseAddress.ts` — [11](11-galaxy-and-universe.md) |
| 12 | Persistence hardening | not started | — |
| 13 | Hardening | not started | — |

Everything is gated by `FEATURES` in `src/core/config.ts`. Only `spatialCore` is on: it observes
and reports, costs below the profiler's 0.05 ms reporting threshold at every speed, and changes
nothing about what is drawn.

## What is verified

245 tests, `npm run build`, `npm run test:browser` and `npm run profile` all pass. The browser
smoke test still places the Monumento at `0,0` and the Teatro at `-83,-6`, so Manaus has not moved.

Specific invariants under test:

- WGS84 constants are the defining ones; the ECEF inverse round-trips to sub-millimetre from the
  surface to geostationary altitude.
- The Manaus projection is reproduced bit for bit, and the coordinates the shipped game produced
  before the migration are frozen in the test — if the projection moves, the city moves.
- A rebase never changes a logical position, a distance between objects, or the origin's rotation.
- A tile's four children exactly tile their parent; the poles are ordinary tiles.
- Planet tile vertices land on the ellipsoid, and the residual is float32 storage of the offsets —
  precision scales with the tile, not with the globe.
- The planets sit at their real J2000 distances in the right order; the Moon and the Sun both come
  out about half a degree across.
- Star sectors regenerate identically from the same seed.

## Phase 4 — the globe: what works and what does not

**Built and under test:**

- Cube-sphere quadtree on the WGS84 ellipsoid, refined by screen-space error, horizon-culled.
- `EarthProvider` plans, builds and activates tiles through the streaming scheduler, and stands
  down where the city claims the ground.
- Real continents. `scripts/geodata/build-earth-vectors.mjs` downloads Natural Earth 1:110m land
  polygons (public domain), rasterises them by scanline into a 1024×512 bitmask, and commits it as
  `src/world/geodata/earth-landmask.json` (86 KB). Verified by rendering it as ASCII: the
  continents are recognisably themselves. Vertex colours give ocean, land, the polar ice and the
  arid belt — the last two are latitude rules, stated as such, not invented geography.
- Lit from the real solar direction taken from the solar system model, so the terminator is real
  rather than tied to the local clock.

**What does not work yet:**

The tiles issue their draw calls in the planetary pass — 30 to 80 of them depending on altitude —
and produce no visible pixels. Measured and ruled out, each with a direct observation rather than
a guess:

| Hypothesis | How it was tested | Result |
| --- | --- | --- |
| Tiles mis-oriented | vertex world positions converted back to geodetic | was a real bug, **fixed** (see below) |
| Beyond the far plane | `camera.far` vs tile distance | within range |
| Wrong layer | compared `mesh.layers.mask` with `camera.layers.mask` | both 2 |
| Cameras misaligned | position delta and direction dot between the two | 0 m, dot 1.0 |
| Frustum culling | disabled it | draws went 1 → 83, so culling **was** rejecting them; now off |
| Back-face culling | `side: DoubleSide` | no change |
| Covered by the sky dome | hid `Atmosphere.sky` and `SpaceLayer.shell` | no change |
| Not lit | emissive material, planetary pass rendered alone | still black |

The last row is where it stands: with the local pass skipped entirely and the material self-lit,
the frame is still black. The geometry is provably correct — the unit test takes each vertex
through the scene transform and back out of the Manaus frame and confirms it lands on the
ellipsoid — so what remains is in how the second pass reaches the screen. The logarithmic depth
buffer shared between two cameras with very different near/far ranges is the leading suspect and
has not been tested.

Because turning the flag on also stands the sky dome and the old space shell down above 15 km, it
is **off**: on, it would trade a working sky for an empty one.

### Two real bugs found on the way

Worth recording, because both produced confident-looking wrong output:

1. **Tiles placed without rotation.** Vertices are offsets along Earth-fixed axes while the scene
   uses the city's tangent plane. Placing the mesh without turning it left every tile flat at an
   arbitrary angle — a field of plates in the sky rather than a planet. The test that passed
   happily checked only the tile centre; it now checks every sampled vertex.
2. **Fog applied to the planetary pass.** Fog is calibrated for a 260 km far plane, so a globe
   thousands of kilometres away came out entirely the colour of the haze — purple at dusk, black
   at night. The composer clears fog for the far pass.

## Phase 7 — render domains

`src/rendering/domains/RenderDomainComposer.ts`. One camera cannot hold a 0.15 m near plane and a
horizon 1 300 km away, and the specification says explicitly not to answer that by raising `far`
to astronomical units. The frame is drawn furthest first with the depth buffer cleared between
passes, each pass with its own camera sharing the main camera's world transform.

The far plane grows with the body's distance: a fixed 50 000 km reaches low orbit and would clip
the Earth away entirely from the Moon's distance.

Not done: a planet-aware atmosphere. `Atmosphere.sky` is still a 44 km dome drawn around the
player, and `SpaceLayer.shell` is still the old stand-in for the planet seen from space. Both are
now exposed so the planetary view can stand them down, which is the interim step the specification
describes before they are replaced.

## Phase 8 — the ceiling

`SPACE.maxAltitude` was 140 km because a flat world has no outside. With the planetary domain it
moves to 500 000 km — past the Moon — while the globe flag is on, and stays at 140 km otherwise.
It is still a ceiling rather than nothing: the phase that removes it entirely is the one that
hands the player into another body's frame.

## Data and licences

| Asset | Source | Licence | Retrieved |
| --- | --- | --- | --- |
| `src/world/geodata/earth-landmask.json` | Natural Earth 1:110m land | Public domain | 2026-09-25 |
| Solar system ephemerides | JPL approximate elements (Standish), embedded as constants | Public domain (US Gov) | n/a — no download |

Neither is fetched at runtime. The Natural Earth download happens only when the build script is
run by hand. Full provenance and the rules that constrain it are in
[06-geodata-pipeline.md](06-geodata-pipeline.md).

## Next step

Test whether the logarithmic depth buffer is what loses the far pass, by rendering the planetary
domain with `logarithmicDepthBuffer` disabled or with a near/far range closer to the local one. If
that is it, the fix is a per-domain depth configuration rather than a shared one.

After that, in the order the specification sets: register `ManausProvider` with the scheduler so
the city streams through the same queue, then the global DEM, then curving Manaus onto the
ellipsoid.
