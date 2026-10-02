# Planetary handoff and sparse volume field — phases 0–1

This note records the first two phases of the planetary-volume work on
`feat/universe-map`. The implementation baseline observed before these changes was
`c941b17`. The audit that motivated the work described a white horizon band, the visible end of
the Manaus ground patch, a local HUD in planetary views, and the longer-term requirement that a
solid body be destructible without allocating a dense planet-sized voxel grid.

The two phases have deliberately different scopes:

- **Phase 0** makes the current surface handoff explicit and exclusive. It addresses the visible
  seam with the existing shell/heightfield renderer.
- **Phase 1** establishes the mathematical authority for sparse volumetric destruction. It does
  not yet render or collide with caves and tunnels.

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

| Measurement | Current result |
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

## Deliberate limitations

Phase 1 does **not** make the rendered planet volumetrically destructible. The following systems do
not exist yet:

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

The next phases retain the order from the volumetric-destruction audit:

1. **Phase 2 — sparse volume chunks:** define body-fixed chunk keys, LOD-sized sampling grids,
   demand selection, an active cache, and measurable memory/time budgets; no physics yet.
2. **Phase 3 — Marching Cubes:** extract one chunk mesh and verify sphere cuts and tunnels.
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
