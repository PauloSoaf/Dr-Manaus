# U1 — Playable procedural systems · 2026-10-09

Baseline: `c651abb77c8142244064a1aa4d50504bdfdb9f63`, branch `feat/universe-map`.
The latest request accepts U0 and explicitly authorizes U1, documentation, commits and push.
[Original U1 brief](../../specs/U1-PLAYABLE-PROCEDURAL-SYSTEMS.md) is archived without altering its requirements.

## Delivered behavior

A canonical generated Milky Way target prepares and installs a playable system. Its star, planets
and moons have their own deterministic physics, profiles, visuals and live orbits. Map/HUD/F3,
Tab/Shift+Tab, P autopilot, Warp B, rocky surface capture, local ENU terrain physics, walking
and takeoff use the active system. Giants have exclusion/arrival, never a solid floor.

Cross-system P stays unavailable, including when another generated star is selected while in
procedural space. Installation is reached only through explicitly labeled U1 TEST ARRIVAL.
Solar return restores the saved Solar frame/pose, permanent Solar providers/visuals and current
global epoch. A universal target survives unload and becomes materialized again under the same key.
D1 remains frozen; generated profiles keep `supportsVolumeDestruction=false`.

## Canonical fixture and generator correction

Galaxy `milky_way`, sector `17,-2,4`, first real generated star with planets:
`milky_way/17,-2,4/0`, displayed as **PX-17·-2·4-0**.
Seed: `326061089061219196`, exactly U0's `sectorSeed(galaxy,sector) XOR BigInt(starIndex+1)`.
All materialization comes from `UniversalTargetCatalog.proceduralDescriptor()`.
No render point, proxy position or independently drawn seed creates system physics.

| Property | Value |
| --- | --- |
| Spectral class | M |
| Mass | 0.09518364524622033 Solar masses |
| Temperature | 1759.9498818027414 K |
| Luminosity | 0.0002660530030320568 Solar luminosities |
| Stellar radius | 122,055,717.97688596 m |
| Planets / moons / total bodies | 9 / 24 / 34 |
| Classes | 1 star, 2 rocky planets, 6 gas giants, 1 ice giant, 19 rocky moons, 5 icy moons |
| Landable solids | 26, synthetic-base ellipsoids, deterministic albedo and physical gravity |
| Non-landable | Star and 7 giants |

Historical baseline generator reproduced with this exact seed/mass: **3 planets** despite the
catalog's **9**, and random stellar radius **2,630,820,866.604169 m**. U1 consumes GeneratedStar's
planet count, including zero, mass, temperature and luminosity. Radius follows
`R/Rsun = sqrt(L/Lsun)/(T/5772 K)^2`. Legacy mass-only unit callers remain supported; the
canonical catalog always passes the full GeneratedStar. The fixture now agrees with its catalog.

Planet spacing increases outward; moons orbit beyond the parent's radius. Radii, masses and
rotation periods are finite and positive. Classes/atmospheres/capabilities/colors are explicit
generated metadata, never inferred from IDs by gameplay. Curated `SOLAR_BODY_PROFILES` retains
Solar authority; `bodyProfile(body)` is the shared generated/Solar resolver. Synthetic surfaces
claim no measured geography, city, vegetation or water. Generated D1 volume edits are deferred.

Star colors distinguish cool M/K from hotter A/B/O; luminosity supplies bounded visual intensity.
Solar shader quality and appearance are preserved. Physics remains in real metres and float64;
the system never adds 100 ly sector offsets to planet GPU vertices.

## Frames, navigation and lifecycle

`CelestialSystemRuntime.systemFrameId`: Solar `solar-system/barycentric`; procedural
`system/milky_way/17,-2,4/0`. Each update publishes live runtime body positions into its registered
body-fixed frames. Fixed aliases and landing ENU frames share those logical positions. Directions,
body-relative orbital velocity, handoff, CCD, presentation and volume lighting use the active
system frame. Genuine Earth/Manaus/Solar infrastructure retains its physical Solar frame.

`activeSystemTargetBodyId` / `intraSystemNavigationTarget` requires exact galaxy, BigInt sector,
system and existing body/root star. Active generated targets expose `intra-system`; remote
systems remain `interstellar-future`. The historical strict Solar adapters still exist for
compatibility. CosmicFlight only receives one active runtime; Warp remains intra-system 1c–256c.
Beyond the bounded system extent the frame/address stay unchanged and HUD/F3 displays
**INTERSTELLAR HYPERCRUISE REQUIRED**. No sector increment or automatic transport is introduced.

`ProceduralSystemMaterializer` prepares canonical descriptor, runtime at the global epoch,
profiles, detached validated frames and resource shells before installation. Synchronous install
registers infrastructure, commits active runtime/address/frame/render origin and activates gameplay.
Readiness expires when disposed; an installed preparation cannot be consumed twice. Repeated
arrival in an already active system reuses its current session. At most one generated session lives.

Failures during profile preparation, frame preparation/registration, provider preparation or
resource installation preserve the old runtime/address/pose/frame tree. A failure after commit
starts also rolls back runtime, pose, travel-view axes and render origin. The previous system
remains until readiness; staged resources are disposed on failure.

Unload cancels flight/landing/Warp, disposes procedural visuals and provider meshes, aborts
body streaming jobs, removes active/dormant tile payloads and updates residency accounting.
It removes body/fixed/ENU/terrain frames and replaces local physics/colliders. Solar frames,
providers, edits and descriptor identity remain permanent. Manaus aerial/old volume presentation
skips disconnected frame trees instead of trying to transform Solar meshes into a procedural root.
The star-sector backdrop draws before planet discs, so its points cannot overdraw solid worlds.

Lightweight provider shells exist for the 26 solids; only the nearest eligible solid body streams
detailed terrain. Distant proxy geometry is cheap. Descriptor caches stay bounded at 8 sectors /
64 systems; no visited runtime cache or generated body dumps are saved. Logical descriptors
regenerate identically in 100 repeated trials and neighboring star seeds/IDs remain distinct.
Global epoch never resets on arrival/revisit; orbit positions evolve from that shared clock.

For sectors outside the exact bounded density range (±1,000,000), StarSector uses a bounded
local density fallback while identity/RNG remain exact BigInt. Neighboring sectors above 2^53
remain distinct. This is a generation fallback, not cosmological physical coordinate precision.

## U1 TEST controls and diagnostics

Run `npm run dev`, open M and use **SELECIONAR SISTEMA · 17,-2,4**, then
**MATERIALIZAR SISTEMA (U1 TEST)**. Selection alone does not move the observer. Arrival places
the player safely outside the outer system extent with zero velocity, inside its own system frame.
**VOLTAR AO SOLAR (U1 TEST)** restores the saved Solar session. A production preview must
explicitly opt into `?u1test=1` (browser fixtures also use `webgl=1`); normal production sessions
expose no arrival controls, and P never invokes materialization. This is development transport,
not implemented hypercruise. The command rejects Andromeda and non-procedural target kinds.

F3 includes ACTIVE SYSTEM galaxy/sector/ID/procedural/star/body/planet/moon counts, generation,
frame, providers, dynamic visuals, landable/giant counts, epoch, QA mode and boundary. Existing
U0 universal-target diagnostics remain. The actual F3 DOM is tested. Generated names appear
on map, labels, HUD and local surface readouts; active-system maps list the actual 34 bodies and
project their generated orbital plane, including planet-focused moon orbits.

## Validation and measured budgets

**1,211/1,211 full unit tests; 237/237 focused; 48 U1 unit cases (44 mandatory IDs plus 4
additional lifecycle guards); all 48 mandatory U1 IDs covered when combined with 4 real
browser cases. Typecheck/build/diff PASS.** No thresholds are relaxed.

Native Windows Chromium WebGL2 / D3D11 (`DR_BROWSER_GPU=1`): full spatial browser, local
browser and Manaus surface browser PASS, zero page/console errors. A fresh U1 checkpoint also
passes on the built app, including real map controls, remote P refusal, active P/cancel, Warp,
Tab/Shift+Tab, rocky and moon F capture, ENU contact/walking/takeoff, giant refusal, F3,
actual floating-origin rebase and target unload/revisit. Solar Sun/Moon/Mars/Jupiter/C4/D1
checks remain in the full spatial suite. Manaus retains real roads, river/trees, 15 km one-ground
handoff, continuous ascent through 200 km, orbit and reentry.

Browser approach poses are explicit near-body test fixtures. F and safe ENU capture/handoff run
through the production controls. Once ENU capture completes, the U1 browser shortens the
remaining descent to 2 m above the real terrain with downward velocity; actual terrain CCD
resolves Grounded and walking. This is not a claimed manually flown interstellar journey or
an untouched full-duration final descent. Existing full Solar landing tests still exercise the
unshortened production fall to terrain. User acceptance of the full generated descent remains manual.

| Stage | ms, first arrival |
| --- | ---: |
| descriptor | 0.100 |
| runtime | 0.000 |
| profiles | 0.100 |
| frames | 0.400 |
| providers | 1.300 |
| visuals | 4.000 |
| resources | 5.400 |
| prepare | 6.000 |
| unload | 0.000 |
| install | 2.100 |

Revisit preparation: **5.500 ms**; install **0.800 ms**;
return unloads **3.600 / 1.600 ms**. Measurements are one local
native run, including timers rounded to 0.1 ms; not arbitrary CI timing assertions.

| Stage | Bodies | Active visual instances | Body / total providers | Frames | Renderer geometries / textures | Active visual/provider mesh buffer bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| before | 19 | 19 | 4 / 6 | 23 | 121 / 7 | 941,436 |
| active | 34 | 34 | 26 / 32 | 93 | 199 / 7 | 4,760 |
| after | 19 | 19 | 4 / 6 | 23 | 143 / 7 | 941,436 |
| revisited | 34 | 34 | 26 / 32 | 93 | 177 / 7 | 4,760 |
| finalSolar | 19 | 19 | 4 / 6 | 23 | 146 / 7 | 941,436 |

The buffer sum counts typed vertex/index arrays on the active visual/provider roots, not exact
GPU residency, JS objects or driver memory. All procedural roots disappear on return; 26 procedural
providers and their frames are removed. Whole renderer geometry counts include city/terrain
warming and backdrop caches; they are not expected to equal the fresh startup count. Native
Chromium reported the same coarse JS heap figure (491,000,000 bytes) at these checkpoints;
this rounded value is not evidence of exact heap equality or a complete RSS leak benchmark.
During initial far arrival no detailed body streams; near-solid tests permit exactly one physical
body. No generated dumps, screenshots, logs or test artifacts are committed.

Ignored evidence: `artifacts/u1-unit-final.log`, `u1-focused.log`, `u1-build.log`,
`u1-space.log`, `u1-local.log`, `u1-manaus.log`, `u1-browser.json` and the standard browser JSON
summaries. Inspected screenshots include system map, generated star far/close, day-lit gas disc/
approach, rocky/moon approach and both grounded synthetic surfaces.

## Mandatory matrix

| Test ID | Evidence |
| --- | --- |
| `T_U1_GENERATED_STAR_SYSTEM_DESCRIPTOR_STABLE` | Unit, logical runtime/resources |
| `T_U1_GENERATED_PLANET_COUNT_MATCHES_STAR_DESCRIPTOR` | Unit, logical runtime/resources |
| `T_U1_ZERO_PLANET_STAR_SUPPORTED` | Unit, logical runtime/resources |
| `T_U1_STAR_RADIUS_FROM_GENERATED_STAR_PROPERTIES` | Unit, logical runtime/resources |
| `T_U1_PROCEDURAL_BODY_PROFILE_DETERMINISTIC` | Unit, logical runtime/resources |
| `T_U1_ROCKY_PLANET_LANDABLE` | Unit, logical runtime/resources |
| `T_U1_GAS_GIANT_NOT_LANDABLE` | Unit, logical runtime/resources |
| `T_U1_SOLID_MOON_PROFILE` | Unit, logical runtime/resources |
| `T_U1_SYSTEM_FRAME_ID_SOLAR` | Unit, logical runtime/resources |
| `T_U1_SYSTEM_FRAME_ID_PROCEDURAL` | Unit, logical runtime/resources |
| `T_U1_PROCEDURAL_FRAME_ORIGIN_UPDATES_WITH_ORBIT` | Unit, logical runtime/resources |
| `T_U1_FRAME_POSITION_EQUALS_RUNTIME_POSITION` | Unit, logical runtime/resources |
| `T_U1_MATERIALIZER_PREPARES_BEFORE_INSTALL` | Unit, logical runtime/resources |
| `T_U1_FAILED_INSTALL_PRESERVES_OLD_SYSTEM` | Unit, logical runtime/resources |
| `T_U1_ACTIVE_SYSTEM_SWITCH` | Unit, logical runtime/resources |
| `T_U1_PLAYER_ADDRESS_SWITCH` | Unit, logical runtime/resources |
| `T_U1_PLAYER_FRAME_SWITCH` | Unit, logical runtime/resources |
| `T_U1_DYNAMIC_STAR_VISUAL` | Unit, logical runtime/resources |
| `T_U1_DYNAMIC_PLANET_VISUAL` | Unit, logical runtime/resources |
| `T_U1_DYNAMIC_MOON_VISUAL` | Unit, logical runtime/resources |
| `T_U1_VISUAL_DISPOSE_ON_UNLOAD` | Unit, logical runtime/resources |
| `T_U1_DYNAMIC_PROVIDER_INSTALL` | Unit, logical runtime/resources |
| `T_U1_PROVIDER_DISPOSE_ON_UNLOAD` | Unit, logical runtime/resources |
| `T_U1_ONLY_NEAR_SOLID_BODY_STREAMS_SURFACE` | Unit, logical runtime/resources |
| `T_U1_GENERATED_STAR_PHASE_LIGHT_SOURCE` | Unit, logical runtime/resources |
| `T_U1_TAB_CYCLES_GENERATED_BODIES` | Unit, logical runtime/resources |
| `T_U1_SHIFT_TAB_CYCLES_GENERATED_BODIES` | Unit, logical runtime/resources |
| `T_U1_ACTIVE_SYSTEM_BODY_TARGET_AVAILABLE` | Unit, logical runtime/resources |
| `T_U1_REMOTE_SYSTEM_BODY_TARGET_NOT_INTRA_SYSTEM` | Unit, logical runtime/resources |
| `T_U1_P_AUTOPILOT_GENERATED_PLANET` | Browser Game/keyboard/DOM |
| `T_U1_COSMIC_FLIGHT_GENERATED_SYSTEM` | Unit, logical runtime/resources |
| `T_U1_WARP_B_GENERATED_SYSTEM` | Browser Game/keyboard/DOM |
| `T_U1_NO_CROSS_SYSTEM_COSMIC_FLIGHT` | Unit, logical runtime/resources |
| `T_U1_GENERATED_ROCKY_LANDING` | Unit, logical runtime/resources |
| `T_U1_GENERATED_GAS_GIANT_NO_LANDING` | Unit, logical runtime/resources |
| `T_U1_GENERATED_MOON_LANDING` | Unit, logical runtime/resources |
| `T_U1_FLOATING_ORIGIN_GENERATED_SYSTEM` | Unit, logical runtime/resources |
| `T_U1_TARGET_SURVIVES_UNLOAD` | Unit, logical runtime/resources |
| `T_U1_TARGET_REMATERIALIZES_SAME_KEY` | Unit, logical runtime/resources |
| `T_U1_REVISIT_SAME_DESCRIPTOR` | Unit, logical runtime/resources |
| `T_U1_GLOBAL_EPOCH_PRESERVED` | Unit, logical runtime/resources |
| `T_U1_NO_MATH_RANDOM` | Unit, logical runtime/resources |
| `T_U1_NO_RENDER_POSITION_AUTHORITY` | Unit, logical runtime/resources |
| `T_U1_BIGINT_TARGET_IDENTITY_PRESERVED` | Unit, logical runtime/resources |
| `T_U1_NO_NORMAL_P_INTERSTELLAR_TELEPORT` | Browser Game/keyboard/DOM |
| `T_U1_SOLAR_RETURN` | Unit, logical runtime/resources |
| `T_U1_MANAUS_REGRESSION` | Browser Game/keyboard/DOM |
| `T_U1_SOLAR_AUTOPILOT_REGRESSION` | Unit, logical runtime/resources |

## Delivery and manual gate

Implementation commits: `a28f2a0` generation/profiles, `87b48b8` prepared lifecycle/frames,
`6f805ff` dynamic presentation/gameplay and `b38c091` tests/browser. The closing documentation
commit follows; exact final SHA and its GitHub Actions result are reported after push.

Manually validate M→test arrival; reticle lock, P between generated planets, braking and Warp;
rocky F descent without shortening, Grounded/walk/takeoff; moon landing; gas/ice exclusion;
rebase; return to Solar/Manaus and revisit. Check generated stellar color/size and live moon orbits.
**STOP after U1. U2/U3/U4/BH0 require a new explicit checkpoint; destruction remains D1.**
