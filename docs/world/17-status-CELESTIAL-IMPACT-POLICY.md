# C4 — Celestial impact policy

2026-10-05. Initial HEAD: `9083c8e53936ed71a45b7a6da75acc3d2965ff2d`,
branch `feat/universe-map`. The latest user attachment accepts PLANET-FLIGHT-LANDING-1.1
for progression and authorizes C4 only, with documentation, commits and push.

## Authorities and movement

The audited incoming pipeline was Game input → CosmicCruiseController → earliest analytic
moving-body sphere sweep → CelestialContact → inelastic PlanetaryLanding response →
TravelDomain readiness/speed gate → local ENU terrain CCD. It had no impact classifier or
event consumer. `lastCelestialContact` retained an old contact between updates.

C4 adds the following boundary without replacing the movement authorities:

```text
CosmicCruiseController / sweepSegmentSphere
  → CelestialContact (pre-response velocities, hit position, outward normal, envelope)
  → Game collects same-frame command context and fixed-frame position
  → CelestialImpactService → pure classifyCelestialImpact
  → transient CelestialImpactEvent queue
  → Game drains once per simulation step → lastCelestialImpact → existing HUD F3
  → future destruction consumer, NOT implemented or authorized here
```

CosmicFlight clears raw contact each update and captures vectors before
`resolveCelestialContact` mutates them. There is no severity rule or destruction callback
inside CCD. The existing response removes inward motion, caps tangential motion and carries
the arrested player with the moving body. SAFE_CAPTURE and CATASTROPHIC_IMPACT both preserve
that clamp. Detection uses logical radius/relief/exclusion margin; presentation floors,
glow, haze, ring bounds and labels have no influence.

## Policy and safety

`CelestialImpactPolicy.ts` uses scalar math and plain tuples, with no renderer, Game, world
mutation, Three dependency or relativistic energy calculation. The exact c constant moved
to renderer-independent `TravelConstants.ts`; CosmicFlight re-exports its existing API.

| Config | Value / rule |
| --- | --- |
| Minor | ≥120 m/s, the normal local flight / handoff tier |
| Major | ≥8,000 m/s, the maximum certified local terrain sweep tier |
| Catastrophic | ≥299,792,458 m/s (1c), with sufficiently direct inward motion |
| Direct minimum inward radial fraction | ≥0.5 |
| Graze maximum inward radial fraction | ≤0.1, checked before severity thresholds |

These are **fictional gameplay thresholds**, not realistic relativity, energy, crater size
or a claim that destruction has happened. Configuration is centralized in
`CELESTIAL_IMPACT_POLICY`. Classification values are `SAFE_CAPTURE`, `GRAZE`, `MINOR_IMPACT`,
`MAJOR_IMPACT`, `CATASTROPHIC_IMPACT`; they are separate from `ContactResponseMode`.

Velocity authority is **player barycentric velocity minus the contacted body's barycentric
velocity**, both measured at the swept contact before response. The dominant body and
selected target cannot substitute their velocity for the hit body's. With outward unit
normal n, signed radial speed is dot(vRel,n), inward speed is max(0,−radial), tangent is
vRel−n·radial, and radial fraction is inward/|vRel| (zero at rest). Incidence angle is
acos(radialFraction), zero direct and π/2 tangent/separating. A 1c nearly tangent contact is
GRAZE; one above the graze fraction but below the direct threshold is MAJOR_IMPACT.

Safety order:

1. A landing intent for the **same contacted body** → SAFE_CAPTURE, regardless of speed.
2. Same-body lock **and active autopilot** → SAFE_CAPTURE, regardless of speed.
3. Lock alone/manual flight → ordinary severity, including catastrophic at direct ≥1c.

Game snapshots ownership before the controller can transition to arrived/cancelled. X
disengages autopilot safety in that same input step. Assistance aimed at another body
does not protect the contacted body. F preserves existing warp cancellation, body-relative
capture/hold, critical prefetch and terrain handoff. No second navigation authority exists.

## Serializable event

Every event and vector is cloned and frozen at emission. Only plain Float64 numbers,
strings, booleans and tuples are retained; JSON round-trip is tested.

| Fields | Meaning |
| --- | --- |
| `eventId`, `bodyId`, `bodyClass` | Monotonic run ID, contacted identity and authoritative profile class |
| `contactSystemPositionM` | Actual swept system-space hit, never a rendered mesh coordinate |
| `contactBodyFixedM?` | Present for a solid body with a registered canonical fixed frame |
| `impactNormalSystem`, `relativeVelocityMps` | Outward normal and pre-response body-relative velocity |
| `relativeSpeedMps`, `inwardRadialSpeedMps`, `tangentialSpeedMps` | Nonnegative decomposition |
| `radialFraction`, `incidenceAngleRad` | Direct/graze geometry |
| `lockedTarget`, `autopilotActive`, `landingIntentActive` | Command context at contact |
| `warpStep`, `effectiveC` | Selected gear index and actual relative speed divided by c |
| `classification`, `simulationTimeS` | Policy result and logical substep contact time |

The moving sphere solver linearly advances a body centre during the step while its
orientation comes from the frame snapshot. Game subtracts body velocity × elapsed-to-hit
from the hit before `ReferenceFrameGraph.convertPosition` into the canonical fixed frame.
This keeps the fixed location on the correct body-relative envelope and preserves the
solver's orientation snapshot; intra-step spin and ephemeris acceleration are not integrated.
Gas/ice giants and stars do not receive a solid body-fixed contact or terrain provider.

## Episode lifetime and consumer boundary

`CelestialImpactService` owns a map from body ID to contacted envelope radius, rather than
a history of impacts. In the current Solar System it has at most 19 active entries. `emit`
returns/enqueues only the first contact of an episode. `peek` returns a queue snapshot;
`drain` consumes it; `clear` removes pending events and episodes on an explicit world reset.
The monotonically increasing sequence is not reset, so IDs `impact-N-body` remain unique
within a Game run. A future single consumer can dispatch drained events to diagnostics
and destruction, using the ID to prevent downstream double-processing.

Physical release is checked **at the start of a flight step**, before a re-entry might be
clamped back onto the boundary. Release requires distance greater than:

```text
max(contactedRadius, currentBroadEnvelopeRadius)
  + max(10 metres, radius × 0.000001)
```

Equality and shell jitter remain latched. Switching to measured terminal relief cannot
manufacture a crossing. Separation itself emits nothing; a later CCD re-entry gets a new
ID. Missing bodies remove stale episode entries. There is no time cooldown. Game drains
every space step (at most one new event per step), retains only the latest diagnostic
and does not persist impacts. Local physics does not emit these celestial events; its
terrain sweep remains authoritative. A later departure observes physical separation when
space flight resumes. Explicit landmark travel clears episodes/last impact.

## All 19 current bodies

All share relative motion, direct/graze thresholds, same-body safety, one event per episode
and the unchanged analytic clamp. Capability comes from `CelestialBodyProfile`, not ID
branches in the policy. No profile, mass, GM, radius, ephemeris or integrity is mutated.

| Body | Profile class | C4 boundary / consequence |
| --- | --- | --- |
| Sun | star | Existing observation/exclusion sphere, event only; no rocky volume |
| Mercury | rocky | Solid logical relief envelope, event only |
| Venus | rocky | Solid logical relief envelope, event only |
| Earth | rocky | Solid logical relief envelope; existing safe terrain handoff retained |
| Moon | rocky-moon | Solid relief envelope; existing F/P capture and terrain handoff retained |
| Mars | rocky | Solid relief envelope; existing F/P capture and terrain handoff retained |
| Jupiter | gas-giant | Existing logical exclusion sphere, event only; no ground/volume |
| Saturn | gas-giant | Existing logical exclusion sphere, event only; no ground/volume |
| Uranus | ice-giant | Existing logical exclusion sphere, event only; no ground/volume |
| Neptune | ice-giant | Existing logical exclusion sphere, event only; no ground/volume |
| Io | volcanic-moon | Solid proxy envelope; no new terrain/handoff/volume |
| Europa | icy-moon | Solid proxy envelope; no new terrain/handoff/volume |
| Ganymede | icy-moon | Solid proxy envelope; no new terrain/handoff/volume |
| Callisto | icy-moon | Solid proxy envelope; no new terrain/handoff/volume |
| Titan | atmospheric-moon | Solid proxy envelope; haze excluded from physics |
| Enceladus | icy-moon | Solid proxy envelope; no new terrain/handoff/volume |
| Titania | icy-moon | Solid proxy envelope; no new terrain/handoff/volume |
| Oberon | icy-moon | Solid proxy envelope; no new terrain/handoff/volume |
| Triton | icy-moon | Solid proxy envelope; no new terrain/handoff/volume |

The existing giant/star envelope is an event boundary and temporary movement protection,
not a simulated stone surface, atmosphere or stellar hazard model. Solid moons without
providers are classified even though local walking and volume destruction are unsupported.

## Validation evidence

Changed files:

- Travel: `TravelConstants.ts`, `CelestialContact.ts`, `CosmicFlight.ts`,
  `CelestialImpactEvent.ts`, `CelestialImpactPolicy.ts`, `CelestialImpactService.ts`.
- Integration/debug: `src/game/Game.ts`; existing HUD renders its F3 records unchanged.
- Tests: `tests/celestial-impact-policy.test.ts`, `tests/celestial-impact-events.test.ts`,
  `tests/helpers/celestial-impact.ts`, `scripts/space-hardening-browser.mjs`.
- Documentation: this status, `docs/world/15-status.md`, `specs/Promptatual.md`, roadmap
  `04-CELESTIAL-COLLISION-SEMANTICS.md` and `05-CATASTROPHIC-IMPACT-AND-DESTRUCTION.md`.

37 new tests in `celestial-impact-policy.test.ts` and `celestial-impact-events.test.ts`, with
one shared fixture in `tests/helpers/celestial-impact.ts`. All 34 mandatory `T_IMPACT_*`
names are present. Additional tests cover configurable monotonic severity, same-frame X
safety cancellation and Game landing-intent priority. Tests exercise real Game/CCD/frames,
JSON serialization, pre-response vectors, orbital-speed subtraction, 1c/256c, frame rates,
release hysteresis, stale-contact clearing, all 19 profiles and unchanged volume/catalog.

| Check | Result on implementation tree |
| --- | --- |
| Typecheck | PASS |
| Focused impact, flight, CCD, landing, navigation, autopilot, Solar-12, Moon/Mars, streaming | 286/286 PASS |
| Full tests | 777/777 PASS |
| Production build | PASS; existing bundle-size warning |
| Space browser | PASS, five C4 cases plus existing Moon/Mars/control/navigation flows; zero errors |
| Local browser | PASS, city/local controls/departure/orbit/reentry; zero errors |
| Diff check | PASS |
| GitHub Actions | Pending push and check-runs inspection |

The space smoke retains the full real-input Moon F hold → actual critical tiles → Falling
→ terrain CCD → Grounded → walk/jump/takeoff, and shortened Mars flow. Added deterministic
production-step fixtures use real P/F input edges, a captured production envelope list and
actual analytic contacts: Moon SAFE_CAPTURE with P and F at 256c, and unlocked Earth,
Jupiter and Sun ≥1c catastrophic exactly once. They verify entry-side clamp, unchanged
catalog/provider count/volume metrics and the real F3 DOM. Fixture steps are explicit
automated checks, not a claim of human flight validation.

The incoming P and F fixtures start at 256c. Contact telemetry records the actual velocity
after the flight controller's braking/cap and before the contact response: P contacts at
256c; F cancels Warp and contacts at about 1.668c (500,000,000 m/s). Both classify safe.
The three manual fixtures contact at 1.001c. Each emits exactly once, with unchanged
volume metrics and intact catalog, and the actual F3 DOM displays the classification.

## Manual gate and limits

**REQUIRES USER MANUAL VALIDATION.** Verify normal Moon P arrival; normal Moon F landing;
unlocked/manual ≥1c direct Moon/Earth contact stopped by CCD with CATASTROPHIC_IMPACT in
F3 and body still intact; a high-speed graze with different classification; Jupiter and
Sun impacts classified without rocky terrain, volume chunks or disappearing bodies.

C4 emits facts only: no PlanetVolumeEdit, remesh, collider refresh, body integrity overlay,
destruction, fracture, debris, explosion VFX, new physics dependency or persistence. The
temporary tangential cap remains. Browser fixtures do not replace manual perception tests.
Existing Earth local-region limitations remain outside C4.

STOP after C4. **No next sprint is authorized by this checkpoint.** D1/local impact edits
are a future roadmap stage, requiring its own request after this manual gate; do not begin
C5 or D0–D5 automatically.
