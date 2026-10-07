# SUN-APPROACH-P0 — 2026-10-07

Initial HEAD: `b1ab6a8397aca7b75c0c5319be94af52d80f8e6b`, branch `feat/universe-map`.
The new user attachment authorizes this solar checkpoint, documentation, commit and push.
Its audited `02df01c` predates the already delivered D1. D1 remains intact; this patch does
not restart it, undo it or authorize D2. Stop again for manual solar acceptance after delivery.
The exact final SHA and its GitHub Actions run are verified after push and reported at delivery.

Four commits group this delivery: production policy/presentation + unit regressions,
browser acceptance, observation-distance visual refinement, and documentation.

- `95de6822c69ebfe3a29ed234f0109e6cf4b64ef1`: physical/navigation separation, presentation, HUD/F3 and unit regressions.
- `9103c61b072301f21f671f834ce822018cc2800d`: production browser approach/contact/quality/screenshot acceptance.
- `fc84d88f659d0bd958603ea2361a90b598f91df4`: filtered intermediate photosphere detail at autopilot observation distance.
- Final documentation commit: its exact SHA is reported with the delivery and verified on the remote.

Production implementation `95de682`:
Its [GitHub Actions run](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/37680330459)
completed successfully. Final documentation HEAD receives its own exact-SHA CI check after push.

## Physical contact and navigation

The old stellar arrival policy assigned **one physical stellar radius** to both margins.
For the Sun, each margin was 695,700,000 m, making the collision sphere 1,391,400,000 m = 2R.
The player consequently stopped 695,700 km above the visible photosphere.

`BodyArrivalPolicy` now separates the observation standoff from the numerical collision margin.
`BodyNavigation` derives both the actual CCD envelope and the live navigation target from that
policy. `ResolvedTarget.exclusionMarginM` also protects the controller's fallback path when
no explicit envelope is supplied; it no longer substitutes solar autopilot safety for contact.
Legacy callers without that optional field retain their old fallback contract.

| Quantity | Old | New |
| --- | ---: | ---: |
| Sun physical equatorial/polar radius | 695,700,000 m | 695,700,000 m |
| Earth physical equatorial radius | 6,378,137 m | 6,378,137 m |
| Stellar autopilot arrival margin | R | 0.03R = 20,871,000 m |
| Stellar observation margin | coupled to contact | 20,871,000 m, navigation only |
| Stellar CCD margin | R | max(100,000 m, R × 0.0001) = 100,000 m |
| Solar effective collision radius | 1,391,400,000 m | 695,800,000 m |

There is no collision at the former 2R boundary or in the optical corona. Manual flight may
continue inward after cancelling the autopilot. Analytic continuous CCD still sweeps all bodies,
arrests contact just outside the photosphere plus epsilon, retains the entry side at 256c,
and removes inward velocity without reflecting it. An unlocked direct ≥1c contact creates
one C4 `CATASTROPHIC_IMPACT` episode at the new boundary.

Sun capabilities remain `hasSolidSurface=false`, `canLand=false`,
`supportsVolumeDestruction=false`, `surfaceKind=none`. No ENU landing, ground, terrain provider,
MC, rocky edit, stellar destruction, temperature, radiation, damage or death system is added.
D5 still owns eventual stellar destruction.

## Presentation and precision

`SunVisual` retains one bounded quad, one active material and two triangles. Its analytic
`SunMaterial` reconstructs rays and intersects a **dimensionless sphere of radius R/d**.
The physical limb therefore follows `asin(R/d)`, including off-axis views, instead of scaling
an optical billboard by `tan(angle)` as the angle approaches 90°. The quad is bounded and
camera relative, safely beyond the near plane. Its fragment depth is the sky depth, keeping
opaque foreground city/planet geometry in front. No astronomical Object3D coordinates,
physical radius changes, compressed distances, dynamic textures or CPU surface vertices.

For small angular radii, a conservative clipped optical rectangle reduces rasterized pixels.
For larger angular radii, the same shader covers the viewport. This geometry optimization
does not change the ray, limb or optical function, so there is no visual LOD replacement pop.
The existing bounded proxies still support navigation samples/labels independently.

Angular-radius regimes (continuous detail/glare weights, not separate physical sizes):

| Regime | Physical angular radius | Presentation |
| --- | --- | --- |
| DISTANT | <1° | Compact bright analytic disc, tight glare |
| DISC | 1–12° | Photosphere granulation, sparse active regions |
| CLOSE | 12–45° | Clearly resolved surface, curved/darker limb, prominences |
| IMMERSIVE | ≥45° | View-filling photosphere, filtered body-fixed fine detail |

Photosphere coordinates come from the reconstructed normal converted from camera space into
the solar body orientation. The stellar visual orientation uses the catalog axial tilt and
2,192,832 s rotation period; Earth/Moon/planet frame and landing contracts are unchanged.
Observer motion does not pin active regions to screen coordinates. Procedural evolution uses
the simulation clock, slow deterministic MaterialX noise, and no random per-frame texture.

The material combines macro convection (frequency 18), Worley granulation (95), darker lanes,
fine noise (370), sparse dark active regions with warmer bright faculae, and stylized limb
darkening. Immersive observation views add an intermediate filtered 3,000-frequency field;
very close views add fine body-fixed structure (300,000, or 500,000 on Ultra),
filtered with screen derivatives to reduce aliasing. These frequencies/colours are presentation
choices, not a solar hydrodynamics or measured granule model.

Corona/glare remain optical: tight glare, inner exponential halo, asymmetric 7/13-frequency
streamers, and six bounded irregular limb arcs on High/Ultra. The outer cutoff is five times
the physical angular **sine radius**, limited to the forward hemisphere. `5R` in diagnostics
means this optical scale, never a physical exclusion sphere or simulated plasma radius.
ACES exposure stays unchanged; no bloom/postprocess rewrite or all-screen white exposure.
`SpaceLayer` attenuates stars by angular separation from the actual solar sample; looking away
preserves the sky. Photosphere opacity also covers stars behind the disc.

| Preset | Material detail | Prominences | Draw calls / triangles / active materials |
| --- | --- | --- | --- |
| Low | Macro + simple granulation/lanes + corona | off | 1 / 2 / 1 |
| Medium | Additional fine/filtered near detail + corona | off | 1 / 2 / 1 |
| High | Full detail + corona | six analytic arcs | 1 / 2 / 1 |
| Ultra | Higher near microdetail frequency + corona | six analytic arcs | 1 / 2 / 1 |

All four existing presets were exercised in the browser. Material replacement disposes the
previous active material and does not accumulate scene meshes. Fragment work scales with
covered pixels and quality; a close full-screen star is not promised to have distant-star cost.
No hardware FPS guarantee is inferred from software-rendered Chromium checks.
Reference for the TSL/MaterialX implementation:
[Three.js Shading Language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language).

## Diagnostics and measured approach

The selected solar HUD prioritizes distance to the photosphere, followed by centre distance,
relative/closing speed, angular diameter and autopilot state. The large selected/unselected
solar label fades by physical projected diameter; the navigation marker/HUD retain target identity.
F3 exposes exact centre distance, photosphere clearance, physical radius, angular diameter,
projected diameter, CCD radius/epsilon, autopilot standoff, optical extent and current CCD contact,
plus visual regime/draws/triangles. `Game.solarApproachState` exposes the same live values.

Representative centred 58° vertical FOV, 900 px viewport (perspective projected diameter;
very large numbers describe an edge outside the viewport, not a giant mesh):

| Centre distance | Physical angular diameter | Projected diameter |
| --- | ---: | ---: |
| Current catalog Earth–Sun at game epoch 0: 147,100,698,497.64 m | 0.542° | 7.68 px |
| 149,597,870,700 m (1 AU fixture) | 0.533° | 7.58 px |
| 10R | 11.478° | 164.21 px |
| 5R | 23.074° | 334.30 px |
| 2R | 60° | 947.42 px |
| 1.5R | 83.621° | 1,470.17 px |
| 1.1R | 130.760° | 3,591.82 px |
| 1.03R (autopilot) | 152.275° | 6,579.74 px |
| R + 100,000 m (CCD) | 178.057° | approximately 97,187 px |

The browser uses an explicit 1 AU approach fixture without intervening planets, actual Tab/P
input, and production Game/controller/ephemeris steps. It is not a claimed unattended manual
Earth-to-Sun play session. Autopilot traverses acceleration, braking, capture and arrival, with
zero contacts, final clearance about **20,871,003 m**, relative speed zero and angular diameter
**152.275°**. Cancelling P and thrusting W moves inward without an observation-radius wall.

Boundary fixtures exercise actual Game CCD/C4 rather than fabricating events:

- Old 2R crossing: centre distance becomes <2R, clearance about R, contact **NO**.
- Corona at 1.5R: manual flight continues, contact **NO**.
- Physical contact: clearance **100,001 m** (epsilon + one-metre motion clamp), contact **YES**,
  relative speed zero, no outward bounce.
- Direct 1.001c: exactly one C4 catastrophic episode at **695,800,000 m**; intact catalog,
  unchanged volume metrics and space physics, with no rocky allocation.

Ignored screenshots cover 1 AU, 10R, 5R, 2R, 1.5R, 1.1R, the photosphere epsilon and looking away.
They were visually inspected: progressive size, readable granulation/active regions and curved
limb, asymmetric halo/arcs, view-filling near texture, no square edge/black centre/disappearance.
The actual resolved screenshot also checks a near-solar pixel becomes dark when looking away.
Final QA added the 3,000-frequency field because the autopilot observation view was too smooth;
the fresh-Game acceptance was repeated afterward and its arrival/near screenshots inspected.
Screenshots, logs, browser JSON and temporary files remain under ignored `artifacts/`.

## Validation and manual gate

36 solar tests were added, including the mandatory named radius/scale, 2R/corona, CCD/tunnelling,
no-bounce, autopilot/cancel, C4/volume/capability, angular-size/finite-proxy, LOD/label/orientation,
30/60/120 FPS cases, fallback collision policy, preset lifetime and catalog rotation.
Existing solar navigation/presentation expectations were updated for the separated policy.
| Check | Result |
| --- | --- |
| Typecheck | PASS |
| Focused tests | 189/189 PASS |
| Full tests | 1,000/1,000 PASS |
| Build | PASS; baseline bundle-size warnings only |
| Browser space | PASS; controls/map, Earth departure, Moon/Mars landing, Jupiter, C4, Sun and D1 crater walking |
| Browser local | PASS; actual Manaus P0 destruction, ascent/orbit and real Earth reentry/city restoration |
| Fresh solar Game | PASS after the final surface-detail refinement; Tab/P, arrival rendering, manual override, boundaries, F3, C4, all four presets |
| Browser page/console errors | zero in all completed runs |
| Diff check | PASS |
| GitHub Actions | implementation `95de682` PASS; exact final documentation SHA is inspected after push |

Evidence: `artifacts/sun-typecheck.log`, `sun-focused-tests.log`, `sun-all-tests.log`,
`sun-build.log`, `sun-space-browser.log`, `sun-local-browser.log`, `sun-fresh-browser.log`,
`space-hardening-browser.json`, `sun-approach-browser.json`, `browser-summary.json`.
The browsers force WebGL2/SwiftShader; native WebGPU/GPU performance remains part of manual
acceptance. The final refinement affects only procedural surface shading and was checked by
typecheck/build and fresh solar rendering; the completed full gameplay regressions are retained.

22 files changed: solar policy/navigation/controller; SunMaterial/SunVisual/solar presentation
math and samples/controller/visual layer; directional star glare; Game/HUD/labels; three unit
test files; the existing space browser plus its solar helper; this status, main status,
current prompt and the solar specification. No dependencies, generated assets or screenshots
are committed. D1 implementation, planetary physics/collider/volume and catalog radii remain
their existing authority.

Manual acceptance is still required for the player's sense of brightness/scale, surface motion,
sunspots/limb/arcs, quality/performance on their GPU, and the actual flight controls:

1. Approach manually through the former 2R position and corona; verify no contact in F3.
2. Lock Sol and engage P; arrive near 20,871 km above the photosphere.
3. Cancel P and continue inward. Contact should occur near 100 km clearance without bounce.
4. Look away; verify sky/navigation remain usable and the glare does not whiten every direction.
5. Repeat direct ≥1c contact; verify one C4 event, intact Sun and no ground/rocky crater.

**STOP after SUN-APPROACH-P0. Do not expand D1, begin D2 or implement stellar destruction.**
