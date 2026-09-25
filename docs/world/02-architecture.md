# World architecture

How DR Manaus addresses space, from a facade on the Largo de São Sebastião to a sector of the
observable universe, without ever loading the world.

The governing rule:

> The logical world may be enormous. The rendered scene never is.

## Why a single Vector3 is not enough

A double has 53 bits of mantissa. That is millimetres on a building, or light years between stars,
but never both — adding one metre to 10²⁶ metres does nothing at all. Positions also end up in
float32 buffers on the GPU regardless of what the CPU holds. So position is not a number in this
codebase. It is a **frame plus a number**, and the numbers stay small inside their frame.

```
universe                logical, hierarchical, high precision
   │
   ▼
active reference frame  what the player currently belongs to
   │
   ▼
render-local            small metres, near zero, safe for float32
   │
   ▼
Three.js scene          never large
```

## Layers

| Layer | Directory | Responsibility |
| --- | --- | --- |
| Spatial | `src/world/spatial/` | Coordinates, frames, floating origin, addressing. Pure maths. |
| Providers | `src/world/providers/` | Sources of world, and who owns what where. |
| Streaming | `src/world/streaming/` | Demand, priority, budget, cache, cancellation. |
| Planet | `src/world/planet/` | Bodies, cube-sphere tiling, screen-space error. |
| Celestial | `src/world/celestial/` | Solar system, ephemerides, star sectors. |
| Runtime | `src/world/runtime/` | The facade `Game` talks to. |

Nothing in `spatial`, `planet` or `celestial` imports Three.js. They run in a worker and in a test
without a browser, which is deliberate: the model must be testable without a renderer, because the
renderer is a projection of the model and never its source.

## Reference frames

Frames form a tree. Each one knows where its origin sits inside its parent and how its axes are
rotated relative to it. Converting between two frames walks up to their lowest common ancestor and
back down — so a position in Manaus converted to Earth-fixed never touches the galactic numbers,
and never loses precision to them.

```
solar-system/barycentric
└── solar-system/earth-fixed
    └── earth/fixed
        └── earth/manaus/legacy-enu      ← the compiled city
```

`ReferenceFrameGraph` refuses the mistakes that would corrupt a position silently: an unknown
frame, two frames in unconnected trees, a cycle, or a frame parented to itself.

## Manaus: anchored, not moved

The city's 645 compiled tiles, its road network, its landmask and every landmark are expressed in
one flat projection anchored at the **Monumento à Abertura dos Portos** (−3.130333, −60.022528):

```
x = (lon − originLon) × 111320 × cos(originLat)
z = (originLat − lat) × 111320
```

That is an equirectangular projection on a sphere of fixed scale, and it is *not* the true tangent
plane on the WGS84 ellipsoid. A degree of latitude here is about 110 574 m, not 111 320, so the
local north axis is stretched by **0.67%** — about 135 m at the edge of the compiled city.

Keeping it is a decision, not an oversight. Every asset in the game is expressed in it, and it is
self-consistent: a building and the road outside it are wrong by the same amount, so the city is
correct relative to itself. `ManausFrameAdapter` therefore holds both definitions and exports the
gap between them as a number rather than leaving it to be discovered:

- `geoToLegacyLocal` / `legacyLocalToGeo` — the shipped projection, bit for bit.
- `geodeticToTrueLocal` / `trueLocalToGeodetic` — the real WGS84 tangent plane.
- `LEGACY_NORTH_SCALE`, `LEGACY_EAST_SCALE`, `legacyDivergenceM` — how far apart they are.

`latLonToWorld` and `worldToLatLon` delegate to the first. Giving each 1 024 m tile its own frame
is what will bound the divergence to metres instead of hundreds.

## Floating origin

The game already rebased X and Z every 2 048 m. That is enough while the sky is a ceiling; flying
off the planet makes Y just as large, and reaching another body changes the frame itself.
`FloatingOrigin3D` tracks all three axes and carries the frame with the origin.

The invariant, which the tests assert directly: **a rebase never moves anything logically.** It
changes only the numbers the renderer and the local physics see. Distances between objects are
unchanged, the origin carries no rotation so nothing can be tilted by one, and listeners are handed
the delta to add to any render-local position they had stored. Across a frame change the delta is
reported as zero, because the axes themselves moved and listeners must rebuild from logical
positions.

## Providers and ownership

Exactly one provider owns a channel — terrain, water, roads, buildings, vegetation, landmarks,
physics — at any point, and the highest fidelity wins:

```
authored landmark  >  compiled real city  >  procedural filler  >  generic planet terrain
```

This formalises a rule the game already followed in three separate places
(`RealCityLayer.replacesChunk`, `replacesCollider`, `HLOD.setRealCoverage`). It is what stops a
second Manaus appearing underneath the real one once a planet provider exists.

## Streaming

`GlobalStreamingScheduler` is one queue for the whole universe. Demands are ranked by visual error,
view cone relevance, time to contact, gameplay criticality and provider priority — distance alone
is not enough, because a tile 4 km ahead matters more than one 1 km behind.

Two properties are load-bearing:

- **Nothing may answer "load everything".** Every stage is capped by `StreamingLedger`: frame
  milliseconds, concurrent fetches, activations per frame, upload bytes, and a soft and hard
  memory ceiling.
- **Obsolete work is cancelled, not awaited.** A teleport or a frame change bumps a generation;
  in-flight fetches are aborted, and any result that still lands is dropped rather than put into
  the world.

Tile keys are one union across city tiles, planet quadtree nodes and star sectors, each with a
`kind` prefix, because all three share a cache and a collision there would put a city block in a
galaxy.

## Planet tiling

A **cube sphere**, not a latitude/longitude grid: the poles have to be ordinary places, and Web
Mercator cannot represent them at all. Six faces, each its own quadtree.

The tangent warp on the cube-to-sphere mapping is not decoration — without it a tile at a face
corner covers nearly twice the ground of one at the centre, and a single error threshold would mean
something different depending on where you stood.

Refinement is driven by **screen-space error**, not distance rings:

```
sse = geometricError × viewportHeight / (2 × distance × tan(fov / 2))
```

Descent is depth first and measures to the nearest part of a tile rather than its centre. Both
matter: breadth-first spends the budget on shallow levels and never reaches the ground underfoot,
and centre-distance makes the tile you are standing on look tens of kilometres away.

Geocentric and geodetic latitude are kept distinct throughout. They differ by up to 0.19 degrees —
over 20 km of ground — and conflating them is the classic way to put a planet's tiles in the wrong
place.

## Solar system

Real radii, real distances, published physics. Venus and Uranus have negative rotation periods
because they genuinely turn the other way.

Ephemerides come from **published Keplerian elements with secular rates** (JPL's approximate
positions of the major planets), not from a downloaded dataset: a few hundred numbers, no network
at any point, and bit-identical results on every machine. Accuracy is arcminutes, which is what
the specification asks for — the order, the distances and the motion, not navigation precision.

Which body you belong to is decided by **gravitational acceleration**. Standing on the Moon, the
Moon wins, though Earth is 81 times its mass. That is what makes the frame handoff physical rather
than a threshold someone picked.

Distant bodies reach the renderer as an **angular size**, never as a scaled position, so the Sun
sits at a genuine astronomical unit without one astronomical number reaching a vertex buffer.

## Universe

Beyond the solar system, position becomes an integer sector index plus a double offset inside it.
The indices are `bigint` because they genuinely exceed 2⁵³, and an integer that silently loses its
low bits is worse than one that is slow.

Stars are **generated, never stored**. Gaia DR3 catalogues 1.8 billion sources; shipping that is
neither possible nor the point. The same sector seed produces the same stars forever, the mass
function is weighted the way the real sky is, and the Galaxy has a real double-exponential disc and
bulge, so flying toward the centre is denser than flying out of the plane.

## Feature flags

`FEATURES` in `src/core/config.ts` gates each phase. They are temporary: a phase's flag is removed
once it has stabilised, because two complete architectures must not live side by side permanently.

`spatialCore` is on — it only observes, and costs below the profiler's 0.05 ms reporting threshold
at every speed. Everything that changes what is drawn is off until its phase is finished.

## What is not built yet

Honestly stated, because a specification half-implemented is worse than one not started:

- The Earth globe is tiled and addressed but **not drawn**. `EarthProvider` does not exist.
- Global terrain (a DEM), global vector coastlines and the ocean are not implemented.
- Manaus is anchored to the ellipsoid but still flat; it is not curved onto it.
- Render domains are not built; `SpaceLayer` and `Atmosphere` are unchanged.
- `SPACE.maxAltitude` still caps flight at 140 km.
- No provider is registered, so the scheduler runs with an empty registry.
- Persistence still uses the existing ids; world-scoped ids and a mutation store are not built.

The order these must be done in is in `15-IMPLEMENTATION-ROADMAP.md`, and the acceptance criteria
for each are in `17-ACCEPTANCE-CRITERIA.md`.
