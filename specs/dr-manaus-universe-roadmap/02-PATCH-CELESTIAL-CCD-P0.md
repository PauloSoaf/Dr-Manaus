# Patch prompt — CELESTIAL-CCD-P0

Copy this entire file to the coding agent.

```text
STOP FEATURE EXPANSION OUTSIDE THIS CHECKPOINT.

Repository:
PauloSoaf/Dr-Manaus

Branch:
feat/universe-map

AUDITED BASELINE HEAD:
9c6d5b24b8b55e7fe836899d034057747872436e

test(volume): measure mesh budgets and record Phase 3 validation

MANUAL P0 REPRODUCTION:

- Slow Moon approach works.
- The Moon streams.
- The player lands and can walk.
- Fast Moon approach tunnels through the local lunar terrain.

Therefore the primary bug is NOT a missing Moon provider.
It is high-speed contact / unsafe local handoff.

NEW PRODUCT RULE:

NO CELESTIAL BODY MAY BE CROSSED ACCIDENTALLY AT HIGH SPEED.

A later checkpoint will add destructive unlocked impacts.
THIS P0 ONLY guarantees robust collision and safe assisted capture.

==================================================
CHECKPOINT CELESTIAL-CCD-P0
GLOBAL HIGH-SPEED BODY CCD + LOCAL TERRAIN CCD
==================================================

FIRST:

git status
git branch --show-current
git log -1 --oneline

Report the real initial HEAD.

If it is not the expected baseline, audit the diff before editing.

==================================================
PART A — DO NOT DESTROY THE CURRENT COSMIC SWEEP
==================================================

Current CosmicFlight.ts already has:

sweepSegmentSphere()
bodyExclusionEnvelopes()
earliest-hit selection
removeInwardVelocity()

Preserve this architecture.

The current generic barycentric sweep is valuable and must remain the
broad high-speed defense for every Solar System body.

Do NOT replace it with endpoint checks.

==================================================
PART B — AUDIT EXACT CURRENT LANDING PIPELINE
==================================================

Inspect:

src/game/Game.ts
src/world/travel/CosmicFlight.ts
src/world/travel/TravelDomain.ts
src/world/travel/BodyNavigation.ts
src/world/runtime/UniverseRuntime.ts
src/world/planet/PlanetTerrainProvider.ts
src/world/planet/MoonSurface.ts
src/world/planet/MarsSurface.ts
src/world/providers/RockyPlanetProvider.ts
src/player/PlayerController.ts
src/physics/PhysicsWorld.ts

tests related to:
Moon landing
PlanetTerrainProvider
TravelDomain
CosmicCruise
high-speed sweep
player ground contact

Trace, with telemetry, the exact frame where:

interplanetary
-> returned
-> handoffTo('moon')
-> moon/local-enu
-> PlanetTerrainProvider installed
-> PlayerController first local step

==================================================
PART C — SEPARATE THREE SPEED CONCEPTS
==================================================

The code must stop treating one return-speed threshold as all of these:

1. approach speed
2. capture speed
3. local-character solver speed

Introduce explicit data-driven concepts.

Suggested names:

approachCaptureSpeedMps
localHandoffSpeedMps
maxLocalTerrainSweepMps

Exact names may differ.

Do NOT choose values by guess.

Derive values from deterministic tests and PlayerController capabilities.

==================================================
PART D — INTERPLANETARY CCD REMAINS ACTIVE UNTIL SAFE HANDOFF
==================================================

A player approaching a landable rocky body too fast must remain in the
interplanetary domain.

Required landing gate:

surface ready
AND
clearance inside capture altitude
AND
relative inward speed <= local handoff limit
AND
total local-relative speed <= solver limit

Do not hand 10 km/s directly to a discrete character terrain solver.

At 60 FPS:
10,000 m/s = ~166.7 m per frame.

At 30 FPS:
10,000 m/s = ~333.3 m per frame.

That is many character heights per step.

==================================================
PART E — RADIAL AND TANGENTIAL VELOCITY
==================================================

Use velocity relative to the target body.

At the live surface normal split:

v_rel = v - v_body

v_radial = dot(v_rel, outwardNormal)

v_tangent = v_rel - outwardNormal * v_radial

An inward v_radial < 0 is the dangerous landing component.

Do not classify a fast stable orbit the same as a direct surface dive.

==================================================
PART F — TARGET SURFACE, NOT MEAN SPHERE, FOR LANDING
==================================================

For landable bodies, final capture must use the existing surface authority.

Moon:
MoonSurface / planetSurfaceRadius / PlanetTerrainProvider

Mars:
MarsSurface / planetSurfaceRadius / PlanetTerrainProvider

Earth:
existing Earth surface authority

The high-speed broad phase may use conservative ellipsoid/sphere bounds,
but final landing clearance must use the real surface direction/elevation.

==================================================
PART G — LOCAL TERRAIN CONTINUOUS COLLISION
==================================================

Implement a generic swept terrain contact path for local ENU planetary terrain.

Input:

previous local position P0
proposed local position P1
character foot/capsule clearance
terrain provider

Define:

clearance(t) = playerFootY(t) - terrainHeight(x(t), z(t))

If:

clearance(0) > 0
AND
clearance(1) <= 0

then the movement crossed terrain during the frame.

Resolve the first contact instead of accepting P1 below terrain.

==================================================
PART H — BOUNDED ROOT FINDING
==================================================

Use deterministic bounded refinement.

Good options:

binary search on segment parameter t
or
conservative fixed subdivision followed by binary refinement

Example budget:

8 to 12 binary iterations

Do not use unbounded iteration.
Do not allocate per iteration.

The routine should return:

contact fraction
contact position
terrain height
surface normal approximation if needed

==================================================
PART I — MOTION CLAMPING
==================================================

Use the continuous-collision principle of motion clamping:

integrate proposed movement
sweep old -> new
find earliest terrain contact
clamp player to contact
remove inward velocity component
retain tangential component

This is the same conceptual class of solution used by continuous-collision
systems such as Rapier CCD, but implement it in the project's current custom
terrain path unless a dependency is explicitly justified.

==================================================
PART J — FRAME RATE INDEPENDENCE
==================================================

Required deterministic cases:

120 FPS
60 FPS
30 FPS

The same descent must never pass through the surface in any of them.

==================================================
PART K — GENERIC ROCKY-BODY CONTACT
==================================================

The sweep must not be named MoonCollision.

It must work with the TerrainProvider interface used by:

Moon
Mars
future landable rocky planets

Keep Manaus compatibility.

Do not introduce body-id branches for Moon and Mars unless a data difference
requires it.

==================================================
PART L — EVERY SOLAR BODY GETS HIGH-SPEED BROAD COLLISION
==================================================

Audit bodyExclusionEnvelopes(activeSystem).

Every current system body must produce an envelope with finite live position
and finite positive radius.

Current expected body count after SOLAR-12:
19.

A single barycentric step may not cross any one of them undetected.

For this P0, collision response remains safe/non-destructive.
Destructive unlocked impact is a later sprint.

==================================================
PART M — GAS GIANTS AND STARS
==================================================

Do not fake landable surfaces.

For P0:

Sun:
collision/capture envelope exists
no local ground handoff

Jupiter/Saturn:
collision/capture envelope exists
no solid local ground handoff

Uranus/Neptune:
same

The P0 guarantee is simply:
player cannot numerically pass through them in one step.

Detailed atmosphere/plasma impact semantics come later.

==================================================
PART N — SAFE LOCKED ARRIVAL FOUNDATION
==================================================

Do not implement full Tab lock in this P0 unless already trivial.

But make the landing/capture API accept enough information for the next sprint:

isAssistedTarget
bodyId
clearance
relative radial speed
relative tangential speed
surfaceReady

Do not bury all logic in Game.ts.

==================================================
PART O — IMPACT EVENT CONTRACT, NO DESTRUCTION YET
==================================================

Introduce, if cleanly possible, a pure result type for high-speed body contact.

Conceptual:

CelestialContact {
  bodyId
  fraction
  contactPositionM
  relativeSpeedMps
  radialSpeedMps
  assisted
}

For THIS checkpoint:

response = safe stop/capture

Do NOT create planet destruction yet.

The next impact sprint will consume the contact event.

==================================================
PART P — MOON REAL MANUAL REPRO MUST BECOME A TEST
==================================================

Create a deterministic integration regression matching the user report:

CASE 1 slow:
land successfully
Grounded
walk

CASE 2 fast:
old endpoint would be underground
continuous sweep catches it
never below terrain

CASE 3 extremely fast cosmic step:
barycentric sweep catches Moon envelope
never exits opposite hemisphere

==================================================
MANDATORY TESTS
==================================================

T_CELESTIAL_ENVELOPES_INCLUDE_ALL_CURRENT_SOLAR_BODIES

T_CELESTIAL_SWEEP_MOON_FAST
T_CELESTIAL_SWEEP_EARTH_FAST
T_CELESTIAL_SWEEP_MARS_FAST
T_CELESTIAL_SWEEP_JUPITER_FAST
T_CELESTIAL_SWEEP_SUN_FAST

T_LOCAL_HANDOFF_REJECTS_UNSAFE_INWARD_SPEED
T_LOCAL_HANDOFF_ACCEPTS_SAFE_INWARD_SPEED

T_PLANET_TERRAIN_SWEEP_CROSSES_SURFACE
T_PLANET_TERRAIN_SWEEP_NO_FALSE_CONTACT
T_PLANET_TERRAIN_SWEEP_DIAGONAL_RELIEF

T_MOON_FAST_DESCENT_NO_TUNNEL_120FPS
T_MOON_FAST_DESCENT_NO_TUNNEL_60FPS
T_MOON_FAST_DESCENT_NO_TUNNEL_30FPS

T_MOON_CONTACT_PRESERVES_TANGENTIAL_VELOCITY
T_MOON_CONTACT_REMOVES_INWARD_VELOCITY
T_MOON_CONTACT_GROUNDED
T_MOON_SLOW_LANDING_REGRESSION

T_MARS_FAST_DESCENT_NO_TUNNEL

T_GAS_GIANT_HAS_BROAD_COLLISION_BUT_NO_GROUND_HANDOFF
T_STAR_HAS_BROAD_COLLISION_BUT_NO_GROUND_HANDOFF

==================================================
DEBUG TELEMETRY
==================================================

Expose enough F3 information to debug one screenshot:

Target body
Travel domain
Physics domain
Body-relative speed
Radial speed
Tangential speed
Surface clearance
Capture threshold
Local handoff threshold
Terrain body id
Terrain height
Player local Y
Player state
Last celestial contact body
Last contact fraction

No per-frame console spam.

==================================================
DO NOT TOUCH
==================================================

Do not modify:

Planet Volume Phase 3 mesher
Marching Cubes table
volume lab
Solar-12 ephemerides
procedural galaxies
universal map layout
power destruction

unless a failing regression proves a narrow integration need.

==================================================
RUN
==================================================

npm run typecheck

focused tests for:
CosmicFlight
BodyNavigation
TravelDomain
UniverseRuntime
PlanetTerrainProvider
PlayerController
Moon
Mars
Solar-12

npm test
npm run build
npm run test:browser:space

Do not add browser tooling.

==================================================
MANUAL ACCEPTANCE
==================================================

A. Moon slow approach
land and walk as before

B. Moon fast approach
never pass through

C. Moon absurd-speed approach
never enter one side and leave the other

D. Mars fast approach
cannot pass through broad body envelope

E. Jupiter / Sun free-flight high-speed crossing attempt
cannot numerically cross the body in one frame

==================================================
FINAL REPORT
==================================================

INITIAL HEAD
FINAL HEAD
COMMITS
ROOT CAUSE
LOCAL HANDOFF LIMIT
TERRAIN SWEEP ALGORITHM
CELESTIAL SWEEP STATUS
ALL 19 BODY ENVELOPE STATUS
MOON 30/60/120 FPS RESULTS
MARS RESULT
GAS GIANT RESULT
STAR RESULT
TESTS
TYPECHECK
FULL TESTS
BUILD
BROWSER SPACE
MANUAL VALIDATION REQUIRED

Then STOP.

DO NOT START TARGET LOCK.
DO NOT START PLANET DESTRUCTION.
DO NOT START TRANSVOXEL.
```

## Why this patch comes first

The requested target lock and destructive high-speed impacts both depend on trustworthy contact detection.
If collision fractions are wrong, autopilot can crash and planet destruction can trigger after the player has already crossed the body.

## Success definition

After this patch, intact celestial bodies are numerically uncrossable at any supported Solar System movement speed.
Landable bodies additionally have continuous local terrain contact after handoff.
