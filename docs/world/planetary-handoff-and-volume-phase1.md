# Planetary handoff and sparse volume field — phases 0–3

This note records the historical Phase 0/1/2 implementation and the current Phase 3 checkpoint on
`feat/universe-map`. The historical implementation baseline observed before Phase 0/1 was
`c941b17`. The audit that motivated the work described a white horizon band, the visible end of
the Manaus ground patch, a local HUD in planetary views, and the longer-term requirement that a
solid body be destructible without allocating a dense planet-sized voxel grid.

The historical first two phases had different scopes:

- **Phase 0** makes the current surface handoff explicit and exclusive. It addresses the visible
  seam with the existing shell/heightfield renderer.
- **Phase 1** establishes the mathematical authority for sparse volumetric destruction. It does
not yet render or collide with caves and tunnels.

## Phase 3 — indexed Marching Cubes (PLANET-VOLUME-3, 2026-10-02)

Initial HEAD: `a752f7ceb24811ece5c0ceafdc275fd217d7b272`, `feat/universe-map`.
The latest request accepts Phase 2 by static inspection and directs the next step: turn ready
MIXED scalar chunks into real surface geometry. Existing manual gameplay validation is still
pending; static acceptance is not being recorded as a manual trip. This checkpoint stops before
Phase 4 transitions, Phase 5 terrain coverage, Phase 6 collision and Phase 7 power wiring.

### Mesher contract

`PlanetVolumeMeshingJob` consumes only a ready scalar grid at iso=0. EMPTY/SOLID grids yield no
geometry. MIXED work advances through sample validation/gradient estimation, cell counting and
indexed emission. No Three.js, DOM, field/BVH query or observer state enters the pure mesher.
Output keeps its immutable key, source revision and separate Float64 body-fixed origin, with
chunk-local Float32 positions/normals and Uint32 indices. Canonical grid edges reuse vertices;
zero endpoints are welded across edges, and degenerate triangles are dropped. Winding and normals
point from negative solid toward positive empty, including internal sphere/capsule cut walls.

The classic 256-case table comes from the installed three.js r186 implementation, with its full
MIT license retained in `MarchingCubesTable.ts`:
[upstream source](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/objects/MarchingCubes.js).
Ambiguous cell-face occurrences are counted, not claimed as MC33-certified topology. Same-LOD
boundary vertices are tested exactly; boundary normals use one-sided differences without ghost
samples and are not guaranteed to match neighbouring chunks. Different LODs have no transition
cells. These are explicit extraction limits, not finished world-terrain coverage.

N=17 has at most 13,872 edge vertices and 20,480 triangles: **578,688 output bytes**. A meshing job
reserves a worst-case live-array bound including gradient/edge/zero caches, corner scratch and
compact output copies: **1,295,036 bytes** for N=17, below the **2 MiB job cap**. Larger MIXED
configurations that exceed this bound are rejected before scratch allocation; the runtime skips
unsupported meshing configurations, while scalar sampling keeps the Phase 2 contract.

### Runtime, budgets and visual inspection

`setDebugMeshing(true)` independently enables extraction after debug demand. Ordinary gameplay
remains dormant. The same `planet/volume` subsystem shares the existing scheduler grant between
sampling and meshing: one live job total, at most one scalar and one mesh completion per frame,
nearest mesh before farther scalar requests. EWMA cost estimates adapt sampling batches to 1–128
samples and extraction to 1–64 work units, targeting up to 0.35 ms or half the remaining grant.
Deadlines remain cooperative; allocation/final copies and the current unit finish before yielding.

`PlanetVolumeMeshCache` holds at most **8 payloads / 8 MiB** of typed arrays, reserving worst-case
per-grid capacity for admission. At the default grid, the count cap bounds output to 4,629,504
bytes (4.415 MiB). Tiny byte caps do not trigger regeneration loops. Entry validity requires scalar
source identity and source revision, preserving valid old revisions after unrelated edits.
Stale/replaced/evicted scalars, changed body/lost demand and disabled modes release geometry.
The public mesh accessor hides stale geometry immediately after edits. F3 includes mesh counts,
queue, vertices/triangles, actual array/job bytes, completion/time and ambiguous-face occurrences.
Persistence remains schema 1, logical edits only. No mesh is authoritative or saved.

**`/?volumeLab=1`** is a lazy isolated inspector using the real `UniverseRuntime`, surface factory,
global scheduler, resident chunks and mesher. It previews one nearest L0 chunk of Earth/Moon/Mars
with Intacto/Esfera/Cápsula scenarios, orbit/zoom, external/internal views, wireframe and chunk
bounds. Sphere/capsule fixtures keep at most one logical edit. The thin `VolumeMeshGeometry`
adapter binds local attributes without adding astronomical origins. Replacements/exit dispose
geometry, controls, helper, renderer and all derived arrays. `Game` is not instantiated in this
route; normal terrain, physics, camera, powers and navigation are unchanged. A visible isolated
tunnel is not yet a traversable tunnel in the planet.

### Validation and measured geometry

Twenty-three new deterministic test cases cover all 256 lookup configurations, homogeneous skips,
interpolation, exact-zero welding/degenerates, outward winding/normals, closed-sphere Euler=2 and
two-triangles-per-edge topology, sphere-cut inward walls, open capsule/chunk faces, shared boundary
vertices, deterministic/resumable output, invalid/stale grids, job memory bounds, Earth/Moon/Mars,
observable ambiguities, source invalidation, local coordinate/disposal adapter, runtime ordering,
jobs, opt-in, LRU/byte caps and movement/body retirement. A pre-existing scheduler-volume test now
shares one deterministic ledger/runtime clock; its mixed real/simulated clocks could fail under
CPU load despite passing the full run.

`npm run benchmark:volume` separates generation and pure meshing CPU measurements (5 warmups,
21 repetitions, median/p95; no timing thresholds). Typical outputs:

| Body / scenario | Vertices | Triangles | Mesh bytes | Mesher median / p95 ms |
| --- | --- | --- | --- | --- |
| Earth intact | 289 | 512 | 13,080 | 1.567 / 2.061 |
| Earth sphere | 557 | 1,048 | 25,944 | 1.442 / 1.956 |
| Earth capsule | 532 | 972 | 24,432 | 1.602 / 2.501 |
| Moon intact | 289 | 512 | 13,080 | 0.989 / 2.046 |
| Moon sphere | 557 | 1,048 | 25,944 | 1.408 / 1.817 |
| Moon capsule | 588 | 1,084 | 27,120 | 1.411 / 1.852 |
| Mars intact | 289 | 512 | 13,080 | 1.444 / 1.832 |
| Mars sphere | 584 | 1,092 | 27,120 | 1.432 / 2.224 |
| Mars capsule | 476 | 860 | 21,744 | 1.728 / 2.044 |

Observed working-array peaks before compact-copy finalization: 180,668–229,388 bytes across these
cases. All nine have zero ambiguous face occurrences. The through-Earth capsule still has one
edit/one BVH node and zero chunks before demand. Entry/centre/exit retain 32 scalar chunks
(628,864 bytes) plus at most 8 meshes (94,992 / 85,632 / 94,992 bytes), retiring the prior stage.
No whole-diameter grid/mesh residency is allocated.

Production lab smoke exercises all nine cases, actual rendering, local attributes, byte/count caps,
internal/wireframe/mobile controls and complete disposal. Captured images were inspected; the
internal camera looks along the tunnel toward its opening. Full/focused/typecheck/build and
existing gameplay-browser results are recorded in [15-status.md](15-status.md). The lunar NASA
payload is unchanged. Manual validation: inspect the nine body/scenario views and controls, then
normal Manaus/flight/map/Moon return with default zero volume mesh residency. **Stop at Phase 3.**

## Historical Phase 2 — sparse resident sampled chunks (PLANET-VOLUME-2, 2026-10-02)

Initial HEAD: `2f5d8200f6003e8d9a1fb205d154192792c6b00e`, branch `feat/universe-map`.
SOLAR-12 is accepted by the latest user request. This checkpoint adds resident data and stops
before Phase 3. The Phase 0/1 sections below retain their historical scope and measurements.

### Authority and addressing

The logical edit store, its BVH and schema-1 persistence remain authoritative. Body-fixed Cartesian
Float64 metre keys are immutable `(bodyId,lod,x,y,z)` values with canonical string/parse, bounds,
and floor addressing for negative coordinates. Float32 is used only for derived distance arrays.
The body-fixed lattice is independent of render rebases and globe screen-space LOD.

| LOD | Physical chunk edge | Samples/cells per axis | Sample spacing | Distance array bytes |
| --- | --- | --- | --- | --- |
| 0 | 256 m | 17 / 16 | 16 m | 19,652 |
| 1 | 512 m | 17 / 16 | 32 m | 19,652 |
| 2 | 1,024 m | 17 / 16 | 64 m | 19,652 |
| 3 | 2,048 m | 17 / 16 | 128 m | 19,652 |

Each chunk has 4,913 samples, regular X-fastest storage, origin/bounds/spacing, source revision,
constant intact-material metadata, ready/stale state, and EMPTY/SOLID/MIXED classification from
every sampled sign (zeros are MIXED). This classification does not prove sub-cell topology.
Fine/coarse common samples and adjacent same-LOD faces use the same global integer lattice.

The generator is pure and resumable. It samples intact bases into a temporary Float64 array,
queries the edit BVH once per chunk, then reuses those candidates and `PlanetVolumeField`'s CSG
composition for every output sample. To preserve Phase 1 numerical distances, the query AABB
includes a halo equal to the largest sampled intact depth. A cut can affect a negative distance
before physically entering that chunk. Cache invalidation uses this same conservative region;
it cannot safely use only the physical chunk bounds. At the centre the halo can be large, but it
queries operations once and never allocates chunks across that region.

Earth's ellipsoid/relief, lunar NASA surface and Mars relief still come from the existing
`PlanetSurfaceGenerator`/`planetSurfaceRadius`. `PlanetGlobe` remains shell presentation;
`PlanetTerrainProvider` remains intact single-surface physics. Neither consumes volume grids yet.
No mesh, cave renderer, collider, gameplay power or save-lifecycle integration was added.

### Residency, invalidation and scheduling

The LRU cache is bounded by 64 chunks and 2,097,152 typed-array bytes (2 MiB). At the default grid,
64 chunks contain 1,257,728 distance bytes (1.199 MiB); material-array bytes are zero. JS object,
Map, key and edit-log heap overhead is not included or presented as measured heap. One resumable
job holds 58,956 bytes including its Float32 output and temporary Float64 bases; there is at most
one job and no retained scratch array after insertion.

Add/remove edit notifications invalidate only intersecting resident query regions of the owning
body. Edits do not allocate chunks. An unrelated cached chunk can retain an older source revision
while remaining valid because the live listener observed and rejected intervening changes.
Any owning-body revision change cancels a pending job before its replacement is generated.

Demand selects at most 32 nonoverlapping dyadic leaves, with a 1,024 m observer radius, conservative
±256 m radial band and 1,024-node visit cap. Distance to parent AABBs controls refinement (split
inside half the finer edge); inherited fine children may be farther than a neighbouring coarse
leaf. Work is ordered by distance, with the observer's own L0 chunk winning ties. Demand is clipped
again to both cache limits to avoid regeneration thrash under small byte budgets. No edit AABB is
enumerated into chunk keys. A 1,536 m retention margin and LRU keep recent chunks near demand edges;
large observer moves and body changes release old samples.

`PlanetVolumeRuntime` registers once as `planet/volume` in the existing global scheduler. Default
demand is disabled; logical edits alone remain dormant. Explicit debug activation creates only the
current supported body's field and resident data, within 2,048 m of its intact terrain. Gas/ice
giants, the Sun, and the nine non-landable SOLAR-12 moons allocate zero volume chunks. Earth, Moon
and Mars share the same implementation; Mercury/Venus remain compatible through existing profiles.
Disabling demand or leaving the active surface releases resident and pending arrays.

Generation receives the scheduler's remaining frame milliseconds, checks its deadline between
128-sample batches and completes at most one chunk per scheduler frame. The deadline is cooperative:
the current batch/BVH query finishes before yielding. There is no second scheduler, private timer,
worker pool or unbounded promise fan-out. F3 reports body, resident/pending/stale, actual array MiB,
pending-job bytes, cache hits/misses, LOD counts, source revision, nearest key/edit count and generation
count/time. The API and manual diagnostic steps are in
[the volume README](../../src/world/planet/volume/README.md).

### Validation and measurements

**571/571 full unit tests**, **221/221 focused regressions**, typecheck and production build pass.
Forty new deterministic cases cover all 32 named checkpoint invariants plus numerical-halo
invalidation, internal cavities with solid corners, resumable/cancelled jobs, scheduler grants,
tiny byte budgets without thrash, inactive zero allocation, body switching and retention.
Tests compare every grid value with `Math.fround` of the Phase 1 field, shared-face positions and
distances, unchanged cached arrays across real render-origin rebases, and entry/centre/exit
eviction. The NASA lunar payload hash remains
`1696df0382263ac9aabc183d0f15e506099d982a66e9ad994852371e6910f628`.

The through-Earth test/benchmark records one capsule, one BVH node and **zero chunks/bytes before
demand**. Explicit interior diagnostic demand at entry, centre and exit each holds 32 chunks,
628,864 distance bytes (0.600 MiB); previous distant chunks retire. This is sampled data, not a
gameplay path through the body. Normal demand preserves the surface gate.

`npm run benchmark:volume` prints deterministic cases (5 warmups, 21 repetitions, median/p95),
actual chunk/cache/job bytes and through-Earth stages without creating reports. Wall-clock timings
are observations, not CI pass/fail thresholds. Browser results and the measured timing table are
recorded in [15-status.md](15-status.md).

Manual validation remains: boot Manaus and inspect F3 at zero volume residency; exercise normal
movement/flight/map and Moon return; explicitly activate demand near Earth/Moon/Mars, observe bounded
queues/memory, move away and disable; inspect near a grid edge for repeated regeneration. Automated
fixtures do not replace a complete manual trip. **Stop at Phase 2; do not start Marching Cubes.**

## Phase 0 — one visible ground authority

### Root cause

The white band was not one isolated atmosphere-shader defect. Several representations could be
visible or considered ready at the same time:

1. The flat `localWorldRoot` contains a terrain backdrop large enough for its edge to become a
   visible strip during ascent.
2. `EarthTransitionController` exposed blend weights, while the game derived another visibility
   boolean. That allowed the local patch and planetary surface to compete for the same horizon.
3. `EarthProvider` treated the always-available coarse fallback as sufficient readiness even when
   the transition requested detailed near-surface tiles. The local ground could retire before the
   required detailed coverage was active.
4. The coarse fallback and refined meshes occupied effectively the same surface. Partial refined
   coverage could therefore reveal depth fighting or a material boundary.
5. `HUD` selected Manaus landmarks and converted local `x/z` coordinates regardless of the active
   presentation domain, so an orbital view could still claim that the player was at Largo de São
   Sebastião.
6. The surface limb term and atmosphere shell both contributed to the bright horizon. This made
   the structural seam look like a single saturated atmospheric line.

The render path also had a separate frame mismatch: travel keeps logical telemetry in the
barycentric frame but renders through observer-centred `travel/view` axes. Celestial directions
and rocky-body orientation used the telemetry frame instead of the active render-origin frame.

### Resulting ownership model

`EarthTransitionController` is now the authority for both ground ownership and presentation. It
returns these explicit, shared values:

- `groundOwner`: `local` or `planet`;
- `localGroundVisible` and `planetGroundDominant`, which are mutually exclusive;
- `presentationDomain`: `local`, `planetary`, or `orbital`.

The current transition thresholds are centralized in `EARTH_HANDOFF`: planetary loading begins at
8 km, ready planetary coverage can take ground ownership at 15 km, descent returns ownership below
13 km, and the presentation becomes orbital at 60 km. The 13/15 km split supplies hysteresis.
Missing target coverage always keeps the local ground as the owner.

This is an ownership switch, not an alpha decision. The globe may be visible in the distance while
the local domain owns the nearby ground, but only one representation is allowed to define the
ground beneath the observer. `Game` consumes the transition state for local-root visibility and
passes the same presentation domain to the HUD.

### Coverage, depth, shading, and UI

`EarthCoverageReadiness` now distinguishes `coarseFallbackReady` from
`detailedCoverageReady` and reports a `coverageSource` of `none`, `coarse`, `mixed`, or `detailed`.
The coarse whole-planet fallback is enough for orbital LOD 0. Near the surface, every bounded
required tile must be active before `viewCoverageReady` lets the planetary surface take ownership.

`EarthGlobe` places its six-face coarse safety net 4 m below the authoritative refined surface.
That offset is invisible at planetary scale and prevents coplanar depth fighting while the fallback
closes holes under partial detailed coverage. Coarse and detailed meshes use the same Natural Earth
surface palette and the same surface-opacity uniform. `EarthProvider` now applies its computed
opacity to the globe. The surface limb and atmosphere-shell gains were reduced so the remaining air
effect does not hide a coverage defect behind a bright line.

The HUD resolves a pure domain-aware presentation:

- `local` may show Manaus landmarks, local coordinates, district state, mission marker, and city
  minimap;
- `planetary` names the body and uses its latitude/longitude when a surface address exists;
- `orbital` names the orbiting body or deep space and suppresses local coordinates and local UI.

Celestial direction conversion and rocky-body orientation now target
`renderSpace.currentOrigin.frame`. This keeps the Sun, Earth, Moon, and Mars aligned with the
observer-centred travel view without changing their logical barycentric positions.

## Phase 1 — mathematical volume authority

### Base field

`PlanetVolumeField` samples Cartesian metres in the owning body's fixed frame. Its sign convention
is global and explicit:

```text
distance < 0  solid
distance = 0  boundary
distance > 0  empty
```

The intact field derives from the existing `PlanetSurfaceGenerator` rather than defining another
planet surface:

```text
r        = length(positionBodyFixed)
direction = positionBodyFixed / r
dBase    = r - planetSurfaceRadius(surface, direction)
```

The centre is handled without dividing by zero. `EarthSurfaceGenerator` adapts the existing WGS84,
ETOPO relief, normals, and Natural Earth colour functions to the same interface already used by
Moon and Mars. As a result, globe vertices, local terrain collision, and the volume field share the
same ellipsoid and relief authority.

The base is a radial signed-distance-like field. Because relief varies by direction, it is not a
globally exact Euclidean SDF. A future sphere tracer must therefore use conservative steps.

### Destructive edits

`PlanetVolumeEdit` currently supports two subtractive operations:

- `subtract-sphere` for a local cavity or crater volume;
- `subtract-capsule` for a beam or tunnel between two body-fixed endpoints.

All edit coordinates are validated, cloned, frozen, and stored as JavaScript Float64 numbers in
body-fixed logical metres. They never use render-local or floating-origin coordinates. Removal uses
one centralized CSG difference rule:

```text
dResult = max(dBase, -dCut)
```

`PlanetVolumeEditStore` is the authoritative per-body operation log and tracks a revision for each
body. `PlanetVolumeEditIndex` maintains a lazily rebuilt balanced AABB BVH over those operations.
Point and bounds queries return only edits that can affect a requested location. An edit's physical
length does not allocate buckets, samples, or chunks.

The important whole-planet case is therefore represented without generating Earth:

```text
entry ●──────────────────────────────● exit
                 one SubtractCapsule
```

The through-Earth test stores this as one edit and one BVH node. A later volume provider will ask
the index which operations overlap each nearby resident chunk, sample the combined field there,
and generate only that chunk's mesh and collider. Distant parts of the same tunnel remain logical
history until something needs to see or collide with them.

### Persistence boundary

`PlanetVolumePersistence` defines schema version 1 and serializes one body's sphere/capsule edit
history. Deserialization validates the schema and coordinates and rebuilds the store and index.
Derived sample grids, meshes, and collision data are intentionally absent from the document.

This is the persistence format foundation. It is not yet connected to the game's save lifecycle,
background storage, chunk cache invalidation, or migrations beyond rejecting unknown versions;
those remain Phase 9 work.

## Invariants

The implementation and its tests pin these rules:

1. `PlanetSurfaceGenerator` and `planetSurfaceRadius` remain the intact-surface authority.
2. Earth, Moon, and Mars use the same volume-field implementation.
3. Negative means solid and positive means empty in every volume API.
4. Persistent edits use body-fixed Float64 metres and survive render-origin rebases unchanged.
5. CSG operations, rather than generated voxels or meshes, are authoritative.
6. Adding a planet-spanning operation does not make any volume chunk resident.
7. `PlanetGlobe` remains the far- and mid-distance representation.
8. The local and planetary domains never both own the observer's ground.
9. Planet and celestial transforms use the active render frame while logical state remains in its
   reference frame.

## Validation and measured scope

The focused Phase 1 run passed 9/9 tests. The handoff and travel-frame additions passed 5/5 focused
tests. Full-suite, typecheck, and production-build results belong in the integration commit report,
because other Phase 0 files were still being integrated when this note was written.

| Measurement | Historical Phase 1 result |
| --- | --- |
| Base-field directions | 2,048 per body; 6,144 total across Earth, Moon, and Mars |
| Radial field assertions | 18,432: boundary, 100 m outside, and 100 m inside for every direction |
| Through-Earth representation | 1 `subtract-capsule` edit |
| BVH for that tunnel | 1 edit, 1 node |
| Persistence coverage | exact distance and edit-log round trip; malformed schema/coordinates rejected |
| Floating-origin coverage | repeated rebases preserve edit coordinates and sampled distance |
| Resident volume chunks | 0; chunk streaming is Phase 2 |
| Samples per chunk | not applicable yet |
| Voxel size by LOD | not applicable yet |
| Chunk generation/remesh time | not applicable yet |
| Memory per volume chunk | not applicable yet |
| Edits queried per chunk | not applicable until Phase 2 |
| Volume coordinates sent to Three.js | 0; this phase has no renderer |

The handoff tests cover exclusive ownership, readiness gating, hysteresis, HUD suppression of local
context, travel/view axes, body-fixed rocky-globe orientation, Moon ENU addressing, and a
Earth→Mars→Earth round trip that preserves pose, velocity, orientation, and frame identity.
Automated structural tests do not replace a manual horizon inspection; a real ascent and re-entry
should still confirm that no white band, local-ground strip, depth flicker, or local HUD survives in
planetary/orbital presentation.

## Historical Phase 1 limitations

Phase 1 did **not** make the rendered planet volumetrically destructible. At that checkpoint,
the following systems did not exist:

- resident volume chunk keys, selection, sampling grids, budgets, or caches;
- Marching Cubes geometry or transition cells between volume LODs;
- `PlanetGlobe`/volume coverage handoff;
- cave, wall, ceiling, or tunnel collision;
- ray/ellipsoid entry and exit refinement;
- gameplay damage connected to volume edits;
- a traversable centre, gravity inversion handling, or opposite-hemisphere exit;
- runtime save/load integration for edit documents.

`TerrainDestruction` remains the 2.5D Manaus heightfield system, and `PlanetTerrainProvider` remains
the intact single-surface collision provider. Neither is being stretched into a cave engine.

## Roadmap

The phases retain the order from the volumetric-destruction audit. Phase 4 is next and requires
a new request before work starts:

1. **Phase 2 — sparse volume chunks (implemented above):** body-fixed keys, LOD-sized sampling
   grids, bounded demand/cache/invalidation and measurable memory/time budgets; no physics yet.
2. **Phase 3 — Marching Cubes (implemented above):** extract indexed local geometry and verify
   sphere cuts/tunnel walls in an isolated inspector; world coverage/collision remain later phases.
3. **Phase 4 — Transvoxel:** generate LOD transition cells and prove adjacent levels do not crack.
4. **Phase 5 — `PlanetGlobe` integration:** hand coverage between shell and resident volume meshes
   without holes or depth fighting.
5. **Phase 6 — volume collision:** add a collision contract that supports floors, walls, and
   ceilings, then integrate it with `PhysicsWorld` near the player.
6. **Phase 7 — destruction gameplay:** connect powers and the destruction service to authoritative
   volume edits with asynchronous remesh budgets.
7. **Phase 8 — through-planet attack:** find refined entry/exit points and create one
   `SubtractCapsule`; validate entry, centre, and opposite-hemisphere exit.
8. **Phase 9 — persistence integration:** connect per-body edit documents to save/load, migrations,
   revision invalidation, and on-demand chunk regeneration.
9. **Phase 10 — Moon and Mars activation:** use the same provider, mesher, collision, and persistence
   engine for both bodies. Their base-field consistency is already covered in Phase 1.

The eventual product statement “the whole Earth is destructible” means a procedural base field plus
a sparse global history of boolean edits. It must never mean that the whole Earth is voxelized or
resident in memory.
