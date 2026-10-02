# Planet volume field — phases 1–2

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
