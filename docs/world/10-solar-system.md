# The solar system

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
