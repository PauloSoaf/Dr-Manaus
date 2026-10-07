# D1.1 — fidelity gate blocks further hardening — 2026-10-07

Initial HEAD: `644e2def54fe39213f1be6b4053749b8ecc305c0`, branch `feat/universe-map`.
This is the delivered SUN-APPROACH-P0 on top of D1 (`b1ab6a8`). All four solar commits,
the separated photosphere CCD/autopilot radii, procedural presentation and diagnostics are preserved.
Solar delivery and manual acceptance: [21-status-SUN-APPROACH-P0.md](21-status-SUN-APPROACH-P0.md).

**D1.1 is not complete or accepted. Its explicitly requested fidelity STOP condition was reached.**
The current attachment authorizes bounded multi-crater residency, real solar lighting, culling,
per-tile masks and publication preparation, but also states:

> If error exceeds an explicit reasonable tolerance: STOP and report that D1 needs a dedicated
> high-resolution local volume LOD before D2.

The tolerance was written before executing the first measurements. It was not relaxed after
observing the results. The remaining hardening changes and D2 were not implemented after this gate.
Only reproducible diagnostic/test code, its npm command and documentation changed in this delivery.
No runtime authority, sample spacing, MC topology, renderer, collision or solar code changed.

## Reproduction and tolerance

```powershell
npm run check:impact-fidelity
```

This command runs six actual production D1 fixtures: Moon, Mars and controlled Earth at
260/800 m/s, creates authoritative impact edits through the destruction service, completes
sample/MC/BVH/render publication, and writes `artifacts/d11-crater-fidelity.json`.
**It currently returns exit code 1 and `accepted: false`.** That is the unresolved accuracy gate,
not an accepted hardening checkpoint. The error message requests **D1.2 HIGH-RES IMPACT CORE
before D2**. Generated JSON, logs and browser screenshots remain ignored.

Declared limits in `tests/helpers/crater-fidelity.ts`:

- Opening radius: maximum error **8 m**, half the current 16 m cell width. This already allows
  about 14.1% error at radius 56.55 m and 7.0% at 114.43 m.
- Depth: maximum error **min(4 m, 15% of requested depth)**, or 3.837/4 m for these two fixtures.
- Opening contour: surface deficit **0.25 m** relative to the actual intact relief. This avoids
  numerical/noise differences at the exact surface, without allowing a several-metre depression
  to count as intact. The analytic sphere/relief contour at the same deficit provides an
  independent reference; it differs from the requested opening radius by less than 1 m.

For each radius, eight deterministic non-axis-aligned radial directions are sampled with
24 bisection steps. Centre depth uses local offset `(0.125, 0.125) m` to avoid ambiguous exact
chunk-boundary triangle ray ties. Rays target the actual published D0 MC collider; independent
Three.js rays target the actual published MC geometry at each measured rim. Their maximum
height disagreement is below `5e-14 m` in these fixtures. A nearby render origin is explicitly
set for the visual ray comparison; body-fixed CSG/collision authority remains unchanged.

These are canonical +X production impact fixtures, not a claim to cover every grid phase,
latitude, slope or terrain feature. In particular, their very small centre-depth errors do not
certify the worst possible depth under arbitrary sample alignment. The measured rim error
already fails without needing such additional cases.

## Extraction results

Requested 56 m fixture: radius **56.5481 m**, depth **25.5799 m**.
Requested 114 m fixture: radius **114.4333 m**, depth **52.0406 m**.

| Body | Requested R / D (m) | Maximum radius error (m) | Maximum analytic contour error (m) | Centre depth error (m) | Gate |
| --- | --- | --- | --- | --- | --- |
| Moon | 56.548 / 25.580 | 12.0826 | 12.3055 | 0.02696 | FAIL radius |
| Moon | 114.433 / 52.041 | 12.6661 | 12.8876 | 0.01238 | FAIL radius |
| Mars | 56.548 / 25.580 | 7.2361 | 7.4593 | 0.02730 | PASS canonical fixture |
| Mars | 114.433 / 52.041 | 12.8701 | 13.0953 | 0.01327 | FAIL radius |
| Earth | 56.548 / 25.580 | 13.0753 | 13.2963 | 0.02647 | FAIL radius |
| Earth | 114.433 / 52.041 | 12.8528 | 13.0722 | 0.01328 | FAIL radius |

On Moon the 56.55 m requested opening extends to **68.63 m** in a measured direction.
The 114.43 m opening extends to **127.10 m**. Earth reaches **69.62 m** for the small fixture;
the independent analytic quarter-metre contour is around 56.33 m. This is coarse extraction
smearing at the rim, not a disagreement between mesh and collider or an inaccurate sphere edit.

| Fixture | Cells across diameter | Cells across depth | Nominal samples across diameter / depth |
| --- | --- | --- | --- |
| R 56.548 / D 25.580 | 7.0685 | 1.5987 | 8.0685 / 2.5987 |
| R 114.433 / D 52.041 | 14.3042 | 3.2525 | 15.3042 / 4.2525 |

Nominal samples mean continuous span/cell spacing + 1; they are not fractional entries in an
array. Actual chunks still have 17 samples per axis across 256 m. No resolution/LOD changes
or Transvoxel were introduced to conceal the failure.

## Replacement footprint

The diagnostic also projects the eight corners of every published replacement chunk into
the local tangent axes using Float64 frame transforms. It records requested radius, local
replacement extents, enclosing footprint radius and maximum conservative overshoot.

In all six fixtures the four published chunks cover tangent extents **[-256, 256] m** in both
axes, enclosing radius **362.039 m**. Conservative replacement overshoot beyond the nominal
opening is **305.491 m** for the 56 m fixture and **247.605 m** for the 114 m fixture.
These are bounds on the published chunk footprint, not an assertion that every projected
corner is a point on the actual relief. MC reproduces surviving intact terrain throughout
this replacement window, but at the current 16 m sampling spacing.
This is diagnostic JSON telemetry; production F3 footprint/mask metrics remain pending.

## Hardening status after the required STOP

| Requested change | Current behavior / status |
| --- | --- |
| Multi-crater policy | Pending. `selectImpactVolumeDemand()` still sorts nearby edits and selects `nearby[0]`. Logical edits survive, but other regions may appear healed. |
| Maximum simultaneous coherent demand regions | Still **one** driving impact region, within 128 chunks. Overlapping edits can affect that region; this is not independent multi-region admission. |
| Complete-region eviction and priority | Pending. Existing bounded coherent single-window publication remains; no proposed A+B+C admission policy was implemented. |
| Region hysteresis | Pending; no new retention preference. |
| Real solar direction in volume material | Pending; the fixed `(0.3, 0.8, 0.5)` lighting remains. Solar disk/CCD changes are preserved, but do not fix crater lighting. |
| Volume frustum culling | Pending; volume meshes still use `frustumCulled = false`. |
| Per-tile filtering | Pending; current shared mask can loop over **128 AABBs per fragment**. New average/maximum comparisons cannot be claimed. |
| Atomic commit preparation optimization | Pending; original D1 sample/MC/BVH preparation and synchronous publication remain. |
| Small-crater fidelity | Measured and failed; dedicated high-resolution local impact core is required before D2. |
| Replacement footprint | Quantified in diagnostic output; runtime F3 extension pending. |

The two named D1.1 measurement tests and an independent gate-decision test were added.
Their purpose is to validate the measurement/reference/publication agreement and the acceptance
decision, **not to assert that current extraction accuracy is acceptable**. `npm test` passing
does not override `npm run check:impact-fidelity` failing. The twenty other named multi-region,
lighting, culling, filtering and transaction hardening cases have not been added because their
implementations are pending. Do not report all twenty-two cases as complete.

## Baseline benchmark, not a claimed optimization

The required `npm run benchmark:impact-volume` was run on the preserved D1/Sun implementation
before any functional modification. Representative Moon results, 2 ms granted scheduler steps:

| R / D (m) | Logical chunks | Published chunks | Render preparation (ms, summed) | Original atomic publication (ms) | Frames |
| --- | --- | --- | --- | --- | --- |
| 56.548 / 25.580 | 8 | 4 | 2.667 | 1.314 | 46 |
| 114.433 / 52.041 | 8 | 4 | 0.837 | 0.229 | 12 |
| 433.056 / 202.689 | 216 | 32 | 1.949 | 0.651 | 73 |
| 924.982 / 451.892 | 1,100 | 108 | 7.130 | 2.001 | 228 |

Moon 433 m uses 628,864 sample bytes, 302,112 mesh bytes and 522,896 collider bytes;
925 m uses 2,122,416 sample bytes, 823,008 mesh bytes and 1,382,424 collider bytes.
Mars/Earth also pass all twelve original benchmark cases, with the same published counts
4/4/32/108 and existing memory caps. Large logical edits are not shrunk to match residency.

The previous D1 report observed **17.779 ms** at the large-window publication. The current
baseline observation of 2.001 ms uses the unchanged implementation and therefore is **not
evidence of a code improvement**. Scheduling, warm-up, contention and runtime variability
matter; no hardware timing threshold was added. A true prepare/commit optimization and
controlled before/after comparison remain pending. Baseline evidence is copied to
`artifacts/d11-before-benchmark.json` and `d11-before-benchmark.log`.

## Validation and delivery

| Check | Result |
| --- | --- |
| Typecheck | PASS |
| Focused volume/D0/D1, globe, render-space, collision, C4, Sun and fidelity tests | 361/361 PASS |
| Full tests | 1,003/1,003 PASS |
| New measurement/gate tests | 3/3 PASS |
| Fidelity accuracy acceptance | **FAIL; exit 1; five of six canonical radius fixtures exceed 8 m** |
| Build | PASS; existing bundle-size warning |
| Browser volume | PASS; original Phase 3 + D0 + D1 on Moon/Mars/Earth, zero errors |
| Browser space | PASS; navigation/landing, C4, full solar approach and Game D1 crater walking, zero errors |
| Browser local | PASS; Manaus destruction, real orbital flight/reentry/city restoration, zero errors |
| Impact-volume benchmark | 12/12 preserved baseline cases PASS |
| Diff check | PASS; repeated on staged delivery before commit |
| GitHub Actions | Exact final pushed SHA inspected after delivery commit |

The delivery commit contains this status, main status and current prompt, a quantitative
fixture helper, measurement tests, diagnostic script and npm command. Final SHA/commit and
exact-SHA CI URL are reported after push; a document cannot embed its own resulting commit SHA.
The unchanged GitHub workflow runs unit tests, types and build; it does not run the separate
fidelity acceptance command. A green workflow therefore does not certify D1.1 accuracy.

Validation evidence: ignored `artifacts/d11-typecheck.log`, `d11-focused-tests.log`,
`d11-all-tests.log`, `d11-fidelity-tests.log`, `d11-fidelity-gate.log`, `d11-build.log`,
`d11-volume-browser.log`, `d11-space-browser.log`, `d11-local-browser.log`,
`volume-meshing-browser.json`, `space-hardening-browser.json` and `browser-summary.json`.
All three browsers force WebGL2/SwiftShader; no new native WebGPU/GPU performance claim is made.

**STOP at this failed fidelity gate. D1.1 remains pending. Do not start D2.**
The next engineering prerequisite is a separately scoped **D1.2 HIGH-RES IMPACT CORE** with
coherent local publication and a seam-safe resolution contract. Do not globally lower spacing
or introduce mixed collision LOD/Transvoxel as an incidental change in this diagnosis.
