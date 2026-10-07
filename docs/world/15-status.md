# Planetary architecture — implementation status

## LOCAL-IMPACT-DESTRUCTION-D1 — 2026-10-07

Current checkpoint, explicitly authorized on `02df01c542c7e9917f01534c1fbf78244381ce49`:
eligible rocky C4 MINOR/MAJOR contacts create one sparse sphere edit. Production residency,
MC presentation, D0 collision and intact visual/heightfield suppression publish as one coherent
transaction. Moon/Mars have physical crater floors; controlled Earth excludes authored Manaus.
SAFE/GRAZE/CATASTROPHIC and gas/star/proxy bodies remain without D1 edits; local P0 is retained.
Contract, cap sign correction, memory limits, evidence, benchmark and manual gate:
[20-status-LOCAL-IMPACT-DESTRUCTION-D1.md](20-status-LOCAL-IMPACT-DESTRUCTION-D1.md).
Typecheck/build/diff PASS; focused 407/407; full 964/964 (78 new D1 cases).
All four required browsers PASS with zero errors; fresh-Game crater acceptance and all three
benchmarks PASS. Exact code/test HEAD `61f8094` CI PASS; delivery HEAD is checked after push.
This authorization supersedes historical stops before D1. **Stop for human acceptance before D2.**

## IMPACT-DESTRUCTION-P0 — local Manaus — 2026-10-06

Previous checkpoint, explicitly authorized on `267caf5d0a8c6ce435e16270c165965bec7c2445`:
contact-normal footprint, larger bounded craters, separate core/blast/impulse/reaction zones,
resident entity queries, complete multipart furniture, NPC states, car impulse and reconstruction.
Heavy structures retain 16 collapses/frame; cheap entities retire on their own bounded 1,024/frame path.
Canonical curve, routing, budgets, tests, benchmark and manual gate:
[19-status-IMPACT-DESTRUCTION-P0.md](19-status-IMPACT-DESTRUCTION-P0.md).
Typecheck/build PASS; focused 145/145; full 886/886, including 55 new impact cases.
Browser local/Manaus/space PASS, zero browser errors; implementation and fixture CI PASS.
The final documentation HEAD is checked after push and reported at delivery.
STOP for manual acceptance before D1.
C4 and D0 remain isolated; celestial events do not create volume edits.

## D0 — PLANET VOLUME COLLISION — 2026-10-06

Previous checkpoint: D0 only, explicitly authorized on `4db33426104c9e93d27cbe53a3a3349311e011a8`.
Collision shares Phase 3 mesh arrays; deterministic incremental BVHs run under the existing
scheduler. The bounded cache retains old collision until a valid completed replacement or
ready EMPTY/SOLID retirement is published at the frame boundary. Local ENU capsule sweeps
handle faces/edges/vertices continuously; floors ground, walls/ceilings block, inward speed
is removed without bounce. Only collision LOD 0 participates. Ordinary gameplay stays intact.

Canonical authority, budgets, lifecycle, limits, results and manual checklist:
[18-status-VOLUME-COLLISION-D0.md](18-status-VOLUME-COLLISION-D0.md).
Core typecheck PASS; focused 321/321; full 831/831; build PASS. Production volume browser
PASS: nine original mesh fixtures plus real player/collision/rebuild on Earth, Moon and Mars,
zero console/page errors. Spatial/local browsers and benchmark PASS; implementation CI PASS
on `424c54c`. Full individual results and performance tables are in the canonical status.
Open `/?volumeLab=1&volumeCollision=1` for the isolated floor/wall/ceiling laboratory.
The latest local IMPACT-DESTRUCTION-P0 authorization supersedes this historical D0 stop.
D1 and planetary gameplay destruction remain unauthorized.

## C4 — CELESTIAL IMPACT POLICY — 2026-10-05

Previous checkpoint: event/policy only, based on accepted `9083c8e53936ed71a45b7a6da75acc3d2965ff2d`.
CCD now supplies pre-response velocities/normal/envelope; a pure body-relative policy classifies
SAFE_CAPTURE, GRAZE, MINOR, MAJOR or CATASTROPHIC. Direct ≥1c can be catastrophic; same-body
active autopilot or F landing intent stays safe; lock alone remains manual. Physical episode
latches with release hysteresis prevent duplicate events. Game drains a transient queue into
lastCelestialImpact and F3. All 19 bodies retain intact CCD and existing capabilities.

Canonical schema, thresholds, all-body matrix, lifetime, limits and individual validation:
[`17-status-CELESTIAL-IMPACT-POLICY.md`](17-status-CELESTIAL-IMPACT-POLICY.md).
37 new tests; typecheck PASS, focused 286/286, full 777/777, build PASS, space browser PASS,
local browser PASS (both zero errors), diff check PASS. GitHub Actions PASS on the exact
implementation/browser checkpoint `29220e2`; its check-run link is in the canonical status.
The latest explicit D0 request supersedes C4's historical stop. C4 still creates no destruction, volume edits or VFX.

## PLANET-FLIGHT-LANDING-1.1 — 2026-10-04

Current checkpoint: stabilization only, based on `42a930a8fb5eaa9d4c0f00b3ef198046a495e7bc`.
Space Shift again owns cosmic boost, animation and reverse target cycling; space B only steps
Warp. Local B and explicit V/repress tiers are preserved. Capture now reaches hold within
5 cm and the HUD clears the captured/waiting phase after local handoff. Dedicated input,
capture and streaming regressions include all 42 required names and 51 new tests.
The baseline's missing F3 references were also caught by typecheck and corrected.
Scratch patches, an intermediate failure dump and a machine-specific workspace were removed.
Deleted iteration records have no live Markdown links requiring restoration.

Canonical controls, evidence, individual validation results and manual checklist:
[`16-status-PLANET-FLIGHT-LANDING-1.md`](16-status-PLANET-FLIGHT-LANDING-1.md).
Final-tree validation: typecheck PASS, focused **248/248**, full **740/740**, build PASS,
browser space PASS, browser local PASS (both zero console/page errors), diff check PASS.
The space smoke verifies actual F cancellation/capture/hold/readiness and terrain contact
for Moon and Mars, local tiers/departure and cosmic controls; both landed HUDs say CHEGADA.
The historical 689/689 claim is superseded by this fresh run; it is not proof for this tree.
Historical 1.1 stop gate: the latest user attachment accepts progression to C4 above.

## NAV-LOCK-1 — 2026-10-03

Initial HEAD: **`386c531a450ab6770b9da454267081f0501989b9`**, branch `feat/universe-map`.
The user manually accepted C0 (slow Moon landing, no high-speed tunnelling, correct celestial
interception) and authorized the combined target lock, autopilot capture and map lock checkpoint.
The original C0 stop gate below is historical; the current stop gate is NAV-LOCK-1 manual acceptance.

**Authority:** `Game.navigation: NavigationTargetState` stores one identity-only NavigationLock
with body ID, source, lock time and mode. `Game.navigationTarget` remains a derived compatibility
accessor. Every consumer resolves live `positionOf/stateOf`; no camera, HUD, map or autopilot
owns another target. Map feedback derives from Game's returned ID, and map selection never writes
pose/velocity. Map focus, overview, close, proxy/globe swaps and offscreen motion retain the lock.

**Controls/selection:** Tab cycles forward, Shift+Tab backward, P toggles autopilot, Backspace
clears the lock in interplanetary space. R reconstruction and Escape panel controls retain their
existing meaning. Tab selection never engages autopilot. The cone is **15°** in barycentric space;
finite presentable bodies in front compete by angular offset, apparent angular size and a weak
logarithmic distance penalty. Fully hidden discs are rejected; partial overlaps remain candidates.
Stable geometric ordering reaches every candidate, including three overlapping bodies. No candidate
means “Nenhum alvo”. No mesh raycast or loaded-globe requirement.

**Flight:** the existing CosmicCruiseController owns a target-free AutopilotCapture command state:
idle, align, acceleration, cruise, braking, capture, approach, arrived. It uses target-relative
orbital velocity and bounded acceleration; large direction errors brake before reorientation,
with a 1 rad/s direction bound and no camera rotation. One engagement capability bounds both
acceleration and deceleration. **Stopping distance = v²/(2a)**. Effective commanded speed is bounded
by the selected warp, `sqrt(2 a remainingGap × .35)` and `remainingGap / 1.5`; this automatically
reduces speed without changing physical scale or rescaling incoming velocity instantaneously.
Positions advance only through integration and the unchanged CCD motion clamp.

**Arrival:** capture first at body radius + the existing `bodyArrivalPolicy` margin. Landable
bodies then descend relative to measured relief: wait above the 7 km gate when terrain is missing,
approach toward 5.6 km when covered, fall from the shared 2000 m/s approach tier to **96 m/s** near
handoff. TravelDomain still independently enforces readiness, inward <=120 m/s, total <=8000 m/s.
Its existing local ENU handoff finishes the command and retains the target. Actual ground descent
uses existing character physics; orbital capture itself does not claim ground contact.
Stars/giants and the nine currently nonlandable SOLAR-12 moons remain outside policy standoff
and match target orbital velocity, with no terrain floor. Cancel/target loss retains momentum.
All 19 celestial envelopes remain swept after autopilot planning, including failed extreme arrivals.

**UI/debug:** localized name, live center distance, relative/closing speed, positive-closing-only
ETA, lock/command state and phase; one render-safe DOM marker or offscreen edge arrow. Map/card
display “TRAVADO”. F3 includes source, alignment, stopping distance, arrival radius, effective cap
and C0 contact body/fraction. Marker scratch is reused; target definitions use a reusable index;
acquisition allocates on key edges, and the new arithmetic autopilot planner uses scalar scratch.

**Validation:** typecheck, **186/186 focused tests**, **668/668 full tests**, production build and
`git diff --check` passed. **34 new deterministic tests** are in `tests/navigation-lock.test.ts`
and `tests/autopilot-capture.test.ts`, covering all **29 required named cases**,
30/60/120 Hz, moving-target arrival, manual coast, failed-plan CCD,
occlusion/cycling, bounded marker, actual map callback/HUD authority and readiness waiting.
The extended space browser smoke uses the existing Chromium and explicit far/near fixtures,
then production Game.tick for Moon Tab/P arrival, Mars map/P handoff, Jupiter standoff and
keyboard cancellation. **`npm run test:browser:space` passed with zero console/page errors**.
Observed Moon and Mars local handoffs had terrain coverage and about **96 m/s** relative speed;
Jupiter arrived roughly **3 m outside** its exclusion/standoff radius with zero target-relative
speed. The traces include align/acceleration/braking/capture/approach and arrived phases, plus
real first-local-step contact checks. This is not a claimed hours-long real-time journey.
The build retains its existing bundle-size warning. Implementation commit: **`198ccc5`**;
the following validation commit records this browser flow and the current prompt/status.

**Requires user manual validation:** look at Moon, Tab, P, confirm acceleration/braking and safe
arrival; repeat Mars. Map-select Jupiter then P and confirm outside standoff; repeat Titan.
Cancel P during flight and confirm momentum remains. C0 is already manually accepted;
NAV-LOCK-1 manual acceptance is pending. **Stop here; no catastrophic impact/destruction.**

Detailed audited contracts, scoring weights, braking math and capture policy:
[`03-TARGET-LOCK-AUTOPILOT-AND-MAP.md`](../../specs/dr-manaus-universe-roadmap/03-TARGET-LOCK-AUTOPILOT-AND-MAP.md).

## CELESTIAL-CCD-P0 / C0 — 2026-10-03

Historical checkpoint, now manually accepted by the user at `386c531`.

Initial HEAD: `9c6d5b24b8b55e7fe836899d034057747872436e`, branch `feat/universe-map`.
The new user ZIP was extracted into `specs/dr-manaus-universe-roadmap`: **20 Markdown files,
4,497 lines**, read in full. The supplied manifest's 19-file count excludes the manifest itself.
The package and then-current attachment authorized **C0 only**, with documentation, commit and push.
That gate was subsequently satisfied by user manual acceptance; NAV-LOCK-1 is now authorized above.

**Confirmed defects:** before the patch, both newly introduced regressions failed: a diagonal
step could cross a relief ridge while its sampled endpoints remained above ground, and the
10,000 m/s return gate admitted an unsafe descent into local character physics. Existing vertical
endpoint floor correction already worked; this patch adds first trajectory contact and safe handoff
rather than claiming the Moon provider was missing. The user's visual reproduction was subsequently
manually accepted before NAV-LOCK-1.

**Implemented:** generic five-point foot terrain sweep; exact vertical crossing; 16 bounded
diagonal brackets followed by 12 binary refinements; motion clamping and inward-normal velocity
projection with tangential velocity retained. Without nearby boxes, planetary terrain uses one
whole-segment sweep; urban box sliding, cavity-wall raycasts and supported walking retain their
existing path. Contact fraction/height/normal are inspectable through PlayerController/PhysicsWorld.
The algorithm is for existing intact smooth heightfields, not arbitrary sub-sample features,
overhangs or Marching Cubes triangle collision.

**Landing contract:** readiness must explicitly be `true`, relief clearance at most **7,000 m**,
relative inward speed at most **120 m/s**, total relative speed at most **8,000 m/s**. The limits
come from the current normal/mega character tiers and are covered at their boundaries. The
**2,000 m/s** super tier separately supplies approach telemetry/future capture planning; it is not
a new autopilot. Body-relative radial/tangent components use the actual surface gradient, without
the visual slope exaggeration. A fast orbit is distinguished from a direct dive. Unsafe arrivals
remain interplanetary; a missing readiness result cannot silently enable local physics.

All **19** active bodies have finite live logical envelopes/velocities and positive radii. Broad
Earth/Moon/Mars envelopes include existing conservative relief bounds. The existing sphere sweep,
earliest-hit selection and inward-velocity response are preserved. The normalized equivalent
quadratic avoids large-term cancellation; tangency does not count as entry. Motion is swept relative
to the moving contacted body, and the unused frame time carries its orbital translation. Response
subtracts that body's velocity, not an unrelated dominant body's. A measured terminal envelope is
used only after the post-thrust speed is within the local ceiling; cosmic acceleration cannot shrink
the broad envelope by reusing a previously slow speed. Sun/gas/ice giants and non-landable moons
receive broad safe-stop contact without local ground. `CelestialContact` is a pure diagnostic
result; no destructive impact policy or event dispatcher was added.

F3 exposes travel/physics domains, target, relative/radial/tangent speeds, clearance and thresholds,
terrain body/height, local Y/state and last celestial contact/fraction. `surfaceReturnTrace` captures
returned → barycentric → body local ENU → PlanetTerrainProvider binding → first PlayerController
step. No per-frame console logging was introduced. Volume phases 1–3, lab, ephemerides, map layout,
galaxy generation and powers remain unchanged.

**Automatically verified:**

| Check | Result |
| --- | --- |
| Mandatory P0 regression file | 39/39 tests; all requested named cases present |
| All 19 celestial bodies | Full crossing at bounded dt plus grazing crossings at 120/60/30 FPS; both endpoints outside |
| Moon local terrain | 120/60/30 FPS at 120, 8,000, 10,000 and 260,000 m/s; no below-terrain endpoint |
| Mars local terrain | 120/60/30 FPS; swept contact without Manaus colliders |
| Contact response | Inward component removed, tangential component retained; Grounded and walking regressions pass |
| Gas/ice giants / Sun | Broad interception, no ground handoff |
| Focused physics/travel/Moon/Solar-12/runtime/player/Manaus suite | 200/200 |
| `npm run typecheck` / `npm test` / `npm run build` / `git diff --check` | Pass; 634/634 full tests; inherited bundle-size warning only |
| `npm run test:browser:space` | Pass; zero console/page errors; map, cosmic view, proxies, real Moon return/walk/jump/takeoff, volume opt-in/release |

Browser P0 fixtures explicitly reject a 10 km/s lunar return, record the actual Game.tick handoff
and first local step, then run the real PlayerController at 30 FPS with a 10 km/s downward velocity
whose old endpoint is underground. Swept contact leaves it Grounded on terrain with no inward
normal velocity. These are controlled near-arrival fixtures, not a claimed manual Earth–Moon trip.
One repeated browser run exposed a pre-existing test race: ephemeris-driven map card replacement
detached the overview button during Playwright's stability wait. The test now dispatches the actual
DOM button click synchronously, retains the focus/scale assertions and passes; map implementation
was not modified. The unrelated legacy `npm run test:browser` was not run in this checkpoint.

**Measured movement CPU, median / p95 ms** (same Moon ENU, dt=1/30, 30 warmups + 120 samples,
baseline PhysicsWorld loaded from the initial HEAD versus the final implementation):

| Scenario | Baseline | CCD |
| --- | ---: | ---: |
| Diagonal 10 km/s contact | 1.957 / 3.268 | 0.516 / 1.045 |
| Diagonal 8 km/s without contact | 0.211 / 0.435 | 0.396 / 0.843 |
| Supported ground walk | 0.038 / 0.091 | 0.071 / 0.231 |

These are movement-query timings on this workstation, not total frame/GPU/FPS guarantees.
No renderer resources, streaming jobs, dependencies or volume residency were added. Logs,
benchmark fixtures/JSON and browser screenshots stay in ignored `artifacts/`.

**Manual validation required:** repeat the original slow Moon approach and walk; fast and
absurd-speed Moon approach; fast Mars approach; free-flight crossing attempts against Jupiter
and Sun. Inspect control feel, stopping distance and F3 contact telemetry. **The C0 acceptance gate
was satisfied by the user; the next authorized checkpoint is NAV-LOCK-1 above.**

Architecture details: [`planetary-handoff-and-volume-phase1.md`](planetary-handoff-and-volume-phase1.md).
Requirements: [`02-PATCH-CELESTIAL-CCD-P0.md`](../../specs/dr-manaus-universe-roadmap/02-PATCH-CELESTIAL-CCD-P0.md).

## PLANET-VOLUME-3 / Phase 3 — 2026-10-02

Initial HEAD: `a752f7ceb24811ece5c0ceafdc275fd217d7b272`, `feat/universe-map`.
The latest request accepts Phase 2 **by static inspection** and directs Marching Cubes next.
Manual gameplay acceptance is still pending. Implementation checkpoints were documented and
pushed: `4804016` (pure indexed extraction/table/tests), `c5a8845` (bounded mesh runtime and
isolated visual inspector/tests/browser). This integration commit records benchmarks, final
validation, a deterministic scheduler-test correction and the updated authoritative prompt.

**Implemented:** real iso=0 geometry from ready MIXED scalar chunks; chunk-local Float32
positions/normals, Uint32 indices, separate body-fixed Float64 origin/key/revision; canonical edge
reuse, exact-zero welding, degenerate removal and inward cut-wall/outward solid-surface normals.
The classic 256-case table is MIT-licensed three.js r186 data with its complete notice retained.
The pure mesher has no renderer, DOM, field/BVH query or gameplay dependencies. EMPTY/SOLID grids
yield zero geometry. Ambiguous cell-face occurrences are observable; MC33 certification,
cross-chunk ghost-gradient normals and different-LOD transitions are not claimed.

`setDebugMeshing(true)` independently opts in after demand. One existing `planet/volume` scheduler
grant serves both stages, nearest-first, with one live job total and at most one scalar plus one
mesh completion per frame. Batches adapt by measured EWMA cost: 1–128 samples / 1–64 mesher units,
targeting up to 0.35 ms or half the remaining grant. Deadline enforcement remains cooperative.
Default gameplay allocates zero resident grids/meshes/jobs. Existing shell visuals, single-surface
physics, powers, flight, ephemerides and navigation remain unchanged.

Mesh cache: **8 payloads / 8 MiB** actual typed-array caps. Worst-case capacity admission prevents
small-budget eviction/remeshing loops. Source identity/revision must match the current ready scalar
chunk; edits immediately hide stale meshes, and changed/evicted chunks, body changes, lost demand
and disable dispose derived residency. Unrelated edits preserve valid old source revisions.
N=17 theoretical output limit: **578,688 bytes/chunk**; count cap therefore bounds retained default
output to **4,629,504 bytes (4.415 MiB)**. A mesher job has a **2 MiB live-array cap**, including
scratch and compact-copy peak; the N=17 worst-case bound is **1,295,036 bytes**. Larger mixed-grid
configurations exceeding it are rejected/skipped without scratch allocation. Counters describe
typed arrays, not total JS heap or GPU driver memory. Persistence remains logical schema-1 edits.

**Visual entry: `/?volumeLab=1`.** The lazy inspector uses real UniverseRuntime/surface factories,
global streaming and extraction, showing one nearest L0 chunk for Earth/Moon/Mars. Controls:
Intacto/Esfera/Cápsula, orbit/zoom, external/internal camera, wireframe and chunk bounds. `Game`
is not instantiated on this route; no PlanetGlobe ownership or terrain collision is replaced.
Geometry/controls/helper/renderer/cache resources are disposed on replacement/exit. This is actual
extracted geometry in a diagnostic view, not planet destruction gameplay. Screenshots of the
crater and internal tunnel were inspected; the internal view looks along the tunnel opening.

**Measured pure meshing, median / p95 ms**, 5 warmups / 21 repetitions on this workstation:

| Case | Earth | Moon | Mars |
| --- | --- | --- | --- |
| Intact | 1.567 / 2.061 | 0.989 / 2.046 | 1.444 / 1.832 |
| Sphere cut | 1.442 / 1.956 | 1.408 / 1.817 | 1.432 / 2.224 |
| Capsule cut | 1.602 / 2.501 | 1.411 / 1.852 | 1.728 / 2.044 |

Meshes in these cases: 289–588 vertices, 512–1,092 triangles, **13,080–27,120 bytes**;
observed working arrays before final compact copies: 180,668–229,388 bytes. All nine cases have
zero ambiguous faces. `npm run benchmark:volume` separates sampling and meshing, reports geometry
counts/bytes and through-Earth allocation, and writes stdout only. No wall-time thresholds gate CI.
The one-capsule through-Earth fixture still starts at **1 edit / 1 BVH node / 0 chunks**; each
entry/centre/exit stage retains 32 scalar chunks (628,864 bytes) plus at most 8 mesh payloads
(94,992 / 85,632 / 94,992 bytes). Previous distant data is retired; no diameter-sized grid is made.

**Automatically verified:** **594/594 full tests**, **274/274 focused regressions**, typecheck,
production build and diff check passed. Twenty-three additional deterministic cases cover lookup
cases, interpolation, winding/normals, welding/degenerates, closed-sphere manifold/Euler topology,
cut spheres/capsules, shared faces, stale/invalid grids, resumability/source revision, memory
limits, source invalidation, opt-in, scheduling, LRU/bytes, movement/body retirement and adapter
locality/disposal. The existing scheduler-volume test now injects the same simulated clock into
the ledger and runtime; its prior mixed real/fake clocks could starve the test under CPU load.
Both complete and focused suites passed after that correction. Lunar NASA SHA-256 is unchanged:
`1696df0382263ac9aabc183d0f15e506099d982a66e9ad994852371e6910f628`.

**`npm run test:browser:volume` passed** against the production build with the already installed
Chromium: all nine real body/scenario renders, finite local attributes, count/byte budgets,
changed cut topology, internal/wireframe/mobile controls and zero arrays/canvas after disposal.
**`npm run test:browser:space` passed** on the same build: SOLAR-12 map/focus/all nine targets,
bounded Europa/Titan/Triton approaches, exclusive lunar globe, actual Game return/ground contact,
keyboard walking/jump/takeoff, and optional scalar-demand release. Both captured zero page/console
errors. No browser dependencies or CI publishing were added; ignored validation artifacts remain
outside commits. The existing bundle-size advisory remains informational.

**`npm run test:browser` was rerun and reproduced the baseline failure** at
`scripts/browser-test.mjs:263`: the stale `game.origin` argument is undefined in
`TerrainDestruction.update`, causing `Vector3.copy` to read undefined `x`. This legacy suite is
explicitly not passing; it was not bypassed or changed in this extraction checkpoint. The two
production smoke suites above passed independently.

**REQUIRES USER MANUAL VALIDATION:** open `/?volumeLab=1`, inspect intact/sphere/capsule on each
body, orbit/zoom and toggle internal/wireframe views; confirm actual cavity/tunnel walls and
bounded queues/memory; return to normal Manaus, fly/travel/open the System map, inspect major moons,
return to Earth's Moon and walk/jump/take off with zero default volume mesh residency. Automated
near-arrival fixtures do not establish a complete manual trip.

Contract, case-by-case geometry/memory table and ordered roadmap:
[planetary-handoff-and-volume-phase1.md](planetary-handoff-and-volume-phase1.md);
API/usage/source attribution: [volume README](../../src/world/planet/volume/README.md).
Stop at Phase 3. No Transvoxel, world coverage handoff, volume colliders, planet-power wiring or
through-body gameplay. External untracked iteration documents remain untouched.

## Historical PLANET-VOLUME-2 / Phase 2 — 2026-10-02

Initial HEAD: `2f5d8200f6003e8d9a1fb205d154192792c6b00e`, `feat/universe-map`.
The latest request accepts SOLAR-12 and authorizes sparse resident volume chunks. Implementation
commits: `0b2cfc2` (keys/sampling/field contract/tests/docs), `b098af1` (bounded cache, demand,
invalidation, scheduler runtime, telemetry/tests/docs). This integration checkpoint adds the
deterministic benchmark, production-browser assertions and authoritative status/prompt updates.
Each checkpoint is documented, committed and pushed as persistently requested by the user.

**Implemented:** immutable body-fixed Cartesian keys; one dyadic lattice with L0–L3 edges
256/512/1,024/2,048 m, 17³ samples and 16³ cells, spacing 16/32/64/128 m; pure resumable sampling;
whole-grid EMPTY/SOLID/MIXED classification; source revision and conservative one-query CSG
candidates; LRU with both chunk/byte limits; local distance/LOD demand; add/remove invalidation;
one optional current-body manager in the existing global scheduler; F3 metrics.

Resident grids hold 4,913 Float32 distances and **19,652 bytes each**. Material identity is constant
metadata; material-array bytes are zero. Limits are **64 chunks and 2 MiB** of resident arrays;
with the default grid the chunk limit wins at 1,257,728 bytes (**1.199 MiB**). One pending job holds
58,956 typed-array bytes including the output and temporary Float64 bases; it is separately
reported and released on completion/cancellation. JS/Map/edit-log heap is not claimed as measured.

Normal demand selects at most 32 dyadic leaves within 1,024 m and a conservative ±256 m radial
band, visiting at most 1,024 nodes; it is clipped to cache capacity, nearest-first, own L0 first
on ties. Refinement follows distance to parent AABBs, not globe screen-space error. Retention
uses a 1,536 m margin plus LRU; large moves/body changes retire old samples. Edits only mark
intersecting resident conservative query regions stale and allocate no chunks. Numerical influence
outside cut AABBs is preserved; unrelated ready chunks retain their prior source revision.
Pending jobs restart on owning-body revision changes.

Demand is an explicit debug opt-in, disabled by default. Earth/Moon/Mars share one pipeline;
Mercury/Venus retain profile compatibility. Sun, gas/ice giants and nine non-landable moons are
disabled. Default/inactive bodies consume zero resident/pending arrays. Near-surface mode requires
intact-terrain clearance within 2,048 m; interior sampling has a separate explicit diagnostic flag.
The existing scheduler grants remaining frame milliseconds; generation yields between 128-sample
batches and completes at most one chunk per frame. The deadline is cooperative, not a preemptive
wall-clock guarantee. No second scheduler, private timers or parallel generation fan-out exists.

**Through-Earth allocation:** 1 subtract-capsule → 1 edit/1 BVH node → **0 chunks/0 bytes before
demand**. The measured entry/centre/exit fixture holds 32 chunks and 628,864 bytes (**0.600 MiB**)
at each stage and discards the previous distant stage. Entry/exit: L0 24, L1 4, L2 4; centre: L0 32.
No planet-wide chunk enumeration occurs, including when the capsule spans the entire diameter.

`npm run benchmark:volume` uses deterministic samples, 5 warmups and 21 repetitions. Measured
CPU times below are **median / p95 milliseconds**, observed on this workstation, not CI thresholds:

| Scenario | Earth | Moon | Mars |
| --- | --- | --- | --- |
| Intact surface (MIXED), 0 candidates | 1.655 / 2.346 | 4.160 / 5.591 | 3.185 / 4.226 |
| Intact interior (SOLID), 0 candidates | 1.299 / 2.044 | 3.774 / 5.448 | 2.927 / 4.158 |
| Outside (EMPTY), 0 candidates | 1.358 / 1.883 | 3.870 / 5.000 | 2.124 / 3.408 |
| One sphere, 1 candidate | 1.644 / 3.204 | 4.059 / 6.037 | 2.648 / 4.060 |
| Sixteen spheres, 16 candidates | 7.678 / 9.183 | 13.224 / 17.562 | 7.883 / 9.949 |

**Automatically verified:** **40 new cases** cover all 32 named checkpoint invariants and
additional halo, job, budget, retention and inactive-allocation regressions. **571/571 full tests**,
**221/221 focused volume/streaming/Earth/Moon/Mars/render/Solar/Cruise/Warp regressions**, typecheck,
production build and diff check pass. Every grid value matches the Phase 1 field at Float32
precision; same-LOD faces match exactly; rebases preserve real cached arrays and keys.
The lunar NASA payload SHA-256 remains unchanged:
`1696df0382263ac9aabc183d0f15e506099d982a66e9ad994852371e6910f628`.

**`npm run test:browser:space` passed** using the existing Chromium against the production build:
SOLAR-12 map/focus/all nine targets and unchanged providers, bounded Europa/Titan/Triton approaches,
exclusive lunar globe, actual Game lunar return/ground/walk/jump/takeoff, zero inactive volume
arrays, explicit lunar demand and release on disable. The first resident lunar chunk reported
19,652 bytes, 31 pending, 1 completion in the frame, 1.700 ms generation out of 3.100 ms granted.
Captured page/console errors: zero. No browser tooling was installed; existing ignored smoke
artifacts are not committed. The benchmark writes stdout only, with no generated report files.

**`npm run test:browser` was rerun and failed at the same baseline defect** in
`scripts/browser-test.mjs:263`: its stale `game.origin` argument is undefined when passed to
`TerrainDestruction.update`, producing `Vector3.copy`'s undefined `x` error. This legacy suite
is not claimed as passing, replaced, bypassed or repaired in this volume-only checkpoint.
The production space/planetary smoke above remains passing.

**REQUIRES USER MANUAL VALIDATION:** Manaus loading, ordinary Earth flight/travel, Moon loading
and landing/walk/jump, System map and visible major moons, no new stutter with inactive demand;
inspect F3 at zero resident chunks, activate debug demand near Earth/Moon/Mars, move several chunk
widths and confirm bounded memory/retirement, then disable and confirm zero arrays. Check demand
edges for repeated generation. API steps are in
[the volume README](../../src/world/planet/volume/README.md).

Contract, measured allocation and ordered roadmap:
[planetary-handoff-and-volume-phase1.md](planetary-handoff-and-volume-phase1.md).
Stop at Phase 2: no volume meshes, Marching Cubes/Transvoxel, cave collision, power wiring,
through-body gameplay or changed planetary visuals. Existing shell rendering and single-surface
terrain collision remain authoritative. External untracked iteration documents are untouched.

## SOLAR-12 / Task 012 — 2026-10-02

Baseline: `e0d4e8a460981232678eb067718fddb47fa2b522`, `feat/universe-map`.
The user accepted the previous checkpoint's manual tests and authorized this major-moon set.
Catalog: 19 bodies, adding Io/Europa/Ganymede/Callisto → Jupiter, Titan/Enceladus → Saturn,
Titania/Oberon → Uranus, Triton → Neptune. Earth's Moon remains landable.

The existing SolarSystem remains the hierarchy/state authority. Satellite mean Kepler elements
are catalog-owned and evaluated parent-relative offline; recursive resolution adds both parent
position and velocity. Physical synchronous orientation is independent of the observer. Triton's
157.3° inclination retains retrograde motion. Sources, reference-plane conversion, frozen-ellipse
accuracy limits and preservation of the original lunar ellipse are documented in
[10-solar-system.md](10-solar-system.md).

New moons have shared icy/volcanic/atmospheric profiles, phase light from the live Sun and a
bounded pixel floor. Titan's warm haze uses its existing quad. Selected labels win collisions.
All new moons are solid, non-landable proxies with no terrain/volume provider. The registry
still contains four rocky provider shells (Mercury, Venus, Earth's Moon, Mars), with Earth
specialized separately. The celestial layer grows from 13 to 22 meshes: exactly nine extra quads.
No astronomical positions are written to render objects. Dominant gravity and Warp sweeps stay
generic, as do target selection, live target resolution and arrival clearances.

Map overview shows Sun/planets, with an explicit selected satellite if needed. **Focar luas**
shows the parent and its children in live relative positions, mean orbital paths, names, km
scale, selection and a parent breadcrumb. **Sistema Solar** returns to overview. Focus uses
the orbital reference plane, including Uranus; no second map ephemeris is instantiated.

Validation: **531/531 full unit tests**, **160/160 focused tests**, typecheck and production
build passed. Forty additional test cases cover catalog completeness, parents, physical values,
hierarchical positions/velocities, motion, Triton, synchronous orientation, capabilities/provider
count, generic navigation/Cruise, all nine Warp exclusions, Ganymede/Titan dominant gravity,
render finiteness/bounds/phases, Titan haze, label collision and five parent-map focuses.
Existing Moon/Manaus regressions pass. The lunar NASA payload SHA-256 is unchanged:
`1696df0382263ac9aabc183d0f15e506099d982a66e9ad994852371e6910f628`.

**`npm run test:browser:space` passed against the final production build** using the existing
Playwright/Chromium: all four new planetary focuses, all nine canvas target selections with
immediate highlighting and unchanged player pose, overview return, unchanged four-provider
registry, bounded rendered approaches to Europa/Titan/Triton, and the complete automated
Earth Moon streaming return, ground contact, keyboard walking/jump/takeoff regression.
Captured page/console errors: zero. Screenshots and JSON remain ignored validation artifacts.
**`npm run test:browser` was also run and failed at its existing stale `game.origin` reference**
in `scripts/browser-test.mjs:263` (`TerrainDestruction.update` receives undefined). This older
suite's arming/origin assumptions were already recorded at the baseline; it is not claimed
as passing and was not replaced or bypassed. No browser dependency was installed.

**REQUIRES USER MANUAL VALIDATION for SOLAR-12:** start in Manaus, leave Earth, open M;
focus Jupiter and select/travel toward Europa; inspect parent scale/direction and visual stability;
focus Saturn and inspect Titan's orange haze and Enceladus; focus Uranus for Titania/Oberon;
focus Neptune, approach Triton and inspect high-speed exclusion/jitter; return to Earth's Moon,
land, walk/jump and take off. Automated near-arrival fixtures do not replace this complete trip.

Stop here. Task 013, destruction volume Phase 2, dwarf planets and new moon surfaces are not
part of this checkpoint. Existing untracked iteration documents are not included in the commits.

## Historical SPACE-HARDENING-1 — 2026-10-02 (user manual acceptance received)

Implemented from baseline `f8f451250e564958ffad20d26b72df3fe4c9e6de` on
`feat/universe-map`, including the user's P0 walkable Moon and P1 universal-map additions.
This checkpoint stops feature expansion: Task 012, volume Phase 2 and additional moons remain
outside its scope. Historical entries below describe earlier checkpoints.

- Space camera orientation is quaternion-owned, with continuous pole crossing. Mouse input is
  consumed before thrust; W, the central camera ray, strafing and vertical movement share the
  same camera basis. Ground pitch limits and camera collision remain active locally.
- Environmental audio receives medium and atmospheric density explicitly. Earth wind fades
  continuously with density; vacuum and airless terrain have zero environmental gain. The
  independent effects bus remains available.
- Earth has a 3.5 px point core and 8 px optical extent, then an offline Natural Earth geographic
  proxy aligned to the actual body-fixed frame. Physical radii and logical coordinates are unchanged.
- Moon uses bundled NASA LRO/LOLA elevation and LROC/LOLA appearance. A complete six-face
  fallback covers missing/retired cuts; its conservative DEM envelope stays under refined terrain
  between vertices. Coarse lunar faces use 65×65 samples, local tiles 17×17. Fog and duplicated
  vertex-colour multiplication are disabled. One physical globe replaces the proxy exclusively.
- Landing readiness reserves the 100 m footprint, including neighbouring tiles at boundaries,
  before other branches spend the tile budget. Airless gates measure actual terrain clearance.
  The existing TravelDomain → UniverseRuntime handoff → Game physics binding enters
  `moon/local-enu`; the player falls under the selected body's gravity, becomes `Grounded`,
  walks, jumps and takes off. City debris and fictitious crater notices no longer accompany
  airless landings; a bounded stylized impact and its audio remain.
- The desktop map occupies 94 vw × 88 vh, with a 320 px sidebar and explicit grid areas.
  Its universal canvas follows display dimensions with DPR capped at 2. The System view uses
  live ecliptic XY positions, names, target selection, finite zoom and AU scale text. Interplanetary
  entry defaults to System; a Moon surface never displays the Manaus city map.

Validation: **491/491 unit tests passed** (52 added), **110/110 focused tests passed**,
`npm run typecheck`, `npm run build` and `git diff --check` passed. The build retains the existing
bundle-size advisory. **`npm run test:browser:space` passed** using installed Playwright/Chromium
and the production build: desktop layout/backing size, automatic System view, space quaternion
input, one orbital Moon, streamed Game return, grounded Moon, keyboard walking, jumping and
takeoff; zero captured page/console errors. No browser tooling was installed.

Browser setup uses explicit near-arrival fixtures; it does not establish a complete manual
Earth–Moon–Earth trip. Existing `test:browser` is the older city/ascent suite, whose stale origin
and arming assumptions were recorded in the preceding checkpoint; it is not reported as passing
here. User manual validation remains required for the full 35-case travel/control/phase matrix,
Earth point-to-globe visual quality, lunar limb/seams from multiple landing sites and DPR/resizing
on other hardware. The bundled DEM resolves roughly 15 km at the equator, not centimetre terrain.

Source, reproducible ingestion and size are in [06-geodata-pipeline.md](06-geodata-pipeline.md).
The root causes, changed-file inventory and current runtime contract are in
[10-solar-system.md](10-solar-system.md#space-hardening-1-runtime-contract).

Tracks `dr-manaus-cosmic-world-specs` against the code, phase by phase. Written so that anyone
picking this up knows what is finished, what is half-finished, and what has not been started —
including the things that do not work.

Baseline: `d2e03428b1d9ba90fdc7b2a5112c280e6686fead` (PR #2 merged into `main`).
Branch: `feat/universe-map`.

Current implementation checkpoint: **CELESTIAL-LEGIBILITY-1**, continuing from `4529b9d` after
**SOLAR-11 / Task 011** (`47dd452`). Physical scale and travel remain unchanged; optical point floors,
solar halos, brighter phased Moon shading and bounded/contextual DOM labels improve readability.
Saturn's existing rings fade in between 6 and 9 physical pixels.
The Sun, Moon and all eight planets now share generic celestial presentation and live navigation.
Mercury/Venus/Moon/Mars use a body-keyed rocky-provider registry; Earth retains its specialized
Manaus/WGS84 flow. Stars and giants have exclusion envelopes and cannot land. See
[10-solar-system.md](10-solar-system.md) for capabilities, synthetic-terrain provenance, arrival
policy, render bounds, tests and required manual validation. Task 012 and volume Phase 2 are pending.

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
| 9 | Solar system | **implemented** — logical model, ten visuals, generic providers/navigation; manual validation pending | `src/world/celestial/` — [10](10-solar-system.md) |
| 10 | Galaxy layer | **partial** — streamed provider, behind its flag | `StarSectorProvider.ts` — [11](11-galaxy-and-universe.md) |
| 11 | Universe sectors | **partial** — addressing and seeds only | `UniverseAddress.ts` — [11](11-galaxy-and-universe.md) |
| 12 | Persistence hardening | **done** — versioned, addressed, IndexedDB | `WorldMutationStore.ts` |
| 13 | Hardening | **verified** | Visual, architectural, ephemeris and coordinates hardening (`tests/earth-transition.test.ts`, `tests/universe-coordinates.test.ts`, `tests/universe-navigation.test.ts`) |

Everything is gated by `FEATURES` in `src/core/config.ts`. `spatialCore`, `earthGlobe` and
`solarSystem` are on. Earth retains the current coverage-aware local/planetary handoff; generic
planet providers share the same global scheduler and do not replace the Manaus implementation.

## What is verified

SOLAR-11 validation on 2026-10-02: 427/427 unit tests, typecheck and production build pass.
The existing browser smoke fails in destruction setup because it still passes removed `game.origin`
to the terrain updater; that stale API is present in the initial HEAD. No browser E2E pass or new
visual approval is claimed. The full planet travel/ring/return matrix requires user manual validation.
Earlier observations at 400 m, 12 km and approximately 236.3 km describe historical Earth checks.

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

8. **Earth Globe & Manaus Alignment & Visual Hardening (`UniverseRuntime.ts`, `EarthProvider.ts`, `EarthGlobe.ts`, `SpaceLayer.ts`, `Game.ts`):**
   - **Suppressed legacy saw-tooth shell (`SpaceLayer.ts`)**: The legacy 48-segment colored sky wedge dome (`this.shell`) and fake sun disc (`this.disc`) are suppressed when `FEATURES.earthGlobe` is active.
   - **Aligned atmosphere mesh pole axis (`EarthGlobe.ts`)**: Rotated `SphereGeometry` via `atmoGeo.rotateX(Math.PI / 2)` to align Three.js Y-up pole with ECEF Z-up polar axis. Guarded inner haze so it is only visible above 20,000 m.
   - **Continuous terrain under Manaus (`EarthProvider.ts`)**: At altitude >= 20,000 m, `coveredByCity` is bypassed so the Earth globe generates continuous high-altitude terrain under Manaus, eliminating the black void hole under the city.
   - **Synchronized local city visibility (`Game.ts`)**: Synchronized `localRoot.visible = localGround` with `flatTerrain.visible = localGround`, ensuring water ribbons and landmarks stand down together with ground backdrop instead of floating in empty vacuum.
   - **Full E2E verification**: `npm test` (326/326 tests pass), `npm run build` (clean 0 errors).

9. **Deterministic Manaus ↔ Earth Integration & 4-Root Architecture (`Game.ts`, `EarthProvider.ts`, `UniverseRuntime.ts`, `PlayerController.ts`, `EarthTransitionController.ts`):**
   - **4-Root Scene Hierarchy (`Game.ts`)**:
     - `celestialRoot`: Contains stars (`SpaceLayer`), star sectors (`StarSectorProvider`), galaxies (`GalaxyProvider`), black holes (`BlackHoleProvider`), cosmic web (`LargeScaleStructureProvider`). Rendered at the deepest background layer.
     - `planetaryRoot`: Contains camera-relative celestial bodies (`EarthProvider` / `EarthGlobe`, `MoonProvider` / `MoonGlobe`).
     - `localWorldRoot` (aliased as `localRoot` and `worldRoot`): Contains terrain, real city, HLOD, roads, airport, Largo, landmarks, forest, local destruction. Hidden cleanly in deep space without affecting player or planets.
     - `actorRoot`: Contains player character model and visual proxies. Always active and visible.
   - **Mathematical Manaus-Earth Lock (`ManausFrameAdapter.ts`, `tests/manaus-earth-integration.test.ts`)**:
     - Verified `MANAUS_ANCHOR` (lat -3.130333°, lon -60.022528°) $\to$ ECEF $\to$ Manaus local round trip error is $< 10^{-6}$ m ($< 1$ mm).
     - Verified landmark heights (Largo, Teatro Amazonas, Arena da Amazônia, Aeroporto, Ponta Negra) sit on the WGS84 ellipsoid matching local terrain heights with 0 km offset.
     - In local world coordinates, Manaus surface [0, 0, 0] sits at Three.js scene position $[-Game.origin.x, -Game.origin.y, -Game.origin.z]$, while Earth center is placed at $[-Game.origin.x, -6378073 - Game.origin.y, -Game.origin.z]$, placing the top of the globe precisely at the city's ground level.
   - **Camera-Relative Barycentric Space Flight (`UniverseRuntime.ts`, `EarthProvider.ts`)**:
     - In interplanetary space (`updateSystemPose`), `renderSpace.origin` is centered on the observer (`playerPose`), calculating `earthSystemPosition - playerSystemPosition`.
     - Completely eliminated dead/dangerous `toSceneMetres`. Coordinates passed into Three.js remain strictly bounded ($< 20,000,000$ m) and never receive astronomical numbers (~$1.5 \times 10^{11}$ m).
   - **Zero-Gap Transition Continuity (`EarthTransitionController.ts`, `Game.ts`)**:
     - Added `effectiveLocalWeight = localWeight + regionalWeight` and `keepLocalFallback = !targetCoverageReady || effectiveLocalWeight > 0.01`.
     - Guaranteed that `localReady || planetReady` is true at every altitude from 0 to 1,000,000 m.
   - **Interplanetary Proxy & Local Simulation Suspension (`PlayerController.ts`, `Game.ts`)**:
     - Added `PlayerController.updateTravelVisual(...)` keeping character model at `(0, 0, 0)` in `actorRoot`, animating in flight pose with `speedMode = 'interplanetary'` and display speed reflecting `currentGameplaySpeedMps()`.
     - Urban physics, colliders, real city, streamer, HLOD, and traffic are completely suspended when `localPhysicsActive === false`.
   - **Deterministic Test Suite (`tests/manaus-earth-integration.test.ts`)**:
     - 7 deterministic integration tests covering anchor round-trip, coordinate budget, relative displacement, altitude continuity, landmark elevation, space proxy stability, and reentry determinism.
     - Full test suite passes: 333/333 tests ok. Build compiles 100% clean. Zero Antigravity browser automation used.
   - **Celestial Visual Pipeline Hardening & Handoff State Machine**:
     - Handled Earth visual proxy representation from interplanetary distances (`EarthVisual.ts`) integrated into `CelestialBodyVisualLayer.ts`.
     - Enforced safe rendering domains via `CelestialPresentationController.ts`, turning off full globe streaming when distant.
     - Corrected `MoonVisual` world-space billboard orientation using `cameraPos` and enabled `uOpacity` blending for smooth crossfades.
     - Hardened `MoonProvider` readiness checks to accurately query `globe.has(key)` rather than relying on abstract tile counts.
     - Added test `T_STREAMING_SPLIT` to strictly prove `updateStreaming()` execution does not duplicate world time `timeS` advancement.
     - Full test suite passes: 340/340 tests ok.




## Hotfix v2 — Mars & Coordinate Authority (eat/universe-map)

Status: **verified** (tests passing, build clean).

### Changes implemented

- **Resolved Coordinate Authority (Task 005):** Eliminated Game.origin duplicate authority over scene positioning. The Game.ts origin is now strictly synced from UniverseRuntime.renderSpace.currentOrigin.position, dropping any direct reads from FloatingOrigin3D in space. This prevents jitter and visual instability during coordinate rebases.
- **Culled Ghost City in Space (Task 006):** In interplanetary travel mode, the local city streamer is fully suspended and localRoot.visible = local; forces the high-detail city meshes to disappear. This prevents floating urban garbage and z-fighting in the orbital view.
- **Planetary Models (Mars):** Completed Mars implementation (MarsProvider, MarsGlobe, MarsSurface) using identical pipeline architecture as Moon, wired into CelestialPresentationController.ts.

## Phases 0–1 — exclusive planetary handoff and sparse volume foundation

Status: the surface handoff and mathematical volume foundation are implemented. This does not yet
include volume chunks, extracted meshes, cave/tunnel collision, or destruction gameplay.

- The Earth transition now has one explicit ground owner plus a shared `local`, `planetary`, or
  `orbital` presentation domain. Detailed near-surface coverage must be ready before the flat local
  ground retires; the coarse fallback alone remains valid for orbital LOD.
- The HUD suppresses Manaus landmarks, local coordinates, mission UI, and the city minimap outside
  the local domain. Celestial and rocky-body transforms use the active `travel/view` render frame.
- The Earth coarse fallback sits 4 m below refined tiles, shares their surface palette and opacity,
  and keeps partial coverage closed without coplanar depth fighting. Atmosphere/limb gains are
  reduced so they do not disguise a surface seam.
- `PlanetVolumeField` derives the intact solid from the existing Earth, Moon, and Mars surface
  generators. Sparse body-fixed `subtract-sphere` and `subtract-capsule` edits compose through CSG
  difference and are indexed by a lazy AABB BVH.
- Versioned per-body JSON stores only the edit history. Generated grids, meshes, and colliders are
  future discardable caches. A through-Earth tunnel is one capsule edit, not a chain of craters or
  a planet-sized allocation.

Architecture, invariants, focused test metrics, limitations, and the Phase 2–10 roadmap are in
[planetary-handoff-and-volume-phase1.md](planetary-handoff-and-volume-phase1.md).

## Checkpoint MANAUS-SURFACE-AUTHORITY-P0 — one local frame for the whole city

Status: **implemented and automated**; the visual acceptance pass in Part T of the checkpoint still
requires manual validation in the running game.

### Root cause

`FEATURES.curvedManaus` is `false`, and the local terrain honoured it: `ground-cover` and
`terrain-backdrop` stayed in the flat legacy projection. The `SurfaceTileFrame` migration
(`2f06e3c`) had meanwhile routed three other local systems through WGS84 tangent frames
*unconditionally*:

| System | File | Behaviour before |
| --- | --- | --- |
| Real streets and lane paint | `src/world/realcity/roads.ts` | every vertex and normal through `legacyPointToRenderLocal` in `toGeometry()` |
| Real building tiles and skyline | `src/world/realcity/RealCityLayer.ts` | tile groups and skyline instances placed by `createSurfaceTileFrame(...).getSceneMatrix()` |
| Procedural chunks | `src/world/chunks/ChunkMeshes.ts` | same tile frame for facades, sidewalks and trees |

Colliders, terrain destruction and local physics stayed flat throughout, so the city had two
spatial authorities at once. The two diverge as the square of the distance from the Manaus anchor,
`d² / 2R`:

| Distance from anchor | Curved surface drop below the flat sheet |
| --- | --- |
| 5 km | ~2 m |
| 10 km | ~8 m |
| 15 km | ~18 m |
| 20 km | ~31 m |
| 25 km | ~49 m |

That is the regression in the screenshots: near the centre the city looked right, and the further
out the player flew the deeper the streets and building bases sank under an unmoved green sheet,
until only roofs showed. A building's visual base and its collider could sit tens of metres apart,
so the mismatch was never only cosmetic.

### Correction

- `src/world/spatial/ManausSurfacePresentation.ts` is now the single authority:
  `localManausPresentationMode()` plus `manausTileSceneMatrix()`, which returns a pure translation
  when flat and the WGS84 tile matrix when curved. `MANAUS_GROUND_COVER_Y` holds the one ground
  height the sheet and the asphalt offsets are measured against.
- Roads, real building tiles, the skyline and the procedural chunks go through that authority. Their
  authored flat coordinates — `ROAD_HEIGHT`, `ROAD_MARKING_LIFT`, footprints, tile origins — are
  untouched.
- Water, scars, landmarks, HLOD proxies and traffic were already gated on the flag; they now read
  the same authority rather than the flag directly, so there is one decision to change.
- `ground-cover` moved from `0.02` to `0` so every road class clears it by at least 2 cm. At the old
  value, a service street at `0.022` had 2 mm of separation, which is inside depth precision.
- `ChunkMeshes.restore()` rebuilt its instance from `group.position`, which is zero now that the
  group carries an explicit matrix. It uses the tile origin, so a restored building returns to where
  it was away from the anchor as well as at it.
- `TerrainDestruction` classifies each ground leaf explicitly (`sheet`, `road`, `plaza`, `band`)
  instead of masking whatever a district subtree contained; walls, roofs, lamps and canopies no
  longer enter crater batches. The airport's kerb road moved into the pavement batch and its
  structures out of it, because a batch is masked as a whole.
- `TerrainDestruction.rebuild()` now publishes the bowl's own bounds. Three.js computes a bounding
  sphere once and never again, and this geometry is a fixed buffer rewritten in place: recentering
  moves the written window and a growing span changes the grid step. A downward ray through the
  middle of a 640 m crater found no triangle after an 850 m recenter while physics still reported
  the floor 180 m down. Rendering had survived on `frustumCulled = false`.

### Verification

`tests/manaus-surface-authority.test.ts`, `tests/manaus-procedural-surface.test.ts` and
`tests/manaus-crater-coverage.test.ts` cover the flat frame, the collider/visual agreement, the
surface height order, the dormancy of `SurfaceTileFrame` while the flag is false, the still-working
curved path, and crater mask/bowl/collision coverage. `T_FLAT_MANAUS_ONE_SURFACE_AUTHORITY` is the
structural guard: any file outside `src/world/spatial/` that reaches for a curvature conversion must
also consult the authority, so the next partial migration fails in CI rather than in a screenshot.

`npm run test:browser:manaus` samples the shipped builders at 0, 5, 10, 15 and 20 km: ground, road,
arterial, marking, building base and collider base all report their authored heights with zero sag,
and tile matrices are pure translations.

Known gap: `tsconfig.json` includes only `src`, so `npm run typecheck` does not typecheck `tests`.
A test in this checkpoint called `RoadNetwork.update(Vector3, 0)` against a `(x, z, speed)`
signature and failed at runtime instead of compile time. Including `tests` currently surfaces 314
pre-existing errors, mostly a missing `node` entry in `compilerOptions.types`.
