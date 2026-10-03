# Planet Volume roadmap after Phase 3

## Current completed foundation

Phase 1:

- analytic body-fixed field
- intact surface from existing surface generators
- sparse subtract-sphere / subtract-capsule edits
- BVH edit index
- persistence schema foundation

Phase 2:

- sparse body-fixed chunks
- dyadic LOD lattice
- bounded cache
- demand selection
- resumable generation
- revision invalidation

Phase 3:

- indexed Marching Cubes
- chunk-local Float32 vertices
- normals
- indices
- bounded mesh cache
- isolated visual lab

## Phase 4 — LOD crack strategy

The existing roadmap calls this Transvoxel.
Before implementation, confirm whether the current sparse LOD topology actually requires full Transvoxel or whether a narrower transition-cell strategy is sufficient.

Requirements:

- no cracks between adjacent LOD levels
- deterministic seam ownership
- bounded transition generation
- no duplicate coplanar surfaces
- same body-fixed lattice

Do not implement transition geometry before same-LOD boundaries are proven stable.

## Phase 5 — world coverage integration

Goal:

Make volume meshes replace the intact surface only where required.

Coverage states:

```text
intact PlanetGlobe / PlanetTerrainProvider owns region
volume mesh preparing
volume mesh ready
volume collision ready
handoff coverage
```

Avoid:

- shell and volume surface z-fighting
- visual hole while remeshing
- intact ground collider blocking a carved tunnel

The coverage service should know exactly which representation owns each region.

## Phase 6 — volume collision

This phase is required before caves and tunnels are truly playable.

Options:

### Option A — custom triangle/BVH collision

Use generated `PlanetVolumeMesh` geometry and construct a local BVH.
A project such as `three-mesh-bvh` demonstrates accelerated ray and spatial queries against Three.js meshes.

Advantages:

- fits current Three.js geometry
- no full physics-engine migration
- can generate BVH per resident volume mesh

Risks:

- dynamic remesh means BVH rebuild/refit cost
- character capsule collision still needs custom shapecast logic

### Option B — physics-engine integration for local volume chunks

Rapier supports continuous collision detection concepts and triangle/heightfield collider types.
However, introducing a second physics engine into an established custom controller is a major architectural choice.

Do not add Rapier solely to fix Moon terrain tunnelling.
Evaluate it specifically for Phase 6 if custom mesh collision becomes too expensive to maintain.

## Volume collision contract

The character needs queries beyond `terrainHeight(x,z)`:

- sweep capsule / sphere
- floor contact
- wall contact
- ceiling contact
- penetration correction
- nearest surface normal

Suggested interface:

```ts
interface LocalCollisionField {
  sweepCapsule(from, to, capsule): Contact | undefined;
  overlapCapsule(position, capsule): Contact[];
  raycast(origin, direction, maxDistance): Contact | undefined;
}
```

The intact heightfield can adapt to this interface.
The volume mesh can implement the same interface later.

## Phase 7 — destruction gameplay

Connect powers and high-speed impacts to authoritative volume edits.

Rules:

- gameplay creates edit operation
- store revision changes
- only affected resident chunks become stale
- chunk regenerates
- mesh regenerates
- collision representation regenerates
- rendering swaps atomically when ready

Do not let a power directly mutate BufferGeometry vertices as authoritative state.

## Phase 8 — through-body attack

The existing foundation intentionally supports a planet-spanning capsule as one edit.

Flow:

1. ray/trajectory intersects body envelope
2. refine entry against volume/surface field
3. determine exit
4. create one subtract-capsule edit
5. demand only regions near player / visible entry / visible exit
6. do not generate every chunk along the entire planet diameter

This is the core “beam through Earth” architecture.

## Phase 9 — persistence integration

Persist:

- edit log
- body-state overlay
- macro destruction state

Do not persist:

- scalar chunks
- Marching Cubes buffers
- BVHs
- GPU buffers

Those are regenerable caches.

## Phase 10 — shared activation on Moon/Mars

The same volume engine should run on Earth, Moon and Mars.

Moon/Mars differences belong in:

- base surface generator
- material profile
- gravity
- atmosphere

not in separate destruction engines.

## Planet fracture beyond Phase 10

Local volume chunks are not enough for a planet breaking into large pieces.
Add a macro-body fracture layer above local volume edits.

Suggested architecture:

```text
CelestialBodyState
  -> macro integrity
  -> fracture graph
  -> fragment descriptors
      -> local surface/volume detail on demanded fragments only
```

## Memory invariant

At no point should “Earth destructible” mean “Earth fully voxelized”.
The correct statement remains:

```text
procedural intact field
+
sparse logical edits
+
nearby sampled chunks
+
nearby meshes/colliders
+
macro fracture metadata when needed
```
