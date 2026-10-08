# D1.1-FINAL — multi-crater, solar lighting and publication — 2026-10-08

Initial HEAD: `c92249bc221c9f4ec16c6840f0823d77ffb9454f`, branch `feat/universe-map`.
The new user attachment accepts D1.2 and requests the final D1.1 hardening before changing
the branch priority to [Universe Map completion](../../specs/UNIVERSE-MAP-COMPLETION-EPIC.md).
Implementation follows [D1.1-FINAL-HARDENING](../../specs/D1.1-FINAL-HARDENING.md) and the
original D1.1 requirements. No D2–D5 or U0 gameplay features were implemented in this delivery.

## Complete multi-region residency

Before: the nearest edit alone drove the published window. Other logical edits survived but their
regions could appear healed. Now `selectImpactResidency()` admits the deterministic union of
**complete** L0 impact windows, deduplicates physical keys, and retains one collider/mask authority.
The nearest-edit helper remains only for primary-crater telemetry/profile diagnostics, not admission.

Priority is player/crater containment and supporting chunks, a newest nearby unretained impact
within 1,024 m, then nearby/history ranked by distance. Published regions get a **128 m** distance
preference, with authoritative edit-log recency and ID tie breaks. There are no clocks, FPS-dependent
choices, randomness or logical-edit deletion. Previously published STANDARD windows stay stable
while they support the observer; HIGH remains anchored to the impact and never shrinks.

At most **eight driving regions** are selected. This is not a promise that every eight arbitrary
craters fit: the union must fit scalar count/bytes and mesh/collider counts, and completed mesh/BVH
bytes are checked before insertion/publication. Existing caches remain 128/4 MiB scalar,
128/16 MiB mesh and 128/32 MiB collider. A canonical isolated HIGH window retains the D1.2
four-chunk admission bound. Across regions, scalar bytes allow at most **24 unique HIGH chunks**,
or six separated canonical four-chunk windows, subject to the other bounds. Shared windows can
support more logical regions without duplicating chunks. Actual geometry-byte pressure evicts the
lowest-priority **whole region**, remembers that decision while body revision, priority and window
identities stay unchanged, and keeps
previous published authority until a coherent new set is ready. Failed regions do not regenerate
forever; edit logs survive eviction and returning reconstructs them. Byte-pressure reconsideration
compares ordered region IDs and sorted physical chunk identities; sub-cell traversal order alone
does not restart failed work. A 450,000-byte mesh-budget regression reproduces the former permanent
block, proves zero repeated builds under stable/small-motion demand, and restores each of two
STANDARD craters when moving between them without adding another edit.

Different resolutions are allowed only for separated windows. Adjacent/overlapping STANDARD/HIGH
windows conflict as whole regions: `profile-boundary-conflict`, no partial promoted window and no
mixed-resolution seam. If none can be admitted, old coherent authority stays active. This is a bounded
limitation for connected large/small impacts; resolution escalation/Transvoxel was not introduced.
Large STANDARD windows retain their previous sparse residency, not dense whole-sphere allocation.

The real browser creates two MINOR HIGH lunar impacts about **500 m** apart:

| Metric | Observed |
| --- | --- |
| Published regions / chunks / meshes / colliders | 2 / 8 / 8 / 8 |
| Scalar bytes | 1,359,072 |
| Mesh bytes | 418,272 |
| Collider bytes | 815,216 |
| Presentation bytes including vertex albedo | 526,104 |
| A/B floors | Excavated, raycastable, heightfield suppressed; visual/collider rays agree |
| Moving to B and back | Same publication generation and source references; A stays excavated |
| Constrained three-region test | Complete windows only; deterministic eviction; all three edits survive; return regenerates |

The persistence codec previously omitted optional `impact` demand metadata while saving spheres.
It now preserves that existing field. Schema version remains 1; older documents without metadata
still load. A save/load regression proves identical edits, profiles and multi-region selection.
The authoritative edit store and CSG operations were not redesigned.

## Solar lighting, albedo and culling

The fixed `(.3,.8,.5)` vector is removed. Game injects a live system-to-body solar direction
converted to the current render frame, using the same positions/frame convention as celestial
presentation. Renderer has no Game dependency. The lab deliberately injects a controllable direction
to test day/night. `PlanetGlobe` and volume share the existing soft terminator/5% night response;
Earth and volume share Earth's existing daylight/gain/night ambient expression. These factorizations
preserve the intact models; they do not replace Sun visuals or add a different light authority.

Image review revealed an additional albedo discontinuity: the fixed volume grey made a brighter
rectangle even with matching light. Production presentation now samples vertex albedo from the
same `PlanetSurfaceGenerator.colourAt()` as intact terrain. It owns a **12 B/vertex** Float32 buffer,
prepared before publication and included in its 16 MiB active/32 MiB active+staged admission/stats.
MC position/normal/index arrays stay shared and unchanged. This adds measured preparation cost;
it is not free. Screenshot inspection confirms the brighter rectangle is removed and day/night
changes together; fine rim/outer-edge appearance remains part of native-GPU manual validation.

Volume meshes now use `frustumCulled=true`, with finite verified chunk-local bounding boxes/spheres
and bounded render-frame transforms. PlanetGlobe's historical culling policy is untouched.
The actual browser counts **eight volume draws in view and zero looking away**, while all eight
colliders/replacement chunks stay authoritative. Rebase and bounds regressions pass.

## Per-tile masks

Before: all tiles looped over the shared global list, up to **128 AABBs per fragment**. Now each
tile's actual geometry bounds are combined with its Float64 body-fixed centre and intersected on
the CPU against published replacements. Shader coordinates and bounds remain tile-local.
Each material gets a stable bounded list/count; unaffected tiles perform **zero comparisons**.
Arrays are prepared in advance and uniform references/counts change together at commit.

The six physical lab tiles (four near the craters, two distant) show **average 4, maximum 8,
two zero-mask tiles and four masked tiles**, instead of eight comparisons on every tile.
Coarse intersecting tile bounds can legitimately require the full list, so maximum eight here
is correct; this is not a claim that every affected tile has a tiny list. The general cap remains 128.
Stable 128-slot uniform arrays avoid shader rebuilds during publication; the actual shader loop
ends at the filtered tile count. This reduces fragment comparisons, not all uniform-buffer storage.

Tiles attached between preparation and commit receive staged and current masks during attachment;
detached tiles leave both plans. A late-attachment regression proves atomic publication remains
correct. F3 reports average/max comparisons, zero/masked tiles, selected/published region count,
admission block reason, preparation/commit times and per-region footprint/overshoot.

## Prepared publication and observed cost

The renderer attachment map, collider chunk spatial index, coverage snapshot, tile masks and
footprint metadata are built in `advance()`, before the frame-boundary transaction. Generation,
MC and BVH remain the original bounded scheduler jobs; no synchronous extraction was introduced.
The frame boundary validates cached source identity, edit revision and renderer preparation, then
swaps prepared collider/coverage/render/mask authority. It does not construct geometry/BVH/index,
allocate large mask arrays or dispose geometries. Geometry retirement is cleaned up at most two
per renderer update. A renderer reset or new edit invalidates the transaction before physics changes.
The ordinary D0 replace-all facade retains its behavior via prepare+commit.

Prepare lookup uses a map and primitive corner projection; existing staged meshes return directly,
avoiding repeated full staged-map scans. Commit still does bounded object attachment/removal and
uniform/reference updates, rather than claiming constant-time scene work at arbitrary chunk counts.

A detached checkout of the exact initial HEAD ran the same 12 production fixtures, then the final
implementation ran them on the same machine without concurrent browsers. The temporary checkout
was removed after copying ignored evidence. Representative Moon observations with 2 ms scheduler grants:

| R (m) / profile | Previous atomic ms | New render preparation sum ms | New bundle preparation ms | New atomic ms |
| --- | --- | --- | --- | --- |
| 56 / HIGH | 0.954 | 10.193 | 1.072 | 0.170 |
| 114 / HIGH | 0.214 | 4.876 | 0.149 | 0.014 |
| 433 / STANDARD | 0.685 | 9.613 | 0.746 | 0.079 |
| 925 / STANDARD | 2.532 | 26.311 | 1.697 | 0.046 |

The historical **17.779 ms** spike is still historical, not the controlled baseline above.
These are observational runs, not median/p95 claims or hardware-dependent CI limits. New vertex
albedo increases renderer preparation and the large fixture needed 275 budget frames versus 229
in the controlled baseline; this delivery reduces synchronous **commit** cost, not total crater
construction cost. Benchmark presentation includes geometry/albedo but uses the existing no-op
mask host; real per-tile mask behavior/cost is exercised by the Game/lab browsers, not fabricated
as part of the controlled timing table.

Old authority and its referenced payloads remain during preparation; caches obey their own ceilings.
Renderer stats include active/staged/retired payloads and color buffers; scalar metrics separately
report samples retained by publication after cache eviction. Collider diagnostics now report staged
bytes as well as active cache bytes. Active and staged collider ownership can each reach the existing
32 MiB bound; cache ceilings are not a claim about all process/GPU/driver memory.

## Fidelity, regressions and delivery

`check:impact-fidelity` still passes **24/24** Moon/Mars/Earth × 260/800 × phases 0/2/4/6 m.
No tolerance, MC contour criterion, source grid, field or collision extraction changed.
Maximum opening error remains **7.2482 m**, maximum depth error **0.21337 m**, maximum
visual/collider discrepancy **7.994e-14 m**. Canonical Moon R56/R114 errors remain
5.8263/7.2467 m. All phase/body measurements are in the preserved
[D1.2 report](23-status-D1.2-HIGH-RES-IMPACT-CORE.md).
Moon R433/R925 remain STANDARD with 32/108 published chunks and correct centre floors;
their scalar/mesh/collider bytes remain 628,864/302,112/522,896 and
2,122,416/823,008/1,382,424. All twelve benchmark cases stay within their existing bounds.

| Validation | Result |
| --- | --- |
| Typecheck / build | PASS; existing bundle-size warning |
| New hardening tests | 28 PASS: all 20 remaining named D1.1 cases plus save/load, albedo, byte-pressure return, staged/reset/late-mask/commit guards |
| Existing D1.1 measurement tests | Both named radius/depth cases PASS, unchanged acceptance |
| Focused volume/D0/D1/D1.1/D1.2/globe/render-space/collision/C4/Sun | 373 PASS |
| Full tests | 1,080 PASS |
| Fidelity command | PASS, 24/24, accepted=true |
| Browser volume | PASS: original Phase 3/D0/D1/D1.2 plus two-region/mask/culling/day-night checks; zero errors |
| Browser space full | PASS: map/controls, real Moon/Mars F capture and terrain CCD, Moon/Mars/Jupiter autopilot, Sun approach, C4 and crater walking; zero errors |
| Browser space short | PASS, `DR_D1_ONLY=1`: fresh real Game STANDARD Moon/Mars/Earth and HIGH Moon CCD/C4/handoff/walking; zero errors |
| Browser local | PASS: real Manaus destruction, orbit, reentry and restored city |
| Impact-volume benchmark | PASS, 12/12; exact-baseline before/after evidence |
| Diff check | PASS, repeated before commits |
| GitHub Actions | Exact final pushed SHA inspected and reported after delivery commit |

The two rendering browsers use WebGL2/SwiftShader. The local browser covers the original city;
no Manaus destruction/terrain/traffic/power implementation was changed. Sun materials/visuals,
CCD margins, physical catalog, autopilot and C4 policy remain preserved. No new dependency,
world-coordinate authority, extraction pipeline, Transvoxel or mixed collision LOD was added.

The full space run exposed a test-observation race: `lastTerrainContact` is cleared at the start
of each physics step, so reading it after the arrival HUD may miss the actual touchdown. Its
fixture now records a bounded history immediately after the unchanged production player update,
requiring a real Grounded terrain CCD contact in the correct frame with finite data/unit normal.
Moon and Mars capture/fall/arrival assertions remain; no contact is fabricated and no physics,
velocity, readiness, terrain query or landing acceptance was changed to repair the measurement.

Ignored evidence includes `d11-final-*.log`, `d11-final-controlled-before.json`, the existing
`benchmark-impact-volume.json`, `volume-meshing-browser.json`, `space-hardening-browser.json`, `space-hardening-d1-fresh.json`,
the local browser checkpoint JSON, `d12-crater-fidelity.json` and screenshots. These are not committed.
Delivery separates multi-region/core preparation, rendering, tests and documentation. Final SHA and
CI URL are reported after push; this document cannot embed its own SHA.

## Manual gate and new roadmap

Verify multiple lunar/Martian impacts and controlled Earth outside Manaus; walk between sites,
leave/return, inspect rims/outer edges and F3 admission decisions. Test sun/rotation/rebase lighting,
night visibility and frame pacing on native GPU. A constrained or connected different-profile
region must retain previous authority and show its block reason, not publish a partial cut.

**D1.1 is implemented and automatically validated. STOP for manual acceptance. Destruction is
frozen at D1; D2–D5 remain documented and deferred. Next roadmap checkpoint is U0 universal
target/address, followed by U1→U2→U3→U4→BH0→BH1→BH2→U5→U6. Do not start U0 automatically.**
