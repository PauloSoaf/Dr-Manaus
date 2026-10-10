# DR Manaus — Universe, Navigation, Collision and Destruction Master Package

## Baseline audited

- Repository: `PauloSoaf/Dr-Manaus`
- Branch: `feat/universe-map`
- Audited remote HEAD: `9c6d5b24b8b55e7fe836899d034057747872436e`
- HEAD message: `test(volume): measure mesh budgets and record Phase 3 validation`
- Date of this package: 2026-10-02

## Why this package exists

This package turns the latest gameplay requests into an ordered engineering program instead of one giant feature branch.
The immediate production bug is not Marching Cubes. It is high-speed celestial collision and landing safety.
The same package also defines how target lock, map lock, autopilot, catastrophic impacts, planet destruction,
interstellar/intergalactic travel, procedural galaxies, procedural star systems, and observable-universe navigation
fit the architecture that already exists.

## Confirmed current architecture from the live branch

The current branch already has several important foundations:

1. `CosmicFlight.ts` has barycentric interplanetary movement, warp steps from 1c to 256c, target-aware cruise,
   braking-distance logic, and `sweepSegmentSphere` for high-speed body-envelope intersection.
2. `BodyNavigation.ts` stores target identity instead of stale coordinates and resolves live positions from the active system.
3. `SolarSystem` and the celestial catalog currently represent 19 bodies after SOLAR-12.
4. All bodies are included in travel exclusion envelopes.
5. The current collision behavior at a celestial envelope removes inward velocity and stops short of the body.
6. Manual validation found an important gap: a fast Moon approach can still cross the local terrain after handoff,
   while a slow Moon approach streams and lands successfully.
7. Planet Volume Phase 1 exists as an analytic solid field with sparse CSG edits.
8. Planet Volume Phase 2 exists as sparse, body-fixed, bounded resident scalar chunks.
9. Planet Volume Phase 3 exists as indexed Marching Cubes extraction, bounded mesh cache, and an isolated visual lab.
10. The Phase 3 volume meshes are not yet the game's world terrain, not yet collision geometry, and not yet connected to powers.
11. The game already has `GalaxyProvider`, `StarSectorProvider`, and `LargeScaleStructureProvider`, but the current galaxy layer
    is still an early approximation rather than a full travel-grade hierarchical universe.
12. `FEATURES.galaxyTravel` is already enabled in current configuration.

## Product decisions made by this package

### Decision A — every celestial body is collision-addressable

Every visible celestial body must have a high-speed collision envelope in logical space.
This does not mean every body has a walkable hard surface.

- rocky body: collision with surface envelope, later detailed terrain / volume collision
- rocky moon: same
- gas giant: collision with atmospheric-depth envelope, no fake solid floor at cloud top
- ice giant: same
- star: collision with stellar/plasma envelope
- black hole: separate capture / horizon semantics
- galaxy: not a single collider; its internal bodies remain collision authorities

### Decision B — locked travel and unlocked impact are different gameplay modes

A locked target is an assisted navigation contract.
The player should not accidentally hit the locked body at relativistic speed because the autopilot failed to brake.

An unlocked body impact is an intentional or careless free-flight event.
At extreme speed, impact can become a destruction event.

The systems must therefore distinguish:

- `navigation lock`
- `autopilot engaged`
- `manual free flight`
- `collision intercept`
- `catastrophic impact`

### Decision C — Tab is target lock, map selection creates the same lock

The same `NavigationTarget` identity must be used by:

- Tab target selection from the camera field of view
- clicking/selecting a celestial body in the universal map
- HUD target lock
- autopilot
- ETA / distance readouts

There must not be separate map-target and flight-target authorities.

### Decision D — universal travel cannot be only “higher and higher c”

The 1c–256c gear is useful for the Solar System but not for galaxies or the observable-universe scale.
Intergalactic travel needs a higher travel domain whose arrival time is bounded for gameplay while logical positions remain real.
The displayed “effective c” can be telemetry, but the engine must not pretend the model is physical relativity.

### Decision E — “center of the universe” is not a physical destination

Modern cosmology does not define a unique spatial center of the universe.
The game should expose a `Cosmological Origin / Observer Reference` for navigation and a `Observable Horizon` destination,
not claim that a literal center of the universe exists.

NASA explicitly describes the expanding universe as having no center; the Big Bang did not occur at one spatial point.
The observable-universe horizon is observer-relative, not a solid wall.

### Decision F — catastrophic celestial destruction is a staged feature

The current volume architecture is finally capable of becoming the basis for planetary destruction, but a planet cannot be
truthfully “destroyed” by only spawning one explosion sprite.
The implementation must progress through:

1. collision event
2. impact classification
3. local volumetric damage
4. remesh
5. collider regeneration
6. large-scale fracture representation
7. body-state mutation
8. persistence
9. debris / fragments / gravitational consequences

Stars require a separate stellar-destruction approximation. They must not reuse rocky-planet volume chunks.

## Mandatory sprint order

The order below is intentional.

1. Sprint C0 — celestial CCD and Moon high-speed landing P0
2. Sprint C1 — target acquisition and HUD lock
3. Sprint C2 — autopilot approach, warp dropout and safe capture
4. Sprint C3 — map selection unified with target lock
5. Sprint C4 — unlocked impact policy and player/celestial impact events
6. Sprint D0 — volumetric collision contract for existing Phase 3 meshes
7. Sprint D1 — local rocky-body impact crater through volume edits
8. Sprint D2 — large impact / tunnel / remesh pipeline
9. Sprint D3 — body integrity and planet-scale destruction states
10. Sprint S0 — all Solar System bodies collision semantics and visual-presence audit
11. Sprint U0 — stellar travel domain and procedural star systems
12. Sprint U1 — procedural galaxy catalog and galaxy-local coordinates
13. Sprint U2 — intergalactic hypercruise and galaxy arrival
14. Sprint U3 — large-scale structure / observable-horizon navigation
15. Sprint P0 — performance, persistence, save schema and deterministic universe identity
16. Sprint Q0 — CI, benchmark gates, soak tests and manual QA matrix

## What must NOT be combined into one patch

Do not put the following into a single commit or checkpoint:

- Moon CCD fix + procedural galaxies
- target lock + planet destruction
- Transvoxel + target HUD
- stellar destruction + rocky Marching Cubes collision
- new star-system generator + changes to the Solar System ephemeris
- map redesign + floating-origin rewrite
- galaxy generation + player physics rewrite

Each domain has different failure modes and different acceptance tests.

## Immediate action

The next patch should be `CELESTIAL-CCD-P0` from `02-PATCH-CELESTIAL-CCD-P0.md`.
Do not start another universe-scale content expansion before that patch is manually verified.

## Files in this package

1. `00-INDEX-AND-DECISIONS.md` — package index and product decisions
2. `01-CURRENT-CODE-AUDIT.md` — live-code audit against HEAD `9c6d5b24b8b55e7fe836899d034057747872436e`
3. `02-PATCH-CELESTIAL-CCD-P0.md` — immediate high-speed collision / Moon tunnelling patch prompt
4. `03-TARGET-LOCK-AUTOPILOT-AND-MAP.md` — Tab lock, HUD lock, map lock, arrival controller
5. `04-CELESTIAL-COLLISION-SEMANTICS.md` — collision rules for rocky planets, giants, stars and black holes
6. `05-CATASTROPHIC-IMPACT-AND-DESTRUCTION.md` — impact outcomes and planet/star destruction architecture
7. `06-PLANET-VOLUME-NEXT-PHASES.md` — Phase 4 onward, including collision and body integrity
8. `07-UNIVERSAL-TRAVEL-SPEED-DOMAINS.md` — Solar, stellar, galactic and cosmological travel
9. `08-PROCEDURAL-GALAXIES-AND-SYSTEMS.md` — deterministic procedural universe generation
10. `09-COSMIC-COORDINATES-AND-OBSERVABLE-UNIVERSE.md` — reference-frame hierarchy and scientific semantics
11. `10-RENDERING-STREAMING-AND-PERFORMANCE.md` — Three.js/WebGPU, LOD, culling and budgets
12. `11-SPRINT-AND-COMMIT-PLAN.md` — ordered implementation sprints and commit gates
13. `12-TEST-MATRIX.md` — deterministic, browser, performance and manual acceptance matrix
14. `13-EXTERNAL-REFERENCES.md` — technical references and public/open-source projects
15. `14-MASTER-AGENT-PROMPT.md` — reusable execution contract for future coding-agent chats
