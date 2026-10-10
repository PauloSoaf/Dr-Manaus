# Destination preparation and handoff

## Precondition

Fix P0-01 through P0-06 before remote teleport.

## Destination preparers

### Manaus
Use `WorldStreamer.prepare()` plus real-city readiness.

### Earth elsewhere
Prepare Earth surface tile, elevation, local surface frame and collision.

### Moon
Use `MoonProvider` after scheduler/body-context fixes.

### Solar-system orbit/space
Prepare body metadata/reference frame. No terrain required.

### Remote star sector
Prepare target address, star-sector demand and optional system runtime.

### Other galaxy
Only after galaxy model/render placement is deterministic and relative.

## Scheduler support

Add an explicit destination-critical API or equivalent:

```ts
prepareDemands(demands, signal)
```

Teleport target demands should be:

```text
gameplayCritical = true
```

Do not simulate the route.

## Atomic handoff

One transaction updates:

```text
UniverseRuntime.address
navigationState
activeSystem
activeBody
playerPose.frame
logical position
TravelDomain
floating origin
provider focus
local PlayerController representation
```

Failure before commit leaves source state untouched.

## Earth outside Manaus

Do not always hand Earth to `MANAUS_FRAME_ID`.

For arbitrary Earth coordinates create a local arrival ENU/surface frame at target geodetic position.

Use Manaus legacy frame only when target lies in the compiled Manaus region.

## Current body position

Before arrival calculations:

- update ephemeris;
- ensure reference frames reflect the current body state.

## Safe arrival

Surface:
terrain + clearance.

Orbit:
body center + direction * (radius + altitude).

Empty space:
zero-g.

Black hole:
safe observation radius by default.

## Cancellation

New teleport aborts previous preparation.

Invalidated old work must not activate after the new target commits.
