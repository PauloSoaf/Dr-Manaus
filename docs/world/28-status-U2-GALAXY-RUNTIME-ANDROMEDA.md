# U2 — Galaxy Runtime / Andromeda · 2026-10-09

Initial HEAD: `9909091f7bfb14b40c031752df29550deddd1651`, branch `feat/universe-map`.
The latest request accepts U1 and authorizes U2, documentation, commits and push.
[Original U2 requirements](../../specs/U2-GALAXY-RUNTIME-ANDROMEDA.md) are archived verbatim.
The final closing HEAD and its exact GitHub Actions run are reported after push.

## Delivered behavior

Explicit U2 TEST prepares and installs a real generated Andromeda system, together with its galaxy
context. The address, active galaxy, system, frames, providers and presentation agree after the
commit. Tab/Shift+Tab, P autopilot, Warp B, rocky and moon landing, local terrain collision, walking
and takeoff use the same U1 pipeline. Return restores the saved Solar/Manaus pose and resources;
revisit restores the same descriptor at the current global orbital epoch.

Ordinary P refuses intergalactic travel in both directions. There is no U3 transport, sector
crossing, new speed tier, arbitrary galaxy generator, or black-hole physics. D1 remains frozen;
all generated bodies still have `supportsVolumeDestruction = false`.

## Coordinate model and authority

Previously, MW sector zero was Solar-relative, while Andromeda density subtracted the galaxy's
global 2.5 Mly displacement from sector positions. This suppressed stars in otherwise valid
Andromeda-local sectors. Presentation and global-distance code also assumed an MW observer.

`GalaxyDefinition.addressOriginM` now explicitly locates each galaxy's sector zero in its own
galactocentric axes. MW remains `[-26,000 ly, 0, 0]`, preserving Sol and the U1 fixture. Andromeda
sector zero is `[0, 0, 0]`, its centre. Its QA fixture is in the disc, approximately 20 kly out,
away from the SMBH. Galaxy dimensions remain catalogue values: MW 100,000 ly diameter, Andromeda
220,000 ly diameter; their global catalogue displacement remains `2.365e22 m`, approximately
2.5 Mly. No intergalactic displacement enters planet or system frames.

`GalaxyCoordinates.galaxyLocalPositionM` is shared by runtime, density, map and BH presentation.
It composes sector metres, sector offset and address origin. Descriptor XYZ Euler orientation
maps galaxy-local vectors into the shared MW-centred global descriptor frame. Global position
and address-separation helpers compose distances across galaxies; same-galaxy separation takes
the BigInt sector difference before numeric conversion, and same-system flight keeps small
real-metre system coordinates. Current-galaxy centre/BH distances use local galactocentric
coordinates, avoiding subtraction of two enormous global positions.

The catalogue orientation/positions are a game approximation, not an astrometric solution.
Current cosmological anchors retain their existing Local Group descriptor approximation.
Sector IDs/seeds/keys remain exact BigInt. Density conversion is bounded to ±1,000,000 sectors;
beyond it, the inherited reference-origin density fallback preserves deterministic identities.
It does not claim a physical location there: cross-galaxy global positions/distances return
unavailable for such indices. Normal U2 flight does not advance sector indices.

`GalaxyRuntime` exposes definition, origin, central BH, local position, density and on-demand
generation. Only the two known catalogue runtimes are cached. `UniverseRuntime.address` remains
the sole player location; `activeGalaxy.id === address.galaxyId` after install/restore. Selecting
any target changes only the shared target, including when its galaxy differs from the player.
The legacy generator alias `milky-way` keeps its existing MW density semantics; canonical
playable addresses use `milky_way`.

## Prepared sessions, rollback and ownership

`GalaxyMaterializer` owns one active `GalaxySession`: detached root, galaxy runtime, one
StarSectorProvider, one external catalogue GalaxyProvider and the owned central BH presentation.
The existing `ProceduralSystemMaterializer` validates canonical targets for any known galaxy,
prepares system frames/profiles/providers/visuals, and combines the prepared galaxy resources.
Unknown galaxy IDs and forged star identities remain rejected.

Preparation does not mutate the live scene, registry, address, frame tree or pose. Install registers
prepared resources, commits runtime/address/pose synchronously, then activates both presentation
sessions. Previous resources stay recoverable until successful completion; retirement follows
activation. Failures restore the old runtime, address, pose, frames, render origin and resources.
The injected stages cover galaxy preparation, sector-provider creation, BH allocation, system
preparation, frame registration, provider registration and visual activation. Failed Solar
restoration also retains Andromeda for a successful retry.

Same-galaxy arrivals reuse the current galaxy session. Cross-galaxy arrivals retire its sector
jobs, GPU meshes, cached decoded geometry, macro galaxy and BH. Abandoned/late sector payloads
are discarded through the provider's optional payload release hook. Only one generated system
is active. Descriptor caches remain U0's 8 sectors / 64 systems; galaxy runtime cache ≤2.

U1 and U2 share **one saved Solar origin**, captured before the first procedural arrival. Tests
alternate U1 → U2 → U1 → U2 and restore the same Solar pose. Permanent curated Solar terrain,
providers and visuals remain available for return. There is no unbounded transport snapshot stack.

## Andromeda QA fixture

`findAndromedaU2Fixture` searches a fixed ordered set of at most nine disc sectors, then generated
star order, requiring a rocky planet, solid moon and giant. It runs only on explicit QA request,
never scans a galaxy on boot, and uses the same canonical catalogue/generator as U1.

| Field | Result |
| --- | --- |
| Galaxy / sector | `andromeda` / `200,0,0` |
| Generated star | `andromeda/200,0,0/1`, `PX-200·0·0-1` |
| System seed | `4008873971866871987` |
| Spectral class | M |
| Mass / temperature / luminosity | 0.42451813876117583 Solar / 3744.673259269196 K / 0.04984675372668097 Solar |
| Star radius | approximately 369,033,022 m |
| Planets / moons / total bodies | 7 / 12 / 20 |
| Landable solids | 16 |
| Nonlandable bodies | star + 3 gas giants |
| System frame | `system/andromeda/200,0,0/1` |
| Terrain | synthetic base; no procedural D1 capability |

Minor final-bit differences between native Node and Chromium floating-point transcendental
functions exist in derived star properties. Within each runtime, revisit descriptors are identical;
IDs, integer seeds, counts and generation ordering agree. No cross-engine bit-identical claim.

## Presentation, map, HUD and distances

Andromeda streams its own 27 neighboring sectors around the current address. The active galaxy
does not render as a remote macro blob. Inside Andromeda, MW is the sole external catalogue
galaxy and M31 is the sole local galactic-centre BH. Return swaps these to Andromeda and Sgr A*.
External direction reverses after accounting for descriptor orientation. Camera-relative proxies
stay bounded around 20,000 / 18,000 units; geometry uses normalized scale rather than Mly
positions. Camera/frame direction conversion follows the active render view.

BH presentation is the existing black sphere/orange torus with a disclosed schematic visibility
floor. It is selectable, correctly owned and logically positioned. It provides **no gravity,
capture, lensing, physical horizon collision, accretion simulation or transport**.

Galaxy map title, scale, breadcrumb, player marker and current/external target labels follow
galaxy-local context. System map lists the active generated star/planets/moons. Cosmos keeps
Local Group catalogue targets. Map shapes/marker inset remain schematic; full procedural star
search/picking is still U5. HUD separately labels current galaxy/system/sector and target galaxy.
F3 reports origin, profile, local galactocentric position, sector provider/residency, external
galaxies, central BH, session generation and QA mode, alongside U0/U1 diagnostics.

| Logical distance | Browser result |
| --- | --- |
| M31 SMBH from QA system | approximately 20.03 kly |
| Sgr A* / MW centre from QA system | approximately 2.51 Mly |
| Sgr A* after Solar return | approximately 26.00 kly |
| Catalogue MW ↔ Andromeda centre displacement | approximately 2.50 Mly |

The first three include observer offsets; the catalogue displacement stays fixed. Address
distance symmetry and preserved U0 keys are tested. M31 keeps
`universe/andromeda/0,0,0/black-hole/m31_smbh`; Andromeda keeps `galaxy/andromeda`.

## Verification and practical limits

Full unit suite: **1,268/1,268 PASS**. U2 contributes **57 new unit cases**. Five automated
roundtrips keep provider/frame/galaxy mesh counts bounded, dispose active and cached sector
geometry, and preserve deterministic revisits. **277/277 focused PASS**, typecheck/build/diff PASS, full-space/U1, local Manaus, aerial/surface
Manaus and U2 browser checkpoints PASS with zero page/console errors. All 59 mandatory IDs have unit/browser evidence.

Browser U2 uses the repository's existing Playwright/Chromium and native Windows WebGL2/D3D11.
Real controls cover map selection, P refusal both ways, explicit arrival, Tab/Shift+Tab, P
autopilot/cancel, Warp B/X, giant landing refusal, rocky/moon F capture and ENU handoff,
Grounded/walk/takeoff, render rebase, return and revisit. Page/console errors are collected.
Near-body poses are explicitly QA fixtures. **Only the final already-local descent is shortened
to terrain +2 m** before real CCD contact; this is not a claim of an untouched full generated
descent or a real 2.5 Mly journey. Existing Solar browser regressions retain their ordinary F
capture/descent coverage. User manual acceptance of full generated descents remains required.

Ignored evidence: `artifacts/u2-browser.json`, unit/focused/build/browser logs, and system,
galaxy map, MW external, M31, star, rocky/moon/giant, F3 and return screenshots. Screenshots were
inspected; the macro MW and central orange M31 marker appear in the correct context, surfaces
are physical and active Andromeda has no duplicate distant Andromeda blob.

Whole-renderer geometry counts vary with city warming and terrain work; they are not an exact
galaxy leak metric. Typed-array buffer bytes and owned mesh/provider/frame counts are useful
bounded lifecycle measurements. Chromium's coarse heap estimate is not RSS or exact freed memory.
There are no arbitrary timing thresholds.

## Manual gate and stop

Run `npm run dev`, open M and use **ENTER ANDROMEDA · U2 TEST**. Production preview needs explicit
`?webgl=1&u2test=1`; ordinary production has no test transport control. QA actions enforce the same
gate in Game; normal P does not call them. U1 TEST cannot cross the current galaxy by accident.
Select Andromeda normally first and press P: location must remain Solar. After QA arrival, verify
map/F3, M31's ~20 kly distance, MW/Sgr A* remote distance, flight, full F descents on planet and
moon, walking and giant refusal. Return with **RETURN TO MILKY WAY / SOL · U2 TEST**; verify
Manaus/aerial/rivers/Earth and Solar targets, then revisit the same generated system.

**STOP after U2 manual acceptance.** U3 production interstellar/intergalactic hypercruise,
U4 arbitrary galaxies, BH0+ physics and U5 full procedural map search remain future checkpoints.

## Measured density and lifecycle

| Density sample | Relative density |
| --- | --- |
| MW sector-zero Solar neighbourhood | 1.4411393241 |
| MW centre | 61.7495209464 |
| Andromeda centre | 125.2886686912 |
| Andromeda disc at 20,000 ly | 5.1763663131 |
| MW / Andromeda at 10 million ly | 6.11e-13 / 5.01e-12 |

Central sector requests are capped at 2,000 stars even when a caller requests a larger cap;
rendered sectors remain capped at 600 stars each. There is no infinite dense disc or galaxy enumeration.

| Snapshot | Body / all providers | Frames | System visuals | Resident sectors | Galaxy meshes | Galaxy buffer bytes | Renderer geometry / textures |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Solar before | 4 / 6 | 23 | 19 | 0 | 3 | 1,457,728 | 122 / 7 |
| Andromeda active | 16 / 22 | 65 | 20 | 27 | 30 | 1,846,528 | 184 / 7 |
| Solar restored | 4 / 6 | 23 | 19 | 0 | 3 | 1,457,728 | 141 / 7 |
| Andromeda revisited | 16 / 22 | 65 | 20 | 9 | 12 | 1,587,328 | 172 / 7 |
| Solar final | 4 / 6 | 23 | 19 | 0 | 3 | 1,457,728 | 145 / 7 |

Owned Solar body visual/provider buffers return to 941,436 bytes;
Andromeda proxy buffers are 2,800 bytes at arrival.
The coarse Chromium heap estimate was 462 MB before/during/after;
it does not prove exact heap/RSS equality. Renderer geometries include unrelated city/terrain warming.

| Timed operation | First arrival ms | Revisit ms |
| --- | --- | --- |
| Known GalaxyRuntime lookup | 0.00 | 0.00 |
| StarSectorProvider preparation | 0.10 | 0.10 |
| External galaxy allocation | 10.40 | 10.20 |
| Central BH allocation | 6.00 | 1.50 |
| Galaxy session preparation | 16.60 | 11.80 |
| System-only preparation | 5.10 | 2.70 |
| Combined preparation | 21.80 | 14.60 |
| System install/activate | 3.20 | 0.80 |
| Galaxy install/activate/unload | 2.80 | 0.70 |

Solar return including galaxy preparation/unload measured 39.10 ms first,
15.70 ms second. Galaxy unload alone measured
1.10 / 0.80 ms.
These are one native GPU browser run, not a timing guarantee; sub-millisecond timer resolution may show zero.

## Mandatory evidence matrix

Unit evidence is in `tests/galaxy-runtime-andromeda.test.ts`; browser evidence is the shared
`scripts/procedural-system-browser-checkpoint.mjs` invoked by `npm run test:browser:galaxy`.
Rocky/moon landing also has real F/ENU/contact/walk browser evidence beyond its unit handoff test.

| Mandatory ID | Evidence |
| --- | --- |
| `T_U2_GALAXY_RUNTIME_MILKY_WAY` | Unit PASS |
| `T_U2_GALAXY_RUNTIME_ANDROMEDA` | Unit PASS |
| `T_U2_ACTIVE_GALAXY_MATCHES_ADDRESS` | Unit PASS |
| `T_U2_MW_SECTOR_ZERO_REMAINS_SOLAR_NEIGHBORHOOD` | Unit PASS |
| `T_U2_ANDROMEDA_SECTOR_ZERO_GALAXY_LOCAL` | Unit PASS |
| `T_U2_GALAXY_LOCAL_POSITION_SHARED_AUTHORITY` | Unit PASS |
| `T_U2_MW_DENSITY_SOLAR_BASELINE` | Unit PASS |
| `T_U2_MW_DENSITY_CENTRE_HIGHER` | Unit PASS |
| `T_U2_ANDROMEDA_DENSITY_CENTRE_NONZERO` | Unit PASS |
| `T_U2_ANDROMEDA_DENSITY_DISC_NONZERO` | Unit PASS |
| `T_U2_ANDROMEDA_DENSITY_FAR_LOW` | Unit PASS |
| `T_U2_NO_ANDROMEDA_2_5MLY_DENSITY_OFFSET` | Unit PASS |
| `T_U2_SAME_SECTOR_DIFFERENT_GALAXY_DIFFERENT_SEED` | Unit PASS |
| `T_U2_ANDROMEDA_SECTOR_DETERMINISTIC` | Unit PASS |
| `T_U2_ANDROMEDA_SYSTEM_DETERMINISTIC` | Unit PASS |
| `T_U2_ANDROMEDA_PLANET_DETERMINISTIC` | Unit PASS |
| `T_U2_MATERIALIZER_ACCEPTS_ANDROMEDA` | Unit PASS |
| `T_U2_MATERIALIZER_REJECTS_UNKNOWN_GALAXY` | Unit PASS |
| `T_U2_GALAXY_PREPARES_BEFORE_INSTALL` | Unit PASS |
| `T_U2_ATOMIC_GALAXY_SYSTEM_INSTALL` | Unit PASS |
| `T_U2_FAILED_GALAXY_INSTALL_PRESERVES_MILKY_WAY` | Unit PASS |
| `T_U2_ACTIVE_SYSTEM_ANDROMEDA` | Unit PASS |
| `T_U2_PLAYER_ADDRESS_ANDROMEDA` | Unit PASS |
| `T_U2_PLAYER_FRAME_ANDROMEDA_SYSTEM` | Unit PASS |
| `T_U2_STAR_SECTOR_PROVIDER_SWITCHES_GALAXY` | Unit PASS |
| `T_U2_MW_PROVIDER_RETIRES` | Unit PASS |
| `T_U2_ANDROMEDA_PROVIDER_ACTIVATES` | Unit PASS |
| `T_U2_ACTIVE_GALAXY_NOT_RENDERED_AS_EXTERNAL` | Unit PASS |
| `T_U2_OTHER_GALAXY_RENDERED_EXTERNAL` | Unit PASS |
| `T_U2_EXTERNAL_DIRECTION_REVERSES` | Unit PASS |
| `T_U2_M31_BLACK_HOLE_CURRENT_GALAXY` | Unit PASS |
| `T_U2_SGRA_NOT_LOCAL_IN_ANDROMEDA` | Unit PASS |
| `T_U2_M31_DISTANCE_GALACTOCENTRIC` | Unit PASS |
| `T_U2_SGRA_DISTANCE_INTERGALACTIC_FROM_ANDROMEDA` | Unit PASS |
| `T_U2_SGRA_DISTANCE_26KLY_FROM_SOLAR` | Unit PASS |
| `T_U2_MW_ANDROMEDA_DISTANCE_SYMMETRIC` | Unit PASS |
| `T_U2_TARGET_KEYS_STABLE` | Unit PASS |
| `T_U2_TARGET_SELECTION_DOES_NOT_MOVE_PLAYER` | Browser PASS |
| `T_U2_NORMAL_P_DOES_NOT_INTERGALACTIC_TELEPORT` | Browser PASS |
| `T_U2_TEST_ARRIVAL_ANDROMEDA` | Browser PASS |
| `T_U2_ANDROMEDA_TAB` | Browser PASS |
| `T_U2_ANDROMEDA_SHIFT_TAB` | Browser PASS |
| `T_U2_ANDROMEDA_P_AUTOPILOT` | Browser PASS |
| `T_U2_ANDROMEDA_WARP` | Browser PASS |
| `T_U2_ANDROMEDA_ROCKY_LANDING` | Unit PASS |
| `T_U2_ANDROMEDA_MOON_LANDING` | Unit PASS |
| `T_U2_ANDROMEDA_GIANT_NO_LANDING` | Unit PASS |
| `T_U2_ANDROMEDA_FLOATING_ORIGIN` | Unit PASS |
| `T_U2_ANDROMEDA_GLOBAL_EPOCH` | Unit PASS |
| `T_U2_ANDROMEDA_UNLOAD` | Unit PASS |
| `T_U2_ANDROMEDA_REVISIT_SAME_SYSTEM` | Unit PASS |
| `T_U2_RETURN_TO_MILKY_WAY` | Unit PASS |
| `T_U2_SOLAR_PROVIDER_RESTORE` | Unit PASS |
| `T_U2_SOLAR_VISUAL_RESTORE` | Unit PASS |
| `T_U2_MANAUS_REGRESSION` | Browser PASS |
| `T_U2_U1_MILKY_WAY_PROCEDURAL_REGRESSION` | Unit PASS |
| `T_U2_BIGINT_IDENTITY` | Unit PASS |
| `T_U2_NO_ASTRONOMICAL_OBJECT3D_POSITION` | Unit PASS |
| `T_U2_NO_MATH_RANDOM` | Unit PASS |

## Delivery commits

Code/test HEAD before the closing documentation commit:
`b04bf521be411c76f571647a1e07d751d676ffa0`.

- 4224d16 feat(galaxy): add active runtime and galaxy-local sector coordinates
- da59521 refactor(universe): prepare galaxy and system sessions with rollback
- f338471 feat(render): switch galaxy backdrop, external galaxies and central black hole
- cd34573 feat(map): expose active galaxy hierarchy and explicit U2 test controls
- b04bf52 test(universe): validate Andromeda lifecycle, distances and roundtrip

The sixth commit closes this report, archives the U2 requirements and updates the five requested
roadmap/prompt documents. The supplied user prompt remains verbatim beneath its current U2 preface.
No screenshots, logs, generated star dumps, temporary JSON or workspace artifacts are committed.

Final SHA, push and exact-SHA GitHub Actions verification accompany the final delivery message.
