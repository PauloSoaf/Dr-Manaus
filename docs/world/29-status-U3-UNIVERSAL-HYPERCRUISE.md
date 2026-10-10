# U3 — Universal Hypercruise

Baseline: `64eb0210fda8a111af6cd1cf3d8743f59c362ba8`, `feat/universe-map`, 2026-10-09.
Scope is U3 and the permanent regression gate. U4, BH0–BH2, U5 and U6 remain separate checkpoints.

## Architecture and location authority

`UniversalTravelController` owns one immutable `UniversalTravelPlan` and a continuous
`UniversalTransitState`. The plan snapshots the requested target, canonical destination,
BigInt system/sector anchors, real logical distance, departure epoch, duration and final body leg.
Selecting another HUD/map target does not retarget a moving journey.

While anchored, `UniverseRuntime.address` and the active galaxy/system are coherent authority.
While in transit, `UniverseRuntime.location` exposes `mode: transit` and the route state; its
retained address identifies source resources only. It exposes neither a fictitious surface nor
a source-system player position. Address and active galaxy do not change incrementally.
`setAddress()` rejects crossing galaxy, system or sector boundaries; transactional installation
is required. Logical global positions are metadata and never become Three transforms or velocity.

P dispatches same-system bodies to the existing CosmicFlight. Remote stars/systems/bodies use
interstellar or intergalactic hypercruise. Galaxy targets resolve through `GalaxyEntryResolver`:
MW → safe Sol space, Andromeda → `andromeda/200,0,0/1`. The latter is a deterministic production
entry descriptor; the old U2 fixture helper is now a QA compatibility wrapper around it.
Production preparation calls `prepareTravel()` and transactional installation, never `testArrival()`
or debug arrival controls. Black holes, clusters, cosmological anchors and the horizon remain gated.

## Timing, phases and cancellation

For distance `d` in light years, nominal travel duration is:

- Interstellar: `clamp(5 + 4 log10(1 + d/4), 5, 25)` seconds.
- Intergalactic: `clamp(17 + 5 log10(1 + d/1e6), 15, 30)` seconds.

The 17-second intercept makes the Andromeda main leg about 19.72 seconds. One second of spool
and half a second of final synchronization give about 21.22 seconds without a destination hold.
An analytical integrated smoothstep profile allocates 20% acceleration, 60% cruise and 20%
deceleration; phase boundaries have continuous speed and acceleration. Progress comes from
elapsed simulation seconds rather than adding frame-dependent increments. Tests compare
30/60/120 FPS. Real gameplay time advances the global epoch; no millions of years are simulated.

Effective FTL speed is `distance × d(progress)/dt`, displayed as c/kc/Mc or ly/s. It never enters
PlayerController, local PhysicsWorld, Warp or CCD. This is **fictional gameplay transport** using
real-scale logical distances, not a claim of physically possible FTL.

X during zero-progress spool aborts at the source. Once moving, X applies a continuous-speed
emergency deceleration (normally 0.8 seconds), then stops in `coasting` transit. Source/destination
teleports never implement cancellation. P resumes the immutable destination. Selecting the
original source system and pressing P reverses the logical route from the stopped progress.
Arbitrary third-destination retargeting while coasting is deliberately deferred; resume/source
return are supported. P during an active moving journey does not restart it.

## Preparation, hold, arrival and final body leg

At 65% progress, the controller prepares detached galaxy/system frames, providers and visuals
once. If not ready at 98.5%, it holds and reports SINCRONIZANDO DESTINO. Preparation failures
retain the source runtime and can be retried with P; stale asynchronous results are disposed.
No partial galaxy/address/frame handoff is published. Successful installation activates all
resources in one synchronous transaction and disposes the old generated session. Failure
restores the previous runtime, frames, render origin and resources.
Failure during final activation also preserves the last published progress; retry never rewinds
the observer from final synchronization to the 98.5% preparation boundary. The runtime rollback
test first reproduced that regression and now checks a failure after partial synchronization.

U1 and U3 share `safeSystemArrivalM()`: a corridor outside orbital extents, including actual Solar
ephemeris positions (curated Solar bodies have no generated `orbit` field). Velocity is zero,
Warp/autopilot/landing capture are cleared. Sol arrival is in SYSTEM space, never Manaus ground.
Remote body targets continue through the existing intra-system CosmicFlight after installation.
They do not auto-land; F still owns landing capture, terrain readiness and physical handoff.

## Presentation and input

Transit runs no local player physics, Manaus simulation, terrain/volume streaming or intra-system
Warp/CCD updates. B and F presses are consumed. M and camera look remain available. Existing
source resources remain allocated for rollback but their planets, terrain, bodies, galaxy session
and labels stand down while the camera continues rendering. Audio uses vacuum.

`HypercruisePresentation` uses fixed seeded buffers: 384 animated streaks and two 4,096-point
galaxy proxies. Positions remain camera-relative (20 km galaxy viewing distance); proxy angular
scale follows logical travelled/remaining distance. There is no 50%-progress sky switch, no
destination planetary world before commit and no per-frame geometry/generator allocation.
Streaks and galaxy proxies fade at arrival. Remote target ephemerides use a bounded cache.

HUD shows immutable trip destination separately from selected target, phase/domain/progress,
distance travelled/remaining, effective speed, ETA, preparation and cancel/resume controls.
F3 includes plan/source/destination/galaxy/location-mode telemetry. Galaxy/Cosmos map route
markers use transit progress and suppress the anchored source player marker. Map placement is
schematic; U5 full star picking/search remains pending. Production catalogue entries include
Sol, MW sectors 0/17/18/500 and two Andromeda sector-200 systems.

## Logical travel benchmarks

Measured with real canonical descriptors and safe Sol-space origin; nominal duration excludes
spool/final synchronization. Peak c is the analytical main-leg speed, not physical local velocity.

| Route | Distance (ly) | Nominal / expected total (s) | Peak effective c |
|---|---:|---:|---:|
| Sol → sector-zero nearby system | 64.845 | 9.943 / 11.443 | 2.534e8 |
| Sol → MW 17,-2,4/0 | 1,848.131 | 15.662 / 17.162 | 4.585e9 |
| MW 17,-2,4/0 → MW 18,-2,4/0 | 109.189 | 10.807 / 12.307 | 3.926e8 |
| Sol → MW 500,0,0/0 | 50,056.777 | 21.390 / 22.890 | 9.093e10 |
| Sol → Andromeda production entry | 2,507,324.917 | 19.725 / 21.225 | 4.939e12 |
| Andromeda → MW / Sol | 2,507,324.917 | 19.725 / 21.225 | 4.939e12 |

Galaxy-centre selection distance and production-entry travel distance are intentionally distinct:
Andromeda entry is about 20 kly from M31's centre. Neither distance comes from a render proxy.
Main-leg peaks include the 98.5% progress extent: `0.985 × distance / (0.8 × duration)`.

## Validation and limits

Permanent gate: [REGRESSION-GATE.md](REGRESSION-GATE.md). Initial gate installed before U3:
488 runtime tests PASS and typecheck PASS. U3 focused coverage includes every requested T_U3 ID,
plus immutable-target, profile continuity, source return, final-phase cancellation, async retirement,
retry and address-ownership checks. Browser checkpoints exercise the real production input path,
instrument QA arrival methods to throw, verify suppressed physics/streaming and repeat five
production Sol → MW → Sol → Andromeda → Sol cycles with resource count checks.

The A → B benchmark uses the actual installed A runtime and canonical B descriptor. Arrival
transactions for MW A → B and Andromeda A → B are covered by focused runtime tests; the browser
runner's measured production routes are Sol, MW 17,-2,4/0, Andromeda entry and remote Earth.

### Production browser measurements

The standalone U3 run completed 24 measured routes, including five full
Sol → MW → Sol → Andromeda → Sol cycles, with zero page/console errors. Normal Andromeda legs
took approximately 21.3 seconds. X at progress 0.402224 stopped continuously at 0.418870 in
transit; P resumed and arrived at the canonical Andromeda system. The Earth return installed
Sol and engaged the existing CosmicFlight final leg. B resumed working after transit.

| Active system | Providers | Frames | Dynamic body visuals |
|---|---:|---:|---:|
| Sol before departure / after every return | 6 | 24 | 19 |
| MW 17,-2,4/0 after arrival | 32 | 93 | 34 |
| Andromeda 200,0,0/1 after arrival | 22 | 65 | 20 |

During transit, the source counts remain owned by the source runtime; preparation owns a
detached destination until atomic commit. Source roots are hidden and actual PlayerController,
CosmicFlight and streaming probes recorded **zero** updates during transit. Counts do not
incrementally migrate between systems. Every Solar cycle returned to **88 geometries and
7 textures**, with identical provider/frame/visual counts and no observed cumulative growth.
The maximum measured Object3D position magnitude in that standalone run was
**6,393,114.981 m**, below the 1e9 m regression bound. Logical distances of order 1e22 m were
never copied into Three transforms.

The final aggregate browser gate also passed all five existing runners, including another
24 U3 routes and five production cycles. In this run, every Solar cycle returned to exactly
**6 providers, 24 frames, 19 visuals, 90 geometries and 7 textures**. The isolated run's 88
and aggregate run's 90 geometries are separate baselines; neither run grew across its cycles.
Final transit probes again recorded zero physics/CosmicFlight/streaming updates and a maximum
Object3D position magnitude of **6,392,675.657 m**. Cancellation stopped from 0.403266 to
0.419912 in transit; the resumed Andromeda route took 23.498 seconds including its interruption.
The remote Earth return took 21.218 seconds and engaged the final-leg autopilot.

Automated regression verdicts are PASS for Manaus local/aerial, Solar, Sun P0, Moon/Mars landing,
D1 publication, D1.2 fidelity, U0 targets/precision, U1 generated systems, U2 galaxy ownership,
resource roundtrips and bounded rendering. The aggregate runners took 139.926, 86.354, 249.795,
40.576 and 486.229 seconds respectively (about 16.7 minutes total). Browser artifacts remain
ignored and are not committed.

### Validation commands

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| Focused `tests/universal-hypercruise.test.ts` | 69 / 69 PASS |
| `npm run test:regression` | 557 / 557 PASS (488 pre-U3 + 69 U3) |
| `npm run check:impact-fidelity` | 24 cases PASS; tolerances unchanged |
| `npm test` | 1,337 / 1,337 PASS |
| `npm run build` | PASS |
| `npm run test:browser:space` | PASS |
| `npm run test:browser:galaxy` | PASS |
| `npm run test:browser:hypercruise` | PASS; five production cycles |
| `npm run test:browser:manaus` | PASS |
| `npm run test:browser:regression` | PASS; all five runners, including five U3 production cycles |
| `git diff --check` | PASS before final commit |
| GitHub Actions | Gate: exact final pushed documentation SHA; its run URL and result belong in the final delivery report |

Fidelity retained radius tolerance 8 m, depth tolerance max(4 m, 15%), and contour depth 0.25 m.
Measured maximum depth error was 0.213367 m and opening-radius error 7.248162 m. Existing crater
assertions were not weakened. Native browser validation is separate from Actions unit/build CI.

### Commit sequence

The permanent gate was committed before any U3 feature changes:

1. `8e27488` — permanent regression gate and archived U3 specification.
2. `8b59640` — travel plan/controller and logical transit.
3. `a25f0de` — production preparation and atomic materialization.
4. `4cc6b2f` — controls, HUD/map and bounded transit presentation.
5. `b3156a2` — cancellation and destination selection hardening.
6. `ebb2ce2` — production browser route validation and regression integration.
7. `6cb37fb` — arrival activation hardening preserves transit progress during resource rollback.
8. `5b03971` — checkpoint documentation after all local gates; its Actions run passed.
9. Final benchmark documentation includes the main leg's 98.5% extent; its pushed SHA is the final CI gate.

Manual acceptance remains the user's gameplay and visual check: actual Manaus takeoff, remote
P travel, Andromeda X cancellation/resume, rocky landing/takeoff, return to Sol and Earth/Manaus
through ordinary flight. Automation does not certify subjective visual quality or the entire manual
Earth return. Existing landing regressions use explicit near-body fixtures for their final descent;
the U3 production route runner does not use QA arrivals or injected observer poses.

BH0 debt: `BlackHoleDefinition.positionM` retains its existing ambiguous global/local naming.
U3 never uses it as travel authority; explicit galaxy-local BH coordinates belong to BH0. Resolver
global frame metadata now uses the neutral `local-group-global` label. Generated D1 remains
disabled; crater thresholds and destruction architecture were not changed.

STOP after U3 manual acceptance. Do not automatically begin U4 or BH work.
