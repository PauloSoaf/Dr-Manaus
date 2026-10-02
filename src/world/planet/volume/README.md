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

EMPTY/SOLID/MIXED classify all sampled signs, including zero as MIXED. This is a grid
classification, not proof of sub-cell topology: features smaller than the sample spacing can be
missed. No mesh, collider, power integration or cave traversal is part of Phase 2.
