Chequei o baseline antes de montar. O HEAD continua em `c651abb77c8142244064a1aa4d50504bdfdb9f63`, então o próximo checkpoint pode partir exatamente dali.

Tem alguns detalhes importantes que o U1 precisa resolver e que não estavam explícitos no roadmap: hoje `CelestialBodyVisualLayer` só cria visuais para `SOLAR_SYSTEM_BODIES`, o código identifica o Sol literalmente por `bodyId === 'sun'`, `Game.planetProviders` é criado uma vez para o Sistema Solar, o departure ainda usa `'solar-system/barycentric'` e `systemId: 'sol'`, e `ProceduralSystemRuntime.registerFrames()` não atualiza depois as origens dos frames conforme as órbitas avançam. Se não corrigirmos isso, o sistema procedural pode existir logicamente mas ficar invisível ou incoerente.

Mande este prompt:

```text
STOP ALL WORK OUTSIDE THIS CHECKPOINT.

Repository:
PauloSoaf/Dr-Manaus

Branch:
feat/universe-map

CURRENT AUDITED HEAD:

c651abb77c8142244064a1aa4d50504bdfdb9f63

==================================================
UNIVERSE MAP COMPLETION EPIC
SPRINT U1
PLAYABLE PROCEDURAL STAR SYSTEMS
MATERIALIZATION + STREAMING + INTRA-SYSTEM GAMEPLAY
==================================================

U0 is complete.

Current universal target authority already supports:

- Solar bodies
- procedural stars
- procedural systems
- procedural planets
- Sgr A*
- Andromeda
- M31 SMBH
- clusters/cosmic anchors

U1 now turns existing procedural star/system descriptors into REAL,
PLAYABLE, LOADABLE star systems.

==================================================
IMPORTANT ROADMAP
==================================================

CURRENT:

U0
Universal target/address
COMPLETE

NOW:

U1
Playable procedural star systems

LATER:

U2
GalaxyRuntime + Andromeda

U3
Interstellar / intergalactic hypercruise

U4
Procedural galaxies

BH0
Functional black holes

BH1
Gravity / event horizon

BH2
Black-hole traversal

U5
Full Universal Map

U6
Cosmological travel

DO NOT start U2/U3/U4/BH0.

==================================================
CURRENT EXISTING FOUNDATION
==================================================

Already present:

src/world/celestial/StarSector.ts

generateStarSector()

100 ly sectors

deterministic stars

seed from:

galaxyId + BigInt sector

GeneratedStar includes:

id
offsetM
massSolar
temperatureK
luminositySolar
spectralClass
planetCount


Already present:

src/world/celestial/SystemGenerator.ts

generateSystem()

generates:

star
2-10 planets
0-N moons
real metre radii
real metre orbital distances
deterministic circular orbits


Already present:

src/world/celestial/ProceduralSystemRuntime.ts

implements:

CelestialSystemRuntime

positionOf()
stateOf()
dominantBody()
handoff()
registerFrames()
speedOf()


Already present:

U0 UniversalTargetCatalog

proceduralDescriptor()

proceduralTarget()

stable:

galaxy
sector
system
body

identity.

USE ALL OF THIS.

DO NOT create a second procedural universe generator.

==================================================
PRIMARY GOAL
==================================================

At the end of U1:

A deterministic generated star can be selected.

Its system can be MATERIALIZED.

UniverseRuntime.activeSystem becomes:

ProceduralSystemRuntime

The procedural system becomes a real active simulation with:

- visible generated star
- visible generated planets
- visible generated moons
- working orbital positions
- working target lock
- working Tab cycling
- working intra-system flight
- working P autopilot between bodies INSIDE that active generated system
- rocky procedural planets that are explicitly classified as landable can be approached/landed
- gas giants remain non-landable
- leaving/unloading system removes its providers/visuals
- returning regenerates EXACTLY the same system

No repository data grows with number of visited systems.

==================================================
CRITICAL DISTINCTION
==================================================

U1 implements:

PLAYABILITY INSIDE a procedural system.

U1 DOES NOT implement:

TRAVEL BETWEEN star systems.

Cross-system movement belongs to:

U3 HYPERCRUISE.

Therefore:

Solar → procedural star

must NOT suddenly gain million-c travel.

For U1 validation, provide a clearly isolated:

developer/test arrival path

or controlled system materialization fixture.

Production P key from Solar to an unloaded procedural star remains unavailable.

==================================================
FIRST
VERIFY BASELINE
==================================================

Run:

git status
git branch --show-current
git log -1 --oneline

Report INITIAL HEAD.

Then inspect current implementations.

At minimum:

src/world/celestial/
  CelestialBody.ts
  CelestialBodyProfile.ts
  CelestialSystemRuntime.ts
  SolarSystem.ts
  StarSector.ts
  SystemGenerator.ts
  ProceduralSystemRuntime.ts

src/world/runtime/
  UniverseRuntime.ts

src/world/travel/
  NavigationLock.ts
  UniversalNavigationTarget.ts
  UniversalTargetCatalog.ts
  UniversalTargetResolver.ts
  CosmicFlight.ts
  BodyNavigation.ts
  TravelDomain.ts
  PlanetaryLanding.ts
  LandingCapture.ts

src/rendering/celestial/
  CelestialPresentationController.ts
  CelestialBodyVisualLayer.ts
  SunVisual.ts
  PlanetVisual.ts
  CelestialLabelLayer.ts

src/world/providers/
  PlanetProviderRegistry.ts
  RockyPlanetProvider.ts
  StarSectorProvider.ts
  ProviderRegistry.ts

src/world/planet/
  BodySurfaceFactory.ts
  PlanetBodyAdapter.ts
  PlanetTerrainProvider.ts

src/game/Game.ts

src/ui/
  HUD.ts

src/ui/map/
  UniversalMapPanel.ts
  MapRenderers.ts

==================================================
CONFIRMED CURRENT PROBLEM 1
PROCEDURAL VISUALS ARE NOT REALLY DYNAMIC
==================================================

Current:

CelestialBodyVisualLayer

pre-creates visuals only for:

SOLAR_SYSTEM_BODIES

and uses:

if (sample.bodyId === 'sun')

to identify the stellar visual.

Therefore a generated star such as:

milky_way/17,-2,4/3

will NOT naturally render as SunVisual.

Generated planets also do not have entries in:

this.planets

because that map was created from Solar bodies only.

Fix this.

==================================================
PART A
MAKE CELESTIAL VISUALS RUNTIME-DYNAMIC
==================================================

CelestialBodyVisualLayer must consume the ACTIVE SYSTEM dynamically.

Do not preallocate presentation identity solely from:

SOLAR_SYSTEM_BODIES.

Required:

star presentation selected by:

profile.bodyClass === 'star'

NOT:

bodyId === 'sun'

Generated star:

must render with SunVisual-equivalent stellar presentation.

Generated planets/moons:

must receive PlanetVisual instances dynamically.

Suggested architecture:

Map<bodyId, PlanetVisual>

Map<bodyId, SunVisual>

or one active star visual if the active system contract guarantees one root star.

Create on demand.

Dispose when system is uninstalled.

No memory leak across visited systems.

==================================================
PART B
VISUAL CACHE LIFECYCLE
==================================================

When changing systems:

old procedural visual instances

must be:

hidden
removed
disposed

unless deliberately retained in a bounded reusable cache.

Do not retain one PlanetVisual forever for every planet ever visited.

Report:

visual count before
during
after unload.

==================================================
CONFIRMED CURRENT PROBLEM 2
UNKNOWN PROCEDURAL BODIES HAVE NO REAL PROFILE
==================================================

Current:

bodyProfile(body)

does:

known Solar ID
→ Solar profile

unknown root body
→ star

unknown child body
→ UNKNOWN_PROFILE

UNKNOWN_PROFILE currently:

canLand = false
supportsVolumeDestruction = false
surfaceKind = none

Therefore every generated planet/moon currently effectively becomes:

generic non-landable proxy.

This is insufficient for U1.

==================================================
PART C
ADD DETERMINISTIC PROCEDURAL BODY CLASSIFICATION
==================================================

Do NOT classify procedural planets by parsing their names.

The classification must be generated from the SAME deterministic system seed.

Extend procedural system data cleanly.

Suggested:

interface ProceduralBodyDescriptor {
  body: CelestialBody
  bodyClass:
    | 'star'
    | 'rocky'
    | 'gas-giant'
    | 'ice-giant'
    | 'rocky-moon'
    | 'icy-moon'

  hasSolidSurface: boolean
  canLand: boolean
  hasAtmosphere: boolean

  visual:
    deterministic albedo/profile info
}

or an equivalent clean sidecar.

Do not create random presentation values every load.

Same system seed
→ same class
→ same colours
→ same capabilities.

==================================================
PART D
DO NOT DUPLICATE SOLAR PROFILE AUTHORITY
==================================================

Solar bodies continue using:

SOLAR_BODY_PROFILES.

Procedural bodies use generated profile metadata.

Introduce a single resolver concept such as:

resolveBodyProfile(system, body)

or:

SystemBodyProfileResolver.

Do not scatter:

if procedural...

across rendering, collision, landing and providers.

==================================================
PART E
PROCEDURAL STAR
==================================================

Generated root star must use:

bodyClass = star

hasSolidSurface = false

canLand = false

supportsVolumeDestruction = false

surfaceKind = none

Visual properties should derive deterministically from:

GeneratedStar.temperatureK
luminositySolar
spectralClass

Use plausible colour/brightness differences.

Examples:

M/K:
warmer / redder

G:
Sun-like

A/B/O:
white/blue

Do NOT make every generated star yellow.

==================================================
PART F
ROCKY PROCEDURAL PLANETS
==================================================

Some generated planets should be:

rocky
solid
landable

Use:

surfaceKind = synthetic-base

for U1.

That means:

real ellipsoid
synthetic surface
no fake claim of real geography

Allow:

approach
surface handoff
local ENU
terrain collision
standing on surface

Do NOT generate cities/vegetation in U1.

==================================================
PART G
GAS / ICE GIANTS
==================================================

Procedural gas giant:

hasSolidSurface = false
canLand = false

Use existing giant arrival/exclusion policy.

Do NOT give gas giant a fake rocky floor.

Procedural ice giant similarly non-landable.

==================================================
PART H
PROCEDURAL MOONS
==================================================

At least some moons should be:

solid
landable

with:

synthetic-base surface

Others may remain non-landable proxies if classification says so.

Keep deterministic.

==================================================
PART I
VOLUME DESTRUCTION
==================================================

DO NOT automatically enable D1 planetary-volume destruction on generated planets in U1.

For generated solid planets in U1:

supportsVolumeDestruction = false

unless the current D1 pipeline can be proven fully body/profile-generic with zero additional scope.

Landing/playability is required.

Procedural destruction can be a later explicit integration.

Do not accidentally open D2 again.

==================================================
CONFIRMED CURRENT PROBLEM 3
ProceduralSystemRuntime FRAME POSITIONS GO STALE
==================================================

Current:

ProceduralSystemRuntime.registerFrames()

registers:

originInParent = current body position

BUT:

ProceduralSystemRuntime.update()

updates `states`

and does NOT update the already-registered frame graph.

SolarSystem DOES update registered frame origins each update.

Once a procedural system becomes playable this becomes a real bug.

==================================================
PART J
FIX PROCEDURAL FRAME UPDATES
==================================================

ProceduralSystemRuntime must mirror the SolarSystem contract.

Store:

frameGraph?

When registerFrames(graph):

remember graph.

On every:

update(epochS)

after states resolve:

update each registered body frame's:

originInParent

and orientation if required.

No stale orbit frames.

Add regression:

planet moves in system coordinates

frame graph conversion moves by exactly the same logical displacement.

==================================================
PART K
EXPOSE SYSTEM FRAME AUTHORITY
==================================================

Current Solar code hardcodes:

SOLAR_SYSTEM_FRAME =
'solar-system/barycentric'

Procedural runtime uses:

system/${starId}

But CelestialSystemRuntime has no common:

systemFrameId.

Add one.

Suggested:

interface CelestialSystemRuntime {
  readonly systemFrameId: string
  ...
}

Solar:

systemFrameId =
SOLAR_SYSTEM_FRAME

Procedural:

systemFrameId =
`system/${system.starId}`

Then replace gameplay places that incorrectly assume:

'solar-system/barycentric'

when they really mean:

current active system frame.

==================================================
PART L
DO NOT BLINDLY REPLACE ALL SOLAR FRAME USES
==================================================

Some code genuinely refers to the physical Solar barycentric frame.

Only replace uses representing:

ACTIVE SYSTEM SPACE.

Audit each hardcoded reference.

Do not rename physical Solar constants globally.

==================================================
CONFIRMED CURRENT PROBLEM 4
TRAVEL DEPARTURE IS HARDCODED TO SOL
==================================================

Current Game transition includes:

convertPosition(
  player.frame,
  'solar-system/barycentric',
  ...
)

and:

travelDomain.setState({
  systemId: 'sol',
  ...
})

This prevents a procedural system from using normal intra-system flight.

==================================================
PART M
GENERALIZE INTRA-SYSTEM TRAVEL
==================================================

When leaving a planet in any active system:

convert into:

activeSystem.systemFrameId

and store:

UniverseRuntime.address.systemId

not literal:

sol.

TravelDomain state should represent:

current active system.

Solar behavior must remain unchanged.

==================================================
PART N
GENERALIZE CURRENT "SOLAR AUTOPILOT"
==================================================

U0 currently has:

solarTargetBodyId()
solarNavigationTarget()

These intentionally reject procedural systems.

U1 should introduce a generic:

activeSystemTargetBodyId()

or:

intraSystemNavigationTarget()

Rule:

target.kind === body

target address matches:

player galaxy
player sector
active systemId

target body exists in activeSystem

Then current:

CosmicFlight

may be reused INSIDE that active system.

==================================================
PART O
DO NOT MAKE CosmicFlight CROSS SYSTEMS
==================================================

CosmicFlight still operates in one active:

CelestialSystemRuntime.

It can now fly:

generated planet A
→ generated planet B

but NOT:

Solar System
→ another star.

No sector crossing through CosmicFlight.

U3 owns that.

==================================================
PART P
TRAVEL CAPABILITY
==================================================

Update U0 capability semantics.

Current procedural bodies remain:

interstellar-future

even when they are materialized inside the active procedural system.

That is now wrong.

Introduce a capability such as:

'intra-system'

or generalize existing:

'solar'

to:

'system'

while preserving compatibility labels.

Expected:

Mars while in Sol:
INTRA-SYSTEM AVAILABLE

Generated planet while inside its own generated system:
INTRA-SYSTEM AVAILABLE

Generated planet in another unloaded system:
INTERSTELLAR-FUTURE

Andromeda:
INTERGALACTIC-FUTURE

==================================================
PART Q
MATERIALIZATION SERVICE
==================================================

Create an explicit system lifecycle.

Suggested:

src/world/runtime/ProceduralSystemMaterializer.ts

or:

SystemMaterializationService.

Responsibilities:

resolve U0 system/star target

obtain canonical ProceduralTargetDescriptor

create ProceduralSystemRuntime

prepare frames

prepare provider/profile set

prepare visuals

report readiness

install only when coherent

dispose/uninstall old procedural system

Do NOT put all lifecycle code directly into Game.ts.

==================================================
PART R
SYSTEM SESSION
==================================================

Suggested concept:

interface ActiveSystemSession {
  galaxyId: string
  sector: SectorIndex
  systemId: string

  runtime: CelestialSystemRuntime

  generated: boolean

  profileResolver

  providerSet

  ready: boolean

  dispose(): void
}

Solar can remain a special permanent session if useful.

Do not duplicate UniverseRuntime.activeSystem authority.

==================================================
PART S
ATOMIC SYSTEM INSTALL
==================================================

Do not change:

UniverseRuntime.activeSystem

before required new-system infrastructure is ready.

Prepare:

descriptor
runtime
frames
visual metadata
providers

Then one coherent install:

activeSystem = new runtime

address =
galaxy + sector + system

render origin/frame =
new system frame

TravelDomain =
new system

provider set =
new system

Only then expose gameplay.

No half-switched system.

==================================================
PART T
OLD SYSTEM MUST REMAIN UNTIL NEW READY
==================================================

If procedural system preparation fails:

Solar/previous system remains authoritative.

Do not leave:

activeSystem new
providers old

or:

address new
frame old.

==================================================
PART U
SYSTEM UNINSTALL
==================================================

Leaving a generated system must:

cancel intra-system autopilot

remove procedural body frames

dispose procedural planet providers

dispose dynamic visual instances

clear local terrain providers for that system

invalidate relevant streaming work

retain universal target descriptors

NOT delete deterministic identity.

==================================================
PART V
DO NOT DELETE SOLAR FRAMES
==================================================

SolarSystem remains permanently available as curated system infrastructure.

Uninstalling a procedural system must not corrupt:

Earth
Moon
Manaus
Solar frames
Sun visuals.

==================================================
PART W
CONTROLLED U1 ARRIVAL PATH
==================================================

U3 does not exist yet.

Therefore add ONE explicit non-production transport entry point for validation.

Examples:

UniverseRuntime.debugMaterializeSystem(target)

or:

dev-only map action:

"ENTRAR NO SISTEMA (U1 TESTE)"

This must be clearly marked as:

TEST/DEVELOPMENT ARRIVAL

NOT hypercruise.

It may instantaneously place the player at a safe arrival position.

Production:

P on unloaded procedural target

remains:

Viagem interestelar ainda indisponível.

==================================================
PART X
SAFE SYSTEM ARRIVAL
==================================================

Controlled U1 arrival should place player:

inside active system frame

far enough from star to avoid exclusion

near enough that system is visible

Suggested arrival:

several AU from root star

or outside outermost orbit + margin

with:

zero or safe relative velocity.

Do not spawn:

inside star
inside planet
inside exclusion envelope.

==================================================
PART Y
ADDRESS AFTER ARRIVAL
==================================================

Example:

galaxy:
milky_way

sector:
17,-2,4

systemId:
milky_way/17,-2,4/0

bodyId:
undefined

player frame:
system/<starId>

Target may remain selected.

No fake:

sol

in the address.

==================================================
PART Z
RETURN / UNLOAD TEST CONTROL
==================================================

Provide a controlled test path back to Solar.

This is not U3 travel.

It exists to validate:

install
uninstall
regenerate

Expected:

procedural runtime disposed

Solar activeSystem restored

Solar address restored

Solar visual/providers remain correct.

==================================================
PART AA
DETERMINISTIC REVISIT
==================================================

Visit procedural system A.

Record:

star ID
star mass
star radius
planet count
moon count
all body IDs
radii
masses
orbits
profiles
colours

Unload.

Regenerate from same:

galaxy
sector
starId

Expected:

BYTE/DEEP equivalent logical descriptors where applicable.

No new random values.

==================================================
PART AB
SYSTEM GENERATOR MUST MATCH GeneratedStar
==================================================

Current:

GeneratedStar includes:

massSolar
temperatureK
luminositySolar
spectralClass
planetCount

Current:

generateSystem()

generates planetCount AGAIN internally:

nextInt(2,10)

This can disagree with:

GeneratedStar.planetCount.

Fix this contract.

A generated star descriptor and its materialized system must not disagree about how many planets it owns.

Preferred:

generateSystem receives GeneratedStar descriptor

or explicit:

planetCount

and uses it.

Do not maintain two independent draws.

==================================================
PART AC
ZERO-PLANET STARS
==================================================

GeneratedStar allows:

planetCount = 0

U1 must support:

star-only systems.

Do not force 2 planets.

A system containing just the star is valid.

==================================================
PART AD
STAR PHYSICAL PROPERTIES
==================================================

Current SystemGenerator star radius uses another arbitrary random:

6.957e8 * random...

But GeneratedStar already knows:

mass
temperature
luminosity.

Generate stellar radius consistently from those values.

Use deterministic main-sequence relation or:

L = 4πR²σT⁴

relative to Solar values:

R/Rsun =
sqrt(L/Lsun) / (T/Tsun)^2

Use existing GeneratedStar values.

Do not make target-star descriptor and materialized star physically unrelated.

==================================================
PART AE
BODY NAMES
==================================================

Current generated names are raw IDs such as:

<starId>_planet_0

Keep stable IDs.

But presentation should have readable generated names.

Example:

STAR:
PX-17-2-4-03

PLANETS:
PX-17-2-4-03 b
PX-17-2-4-03 c

MOONS:
... b I
... b II

Exact naming convention may differ.

Stable ID != display name.

Do not use random names yet unless deterministic.

==================================================
PART AF
GENERATION QUALITY
==================================================

Do not attempt astrophysical simulation perfection.

But remove obvious contradictions.

At minimum:

planet orbit increases outward

moon orbit outside parent radius

mass > 0

radius > 0

rotation finite

star mass/radius consistent enough

gas giant classification agrees with generated radius/mass range

solid planet classification agrees with provider capability.

==================================================
PART AG
CURRENT StarSector BIGINT ISSUE
==================================================

Audit this carefully.

Current StarSector uses:

Number(sector.x) * SECTOR_SIZE_M

to compute galactic density position.

U0 correctly preserves BigInt target identity.

Do not regress that by making U1 materialization depend on unsafe absolute BigInt → Number conversion.

For U1 Milky Way playability:

compute galactic density/location from bounded RELATIVE sector offsets
where possible.

If an address is too distant to convert accurately:

keep identity deterministic

and use a bounded procedural density fallback.

Do not collapse neighboring >2^53 sectors.

==================================================
PART AH
DYNAMIC PLANET PROVIDERS
==================================================

Current Game has:

readonly planetProviders

created once from:

createPlanetProviders(..., universe)

while activeSystem is Solar.

This is incompatible with switching systems.

Refactor into an active-system provider registry.

Conceptually:

ActivePlanetProviderSet

which can:

install(activeSystem)
disposeCurrent()

Do NOT mutate one eternal Solar map with procedural IDs forever.

==================================================
PART AI
SOLAR PROVIDERS PRESERVED
==================================================

Solar:

EarthProvider
Moon/Mars/other rocky providers

must remain exactly functional.

Switching to procedural system and back must restore:

Moon
Mars
Earth
Manaus
volume masks
landing.

==================================================
PART AJ
PROCEDURAL ROCKY PROVIDERS
==================================================

For generated landable rocky bodies:

create RockyPlanetProvider dynamically.

Use:

synthetic-base PlanetSurfaceGenerator

and the generated profile/albedo.

No real-geography claims.

Do not allocate providers for every planet simultaneously if unnecessary.

Only nearby/eligible solid bodies need detailed physical provider.

==================================================
PART AK
PROVIDER BUDGET
==================================================

A generated system may contain:

1 star
up to several planets
many moons.

Do not instantiate detailed terrain for every body permanently.

Use the existing:

CelestialPresentationController

handoff/eligibility

to ensure only nearby eligible solid body streams detailed surface.

Generic distant proxies remain cheap.

==================================================
PART AL
DYNAMIC CelestialPresentationController
==================================================

Current controller already loops:

universe.activeSystem.bodies

which is good.

Preserve this.

But all dependent:

profiles
visuals
providers

must now resolve active procedural bodies correctly.

==================================================
PART AM
STAR LIGHT SOURCE
==================================================

Current controller finds:

bodyProfile(body).bodyClass === 'star'

Good conceptually.

Generalize profile resolution so generated star becomes the system light source.

Generated planets should be phase-lit by their generated star.

No hardcoded Solar Sun dependency inside active procedural system.

==================================================
PART AN
PROCEDURAL STAR SunVisual
==================================================

SunVisual currently represents Solar star characteristics.

Adapt it to support stellar parameters:

temperature
luminosity / visual intensity
profile/albedo

Do NOT copy the Solar visual identically for every star.

But keep current Solar-specific procedural quality improvements.

Generated stars can reuse same shader with different uniforms/profile.

==================================================
PART AO
GENERATED PLANET VISUALS
==================================================

At minimum visually distinguish:

rocky

gas giant

ice giant

moon

Use deterministic colours/bands.

Do not ship every generated world as Mercury grey.

==================================================
PART AP
SYSTEM MAP
==================================================

Once a procedural system is active:

Universal Map `system` level must list its actual:

star
planets
moons

not Solar bodies.

Map body selection produces the existing U0 universal target.

No second target path.

==================================================
PART AQ
TAB
==================================================

Inside active procedural system:

Tab / Shift+Tab

must cycle generated bodies using:

celestialLockCandidates(activeSystem,...)

Current function is already system-generic.

Do not force Solar catalogue IDs.

==================================================
PART AR
P AUTOPILOT
==================================================

Inside active procedural system:

select generated planet

P

Expected:

same current intra-system autopilot architecture.

Approach
braking
arrival margin

Do NOT engage for:

star system in another sector
galaxy
black hole
cosmic anchor.

==================================================
PART AS
WARP B
==================================================

Current intra-system Warp B:

1c → 256c

may continue working inside a generated system.

It remains:

INTRA-SYSTEM / interplanetary.

Do NOT make it cross the 100 ly sector.

U3 will create a higher travel domain.

==================================================
PART AT
SYSTEM BOUNDARY
==================================================

If player manually flies far beyond all procedural system bodies:

do NOT automatically increment sector and silently become interstellar travel.

U1 has no cross-system continuous travel.

Define a bounded system-domain limit.

When beyond reasonable system extent:

remain in current system frame

and display:

INTERSTELLAR HYPERCRUISE REQUIRED

Do not teleport.

==================================================
PART AU
LANDING GENERATED ROCKY PLANET
==================================================

Required U1 live test.

Select one generated rocky planet.

Approach.

Use F landing.

Expected:

safe capture

handoff to:

<body>/local-enu

synthetic surface visible

terrain collision

Grounded works

walk on surface

take off again

No fake Manaus systems.

==================================================
PART AV
GENERATED GAS GIANT
==================================================

Approach gas giant.

Expected:

no surface handoff

no local ground

proper exclusion/arrival

no fake rocky provider.

==================================================
PART AW
GENERATED MOON
==================================================

If generated system has solid moon:

lock moon

fly to moon

land

walk

take off

Its orbit is relative to generated planet and must remain correct.

==================================================
PART AX
FRAME GRAPH
==================================================

System frame hierarchy should be conceptually:

UniverseAddress:
galaxy / sector / system

ReferenceFrameGraph:

system/<starId>
├ star fixed
├ planet fixed
│  ├ moon fixed
│  └ planet local ENU when landed
└ ...

Do NOT place sector coordinates directly into render Object3D positions.

==================================================
PART AY
LOGICAL SECTOR POSITION
==================================================

Procedural star has:

sector BigInt
+
offsetM inside 100 ly sector

That remains its universe position.

Inside the active system:

body positions are small real metre offsets relative to the star/system.

Do not add the galaxy-scale star offset to every planet vertex.

==================================================
PART AZ
RENDER PRECISION
==================================================

On installation:

render origin uses the system frame.

Planet positions remain:

real metres
camera-relative

No astronomical Float32 vertices.

Preserve:

RenderSpaceService
FloatingOrigin3D.

==================================================
PART BA
FLOATING ORIGIN
==================================================

Trigger rebases inside generated system.

Expected:

body logical coordinates unchanged
target key unchanged
orbit unchanged
render coordinates bounded.

==================================================
PART BB
SYSTEM CLOCK
==================================================

Use global UniverseRuntime epoch.

Do not restart generated orbits at:

t = 0

every time system loads.

If player leaves system for 10,000 seconds and returns:

planets should be where their deterministic orbit says they are at current epoch.

==================================================
PART BC
FRAME ORBIT UPDATE TEST
==================================================

At epoch T:

positionOf(planet)

must equal corresponding body-frame origin.

Advance epoch.

Both move consistently.

Mandatory because current ProceduralSystemRuntime does not do this yet.

==================================================
PART BD
UNLOAD WHILE TARGETED
==================================================

Target identity survives system unload.

Example:

target generated planet

leave system

Expected:

target still VALID
materialized = false
travelCapability returns interstellar-future

Do not clear target just because provider/runtime is gone.

==================================================
PART BE
RETURN TARGET
==================================================

Reinstall same system.

Expected:

same target becomes:

materialized = true

without changing target key.

==================================================
PART BF
CACHE
==================================================

Do not keep unlimited generated:

sectors
systems
providers
visuals

Existing U0 descriptor cache:

8 sectors
64 systems

is descriptor-level.

Gameplay runtime cache should be much smaller.

Suggested:

1 active procedural system

optionally:
1 previous prepared system

No reason to keep dozens of live systems.

==================================================
PART BG
STAR SECTOR PROVIDER
==================================================

Current StarSectorProvider remains:

BACKDROP ONLY.

Its rendered points are NOT star-system runtime authority.

Selecting a point/target should eventually map to the same GeneratedStar descriptor.

Do not derive system physics from Points geometry.

==================================================
PART BH
NO DUPLICATE GENERATION
==================================================

This is critical.

Use U0:

UniversalTargetCatalog.proceduralDescriptor()

as the canonical derivation.

Do NOT have:

StarSectorProvider generate one system

and

SystemMaterializer generate a different seed.

One seed convention.

==================================================
PART BI
PROCEDURAL STAR SELECTION FOR QA
==================================================

Create one deterministic test fixture.

Recommended:

galaxy:
milky_way

sector:
17,-2,4

pick first generated star with at least one planet

or deterministic search for first suitable star.

Do not hardcode a made-up ID that generation does not produce.

Tests must derive it from:

generateStarSector().

==================================================
PART BJ
U1 DEV ARRIVAL
==================================================

For browser/manual QA:

add a dev-only command or map control.

Example:

U1 TEST · MATERIALIZAR SISTEMA

Available only when selected target kind is:

star/system/body

of a valid generated system.

It performs:

prepare
atomic install
safe system-frame arrival

Clearly display:

TEST ARRIVAL

No implication of actual interstellar travel.

==================================================
PART BK
DO NOT PUT TEST TELEPORT ON NORMAL P
==================================================

Normal P on remote procedural target remains:

VIAGEM INTERESTELAR AINDA INDISPONÍVEL

until U3.

This distinction is mandatory.

==================================================
PART BL
RETURN TO SOLAR TEST ACTION
==================================================

Dev QA may expose:

RETURN TO SOL

which atomically restores the Solar session.

Do not model this as hypercruise.

==================================================
PART BM
F3
==================================================

Add:

ACTIVE SYSTEM · Galaxy

ACTIVE SYSTEM · Sector

ACTIVE SYSTEM · ID

ACTIVE SYSTEM · Procedural yes/no

ACTIVE SYSTEM · Star

ACTIVE SYSTEM · Bodies

ACTIVE SYSTEM · Planets

ACTIVE SYSTEM · Moons

ACTIVE SYSTEM · Runtime generation

ACTIVE SYSTEM · System frame

ACTIVE SYSTEM · Provider count

ACTIVE SYSTEM · Dynamic visuals

ACTIVE SYSTEM · Landable bodies

ACTIVE SYSTEM · Gas/ice giants

ACTIVE SYSTEM · Epoch

ACTIVE SYSTEM · QA arrival mode

Target diagnostics from U0 remain.

==================================================
PART BN
SYSTEM HUD
==================================================

Inside generated system HUD should display:

generated star name

system ID

current body / nearest body

selected target

distance

speed

No hardcoded:

Sistema Solar

when active system is procedural.

==================================================
PART BO
CELESTIAL LABELS
==================================================

Labels must support generated:

star
planet
moon names

without relying exclusively on:

CELESTIAL_LABEL_NAMES

Solar custom PT names remain.

Generated IDs use generated display names.

==================================================
PART BP
NO ANDROMEDA RUNTIME YET
==================================================

U1 may materialize procedural systems in:

Milky Way

and architecture should be galaxyId-generic.

But DO NOT implement:

Andromeda active galaxy runtime

arrival into Andromeda

U2 owns that.

==================================================
PART BQ
NO PROCEDURAL GALAXIES
==================================================

Only existing galaxy definitions are valid generation contexts.

U4 owns arbitrary procedural galaxy descriptors.

Do not expand LOCAL_GROUP_CATALOG randomly.

==================================================
PART BR
NO BLACK HOLE SYSTEM BODY
==================================================

Do not generate functional black holes in star sectors yet.

BH0 owns their runtime.

If star generation later supports remnants, defer.

==================================================
PART BS
NO SYSTEM SAVE FILE GROWTH
==================================================

Do NOT serialize generated systems to disk merely because visited.

Persistence is:

seed
address
epoch

not:

100 KB body list per visited star.

Regeneration is the storage system.

==================================================
PART BT
DETERMINISM TEST
==================================================

Generate same target:

100 times

Expected:

same:

star
system seed
body count
IDs
physical values
profile classes
orbits

No Math.random.

==================================================
PART BU
DIFFERENT SYSTEM TEST
==================================================

Generate two neighboring stars.

Expected:

different stable system seeds

different body layout

no ID collision.

==================================================
PART BV
SAME STAR DIFFERENT EPOCH
==================================================

Descriptors identical.

Positions differ only according to orbital evolution.

Physical body properties remain identical.

==================================================
PART BW
SYSTEM INSTALL FAILURE
==================================================

Inject failure during:

profile preparation
frame registration
provider creation

Expected:

previous active system untouched.

No orphan frames/providers.

==================================================
PART BX
SYSTEM UNLOAD CLEANUP
==================================================

After leaving procedural system:

no procedural:

provider
visual
frame
terrain collider
local ENU
stream job

may remain active accidentally.

Descriptor cache may remain.

==================================================
PART BY
MANAUS REGRESSION
==================================================

Return to Solar Earth.

Verify:

Manaus local
Manaus aerial
Rio Negro
Earth transition
trees water fix

unchanged.

==================================================
PART BZ
SOLAR REGRESSION
==================================================

After procedural visit and return:

Sun
Moon
Mars
Jupiter
Solar-12

still render.

Moon landing still works.

Mars landing still works.

Sun barrier fix still works.

Solar Warp B still works.

==================================================
PART CA
D1 REGRESSION
==================================================

Do NOT break:

planet volume collision

Moon/Mars crater D1

D1.1 multi crater

D1.2 high-res impact

No need to activate these for procedural planets.

==================================================
PART CB
MANDATORY TESTS
==================================================

Add at minimum:

T_U1_GENERATED_STAR_SYSTEM_DESCRIPTOR_STABLE

T_U1_GENERATED_PLANET_COUNT_MATCHES_STAR_DESCRIPTOR

T_U1_ZERO_PLANET_STAR_SUPPORTED

T_U1_STAR_RADIUS_FROM_GENERATED_STAR_PROPERTIES

T_U1_PROCEDURAL_BODY_PROFILE_DETERMINISTIC

T_U1_ROCKY_PLANET_LANDABLE

T_U1_GAS_GIANT_NOT_LANDABLE

T_U1_SOLID_MOON_PROFILE

T_U1_SYSTEM_FRAME_ID_SOLAR

T_U1_SYSTEM_FRAME_ID_PROCEDURAL

T_U1_PROCEDURAL_FRAME_ORIGIN_UPDATES_WITH_ORBIT

T_U1_FRAME_POSITION_EQUALS_RUNTIME_POSITION

T_U1_MATERIALIZER_PREPARES_BEFORE_INSTALL

T_U1_FAILED_INSTALL_PRESERVES_OLD_SYSTEM

T_U1_ACTIVE_SYSTEM_SWITCH

T_U1_PLAYER_ADDRESS_SWITCH

T_U1_PLAYER_FRAME_SWITCH

T_U1_DYNAMIC_STAR_VISUAL

T_U1_DYNAMIC_PLANET_VISUAL

T_U1_DYNAMIC_MOON_VISUAL

T_U1_VISUAL_DISPOSE_ON_UNLOAD

T_U1_DYNAMIC_PROVIDER_INSTALL

T_U1_PROVIDER_DISPOSE_ON_UNLOAD

T_U1_ONLY_NEAR_SOLID_BODY_STREAMS_SURFACE

T_U1_GENERATED_STAR_PHASE_LIGHT_SOURCE

T_U1_TAB_CYCLES_GENERATED_BODIES

T_U1_SHIFT_TAB_CYCLES_GENERATED_BODIES

T_U1_ACTIVE_SYSTEM_BODY_TARGET_AVAILABLE

T_U1_REMOTE_SYSTEM_BODY_TARGET_NOT_INTRA_SYSTEM

T_U1_P_AUTOPILOT_GENERATED_PLANET

T_U1_COSMIC_FLIGHT_GENERATED_SYSTEM

T_U1_WARP_B_GENERATED_SYSTEM

T_U1_NO_CROSS_SYSTEM_COSMIC_FLIGHT

T_U1_GENERATED_ROCKY_LANDING

T_U1_GENERATED_GAS_GIANT_NO_LANDING

T_U1_GENERATED_MOON_LANDING

T_U1_FLOATING_ORIGIN_GENERATED_SYSTEM

T_U1_TARGET_SURVIVES_UNLOAD

T_U1_TARGET_REMATERIALIZES_SAME_KEY

T_U1_REVISIT_SAME_DESCRIPTOR

T_U1_GLOBAL_EPOCH_PRESERVED

T_U1_NO_MATH_RANDOM

T_U1_NO_RENDER_POSITION_AUTHORITY

T_U1_BIGINT_TARGET_IDENTITY_PRESERVED

T_U1_NO_NORMAL_P_INTERSTELLAR_TELEPORT

T_U1_SOLAR_RETURN

T_U1_MANAUS_REGRESSION

T_U1_SOLAR_AUTOPILOT_REGRESSION

==================================================
PART CC
BROWSER U1
==================================================

Add/extend existing browser infrastructure.

Do NOT introduce Playwright if current browser checkpoint uses another configured runner.

Flow:

1.
start in Manaus/Solar.

2.
select deterministic procedural star target.

3.
press normal P.

Expected:

"Viagem interestelar ainda indisponível"

NO teleport.

4.
invoke explicit U1 TEST ARRIVAL.

5.
wait preparation.

6.
assert:

activeSystem instanceof ProceduralSystemRuntime

player address:
correct galaxy/sector/system

player frame:
generated system frame

7.
look around.

Generated star visible.

Generated planets visible.

No Solar planets incorrectly overlaid.

8.
open map.

Generated bodies listed.

9.
Tab generated planet.

10.
P.

Fly automatically to generated planet.

11.
cancel.

12.
select generated rocky body.

13.
approach and F land.

14.
verify:

local ENU
surface
collision
Grounded

15.
take off.

16.
select gas giant.

Verify:
no landing.

17.
if solid moon fixture exists:
land on moon.

18.
trigger floating-origin rebase.

Target/orbits remain stable.

19.
U1 TEST RETURN TO SOL.

20.
verify:

Solar active again
Earth/Moon/Mars visible
Manaus systems restored

21.
re-enter same generated system.

Verify:
same system identity/body properties.

22.
zero page/console errors.

==================================================
PART CD
VISUAL QA
==================================================

Generate ignored screenshots only.

Capture:

generated star from far

whole generated system

rocky planet approach

gas giant approach

moon approach

rocky surface landing

Do not commit screenshots.

Inspect:

no invisible generated bodies

no all-grey system

no Solar labels attached to generated planets

star colour matches class approximately

planet sizes visually distinct

no astronomical Float32 jitter.

==================================================
PART CE
PERFORMANCE
==================================================

Measure:

system generation ms

runtime creation ms

profile generation ms

frame registration ms

visual allocation ms

provider allocation ms

atomic install ms

unload/dispose ms

memory before system

memory active

memory after unload

dynamic visual count

provider count

Do not set arbitrary CI millisecond pass/fail thresholds.

==================================================
PART CF
F3 MANUAL QA
==================================================

F3 must prove:

system:
procedural

galaxy:
milky_way

sector:
actual BigInt sector

system ID:
generated star ID

bodies:
correct count

frame:
system/<starId>

target:
generated body

capability:
intra-system

No accidental:

sol

or:

solar-system/barycentric

in active generated-system state except where explicitly referencing old Solar infrastructure.

==================================================
PART CG
DOCUMENTATION
==================================================

Create:

docs/world/27-status-U1-PLAYABLE-PROCEDURAL-SYSTEMS.md

Update:

docs/world/11-galaxy-and-universe.md

docs/world/universal-map.md

docs/world/15-status.md

specs/UNIVERSE-MAP-COMPLETION-EPIC.md

specs/Promptatual.md

Document:

existing generator reuse

star/system descriptor consistency

profile generation

dynamic visuals

dynamic providers

system-frame generalization

runtime frame update fix

intra-system CosmicFlight

U1 QA arrival distinction

deterministic unload/regenerate

remaining U2/U3 scope.

==================================================
PART CH
COMMIT DISCIPLINE
==================================================

Prefer 4-6 commits:

feat(universe): materialize deterministic procedural star systems

refactor(travel): generalize intra-system flight beyond Sol

feat(render): support dynamic procedural stars and planets

feat(planet): add deterministic generated body profiles and synthetic landing

test(universe): validate procedural system lifecycle and revisit

docs(universe): close U1 playable procedural systems

Do not commit:

screenshots
browser artifacts
logs
generated system dumps
temporary JSON
workspace files

==================================================
PART CI
RUN
==================================================

npm run typecheck

Focused:

StarSector
SystemGenerator
ProceduralSystemRuntime
UniversalTargetCatalog
UniversalTargetResolver
UniverseRuntime
ReferenceFrameGraph
CelestialPresentationController
CelestialBodyVisualLayer
PlanetProviderRegistry
RockyPlanetProvider
CosmicFlight
TravelDomain
PlanetaryLanding
UniversalMap

Then:

npm test

npm run build

npm run test:browser:space

npm run test:browser

npm run test:browser:manaus

git diff --check

After push:

inspect GitHub Actions on EXACT FINAL SHA.

==================================================
MANUAL ACCEPTANCE
==================================================

User manually validates:

1.
Start in Manaus.

2.
Open Universal Map.

3.
Choose deterministic generated star.

4.
Confirm normal P still says interstellar travel unavailable.

5.
Use explicit U1 TEST ARRIVAL.

6.
Observe generated star system.

Expected:
star + planets visible.

7.
Use Tab to target generated planet.

8.
Use P.

Expected:
normal intra-system autopilot.

9.
Approach a rocky generated planet.

10.
Use F.

Expected:
land and walk.

11.
Take off.

12.
Approach gas giant.

Expected:
no landing.

13.
If available, visit and land on solid moon.

14.
Return to Solar using TEST RETURN.

15.
Verify Manaus/Earth/Solar normal.

16.
Re-enter exact same generated system.

Expected:
same star
same planets
same moons
same orbits
same visual classification.

==================================================
FINAL REPORT
==================================================

Report:

INITIAL HEAD
FINAL HEAD

COMMITS

PROCEDURAL SYSTEM FIXTURE ADDRESS

GENERATED STAR ID

STAR CLASS

STAR PHYSICAL PROPERTIES

PLANET COUNT SOURCE BEFORE / AFTER

PLANETS

MOONS

BODY PROFILE ARCHITECTURE

LANDABLE GENERATED BODIES

NON-LANDABLE GENERATED BODIES

ACTIVE SYSTEM FRAME

PROCEDURAL FRAME UPDATE FIX

SYSTEM MATERIALIZER

ATOMIC INSTALL RESULT

INSTALL FAILURE RESULT

DYNAMIC STAR VISUAL

DYNAMIC PLANET VISUALS

DYNAMIC PROVIDER SET

INTRA-SYSTEM TARGET ADAPTER

TAB RESULT

P AUTOPILOT RESULT

WARP RESULT

ROCKY PLANET LANDING RESULT

MOON LANDING RESULT

GAS GIANT RESULT

NORMAL P REMOTE SYSTEM RESULT

U1 TEST ARRIVAL RESULT

UNLOAD RESULT

REVISIT DETERMINISM RESULT

GLOBAL EPOCH RESULT

FLOATING ORIGIN RESULT

MEMORY BEFORE / ACTIVE / AFTER

VISUAL COUNT BEFORE / ACTIVE / AFTER

PROVIDER COUNT BEFORE / ACTIVE / AFTER

SOLAR RETURN RESULT

MANAUS REGRESSION

D1 REGRESSION

TYPECHECK
FOCUSED TESTS
FULL TESTS
BUILD
BROWSER SPACE
BROWSER LOCAL
BROWSER MANAUS
DIFF CHECK
GITHUB ACTIONS

AUTOMATICALLY VERIFIED

REQUIRES USER MANUAL VALIDATION

Then STOP.

DO NOT START U2.

DO NOT IMPLEMENT ANDROMEDA ARRIVAL.

DO NOT IMPLEMENT INTERSTELLAR HYPERCRUISE.

DO NOT IMPLEMENT PROCEDURAL GALAXIES.

DO NOT IMPLEMENT BLACK-HOLE GRAVITY.
```

O objetivo desse patch é importante: depois do U1, o universo já deixa de ser “mapa com estrelas procedurais” e passa a ter **estrelas que realmente possuem sistemas jogáveis**. O U2 então pode atacar Andromeda e a arquitetura de galáxias, e o U3 finalmente conecta esses sistemas com a viagem absurdamente rápida que você quer.