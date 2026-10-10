# External technical references

## Use policy

These references are for architecture, algorithms, APIs and comparative design.
Do not copy source code without checking license compatibility.
Where a project is GPL, its source is particularly useful as a study reference but direct code copying into a differently licensed project may impose obligations.

## Three.js

### WebGPURenderer

Official manual:
https://threejs.org/manual/pages/webgpurenderer

Official API:
https://threejs.org/docs/pages/WebGPURenderer.html

Relevant points:

- modern Three.js renderer
- WebGPU backend when available
- WebGL2 fallback
- TSL/node material direction
- asynchronous initialization / setAnimationLoop guidance

DR Manaus relevance:

- current project already imports `three/webgpu`
- future compute-heavy generation may use WebGPU, but collision truth should remain logical/CPU-authoritative first

### THREE.LOD

https://threejs.org/docs/pages/LOD.html

Relevant point:

- basic distance/hysteresis LOD mechanism

DR Manaus relevance:

- useful reference but insufficient alone for astronomical/angular LOD
- project should retain custom screen-space/domain-aware LOD policies

## three-mesh-bvh

Repository:
https://github.com/gkjohnson/three-mesh-bvh

Relevant features documented by the project:

- accelerated raycasting
- BVH spatial queries
- sphere intersection
- geometry queries
- SDF-related examples
- worker generation examples
- player movement / sphere physics examples

DR Manaus relevance:

- strong candidate/reference for Phase 6 volume mesh collision acceleration
- especially suitable because Phase 3 already produces Three.js-compatible indexed geometry data
- use only on nearby resident meshes

License shown by repository: MIT.
Still verify the exact version/license before adding dependency.

## Rapier

JavaScript CCD docs:
https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/

Advanced collision detection:
https://www.rapier.rs/docs/user_guides/javascript/advanced_collision_detection/

Relevant concept:

Continuous Collision Detection prevents tunnelling by considering motion between old and new positions and clamping motion to the first impact.

DR Manaus relevance:

- this validates the chosen conceptual approach for Moon high-speed contact
- do not migrate physics engines merely to fix the P0
- evaluate Rapier later if full dynamic triangle/capsule volume collision becomes costly to maintain custom

## Celestia

Repository:
https://github.com/CelestiaProject/Celestia

Development guide reference:
https://github.com/CelestiaProject/Celestia/blob/master/devguide.txt

Relevant architecture described in its public source/docs:

- observer moving through universe
- high-precision universal coordinates
- octree visibility for stars
- separate star database and deep-sky objects
- Solar System / star / deep-sky catalogs

DR Manaus relevance:

- high-precision coordinate hierarchy
- observer-centric rendering
- separation of catalogs from rendering
- distant-space LOD inspiration

Celestia repository indicates GPL licensing.
Study ideas; review licensing before reusing code.

## OpenSpace

Repository:
https://github.com/OpenSpace/OpenSpace

The project describes itself as an open-source interactive visualization of the known universe and supports planetary imagery, galaxies, quasars and mission data.

DR Manaus relevance:

- multi-scale universe visualization
- data-driven astronomical content
- large-scale hierarchy
- observer/navigation concepts

Repository describes MIT licensing, but always verify current license files before code reuse.

## Pioneer Space Simulator

Repository:
https://github.com/pioneerspacesim/pioneer

The project describes an explorable Milky Way with millions of star systems and planetary landing.

DR Manaus relevance:

- procedural galaxy/system design reference
- deterministic large-world content
- planet landing across generated systems
- useful comparison for system-generation distributions and streaming architecture

Review the repository license before copying implementation code.

## Space Nerds In Space

Repository:
https://github.com/smcameron/space-nerds-in-space

DR Manaus relevance:

- public space-game codebase for studying space-simulation/gameplay organization
- potentially useful for procedural/environment inspiration

Again, use as reference unless license compatibility is explicitly reviewed.

## NASA / NAIF SPICE

NAIF:
https://naif.jpl.nasa.gov/

DR Manaus relevance:

- reference frames
- ephemeris concepts
- kernel-based astronomical state modeling

The game does not need a runtime SPICE dependency for every generated system.
Use SPICE concepts and curated data where scientifically useful.

## JPL Horizons

https://ssd.jpl.nasa.gov/horizons/

DR Manaus relevance:

- curated Solar System state/ephemeris validation
- physical/orbital reference data

Current project already documents JPL-derived Solar/satellite approximations.

## NASA cosmology reference

NASA Webb Big Bang Q&A:
https://science.nasa.gov/mission/webb/big-bang-q-and-a/

Important semantic point:

- the universe does not have a unique spatial center in the standard expanding-universe description

NASA universe overview:
https://science.nasa.gov/exoplanets/what-is-the-universe/

DR Manaus relevance:

- use `Observable Horizon` / reference origin terminology instead of claiming a physical center

A NASA technical presentation commonly cites the observable universe at roughly 46.5 billion light-years in radius; treat this as an approximate observable-horizon scale, not the full universe size.

## Reference selection summary

Use immediately as concepts:

- Rapier CCD motion-clamping concept for P0
- current custom `sweepSegmentSphere` for cosmic broad CCD
- three-mesh-bvh as Phase 6 collision acceleration candidate
- Celestia/OpenSpace for universe/render hierarchy
- Pioneer for deterministic procedural-system architecture
- NASA/JPL/NAIF for scientific terminology and curated Solar data

Do not install a new dependency in the P0 collision patch unless existing architecture demonstrably cannot meet the requirement.
