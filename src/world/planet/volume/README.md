# Planet volume field — phase 1

This directory owns the mathematical authority for sparse destruction of rocky bodies.

`PlanetVolumeField` samples body-fixed metre coordinates. JavaScript stores those values as
IEEE-754 Float64 numbers; render-local coordinates and floating-origin offsets never enter an edit.
The sign convention is negative for solid material, zero at a boundary and positive for empty
space. The intact field delegates its surface radius to `PlanetSurfaceGenerator` and
`planetSurfaceRadius`, so Earth, Moon and Mars use the same relief and ellipsoid as their surface
tiles. A subtractive edit is composed as `max(dBase, -dCut)`.

`PlanetVolumeEditStore` is the authoritative edit log. `PlanetVolumeEditIndex` is a lazy AABB BVH
over that log. It indexes a planet-spanning capsule as one operation and allocates no voxel cells or
volume chunks. Later streaming phases may ask the index which edits overlap a resident chunk, but
adding an edit never makes a chunk resident.

Persistence stores a versioned JSON edit document per body. It saves sphere/capsule operations and
their body-fixed coordinates only. Sample grids, generated meshes and collision data remain
discardable caches.
