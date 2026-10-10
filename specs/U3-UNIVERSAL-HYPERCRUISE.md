Sim. Para o U3 eu colocaria **um gate de regressão permanente antes de qualquer feature nova**. A partir daqui o projeto já tem sistemas demais para depender só de “o full test passou”: precisamos de uma suíte curta que explicitamente prove que Manaus, Terra, destruição, Solar, U0, U1 e U2 continuam vivos a cada sprint.

Use este prompt completo no Codex:

```text
STOP ALL WORK OUTSIDE THIS CHECKPOINT.

Repository:
PauloSoaf/Dr-Manaus

Branch:
feat/universe-map

CURRENT AUDITED HEAD:

64eb0210fda8a111af6cd1cf3d8743f59c362ba8

HEAD MESSAGE:

docs(universe): close U2 Galaxy Runtime and Andromeda checkpoint

==================================================
UNIVERSE MAP COMPLETION EPIC
SPRINT U3
UNIVERSAL HYPERCRUISE
REAL INTERSTELLAR + INTERGALACTIC GAMEPLAY TRAVEL
+
PERMANENT CROSS-FEATURE REGRESSION GATE
==================================================

CURRENT ROADMAP:

D1 / D1.1 / D1.2
COMPLETE

SUN-APPROACH-P0
COMPLETE

MANAUS-AERIAL-PRESENTATION-P0
COMPLETE

U0
Universal Navigation Target
COMPLETE

U1
Playable Procedural Star Systems
COMPLETE

U2
Galaxy Runtime + Andromeda
COMPLETE

NOW:

U3
Interstellar / Intergalactic Hypercruise

LATER:

U4
Procedural Galaxies

BH0
Functional Black Holes

BH1
Gravity + Event Horizon + Lensing

BH2
Black-hole Transit Network

U5
Full Universal Map

U6
Cosmological Exploration

DO NOT START U4.

DO NOT IMPLEMENT BLACK-HOLE PHYSICS.

==================================================
PRIMARY U3 GAMEPLAY GOAL
==================================================

Remove the need for:

U1 TEST ARRIVAL
U2 TEST ARRIVAL

for ordinary supported travel.

Production gameplay must now support:

Solar System
→ another Milky Way star system

another Milky Way system
→ another Milky Way system

Milky Way
→ Andromeda

Andromeda
→ Milky Way

Andromeda system
→ another Andromeda system

through REAL GAMEPLAY HYPERCRUISE.

The logical distances remain real:

4 ly
100 ly
26,000 ly
100,000 ly
2.5 million ly

BUT gameplay travel takes seconds.

This is fictional FTL / hypercruise.

Do NOT claim physical special-relativity correctness.

==================================================
IMPORTANT
"REAL TRAVEL" DOES NOT MEAN FLOAT32 MOVING THROUGH 2.5 MLY
==================================================

Do NOT implement this:

player.position += velocity * dt

for:

2.5 million light years.

Do NOT place:

2.365e22

inside Object3D.position.

Do NOT move a Three.js object through millions of light years.

"Real travel" means:

continuous logical progress

through a hierarchical travel domain

with:

real logical distance
continuous progress
effective speed
acceleration
cruise
deceleration
cancel/resume
destination preparation
visual progression
arrival handoff

The renderer stays bounded.

==================================================
PART 0
PERMANENT REGRESSION GATE
==================================================

BEFORE implementing U3:

Create a permanent regression suite covering all major completed features.

This suite becomes mandatory for U3 AND ALL FUTURE SPRINTS.

Suggested:

tests/regression/

and command:

npm run test:regression

Also create:

npm run test:browser:regression

using EXISTING browser infrastructure.

DO NOT introduce another testing framework.

==================================================
REGRESSION PHILOSOPHY
==================================================

The purpose is NOT to duplicate every existing test.

The purpose is to define a SMALL SET OF CONTRACTS that must NEVER disappear.

Each completed epic gets explicit smoke/regression coverage.

If a future refactor removes one of these behaviours:

test:regression MUST FAIL.

==================================================
REGRESSION GROUP A
MANAUS LOCAL GAMEPLAY
==================================================

Keep explicit regression coverage for:

T_REG_MANAUS_STARTS_AT_TEATRO

T_REG_MANAUS_LOCAL_WORLD_VISIBLE

T_REG_MANAUS_REAL_CITY_STREAMING

T_REG_MANAUS_BUILDINGS_HAVE_COLLISION

T_REG_MANAUS_WATER_SYSTEM_ACTIVE

T_REG_MANAUS_RIO_NEGRO_EXISTS

T_REG_MANAUS_ENCONTRO_DAS_AGUAS_EXISTS

T_REG_MANAUS_FOREST_NO_WATER

T_REG_MANAUS_PROCEDURAL_TREES_NO_WATER

T_REG_MANAUS_LOCAL_FLIGHT

T_REG_MANAUS_FLOATING_ORIGIN

Do not rewrite these systems.

==================================================
REGRESSION GROUP B
MANAUS → EARTH TRANSITION
==================================================

Preserve:

T_REG_MANAUS_AERIAL_READY

T_REG_MANAUS_VISIBLE_15KM

T_REG_MANAUS_VISIBLE_20KM

T_REG_MANAUS_VISIBLE_60KM

T_REG_MANAUS_VISIBLE_100KM

T_REG_RIO_NEGRO_AERIAL_VISIBLE

T_REG_MANAUS_NO_TRANSITION_GAP

T_REG_MANAUS_NO_FLAT_CITY_IN_ORBIT

T_REG_MANAUS_AERIAL_BODY_FIXED

U3 must not accidentally hide:

planetRoot
Manaus aerial
Earth globe

when travel code changes presentation roots.

==================================================
REGRESSION GROUP C
SOLAR SYSTEM
==================================================

Preserve:

Sun
Mercury
Venus
Earth
Moon
Mars
Jupiter
Saturn
Uranus
Neptune
existing added moons

Regression IDs:

T_REG_SOLAR_BODY_COUNT

T_REG_SOLAR_REAL_DISTANCES

T_REG_SOLAR_MOON_PARENT_EARTH

T_REG_SOLAR_TAB

T_REG_SOLAR_SHIFT_TAB

T_REG_SOLAR_TARGET_LOCK

T_REG_SOLAR_COSMIC_FLIGHT

T_REG_SOLAR_WARP_1C_256C

T_REG_SOLAR_X_CANCEL

T_REG_SOLAR_FLOATING_ORIGIN

==================================================
REGRESSION GROUP D
SUN P0
==================================================

Mandatory:

T_REG_SUN_RADIUS_695700KM

T_REG_SUN_NO_2R_COLLISION

T_REG_SUN_PHOTOSPHERE_CCD

T_REG_SUN_256C_NO_TUNNEL

T_REG_SUN_NO_BOUNCE

T_REG_SUN_NO_LANDING

T_REG_SUN_PROCEDURAL_VISUAL

T_REG_SUN_CORONA_NOT_COLLISION

Do NOT regress to the old:

2R Sun barrier.

==================================================
REGRESSION GROUP E
PLANET LANDING
==================================================

Mandatory:

T_REG_MOON_APPROACH

T_REG_MOON_LANDING

T_REG_MOON_HIGH_SPEED_CCD

T_REG_MARS_APPROACH

T_REG_MARS_LANDING

T_REG_PLANET_SAFE_CAPTURE

T_REG_GAS_GIANT_NO_LANDING

T_REG_TAKEOFF

==================================================
REGRESSION GROUP F
D1 / D1.1 / D1.2
==================================================

Do not reopen destruction architecture.

Preserve:

T_REG_D1_IMPACT_POLICY

T_REG_D1_MINOR_IMPACT

T_REG_D1_MAJOR_IMPACT

T_REG_D1_VOLUME_COLLIDER

T_REG_D1_MULTI_CRATER

T_REG_D1_PUBLISHED_REPLACEMENT

T_REG_D12_HIGH_RES_8M

T_REG_D12_CRATER_RADIUS_TOLERANCE

T_REG_D12_VISUAL_COLLIDER_AGREEMENT

Existing:

npm run check:impact-fidelity

MUST still PASS.

Do NOT change tolerances.

==================================================
REGRESSION GROUP G
U0
==================================================

Preserve:

T_REG_U0_UNIVERSAL_TARGET_KEY

T_REG_U0_BIGINT_IDENTITY

T_REG_U0_PLAYER_ADDRESS_NOT_TARGET

T_REG_U0_ANDROMEDA_TARGET

T_REG_U0_SGRA_TARGET

T_REG_U0_M31_TARGET

T_REG_U0_TARGET_SURVIVES_REBASE

==================================================
REGRESSION GROUP H
U1
==================================================

Preserve:

T_REG_U1_PROCEDURAL_SYSTEM_DETERMINISM

T_REG_U1_GENERATED_STAR

T_REG_U1_GENERATED_PLANETS

T_REG_U1_GENERATED_MOONS

T_REG_U1_DYNAMIC_VISUALS

T_REG_U1_ROCKY_LANDING

T_REG_U1_MOON_LANDING

T_REG_U1_GIANT_NO_LANDING

T_REG_U1_PROVIDER_UNLOAD

T_REG_U1_REVISIT_SAME_SYSTEM

T_REG_U1_GLOBAL_EPOCH

==================================================
REGRESSION GROUP I
U2
==================================================

Preserve:

T_REG_U2_ACTIVE_GALAXY

T_REG_U2_MW_SECTOR_ZERO_SOLAR

T_REG_U2_ANDROMEDA_LOCAL_COORDS

T_REG_U2_ANDROMEDA_SYSTEM

T_REG_U2_M31_OWNERSHIP

T_REG_U2_M31_20KLY_RANGE

T_REG_U2_SGRA_26KLY_FROM_SOL

T_REG_U2_SGRA_INTERGALACTIC_FROM_M31

T_REG_U2_EXTERNAL_GALAXY_PROXY

T_REG_U2_NO_ACTIVE_GALAXY_DUPLICATE

T_REG_U2_ANDROMEDA_ROUNDTRIP

T_REG_U2_MANAUS_AFTER_ROUNDTRIP

==================================================
REGRESSION GROUP J
RESOURCE / PRECISION INVARIANTS
==================================================

Mandatory:

T_REG_NO_ASTRONOMICAL_OBJECT3D_POSITION

T_REG_RENDER_COORDINATES_BOUNDED

T_REG_NO_MATH_RANDOM_PROCEDURAL_WORLD

T_REG_PROVIDER_COUNT_BOUNDED

T_REG_FRAME_COUNT_BOUNDED

T_REG_DYNAMIC_VISUAL_COUNT_BOUNDED

T_REG_NO_PROVIDER_LEAK_AFTER_ROUNDTRIP

T_REG_NO_FRAME_LEAK_AFTER_ROUNDTRIP

==================================================
REGRESSION SUITE IMPLEMENTATION
==================================================

Prefer:

tests/regression/core-regression.test.ts

tests/regression/manaus-regression.test.ts

tests/regression/solar-regression.test.ts

tests/regression/destruction-regression.test.ts

tests/regression/universe-regression.test.ts

Reuse shared existing helpers.

Do NOT copy thousands of lines of tests.

Do NOT make regression tests documentation-only.

They must assert actual runtime behaviour.

==================================================
REGRESSION COMMAND
==================================================

Add:

npm run test:regression

It should execute only the fast permanent regression contracts.

Expected:

fast enough to run constantly.

The full:

npm test

remains authoritative and still runs afterward.

==================================================
BROWSER REGRESSION ORCHESTRATOR
==================================================

Create:

scripts/regression-browser.mjs

or equivalent.

It should orchestrate existing browser checkpoints rather than recreate them.

At minimum:

Manaus
Manaus aerial
Solar/space
procedural U1
galaxy U2
new U3

Command:

npm run test:browser:regression

Do not commit screenshots.

==================================================
CI
==================================================

Update current:

Unit, types and build

workflow so the exact final SHA runs:

typecheck

test:regression

full unit suite

build

If GPU/browser is not reliable in GitHub Actions:

DO NOT fake browser CI.

Keep:

test:browser:regression

as local/native verification and report it separately.

==================================================
NOW IMPLEMENT U3
==================================================

==================================================
PART A
CREATE UniversalTravelController
==================================================

Create a travel authority such as:

src/world/travel/UniversalTravelController.ts

It owns remote-system travel.

Do NOT put U3 state directly inside:

Game.ts.

Suggested responsibilities:

plan()

start()

update()

cancel()

resume()

retarget if safely allowed

prepareDestination()

commitArrival()

==================================================
PART B
TRAVEL TYPE
==================================================

Create explicit domains:

INTRA_SYSTEM

INTERSTELLAR

INTERGALACTIC

COSMOLOGICAL

Current U3 implements:

INTERSTELLAR
INTERGALACTIC

Existing CosmicFlight continues owning:

INTRA_SYSTEM.

COSMOLOGICAL remains unavailable until U6.

==================================================
PART C
TRAVEL PLAN
==================================================

Create an immutable plan.

Suggested:

interface UniversalTravelPlan {
  id: string

  origin: TravelAnchor

  destination: TravelAnchor

  requestedTarget:
    UniversalNavigationTarget

  resolvedDestination:
    UniversalNavigationTarget

  domain:
    'interstellar' | 'intergalactic'

  logicalDistanceM: number

  durationS: number

  departureEpochS: number

  arrivalPolicy: ...

  finalBodyTarget?: UniversalNavigationTarget
}

Travel plan target is frozen once travel starts.

Changing selected HUD target must NOT silently mutate an active trip.

==================================================
PART D
TRAVEL ANCHOR
==================================================

A travel anchor must contain logical identity.

Example:

interface TravelAnchor {
  galaxyId: string
  sector: SectorIndex
  systemId?: string

  galaxyLocalOffsetM?: Vec3

  globalPositionM?: Vec3
}

Do not use:

Object3D.position

as travel authority.

==================================================
PART E
CURRENT LOCATION DURING HYPERCRUISE
==================================================

UniverseAddress cannot represent arbitrary space between star systems.

Do NOT abuse it.

Introduce:

UniversalTransitState

or equivalent.

Example:

interface UniversalTransitState {
  origin: TravelAnchor
  destination: TravelAnchor

  progress01: number

  distanceTravelledM: number
  distanceRemainingM: number

  effectiveSpeedMps: number

  phase:
    | 'spool'
    | 'accelerating'
    | 'cruise'
    | 'decelerating'
    | 'arrival-hold'
    | 'coasting'
    | 'complete'
}

==================================================
PART F
ONE LOCATION AUTHORITY AT A TIME
==================================================

Explicit invariant:

ANCHORED MODE:

UniverseRuntime.address
is current location authority.

TRANSIT MODE:

UniversalTransitState
is current location authority.

Do NOT pretend the player simultaneously lives:

in Solar System

and

halfway to Andromeda.

Expose something like:

UniverseRuntime.locationMode

'anchored'
'transit'

or equivalent.

==================================================
PART G
DO NOT CALL setAddress THROUGH TRANSIT
==================================================

Current:

UniverseRuntime.setAddress()

only assigns address and does NOT synchronize activeGalaxy.

Therefore U3 must NOT perform incremental travel via:

setAddress(...).

Destination galaxy/system change remains atomic.

At final arrival:

prepare destination

then commit:

GalaxyRuntime
SystemRuntime
UniverseAddress
player frame
providers
visuals

together.

==================================================
PART H
TRAVEL DISTANCE
==================================================

Use U2 logical distance infrastructure.

Same galaxy:

BigInt sector difference FIRST

then bounded numeric metre conversion.

Different galaxy:

galaxy global displacement
+
galaxy-local offsets.

Never derive travel distance from renderer.

==================================================
PART I
SUPPORTED U3 TARGETS
==================================================

Production U3 supports:

star

system

body in another system

known galaxy

Do NOT support production travel to:

black-hole

cluster

cosmic-anchor

observable-horizon

yet.

Black-hole remains BH0/BH1/BH2.

Cosmological remains U6.

==================================================
PART J
GALAXY TARGET NEEDS A REAL ARRIVAL DESTINATION
==================================================

A target:

Andromeda

is a galaxy, not a physical arrival point.

Create:

GalaxyEntryResolver

or equivalent.

For known galaxies:

Milky Way:
default entry = Solar System safe arrival

Andromeda:
default entry = deterministic safe Andromeda system

Refactor the current:

findAndromedaU2Fixture()

into a neutral reusable production concept if appropriate.

Do NOT ship production travel calling something named:

U2Fixture.

==================================================
PART K
ANDROMEDA ENTRY
==================================================

The existing deterministic Andromeda system:

andromeda
sector 200,0,0
star andromeda/200,0,0/1

may become the initial curated deterministic Andromeda gateway IF it
remains valid after audit.

If production code uses it:

rename concept to:

AndromedaEntryAnchor

or:

GalaxyEntryResolver.

Tests may keep U2 compatibility wrappers.

==================================================
PART L
MILKY WAY ENTRY
==================================================

If player selects:

Milky Way

while in Andromeda:

production hypercruise should arrive in:

Solar System

at a SAFE SYSTEM-FRAME POSITION.

Do NOT teleport directly to Manaus ground.

Suggested:

outside major planetary orbit traffic

or safe Solar arrival corridor.

If player specifically targets:

Earth

then after intergalactic arrival into Sol:

continue using existing intra-system autopilot toward Earth.

Do NOT auto-land.

==================================================
PART M
MULTI-LEG TRAVEL PLAN
==================================================

This is important.

A target may be:

planet in another system.

Travel plan should become:

LEG 1
hypercruise to destination system

LEG 2
atomic system materialization

LEG 3
existing CosmicFlight final approach to selected body

Example:

Solar
→ procedural planet

must not hypercruise directly into the planet surface.

Likewise:

Solar
→ Andromeda rocky planet

INTERGALACTIC
↓
destination system arrival
↓
INTRA-SYSTEM CosmicFlight
↓
planet approach.

==================================================
PART N
DO NOT DUPLICATE CosmicFlight
==================================================

U3 handles:

between systems/galaxies.

Existing CosmicFlight handles:

within one active system.

At arrival:

hand off to existing:

intraSystemNavigationTarget()

and:

CosmicFlight/autopilot.

No second planetary autopilot.

==================================================
PART O
TRAVEL ACTIVATION
==================================================

Current P semantics become:

if target in same active system:
existing CosmicFlight

else if target supported remote system/star/body:
start INTERSTELLAR HYPERCRUISE

else if target is known external galaxy:
start INTERGALACTIC HYPERCRUISE

else:
show appropriate unavailable message.

==================================================
PART P
DO NOT HYPERCRUISE FROM THE GROUND
==================================================

If player is:

Grounded

local ENU

inside local atmospheric/terrain gameplay

P remote target must refuse:

"Saia da superfície para iniciar hypercruise"

or equivalent.

User must:

take off
leave local planetary domain

before interstellar jump.

Do not automatically drag the player through terrain.

==================================================
PART Q
SAFE DEPARTURE GATE
==================================================

Hypercruise start requires:

not grounded

not in landing handoff

not colliding

not inside solid body

not inside star exclusion region

not inside active catastrophic collision event

not already materializing a destination.

==================================================
PART R
TRAVEL TIME POLICY
==================================================

Gameplay travel must take seconds even though distances remain real.

Use distance-dependent duration.

Desired approximate experience:

nearby stars:
5-12 seconds

long Milky Way route:
10-25 seconds

Solar → Andromeda:
15-30 seconds

Default Solar → Andromeda should feel around:

~18-22 seconds

not:

2.5 million years.

==================================================
PART S
SUGGESTED DURATION POLICY
==================================================

A suitable deterministic starting model:

INTERSTELLAR:

durationS =
clamp(
  5 + 4 * log10(1 + distanceLy / 4),
  5,
  25
)

INTERGALACTIC:

durationS =
clamp(
  15 + 5 * log10(1 + distanceLy / 1_000_000),
  15,
  30
)

You may tune after measurement.

But preserve the desired ranges.

Document final formula.

==================================================
PART T
THIS SPEED IS EFFECTIVE HYPERCRUISE SPEED
==================================================

HUD must say:

HYPERCRUISE

or:

VELOCIDADE EFETIVA

Do NOT label:

2,000,000c

as ordinary local physical velocity.

Never feed this speed into:

PlayerController
PhysicsWorld
terrain collision
local CCD
celestial CCD.

==================================================
PART U
TRAVEL PROFILE
==================================================

Create phases:

SPOOL

ACCELERATION

CRUISE

DECELERATION

ARRIVAL HOLD

COMPLETE

Suggested spool:

~0.8-1.2 seconds.

Movement progress must be:

monotonic
continuous
deterministic
FPS independent.

Use elapsed absolute travel time.

Do NOT integrate progress by repeatedly adding:

speed * frameDelta

if doing so causes FPS drift.

==================================================
PART V
PROGRESS CURVE
==================================================

Use a C1/C2 smooth piecewise profile.

Requirements:

velocity starts near zero

acceleration ramps

middle cruise is stable

deceleration begins well before destination

velocity approaches zero at handoff.

No instant:

0
→ millions c.

Tests at:

30 FPS
60 FPS
120 FPS

must produce effectively identical:

progress
arrival time
distance travelled.

==================================================
PART W
DISPLAY EFFECTIVE SPEED
==================================================

Calculate:

d(progress)/dt
*
logicalDistance

Display:

c

kc
Mc

or:

ly/s

when useful.

Examples:

Speed:
82,000c

ETA:
12.4s

Distance remaining:
1.72 Mly

This is gameplay hypercruise telemetry.

==================================================
PART X
SPEED MUST SCALE WITH DISTANCE
==================================================

Do NOT make one constant:

1,000,000c

for every trip.

Otherwise:

nearby star travel
and
Andromeda travel

cannot both feel good.

Duration policy is authoritative.

Effective speed emerges from:

distance / duration.

==================================================
PART Y
DESTINATION PREFETCH
==================================================

Do not wait until progress 100% to generate destination.

Begin preparing destination around:

60-75% progress

or when estimated preparation time requires it.

Prepare:

GalaxySession if needed

ProceduralSystemRuntime

frames

providers

dynamic visuals

terrain/provider metadata

safe arrival point.

==================================================
PART Z
ARRIVAL HOLD
==================================================

If player reaches final deceleration region but destination is NOT ready:

do NOT commit partial state.

Clamp progress to a safe:

ARRIVAL HOLD

Example:

~97-99%.

HUD:

SINCRONIZANDO DESTINO

Remain bounded.

Once preparation succeeds:

finish final deceleration

atomic commit.

==================================================
PART AA
PREP FAILURE
==================================================

If destination preparation fails:

do not corrupt source runtime.

Travel enters safe:

arrival-hold/error

or controlled coasting.

Show error.

Allow:

X cancel

or retry P.

No partial:

activeGalaxy
activeSystem
address

changes.

==================================================
PART AB
ATOMIC ARRIVAL
==================================================

Use U1/U2 materializers.

Final arrival:

prepared galaxy
+
prepared system
+
frames
+
providers
+
visuals

then one atomic commit.

Do NOT rewrite system installation inside U3.

==================================================
PART AC
SOURCE SYSTEM DURING TRANSIT
==================================================

It is acceptable to retain source activeSystem runtime internally during
a short hypercruise, provided:

its presentation is suppressed appropriately

its physics cannot interact with transit

streaming budgets are disabled/suspended

it remains bounded

and it is replaced atomically at destination.

Do NOT simulate every star between source and destination.

==================================================
PART AD
NO INTERMEDIATE PLANET COLLISION SWEEP
==================================================

At interstellar/intergalactic speeds:

do NOT sweep against every:

planet
star
asteroid
galaxy

along millions of light years.

That is impossible and unnecessary.

Hypercruise is a separate travel domain.

Collision authority resumes during:

departure local clearance

destination approach.

==================================================
PART AE
X CANCEL
==================================================

Preserve X as travel cancellation/braking.

During:

SPOOL

X:
abort and remain at source anchored location.

During:

ACCEL / CRUISE / DECEL

X:
perform smooth emergency hypercruise deceleration

then enter:

COASTING / TRANSIT HOLD

at current logical progress.

Do NOT teleport back to source.

Do NOT teleport to destination.

==================================================
PART AF
TRANSIT HOLD
==================================================

When stopped mid-route:

player remains in:

UniversalTransitState.

They are between systems.

Local planetary physics remains disabled.

Camera/look remains available.

HUD shows:

EM TRÂNSITO

distance to source

distance to destination.

==================================================
PART AG
RESUME
==================================================

While transit stopped:

P with same destination:
resume.

Select source + P:
travel back.

Select another supported target:
a new travel plan may be created FROM current transit position if geometry
can be resolved safely.

If arbitrary retargeting would broaden scope excessively:

require return/resume first for U3.

Document chosen limitation.

==================================================
PART AH
TRAVEL TARGET SNAPSHOT
==================================================

If user changes selected map target while currently flying:

active travel plan does NOT silently change.

HUD distinguishes:

TRAVEL DESTINATION

SELECTED TARGET

User must cancel/retarget explicitly.

==================================================
PART AI
VISUAL PRESENTATION
==================================================

Create:

HypercruisePresentation

or equivalent.

Reuse existing:

SpeedVFX
SpaceLayer

where possible.

Do not create an expensive full-screen postprocessing stack unless needed.

Visual phases:

spool:
subtle space distortion / star intensification

acceleration:
stars stretch

cruise:
bounded directional streaks

deceleration:
streaks shorten

arrival:
destination starfield resolves.

==================================================
PART AJ
NO COPYRIGHTED WARP EFFECT
==================================================

Do not copy:

Star Wars
Star Trek
Interstellar

specific visual assets/scenes.

Create original hypercruise presentation.

==================================================
PART AK
INTERSTELLAR VISUAL
==================================================

Within same galaxy:

retain general galaxy starfield character.

Star streaks should reflect:

travel direction

not camera rotation artifacts.

No star positions at astronomical Float32 values.

==================================================
PART AL
INTERGALACTIC VISUAL
==================================================

Milky Way → Andromeda:

source galaxy should gradually recede.

target galaxy should gradually increase in angular significance.

Do not instantly swap sky at 50%.

Presentation may interpolate:

source proxy
target proxy
intergalactic star/void density

through transit progress.

==================================================
PART AM
GALAXY SWITCH MOMENT
==================================================

DO NOT change:

activeGalaxy

mid-flight merely because progress > 0.5.

activeGalaxy describes anchored runtime.

During transit:

UniversalTransitState owns current travel location.

Destination activeGalaxy becomes authoritative only on:

arrival commit.

==================================================
PART AN
MAP DURING TRAVEL
==================================================

Universal Map should show:

source

destination

route

player marker interpolated along route

progress percentage

remaining logical distance.

Do not pretend player is still exactly at source.

Do not mutate UniverseAddress every frame.

==================================================
PART AO
MAP INTERSTELLAR
==================================================

Within one galaxy:

show player progression along a simplified galactic route.

Do not render every crossed 100 ly sector.

Route can be a logical line/path.

==================================================
PART AP
MAP INTERGALACTIC
==================================================

Milky Way → Andromeda:

Cosmology/Local Group view should show:

Milky Way

Andromeda

route line

player transit marker.

This makes the 2.5 Mly journey visually understandable.

==================================================
PART AQ
TARGET GALAXY ANGULAR SIZE
==================================================

Use logical travel progress/distance to adjust external galaxy presentation.

Do NOT scale purely by:

progress linear

if physical/angular relation can be cheaply approximated.

At minimum use current remaining/source distances.

Keep bounded scale.

==================================================
PART AR
STARFIELD HANDOFF
==================================================

Destination StarSectorProvider must NOT become active while still millions
of ly away.

During hypercruise:

presentation layer handles travel.

Near arrival:

prepared provider remains detached.

At atomic arrival:

destination star sectors become active.

==================================================
PART AS
NORMAL ANDROMEDA TRAVEL
==================================================

This is the major U3 acceptance.

From Solar space:

select:

Andromeda

Press P.

Expected:

spool

acceleration

intergalactic cruise

deceleration

destination prefetch

atomic arrival

activeGalaxy:
andromeda

activeSystem:
Andromeda entry system

No U2 TEST control used.

Travel duration:

approximately 15-30 s

target approximately:
18-22 s after tuning.

==================================================
PART AT
RETURN FROM ANDROMEDA
==================================================

From Andromeda:

select:

Milky Way

P.

Expected:

production hypercruise

not test return.

Arrival:

Solar System safe space.

Do not return directly to Manaus ground.

==================================================
PART AU
TARGET EARTH FROM ANDROMEDA
==================================================

Select Earth from Andromeda if UI allows hierarchical target.

P.

Expected plan:

INTERGALACTIC HYPERCRUISE
→ Solar System safe arrival
→ INTRA-SYSTEM CosmicFlight
→ Earth approach

NO automatic landing.

==================================================
PART AV
INTERSTELLAR MILKY WAY
==================================================

Create deterministic QA/accessible target using existing U1 fixture:

Milky Way
sector:
17,-2,4

or another canonical system.

From Solar:

P remote system.

Expected:

INTERSTELLAR HYPERCRUISE

not U1 TEST ARRIVAL.

Target system materializes normally.

==================================================
PART AW
INTERSTELLAR RETURN
==================================================

From generated Milky Way system:

select:

Sol

P.

Expected:

interstellar hypercruise

Solar System safe arrival.

No U1 TEST RETURN.

==================================================
PART AX
SAME-GALAXY DIFFERENT SYSTEM
==================================================

From generated system A:

select system B.

P.

Expected:

hypercruise A → B.

Do NOT return to Sol in between.

==================================================
PART AY
ANDROMEDA INTERSTELLAR
==================================================

Inside Andromeda:

select another deterministic Andromeda system.

Travel:

INTERSTELLAR.

Do not invoke intergalactic path because galaxyId is same.

==================================================
PART AZ
BLACK HOLE
==================================================

Selecting:

Sgr A*
M31 SMBH

remains allowed.

Pressing P:

must say something like:

BLACK-HOLE TRAVEL REQUIRES BH0

or existing:

Viagem a buracos negros ainda indisponível.

Do NOT hypercruise directly into event horizon in U3.

==================================================
PART BA
COSMOLOGICAL TARGETS
==================================================

Virgo
Great Attractor
Shapley
observable horizon

remain:

NOT YET ACTIVE.

U6.

Do not let U3 accidentally accept them because distance is finite.

==================================================
PART BB
TravelCapability
==================================================

Current:

interstellar-future
intergalactic-future

must evolve.

Suggested:

solar
intra-system
interstellar
intergalactic
black-hole-future
cosmological-future

or equivalent.

After U3:

supported remote star/system/body:
INTERSTELLAR AVAILABLE

known external galaxy:
INTERGALACTIC AVAILABLE

black hole:
future

cosmological:
future.

==================================================
PART BC
HUD
==================================================

During hypercruise show:

HYPERCRUISE

Domain:
INTERSTELLAR / INTERGALACTIC

Destination

Source

Phase

Logical distance

Travelled

Remaining

Progress %

Effective speed

Speed in c

ETA

Destination preparation status

Cancel:
X

==================================================
PART BD
F3
==================================================

Add:

HYPERCRUISE · Active

HYPERCRUISE · Domain

HYPERCRUISE · Plan ID

HYPERCRUISE · Source

HYPERCRUISE · Destination

HYPERCRUISE · Logical distance

HYPERCRUISE · Progress

HYPERCRUISE · Phase

HYPERCRUISE · Effective speed

HYPERCRUISE · ETA

HYPERCRUISE · Destination prepared

HYPERCRUISE · Location mode

HYPERCRUISE · Cancelled/coasting

HYPERCRUISE · Source galaxy

HYPERCRUISE · Destination galaxy

==================================================
PART BE
NO LOCAL PHYSICS DURING HYPERCRUISE
==================================================

While travel domain active:

disable:

terrain collision

local body collision

local building physics

Manaus simulation

landing

powers interacting with local props

without destroying their saved state.

Camera and HUD continue.

==================================================
PART BF
RETURN TO LOCAL PHYSICS
==================================================

After final system arrival:

normal system physics resumes.

After body approach/landing:

normal planetary physics resumes.

Do not leave:

PhysicsWorld terrain

from source planet active after arrival.

==================================================
PART BG
TRANSITION ROOT VISIBILITY
==================================================

Audit:

localWorldRoot

planetRoot

celestialRoot

actorRoot

during U3.

No:

Manaus floating in intergalactic void

Earth remaining visible halfway to Andromeda

source planets following player

destination planets visible before materialization.

==================================================
PART BH
AUDIO
==================================================

Current wind audio should still only apply where appropriate.

During vacuum hypercruise:

do not play Earth wind.

If existing speed sound is atmospheric-only:

create/use a separate subtle hypercruise sound only if assets/framework
already support it.

Do not block U3 on new audio assets.

==================================================
PART BI
INPUT
==================================================

During hypercruise:

mouse:
camera look

X:
cancel/brake

P:
resume if stopped / already active should not restart

M:
map

F:
no landing

B:
do NOT cycle local Warp 1c-256c

because U3 hypercruise owns the current domain.

After arrival:

B returns to normal intra-system Warp.

==================================================
PART BJ
NO WARP STATE LEAK
==================================================

Starting U3 must clear/suspend:

existing B warpStep

CosmicFlight autopilot

landing intent

local flight acceleration.

Arrival starts with safe velocity.

No 256c local velocity inherited into generated planet approach.

==================================================
PART BK
SAFE ARRIVAL
==================================================

Never arrive:

inside star

inside planet

inside moon

inside exclusion radius

inside terrain.

System/star destination:

use safe system arrival corridor.

Body destination:

system arrival first.

Then normal autopilot.

==================================================
PART BL
SAFE SOLAR ARRIVAL
==================================================

Milky Way default gateway:

Sol.

Choose a documented safe barycentric arrival point.

No collision with:

Sun
Earth
Jupiter
other planet.

Use actual current orbital positions when selecting safe corridor.

==================================================
PART BM
SAFE PROCEDURAL ARRIVAL
==================================================

Reuse/refine U1:

systemDomainLimitM()

and safe arrival policy.

Do not invent a second placement rule inside U3.

==================================================
PART BN
EPOCH
==================================================

UniverseRuntime global epoch continues during hypercruise.

Travel time of ~20 s advances simulation time normally.

Do NOT simulate:

2.5 million years

because logical distance is 2.5 Mly.

Gameplay FTL travel duration is 20 s.

==================================================
PART BO
DETERMINISM
==================================================

Same:

origin
destination
epoch
travel policy

must yield:

same logical distance
same target duration
same phase boundaries

independent of FPS.

No Math.random.

==================================================
PART BP
PERFORMANCE
==================================================

Travel must not allocate every frame.

No per-frame:

new galaxy point cloud
new geometry
new system generator
large arrays

Progress update must be lightweight.

Destination preparation happens once.

==================================================
PART BQ
MEMORY
==================================================

Run repeated production journeys:

Solar
→ MW procedural
→ Solar
→ Andromeda
→ Solar

5 cycles.

Provider/frame/visual counts must return to bounded baseline.

No monotonic geometry growth.

==================================================
PART BR
PRECISION
==================================================

Assert during Andromeda trip:

all Object3D positions remain bounded.

Suggested existing maximum:

RenderSpace max magnitude regime.

No component anywhere near:

1e22.

Logical distance may be 1e22.

Render position may NOT.

==================================================
PART BS
CURRENT U2 ISSUE
setAddress()
==================================================

Audit:

UniverseRuntime.setAddress().

It currently mutates address without synchronizing:

activeGalaxy.

Do not permit U3 to use this unsafely.

Either:

make setAddress internal/safer

or:

assert it cannot cross galaxy/system runtime boundaries

or:

replace cross-domain callers with transactional install APIs.

Mandatory invariant:

anchored:
activeGalaxy.id === address.galaxyId

==================================================
PART BT
CURRENT NAMING DEBT
==================================================

UniversalTargetResolver currently uses logical frame label:

'milky-way-centred'

for global Local Group style positions.

If U3 touches this API:

rename to a neutral semantic name such as:

'local-group-global'

with compatibility where needed.

Do not perform unrelated massive refactor solely for naming.

==================================================
PART BU
BLACK-HOLE POSITION DEBT
==================================================

Do NOT open BH0.

But document current:

BlackHoleDefinition.positionM

semantic ambiguity.

Do not build U3 travel position authority on that field.

Black-hole target travel remains unavailable.

==================================================
PART BV
MANDATORY U3 TESTS
==================================================

Add at minimum:

T_U3_REMOTE_TARGET_STARTS_HYPERCRUISE

T_U3_SAME_SYSTEM_USES_COSMIC_FLIGHT

T_U3_INTERSTELLAR_DOMAIN

T_U3_INTERGALACTIC_DOMAIN

T_U3_COSMOLOGICAL_REJECTED

T_U3_BLACK_HOLE_REJECTED

T_U3_GROUNDED_START_REJECTED

T_U3_SAFE_DEPARTURE

T_U3_REAL_LOGICAL_DISTANCE

T_U3_NO_RENDER_DISTANCE_AUTHORITY

T_U3_DURATION_NEAR_STAR_RANGE

T_U3_DURATION_ACROSS_MW_RANGE

T_U3_DURATION_ANDROMEDA_RANGE

T_U3_PROGRESS_MONOTONIC

T_U3_PROGRESS_30_60_120_FPS

T_U3_PHASE_ORDER

T_U3_EFFECTIVE_SPEED_FINITE

T_U3_EFFECTIVE_SPEED_CAN_EXCEED_C

T_U3_EFFECTIVE_SPEED_NOT_LOCAL_VELOCITY

T_U3_X_CANCEL_SPOOL

T_U3_X_CANCEL_CRUISE

T_U3_CANCEL_DOES_NOT_TELEPORT

T_U3_COAST_STATE

T_U3_RESUME

T_U3_DESTINATION_PREFETCH

T_U3_ARRIVAL_HOLD

T_U3_PREFETCH_FAILURE_NO_PARTIAL_COMMIT

T_U3_ATOMIC_ARRIVAL

T_U3_ACTIVE_GALAXY_UNCHANGED_MID_TRANSIT

T_U3_ADDRESS_NOT_INCREMENTALLY_MUTATED

T_U3_LOCATION_MODE_TRANSIT

T_U3_MAP_TRANSIT_PROGRESS

T_U3_SOURCE_VISUAL_RETIRE

T_U3_NO_SOURCE_PLANET_FOLLOWING

T_U3_DESTINATION_NOT_VISIBLE_TOO_EARLY

T_U3_ANDROMEDA_PRODUCTION_TRAVEL

T_U3_ANDROMEDA_NO_TEST_ARRIVAL

T_U3_ANDROMEDA_TARGET_DURATION

T_U3_ANDROMEDA_FINAL_ACTIVE_GALAXY

T_U3_ANDROMEDA_FINAL_SYSTEM

T_U3_MILKY_WAY_PRODUCTION_RETURN

T_U3_RETURN_SAFE_SOLAR_SPACE

T_U3_EARTH_REMOTE_MULTILEG

T_U3_BODY_TARGET_FINAL_COSMIC_FLIGHT

T_U3_MW_PROCEDURAL_INTERSTELLAR

T_U3_PROCEDURAL_TO_SOL

T_U3_PROCEDURAL_A_TO_B

T_U3_ANDROMEDA_INTERSTELLAR

T_U3_NO_CROSS_SYSTEM_LOCAL_WARP

T_U3_B_WARP_DISABLED_IN_HYPERCRUISE

T_U3_B_WARP_RESTORED_AFTER_ARRIVAL

T_U3_NO_LOCAL_PHYSICS_IN_TRANSIT

T_U3_LOCAL_PHYSICS_RESTORED

T_U3_GLOBAL_EPOCH_CONTINUES

T_U3_RENDER_COORDS_BOUNDED

T_U3_BIGINT_SECTOR_DIFFERENCE

T_U3_NO_MATH_RANDOM

T_U3_REPEAT_TRAVEL_NO_LEAK

==================================================
PART BW
PERMANENT REGRESSION MUST RUN AFTER U3
==================================================

After U3 focused tests:

npm run test:regression

MUST PASS.

Then:

npm run check:impact-fidelity

MUST PASS.

Then full suite.

If regression fails:

STOP.

Fix regression.

Do NOT document U3 complete.

==================================================
PART BX
BROWSER U3
==================================================

Use existing browser runner.

No new framework.

Flow 1:
Solar → Milky Way procedural.

Start:
Manaus.

Take off properly into space.

Select canonical U1 remote system.

Press P.

Expected:
production INTERSTELLAR HYPERCRUISE.

No U1 TEST.

Observe:
spool
accel
cruise
decel
arrival.

Then:
generated system active.

==================================================
PART BY
BROWSER ANDROMEDA
==================================================

From Solar space:

select Andromeda.

Press P.

Expected:

production intergalactic travel.

Record:

real distance
duration
max effective speed
phase timing
progress.

Expected duration:
15-30 s.

No:

debugEnterAndromeda()

No:

U2 TEST ARRIVAL.

After arrival:

activeGalaxy = Andromeda

activeSystem =
production entry system.

==================================================
PART BZ
BROWSER CANCEL
==================================================

Start Andromeda trip.

At ~40%:

press X.

Expected:

smooth deceleration

progress stops around current position

no teleport

transit mode remains.

Press P.

Expected:
resume.

Complete trip.

==================================================
PART CA
BROWSER RETURN
==================================================

Inside Andromeda:

select Milky Way.

P.

Travel normally.

Expected:

safe Solar-space arrival.

Then select Earth.

Use existing intra-system flight.

No instant Manaus teleport.

==================================================
PART CB
BROWSER MULTI-LEG BODY
==================================================

From another procedural system:

select a body in a remote system.

P.

Expected telemetry:

LEG 1
HYPERCRUISE

LEG 2
SYSTEM HANDOFF

LEG 3
INTRA-SYSTEM APPROACH

Do not hypercruise through planet surface.

==================================================
PART CC
BROWSER REGRESSION
==================================================

After U3 browser test run:

npm run test:browser:regression

which must verify:

Manaus local

Manaus aerial

Solar flight

Sun approach

Moon/Mars landing

U1 procedural system

U2 Andromeda runtime

U3 hypercruise.

Zero page errors.

Zero unexpected console errors.

==================================================
PART CD
MANUAL GAMEPLAY ACCEPTANCE
==================================================

User manually tests:

1.
Start Manaus.

2.
Fly into space.

3.
Select another Milky Way star/system.

4.
Press P.

Expected:
real hypercruise.

5.
Return to Sol normally.

6.
Select Andromeda.

7.
Press P.

Expected:
~20-second intergalactic journey.

8.
Cancel mid-way with X.

Expected:
do not teleport.

9.
Resume.

10.
Arrive Andromeda.

11.
Fly around generated system.

12.
Land on rocky planet.

13.
Take off.

14.
Select Milky Way.

15.
P.

16.
Return to Solar space.

17.
Fly back to Earth/Manaus.

Expected:
all previous gameplay remains intact.

==================================================
PART CE
VISUAL ACCEPTANCE
==================================================

During Solar → Andromeda:

At start:
Milky Way context dominant.

During acceleration:
star streaks increase.

Mid-flight:
intergalactic travel reads clearly.

Near destination:
Andromeda becomes dominant.

Arrival:
streaks disappear smoothly.

Andromeda starfield resolves.

No:

white screen

black frame

galaxy pop

duplicate galaxy

giant floating Manaus

Earth following player

astronomical jitter.

==================================================
PART CF
TRAVEL TELEMETRY BENCHMARK
==================================================

Report at minimum:

Route:
Sol → nearby star

distance
duration
peak effective c

Route:
Sol → across Milky Way fixture

distance
duration
peak effective c

Route:
Sol → Andromeda

distance
duration
peak effective c

Route:
Andromeda → Milky Way

distance
duration
peak effective c.

==================================================
PART CG
NO PHYSICS CLAIM
==================================================

Document:

Hypercruise is fictional gameplay transport.

Logical astronomical distances are real-scale.

Travel time and effective FTL speed are gameplay systems.

Do not describe it as physically possible FTL.

==================================================
PART CH
DOCUMENTATION
==================================================

Create:

docs/world/29-status-U3-UNIVERSAL-HYPERCRUISE.md

Create:

docs/world/REGRESSION-GATE.md

Update:

docs/world/11-galaxy-and-universe.md

docs/world/universal-map.md

docs/world/15-status.md

specs/UNIVERSE-MAP-COMPLETION-EPIC.md

specs/Promptatual.md

Document:

travel domains

transit location authority

duration policy

effective FTL semantics

phase model

cancel/resume

destination prefetch

arrival atomicity

multi-leg travel

Andromeda production route

regression gate

remaining U4/BH/U5/U6 scope.

==================================================
PART CI
COMMIT DISCIPLINE
==================================================

Prefer approximately:

test(regression): add permanent cross-feature regression gate

feat(travel): add universal transit state and hypercruise planning

feat(travel): implement interstellar and intergalactic hypercruise

feat(render): add bounded hypercruise presentation and map progress

feat(universe): atomically materialize hypercruise destinations

test(universe): validate U3 travel, cancellation and legacy regressions

docs(universe): close U3 universal hypercruise checkpoint

Do not commit:

screenshots

browser artifacts

logs

temporary travel dumps

workspace files.

==================================================
PART CJ
RUN ORDER
==================================================

STRICT ORDER:

1.
git status
git branch --show-current
git log -1 --oneline

Confirm INITIAL HEAD.

2.
Implement regression gate FIRST.

3.
Run:

npm run typecheck

npm run test:regression

4.
Implement U3 in checkpoints.

5.
Run focused U3 tests.

6.
Run:

npm run test:regression

7.
Run:

npm run check:impact-fidelity

8.
Run:

npm test

9.
Run:

npm run build

10.
Run:

npm run test:browser:space

11.
Run:

npm run test:browser:galaxy

12.
Run new U3 browser checkpoint

13.
Run:

npm run test:browser:manaus

14.
Run:

npm run test:browser:regression

15.

git diff --check

16.
Push.

17.
Inspect GitHub Actions for EXACT FINAL SHA.

==================================================
CRITICAL STOP CONDITIONS
==================================================

STOP and fix before continuing if:

Manaus disappears incorrectly

Rio Negro regression

trees return to water

Sun collision returns to 2R

Moon/Mars landing breaks

Warp B breaks

impact fidelity fails

U0 keys change unexpectedly

procedural revisit changes system

Andromeda coordinates regress

M31 distance becomes ~2.5 Mly from Andromeda system

provider/frame counts leak

Object3D receives astronomical coordinates

P uses test arrival internally

Andromeda travel is implemented as one-frame teleport

cancel teleports player

arrival changes activeGalaxy before destination readiness.

==================================================
FINAL REPORT
==================================================

Report:

INITIAL HEAD

FINAL HEAD

COMMITS

==============================
REGRESSION GATE
==============================

REGRESSION TEST COUNT

MANAUS REGRESSION

MANAUS AERIAL REGRESSION

SOLAR REGRESSION

SUN P0 REGRESSION

LANDING REGRESSION

D1 REGRESSION

D1.2 FIDELITY RESULT

U0 REGRESSION

U1 REGRESSION

U2 REGRESSION

RESOURCE LEAK REGRESSION

PRECISION REGRESSION

==============================
U3 ARCHITECTURE
==============================

UniversalTravelController

UniversalTransitState

TravelPlan

LOCATION AUTHORITY

TRAVEL DOMAINS

DURATION FORMULA

PHASE PROFILE

CANCEL / RESUME

DESTINATION PREFETCH

ARRIVAL HOLD

ATOMIC HANDOFF

MULTI-LEG BODY TRAVEL

==============================
TRAVEL RESULTS
==============================

SOL → NEAR STAR
distance / duration / peak c

SOL → MW PROCEDURAL
distance / duration / peak c

PROCEDURAL A → B
distance / duration / peak c

SOL → ANDROMEDA
distance / duration / peak c

ANDROMEDA → MILKY WAY
distance / duration / peak c

CANCEL AT 40% RESULT

RESUME RESULT

==============================
ARRIVAL
==============================

ANDROMEDA FINAL GALAXY

ANDROMEDA FINAL SYSTEM

MILKY WAY RETURN SYSTEM

SAFE ARRIVAL POLICY

EARTH MULTI-LEG RESULT

==============================
RESOURCE / PRECISION
==============================

MAX RENDER POSITION

PROVIDER COUNTS BEFORE / DURING / AFTER

FRAME COUNTS BEFORE / DURING / AFTER

VISUAL COUNTS BEFORE / DURING / AFTER

5-CYCLE LEAK RESULT

==============================
VALIDATION
==============================

TYPECHECK

U3 FOCUSED TESTS

REGRESSION TESTS

IMPACT FIDELITY

FULL UNIT TESTS

BUILD

BROWSER SPACE

BROWSER GALAXY

BROWSER U3

BROWSER MANAUS

BROWSER REGRESSION

DIFF CHECK

GITHUB ACTIONS EXACT FINAL SHA

AUTOMATICALLY VERIFIED

REQUIRES USER MANUAL VALIDATION

Then STOP.

DO NOT START U4.

DO NOT START BH0.

DO NOT IMPLEMENT PROCEDURAL GALAXIES.

DO NOT IMPLEMENT BLACK-HOLE GRAVITY OR PORTALS.
```

Esse U3 é o ponto em que eu também mudaria nossa disciplina do projeto: a partir dele, `npm run test:regression` vira **gate obrigatório em todo prompt futuro**, inclusive U4, BH0/BH1/BH2, U5 e U6. Assim uma alteração em Andrômeda ou buracos negros não pode silenciosamente quebrar Manaus, pouso na Lua, o Sol, crateras ou os sistemas procedurais que já foram concluídos.