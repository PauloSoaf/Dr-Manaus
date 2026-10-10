Manda este. Ele parte exatamente do HEAD atual `9909091f7bfb14b40c031752df29550deddd1651` e ataca o próximo gargalo real: **Milky Way e Andromeda precisam deixar de ser apenas catálogo/apresentação e virar contextos de galáxia ativos**, sem ainda fingir que U3 hypercruise existe.

```text
STOP ALL WORK OUTSIDE THIS CHECKPOINT.

Repository:
PauloSoaf/Dr-Manaus

Branch:
feat/universe-map

CURRENT AUDITED HEAD:

9909091f7bfb14b40c031752df29550deddd1651

HEAD MESSAGE:

docs(universe): close U1 playable procedural systems checkpoint

==================================================
UNIVERSE MAP COMPLETION EPIC
SPRINT U2
GALAXY RUNTIME + ANDROMEDA
ACTIVE GALAXY CONTEXT + CROSS-GALAXY SYSTEM MATERIALIZATION
==================================================

CURRENT ROADMAP:

U0
Universal navigation target
COMPLETE

U1
Playable procedural star systems
COMPLETE

NOW:

U2
Galaxy Runtime + Andromeda

LATER:

U3
Interstellar / Intergalactic Hypercruise

U4
Procedural Galaxies

BH0
Functional Black Holes

BH1
Gravity / Event Horizon / Lensing

BH2
Black-hole traversal network

U5
Full Universal Map

U6
Cosmological exploration

DO NOT START U3.

DO NOT IMPLEMENT REAL INTERGALACTIC TRAVEL.

DO NOT IMPLEMENT BLACK-HOLE GRAVITY.

==================================================
WHAT U1 ALREADY DELIVERED
==================================================

Preserve all of U1:

ProceduralSystemMaterializer

CelestialSystemRuntime.systemFrameId

dynamic generated stars

dynamic generated planets/moons

generated body profiles

synthetic-base landing

intra-system CosmicFlight

Tab/Shift+Tab

P intra-system autopilot

Warp B 1c → 256c

system unload/revisit

BigInt target identity

U1 TEST ARRIVAL

U1 TEST RETURN TO SOLAR

DO NOT regress these.

==================================================
PRIMARY U2 GOAL
==================================================

At the end of U2:

Milky Way and Andromeda must both be REAL ACTIVE GALAXY CONTEXTS.

The player must be able, through an EXPLICIT U2 TEST arrival path, to:

Solar System
→ Andromeda
→ deterministic generated Andromeda star system
→ fly between its generated planets
→ land on generated rocky planets/moons
→ open the map and see Andromeda as the current galaxy
→ target M31 SMBH as Andromeda's central black hole
→ return to Milky Way/Solar
→ revisit the exact same Andromeda system deterministically

This is NOT yet actual 2.5 million light-year travel.

U3 will implement that.

==================================================
CONFIRMED CURRENT LIMITATION 1
U1 MATERIALIZER IS HARD-CODED TO MILKY WAY
==================================================

Current:

ProceduralSystemMaterializer.prepare()

contains effectively:

a.galaxyId !== 'milky_way'
→ reject

This was correct for U1.

It is now the first thing U2 must generalize.

Do NOT replace it with:

if galaxyId === 'milky_way' || galaxyId === 'andromeda'

scattered around the project.

Create a proper active-galaxy abstraction.

==================================================
CONFIRMED CURRENT LIMITATION 2
STAR SECTOR COORDINATE SEMANTICS ARE WRONG FOR ANDROMEDA PLAY
==================================================

Current StarSector generation computes:

localCentre =
Number(sector) * SECTOR_SIZE_M

Then Milky Way density is positioned relative to:

GALACTIC_CENTRE_FROM_SOL_M

This means:

Milky Way sector 0,0,0
=
Solar neighbourhood

which is an established legacy invariant and MUST remain.

However current handling of another galaxy such as Andromeda effectively
mixes:

Milky-Way/Solar-relative global offsets

with:

galaxy-local sector coordinates.

That is unsuitable for making Andromeda playable.

A player inside Andromeda should NOT have every star-sector density
calculation offset by ~2.5 million light years from the galaxy itself.

Fix the coordinate model.

==================================================
PART A
CREATE GalaxyRuntime
==================================================

Introduce a logical runtime/context for an active galaxy.

Suggested:

src/world/galaxy/GalaxyRuntime.ts

or equivalent.

Concept:

interface GalaxyRuntime {
  readonly id: string

  readonly definition: GalaxyDefinition

  readonly addressOrigin:
    GalaxyAddressOrigin

  readonly centralBlackHole?: BlackHoleDescriptor

  galaxyLocalPosition(
    sector: SectorIndex,
    offsetM?: Vec3
  ): Vec3

  densityAtLocal(
    positionM: Vec3
  ): number

  generateSector(
    sector: SectorIndex
  ): StarSectorContent
}

Exact design may differ.

But there must be ONE abstraction describing:

what galaxy the player is currently inside

how galaxy-local sectors map to stellar density

what central black hole belongs to it

what star-sector generator it uses.

==================================================
PART B
UniverseAddress REMAINS LOCATION AUTHORITY
==================================================

Do NOT create a competing location authority.

UniverseRuntime.address remains:

PLAYER LOGICAL ADDRESS.

GalaxyRuntime is the materialized runtime corresponding to:

address.galaxyId.

Required invariant:

UniverseRuntime.activeGalaxy.id
===
UniverseRuntime.address.galaxyId

when a galaxy context is installed.

==================================================
PART C
ACTIVE GALAXY
==================================================

Add:

UniverseRuntime.activeGalaxy

or equivalent.

Startup:

activeGalaxy:
Milky Way

activeSystem:
SolarSystem

address:
milky_way / 0,0,0 / sol / earth

After U2 TEST Andromeda arrival:

activeGalaxy:
Andromeda

activeSystem:
ProceduralSystemRuntime

address:
andromeda / <sector> / <system>

No fake:

milky_way

remaining in player location.

==================================================
PART D
DO NOT STORE INTERGALACTIC DISTANCE IN LOCAL SYSTEM FRAME
==================================================

When inside Andromeda:

system coordinates are local metres around the generated star.

Do NOT add:

2.5 million light years

to planet positions.

Hierarchy remains:

UniverseAddress
galaxy
→ galaxy-local sector
→ system
→ body

Inside active system:

small real-metre positions.

Global galaxy separation remains descriptor/address metadata.

==================================================
PART E
GALAXY ADDRESS ORIGIN SEMANTICS
==================================================

Create an explicit concept defining where:

sector 0,0,0

sits relative to the galaxy centre.

Suggested:

interface GalaxyAddressOrigin {
  readonly galaxyId: string

  /**
   * Position of sector origin 0,0,0 relative to galaxy centre.
   */
  readonly originFromGalacticCentreM: Vec3
}

For Milky Way preserve existing invariant:

sector 0,0,0
=
Solar neighbourhood

Therefore approximately:

originFromGalacticCentreM =
-GALACTIC_CENTRE_FROM_SOL_M

Do NOT move the Solar System.

For Andromeda:

define sector 0,0,0 as a documented galaxy-local reference.

Recommended:

galaxy centre

unless a safer explicit reference point is architecturally preferable.

The important point:

Andromeda sector coordinates are ANDROMEDA-LOCAL.

They are not Solar-relative coordinates.

==================================================
PART F
ONE galaxyLocalPosition FUNCTION
==================================================

Centralize:

sector
+
offset inside sector
+
galaxy address origin

→ galaxy-centred logical position.

Something like:

galaxyLocalPositionM(
  galaxy,
  sector,
  offsetM
)

Milky Way sector 0 should produce approximately:

[-26,000 ly, 0, 0]

relative to Milky Way centre.

Andromeda sector 0:

approximately [0,0,0]

if centre-origin model is chosen.

Do not replicate these equations in:

StarSector
Map
Provider
Resolver
Materializer.

==================================================
PART G
FIX StarSector DENSITY
==================================================

Refactor:

generateStarSector()

so stellar density uses:

galaxy-local coordinates

through the new galaxy runtime/coordinate helper.

Current:

milkyWayDensity()

and:

andromedaDensity()

may remain pure density functions.

But the caller must feed them the correct GALAXY-CENTRED position.

Expected:

generateStarSector(
  'andromeda',
  sector near Andromeda disc
)

produces non-zero deterministic stars.

No implicit 2.5 Mly displacement.

==================================================
PART H
PRESERVE BIGINT IDENTITY
==================================================

Do not regress U0/U1.

Sector identity remains:

BigInt.

Do not convert BigInt to Number for:

keys
seeds
identity
neighbor comparison.

For physical density calculations:

use a bounded local conversion policy.

If a sector is too large to safely convert:

use the existing bounded density fallback.

Identity must remain exact.

==================================================
PART I
GALAXY DEFINITION
==================================================

Audit:

GalaxyDefinition.ts

Use existing:

LOCAL_GROUP_CATALOG

Milky Way

Andromeda

Do NOT duplicate galaxy constants.

Extend the definitions only where required to describe:

address origin
density profile
orientation
radius/diameter
central black hole
presentation metadata

Keep descriptor pure data.

==================================================
PART J
DO NOT CREATE PROCEDURAL GALAXIES
==================================================

U2 supports catalogued galaxies.

At minimum:

Milky Way
Andromeda

U4 owns arbitrary generated galaxies.

Do not turn U2 into U4.

==================================================
PART K
GENERALIZE ProceduralSystemMaterializer
==================================================

Remove:

galaxyId === 'milky_way'

restriction.

Instead require:

target galaxy has a valid GalaxyRuntime / known catalog definition

and:

target resolves through the canonical U0 catalog.

Expected:

Milky Way procedural target:
accepted

Andromeda procedural target:
accepted

unknown galaxy:
rejected

future procedural galaxy:
not yet accepted unless U4 runtime exists.

==================================================
PART L
NO DUPLICATE SYSTEM GENERATOR
==================================================

Andromeda uses the SAME:

generateStarSector()

UniversalTargetCatalog

generateSystem()

ProceduralSystemRuntime

ProceduralSystemMaterializer

pipeline.

Only:

galaxy context
density profile
seed/address

differ.

Do not create:

AndromedaSystemGenerator.ts

unless it is merely a thin profile config.

==================================================
PART M
DETERMINISTIC ANDROMEDA QA SYSTEM
==================================================

Choose a deterministic Andromeda QA fixture.

Do not invent a star ID manually.

Find a real generated sector with:

reasonable stellar density

at least one star

preferably:
at least one rocky planet

and:

one giant or moon

Use deterministic search.

Example strategy:

search a small predefined ring of sectors around an Andromeda-local
reference radius.

Pick the lexicographically first stable sector/star satisfying criteria.

Once selected:

document exact:

galaxy
sector
star ID
seed
spectral class
planet count
moon count

Tests must derive or verify this fixture through the real generator.

==================================================
PART N
DO NOT TEST AT THE EXACT SMBH HORIZON
==================================================

If Andromeda sector 0 is galaxy centre:

do not place the QA player at the exact M31 SMBH.

Choose a sector in the disc at a sensible radius.

Example order of magnitude:

several kpc from galactic centre

not:

0 pc.

The central black hole remains targetable separately.

==================================================
PART O
CREATE GalaxySession / GalaxyMaterializer
==================================================

U1 already has:

ProceduralSystemMaterializer.

Do NOT overload it with every galaxy-level concern.

Create:

GalaxySession

and/or:

GalaxyMaterializer

responsible for:

active galaxy descriptor

star-sector backdrop provider

external galaxy presentation configuration

central black-hole presentation

galaxy-level map context

preparing target system materialization

Suggested:

PreparedGalaxySession {
  galaxy
  starSectorProvider
  centralBlackHolePresentation
  localGroupPresentation
  ready
  dispose()
}

==================================================
PART P
ATOMIC GALAXY + SYSTEM INSTALL
==================================================

U2 TEST arrival to Andromeda must be coherent.

Prepare BEFORE commit:

Andromeda GalaxyRuntime

Andromeda StarSectorProvider

Andromeda central black-hole presentation

target ProceduralSystemRuntime

target dynamic body providers

target celestial visuals

reference frames

Then atomically switch:

activeGalaxy

activeSystem

UniverseAddress

player frame

render origin

providers

map context

visuals

No frame where:

address says Andromeda
but activeGalaxy says Milky Way.

No frame where:

Andromeda system is active
but StarSectorProvider still generates Milky Way.

==================================================
PART Q
ROLLBACK
==================================================

Inject failures at:

galaxy prepare

star-sector provider creation

black-hole presentation

system preparation

frame install

provider install

visual activation

Expected:

previous galaxy/system remains intact.

If switching from Solar:

Milky Way + Solar remains fully playable.

No orphan Andromeda providers.

==================================================
CONFIRMED CURRENT LIMITATION 3
StarSectorProvider GALAXY ID IS CONSTRUCTOR-STATIC
==================================================

Current:

StarSectorProvider options.galaxyId

is fixed.

U2 needs the provider to follow the active galaxy.

Preferred architecture:

one StarSectorProvider per active GalaxySession

rather than mutating one permanent provider across galaxy identities.

When galaxy changes:

dispose old active galaxy sector provider

activate prepared new provider.

==================================================
PART R
ACTIVE GALAXY STAR BACKDROP
==================================================

Inside Milky Way:

StarSectorProvider generates Milky Way sectors.

Inside Andromeda:

StarSectorProvider generates Andromeda sectors.

It must centre around:

UniverseRuntime.address.sector

of CURRENT galaxy.

Do not use Solar-sector coordinates while in Andromeda.

==================================================
PART S
NO STAR BACKDROP AUTHORITY
==================================================

Preserve U1 rule:

Points geometry is presentation only.

System physics comes from:

canonical target descriptor
+
deterministic generator.

Do not select a random rendered point by Float32 coordinate and derive
physics from it.

==================================================
PART T
EXTERNAL GALAXIES
==================================================

Current Game constructs external GalaxyProvider instances for Local Group
galaxies from the Solar/Milky-Way perspective.

Generalize this.

When activeGalaxy = Milky Way:

Andromeda may render as external galaxy.

When activeGalaxy = Andromeda:

Milky Way should render as external galaxy.

The ACTIVE galaxy itself must NOT simultaneously render as a distant
external blob around the observer.

==================================================
PART U
LOCAL GROUP PRESENTATION
==================================================

Create one clear authority for Local Group external presentation.

Suggested:

LocalGroupPresentationController

Inputs:

activeGalaxy
observer galaxy-local context
LOCAL_GROUP_CATALOG

Outputs:

bounded camera-relative galaxy proxies.

Do not place galaxies at:

2.5 million ly

in Object3D.position.

Use:

direction
angular extent
bounded presentation proxy

like celestial rendering philosophy.

==================================================
PART V
GALAXY GLOBAL DESCRIPTOR DISTANCE
==================================================

Intergalactic logical distance between:

Milky Way
Andromeda

must remain based on:

GalaxyDefinition.positionM

or equivalent catalog authority.

Changing active galaxy must not change their true logical separation.

Expected:

~2.5 million ly.

==================================================
PART W
GALAXY RELATIVE DIRECTION
==================================================

When active galaxy changes:

external galaxy direction should invert appropriately.

Example:

from Milky Way:
Andromeda is direction D

from Andromeda:
Milky Way approximately direction -D

within current descriptor orientation model.

Add test.

==================================================
CONFIRMED CURRENT LIMITATION 4
BLACK HOLE PRESENTATION ASSUMES MILKY WAY
==================================================

Current BlackHoleProvider still contains historical Milky-Way assumptions.

U2 must remove GALAXY-IDENTITY hardcoding from presentation.

But:

DO NOT add gravity.

DO NOT add event horizon capture.

DO NOT add lensing physics.

==================================================
PART X
GENERIC CENTRAL BLACK-HOLE PRESENTATION
==================================================

Central black-hole presentation should consume:

galaxy.centralBlackHole

Examples:

Milky Way:
sgra

Andromeda:
m31_smbh

When inside Milky Way:

Sgr A* belongs at Milky Way centre.

When inside Andromeda:

M31 SMBH belongs at Andromeda centre.

Do not assume:

every BH position is relative to Solar System.

==================================================
PART Y
BLACK HOLE REMAINS PRESENTATION ONLY
==================================================

Explicit status:

U2:
selectable
map marker
visual presentation
correct galaxy ownership

NOT U2:
gravity
capture
lensing
event horizon
accretion physics
wormhole
teleport.

Keep TODO/status explicit.

==================================================
PART Z
U0 TARGET KEYS MUST REMAIN STABLE
==================================================

Do not change canonical keys unnecessarily.

Existing:

galaxy/andromeda

universe/milky_way/.../black-hole/sgra

universe/andromeda/.../black-hole/m31_smbh

must remain compatible unless there is a proven bug.

Andromeda system/body targets use:

galaxyId = andromeda

sector = galaxy-local sector

systemId = generated system

bodyId = generated body.

==================================================
PART AA
ACTIVE GALAXY MAP
==================================================

Universal Map must understand:

current galaxy.

Inside Milky Way Galaxy view:

Milky Way context

Sgr A*

Milky Way procedural star sectors

Andromeda external galaxy target

Inside Andromeda Galaxy view:

Andromeda context

M31 SMBH

Andromeda procedural star sectors

Milky Way external galaxy target

No Solar-only assumption.

==================================================
PART AB
SYSTEM MAP
==================================================

Inside Andromeda generated system:

System map shows:

Andromeda generated star

its planets

its moons

Same U1 functionality.

No Solar bodies.

==================================================
PART AC
COSMOLOGY MAP
==================================================

Cosmology level still displays:

Local Group
Milky Way
Andromeda
existing larger structures.

Selecting Milky Way while inside Andromeda:

changes TARGET only.

Does NOT teleport.

==================================================
PART AD
PLAYER ADDRESS VS TARGET ADDRESS
==================================================

Example while in Andromeda:

PLAYER:

andromeda
sector QA
system QA

TARGET:

milky_way

or:

sgra

This is valid.

Do NOT overwrite player address merely because another galaxy is selected.

==================================================
PART AE
NORMAL P
==================================================

From Andromeda:

select Milky Way.

Press P.

Expected:

INTERGALACTIC TRAVEL NOT AVAILABLE YET

No teleport.

From Milky Way:

select Andromeda.

P:

same refusal.

U3 owns production intergalactic travel.

==================================================
PART AF
U2 TEST ARRIVAL
==================================================

Provide explicit DEV/QA-only action:

ENTER ANDROMEDA · U2 TEST

or equivalent.

Requirements:

only visible in explicit dev/test mode

clearly labeled TEST

selects/uses canonical Andromeda QA target

prepares GalaxySession + SystemSession

atomically installs both.

Normal gameplay P must never call this.

==================================================
PART AG
U2 RETURN TO MILKY WAY
==================================================

Provide:

RETURN TO MILKY WAY / SOL · U2 TEST

Expected:

activeGalaxy:
Milky Way

activeSystem:
SolarSystem

address:
original Solar address

player pose:
saved Solar/Manaus state

providers:
Solar

external galaxy:
Andromeda visible

central BH presentation:
Sgr A*

Manaus:
intact.

==================================================
PART AH
DO NOT NEST TEST TRANSPORT BADLY
==================================================

U1 TEST ARRIVAL inside Milky Way remains useful.

U2 test transport should not produce:

test transport → test transport → stale snapshots

with broken return behavior.

Define explicit session stack policy.

Recommended:

one saved origin session

or:

U2 test transition owns the whole cross-galaxy QA session.

Do not permit unbounded nested snapshots.

==================================================
PART AI
SYSTEM MATERIALIZER IN ANDROMEDA
==================================================

Once Andromeda galaxy session is active:

ProceduralSystemMaterializer must work normally.

Inside an active Andromeda generated system:

Tab

Shift+Tab

P autopilot

Warp B

F landing

generated moon landing

giant exclusion

all work exactly as in Milky Way U1.

==================================================
PART AJ
ANDROMEDA STAR PROFILES
==================================================

Use existing:

andromedaDensity()

for density.

Generated stars continue using the same:

mass
temperature
luminosity
spectral class

pipeline.

Do NOT create arbitrary "Andromeda stars are blue" logic.

Galaxy changes distribution/density, not fundamental star physics.

==================================================
PART AK
GALACTIC ORIENTATION
==================================================

GalaxyDefinition may already contain or need:

orientation
disc normal
inclination

Use one consistent galaxy-local coordinate system.

Do not rotate physics differently in:

map
provider
system generator

without an explicit transform.

For U2:

star-sector positions should be expressed in galaxy-local coordinates.

Global galaxy orientation affects:

external presentation

not individual system local physics.

==================================================
PART AL
ANDROMEDA SCALE
==================================================

Preserve existing physical descriptor:

Andromeda diameter roughly:
220,000 ly

distance:
~2.5 million ly

Do NOT scale physical logical dimensions to make the map prettier.

Map/render presentation may use normalized display coordinates.

==================================================
PART AM
GALAXY BOUNDS
==================================================

Define a generation support radius/extent based on galaxy descriptor.

Do not generate dense star sectors infinitely.

Outside reasonable galaxy extent:

density approaches zero

or halo fallback.

No hard cut causing obvious walls unless documented.

==================================================
PART AN
DENSITY SANITY TESTS
==================================================

For Milky Way:

Solar neighbourhood density remains approximately baseline.

Towards centre:
higher.

Far above disc:
lower.

For Andromeda:

centre/disc:
non-zero / high.

far outside:
low.

No NaN.

No negative values.

No 2.5 Mly accidental suppression.

==================================================
PART AO
STAR COUNTS
==================================================

Do not accidentally request thousands of stars in every central sector and
blow streaming.

Existing cap remains meaningful.

If Andromeda centre density exceeds cap:

report capped count.

No unbounded allocations.

==================================================
PART AP
SECTOR SEED
==================================================

Seed must remain:

galaxyId + sector

or equivalent existing deterministic authority.

Therefore:

milky_way sector 0,0,0

and:

andromeda sector 0,0,0

must have DIFFERENT seeds/content.

Add explicit test.

==================================================
PART AQ
PROCEDURAL SYSTEM SEED
==================================================

Same:

galaxy
sector
star index

must regenerate same system.

Switch galaxies and return:

Andromeda QA system unchanged.

==================================================
PART AR
SYSTEM EPOCH
==================================================

Do not reset Andromeda orbits to zero.

Same global:

UniverseRuntime.time

drives current active system.

Leave Andromeda.

Time advances.

Return.

Bodies appear at positions corresponding to global epoch.

==================================================
PART AS
PROVIDER LIFECYCLE
==================================================

On Milky Way → Andromeda:

retire/dispose:

Milky Way active StarSectorProvider

Milky Way procedural system providers if any

active system dynamic visuals

activate:

Andromeda provider

Andromeda system visuals/providers

But preserve permanent curated Solar infrastructure for return.

==================================================
PART AT
EXTERNAL GALAXY LIFECYCLE
==================================================

External Local Group visuals should be bounded.

Do not instantiate duplicate GalaxyProvider every transition.

Either:

reuse a bounded provider set and update active galaxy context

or:

cleanly dispose/recreate small known set.

No leaking geometries per switch.

==================================================
PART AU
CENTRAL BH PROVIDER LIFECYCLE
==================================================

Only active/relevant galaxy central black-hole visual should be active as
local galactic-centre presentation.

External galaxy SMBH does not need a separate detailed visual at millions
of light years.

Map target may still exist.

==================================================
PART AV
NO BLACK HOLE AT WRONG LOCATION
==================================================

Inside Andromeda:

M31 SMBH position must be relative to Andromeda galaxy centre.

Sgr A* must NOT appear 26 kly from the player as though Andromeda were the
Milky Way.

This is a mandatory regression.

==================================================
PART AW
GALAXY LABELS
==================================================

External galaxy labels:

Andromeda
Milky Way

must switch correctly.

Do not display:

Andromeda

on the active galaxy's own distant proxy.

==================================================
PART AX
HUD
==================================================

Add clear current-location diagnostics:

GALAXY:
Andromeda

SYSTEM:
PX-...

SECTOR:
...

NEAREST BODY:
...

Target may independently say:

Milky Way
GALAXY
2.5 Mly

No ambiguity between:

CURRENT GALAXY

and:

TARGET GALAXY.

==================================================
PART AY
F3
==================================================

Add:

ACTIVE GALAXY · ID

ACTIVE GALAXY · Name

ACTIVE GALAXY · Address origin

ACTIVE GALAXY · Density profile

ACTIVE GALAXY · Current sector

ACTIVE GALAXY · Current local galactocentric XYZ

ACTIVE GALAXY · Star sector provider

ACTIVE GALAXY · Resident sectors

ACTIVE GALAXY · External galaxies

ACTIVE GALAXY · Central black hole

ACTIVE GALAXY · Galaxy session generation

ACTIVE GALAXY · QA transition mode

Keep U0/U1 diagnostics.

==================================================
PART AZ
GALACTOCENTRIC POSITION
==================================================

F3 may show galaxy-local position in:

ly
kly

rather than huge metres.

But logical calculations remain real metres where representable.

Do not derive this from rendered star cloud positions.

==================================================
PART BA
RENDER PRECISION
==================================================

No Object3D may receive:

kpc
Mly

absolute coordinates.

External galaxies:

bounded camera-relative representation.

Star sectors:

existing normalized/backdrop representation.

Active star system:

real local metres + RenderSpaceService.

==================================================
PART BB
FLOATING ORIGIN
==================================================

Rebase inside Andromeda.

Expected:

activeGalaxy unchanged

sector unchanged

system unchanged

target unchanged

galaxy-local coordinates unchanged

body orbits unchanged.

==================================================
PART BC
LOCAL GALAXY SECTOR CROSSING
==================================================

U2 is NOT implementing manual continuous star-to-star travel.

Do not increment sectors because player flew past a local system boundary.

U1 rule remains:

INTERSTELLAR HYPERCRUISE REQUIRED.

U3 owns sector travel.

==================================================
PART BD
NO U3 SPEED
==================================================

Do NOT add:

1024c
1,000,000c
2.5 Mly in 10 seconds
warp tunnel
spool
intergalactic cruise
arrival corridor.

U3 next.

==================================================
PART BE
NO GALAXY TELEPORT IN PRODUCTION
==================================================

Only explicit:

U2 TEST

may switch galaxies instantly.

Release gameplay path remains locked.

==================================================
PART BF
BLACK-HOLE TARGETS
==================================================

Inside Andromeda:

M31 SMBH

must resolve:

valid = true

materialized/presentation available where appropriate

galaxyId = andromeda

kind = black-hole.

Inside Milky Way:

Sgr A*

same.

Selecting the other galaxy's BH is allowed logically but remains remote.

==================================================
PART BG
BLACK-HOLE DISTANCE
==================================================

Within active galaxy:

central BH distance may use galaxy-local player/system position.

Cross-galaxy BH:

distance must include intergalactic galaxy displacement.

Do NOT subtract two unrelated system local vectors directly.

==================================================
PART BH
DISTANCE COMPOSITION
==================================================

Create one logical resolver capable of:

same system:
system-frame distance

same galaxy / different sector:
sector + offset distance

different galaxy:
galaxy global displacement
+
galaxy-local offsets

Avoid mixing frames.

Document the approximation assumptions.

==================================================
PART BI
ANDROMEDA → MILKY WAY DISTANCE
==================================================

Expected approximately symmetric:

distance(
  observer Milky Way,
  Andromeda
)

≈

distance(
  observer Andromeda,
  Milky Way
)

within player-local offset differences.

No order-of-magnitude change due to address-origin semantics.

==================================================
PART BJ
M31 SMBH TARGET DISTANCE
==================================================

Inside Andromeda QA system:

distance to M31 SMBH should be:

galactocentric distance of the QA system/player

not:

~2.5 Mly.

Because M31 SMBH belongs to the CURRENT galaxy centre.

This is a critical test.

==================================================
PART BK
Sgr A* DISTANCE FROM ANDROMEDA
==================================================

Inside Andromeda:

Sgr A* should be roughly intergalactic distance away.

It must NOT show:

26 kly.

==================================================
PART BL
Sgr A* DISTANCE FROM SOLAR
==================================================

Return Solar.

Sgr A* should again be approximately:

26 kly

from Solar neighbourhood.

Preserve U0 behavior.

==================================================
PART BM
MAP GALAXY HIERARCHY
==================================================

When current galaxy is Andromeda:

Galaxy level should make clear:

Andromeda
[current]

M31 SMBH

generated sector/system targets

Milky Way
[external]

No duplicated Andromeda external marker.

==================================================
PART BN
CURRENT GALAXY MARKER
==================================================

Cosmology/Local Group map may show active galaxy highlighted.

This is presentation only.

Do not mutate target automatically.

==================================================
PART BO
TEST FIXTURE SEARCH
==================================================

Implement deterministic helper for QA only:

findAndromedaU2Fixture()

or test utility.

Requirements:

bounded search

deterministic order

no Math.random

find:

sector in meaningful Andromeda disc

star with >=1 planet

prefer rocky landable planet.

Do not perform large galaxy scans on game startup.

Fixture may be documented and then cached as a constant once verified.

==================================================
PART BP
DO NOT GENERATE BILLIONS OF STARS
==================================================

All generation remains:

sector-on-demand.

Never enumerate a whole galaxy.

Never enumerate all stars in Andromeda.

==================================================
PART BQ
GALAXY RUNTIME CACHE
==================================================

Known catalog has only a small number now.

Still keep lifecycle explicit.

Suggested:

Milky Way runtime permanent

one active non-MW runtime

or bounded cache <=2.

Do not retain arbitrary future galaxy sessions forever.

==================================================
PART BR
SYSTEM SESSION CACHE
==================================================

Keep U1:

only one active generated system.

Changing galaxy must fully unload old generated system runtime/resources.

Descriptors may stay in bounded U0 cache.

==================================================
PART BS
MANAUS / EARTH REGRESSION
==================================================

After Andromeda round trip:

return to Solar Earth.

Verify:

Manaus local
Manaus aerial
Rio Negro
Encontro das Águas
EarthGlobe
trees/water mask
local physics

unchanged.

==================================================
PART BT
SOLAR REGRESSION
==================================================

Verify after roundtrip:

Sun
Moon
Mars
Jupiter
Solar-12 moons

Tab
P
Warp
landing

remain functional.

==================================================
PART BU
U1 REGRESSION
==================================================

Milky Way procedural fixture:

U1 TEST arrival

must still work.

Andromeda support must not break:

system materializer
dynamic visuals
rocky landing
moon landing
gas giant refusal
revisit determinism.

==================================================
PART BV
D1 REGRESSION
==================================================

No changes to:

D1
D1.1
D1.2

Generated procedural bodies still:

supportsVolumeDestruction = false.

==================================================
PART BW
SUN REGRESSION
==================================================

Preserve:

physical photosphere collision boundary

100 km CCD margin

0.03R navigation margin

procedural Sun material

C4 behavior.

Generated stars may use generalized SunVisual presentation but do not
alter Solar-specific tested behavior.

==================================================
PART BX
MANDATORY TESTS
==================================================

Add at minimum:

T_U2_GALAXY_RUNTIME_MILKY_WAY

T_U2_GALAXY_RUNTIME_ANDROMEDA

T_U2_ACTIVE_GALAXY_MATCHES_ADDRESS

T_U2_MW_SECTOR_ZERO_REMAINS_SOLAR_NEIGHBORHOOD

T_U2_ANDROMEDA_SECTOR_ZERO_GALAXY_LOCAL

T_U2_GALAXY_LOCAL_POSITION_SHARED_AUTHORITY

T_U2_MW_DENSITY_SOLAR_BASELINE

T_U2_MW_DENSITY_CENTRE_HIGHER

T_U2_ANDROMEDA_DENSITY_CENTRE_NONZERO

T_U2_ANDROMEDA_DENSITY_DISC_NONZERO

T_U2_ANDROMEDA_DENSITY_FAR_LOW

T_U2_NO_ANDROMEDA_2_5MLY_DENSITY_OFFSET

T_U2_SAME_SECTOR_DIFFERENT_GALAXY_DIFFERENT_SEED

T_U2_ANDROMEDA_SECTOR_DETERMINISTIC

T_U2_ANDROMEDA_SYSTEM_DETERMINISTIC

T_U2_ANDROMEDA_PLANET_DETERMINISTIC

T_U2_MATERIALIZER_ACCEPTS_ANDROMEDA

T_U2_MATERIALIZER_REJECTS_UNKNOWN_GALAXY

T_U2_GALAXY_PREPARES_BEFORE_INSTALL

T_U2_ATOMIC_GALAXY_SYSTEM_INSTALL

T_U2_FAILED_GALAXY_INSTALL_PRESERVES_MILKY_WAY

T_U2_ACTIVE_SYSTEM_ANDROMEDA

T_U2_PLAYER_ADDRESS_ANDROMEDA

T_U2_PLAYER_FRAME_ANDROMEDA_SYSTEM

T_U2_STAR_SECTOR_PROVIDER_SWITCHES_GALAXY

T_U2_MW_PROVIDER_RETIRES

T_U2_ANDROMEDA_PROVIDER_ACTIVATES

T_U2_ACTIVE_GALAXY_NOT_RENDERED_AS_EXTERNAL

T_U2_OTHER_GALAXY_RENDERED_EXTERNAL

T_U2_EXTERNAL_DIRECTION_REVERSES

T_U2_M31_BLACK_HOLE_CURRENT_GALAXY

T_U2_SGRA_NOT_LOCAL_IN_ANDROMEDA

T_U2_M31_DISTANCE_GALACTOCENTRIC

T_U2_SGRA_DISTANCE_INTERGALACTIC_FROM_ANDROMEDA

T_U2_SGRA_DISTANCE_26KLY_FROM_SOLAR

T_U2_MW_ANDROMEDA_DISTANCE_SYMMETRIC

T_U2_TARGET_KEYS_STABLE

T_U2_TARGET_SELECTION_DOES_NOT_MOVE_PLAYER

T_U2_NORMAL_P_DOES_NOT_INTERGALACTIC_TELEPORT

T_U2_TEST_ARRIVAL_ANDROMEDA

T_U2_ANDROMEDA_TAB

T_U2_ANDROMEDA_SHIFT_TAB

T_U2_ANDROMEDA_P_AUTOPILOT

T_U2_ANDROMEDA_WARP

T_U2_ANDROMEDA_ROCKY_LANDING

T_U2_ANDROMEDA_MOON_LANDING

T_U2_ANDROMEDA_GIANT_NO_LANDING

T_U2_ANDROMEDA_FLOATING_ORIGIN

T_U2_ANDROMEDA_GLOBAL_EPOCH

T_U2_ANDROMEDA_UNLOAD

T_U2_ANDROMEDA_REVISIT_SAME_SYSTEM

T_U2_RETURN_TO_MILKY_WAY

T_U2_SOLAR_PROVIDER_RESTORE

T_U2_SOLAR_VISUAL_RESTORE

T_U2_MANAUS_REGRESSION

T_U2_U1_MILKY_WAY_PROCEDURAL_REGRESSION

T_U2_BIGINT_IDENTITY

T_U2_NO_ASTRONOMICAL_OBJECT3D_POSITION

T_U2_NO_MATH_RANDOM

==================================================
PART BY
BROWSER U2 CHECKPOINT
==================================================

Create/extend existing browser infrastructure.

Do NOT add another browser framework.

Flow:

1.
Start Manaus.

Assert:

active galaxy:
Milky Way

active system:
Sol

2.
Open map.

Select Andromeda.

Expected:

target:
Andromeda
GALAXY
~2.5 Mly

No movement.

3.
Press P.

Expected:

intergalactic travel unavailable

NO teleport.

4.
Enable explicit U2 test control.

Invoke:

ENTER ANDROMEDA · U2 TEST.

5.
Wait for atomic preparation.

Assert:

activeGalaxy = andromeda

address.galaxyId = andromeda

activeSystem = ProceduralSystemRuntime

system frame = generated Andromeda system

6.
Look around.

Expected:

generated Andromeda star
generated planets
generated moons

Milky Way visible only as distant external galaxy presentation.

Andromeda itself NOT visible as distant blob.

7.
Open Galaxy map.

Expected:

Andromeda current

M31 SMBH available

Milky Way external target.

8.
Select M31 SMBH.

Expected:

black-hole
galaxy Andromeda

distance:
galactocentric, not 2.5 Mly.

9.
Select Sgr A*.

Expected:

remote black-hole
Milky Way
roughly intergalactic distance.

10.
Select generated Andromeda rocky planet.

P.

Expected:

normal intra-system autopilot.

11.
Warp B.

Expected:

same intra-system Warp.

12.
Land using F.

Expected:

synthetic terrain
local ENU
Grounded
walk

13.
Take off.

14.
Land on generated solid moon if fixture has one.

15.
Approach gas/ice giant.

Expected:
no landing.

16.
Trigger floating-origin rebase.

Expected:
galaxy/system/target stable.

17.
Return:

U2 TEST RETURN TO MILKY WAY.

18.
Expected:

activeGalaxy Milky Way

activeSystem SolarSystem

Manaus/Earth restored.

19.
Select Sgr A*.

Expected:
~26 kly.

20.
Re-enter same Andromeda fixture.

Expected:

same:
star
planets
moons
profiles
orbits according to current global epoch.

21.
zero page errors
zero console errors.

==================================================
PART BZ
VISUAL QA
==================================================

Capture ignored screenshots:

Milky Way external from Andromeda

Andromeda system star

Andromeda galaxy map

M31 SMBH presentation

Andromeda generated rocky planet

Andromeda moon

Andromeda gas giant

return to Milky Way.

Do not commit screenshots.

Check:

no duplicate galaxies

no galaxy at giant Object3D coordinates

no Andromeda blob while inside Andromeda

Milky Way external visible plausibly

M31 central BH belongs to Andromeda

generated star systems visually same quality as U1.

==================================================
PART CA
PERFORMANCE
==================================================

Measure:

GalaxyRuntime create

GalaxySession prepare

StarSectorProvider prepare

external galaxy presentation switch

central BH presentation switch

Andromeda system prepare

atomic install

galaxy unload

return to Solar

resident sector count

provider count

visual count

renderer geometry count

memory before
during
after

No arbitrary timing threshold.

==================================================
PART CB
MEMORY / LEAK
==================================================

Repeat:

Milky Way
→ Andromeda
→ Milky Way
→ Andromeda
→ Milky Way

at least 5 cycles in automated lifecycle test.

Expected:

no monotonically growing:

providers
frames
dynamic planet visuals
StarSectorProvider meshes
GalaxyProvider meshes
black-hole presentation meshes.

Descriptor caches may remain within documented bounds.

==================================================
PART CC
F3 MANUAL GATE
==================================================

Inside Andromeda F3 must NOT contain misleading:

ACTIVE GALAXY Milky Way

system sol

solar-system/barycentric

except diagnostic references explicitly describing the remote Solar system.

Expected:

ACTIVE GALAXY:
andromeda

ACTIVE SYSTEM:
generated Andromeda system

SYSTEM FRAME:
system/<andromeda-star>

CURRENT SECTOR:
Andromeda-local

CENTRAL BLACK HOLE:
m31_smbh.

==================================================
PART CD
DOCUMENTATION
==================================================

Create:

docs/world/28-status-U2-GALAXY-RUNTIME-ANDROMEDA.md

Update:

docs/world/11-galaxy-and-universe.md

docs/world/universal-map.md

docs/world/15-status.md

specs/UNIVERSE-MAP-COMPLETION-EPIC.md

specs/Promptatual.md

Document clearly:

old mixed coordinate problem

new GalaxyRuntime

galaxy address-origin semantics

Milky Way sector-zero legacy preservation

Andromeda local sector semantics

GalaxySession lifecycle

Andromeda QA fixture

external galaxy presentation

central BH ownership

distance resolution

test-only Andromeda arrival

remaining U3 work.

==================================================
PART CE
COMMIT DISCIPLINE
==================================================

Prefer approximately:

feat(galaxy): add active galaxy runtime and local sector coordinates

refactor(universe): make procedural system materialization galaxy-generic

feat(render): switch local-group and central-black-hole presentation by active galaxy

feat(map): expose active Andromeda galaxy context and hierarchy

test(universe): validate Andromeda lifecycle, distances and roundtrip

docs(universe): close U2 Galaxy Runtime and Andromeda

Do not commit:

screenshots
browser artifacts
logs
generated star dumps
workspace files
temporary JSON.

==================================================
PART CF
RUN
==================================================

npm run typecheck

Focused tests:

GalaxyDefinition
GalaxyRuntime
StarSector
UniverseAddress
UniversalTargetCatalog
UniversalTargetResolver
ProceduralSystemMaterializer
ProceduralSystemRuntime
StarSectorProvider
GalaxyProvider
BlackHoleProvider
CelestialPresentation
UniversalMap
CosmicFlight
PlanetaryLanding
U1
U2

Then:

npm test

npm run build

npm run test:browser:space

npm run test:browser

npm run test:browser:manaus

run U2 browser checkpoint

git diff --check

After push:

inspect GitHub Actions on EXACT FINAL SHA.

==================================================
MANUAL ACCEPTANCE
==================================================

User manually validates:

Start in Manaus.

Open map.

Select Andromeda.

Confirm:
~2.5 Mly.

Press P.

Confirm:
NO teleport.

Use U2 TEST arrival.

Observe:
actual Andromeda system.

Check:
generated star
planets
moons.

Open Galaxy map.

Check:
Andromeda current.
M31 SMBH central.
Milky Way distant.

Select M31 SMBH.

Check:
distance is within Andromeda galaxy scale,
NOT 2.5 Mly.

Fly between generated planets.

Land on rocky planet.

Land on moon.

Verify giant refusal.

Return to Milky Way.

Check:
Manaus/Solar intact.

Re-enter Andromeda.

Check:
same generated system.

==================================================
FINAL REPORT
==================================================

Report:

INITIAL HEAD

FINAL HEAD

COMMITS

OLD GALAXY COORDINATE MODEL

NEW GALAXY COORDINATE MODEL

GalaxyRuntime DESIGN

MILKY WAY ADDRESS ORIGIN

ANDROMEDA ADDRESS ORIGIN

MILKY WAY SECTOR ZERO POSITION

ANDROMEDA SECTOR ZERO POSITION

MILKY WAY DENSITY RESULTS

ANDROMEDA DENSITY RESULTS

ANDROMEDA QA SECTOR

ANDROMEDA QA STAR

STAR CLASS

PLANETS

MOONS

LANDABLE BODIES

ACTIVE GALAXY INSTALL

ACTIVE SYSTEM INSTALL

GALAXY SESSION ATOMICITY

ROLLBACK RESULT

STAR SECTOR PROVIDER SWITCH

EXTERNAL GALAXY PRESENTATION

MILKY WAY VIEW FROM ANDROMEDA

ANDROMEDA VIEW FROM MILKY WAY

M31 SMBH OWNERSHIP

SGR A* OWNERSHIP

M31 DISTANCE FROM QA SYSTEM

SGR A* DISTANCE FROM ANDROMEDA

SGR A* DISTANCE FROM SOLAR

MILKY WAY ↔ ANDROMEDA DISTANCE

TARGET KEY REGRESSION

NORMAL P CROSS-GALAXY RESULT

U2 TEST ARRIVAL RESULT

ANDROMEDA TAB RESULT

ANDROMEDA P AUTOPILOT RESULT

ANDROMEDA WARP RESULT

ROCKY LANDING RESULT

MOON LANDING RESULT

GIANT RESULT

FLOATING ORIGIN RESULT

GLOBAL EPOCH RESULT

ANDROMEDA REVISIT RESULT

RETURN TO SOLAR RESULT

MANAUS REGRESSION

U1 REGRESSION

PROVIDER COUNTS BEFORE / ANDROMEDA / AFTER

VISUAL COUNTS BEFORE / ANDROMEDA / AFTER

FRAME COUNTS BEFORE / ANDROMEDA / AFTER

MEMORY BEFORE / ANDROMEDA / AFTER

5-CYCLE LEAK RESULT

TYPECHECK

FOCUSED TESTS

FULL TESTS

BUILD

BROWSER SPACE

BROWSER LOCAL

BROWSER MANAUS

BROWSER U2

DIFF CHECK

GITHUB ACTIONS EXACT FINAL SHA

AUTOMATICALLY VERIFIED

REQUIRES USER MANUAL VALIDATION

Then STOP.

DO NOT START U3 AUTOMATICALLY.

DO NOT IMPLEMENT INTERGALACTIC HYPERCRUISE.

DO NOT IMPLEMENT PROCEDURAL GALAXIES.

DO NOT IMPLEMENT BLACK-HOLE GRAVITY.
```

Depois desse U2, o próximo é o mais importante visualmente para o que você quer: **U3**, onde finalmente deixamos de usar transporte de teste e implementamos a viagem real entre sistemas e entre a Via Láctea e Andrômeda em segundos, mantendo os ~2,5 milhões de anos-luz como distância lógica real.