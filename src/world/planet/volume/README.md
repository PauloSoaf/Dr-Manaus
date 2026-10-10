# Planet volume field — phases 1–3

This directory owns the mathematical authority for sparse destruction of rocky bodies.

`PlanetVolumeField` samples body-fixed metre coordinates. JavaScript stores those values as
IEEE-754 Float64 numbers; render-local coordinates and floating-origin offsets never enter an edit.
The sign convention is negative for solid material, zero at a boundary and positive for empty
space. The intact field delegates its surface radius to `PlanetSurfaceGenerator` and
`planetSurfaceRadius`, so Earth, Moon and Mars use the same relief and ellipsoid as their surface
tiles. A subtractive edit is composed as `max(dBase, -dCut)`.

`PlanetVolumeEditStore` is the authoritative edit log. `PlanetVolumeEditIndex` is a lazy AABB BVH
over that log. It indexes a planet-spanning capsule as one operation and allocates no voxel cells or
volume chunks. Sampling queries the index once per resident chunk; adding an edit never makes a
chunk resident.

Persistence stores a versioned JSON edit document per body. It saves sphere/capsule operations and
their body-fixed coordinates only. Sample grids, generated meshes and collision data remain
discardable caches.

Phase 2 adds immutable Cartesian `bodyId/lod/x/y/z` keys, negative-coordinate floor addressing,
and one dyadic body-fixed lattice. L0 is 256 m with 17³ samples (16³ cells), 16 m spacing;
L1/L2/L3 are 512/1024/2048 m with 32/64/128 m spacing. X varies fastest. Adjacent shared faces
use identical global integer sample indices; render origins never enter this arithmetic.

`PlanetVolumeChunkGenerationJob` is a pure resumable sampler, with no Three.js, DOM or physics.
It first samples the intact field into temporary Float64 bases, then queries the edit BVH once
using a conservative halo equal to the largest sampled intact depth. A cut outside the physical
chunk can still improve its negative distance; querying only the physical AABB would change the
Phase 1 field. The same candidate list and `PlanetVolumeField.sampleBodyFixed` compose every
edited sample. One job uses 58,956 typed-array bytes, including its output. Completed chunks keep
only 19,652 Float32 distance bytes and a constant intact-material identifier; no material array
is needed yet. Source revision belongs to the edit log, never the render frame.

`PlanetVolumeChunkCache` is an LRU Map with both 64-chunk and 2 MiB typed-array caps. With
the default grid the chunk cap wins: 1,257,728 resident bytes (1.199 MiB). Counters report
distance/material array bytes, not a claimed total JS heap measurement. Add/remove events from
the edit store mark only existing chunks whose conservative query region intersects the changed
edit as stale. Unrelated chunks keep their older source revision and remain valid: the listener
has observed the intervening change. In-progress jobs restart on any owning-body revision change.
Persistence still writes only schema-1 logical edits, never grids or cache state.

`selectVolumeChunkDemand` selects at most 32 nonoverlapping dyadic leaves within 1,024 m of the
observer and a conservative ±256 m radial band. At most 1,024 nodes are visited. A parent splits
when its AABB is closer than half the next finer chunk size; children inherit that refinement,
so fine children can be farther than a neighbouring coarse leaf. Results are nearest-first,
with the observer's own L0 chunk winning ties. LOD is independent of globe screen-space error.
Selection never enumerates edit bounds. Demand is additionally clipped to cache capacity so a
small byte cap cannot cause perpetual eviction/regeneration. A 1,536 m retention margin plus
LRU preserves recently used chunks around demand edges; distant chunks and previous bodies retire.

`PlanetVolumeRuntime` implements `ManagedSubsystem` and registers once in `UniverseRuntime`'s
existing `GlobalStreamingScheduler`. It uses only the granted frame milliseconds, checks the
deadline between batches of at most 128 samples, and completes at most one chunk per frame.
The deadline is cooperative: a current batch and its single BVH query finish before yielding.
There is at most one pending job, no private timer, worker pool, or second scheduler. Planning
cost is included in the scheduler's elapsed budget. The body field is created lazily for the
active supported context only. Edits alone do not activate demand. Disabled, far-surface, gas-giant,
star and unsupported-moon contexts have zero resident/pending sample arrays. Earth, Moon and Mars
share this implementation; Mercury/Venus retain compatibility through their existing profiles.

For diagnostics in the running game:

```js
const volume = window.__DR_MANAUS__.universe.volume;
volume.setDebugDemand(true); // current solid body, within 2,048 m of its intact terrain
volume.metrics;             // body, chunks, pending/stale, exact array bytes, revisions and timings
volume.setDebugDemand(false); // immediately release resident and pending arrays
```

F3 includes volume metrics. `setDebugDemand(true, true)` separately enables bounded interior
sampling for explicit tests, including entry/centre/exit of one through-Earth capsule; it is
not gameplay traversal or a collider. Disable it after inspection. Full-array generation can
span frames (especially for the lunar DEM or many cuts); callers must not synchronously generate
chunks in `Game.tick`. The synchronous `generateVolumeChunk` facade is for tests/benchmarks.

EMPTY/SOLID/MIXED classify all sampled signs, including zero as MIXED. This is a grid
classification, not proof of sub-cell topology: features smaller than the sample spacing can be
missed. No mesh, collider, power integration or cave traversal is part of Phase 2.

Phase 3 adds `PlanetVolumeMeshingJob` and the synchronous test/benchmark facade `meshVolumeChunk`.
The pure mesher consumes a ready scalar grid at iso=0, never calls the field/BVH and never imports
Three.js. EMPTY/SOLID chunks return zero geometry. MIXED chunks are validated and counted before
indexed emission. Canonical grid-edge vertices are reused; exact zero endpoints are welded and
degenerate triangles are discarded. Positions stay in chunk-local Float32 metres; the owning
origin remains separate body-fixed Float64 metadata. Winding and finite-difference/interpolated
gradient normals point from negative solid into positive empty, including cut cavity/tunnel walls.

The classic 256-case triangle table is data copied from the installed **three.js r186**, with the
full MIT copyright/license retained in `MarchingCubesTable.ts`. Source:
https://github.com/mrdoob/three.js/blob/r186/examples/jsm/objects/MarchingCubes.js.
Classic ambiguous face cases are counted in the payload; this initial extraction does not claim
MC33 topology certification. Exact shared-face vertices are tested at the same LOD, but smooth
cross-chunk normals have no ghost-sample halo and different LODs have no transition cells yet.
Those limitations matter before world terrain coverage can consume these meshes.

For N=17, the theoretical indexed output cap is 578,688 bytes (one vertex per grid edge, five
triangles per cell). A job checks a **2 MiB worst-case live-array limit**, including temporary
gradient/edge/zero caches and compact output copies. The default grid's bound is 1,295,036 bytes.
Oversized configurations are rejected before allocating their mixed-grid scratch arrays; scalar
sampling still supports the Phase 2 configurations. Meshing is resumable per sample/cell work unit.

`PlanetVolumeRuntime.setDebugMeshing(true)` independently opts into CPU extraction after demand is
enabled. Default gameplay still allocates zero volume grids or mesh jobs. Only ready MIXED scalar
chunks are candidates, nearest-first; the nearest mesh is served before farther scalar requests.
One existing global grant is shared by sampling and extraction: there is at most one live job,
one scalar completion and one mesh completion per scheduler frame. Sampling batches adapt between
1–128 samples and meshing between 1–64 work units, using an EWMA of observed cost and a 0.35 ms
target (also clipped by remaining time). Deadlines remain cooperative, including count-to-buffer
allocation and final compact copies; this is not a strict preemptive time guarantee.

`PlanetVolumeMeshCache` is separate derived residency, capped at **8 payloads and 8 MiB** of typed
arrays. Admission reserves worst-case per-grid capacity, so a tiny byte cap cannot induce endless
eviction/remeshing. Current default output can reach at most 4,629,504 bytes at the eight-mesh cap.
Every entry keeps its scalar source identity/revision. Stale or replaced/evicted scalar sources,
body changes, lost demand and disabled modes discard corresponding geometry. Unrelated logical
revisions preserve valid old sources. The `meshes` accessor hides stale data immediately on edits;
no stale geometry waits for the next rendering frame. All sampling/mesh arrays are derived and
remain absent from schema-1 persistence. F3 reports mesh queue/count, vertices/triangles, exact
array bytes, job bytes, completion/time and classic-table ambiguous faces.

The thin renderer adapter is `src/debug/VolumeMeshGeometry.ts`. It binds chunk-local positions,
normals and indices to a `BufferGeometry`; it never adds the planetary origin into Float32 buffers.
No production terrain renderer or collision provider consumes these geometries yet.

For visual inspection, run the normal dev/preview server and open **`/?volumeLab=1`**. This lazy
diagnostic entry starts an isolated chunk view, not `Game`. It uses the real `UniverseRuntime`,
global scheduler, Earth/Moon/Mars surface factories, sampled chunks and meshing jobs. Choose
Intacto/Esfera/Cápsula, orbit/zoom, inspect external/internal views, toggle triangulation and chunk
bounds. Fixtures clear their own old derived data and keep at most one logical edit. Geometry,
controls, renderer and cache resources are disposed on replacement/exit. The ordinary game query
continues to use the existing shell/heightfield presentation and physics; Phase 5 owns future
coverage handoff, Phase 6 collision and Phase 7 power wiring.

`npm run test:browser:volume` exercises all nine body/scenario pairs, real production rendering,
finite local attributes, bounded residency, internal/wireframe/mobile controls and complete
disposal using the already installed Chromium. `npm run benchmark:volume` also reports pure
meshing timings/geometry bytes and bounded meshes for the through-Earth entry/centre/exit fixture.
