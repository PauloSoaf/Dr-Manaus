# D0 — PLANET VOLUME COLLISION — 2026-10-06

Baseline: `4db33426104c9e93d27cbe53a3a3349311e011a8`, branch `feat/universe-map`.
The latest user sprint explicitly authorizes D0 after C4. Documentation, commit and push
remain authorized. D0 ends with an isolated collision laboratory and a manual gate.

## Authority and geometry

`PlanetVolumeCollider` retains the exact immutable-by-ownership Phase 3 `PlanetVolumeMesh`:
positions/normals are shared Float32 chunk-local arrays, indices are shared Uint32, and the
body-fixed origin remains JS Float64. No second polygonization, Three object, render mesh,
BufferGeometry or Raycaster supplies collision authority. Metadata includes key/body ID,
source revision/source mesh identity, MIXED classification, body-fixed bounds, triangle
count and memory accounting. Typed-array elements must not be mutated after publication.

`PlanetVolumeCollisionBvhJob` incrementally validates source geometry, creates Morton codes,
performs four stable byte-radix passes and builds a balanced median BVH. Bounds are Float32;
nodes are Int32 (children/reference range); references are Uint32. Leaves contain at most
8 triangles; ordering and ties are deterministic. There is no whole-mesh synchronous sort.
The synchronous facade is for tests/benchmark only. Production jobs accept bounded batches
(up to 128 units in the runtime) under the existing GlobalStreamingScheduler and volume
subsystem, with adaptive batches targeting at most 0.35 ms and one completed build/frame.
The build cap is 4 MiB including shared input and scratch; pending metrics report allocated
job arrays. No additional scheduler, worker loop or dependency was added.

The collision cache defaults to 8 colliders / 8 MiB, supports LRU get/peek/insert/remove,
clearBody/clearAll/prune/stats, and rejects an oversized replacement before touching the
old authority. Query access touches LRU. A bounded spatial tree over chunk bounds is
rebuilt only on publication/retirement; queries traverse that tree and the per-mesh BVH.
There is no per-query scan of all resident chunks/triangles. Accounting includes shared
source arrays, allocated BVH arrays, triangle references and a 256-byte metadata allowance.
It is a payload budget; JS object overhead and the small chunk index are not exact heap
measurements. Shared source bytes are conservatively counted again against this cache.

## Frames, shape and continuous contact

`PlanetVolumeCollisionProvider` implements optional `sweepCapsule` and `raycast`. It transforms
query positions and directions from local ENU to canonical body-fixed via ReferenceFrameGraph,
subtracts each candidate chunk origin, and transforms only the resulting point/normal back.
RenderSpace rebases do not transform or invalidate collider arrays/BVH. Earth, Moon and Mars
use the same provider. Raycast traverses segment AABBs through both indices and uses
double-sided Möller–Trumbore with inclusive edge tolerance, selecting the nearest triangle.
Ray hits return distance, point, normal, key, body and contact kind. Volume-only ground
raycasts also avoid the legacy implicit zero plane.

PhysicsWorld retains feet-position semantics. Capsule segment centres are feet + radius and
feet + height − radius when height >= 2 radius; shorter characters use a sphere centred at
feet + height/2. Segment/triangle closest features include faces, all edges and vertices.
Conservative advancement uses the separating closest-feature support plane, not endpoint
tests or arbitrary speed-dependent substeps. It permits up to 48 advancement iterations
and 8 refinement steps, with 0.00001 m distance tolerance. Exhaustion conservatively clamps
an unresolved extreme grazing sweep; this can over-block pathological grazing motion and
is an explicit limitation, never a permission to tunnel.

Contact normal points toward empty space. PhysicsWorld selects the earliest volume, optional
heightfield or expanded-box contact, uses a 0.001 m skin and projects only inward velocity.
Tangential velocity survives; no restitution/bounce is added. Up to 4 solver iterations
consume remaining frame time; exhausting them drops the unresolved remainder. Local ENU
normal.y >= 0.65 is floor, <= −0.65 is ceiling, otherwise wall. Only inward floor contact
grounds the real PlayerController. A ceiling stops ascent and permits subsequent falling.
In volume-only mode there is no implicit y=0 floor. Existing ordinary physics/step support
is unchanged when the optional provider is unset; volume mode does not add stair stepping.

Only finest LOD 0 supplies collision, independent of farther visual LOD. Same-LOD adjacent
chunks and negative keys are tested. There is no mixed-LOD seam stitching/Transvoxel or
collision authority beyond the bounded resident demand. D0 does not activate this provider
in the normal game, so intact Manaus/planet terrain retains its current authority.

## Revision lifecycle and diagnostics

Scalar/visual invalidation never retires an active wanted collider. The old immutable source
remains referenced while new samples, MC output and BVH are produced. A completed replacement
is staged and installed at the next `covers()` frame boundary, with ready-state and exact
scalar-source identity checks. Obsolete in-progress jobs and obsolete staged results are
discarded. One key has one installed collider. Authoritative ready EMPTY/SOLID samples stage
retirement at that same boundary; a temporarily missing mesh cannot remove collision.
Leaving demand, changing body, disabling or disposing retires the cache/jobs normally.

F3/runtime diagnostics expose body, resident/pending/staged colliders, MiB, triangles,
BVH nodes, builds/frame, build ms, queries/frame, candidate chunks/triangles, contacts and
last kind/normal. Providers expose resetMetrics; the lab resets counters at each animation
frame. Collision metrics are separate from the existing volume metrics contract.

## Laboratory and scope

`/?volumeLab=1&volumeCollision=1` extends the existing isolated volume-lab entry. It runs
actual planetary field → 17³ samples → MC → scheduled BVH → cache → provider → PhysicsWorld
→ real PlayerController. Its explicit deep-rock fixture uses 16 m chunks and a 1.9 m cavity
(or capsule tunnel), with local ENU up along body-fixed X. This resolution is needed to
exercise character contact; ordinary volume defaults remain unchanged at 256 m chunks.
WASD walks, Space jumps, F flies; buttons reset, expand the test cavity, probe a wall at
3000 m/s and change camera view. Earth/Moon/Mars share the fixture. Rendering retains the
same collider source throughout rebuilds. The debug automation API exposes actual player
steps, physics probes, raycast and fixture edits; it never fabricates contacts.

C4 stays event/policy diagnostics only. No event becomes an edit. Lab edits are explicitly
test fixtures. No gameplay crater, powers integration, heightfield masking, integrity,
fracture, debris, gas/star volume, persistence or new library belongs to D0.

## Files changed

| Area | Files |
| --- | --- |
| Plain physics contract / integration | `src/physics/VolumeCollisionProvider.ts`, `PhysicsWorld.ts`; `src/player/PlayerController.ts` |
| Collider payload / builder / acceleration | `src/world/planet/volume/PlanetVolumeCollider.ts`, `PlanetVolumeCollisionBuilder.ts`, `PlanetVolumeCollisionBvh.ts` |
| Cache / geometric queries / frames | `PlanetVolumeCollisionCache.ts`, `PlanetVolumeCollisionGeometry.ts`, `PlanetVolumeCollisionProvider.ts` in that same volume directory |
| Scheduled lifecycle / opt-in lab settings | `PlanetVolumeRuntime.ts`; `src/world/runtime/UniverseRuntime.ts` |
| Existing lab entry / dedicated mode / UI | `src/debug/PlanetVolumeLab.ts`, `PlanetVolumeCollisionLab.ts`, `PlanetVolumeLab.css` |
| Real integration fixtures / regression matrix | `tests/helpers/volume-collision.ts`, `tests/planet-volume-collision.test.ts`, `tests/planet-volume-collision-runtime.test.ts` |
| Production browser / measurement | `scripts/volume-meshing-browser.mjs`, `scripts/benchmark-volume.mjs` |
| Current checkpoint / roadmap / status | this file, `docs/world/15-status.md`, `specs/Promptatual.md`, `specs/dr-manaus-universe-roadmap/11-SPRINT-AND-COMMIT-PLAN.md` |

## Validation

Initial core checks: typecheck PASS; focused volume/terrain/player/celestial/landing/rebase
regressions **321/321 PASS**, including 54 new D0 tests and all 50 required names (checked
against the actual attachment; none missing). The main
walking/jumping fixture uses real MC output; authored planes only isolate narrow-phase cases.
Revision tests prove retained old collision, atomic replacement, stale rejection and ready
EMPTY/SOLID retirement. Tiny deterministic grants additionally pause a real collider build
and cancel it on a newer edit, retaining the installed old source. Full tests **831/831 PASS**.
Build/browser/benchmark results are recorded below after production verification.
Browser evidence is automated, not human acceptance.

| Check | Result |
| --- | --- |
| Typecheck | PASS |
| Focused regressions | 321/321 PASS |
| Full tests | 831/831 PASS (777 baseline + 54 D0) |
| Production build | PASS; existing bundle-size warning only |
| Volume browser | PASS: original nine mesh cases plus Earth/Moon/Mars D0 player/contact/revision cases; zero page/console errors |
| Space browser | PASS: Moon/Mars F landing, lunar movement/departure, Tab/P/map capture, Jupiter standoff, C4 safe/catastrophic events; zero errors |
| Local browser | PASS: Manaus city/controls/destruction, flight, orbit and reentry; zero page/console errors |
| Benchmark | PASS: existing generation/meshing/residency plus nine measured 17³ collision scenarios; no timing thresholds |
| Diff check | PASS on implementation; final docs checked again before push |
| GitHub Actions | PASS on exact implementation SHA `424c54cd41767adb97e2d457b4255880caa5b892` |

Implementation CI: [Unit, types and build](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/37496841939/job/112383450035).
The Checks API reports completed/success for that exact SHA. This workflow runs full unit
tests, types and production build. Browser checks and benchmark are local separate runs.
The final validation commit records the measurements and targets benchmark queries at real
mesh contacts (no runtime change). Its exact pushed SHA is checked again; that result is
reported in the completion reply rather than making the document embed its own hash.

Commits so far:

- `14d96f6` — scheduled continuous planet volume collision, integration and core tests.
- `424c54c` — real cavity lab/browser, benchmark, refined regressions and current checkpoint docs.
- Final validation commit — records completed local smoke, measured performance, contact-query benchmark calibration and CI evidence.

The production browser fixture verifies Earth, Moon and Mars separately: each reaches
Grounded on the real cavity floor, walks with W, jumps with Space into a ceiling, falls back,
blocks a 3000 m/s sweep at 30/60/120 FPS, returns a floor ray hit with the correct body ID and
installs an expanded cavity revision while retaining the preceding source. Unit integration
also walks into a wall, validates local floor normal.y > 0.65, canonical body-fixed direction,
negative chunk coordinates and adjacent-chunk continuity. Render-origin rebasing preserves
the hit and BVH identity. These are automated geometric/frame results, not human flight tests.

## Benchmark results

`npm run benchmark:volume`: 5 warmups / 21 repetitions per operation, actual 17³ samples.
Build timing includes constructor and completed incremental work; query timing includes
frame transforms, both acceleration traversals and narrow phase. Each timed ray starts
10 m along a real triangle's empty normal and travels 20 m toward it. The fast capsule sweep
starts 300 m away and travels 1000 m, with its segment midpoint aligned to that triangle.
All nine representative rays/sweeps hit. The original axial radial corridor probe is retained
in JSON: Earth/Moon/Mars capsule tunnels and Mars sphere legitimately miss in that one
resident chunk. This separates an empty corridor from the measured surface-contact path.

| Body / case | Triangles | Live BVH nodes | BVH bytes | Collider bytes | Job array peak bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| earth / intact | 512 | 127 | 7128 | 20464 | 24536 |
| earth / sphere | 1048 | 303 | 24632 | 50832 | 59192 |
| earth / capsule | 972 | 255 | 14088 | 38776 | 46216 |
| moon / intact | 512 | 127 | 7128 | 20464 | 24536 |
| moon / sphere | 1048 | 303 | 24632 | 50832 | 59192 |
| moon / capsule | 1084 | 375 | 24776 | 52152 | 60488 |
| mars / intact | 512 | 127 | 7128 | 20464 | 24536 |
| mars / sphere | 1092 | 391 | 24808 | 52184 | 60776 |
| mars / capsule | 860 | 255 | 13640 | 35640 | 42184 |

BVH bytes include full allocated node capacity and triangle references; live node count can
be smaller than allocated capacity. Collider bytes also include shared source and metadata.
Job peak is scratch/node/reference array allocation, without the already owned shared mesh;
the 4 MiB construction admission check additionally includes that mesh.

| Body / case | Build median / p95 ms | Ray median / p95 ms | Fast sweep median / p95 ms | Candidate triangles ray / sweep |
| --- | ---: | ---: | ---: | ---: |
| earth / intact | 0.3095 / 4.0583 | 0.0652 / 0.1701 | 0.2939 / 0.5122 | 24 / 24 |
| earth / sphere | 0.4889 / 0.8380 | 0.0681 / 0.3130 | 0.1684 / 0.3377 | 21 / 21 |
| earth / capsule | 0.2552 / 0.5293 | 0.0129 / 0.0200 | 0.0893 / 0.2735 | 15 / 15 |
| moon / intact | 0.1131 / 0.1596 | 0.0140 / 0.0181 | 0.0581 / 0.1144 | 16 / 16 |
| moon / sphere | 0.3063 / 0.3746 | 0.0133 / 0.0149 | 0.0711 / 0.1052 | 21 / 21 |
| moon / capsule | 0.2843 / 0.3919 | 0.0156 / 0.0191 | 0.0605 / 0.1558 | 8 / 8 |
| mars / intact | 0.1951 / 0.5231 | 0.0098 / 0.0135 | 0.0654 / 0.1717 | 8 / 8 |
| mars / sphere | 0.5126 / 0.7304 | 0.0202 / 0.0275 | 0.1599 / 0.2178 | 17 / 17 |
| mars / capsule | 0.2151 / 0.5348 | 0.0186 / 0.0621 | 0.0983 / 0.2061 | 20 / 20 |

All cases visit one candidate chunk. These machine-specific observations are not frame-time
guarantees or CI assertions. The full-build p95 can exceed the adaptive 0.35 ms batch target;
production work resumes across grants while the old collider stays active. The checked
benchmark script is reproducible; the local JSON/stdout and browser artifacts remain ignored.

## Manual gate — stop after D0

Open the collision lab. On Earth, Moon and Mars: stand on the cavity floor (Grounded), walk,
hit its wall, jump into the ceiling, fall back to the floor, try the fast-wall button and
expand/rebuild while standing. Verify no hole during rebuild, no bounce, stable contact
after the atomic swap and proper internal rendering. Repeat a tunnel and inspect counters.
Ordinary Manaus and Moon/Mars gameplay regressions are covered by the separate automated smokes.

**REQUIRES USER MANUAL VALIDATION. STOP AFTER D0.** The next stage is D1/local impact edits;
it requires a new explicit request after this gate. No feature expansion is authorized here.
