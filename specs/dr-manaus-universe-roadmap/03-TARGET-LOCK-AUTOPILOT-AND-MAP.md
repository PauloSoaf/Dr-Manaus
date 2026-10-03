# Target lock, autopilot and map integration

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
