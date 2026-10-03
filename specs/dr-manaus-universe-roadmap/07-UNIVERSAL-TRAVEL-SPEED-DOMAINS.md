# Universal travel and speed domains

## Problem

The current 1c–256c warp range is reasonable for Solar System gameplay but far too slow for galactic and intergalactic exploration.
For example, Andromeda is millions of light-years away, so even 256c remains thousands of in-game years if simulated literally.

The solution should not be an endless array of `512c, 1024c, ...` inside the same Solar controller.
Different scales need different travel domains.

## Proposed travel hierarchy

### Domain 0 — local

Scale:

- city
- surface
- atmosphere

State:

- render-local / local ENU
- character physics
- terrain collision

### Domain 1 — planetary / interplanetary

Scale:

- moons
- planets
- Solar System

Current authority:

- `solar-system/barycentric`
- `CosmicCruiseController`
- 1c–256c warp

Keep this.

### Domain 2 — stellar / interstellar

Scale:

- nearby stars
- star sectors
- Milky Way navigation

Logical address:

- galaxy id
- BigInt galactic sector
- system id
- local offset within sector

The player should not carry a Solar barycentric metre vector across tens of thousands of light-years.

### Domain 3 — galactic / intergalactic

Scale:

- Local Group
- Andromeda
- distant generated galaxies

Logical address:

- cosmic sector / galaxy address
- galaxy-local transform

Travel becomes target-relative hypercruise between galaxy anchors.

### Domain 4 — cosmological

Scale:

- galaxy clusters
- superclusters
- large-scale structure
- observable horizon visualization

This is a presentation/navigation domain, not a normal rigid-body physics domain.

## Effective-c telemetry

For very large distances, show an “effective c” number if desired, but label it as game warp / effective translation rate.
Do not imply physical special-relativistic travel.

## Target-duration model

For galaxy travel, a better gameplay rule is:

```text
arrival time bounded by gameplay target duration
while logical start/end coordinates remain true scale
```

For example:

- nearby star: 5–12 s
- across Milky Way: 10–25 s
- Andromeda: 15–30 s
- far observable-universe target: 20–45 s

The exact speed is derived from remaining logical distance and desired travel duration.

## Continuous travel, not teleport

Even when the effective velocity is enormous:

- HUD distance must decrease continuously
- target direction must remain stable
- intermediate LODs can transition
- star field should streak / compress appropriately
- arrival should be predicted and braked
- map should track progress

Logical position can be interpolated in hierarchical coordinates without ever expressing the whole trip as one unsafe Float32 renderer position.

## Hypercruise easing

Recommended phases:

1. spool
2. acceleration
3. cruise plateau
4. deceleration
5. domain handoff

Use smooth bounded curves so there is no instantaneous position discontinuity.

## Collision during super-galactic travel

Do not sweep every planet between the Milky Way and Andromeda.
At high universe domains, collision authority changes with hierarchy.

Intergalactic domain collides only with macro encounter regions relevant to route:

- target galaxy capture region
- explicitly loaded/intercepted galaxy/cluster hazards

When entering a galaxy:

- hand off to galactic sector domain
- then star-system collision becomes active

This is analogous to Minecraft chunks: unloaded detail does not become collision authority until the correct domain is active.

## Lock is mandatory for extreme travel assistance

Recommended UX:

- free manual 1c–256c available in Solar domain
- stellar/galactic hypercruise requires a locked destination or explicit route

Reason:

Without a hierarchical target, a 10^12c manual free-flight vector would traverse huge address ranges with no meaningful gameplay context.

## Emergency cancel

`X` currently serves as strong brake / warp cancel.
Preserve an immediate cancel contract across all travel domains.

For higher domains:

- cancel hypercruise
- transition to safe coasting state in current hierarchy
- do not snap back to origin

## Arrival handoff

Example Andromeda trip:

```text
Milky Way local sector
-> GalacticExitDomain
-> IntergalacticHypercruise
-> Andromeda macro capture
-> Andromeda galaxy sector
-> generated star-system selection
-> system barycentric
```

Each handoff converts orientation and velocity semantics intentionally.

## Edge of observable universe

Treat as a navigation visualization target:

`Observable Horizon in selected direction`

not a physical wall.

Arrival behavior can become:

- horizon visualization mode
- CMB / early-universe presentation
- no collision bounce

The actual universe beyond the observable horizon is unknown/unobservable from the current observer, so the game should not call the horizon the literal edge of all space.

## No unique center

Do not expose `Center of Universe` as a scientific location.
Possible game labels:

- `Cosmological Reference Origin`
- `Observer Origin`
- `Local Group Origin`
- `Universe Map Origin`

If the game wants a fictional “center” mission, label it fictional explicitly.

## Tests

- Solar warp remains unchanged
- galactic travel does not overflow render coordinates
- effective-c telemetry finite
- route progress monotonic
- cancel leaves valid hierarchical address
- galaxy handoff preserves target identity
- no Solar planet collision queries while intergalactic
- target galaxy becomes active before arrival
- arrival never teleports to stale generated position
