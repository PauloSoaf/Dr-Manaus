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
| 4 | Earth WGS84 low LOD | **done** — drawn, streamed, lit | `src/world/planet/` — [04](04-earth-and-planet-surface.md) |
| 5 | Global terrain (DEM) | not started | — |
| 6 | Curve Manaus onto the ellipsoid | not started | — |
| 7 | Atmosphere and render domains | **partial** — domains done, atmosphere not | `src/rendering/domains/` — [08](08-render-domains.md) |
| 8 | Remove the 140 km ceiling | **done** — 500 000 km | `SPACE.maxAltitude` |
| 9 | Solar system | **done** (logical model) | `src/world/celestial/` — [10](10-solar-system.md) |
| 10 | Galaxy layer | **partial** — sectors and stars, no rendering | `StarSector.ts` — [11](11-galaxy-and-universe.md) |
| 11 | Universe sectors | **partial** — addressing and seeds only | `UniverseAddress.ts` — [11](11-galaxy-and-universe.md) |
| 12 | Persistence hardening | not started | — |
| 13 | Hardening | not started | — |

Everything is gated by `FEATURES` in `src/core/config.ts`. `spatialCore` and `earthGlobe` are on;
the rest are off. Below 15 km nothing about the game has changed — the city, its sky and its
horizon are exactly what they were. Above it the flat backdrop stands down and the real ellipsoid
takes over.

## What is verified

246 unit tests and `npm run build` pass. The city is unchanged at ground level, checked by eye at
400 m and 12 km as well as by test.

**`npm run test:browser` currently fails**, on `shellTriangles === 0` — the real-city footprint
shell does not finish streaming inside the test's 90 s window under the software renderer. It fails
the same way on the commit this branch started from, so it is not a regression from this work, but
it is not passing either and should not be described as if it were.

Specific invariants under test:

- WGS84 constants are the defining ones; the ECEF inverse round-trips to sub-millimetre from the
  surface to geostationary altitude.
- The Manaus projection is reproduced bit for bit, and the coordinates the shipped game produced
  before the migration are frozen in the test — if the projection moves, the city moves.
- A rebase never changes a logical position, a distance between objects, or the origin's rotation.
- A tile's four children exactly tile their parent; the poles are ordinary tiles.
- Planet tile vertices land on the ellipsoid *through the full scene transform*, and the residual
  is float32 storage of the offsets — precision scales with the tile, not with the globe.
- The planets sit at their real J2000 distances in the right order; the Moon and the Sun both come
  out about half a degree across.
- Star sectors regenerate identically from the same seed.
- Heavy activations stay capped at two per frame while light ones get their own larger allowance.

## Phase 4 — the globe

Working. From about 15 km the flat backdrop stands down and the WGS84 ellipsoid takes over: a
cube-sphere quadtree refined by screen-space error, streamed through the global scheduler, coloured
from Natural Earth coastlines and lit from the real solar direction. From a few thousand kilometres
up it is a round planet with South America where South America is.

### The five bugs between "all the code exists" and "the planet is on the screen"

Recorded because every one of them presented as something else, and because the first diagnosis was
wrong in a way worth remembering.

1. **Nothing was ever activated.** The scheduler planned, fetched and cached ninety-six tiles and
   put zero of them in the world. `update` fetched before it activated, so planning and loading
   spent the 4 ms frame budget and activation was asked for permission it could never get. The
   stage order is now plan, rank, track, **activate**, fetch, retire, and a frame that is already
   over budget still places one tile. See [07-streaming.md](07-streaming.md).
2. **Planning cost more than the whole streaming budget.** A quadtree selection at orbital altitude
   measured **2.34 ms**, re-derived sixty times a second for a camera that had not moved. It is now
   memoised against camera movement, quality and a replan interval: **0.01 ms**.
3. **The fog was cleared by nulling `scene.fog`.** A material compiled with fog keeps a node that
   reads `scene.fog.color`, so the first fogged draw threw and every object after it in that pass
   was lost — a pass that reported its draw calls and produced no pixels. Fog is now off on the
   globe's own material.
4. **Two render passes do not composite.** The whole two-camera design could not work: in
   `WebGPURenderer` the second `render()` to the screen replaces the first. Replaced by one camera
   and the logarithmic depth buffer, which is what that buffer is for. See
   [08-render-domains.md](08-render-domains.md).
5. **Half the planet was black in full sunlight.** Three of the six cube-face parameterisations
   mirror, so one fixed index order winds outward on half the globe and inward on the other half.
   `DoubleSide` hid that and then lied about the lighting: a back face is shaded with its normal
   flipped, so tiles facing the Sun were shaded as though the Sun were beneath them. The winding is
   now measured per tile from the geometry, and the material is `FrontSide`.

Two more, found earlier and already described in [04](04-earth-and-planet-surface.md): tiles placed
without their rotation, and breadth-first quadtree descent.

### The measurement that mattered

The first conclusion — "the far pass draws and produces no pixels" — came from reading the canvas
back with `drawImage`, which returns black for a WebGL canvas without `preserveDrawingBuffer`
whatever is on it. The whole frame measured black, including frames that plainly were not. Every
later measurement used a composited screenshot instead.

### Shading

The globe shades itself. `MeshBasicNodeMaterial` takes no part in the light list, and the surface is
lit explicitly against a sun uniform in TSL: a lambert term with a terminator softened across a few
degrees, a small night floor for airglow, and a Rayleigh-blue halo that rises with the viewing
angle so the limb is blue and the centre of the disc is not.

That is not a stylistic choice. There is one camera and therefore one light list, and the scene's
lights belong to a city at golden hour — one sun near the horizon and a bright hemisphere fill.
Applied to a planet they wash the day side out and lift the night side off the black, and the
terminator disappears with them. A planet is lit by one star and shades itself.

The stars stayed after all. They had been stood down on the theory that the star sphere carried the
sky gradient; reading the shader showed it does not — the stars are additive points and the
gradient is the shell's. They are back above 15 km, and the shader already fades them below the limb.

### What is still visibly missing

- **No atmosphere as a volume.** The limb is a shading term on the surface, not scattering: there
  is no glow beyond the edge of the globe and no sky seen from inside.
- **No terrain.** Every tile sits at height zero: an ellipsoid, not a landscape.
- The tile under the city is a hole of about 60 km while `coveredByCity` is level-based; harmless
  from orbit, and closed by phase 6.

## Phase 7 — render domains

Done, and not the way it was designed. See [08-render-domains.md](08-render-domains.md) for one
camera, a logarithmic depth buffer, and why two passes were abandoned.

Not done: a planet-aware atmosphere and a global ocean. `Atmosphere.sky` is still a 44 km dome
drawn around the player, and it now stands down above 15 km rather than being replaced.

## Phase 8 — the ceiling

`SPACE.maxAltitude` was 140 km because a flat world has no outside. With the planetary domain it is
500 000 km — past the Moon — while the globe flag is on, and 140 km otherwise.
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

1. A planet-aware material and atmosphere, so the globe is lit by its own sun rather than the
   city's, and has a limb. This is the largest visible gap.
2. A starfield in the planetary domain, replacing the one that stands down.
3. Register `ManausProvider` with the scheduler, so the city streams through the same queue and the
   two budgets stop being independent.
4. The global DEM (phase 5), then curving Manaus onto the ellipsoid (phase 6) — which is also what
   closes the 60 km hole under the city and lets the 15 km gate go.
