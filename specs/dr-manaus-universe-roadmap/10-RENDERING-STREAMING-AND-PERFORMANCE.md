# Rendering, streaming and performance plan

## Three.js/WebGPU baseline

The project currently uses `three/webgpu` and Three.js 0.186.x.
Three.js documents `WebGPURenderer` as the modern renderer with WebGPU by default and WebGL2 fallback where WebGPU is unavailable.

Do not rewrite the rendering stack during collision/navigation sprints.
Use the existing renderer and reference-frame architecture.

## Core rendering invariant

```text
astronomical logical coordinates never become Object3D.position directly
```

Current camera-relative celestial presentation already follows this principle.
Procedural galaxies and generated systems must preserve it.

## Representation ladder

### Rocky celestial body

```text
point / glow
-> angular proxy
-> coarse globe
-> streamed planetary globe
-> local terrain
-> volume mesh only in edited/underground regions
```

### Star

```text
point
-> angular disk / glow
-> corona proxy
-> near-star specialized representation
```

### Galaxy

```text
point / deep-sky sprite
-> macro impostor / density cloud
-> resolved structural points
-> star sectors
-> individual systems
```

### Large-scale universe

```text
cluster points
-> filament/cluster proxies
-> selected galaxy groups
```

## LOD selection

Three.js has a basic distance-based `LOD` class, but the project should continue using custom domain-aware selection where angular size and streaming budgets matter.
Distance alone is not enough across astronomical scales.

Useful metrics:

- projected angular size
- screen-space error
- target lock relevance
- time to contact
- player speed
- body class
- current domain

## Hysteresis

Every representation handoff should have hysteresis.
Avoid repeated transitions when player hovers around one threshold.

Examples:

- point <-> proxy
- proxy <-> globe
- globe <-> local terrain
- galaxy macro <-> star sectors

## Streaming budgets

Continue using one global scheduler.
Do not create one private streaming loop per galaxy / planet / volume system.

Each subsystem reports:

- pending work
- estimated cost
- priority
- criticality

The scheduler assigns finite frame budget.

## High-speed streaming

At hypercruise speed, do not stream detail behind the player.

Use:

- route prediction
- target-biased demand
- reduced side detail
- coarse destination prefetch
- arrival bubble preparation

## Target lock boosts streaming priority

A locked target is gameplay-critical.
The target system/body should receive prefetch priority before arrival.

Examples:

- generate target galaxy descriptor
- generate target star sector
- resolve target system
- prepare body provider
- prepare landing terrain if landing is intended

Do not wait until the player is already inside the object.

## Collision without geometry

High-speed collision must not require detailed render geometry.
Use logical bounds first.
This is why every procedural body needs physical metadata independent from its mesh.

## Near-body collision acceleration

For Phase 6 volume collision, `three-mesh-bvh` is a strong reference for accelerated spatial queries on Three.js geometry.
Its documented use cases include raycasting, shapecast-like spatial queries, sphere collision examples, SDF generation and worker generation.

If adopted:

- build BVH only for nearby active volume meshes
- dispose with mesh eviction
- regenerate/refit when a mesh changes
- keep body/chunk-local coordinates

Do not build a BVH for every planet in the galaxy.

## Web workers

Good future worker candidates:

- procedural star-sector generation
- planetary volume sampling
- Marching Cubes
- BVH construction
- procedural terrain generation

The current pure-data Phase 2/3 jobs are intentionally compatible with future off-main-thread execution.

## GPU compute

WebGPU/TSL may eventually accelerate:

- field sampling
- meshing
- particle debris
- large star/galaxy point generation

Do not introduce GPU compute until CPU architecture and deterministic tests are stable.

## Memory budgets

Keep separate budgets for:

- city geometry
- planetary tiles
- volume scalar chunks
- volume meshes
- collision BVHs
- star sectors
- galaxy macro points
- debris

A single “loaded MB” number is useful telemetry but not enough for enforcement.

## Procedural universe cache

Cache descriptors more aggressively than render objects.

Cheap descriptor:

- seed
- mass
- radius
- position
- type

Expensive presentation:

- BufferGeometry
- textures
- BVH
- local terrain chunks

Evict the expensive representation first.

## Distant horizons

The original game vision uses Minecraft / Distant Horizons style principles.
At cosmic scale the equivalent is hierarchical impostors:

- far galaxy remains visible as one macro representation
- approaching it progressively reveals structure
- internal star sectors are not loaded across megaparsecs

## Performance acceptance

Every new sprint should report:

- frame CPU delta
- render calls delta
- geometry count delta
- GPU/CPU memory estimates
- scheduler pending work
- worst-case generation time
- cache caps

Do not accept “looks fast”.
