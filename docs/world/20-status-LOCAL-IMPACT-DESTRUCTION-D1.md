# LOCAL-IMPACT-DESTRUCTION — D1 — 2026-10-07

Initial HEAD: `02df01c542c7e9917f01534c1fbf78244381ce49`, branch `feat/universe-map`.
The current user attachment accepts the completed local IMPACT-DESTRUCTION-P0 and authorizes
**D1 only**, including documentation, commits and push. Its authorization supersedes the
historical stop before D1. Stop again for human acceptance before D2.

## Event consumer and capabilities

`CosmicFlight` remains the analytic CCD/contact authority. `CelestialImpactService` still
classifies pre-response, body-relative velocities and emits once per contact episode.
`Game.updateInterplanetaryFlight()` drains that queue into the existing diagnostic and
`RockyImpactDestructionService.consume()`. There is no edit, meshing or scene dependency in CCD.

The pure `planRockyImpact()` requires both `hasSolidSurface` and `supportsVolumeDestruction`,
a valid actual surface generator, finite body-fixed contact/speeds and matching body identity.
Only `MINOR_IMPACT` and `MAJOR_IMPACT` are eligible. Earth, Moon, Mars, Mercury and Venus
qualify through capabilities; the policy contains no per-body-ID crater cases.
`SAFE_CAPTURE`, `GRAZE` and `CATASTROPHIC_IMPACT` remain diagnostic. A direct contact at ≥1c
does not excavate, delete or fragment a planet. Gas giants, ice giants, stars and presentation
moon proxies have no D1 volume. A manual lock alone does not grant autopilot protection.

The host defers Earth edits overlapping authored Manaus coverage, extended by the footprint
and a 512 m replacement margin, with `authored-manaus-authority` in F3. The legacy city's
terrain and local P0 destruction remain their existing authority. D1 Earth acceptance uses
an explicit equatorial fixture outside that coverage; Earth autopilot still returns to Manaus.

## One footprint, one edit

The P0 curve moved unchanged to renderer/player-independent `ImpactFootprintPolicy.ts`.
`player/combat/MeteorImpact.ts` reexports its existing API. For the D1 size-1, non-slam body:

```
vn = event.inwardRadialSpeedMps
vt = event.tangentialSpeedMps
E = vn + 0.6*vt
A = 1200 * (1 - exp(-0.0013 * E^0.65))
g = min(1, sqrt(vn/12))
R = A*g
D = min(600, A*(0.45 + 0.05*A/1200))*g
```

Radius/depth caps remain 1200/600 m. Tangential energy increases the envelope, while shallow
normal incidence reduces excavation. There is no alternate planetary radius curve.
Representative direct speeds and the complete runtime benchmark are below.

The C4 shell contact may be well above relief. Normalize its body-fixed direction and call
`planetSurfaceRadius(surface,direction)` to project onto the **actual ellipsoid and relief**.
Use `surfaceOutwardNormal()` from `PlanetSurfaceMath.ts`, the unchanged field-gradient helper
also reexported by `LandingCapture.ts`, rather than assuming render/local/world Y or a radial
normal on an oblate/sloped surface.

For opening radius R and excavation depth D, the spherical-cap CSG is:

```
sphereRadius = (R*R + D*D)/(2*D)
signedDepthOffset = D - sphereRadius
centre = actualSurfacePoint - actualOutwardNormal*signedDepthOffset
       = actualSurfacePoint + actualOutwardNormal*(sphereRadius-D)
```

**Sign correction to the attachment:** a shallow cap's sphere centre is above the surface.
Subtracting `normal*(sphereRadius-D)` instead would excavate `2*sphereRadius-D`, violating
the requested depth. Tests assert the actual bottom at D and surface opening at R.
The logical edit's bounds cover the complete sphere, not just the visible cap.

Edit ID: `${bodyId}:impact:${eventId}`. Duplicate consumption checks the authoritative store
and requests existing demand without adding another edit or incrementing revision.
Exactly one `subtract-sphere` is added per eligible event. Its geometry and optional impact
metadata are frozen, plain Float64 data, JSON-serializable. There is no mesh/chunk/BVH save,
new persistence file or capsule-channel consumer. Cache eviction never removes the edit log.

## Production residency and streaming

`UniverseRuntime.volume` stays a managed subsystem of `GlobalStreamingScheduler`. The Game
passes production limits; the isolated D0 lab retains its existing small defaults. Samples
remain 17³ in 256 m chunks (16 m voxel spacing), collision LOD 0. No new dependency,
global resampling, quality-menu change, worker framework or replacement scheduler was added.

`requestImpactRegion()` records the request for diagnostics; actual production demand is
rediscovered from indexed authoritative sphere metadata. Neither a debug checkbox nor the
transient event queue owns subsequent residency. Query nearby edits, select the nearest
surface contact and prioritize near observer/contact cells. CSG still combines all intersecting
edits in each sampled chunk, including overlaps with an older crater.

The selected local window contains full cap depth and two voxel cells of halo. It moves
with the observer's tangent-plane projection, clamped to the opening. Enumerate a complete
3D chunk window; never truncate the list and lose lower floor columns. Reduce only the
**residency window** if its cell count exceeds the cache. Keep the logical sphere and R/D
unchanged. Insufficient capacity holds intact coverage instead of publishing an incomplete hole.

| Cache | Count cap | Byte cap |
| --- | ---: | ---: |
| Scalar samples | 128 | 4 MiB |
| Marching Cubes meshes | 128 | 16 MiB |
| D0 colliders/BVH | 128 | 32 MiB |
| Renderer staged meshes | 128 | 32 MiB active + staged shared payload |
| Intact-surface mask | 128 published bounds | Fixed arrays |

These are separate derived-cache caps. During a rebuild, old published sample/mesh references
are retained until the new bundle is ready; they are not discarded by sample invalidation.
Their additional retained sample bytes are exposed in F3. At most one active and one staged
bounded window exist. Renderer and collider reference the original MC arrays; reported shared
payload bytes are conservative accounting, not three independent copies of each triangle.
Jobs retain the existing incremental row/cell/BVH work and one completed job per stage/frame.
Renderer geometry preparation occurs per completed BVH under the granted advance budget;
preparation time and frame-boundary publication time have separate diagnostics.

## Production presentation and atomic authority

`PlanetVolumeSurfaceRenderer` stages actual MC positions, normals and indices, with bounded
planetary material and readable normal lighting. It performs no second mesh extraction.
Chunk origins remain Float64 body-fixed data; `RenderSpaceService.logicalToRender()` and
the frame graph position/orientation convert them into small render offsets on every update.
Use the catalog fixed frame even before a body's first landing alias exists. Absolute AU or
planet-scale Float32 vertices never enter the crater mesh. Floating-origin updates leave the
logical edit and D0 collider unchanged.

`PlanetVolumeSurfaceMask` attaches a bounded TSL mask to EarthGlobe/PlanetGlobe detail tiles
and coarse fallback. It preserves each material's prior clipping. Subtract the coverage anchor
from the tile centre in CPU Float64, then test fragment-local position against relative published
AABBs. Suppression covers replacement cells; MC also contains their surviving intact surface,
so the mask does not create a bare rectangular hole. Nothing is suppressed from edit existence
alone. A simple material transition at the replacement boundary remains visible.

The renderer-independent `PlanetVolumeReplacementCoverage` is the same authority used by
`PlanetVolumeTerrainProvider`: suppress an original heightfield point/ray hit only if its
body-fixed original surface point lies inside **published** replacement coverage. Return
`-Infinity` there and let the real volume floor handle contact. Outside the region, retain
ordinary heightfield terrain. Do not disable the planet's entire terrain provider or invent
an analytic crater floor. Manaus keeps its own provider.

At `covers()`' frame boundary:

1. Require every selected scalar source ready and current; every MIXED source has current MC
   arrays, a completed D0 BVH and prepared renderer representation.
2. Validate the whole bundle's counts/bytes. If any part is missing, stale, over budget or
   cannot be rendered, keep the old visual, old collider and old suppression unchanged.
3. Replace the collider cache in one transaction with one spatial-index rebuild; publish
   matching coverage; commit renderer meshes and the intact mask synchronously.
4. Game rebinds the matching local physics and updates render transforms before drawing.

No physics/render query or asynchronous callback runs between those three publication steps.
EMPTY/SOLID sources participate in the coherent window even without triangles. Source identity
and state reject stale jobs; unaffected source revisions can survive a different, disjoint edit.
A second edit holds the previous physical/visual replacement until its complete successor is
ready. Body changes/demand retirement clear derived caches and masks, preserving logical edits.
Returning regenerates the crater from that log.

## Walking and ghost ground

Real `PlayerController` and `PhysicsWorld` use the existing D0 capsule/triangle continuous sweep.
The old intact floor is absent inside published coverage; crater MC triangles provide floor,
slopes/walls and contacts. Outside/rim samples keep the original authority. Normal contact
response removes inward motion and permits sliding on legitimate slopes rather than creating
an invisible cylindrical wall. A 2×skin downward capsule query stabilizes actual BVH floor
support at 120 FPS when lunar gravity moves less than the collision skin in one frame.
This query changes only the active D0 volume path and never fabricates an infinite plane.

## Benchmark

`npm run benchmark:impact-volume` runs the actual policy/edit, scalar generation, MC,
incremental D0 build and production presentation adapter on Moon/Mars/Earth for all four
speeds. It asserts caps and full logical radius, with no machine-specific ms threshold.
JSON: ignored `artifacts/benchmark-impact-volume.json`; includes vertices, triangles, frame
count, per-stage CPU times, preparation/publication time and job peak bytes.

Representative Moon measurements on this Windows machine (2 ms granted advance budget, concurrent load;
timings are observations, not promises):

| Speed m/s | R m | D m | Full sphere AABB cells | Published local cells | Samples B | Mesh B | Collider B | Publish ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 260 | 56.55 | 25.58 | 8 | 4 | 78,608 | 53,376 | 103,552 | 2.131 |
| 800 | 114.43 | 52.04 | 8 | 4 | 78,608 | 58,464 | 109,456 | 0.393 |
| 8,000 | 433.06 | 202.69 | 216 | 32 | 628,864 | 302,112 | 522,896 | 1.653 |
| 50,000 | 924.98 | 451.89 | 1,100 | 108 | 2,122,416 | 823,008 | 1,382,424 | 17.779 |

| Speed m/s | Sampling total ms | MC total ms | BVH total ms | Render preparation total ms | Frames to coherent publication |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 260 | 126.828 | 166.226 | 38.472 | 5.557 | 94 |
| 800 | 77.702 | 98.203 | 66.543 | 11.392 | 36 |
| 8,000 | 446.438 | 72.510 | 9.917 | 4.564 | 191 |
| 50,000 | 1,314.076 | 319.915 | 32.999 | 22.614 | 585 |

Each row has one logical edit. Observed peak pending sample buffers: 58,956 B;
MC jobs: 181,508–217,544 B; BVH jobs: 30,016–43,552 B. Totals include scheduling,
runtime warmup and contention effects; frame count is not a promised arrival latency.
The 17.779 ms large-window publication is measured and bounded, not claimed spike-free.

The logical-cell figure is a conservative finest-LOD sphere **AABB** count, including empty
space above the cap, not a claim of exact sphere intersection or eager allocation. Mars/Earth
used the same 4/4/32/108 active cells; their large sphere AABBs contained 1,000 cells at this
anchor. Different lattice alignment and surface normals change those counts. The 925 m
crater is logically complete but its entire opening need not be resident simultaneously.

## Automated validation

Typecheck/build/diff PASS; focused 407/407; full 964/964, including 78 new D1 cases.
All 65 mandatory named D1 cases passed. Volume, local and full spatial browsers passed with
zero errors. A second spatial acceptance run with a **fresh Game** also passed all three
rocky bodies and verified that normal subsequent Game frames retain the actual excavated
floor/grounded player. Manaus passed five radial geometry samples (0–20 km), three actual
aerial views and an actual-road crater with zero browser errors. All required browsers passed.
All three benchmarks passed, including twelve D1 body/footprint combinations.
Baseline checks plus the D1 checks cover the following independent evidence:

- All 65 required named `T_D1_*` cases in the attachment, plus added invalid input, cap sign,
  direct Game consumer, actual render/physics ray agreement and host deferral cases.
- Eligible/ignored classifications, profile capability gates, real relief projection/normal,
  deterministic single edit, revision/catalog invariants and unchanged P0 curve.
- Bounded no-debug production demand, unaffected chunks, invalidation, body isolation,
  eviction/return, near-first ordering and sparse 925 m demand.
- First/second atomic publication, held old collider/skin, visual readiness gate, stale job
  rejection, no double floor, continuous rim traversal/contact, floor/wall capsule queries.
- Real Moon/Mars/Earth local ENU PlayerController fall, Grounded, walk and 30/60/120 FPS;
  floating-origin transforms, unchanged body-fixed edits and matching MC visual/physical rays.
- Production `test:browser:volume`: original nine Phase-3 fixtures and three D0 fixtures,
  then D1 Moon/Mars/controlled Earth using the real scheduler, node renderer, globe masks,
  player, keyboard walk/jump, wall CCD, return regeneration and second edit. No Game instance
  is claimed for this explicit fixture. Open `/?impactDestruction=1` to reproduce it.
- Production `test:browser:space`: previous controls/map/Moon/Mars landings and C4 no-edit
  safe/catastrophic cases; then actual Game CCD/C4 -> D1 single edits, Moon/Mars published
  replacement, actual Game PlayerController crossing the lunar rim, walking on the bottom,
  physical floor ray/wall sweep and Earth event outside Manaus. C4 includes direct ≥1c Moon.
  Set `DR_D1_ONLY=1` for the separate fresh-Game D1 acceptance run; the default retains the
  full suite. Fresh results use `artifacts/space-hardening-d1-fresh.json` and assert grounded
  crater contact after subsequent normal Game frames, without assuming any previous landing.
- Local browser preserves P0 crater/core/blast/entity removal, authored destruction, flight,
  Earth orbit/reentry and city resumption. Manaus source/streamed geometry regression retains
  city roads, foundations, multipart furniture and local collision.

Ignored screenshot evidence: `d1-moon-before.png`, `d1-moon-pending.png`,
`d1-moon-after.png`, `d1-moon-inside.png`, `d1-moon-above.png`,
`d1-mars-after.png`, `d1-mars-inside.png`, corresponding controlled Earth views,
and `d1-game-moon-floor.png` / `d1-game-mars-floor.png`. These are explicit automated
fixture screenshots, not a claim that a human performed the acceptance journey.
The before/pending/after/above/inside Moon images, after/inside Mars images and live Game
floor image were inspected. Pending frames retain the original skin; published frames show
the excavated bowl and inside rim, with the simple bounded material described above.

| Required validation | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| Focused volume/C4/CCD/terrain/landing/P0/D1 tests | 407/407 PASS |
| `npm test` | 964/964 PASS |
| `npm run build` | PASS |
| `npm run test:browser:volume` | PASS, Phase 3 + D0 + D1, zero errors |
| `npm run test:browser:space` | PASS, full regressions + actual Game D1, zero errors |
| Fresh Game spatial D1 acceptance | PASS, subsequent normal frames retain the floor |
| `npm run test:browser` | PASS, P0 + Earth flight/orbit/reentry, zero errors |
| `npm run test:browser:manaus` | PASS, roads/ground/foundations/crater, zero errors |
| `npm run benchmark:volume` | PASS, original scalar/MC/D0 checks |
| `npm run benchmark:impact` | PASS, resident local P0 entities/terrain |
| `npm run benchmark:impact-volume` | PASS, 12 coherent bounded replacements |
| `git diff --check` | PASS |
| GitHub Actions code/test HEAD | PASS, run 37652982334 linked below |
| GitHub Actions delivery HEAD | Checked after final push; exact SHA/run reported at delivery |

## Commits and files

Implementation/test HEAD: `61f809421d72076a0163803cfc050bf41f68ca4d`.
GitHub Actions PASS on that exact code/test HEAD:
[Validation run 37652982334](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/37652982334).

1. `89f5b381addfbf897061996ec6789dffa044c124` — pure rocky policy/service,
   unchanged neutral P0 footprint, actual surface normal and authoritative edit metadata/demand.
2. `b993f1fae61124319070e8f80a0fa5daa7c97b2a` — production residency, coherent
   publication, bounded renderer, globe mask and original heightfield suppression.
3. `0e77efe4cf2d50e9ea4d5398c236cc178091c2e6` — Game consumer/physics binding,
   real BVH support stabilization, 78 new D1 tests and their actual-world fixtures.
4. `61f809421d72076a0163803cfc050bf41f68ca4d` — explicit production browser fixture,
   extended spatial/volume browser checks and twelve-case incremental impact-volume benchmark.
5. Acceptance/documentation closure — bind the real physics domain in synchronous C4 browser
   fixtures, cover the lunar catastrophic no-edit case and actual Game rim/wall/floor flow,
   improve the inside fixture camera to show wall/rim, and close this report/status/prompt/roadmap.

The fifth commit's exact delivery SHA and its matching GitHub Actions URL are reported after
commit/push. No success from a different HEAD is substituted for final CI. Generated artifacts,
screenshots, logs, machine workspace files and ZIPs remain ignored and uncommitted.

36 changed files, grouped for review:

- Policy/data: `src/world/destruction/{ImpactFootprintPolicy,RockyImpactDestructionPolicy,
  RockyImpactDestructionService}.ts`, `src/player/combat/MeteorImpact.ts`,
  `src/world/planet/PlanetSurfaceMath.ts`, `src/world/travel/LandingCapture.ts`,
  `src/world/planet/volume/{PlanetVolumeEdit,PlanetVolumeEditStore,PlanetVolumeImpactDemand}.ts`.
- Publication/render: `src/world/planet/volume/{PlanetVolumeReplacementCoverage,
  PlanetVolumeTerrainProvider,PlanetVolumeRuntime,PlanetVolumeCollisionCache}.ts`,
  `src/rendering/{PlanetVolumeSurfaceRenderer,PlanetVolumeSurfaceMask}.ts`,
  `src/world/planet/{EarthGlobe,PlanetGlobe}.ts`, `src/world/runtime/UniverseRuntime.ts`.
- Game/physics: `src/game/Game.ts`, `src/physics/PhysicsWorld.ts`.
- Tests: `tests/helpers/{celestial-impact,rocky-impact}.ts`,
  `tests/{rocky-impact-destruction-policy,rocky-impact-destruction-service,
  rocky-impact-volume-runtime,rocky-impact-game}.test.ts`.
- Browser/benchmark: `src/debug/PlanetImpactDestructionLab.ts`, `src/main.ts`,
  `scripts/{space-hardening-browser,volume-meshing-browser,benchmark-impact-volume}.mjs`,
  `package.json` (one new benchmark command, no dependency change).
- Documentation: this file, `docs/world/15-status.md`, `specs/Promptatual.md`,
  `specs/dr-manaus-universe-roadmap/11-SPRINT-AND-COMMIT-PLAN.md`.

## Manual gate and limits

After loading the shipped game, disable P/F assistance and impact Moon/Mars directly at
minor and major speeds. Wait for the published crater, descend into it, walk the floor,
jump, walk against slopes/walls and cross the rim. Check that original surface/ghost ground
is gone only after the new collider exists. Repeat an overlapping impact while standing on
the retained old floor; leave the region/body and return. Check F3 edit ID, R/D, revision,
published coverage, cache/job bytes and original-body contact. Repeat at 30/60/120 FPS and
through a floating-origin shift. Check ≥1c remains diagnostic; Jupiter/Sun have no voxel
surface; P/F stays safe; authored Manaus still supports its existing P0 impacts/entities.

Known limits: 16 m extraction spacing approximates the floor/opening and small features;
there is no raised ejecta, sophisticated geological material or sub-voxel certification.
The nearest coherent window is resident; distant history is logical until reloaded, and
large openings can expose only a moving part of their true excavation. There is no full
planet remesh, collider LOD seam/Transvoxel feature, persistence file, global tree/entity
excavation, Earth city authority migration or catastrophic breakup. The existing persistence
format is not extended into a new D1 save workflow; optional impact-demand metadata is runtime
data. All acceptance fixtures are explicit and distinct from a manual interplanetary journey.

**STOP after D1.** D2 capsule penetration, D3 integrity, D4 fragmentation and D5 giant/star
destruction remain future scope requiring new authorization after human acceptance.
