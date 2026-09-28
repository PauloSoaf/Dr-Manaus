# Planetary architecture — implementation status

Tracks `dr-manaus-cosmic-world-specs` against the code, phase by phase. Written so that anyone
picking this up knows what is finished, what is half-finished, and what has not been started —
including the things that do not work.

Baseline: `d2e03428b1d9ba90fdc7b2a5112c280e6686fead` (PR #2 merged into `main`).
Branch: `feat/universe-map`.

This is the progress tracker. The subject documents are listed in [README.md](README.md); the
acceptance criteria are checked one by one in [17-acceptance.md](17-acceptance.md).

## Phase status

| # | Phase | State | Where |
| --- | --- | --- | --- |
| 0 | Freeze baseline | **done** | [`../geodata.md`](../geodata.md) corrected; invariants pinned in tests |
| 1 | Spatial core | **done** | `src/world/spatial/` — [03](03-coordinates-and-frames.md) |
| 2 | Manaus compatibility adapter | **done** | `ManausFrameAdapter` — [05](05-manaus-migration.md) |
| 3 | Global streaming scheduler | **done** (not yet driving Manaus) | `src/world/streaming/` — [07](07-streaming.md) |
| 4 | Earth WGS84 low LOD | **done** — drawn, streamed, lit | `src/world/planet/` — [04](04-earth-and-planet-surface.md) |
| 5 | Global terrain (DEM) | **done** — ETOPO5, real relief | `EarthElevation.ts` — [06](06-geodata-pipeline.md) |
| 6 | Curve Manaus onto the ellipsoid | **partial** — `SurfaceTileFrame` exists; `FEATURES.curvedManaus` is off | `SurfaceTileFrame.ts` |
| 7 | Atmosphere and render domains | **partial** — domains done, atmosphere not | `src/rendering/domains/` — [08](08-render-domains.md) |
| 8 | Remove the 140 km ceiling | **done** — 500 000 km, still a ceiling | `SPACE.maxAltitude` |
| 9 | Solar system | **done** (logical model) | `src/world/celestial/` — [10](10-solar-system.md) |
| 10 | Galaxy layer | **partial** — streamed provider, behind its flag | `StarSectorProvider.ts` — [11](11-galaxy-and-universe.md) |
| 11 | Universe sectors | **partial** — addressing and seeds only | `UniverseAddress.ts` — [11](11-galaxy-and-universe.md) |
| 12 | Persistence hardening | **done** — versioned, addressed, IndexedDB | `WorldMutationStore.ts` |
| 13 | Hardening | **verified** | Visual, architectural, ephemeris and coordinates hardening (`tests/earth-transition.test.ts`, `tests/universe-coordinates.test.ts`, `tests/universe-navigation.test.ts`) |

Everything is gated by `FEATURES` in `src/core/config.ts`. `spatialCore` and `earthGlobe` are on;
the rest are off. Below 15 km nothing about the game has changed — the city, its sky and its
horizon are exactly what they were. Above it the flat backdrop stands down and the real ellipsoid
takes over.

## What is verified

308 unit tests, `npm run build`, and `npm run test:browser` pass. The city is unchanged at ground level, checked by eye at
400 m and 12 km as well as by test. Earth is verified present in orbit (~236.3 km) through coarse fallback ellipsoidal guarantee.

Specific invariants under test:

- WGS84 constants are the defining ones; the ECEF inverse round-trips to sub-millimetre from the
  surface to geostationary altitude.
- The Manaus projection is reproduced bit for bit, and the coordinates the shipped game produced
  before the migration are frozen in the test — if the projection moves, the city moves.
- A rebase never changes a logical position, a distance between objects, or the origin's rotation.
- A tile's four children exactly tile their parent; the poles are ordinary tiles.
- Planet tile vertices land on the ellipsoid *through the full scene transform*, and the residual
  is float32 storage of the offsets — precision scales with the tile, not with the globe.
- The planets sit at their real J2000 distances in the right order; the Moon and the Sun both come
  out about half a degree across.
- Star sectors regenerate identically from the same seed.
- Heavy activations stay capped at two per frame while light ones get their own larger allowance.

## Phase 4 — the globe

Working. From about 15 km the flat backdrop stands down and the WGS84 ellipsoid takes over: a
cube-sphere quadtree refined by screen-space error, streamed through the global scheduler, coloured
from Natural Earth coastlines and lit from the real solar direction. From a few thousand kilometres
up it is a round planet with South America where South America is.

### The five bugs between "all the code exists" and "the planet is on the screen"

Recorded because every one of them presented as something else, and because the first diagnosis was
wrong in a way worth remembering.

1. **Nothing was ever activated.** The scheduler planned, fetched and cached ninety-six tiles and
   put zero of them in the world. `update` fetched before it activated, so planning and loading
   spent the 4 ms frame budget and activation was asked for permission it could never get. The
   stage order is now plan, rank, track, **activate**, fetch, retire, and a frame that is already
   over budget still places one tile. See [07-streaming.md](07-streaming.md).
2. **Planning cost more than the whole streaming budget.** A quadtree selection at orbital altitude
   measured **2.34 ms**, re-derived sixty times a second for a camera that had not moved. It is now
   memoised against camera movement, quality and a replan interval: **0.01 ms**.
3. **The fog was cleared by nulling `scene.fog`.** A material compiled with fog keeps a node that
   reads `scene.fog.color`, so the first fogged draw threw and every object after it in that pass
   was lost — a pass that reported its draw calls and produced no pixels. Fog is now off on the
   globe's own material.
4. **Two render passes do not composite.** The whole two-camera design could not work: in
   `WebGPURenderer` the second `render()` to the screen replaces the first. Replaced by one camera
   and the logarithmic depth buffer, which is what that buffer is for. See
   [08-render-domains.md](08-render-domains.md).
5. **Half the planet was black in full sunlight.** Three of the six cube-face parameterisations
   mirror, so one fixed index order winds outward on half the globe and inward on the other half.
   `DoubleSide` hid that and then lied about the lighting: a back face is shaded with its normal
   flipped, so tiles facing the Sun were shaded as though the Sun were beneath them. The winding is
   now measured per tile from the geometry, and the material is `FrontSide`.

Two more, found earlier and already described in [04](04-earth-and-planet-surface.md): tiles placed
without their rotation, and breadth-first quadtree descent.

### The measurement that mattered

The first conclusion — "the far pass draws and produces no pixels" — came from reading the canvas
back with `drawImage`, which returns black for a WebGL canvas without `preserveDrawingBuffer`
whatever is on it. The whole frame measured black, including frames that plainly were not. Every
later measurement used a composited screenshot instead.

### Shading

The globe shades itself. `MeshBasicNodeMaterial` takes no part in the light list, and the surface is
lit explicitly against a sun uniform in TSL: a lambert term with a terminator softened across a few
degrees, a small night floor for airglow, and a Rayleigh-blue halo that rises with the viewing
angle so the limb is blue and the centre of the disc is not.

That is not a stylistic choice. There is one camera and therefore one light list, and the scene's
lights belong to a city at golden hour — one sun near the horizon and a bright hemisphere fill.
Applied to a planet they wash the day side out and lift the night side off the black, and the
terminator disappears with them. A planet is lit by one star and shades itself.

The stars stayed after all. They had been stood down on the theory that the star sphere carried the
sky gradient; reading the shader showed it does not — the stars are additive points and the
gradient is the shell's. They are back above 15 km, and the shader already fades them below the limb.

### What is still visibly missing

- **No atmosphere as a volume.** The limb is a shading term on the surface, not scattering: there
  is no glow beyond the edge of the globe and no sky seen from inside.
- **No terrain.** Every tile sits at height zero: an ellipsoid, not a landscape.
- The tile under the city is a hole of about 60 km while `coveredByCity` is level-based; harmless
  from orbit, and closed by phase 6.

## Phase 7 — render domains

Done, and not the way it was designed. See [08-render-domains.md](08-render-domains.md) for one
camera, a logarithmic depth buffer, and why two passes were abandoned.

Not done: a planet-aware atmosphere and a global ocean. `Atmosphere.sky` is still a 44 km dome
drawn around the player, and it now stands down above 15 km rather than being replaced.

## Phase 8 — the ceiling

`SPACE.maxAltitude` was 140 km because a flat world has no outside. With the planetary domain it is
500 000 km — past the Moon — while the globe flag is on, and 140 km otherwise.
It is still a ceiling rather than nothing: the phase that removes it entirely is the one that
hands the player into another body's frame.

## Data and licences

| Asset | Source | Licence | Retrieved |
| --- | --- | --- | --- |
| `src/world/geodata/earth-landmask.json` | Natural Earth 1:110m land | Public domain | 2026-09-25 |
| Solar system ephemerides | JPL approximate elements (Standish), embedded as constants | Public domain (US Gov) | n/a — no download |

Neither is fetched at runtime. The Natural Earth download happens only when the build script is
run by hand. Full provenance and the rules that constrain it are in
[06-geodata-pipeline.md](06-geodata-pipeline.md).

## A correction to this document

An earlier revision of this file recorded phase 6 as done, `ManausProvider` as created and
registered, and the Earth handoff gate as removed. None of those were true when written, and the
first two were reversed in the very next commit:

- `ManausProvider` was a stub whose `load` rejected and whose `activate` threw. It was deleted, not
  finished, which is the resolution P0-01 asks for when a provider is not ready.
- `FEATURES.curvedManaus` is **off**. `SurfaceTileFrame` exists and the tile transform is written,
  but the city is not curved in the shipped configuration.
- The 15 km gate and `coveredByCity()` were removed and then restored, because removing them is
  what P0-02 exists to prevent: the city is a flat plane, the globe is an ellipsoid, and they are
  31 m apart at 20 km from the anchor.

The rule that failed here is the one at the top of this folder: a status is a measurement, not an
intention. If a flag is off, the phase is not done.

## Next step

1. **Sprint H2 — `ManausProvider`.** The city still streams through its own `WorldStreamer`, so
   the two budgets are independent and neither knows what the other is spending. This is the piece
   that makes the global scheduler mean something.
2. **Sprint H5 — the travel domain.** P0-04 is half closed: local physics no longer sees FTL
   speeds, but there is no separate domain to put them in, and so no body handoff and no landing
   on the Moon. The altitude ceiling comes out after that works, not before.
3. **Phase 6 — curving Manaus.** `SurfaceTileFrame` is written; turning `curvedManaus` on is what
   closes the 60 km hole under the city and lets the 15 km gate go. Both are gated on it, and both
   are wired to the flag rather than to a constant, so the day it flips they follow.
4. An atmosphere as a volume rather than a shading term on the surface, and an ocean.

## Hotfix v1 — Interplanetary Flight & Terrain Hardening (`feat/universe-map`)

Status: **verified** (T1–T11 unit/integration tests passing; 318 test suite passing; production build clean).

`FEATURES.curvedManaus` remains **`false`**, preserving the legacy flat world baseline without regressions.

### Root causes identified & resolved

1. **Interplanetary flight ping-pong & teleporting:**
   - In orbital / interplanetary space, when Earth was the dominant celestial body, `UniverseRuntime.telemetry` and `spatialContext()` interpreted barycentric coordinates as local Manaus tangent-plane coordinates, passing them to `legacyLocalToGeodetic` / `legacyLocalToEcef`. This produced bogus altitude spikes (millions of metres) and triggered rapid flip-flopping between `interplanetary` and `local` travel domains (`interplanetary → local → interplanetary`), manifesting visually as violent uncontrollable teleportation.
   - Thrust, braking, and velocity clamping in `InterplanetaryController` operated on the absolute barycentric velocity (~30 km/s Earth orbital velocity), causing braking to fling the player backward relative to Earth at orbital speed.
   - Releasing the thrust key (`B`) immediately cleared `requested` and handed the player back to local coordinates, causing instantaneous snapback from deep space.
   - `Game.ts` wrote `floatingOrigin.toRenderLocal()` directly to the player visual proxy on every frame, causing visual and camera jumps during origin rebases.
   - Local systems (`streamer`, `hlod`, `largo`, `discovery`, `population`, `traffic`) continued executing heavy tasks during interplanetary travel.

2. **Ghost ground inside craters:**
   - Although `FEATURES.curvedManaus` was disabled (`false`), `src/world/geodata/terrain.ts` was unconditionally bending `ground-cover`, `terrain-backdrop`, shores, and roads using `surfaceService.legacyPointToRenderLocal()`.
   - `TerrainDestruction.ts` applied crater depth masking only within a narrow vertical band `surfaceMinY <= y <= surfaceMaxY`. The curved backdrop mesh dipped below this band and escaped the cutout node, causing the lower green polygon to render inside crater excavations.

### Changes implemented

- **Frame-aware geodesics (`UniverseRuntime.ts`, `EarthProvider.ts`):** `playerEcef()` and `playerGeodetic()` check `this.telemetry.frame`. Barycentric positions near Earth are transformed to `EARTH_FIXED_FRAME_ID` first, then mapped to WGS84 without ever touching the Manaus tangent plane.
- **Unified dominant body resolution (`UniverseRuntime.ts`):** `resolveBodyContext()` computes altitude against the actual dominant body across both telemetry and spatial context uniformly.
- **Relative flight dynamics (`InterplanetaryController.ts`, `Game.ts`):** Flight controls, thrust, braking, and speed clamping operate strictly on relative velocity `v_rel = v - v_body`. Maximum relative speed is clamped to 222,222 m/s. Dynamic speed metrics for VFX, camera shake, and HUD are derived from relative speed.
- **Coasting on thrust release (`TravelDomain.ts`):** Releasing `B` leaves the player in interplanetary coasting when `altitudeM > returnAltitudeM` (7,000 m).
- **Hysteresis & reentry safety gate (`TravelDomain.ts`):** Transition back to `local` domain requires BOTH low altitude (`altitudeM <= 7,000 m`) and safe relative speed (`speedMps <= 10,000 m/s`).
- **Visual stability & subsystem pause (`Game.ts`):** Floating origin rebasing is active only in `local` mode. In `interplanetary` mode, local streamer, HLOD, largo, discovery, NPC population, and traffic are paused.
- **Flat terrain integrity (`terrain.ts`):** Curvature application across all terrain meshes and road ribbons is strictly gated on `FEATURES.curvedManaus === true`.
- **Sheet crater masking (`TerrainDestruction.ts`):** Terrain sheets (`backdrop`, `ground-cover`, meshes with `userData.terrainSurface === 'sheet'`) use full vertical masking (`crater-sheet`) without the vertical Y band restriction.

### Acceptance test verification (T1–T11)

- **T1:** Barycentric altitude near Earth in orbit (~100 km) evaluates to ~100 km, never ~6,378 km or Manaus-distorted.
- **T2:** 600-frame continuous ascent tracks moving Earth's barycentric trajectory without altitude oscillation.
- **T3:** Releasing `B` at 50,000 m maintains `interplanetary` travel domain and coasts at current velocity.
- **T4:** Reentry gate rejects handoff when altitude is low but speed is excessive (> 10 km/s).
- **T5:** Altitude hysteresis prevents domain flip-flop between 7 km and 9 km.
- **T6:** Braking at orbital speeds slows relative velocity to zero without fighting Earth orbital motion.
- **T7:** Relative velocity is clamped to <= 222,222 m/s.
- **T8:** Floating origin rebase does not shift the player visual model in space.
- **T9:** Flat terrain meshes (`ground-cover`, `backdrop`, `roads`) remain at authored flat elevations when `FEATURES.curvedManaus` is `false`.
- **T10:** `terrain-backdrop` and `ground-cover` receive `'sheet'` crater masking across full vertical depth.
- **T11:** Crater physics depth and visual bowl depth agree within grid tolerance.

## Hotfix P0 — Visual Proxy, 3-Root Scene Separation & Camera-Relative Earth (`feat/universe-map`)

Status: **verified** (326 unit tests passing; typecheck passing; build clean; browser E2E passing full authentic ascent to 1,000 km, nadir orbit and atmospheric reentry).

Baseline HEAD: `2609e4d30901720f9b18e05939f717e590dc7140`

### Root causes identified & resolved

1. **Character visual freeze and HUD 0 km/h at ~9.8 km (Screenshot 2):**
   - Handoff at 9 km disabled `PlayerController.update()` and set `player.velocity.set(0, 0, 0)`.
   - Character animation was previously invoked only inside local `PlayerController.update()`, freezing the 3D model in its last frame.
   - HUD speed readout read `player.velocity.length()` directly, dropping to 0 km/h despite traveling at logical interplanetary speed (~222 km/s / 800,000 km/h).
   - `CameraController` continued running raycast and ground clamping against Manaus terrain colliders while in travel mode.

2. **Black voids, star leakage, and local world fragments at 20–60 km (Screenshot 1):**
   - Single `worldRoot` combined local city, player, and planetary globes. Hiding the world hid the actor; keeping the world drew Manaus floating in deep space.
   - `EarthTransitionController` computed `regionalWeight` in the 20–60 km range, but no regional renderer existed, zeroing `localWeight` and leaving an unrendered void.
   - Without camera-relative rendering, barycentric Earth positions delivered coordinates on the order of 1 AU (~$1.49 \times 10^{11}$ m) into Three.js `Object3D.position`, causing extreme Float32 jitter or clipping outside the far plane.
   - Star layer lacked depth testing against the planet, and Earth materials lacked explicit `depthWrite`, causing stars to shine through the dark side of Earth.

3. **Interplanetary thrust direction mismatch:**
   - Camera look direction was taken in local Manaus ENU axes ($[0, 1, 0]$ = local Up) and added directly to barycentric ecliptic velocity in `InterplanetaryController`.
   - Up from Manaus did not match Up in ecliptic barycentric coordinates, pointing thrust into the planet and triggering the envelope floor clamp.

### Implemented architecture & changes

1. **Three-root scene separation (`Game.ts`):**
   - `localRoot`: Contains city, roads, terrain, water, landmarks, streamer, HLOD, destruction. Completely hidden (`visible = false`) during space flight, preventing floating urban fragments.
   - `actorRoot`: Dedicated group for player and visual proxies. Always visible. Positioned at `(0, 0, 0)` during space travel.
   - `planetRoot`: Dedicated group for camera-relative celestial globes (Earth and Moon).
   - `worldRoot`: Retained as alias to `localRoot` for compatibility.

2. **Visual proxy animation in space (`Game.ts`):**
   - While `localPhysicsActive === false`, `player.character.animate(...)` runs each frame with logical simulation speed, `flying = true`, `boosting = true`, and pose `'interplanetary'`, keeping full cosmic skin, particle trails, and flight pose alive without re-enabling `PhysicsWorld`.

3. **Camera-relative rendering (`RenderSpaceService.ts`, `EarthProvider.ts`, `MoonProvider.ts`):**
   - Implemented `RenderSpaceService` using double-precision math.
   - Translates celestial coordinates relative to the player's reference frame before passing to Three.js `position`.
   - Maximum render coordinate at 1,100 km orbit is strictly bounded to $5.36 \times 10^6$ m, well below the 20,000,000 m Float32 precision limit (NEVER 1 AU).

4. **HUD logical display speed (`HUD.ts`, `Game.ts`):**
   - `HUDState` accepts `speedMps` and `altitudeM`.
   - Displays logical relative speed and true cosmic altitude during spaceflight.

5. **Star occlusion & depth integrity (`EarthGlobe.ts`, `SpaceLayer.ts`):**
   - Earth tile and fallback materials explicitly enforce `depthWrite: true` and `depthTest: true`.
   - Space layer stars enforce `depthTest: true`, occluding all stars behind the globe.

6. **Continuous representation across 20–60 km (`EarthTransitionController.ts`):**
   - Eliminated the phantom regional renderer gap. Crossfades smoothly between local world and Earth planetary view.

7. **Thrust direction transformation (`Game.ts`):**
   - Direction vectors from the camera are transformed via `universe.frames.convertDirection(MANAUS_FRAME_ID, 'solar-system/barycentric', ...)` before reaching `InterplanetaryController`.


