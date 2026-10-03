# Target lock, autopilot and map integration

## NAV-LOCK-1 implementation contract — 2026-10-03

The user manually accepted C0 at `386c531a450ab6770b9da454267081f0501989b9` and explicitly
authorized this combined navigation checkpoint. This supersedes the previous C0 stop gate.
The sections below retain the original planning context; the implemented contract is described here.

### Audited baseline

`Game.navigationTarget` stored `NavigationTarget { bodyId, arrivalMarginM }`; `BodyNavigation`
resolved live position and velocity through `activeSystem.positionOf/stateOf`. The system already
indexed ephemerides in a Map, although body definitions were repeatedly found in arrays.
`CosmicCruiseController.update` accepted barycentric thrust/camera axes, Shift+W assistance,
manual brake/warp and all 19 live exclusion envelopes. It returned a continuous logical pose,
with `sweepSegmentSphere` motion clamping as the final authority. `CelestialContact` was diagnostic.
`TravelDomain` admitted local return only with terrain coverage, clearance <=7 km, inward speed
<=120 m/s and total relative speed <=8 km/s. `LandingCapture` supplied those shared limits.
`SolarSystem` supplied live hierarchical positions/velocities; `CelestialBodyProfile` supplied
landability and the sole arrival/exclusion margin policy. Presentation samples contained bounded
render-frame directions/distances, independently of proxy/globe ownership. Labels projected those
samples. The map's callback selected Game's target without teleporting; focus was presentation state.
HUD used cruise telemetry but lacked explicit lock/capture state. Input already reserved Tab;
R reconstructed matter, Escape opened/closed panels. The space camera already had free quaternion
mouse control. These contracts, CCD and manual thrust/brake remain the integration points.

### One identity and controls

`Game.navigation: NavigationTargetState` is the only lock authority. Its lock stores
`bodyId`, `source` (`reticle`, `map`, `hud`), `lockedAtS`, `mode` (`locked`; the type also allows
`selected`). `Game.navigationTarget` is a compatibility accessor derived from that identity and
the shared margin policy; it stores no second target. HUD, labels, map and flight resolve the
same ID. Invalid/nonfinite live positions clear the lock; closing/focusing a map, going offscreen
or changing LOD do not. Selecting a different target cancels the previous command without
changing velocity. Map feedback is a presentation copy of the ID confirmed by Game's callback.

- **Tab / Shift+Tab in space:** acquire/cycle forward/backward among candidates in a **15°** cone.
- **P in space:** engage/disengage autopilot. R retains reconstruction; selection alone never engages.
- **Backspace in space:** clear the target and cancel autopilot. X still brakes and disengages warp.
- Camera remains under mouse control; autopilot does not rotate it.

Acquisition uses finite live barycentric directions, front-facing alignment and presentable bounded
sample metadata, not mesh raycasts. A retired proxy with a physical globe stays lockable. A body
containing the observer is ineligible. Fully hidden angular discs are excluded; partial overlaps
remain cyclable. Score = angular offset / 15° - .08 × bounded apparent angular radius / 15°
+ .02 × bounded log10(distance metres) / 15. The pure scorer optionally accepts a .005 current-lock
bonus, but cycling uses the stable geometric order without that bonus so all overlapping candidates
remain reachable. Body ID breaks ties. No candidates clears the lock and displays “Nenhum alvo”.

HUD shows localized name, center distance, target-relative speed, signed closing speed, phase,
lock and command status, with ETA only for positive closing speed. Autopilot ETA uses its current
capture/approach radius. One DOM marker projects the bounded render direction using reusable
Vector3/Quaternion scratch; offscreen/behind targets receive an edge arrow. No astronomical
absolute position is sent to Three.js projection. Map/card use “TRAVADO”; focus and overview persist.
F3 exposes target source, distance, relative/closing speed, alignment, command phase, stopping
distance, arrival radius, effective speed cap and the existing CCD contact body/fraction.

### Continuous capture controller

The existing `CosmicCruiseController` owns an `AutopilotCapture` command state, with **no stored
target ID or position**. Phases: `idle → align → acceleration/cruise → braking → capture → approach
→ arrived` (revisited as motion requires). Live velocity planning is relative to target orbital
velocity, rather than the dominant body's velocity or barycentric zero.

The engagement engine capability is `a = max(100000, 4 × initial gap / 6²)` m/s², kept constant
through that command. The same `a` bounds each velocity change and computes **v²/(2a)** stopping
distance. Command speed = minimum of selected warp cap (500 million m/s when warp is off),
`sqrt(2 a gap × .35)` and `gap / 1.5`. This keeps 65% braking reserve and smooths the last metres;
high-speed incoming motion is decelerated with bounded acceleration, never directly rescaled to
the envelope. Large direction errors brake before reorienting; otherwise direction change is
bounded by 1 rad/s. Position changes only through integration and the existing CCD sweep.

First capture uses **body radius + `bodyArrivalPolicy().arrivalMarginM`**. Landable bodies then
approach using measured ellipsoid/relief clearance: wait at `returnAltitude + 1000` m while
coverage is missing, or aim at `.8 × returnAltitude` when ready. Approach speed is bounded by
the shared 2000 m/s approach tier and falls to 96 m/s near the 7000 m gate; the original radial,
total-speed and coverage gates still decide the real local ENU handoff. Handoff finishes the command
but preserves the lock. The descent thereafter uses the existing falling/local flight controller.
No ground contact is claimed at the moment of orbital capture.

Sun, gas/ice giants and the nine SOLAR-12 proxy moons retain the policy's standoff radius,
match target orbital velocity and stationkeep there. No local floor is installed. Cancellation,
lock loss and manual braking retain momentum; all 19 celestial sweeps still run after autopilot
planning. A deliberately impossible incoming velocity is covered by the CCD regression test.

Acquisition allocates only on key edges. Target-definition lookup now reuses a WeakMap index;
the arithmetic autopilot path uses scalars and mutates the controller's existing velocity buffer.
This does not claim the pre-existing complete game/renderer loop is allocation-free.

### Acceptance

Named lock/autopilot tests cover the supplied checkpoint matrix, plus full-disc occlusion,
three-candidate cycling, marker bounds, invalidation and waiting for actual terrain coverage.
The browser suite extends the existing Chromium smoke with real Tab/P, map locks, Moon/Mars
safe handoffs, Jupiter standoff and cancellation. Explicit far/near fixtures shorten the trips;
the production controller and Game.tick perform subsequent motion. Verification results and
manual acceptance remain recorded in [`../../docs/world/15-status.md`](../../docs/world/15-status.md).
Manual NAV-LOCK-1 acceptance is still required: Moon/Mars Tab/P arrivals, Jupiter/Titan map
standoff and mid-flight cancellation. **Stop after this checkpoint.**

## Goal

Provide one consistent way to choose a celestial destination and let the flight controller reach it safely.
The player should be able to:

- look at a body and press Tab to lock it
- cycle plausible bodies if several overlap in the view
- click/select a body in the universal map and obtain the same lock
- see the lock in the HUD
- engage assisted travel
- accelerate hard during the long middle portion
- automatically drop warp and brake near arrival
- stop in a stable orbit / approach envelope
- hand off to local landing only when the body is landable and the local solver is safe

## Existing authority to preserve

Use the current `NavigationTarget` identity model.
The target stores `bodyId`, not a frozen `positionM`.

Every frame:

`bodyId -> activeSystem.positionOf(bodyId)`

This prevents targeting where a moving planet used to be.

## Sprint C1 — camera-field target acquisition

### New pure service

Suggested file:

`src/world/travel/CelestialTargetAcquisition.ts`

Inputs:

- camera forward in system frame
- observer system position
- active system bodies and live positions
- current target
- viewport/FOV metadata if needed

Output:

- ranked candidate list
- selected body id
- angular separation
- apparent angular radius
- distance
- lock score components

### Ranking principles

Priority should be data-driven:

1. body intersects the center-reticle angular cone
2. selected / previously locked body gets mild hysteresis
3. larger apparent angular radius
4. smaller angular separation
5. nearer body only as a tie-breaker
6. label priority can break visual ambiguities

Do not simply choose the closest object in metres.
At interplanetary scale, the closest object may be far outside the player's view.

### Occlusion

A planet behind another planet should not win the reticle just because its center projects close to the crosshair.
For Solar System scale, sphere ordering along the view ray is sufficient as a first approximation.

Do not raycast rendered meshes at astronomical distance.
Use logical body positions and radii.

## Tab behavior

Recommended controls:

- `Tab`: lock best target under / nearest crosshair
- repeated `Tab` within a short timeout: cycle visible candidates
- `Shift+Tab`: cycle backwards
- `Escape` or dedicated key: clear lock if map/pause semantics allow
- clicking a body in map: directly lock that `bodyId`

Do not overload Tab with teleport.

## Lock state

Suggested state machine:

```text
NONE
  -> ACQUIRING
  -> LOCKED
  -> AUTOPILOT
  -> APPROACH
  -> CAPTURED
  -> LOCAL_HANDOFF (landable only)
```

A lock is identity only.
Autopilot is a separate boolean/state.

The player must be allowed to lock a target without surrendering manual flight.

## HUD presentation

The HUD target block should show:

- display name
- target class
- distance
- effective closing speed
- ETA
- relative speed
- lock state
- warp state
- arrival phase
- landable / non-landable
- optional parent body for moons

Reticle behavior:

- candidate: subtle bracket
- locked: persistent bracket / ring
- autopilot: stronger indicator
- braking: explicit BRAKING / REDUCING WARP
- captured: ORBIT / APPROACH / LANDING READY

Avoid large always-visible labels for every object.

## Sprint C2 — assisted arrival controller

### Purpose

A target lock must become a reliable trajectory controller.
The current `CosmicCruiseController` already has acceleration and braking-distance logic.
Extend it instead of creating `AutopilotFlightController2` with duplicate equations.

### Required phases

1. align
2. departure clearance
3. acceleration
4. high-speed cruise
5. warp dropout planning
6. braking
7. terminal approach
8. capture
9. optional local landing handoff

### Braking authority

The controller must know the same acceleration it can actually apply during braking.
Never accelerate with one order of magnitude and estimate stopping distance using a weaker brake.
The current controller already corrected an older form of this mistake; preserve that invariant.

### Warp dropout

Do not carry 256c to the target envelope and then zero it instantly.
Define data-driven staged ceilings.

Example conceptual policy:

```text
far zone: selected warp gear allowed
brake zone: progressively cap effective warp
terminal zone: no FTL
capture zone: body-relative sublocal speed
handoff zone: local solver speed only
```

The exact distances should derive from stopping distance, body size, and safety margin rather than fixed “1 million km for every planet”.

### Moving target prediction

At each update:

- resolve current target position
- resolve target velocity
- compute relative state
- optionally predict short intercept position during current braking horizon

Do not extrapolate centuries.
For the last seconds/minutes, a simple constant-velocity short prediction is enough.

## Stable capture targets

Different body classes need different terminal targets.

### Landable rocky body

Target a point above the physical surface along arrival direction.
Then hand off only when terrain readiness and speed gates pass.

### Non-landable giant

Target a safe standoff / high-atmosphere orbit envelope.
Do not aim at radius zero or a fake ground.

### Star

Target a safe stellar observation radius.
Autopilot should not deliberately fly into the photosphere unless the user explicitly disables safety / chooses impact mode.

### Moon

Same generic landable policy as rocky planets.
Do not create a Moon-only autopilot.

## Sprint C3 — universal map lock

The map already selects navigation identity without teleporting.
Change the user-facing semantic from “selection only” to “lock this target”.

Map click pipeline:

```text
canvas marker hit
-> bodyId
-> selectBodyDestination(activeSystem, bodyId)
-> Game.navigationTarget
-> HUD lock state
-> map highlight
```

No position snapshots.

### Map actions

For a selected object, expose actions such as:

- Lock target
- Engage autopilot
- Focus parent system
- View details
- Clear target

Do not start autopilot on single click unless UX testing proves that is desirable.
Safer default:

single click = lock/select
button / Enter = engage autopilot

## Target persistence across map views

Switching map hierarchy must not clear the target.
A target can remain locked while the map moves from:

Solar System -> Galaxy -> Local Group -> Universe

The target identity is independent from the current map camera.

## Target schema for future generated systems

The current `bodyId` is sufficient inside one system.
For procedural universe travel, later generalize identity to a hierarchical `NavigationAddress`.

Concept:

```ts
interface NavigationAddress {
  galaxyId: string;
  sector: SectorIndex;
  systemId?: string;
  bodyId?: string;
}
```

Do not prematurely replace the current Solar `NavigationTarget` until the universal-address runtime exists.
A compatibility adapter can wrap Solar targets later.

## Tests

- target under reticle wins
- body outside FOV does not win
- occluded body does not win
- repeated Tab cycles candidates
- locked target remains identity while ephemeris moves
- map click produces same `NavigationTarget`
- map lock does not teleport
- autopilot cannot hit its own locked target at high speed
- autopilot drops warp before capture
- landable target eventually reaches local-safe speed
- gas giant capture never invokes local terrain
- star capture stops outside stellar envelope
- clearing lock returns manual control
