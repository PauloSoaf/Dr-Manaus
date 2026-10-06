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
use the same provider. Ray hits return distance, point, normal, key, body and contact kind.

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

## Validation

Initial core checks: typecheck PASS; focused volume/terrain/player/celestial/landing/rebase
regressions **319/319 PASS**, including 52 new D0 tests and all 51 required names. The main
walking/jumping fixture uses real MC output; authored planes only isolate narrow-phase cases.
Revision tests prove retained old collision, atomic replacement, stale rejection and ready
EMPTY/SOLID retirement. Full tests **829/829 PASS**. Build/browser/benchmark results will be recorded below
after the production lab verification. Browser evidence is automated, not human acceptance.

## Manual gate — stop after D0

Open the collision lab. On Earth, Moon and Mars: stand on the cavity floor (Grounded), walk,
hit its wall, jump into the ceiling, fall back to the floor, try the fast-wall button and
expand/rebuild while standing. Verify no hole during rebuild, no bounce, stable contact
after the atomic swap and proper internal rendering. Repeat a tunnel and inspect counters.
Then verify ordinary Manaus streets and normal Moon/Mars landing remain intact in the game.

**REQUIRES USER MANUAL VALIDATION. STOP AFTER D0.** The next stage is D1/local impact edits;
it requires a new explicit request after this gate. No feature expansion is authorized here.
