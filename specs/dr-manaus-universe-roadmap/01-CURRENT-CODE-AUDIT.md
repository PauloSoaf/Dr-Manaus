# Current code audit — live branch `9c6d5b24b8b55e7fe836899d034057747872436e`

## Scope

This audit is based on the current remote `feat/universe-map` branch.
The important point is to extend what exists instead of introducing a second navigation, collision, or universe architecture.

## 1. Cosmic flight already has the right logical frame

File:

`src/world/travel/CosmicFlight.ts`

Current strengths:

- interplanetary state is in `solar-system/barycentric`
- positions are Float64 JavaScript numbers
- the target stores `bodyId`, not a position snapshot
- live body position is resolved every update
- `LIGHT_SPEED_MPS` is explicit
- current warp gear is `1c, 2c, 4c, 8c, 16c, 32c, 64c, 128c, 256c`
- cruise computes braking distance
- cruise has phases `idle`, `align`, `acceleration`, `cruise`, `braking`, `approach`
- all motion is target-relative / body-relative where appropriate

Do not replace this controller for Solar System travel.
The correct change is to add explicit lock/autopilot state and collision outcome policy around the existing controller.

## 2. High-speed body sweep already exists

`CosmicFlight.ts` exports:

`function sweepSegmentSphere(fromM, stepM, centreM, radiusM)`

This solves the quadratic segment/sphere entry time and is exactly the kind of continuous collision test required at cosmic speed.
The controller already checks:

- every body from `bodyExclusionEnvelopes`
- the current dominant body
- the selected target

This means the architecture is already close to “no planet can be crossed in one frame”.

### Current limitation

The collision response is currently universally non-destructive:

1. stop short of the earliest envelope
2. call `removeInwardVelocity`
3. enter `approach`

That is safe but does not express the new gameplay requirement:

- locked/autopilot target -> safe capture and braking
- unlocked high-speed impact -> impact event, possibly catastrophic destruction

Therefore the collision detection and collision response must be split.

## 3. Moon tunnelling is a local-domain problem after handoff

Manual behavior:

- slow approach -> streaming finishes -> player lands and walks
- fast approach -> player can cross local lunar terrain

This proves the Moon terrain provider exists and the ground pipeline works in principle.
It also narrows the root cause to velocity-dependent contact / unsafe local handoff.

The interplanetary sphere sweep alone cannot solve this if the player is transferred into local ENU with too much inward velocity.
The fix needs two layers:

- cosmic CCD before handoff
- terrain sweep / motion clamping after handoff

## 4. Target identity is already centralized

File:

`src/world/travel/BodyNavigation.ts`

Important current contracts:

- `selectBodyDestination(system, bodyId)`
- `resolveBodyDestination(system, target)`
- `bodyExclusionEnvelopes(system)`

This is the correct authority for Tab lock and map lock.
Do not add `selectedPlanetPosition`, `mapTargetPosition`, or `hudLockedPoint` fields.
The HUD and map should select a `bodyId`; the live system resolves coordinates every frame.

## 5. Solar System collision envelopes already enumerate all current bodies

`bodyExclusionEnvelopes()` iterates the active system and creates one envelope per body.
This is useful because high-speed free flight must collide with an unselected planet too.

The next patch should add semantics to each envelope:

- body class
- collision mode
- physical / capture radius
- impact policy
- whether local landing exists

Do not remove the generic loop.

## 6. Current Solar System body profile is already the right capability source

File:

`src/world/celestial/CelestialBodyProfile.ts`

Existing distinctions include:

- star
- rocky
- rocky-moon
- icy-moon
- volcanic-moon
- atmospheric-moon
- gas-giant
- ice-giant

Existing capabilities include:

- `hasSolidSurface`
- `canLand`
- `hasAtmosphere`
- `supportsVolumeDestruction`
- `surfaceKind`
- visual properties

Extend this capability model rather than checking string IDs throughout `Game.ts`.

Recommended additions later:

- `collisionKind`
- `impactResponse`
- `autopilotCaptureMode`
- `destructionModel`
- `approachEnvelopeProfile`

Do not add all of them in the P0 unless the failing tests require it.

## 7. Phase 3 Marching Cubes exists but is intentionally isolated

Current files include:

- `PlanetVolumeMesher.ts`
- `PlanetVolumeMesh.ts`
- `PlanetVolumeMeshCache.ts`
- `MarchingCubesTable.ts`
- `PlanetVolumeLab.ts`

Important current guarantees:

- volume positions are chunk-local Float32
- logical chunk origin remains body-fixed
- mesh cache is bounded
- meshing is resumable
- no renderer-world integration yet
- no volume collider yet
- no powers connection yet

Do not use Phase 3 as an excuse to fix intact Moon collision.
The intact Moon already has a terrain collision authority and must be robust independently.

## 8. Current galaxy rendering is not yet travel-grade universe generation

### `StarSectorProvider.ts`

Current strengths:

- deterministic generation
- sector-addressed content
- scheduler-owned streaming
- bounded nearby sector ring
- galaxy star backdrop uses reduced rendered units

Current limitation:

The provider is primarily a rendered star-field layer.
It is not yet a catalog of individually navigable star systems with full hierarchical local coordinates.

### `GalaxyProvider.ts`

Current behavior:

- creates a 50,000-point deterministic macro representation
- uses one galaxy definition
- has approximate relative positioning
- currently contains a comment acknowledging the lack of a full galactic coordinate system

This should become a presentation layer for a deeper `GalaxyRuntime`, not the universe authority.

### `LargeScaleStructureProvider.ts`

Current behavior includes known anchors and an observable-horizon/CMB sphere approximation.
This is useful presentation scaffolding, but large-scale travel requires hierarchical logical addresses.

## 9. Current dependency set

From `package.json`:

Runtime:

- `three ^0.186.0`
- `@gltf-transform/core ^4.5.0`
- `@gltf-transform/functions ^4.5.0`

Development:

- Playwright
- TypeScript
- Vite
- tsx

No Rapier or three-mesh-bvh dependency is currently installed.
The roadmap treats those projects as technical references first.
Do not add a physics engine or BVH package simply because it exists.
Any dependency proposal must show why the existing custom collision path cannot meet the requirement more cheaply.

## 10. WebGPU path

The project imports from `three/webgpu` in core rendering code.
Three.js documents `WebGPURenderer` as its modern renderer, with WebGL2 fallback when WebGPU is unavailable.
This makes TSL / compute-oriented future optimizations possible, but the next collision patches should remain CPU/logical.

## 11. Key architectural gaps to close

### Immediate P0

- local terrain CCD for Moon and every local rocky-body surface
- safe local handoff speed
- no through-body traversal without an actual carved tunnel

### Navigation

- target acquisition in camera field of view
- persistent HUD lock
- map selection -> same lock
- autopilot state machine
- deterministic warp dropout and approach

### Collision semantics

- safe lock capture vs destructive unlocked impact
- star/gas giant collision policies
- impact events independent from render mesh

### Destruction

- Phase 4 Transvoxel or another crack-free LOD seam strategy
- Phase 5 world coverage integration
- Phase 6 volume collision
- Phase 7 powers/impact -> edits
- planet integrity/fracture beyond local cavity edits

### Universal scale

- hierarchical cosmic addresses
- procedural galaxies
- procedural star systems
- targetable generated bodies
- travel-domain scaling beyond 256c
- observer-relative cosmological horizon semantics

## 12. Do not regress these current strengths

- live ephemeris target resolution
- generic body sweep
- bounded render coordinates
- one Solar System authority
- one global streaming scheduler
- body-fixed volume edits
- sparse resident volume chunks
- bounded volume mesh cache
- deterministic procedural sector generation
- map selection without teleportation
