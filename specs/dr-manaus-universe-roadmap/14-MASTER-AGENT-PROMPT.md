# Master coding-agent contract — DR Manaus universe program

Use this file as the preamble for future implementation prompts.

```text
PROJECT:
DR Manaus

REPOSITORY:
PauloSoaf/Dr-Manaus

PRIMARY BRANCH:
feat/universe-map

LAST AUDITED HEAD WHEN THIS PACKAGE WAS CREATED:
9c6d5b24b8b55e7fe836899d034057747872436e

==================================================
OPERATING RULES
==================================================

1. Before editing:
   git status
   git branch --show-current
   git log -1 --oneline

2. The prompt's old SHA is context only.
   The repository's real HEAD is authoritative.

3. Inspect the current implementation before creating new architecture.

4. Prefer extending existing authorities:

   SolarSystem / CelestialSystemRuntime
   BodyNavigation
   CosmicCruiseController
   TravelDomain
   UniverseRuntime
   GlobalStreamingScheduler
   RenderSpaceService
   PlanetVolumeField
   PlanetVolumeRuntime

5. Never create duplicate position/time/origin authorities.

6. Logical astronomical coordinates are Float64/hierarchical.
   Render coordinates are observer-relative and Float32-safe.

7. No astronomical absolute position may be written directly to Object3D.position.

8. Navigation targets store identity, not stale XYZ snapshots.

9. All high-speed movement uses continuous segment/contact logic.
   Endpoint-only collision is unacceptable at cosmic speeds.

10. All current celestial bodies must be collision-addressable even when represented by lightweight proxies.

11. Collision semantics are body-class dependent.
    Gas giants/stars are not fake rocky ground.

12. Locked/autopilot travel must prioritize safe capture.
    Unlocked impact is a separate gameplay policy.

13. Planet destruction authority is logical state / volume edits / body-state overlay.
    Explosion VFX is never the authoritative mutation.

14. The whole planet is never voxelized.

15. Volume chunk/mesh/collider data is a discardable bounded cache.

16. Procedural universe generation is deterministic by stable address/seed.

17. Known astronomical objects override procedural generation where curated data exists.

18. Do not claim a physical center of the universe.
    Coordinate origin is a reference only.

19. Observable horizon is observer-relative presentation, not a literal hard wall around all space.

20. Use one global streaming scheduler.
    No independent unbounded worker/timer loop per planet/galaxy.

==================================================
CHECKPOINT DISCIPLINE
==================================================

For every sprint:

A. audit
B. root cause / missing capability
C. tests that fail before change
D. minimal architecture change
E. focused tests
F. typecheck
G. full tests
H. build
I. browser smoke when relevant
J. manual QA list
K. documentation update
L. meaningful commits
M. STOP

Do not silently start the next sprint.

==================================================
COMMIT DISCIPLINE
==================================================

Prefer 1–4 meaningful commits.

Do not commit:

iteration status spam
screenshots unless explicitly requested
generated benchmark dumps
large temporary artifacts

Documentation is authoritative only when it describes verified implementation.

==================================================
TEST REPORTING
==================================================

Separate:

AUTOMATICALLY VERIFIED

from:

REQUIRES USER MANUAL VALIDATION

Do not claim a command passed unless it was actually run.
Do not use the existence of a test file as proof that the test passed.

==================================================
PERFORMANCE REPORTING
==================================================

When adding streaming/generation/render work, report numbers:

resident counts
cache bytes
generation times
mesh counts
triangles
draw calls when relevant
scheduler budget

Avoid vague "optimized" claims.

==================================================
DEPENDENCY RULE
==================================================

External projects/libraries are references first.

Before adding a dependency:

state exact problem
show why current architecture is insufficient
check license
measure bundle/runtime cost
add focused tests

Do not add Rapier, three-mesh-bvh, or another engine casually.

==================================================
CURRENT HIGH-LEVEL ROADMAP
==================================================

C0 celestial CCD P0
C1 target lock
C2 autopilot capture
C3 map lock
C4 impact events
D0 volume collision
D1 local impact destruction
D2 penetrating impact
D3 body integrity
D4 catastrophic rocky body
D5 giant/star destruction
U0 universal target addresses
U1 procedural star systems
U2 galaxy runtime
U3 intergalactic hypercruise
U4 procedural galaxies
U5 cosmological map
U6 observable-horizon navigation
P0 persistence
Q0 CI / soak

Always obey the latest explicit user checkpoint over this roadmap.
```
