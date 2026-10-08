# D1.2 — HIGH-RES IMPACT CORE — 2026-10-08

Historical D1.2 checkpoint. A later user attachment explicitly authorizes the remaining D1.1:
see [24-status-D1.1-FINAL-HARDENING.md](24-status-D1.1-FINAL-HARDENING.md) for its completion,
current manual gate and Universe-first priority. The measurements and original STOP below are historical.

Initial HEAD: `9e02dbed21a91cdea5db7c50c12c89a8673af7a6`, branch `feat/universe-map`.
The user accepted the D1.1 fidelity stop and explicitly authorized this prerequisite alone.
D1.1 stopped because the 16 m MC lattice expanded small openings by up to 13.075 m against
an 8 m tolerance. See [22-status-D1.1-FIDELITY-GATE.md](22-status-D1.1-FIDELITY-GATE.md).
The Sun checkpoint remains unchanged; no D1.1 hardening or D2 features were implemented here.

**The existing fidelity command now passes all six canonical fixtures and all 24 body/speed/grid-phase combinations.**
Radius tolerance remains **8 m**, depth tolerance remains **min(4 m, 15%)**, and the contour
deficit remains **0.25 m**. No 4 m/65³ profile was necessary or added.

## Profiles, physical addressing and source identity

| Profile | L0 physical chunk | Samples/axis | Core scalar samples | L0 spacing |
| --- | --- | --- | --- | --- |
| `standard` | 256 m | 17 | 4,913 | 16 m |
| `impact-high` | 256 m | 33 | 35,937 | 8 m |

`DEFAULT_VOLUME_LOD` remains 256/17/maxLOD3. The optional explicit profile in
`PlanetVolumeChunkKey` determines the denser lattice through `samplingConfigForKey()`.
Both profiles retain identical physical bounds, body-fixed coordinates and chunk addressing.
Standard keys keep their original six-part format; HIGH appends a deterministic suffix:

```text
volume/moon/0/6783/0/0
volume/moon/0/6783/0/0/impact-high
```

Both round-trip through `parseChunkKey()`. Noncanonical integers, unknown suffixes and malformed
URI body IDs are rejected. Requesting 33 samples under a standard generation key is rejected;
the caller must use the HIGH identity. Legacy smaller diagnostic lattice configurations remain
available, but production uses the two explicit profiles above.

Scalar, mesh and collider caches and staged render/collision ownership use the composite key.
Generation adds a signature containing the key, physical base size and samples/axis. Meshes
carry that signature; cache admission and collider preparation reject mismatched source signatures
even at the same edit revision. Collider insertion retires another profile of the same physical
chunk. Complete collision replacement and surface coverage reject duplicate physical keys,
preventing simultaneous STANDARD/HIGH colliders or masks for one physical chunk.

## Geometry policy and coherent publication

The single pure `selectImpactSamplingProfile(edit)` function chooses HIGH when either
`2R/16 < 32` or `D/16 < 6`. It depends on edit geometry alone, without body-ID exceptions,
camera/FPS/cache-pressure/device decisions. Eviction or a body switch reconstructs the same
profile from the unchanged authoritative edit log.

| Current crater R / D (m) | Standard diameter/depth cells | Selected profile |
| --- | --- | --- |
| 56.548 / 25.580 | 7.069 / 1.599 | HIGH |
| 114.433 / 52.041 | 14.304 / 3.253 | HIGH |
| 433.056 / 202.689 | 54.132 / 12.668 | STANDARD |
| 924.982 / 451.892 | 115.623 / 28.243 | STANDARD |

Every chunk of a selected impact window uses one profile. HIGH is anchored to the actual impact
surface point, covering the complete opening, cap depth and the preserved **32 m** geometric
halo. It does not follow the observer across the opening or shrink its radius by `*0.8`.
If the full HIGH window does not fit, `publicationBlocked = high-res-budget`; the previous
coherent intact/standard authority stays active and no partial crater is published.
Large STANDARD windows retain the existing D1 sparse residency policy and logical geometry.

Preparation still uses the existing `GlobalStreamingScheduler`: resumable scalar generation,
MC, D0 BVH and render preparation. Runtime sample batches stay <=128, MC batches <=64 and
BVH batches <=128, with deadlines checked between batches and at most one completed stage
per frame. The synchronous facades are used only in tests/benchmarks. They are not gameplay calls.

Only when the complete window has valid samples, matching meshes/BVHs and prepared render
objects does the existing synchronous boundary swap collider authority, replacement coverage,
render objects and intact masks. Tests seed an actual standard MC/collider fallback and verify
it stays active while HIGH builds, then all source identities switch together in one generation.
No second collision extraction was introduced: visual/collision payloads share the same MC arrays.

## Seam samples and normals

HIGH adds six exterior face planes, **6 × 33² = 6,534 scalar samples**, one sample beyond each
face. They are generated in the same bounded two-pass job and Float64 integer-first lattice
arithmetic. Face values permit central gradients at boundary vertices, avoiding the opposing
one-sided gradients that would otherwise make the same-resolution normals disagree.
Standard jobs retain their existing allocation and behavior.

Positive/negative adjacent chunk faces sample identical world coordinates and Float32 field
values. Ordinary shared MC vertices have matching normals within `1e-5`; all tested normals
are finite unit vectors. The current classic-MC ambiguity telemetry is preserved; no MC33,
Transvoxel, transition cells or mixed-resolution collision stitching was added.
The browser checks HIGH-to-intact physical boundary samples around 256 m: no double heightfield,
missing floor or height jump above 0.03 m in this canonical fixture. Screenshots were inspected.
Appearance on arbitrary steep relief and native GPU hardware remains part of manual validation.

## Fidelity, before/after and phases

The preserved harness measures the actual production edit → scalar → MC → collider and render
path, with an independent analytic sphere/relief contour and Three.js visual-ray cross-check.
It now reads spacing from the actual published source rather than the unchanged default config.
Fixtures place contacts at tangent offsets equivalent to **0/2/4/6 m** relative to the 8 m lattice,
in both tangent body-fixed coordinates, without editing catalog data. Actual offsets agree
within 0.001 m. This is deliberate canonical +X phase coverage, not exhaustive latitude/slope certification.

| Body / R (m) | 16 m radius error before | 8 m canonical radius error | Maximum over four phases | Canonical depth error | Maximum depth error over phases |
| --- | --- | --- | --- | --- | --- |
| Moon 56.548 | 12.0826 | 5.8263 | 6.5195 | 0.01282 | 0.21279 |
| Moon 114.433 | 12.6661 | 7.2467 | 7.2467 | 0.00567 | 0.10450 |
| Mars 56.548 | 7.2361 | 5.8241 | 6.4232 | 0.01339 | 0.21337 |
| Mars 114.433 | 12.8701 | 7.2482 | 7.2482 | 0.00660 | 0.10542 |
| Earth 56.548 | 13.0753 | 3.6312 | 4.8569 | 0.01332 | 0.21290 |
| Earth 114.433 | 12.8528 | 6.4095 | 6.4095 | 0.00660 | 0.10548 |

All values are metres. Phase-specific maximum radius errors, ordered 0/2/4/6 m:

| Body / R | Phase 0 | Phase 2 | Phase 4 | Phase 6 |
| --- | --- | --- | --- | --- |
| Moon 56 | 5.8263 | 5.0231 | 6.5195 | 5.0235 |
| Moon 114 | 7.2467 | 6.0232 | 3.5460 | 5.9939 |
| Mars 56 | 5.8241 | 5.0223 | 6.4232 | 5.0228 |
| Mars 114 | 7.2482 | 6.0482 | 3.5510 | 6.0472 |
| Earth 56 | 3.6312 | 4.8569 | 3.1994 | 4.8569 |
| Earth 114 | 6.4095 | 4.0083 | 2.7723 | 4.0081 |

Largest visual/collider height disagreement across these fixtures: **7.994e-14 m**.
Depth limits remain 3.837 m for the small fixture and 4 m for the medium fixture.
HIGH gives 14.137/28.608 cells across diameter and 3.197/6.505 cells across depth respectively.
The 8 m profile passes, so resolution escalation stops here.

## Count, byte and job budgets

Existing impact cache ceilings are preserved: scalar **128/4 MiB**, mesh **128/16 MiB**,
collision **128/32 MiB**. D0/default debug limits are unchanged.

HIGH scalar memory per physical chunk is **169,884 B**: 143,748 B core plus 26,136 B exterior
faces. Resumable generation scratch is **509,652 B** (Float64 base + Float32 edited values).
The scalar byte cap permits at most **24** HIGH chunks, not 128. For coherent admission, the
unchanged 4 MiB BVH build bound also bounds each admitted retained mesh/collider: retained
collider bytes are less than source-mesh-plus-build-scratch bytes. Thus conservative mesh
and collision byte caps permit **4** and **8** HIGH chunks respectively.

Effective HIGH window capacity is `min(128,24,128,4,128,8) = 4`. All canonical small/medium
windows and the real +Y Game contact fit four complete chunks. Other orientations/placements
may require a larger window and explicitly block; they never silently fall back to a partial
8 m window or 16 m sampling. Budgets were not raised just to admit more regions.

For 33³ MC, scratch is **1,006,332 B**, conservative maximum output is **4,475,136 B**;
including temporary compact copies gives **9,956,604 B**. An explicit HIGH-only **10 MiB**
meshing-job ceiling covers that bound (also 10,126,488 B including the input scalar arrays).
The STANDARD job ceiling remains **2 MiB**. Collision build remains **4 MiB**. Runtime preflight
blocks a HIGH mesh whose BVH cannot fit, retains old authority and avoids repeated regeneration
of the same rejected source; a new invalidated/reconstructed source can be reconsidered.

| Body / R | Logical sphere-AABB chunks | Full HIGH window | Scalar B | Mesh B | Collider B |
| --- | --- | --- | --- | --- | --- |
| Moon 56 | 8 | 4 | 679,536 | 209,088 | 407,552 |
| Moon 114 | 8 | 4 | 679,536 | 227,520 | 429,008 |
| Mars 56 | 4 | 4 | 679,536 | 209,088 | 407,552 |
| Mars 114 | 8 | 4 | 679,536 | 227,616 | 429,120 |
| Earth 56 | 8 | 4 | 679,536 | 210,144 | 408,768 |
| Earth 114 | 8 | 4 | 679,536 | 230,976 | 433,024 |

Logical counts include empty space above the shallow cap and do not dictate dense allocation.
MC arrays are shared with rendering/collision; separate accounting conservatively counts that
payload in both caps. Old publication references may remain during preparation; retained
scalar bytes and staged mesh bytes are still diagnosed. These caps describe typed-array/cache
ownership, not a measurement of all JavaScript heap/GPU/driver overhead.

## Performance observations

`benchmark:volume` retains the original standard cases and adds same-physical-chunk STANDARD
vs HIGH impact measurements: Moon chunk `(6783,0,0)`, one 260 m/s edit, 3 warm-ups/21 repetitions.
Times are observations, never hardware-dependent CI thresholds or one-frame gameplay timings.

| Metric | STANDARD | HIGH |
| --- | --- | --- |
| Core samples | 4,913 | 35,937 (**7.315×**) |
| Core + boundary samples | 4,913 | 42,471 (**8.645×**) |
| Scalar bytes / generation scratch | 19,652 / 58,956 | 169,884 / 509,652 |
| Generation median / p95 (ms) | 4.872 / 5.543 | 39.005 / 44.042 |
| Vertices / triangles | 295 / 522 | 1,123 / 2,110 |
| Mesh bytes / observed live job arrays incl. compact result | 13,344 / 194,852 | 52,272 / 1,235,844 |
| Meshing median / p95 (ms) | 1.196 / 1.560 | 8.610 / 9.891 |
| Retained collider / BVH bytes | 25,888 / 12,288 | 101,888 / 49,360 |
| BVH pending job bytes | 30,016 | 117,904 |
| BVH build median / p95 (ms) | 0.168 / 0.234 | 1.037 / 1.278 |
| Raycast median / p95 (ms) | 0.0418 / 0.0691 | 0.0498 / 0.0608 |
| Capsule sweep median / p95 (ms) | 0.2966 / 0.4040 | 0.2029 / 0.2496 |

Query timings are small and noisy; the sweep observation does not establish a speed improvement.
The larger sampling/MC cost is explicit and is spread through scheduler steps in production.

| Moon impact | Profile | Window chunks | 2 ms budget frames | Render prepare sum (ms) | Atomic publication (ms) |
| --- | --- | --- | --- | --- | --- |
| 260 m/s / R56 | HIGH | 4 | 140 | 4.597 | 1.472 |
| 800 m/s / R114 | HIGH | 4 | 115 | 1.434 | 0.279 |
| 8 km/s / R433 | STANDARD | 32 | 124 | 3.624 | 0.897 |
| 50 km/s / R925 | STANDARD | 108 | 304 | 9.322 | 2.722 |

Large Moon sample/mesh/collider bytes remain **628,864/302,112/522,896** at R433 and
**2,122,416/823,008/1,382,424** at R925. Both retain 17³/16 m extraction and correct centre
floors. All twelve body/size production benchmarks fit their existing caps. The historical
17.779 ms large-publication spike remains a D1.1 optimization task; no timing reduction from
this noisy observation is claimed as a publication hardening fix.

## Tests, browsers, telemetry and delivery

49 D1.2 tests include all 43 required names plus resumable jobs, config/source/cache separation,
normal continuity, HIGH cavity ceiling collision, bounded fallback and over-budget blocking.
The existing D1.1 measurement tests now read actual source spacing; their tolerances are untouched.
F3 adds desired/published sampling profile, samples/axis, spacing, HIGH resident count and scalar/
mesh/collider MiB, requested R/D, diameter/depth cells and the existing publication-block reason.

| Validation | Result |
| --- | --- |
| `typecheck` | PASS |
| Focused volume/D0/D1/D1.2/fidelity/globes/render-space/collision/C4/Sun | 410/410 PASS |
| `check:impact-fidelity` | **PASS, accepted=true, 24/24 fixtures**, unchanged tolerance |
| Full tests | 1,052/1,052 PASS |
| Build | PASS; existing bundle-size warning |
| Browser volume | PASS: original Phase 3/D0/D1 plus real HIGH rim walk, floor, wall, rays, boundary, eviction/return; zero errors |
| Browser space | PASS in `DR_D1_ONLY=1` fresh-Game near-body scope: real 8 km/s STANDARD Moon/Mars, controlled Earth and 260 m/s HIGH Moon; zero errors |
| `benchmark:volume` | PASS; original cases plus 17³/33³ median/p95 comparison |
| `benchmark:impact-volume` | PASS, 12/12 cases |
| Diff check | PASS; repeated on staged commits |
| GitHub Actions | Exact final pushed SHA is inspected and reported after delivery commit |

The short spatial fixture explicitly invokes real Game CCD/C4 while in space, then reconciles
the domain and hands off to local physics. A MINOR approach uses the production measured
`captureRadiusM`, not the broader high-speed envelope. This avoids a fixture that advances
only 2 m while still kilometres outside the applicable contact shell. Events/edits are not
fabricated. The older +X large crater and the new +Y small site are separate authoritative edits.
This is a deterministic near-body acceptance, not a claimed uninterrupted low-speed travel session.

Both browsers use WebGL2/SwiftShader. Screenshots show the published HIGH crater and actual
Game floor; lighting remains the existing simple material, as required by the narrow scope.
Native GPU/WebGPU performance and appearance require human validation. Solar rendering,
CCD margins, autopilot, catalog data, C4 policy and Manaus P0 source files remain untouched;
their existing full unit regressions pass. No separate local-city browser was required by this
sprint; the previously completed local acceptance remains historical evidence.

Ignored evidence: `artifacts/d12-fidelity-phases.log`, `d12-crater-fidelity.json`,
`d12-high-tests.log`, `d12-typecheck.log`, `d12-focused-tests.log`, `d12-all-tests.log`,
`d12-build.log`, `d12-volume-browser.log`, `d12-space-browser.log`, `volume-meshing-browser.json`,
`space-hardening-d1-fresh.json`, `d12-benchmark-volume.log`, `benchmark-volume.json`,
`d12-benchmark-impact.log`, `benchmark-impact-volume.json` and `d12-*.png`.
No generated JSON/screenshots/logs, dependencies or workspace files are committed.

Delivery uses the requested profile/coherent-publication/tests/docs commit separation. The final
commit SHA and exact-SHA CI URL are reported after push; this document cannot embed its own SHA.

## Manual acceptance and STOP

Automatically verified: six canonical fidelity cases plus phases, exact shared samples/normals,
bounded coherent admission/jobs, source identity, fallback/atomic swap, D0 queries/player support,
rebase, eviction/body-switch regeneration, physical boundary and real Game C4 HIGH/STANDARD flows.

Manual validation: create small impacts at arbitrary lunar/Martian locations and controlled Earth
outside Manaus; inspect rim/outer-window continuity and walk/jump against walls. Observe F3 HIGH
33/8 m, preparation while old terrain remains, and HIGH regeneration after leaving/returning.
On other orientations an oversized full region must show `high-res-budget` and keep intact/old
authority. Check frame pacing and appearance on the user's GPU, plus preserved solar approach.

Remaining D1.1: multi-crater residency and hysteresis, actual solar crater lighting, volume
frustum culling, per-tile masks and publication-spike preparation. The nearest-edit selection,
fixed volume light and original mask/culling remain explicitly pending.
**STOP after D1.2. Do not resume D1.1 automatically and do not start D2.**
