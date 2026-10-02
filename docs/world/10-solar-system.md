# The solar system

## SOLAR-12: major moons (2026-10-02)

SPACE-HARDENING-1 at `e0d4e8a460981232678eb067718fddb47fa2b522` was manually accepted
by the user. Task 012 adds Io, Europa, Ganymede and Callisto around Jupiter; Titan and Enceladus
around Saturn; Titania and Oberon around Uranus; Triton around Neptune. Total: 19 catalog bodies.
Stable ASCII IDs are retained; the interface uses Portuguese names. New moons are solid but
`canLand=false`, `surfaceKind=none`: provider shells remain Mercury, Venus, Earth's Moon and Mars.

### Orbital and physical provenance

Constants are pinned offline in the existing `CelestialBody` catalog, inspected 2026-10-02:

- [JPL satellite mean elements](https://ssd.jpl.nasa.gov/sats/elem/): a, e, inclination, node,
  argument of periapsis, mean anomaly and period at 2000-01-01.5 TDB. Jupiter uses JUP365,
  Saturn SAT441, Uranus URA182, Triton NEP097. These are **mean ellipse parameters**, not
  Horizons/SPICE state vectors. Their published periods are mean/anomalistic approximations;
  they are not exact sidereal spin measurements. The model freezes each ellipse and advances
  mean anomaly uniformly with that period, omitting perturbations, precession and resonances.
- [JPL satellite physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/): masses are
  computed from published GM (km³/s² converted to SI) divided by the catalog's G.
- [NAIF pck00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc): shape
  axes, using the average of the two equatorial axes and the published polar axis for the
  catalog's axisymmetric approximation. Bodies with only a mean radius use a sphere.
  Uranus' rotation pole is the opposite of its IAU north pole: RA 77.311°, Dec 15.175°.

Laplace/equatorial reference planes are rotated through their pole RA/Dec in J2000 equatorial
coordinates, then through the J2000 obliquity into the ecliptic. This keeps Uranian moon orbits
tilted with Uranus. Triton's 157.3° inclination to its JPL Laplace plane is retained, so its
angular momentum opposes that plane's pole. Positive mean-anomaly rate does not turn it prograde.
All distances are real SI values; these deterministic trajectories are gameplay approximations,
not spacecraft navigation predictions. No runtime downloads or SPICE dependency are introduced.

`OfflineEphemeris.sample` retains the parent-relative contract used by procedural systems and
the original Earth Moon. `SolarSystem.resolve` recursively adds parent position **and velocity**
to return barycentric states. The old lunar ellipse and secular rates are unchanged and are now
catalog-owned. Synchronous fixed frames put +X toward the parent and +Z along orbital angular
momentum, independent of the observer; configured spin periods match their approximate model
periods. Earth's fixed frame stays compatible with Manaus. Lunar geography uses its physical
fixed frame; landing fixtures now specify positions in that frame, preserving tile-boundary,
clearance, ENU and continuity assertions. NASA lunar elevation/albedo payloads are unchanged.

The pre-edit audit found no satellite-specific cruise or sweep implementation necessary:
navigation resolves identity against live system positions, exclusions enumerate every body,
and local handoff already checks `canLand`. Dominant-body selection remains gravitational.
Ganymede/Titan neighbourhoods are stable under small perturbations; no hysteresis was needed.
Enceladus may still report Saturn as dominant because Saturn's absolute acceleration wins;
the global gravity model was not changed.

## SPACE-HARDENING-1 runtime contract

Baseline: `f8f451250e564958ffad20d26b72df3fe4c9e6de`, branch `feat/universe-map`.
The user's latest hardening request takes precedence over feature expansion in the older roadmap.

### Camera and audio

The old camera applied the local Euler pitch clamp in interplanetary space and rebuilt the view
with `lookAt`. Flight then computed right from a world-up cross product, which degenerates at a
pole. `CameraController` now maintains a normalized space quaternion; local yaw/pitch values are
compatibility readouts. `prepareLook()` runs before propulsion. `cameraFlightAxes()` rotates the
canonical camera basis, so W and the centre screen ray agree even after vertical rotations.
Space update bypasses local terrain/camera sweeps. Surface return transports the outgoing view
from the render frame into the body's ENU before restoring the existing local pitch limits.

The ambience generator previously interpreted speed alone as wind everywhere. Its explicit
environment now contains medium, density, speed, altitude and local rain/river flags. Earth density
uses an 8.5 km exponential scale height and rounds the inaudible tail to zero. Both wind and other
environmental ambience are zero for vacuum/airless terrain; impact/power effects use their own bus.

### Earth geography and physical size

The old distant Earth was a dim blue procedural disc without geographic information.
Its point core is now 3.5 px, with an 8 px bounded glow extent. These are optical presentation
dimensions only. Point weight fades into `GeographicBodyVisual`, whose colours sample the existing
Natural Earth land mask with `surfaceColour()`. Continents, oceans and latitude-based ice/arid
tints therefore share the existing Earth data rather than random shader shapes.

Geographic spheres use `bodyFixedOrientationRender`, the actual fixed-frame transform, rather
than the additional catalog-only tilt used for analytic bands/rings. Their radius is
`sin(physicalAngularRadius) * boundedProxyDistance`; a spherical proxy therefore subtends the
physical angle exactly. The existing EarthProvider/globe becomes the owner once its fallback or
view coverage is ready. No astronomical Object3D positions, physical-radius inflation, new Earth
streamer or runtime geography service were introduced. The constant proxy mesh count is now
13: ten point/body proxies, two geographic spheres and Saturn's analytic rings.

### Moon coverage, data and landing

The old rocky-body plan could truncate before reaching a contact tile, even with nearest-first
traversal: equal-distance branches at a boundary exhausted the cap first. Readiness also required
the whole visible cut. There was no complete coarse backup, and retiring a cut could expose holes.
The material used Earth fog and multiplied its sampled vertex colour twice, dimming the lunar
surface. Distance blending could leave both the analytic proxy and the physical globe visible.

The shared quadtree now reserves a 100 m contact footprint at level 8 (or the configured maximum)
before spending the remaining budget. Boundary neighbours are included and marked gameplay
critical. The cap remains unchanged; active landing keys, rather than every distant tile, govern
`surfaceCoverageReady`. Coarse mode still uses the normal SSE policy. Retired cuts cannot remain
visible on top of the current one.

The active physical body lazily creates six fallback faces within its existing globe. Moon orbital
faces use a bounded 65×65 grid to retain mapped maria and relief; refined local tiles retain the
17×17 grid. A simple 4 m vertex offset is insufficient for a measured basin between coarse vertices:
the lunar fallback instead takes the minimum DEM cell value over each vertex's neighbouring facets,
then applies that offset. Bilinear cells and pole blends are bounded by those minima, and convex
facet interpolation remains below authoritative terrain. This is a conservative presentation
approximation, not the height used for collisions. Refined vertices and `PlanetTerrainProvider`
continue using `planetSurfaceRadius()` and the same measured elevation. Fallback triangles are
included in globe statistics. The root/material/opacity are shared, Earth fog is disabled, albedo
is applied once, and a ready physical Moon fully retires its proxy.

The primary Moon source is NASA's 2019 CGI Moon Kit, ingested offline and bundled with pinned
source hashes, attribution, datum and projection. NASA's 1,737,400 m spherical datum is converted
to relief over the unchanged catalog ellipsoid. Radius, ephemerides, cruise exclusions and arrival
physics retain their catalog authority. Rendering/terrain share the converted measured surface;
sampling wraps the antimeridian and converges to longitude-independent polar averages.
See [lunar ingestion details](06-geodata-pipeline.md#lunar-elevation-and-appearance).

Two functional issues prevented reliable walking. Returning above the ground teleported the player
into `Hover`, which omitted gravity; terrain contact did not end downward flight. Return now uses
`Falling`, keeps transported local velocity, places an already penetrated arrival above the actual
floor, and lets swept collision establish `Grounded`. Downward flight contact also ends flight.
Airless entry/return gates measure actual shared terrain clearance, avoiding a late handoff inside
highlands. Thresholds remain 9 km departure / 7 km return and 10 km/s maximum relative return speed.
Game binds the real planetary terrain and body gravity (Moon catalog value ≈1.622957 m/s²); the
existing player motor preserves Earth's established jump impulse and scales its gameplay gravity
by the body's ratio. No alternate Moon landing class, debug shortcut or hidden key is involved.

City impact bursts were another source of large warm polygons in a lunar landing view. Airless
landings now retain a bounded energy ring/SFX while suppressing city debris, deformation hooks
and unearned crater notices. This does not implement lunar deformation or volume Phase 2.

`Game.moonLandingState` and F3 expose actual terrain clearance, Moon-relative speed, frame/domain,
gates and blocking reason, contact coverage/missing keys, active tiles, fallback activity and
proxy/globe ownership/opacities. Game's physics diagnostic exposes the bound body, gravity and floor.

### Universal map

The old DOM placed the sidebar first while CSS gave the large column to it. The universal canvas
also stretched a fixed 800×600 backing store, advanced its own orbit time, projected the wrong
ecliptic plane and printed a city-only scale. Explicit grid areas now produce a 94 vw × 88 vh
desktop panel, 320 px sidebar and a large canvas. Smaller screens stack the canvas and sidebar.
Each draw measures CSS dimensions, resizes the backing store and draws in CSS units with DPR ≤2.

System positions come from live HUD barycentric samples; its projection is ecliptic XY. Square-root
radial compression keeps Neptune and the inner planets readable at default zoom; scale text
explicitly says it is compressed. Wheel zoom is bounded to 0.5–16, finite and preserves radial
order. Names, target rings and nearest-marker hit testing are present; clicks select navigation
identity, while explicit translocation retains its separate existing action. The sidebar offers
body names and distances instead of overlapping XYZ columns. All five level controls remain,
with an active state. Interplanetary entry defaults to System and non-Earth local surfaces default
to Planet; Manaus's city canvas is restricted to its actual frame. Panning was not added.

### Changed files and verification

| Area | Files |
| --- | --- |
| Input/motion/audio | `src/player/CameraController.ts`, `src/player/PlayerController.ts`, `src/player/powers/PowerSystem.ts`, `src/audio/AudioManager.ts` |
| Gameplay/gates | `src/game/Game.ts`, `src/world/travel/TravelDomain.ts` |
| Planet surface/coverage | `src/world/planet/PlanetSurface.ts`, `PlanetGlobe.ts`, `PlanetQuadtree.ts`, `MoonSurface.ts`, `MoonSurfaceData.ts`, `src/world/providers/RockyPlanetProvider.ts` |
| Celestial presentation | `src/rendering/celestial/GeographicBodyVisual.ts`, `CelestialBodyVisualLayer.ts`, `CelestialPresentationController.ts`, `types.ts`, `src/world/celestial/CelestialBodyProfile.ts` |
| UI/map | `src/ui/HUD.ts`, `src/ui/style.css`, `src/ui/map/UniversalMapPanel.ts`, `MapRenderers.ts` |
| Lunar artifact/tooling | `src/world/geodata/moon-surface.json`, `scripts/geodata/build-moon-surface.py`, `requirements-lunar.txt`, `.gitattributes` (stable LF artifact hash) |
| New regressions | `tests/space-hardening.test.ts`, `moon-landing-hardening.test.ts`, `universal-map-hardening.test.ts` |
| Existing regressions | `tests/celestial-presentation.test.ts`, `solar11-presentation.test.ts`, `planet-terrain-physics.test.ts` |
| Browser/commands | `scripts/space-hardening-browser.mjs`, `package.json` |
| Authoritative documentation | `docs/world/10-solar-system.md`, `15-status.md`, `06-geodata-pipeline.md`, `specs/Promptatual.md` |

On 2026-10-02: **52 added unit tests**, **110/110 focused** and **491/491 full** tests passed;
typecheck, production build and diff checks passed. The build's existing bundle-size advisory remains.
`npm run build` followed by `npm run test:browser:space` passed with installed Playwright/Chromium:
map layout/canvas, automatic System selection, quaternion pole rotation, exclusive complete lunar
globe, actual streamed Game return into `moon/local-enu`, Grounded, keyboard walking, jump and
takeoff, with no captured page/console errors. Screenshots and diagnostics are under ignored
`artifacts/space-hardening-*`; screenshots were inspected and exposed/fixed the impact-particle leak.
The browser's incoming fixtures cover the real gameplay handoff but do not claim a manually flown
Earth–Moon–Earth trip. User manual validation remains pending for the full travel/control matrix,
Earth geographical transition, lunar phases/limbs/seams at additional sites, wind/SFX perception
and other display/GPU configurations. Lunar centimetre-scale terrain is not provided by this DEM.

This checkpoint ends here. Task 012, additional moons and volume Phase 2 remain future work.

Implements `10-SOLAR-SYSTEM.md`. Code: `src/world/celestial/`.
Tests: `tests/solar-system.test.ts`, `tests/solar11-*.test.ts`, plus existing landing/render regressions.

**Status: Task 011 implemented (SOLAR-11), initial HEAD `47dd452`.** All eight planets, the Moon
and Sun have observer-relative angular visuals and remain selectable as live navigation targets.
Earth keeps its specialized provider; other solid bodies share a registry and a surface pipeline.
Visual quality and the full manual travel matrix still require user validation.

## Bodies — `CelestialBody.ts`

Ten bodies: the Sun, the eight planets and the Moon. Real radii, real masses, published physics.

Venus and Uranus carry **negative** rotation periods, because they genuinely turn the other way.
That is a fact about the solar system, not a sign convention, and encoding it as data rather than
as a special case means nothing downstream has to know.

Derived rather than stored, so there is one place to be wrong: `gravitationalParameter`,
`surfaceGravityMps2`, `escapeVelocityMps`, `sphereOfInfluenceM`.

## Ephemerides — `EphemerisProvider.ts`, `OfflineEphemeris.ts`

Positions come from **published Keplerian elements with secular rates** — JPL's approximate
positions of the major planets — evaluated at the requested epoch.

Why not a downloaded dataset:

- A few hundred numbers, embedded as constants. No network at any point, which the project rules
  require and which also means no failure mode.
- Bit-identical on every machine and every run, which is the determinism rule.
- Accuracy in arcminutes over a span of centuries, which is what the specification asks for: the
  order, the distances and the motion — not navigation precision.

Kepler's equation is solved by Newton iteration to 1e-12, with the standard seed. `elementsAt`
applies the secular rates; `positionFromElements` builds the heliocentric position;
`velocityFromElements` differentiates it.

## Which body you belong to — `SolarSystem.ts`

`dominantBody()` decides by **gravitational acceleration at the player's position**, not by a
distance threshold someone picked.

Standing on the Moon, the Moon wins — though the Earth is 81 times its mass, it is 60 Earth radii
away and the inverse square settles it. That makes the frame handoff physical: it happens where
physics says it happens, which is also where it looks right.

`handoff()` reports the transition state, including `directionalRadiusM` — the distance at which a
body stops being a place and becomes a direction in the sky.

## Distant bodies reach the renderer as an angle

Never as a scaled position. A body far away is drawn at its **angular size**, so the Sun sits at a
genuine astronomical unit without one astronomical number ever reaching a vertex buffer. The tests
assert the Moon and the Sun both come out at about half a degree across, which is the check anyone
can make by looking up.

The planets are asserted to sit at their real J2000 distances, in the right order.

## Capabilities and physical authority

`CelestialBodyProfile.ts` describes capabilities and compact visual metadata. It contains no
radius, mass, rotation period, frame or ephemeris copy. `CelestialBody.ts` remains the physical
catalog. `PlanetBodyAdapter.ts` derives surface models from that catalog; `PlanetBody` introduces
no third physical definition. Existing `MOON`/`MARS` exports now use that adapter.

| Bodies | Surface / provider | Landing | Visual |
| --- | --- | --- | --- |
| Sun | None | No | Emissive angular disc/corona |
| Mercury | Synthetic base ellipsoid / generic rocky provider | Yes, coverage gated | Dark grey |
| Venus | Synthetic base ellipsoid / generic rocky provider | Yes, coverage gated | Cream/yellow |
| Earth | Existing WGS84, Natural Earth, ETOPO / EarthProvider | Existing Manaus flow | Existing globe |
| Moon | Existing deterministic synthetic relief / generic rocky provider | Yes | Grey |
| Mars | Existing deterministic synthetic relief / generic rocky provider | Yes | Rust/red |
| Jupiter, Saturn | No solid gameplay surface | No | Procedural bands; Saturn also has rings |
| Uranus, Neptune | No solid gameplay surface | No | Cyan / deep blue |

Mercury/Venus terrain is explicitly synthetic, with zero relief above the catalog ellipsoid.
It is not measured topography. Venus receives no new atmospheric physics. Its `hasAtmosphere`
capability does not claim a pressure, heat or cloud simulation. Lunar/Martian relief remains
synthetic as before. Earth retains its existing surface and transition implementations.

The catalog-derived Moon polar radius differs from the previous `1/1130` model by about 561 m
(under 0.04% of its radius); Mars differs by less than a metre. Derived gravitational parameters
remain within 0.1% of the former rounded constants. Tests compare both catalog identity and these
baseline tolerances. Render, terrain collision, handoff and volume now use the same models.

## Generic presentation and streaming

`CelestialPresentationController` loops over `activeSystem.bodies`, computing live position,
observer-relative distance/direction, angular radius, phase light and visual orientation once.
The Sun uses a specialized luminous material; Earth retains its specialized provider handoff.
The duplicated Earth/Moon/Mars mathematics and Game's Moon/Mars surface ternary are removed.

`Game.planetProviders` resolves providers by `bodyId`. The `moon`/`mars` getters remain only for
existing browser diagnostics. `createPlanetProviders` registers four lightweight shells with the
existing global scheduler: Mercury, Venus, Moon and Mars. Registration creates no terrain tiles.
Only the largest render-safe nearby solid body is permitted to request physical tiles at a time.
Far bodies use cheap proxies. Moving away retires their terrain through the existing scheduler;
there is no scheduler per planet and no multiplied frame budget.

The overview test observes zero resident terrain. The nearby-Mercury test observes real streamed
tiles only for Mercury, bounds global fetching/activations and verifies retirement on departure.
Debug telemetry reports proxy count, active physical body/mode, resident tiles by body and selected
destination without exposing astronomical arrays in the normal HUD.

Proxy centres are unit directions multiplied by a bounded proxy distance (at most 5,000 km).
Geometry scales include rings/corona in the far-plane and 10,000 km render bounds. Physical centres
pass through RenderSpaceService and its 20,000 km safety gate before touching Object3D transforms.
Unsafe centres keep their proxies. Previous Earth proxy tests hid Earth at a 40,000 km centre,
although EarthProvider refused to draw there; those tests now verify the visible proxy fallback
and exercise coarse-globe handoff inside the safe bound instead.

## Saturn rings

One 96-segment unit annulus shares Saturn's proxy parent and opacity. Dimensionless radii are
1.25–2.3 times the proxy radius. The material supplies simple procedural radial variation; no
texture download or network dependency is added. The annulus orientation uses the catalog axial
tilt converted into the active render frame, independently of the planet billboard. The current
fixed frames omit obliquity, so this is a visual axial model and does not rewrite Earth/Manaus
physics. Hiding Saturn hides its rings; their entire extent fits the proxy's far-plane budget.

## Navigation and exclusions

`BodyNavigation.ts` stores destination identity and resolves coordinates from the current system
every update. Selection never teleports. Arrival policy comes from radius and body class:

| Class | Arrival margin above reference radius | Deep-body exclusion margin |
| --- | --- | --- |
| Solid | `max(50 km, radius × 0.01)` | 1 km |
| Gas / ice giant | `max(1,000 km, radius × 0.25)` | Same as arrival |
| Star | One physical radius | Same as arrival |

These are gameplay clearances, not scientific atmosphere models. Cosmic cruise sweeps all live
body exclusions, even unselected bodies, so a warp step cannot cross an entire star/giant between
frames. Arrival assistance additionally protects a target while another body is dominant. Once a
solid target becomes dominant, its arrival margin stops acting as a collision floor and the
smaller surface envelope permits manual descent. `canLand` and loaded surface coverage gate local
physics. Stars/giants cannot create a surface handoff or a rocky terrain provider.

## Volume compatibility and remaining work

`surfaceForBody` returns the same PlanetSurfaceGenerator contract for every supported solid body.
The capability `supportsVolumeDestruction` and body identity provide the future connection to
PlanetVolumeField, PlanetVolumeEditStore and PlanetVolumeEditIndex. There is no provider-class
check, competing destruction architecture or new resident volume chunk. Volume Phase 2, meshing,
collision/gameplay integration and major moons remain separate checkpoints.

Automated tests cover profile completeness, catalog adaptation, provider registration, all ten
render samples, finite/bounded transforms, monotonic angular size, ring orientation/scaling,
live ephemerides, generic cruise, star/giant sweeps, solid descent and the global streaming budget.
Existing Earth/Manaus and Moon/Mars regressions remain part of the full suite.

Validation on 2026-10-02: **427/427 unit tests passed**, including 34 new SOLAR-11 tests;
`npm run typecheck`, `npm run build` and `git diff --check` passed. The build retains its bundle-size
advisory. `npm run test:browser` launched the game with no captured page/console errors but failed
in its destruction setup at `scripts/browser-test.mjs:265`: it passes the removed `game.origin`
to `TerrainDestruction.update`. The same stale access exists in initial HEAD `47dd452`; the script
also still references the old `player.armed` input API. Browser E2E is therefore not verified by
this checkpoint. Its ignored artifacts record the failure; no test assertion was removed.

**Requires user manual validation:** spawn/play in Manaus, leave Earth, inspect all ten map entries,
travel toward each planet, verify smooth proxy growth and Saturn's rings, verify giants remain in
travel mode, return to Earth/Manaus, land on the Moon, and check for jitter/disappearing planets.
Automated rendering structure and browser smoke are not approval of these visual results.

## Celestial legibility checkpoint

CELESTIAL-LEGIBILITY-1 continues from the already present `4529b9d` visual commit. The existing
presentation pipeline now records `physicalProjectedDiameterPx` separately from
`presentationDiameterPx`. Perspective projection supplies these pixel measurements; provider
eligibility still uses its unchanged physical LOD and handoff. Physical radii, live distances,
ephemerides, cruise/warp, arrival policy, surface streaming and volume fields are unchanged.

`BodyVisualProfile` owns the optical settings. Earth's minimum disc is 2.5 pixels, with a blue
4-pixel glow at strength 0.35. The point colour blends into phase shading as the physical diameter
grows from the configured floor to three times that floor. Other planets retain distinct albedos
and floors of 1–2.5 pixels. The Moon uses neutral 0.65 albedo and a 0.08 ambient/night-side floor,
preserving substantially brighter illumination and the terminator instead of a uniform white disc.

The Sun retains its physical angular disc, with a warm inner halo extending to twice its radius
and a low-opacity corona reaching five times its radius. Optical extents participate only in the
bounded proxy/far-plane budget. The corona and point floors never enlarge collision, navigation,
handoff or provider activation radii. Both shaders fade radially to transparent before the quad
boundary; point glow is disabled in resolved-disc mode.

Saturn keeps the same analytic annulus and orientation. Ring opacity is zero below a **6-pixel
physical outer diameter**, smoothly increases between 6 and 9 pixels, and reaches full opacity at
9 pixels. An expanded point marker cannot make subpixel rings visible.

`CelestialLabelLayer` is a pointer-transparent DOM overlay with Portuguese names for all ten
bodies. It projects only bounded observer-relative proxy positions through the camera rotation
and projection matrix. Selected targets remain eligible even after a physical globe replaces its
proxy. Distant Earth labels appear in travel and fade as its physical disc grows from 6 to 18
pixels; Moon labels require Earth/Moon travel context or selection. Unselected Sun labels avoid
the centre, and other planets need a resolved disc. Continuous opacity and CSS transitions soften
thresholds; invalid, behind-camera and off-screen anchors hide immediately. Text is clamped inside
the viewport without adding astronomical Object3D positions or pointer targets.

The presentation tests use the repository's `node:test` runner, replacing the incompatible Vitest
imports in `4529b9d`. Twelve tests cover physical/presentation separation, exact Earth direction,
all ten finite point samples, solar optical extents, Moon brightness parameters, continuous
regimes, selected labels including physical globes, projection rejection/rebases, travel label
policy and Saturn's physical ring threshold. The existing SOLAR-11 tests remain unchanged.

Validation on 2026-10-02: **439/439 unit tests passed**, including the 12 legibility tests;
**58/58 focused celestial/SOLAR-11/render-space tests passed**. Typecheck, production build and
`git diff --check` passed. The build retains the existing bundle-size advisory. The existing
browser command was executed: WebGL 2 boot succeeded with no captured page/console errors,
then its destruction setup failed on the stale `game.origin` access at
`scripts/browser-test.mjs:265` (call starts at line 263). This predates the checkpoint and leaves
browser E2E unverified. No browser tooling was installed and no assertion was removed.

**Requires user manual validation:** leave Earth and look back at increasing distances; verify a
subtle blue point and TERRA label, label fading on approach, full/half/crescent Moon visibility,
the physical solar disc with a soft corona, selected planet labels and screen edges, and Saturn's
rings appearing without subpixel shimmer. Automated numeric/structural tests do not establish
visual quality or complete the manual travel matrix.
