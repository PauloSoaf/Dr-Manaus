# Catastrophic impact and celestial destruction architecture

## Product requirement

If the player is not using target-lock safety and collides with a celestial body at approximately light speed or greater,
the game may treat the event as a catastrophic impact capable of destroying or radically altering the body.

This is a stylized gameplay rule, not a physically accurate relativity simulator.
FTL kinetic energy is not treated as real-world physics.

## Why impact destruction must be staged

The current game can detect a high-speed logical crossing before rendering every detail.
That contact event should drive destruction.
The renderer should not decide whether a planet was hit.

Pipeline:

```text
logical sweep
-> earliest celestial contact
-> impact policy
-> impact event
-> destruction service
-> body mutation / volume edit
-> streaming invalidation
-> remesh
-> collider refresh
-> visual effects
-> persistence
```

## Sprint C4 — impact event model

Implemented C4 contract (2026-10-05):
[`17-status-CELESTIAL-IMPACT-POLICY.md`](../../docs/world/17-status-CELESTIAL-IMPACT-POLICY.md).
This supersedes the suggested C4 fields/tiers below: events include inward radial speed,
tangential speed, radial fraction, incidence angle, landing intent, unique ID and contact time.
Policy is pure; Game supplies context and drains CelestialImpactService once per step.
Minor ≥120 m/s, major ≥8000 m/s, catastrophic ≥1c with inward fraction ≥0.5; graze fraction
≤0.1 wins before severity. Same-body F or lock+active autopilot is SAFE_CAPTURE; lock alone
does not protect. Release is geometric with max(10 m, radius×1e-6) hysteresis. Detection,
temporary inelastic response and classification remain separate. Events do not execute
any destruction stage described later in this roadmap. Stop after C4/manual gate.

Introduce a pure `CelestialImpactEvent`.

Suggested fields:

```ts
interface CelestialImpactEvent {
  bodyId: string;
  bodyClass: string;
  contactSystemPositionM: Vec3;
  contactBodyFixedM?: Vec3;
  relativeVelocityMps: Vec3;
  relativeSpeedMps: number;
  radialSpeedMps: number;
  impactNormalSystem: Vec3;
  lockedTarget: boolean;
  autopilotActive: boolean;
  warpStep: number;
  effectiveC: number;
}
```

Do not pass Three.js objects into the destruction domain.

## Impact classification

Suggested policy tiers, configurable and tested:

```text
safe capture
minor impact
major local impact
planet-scale impact
catastrophic body disruption
```

Do not hardcode only `speed >= c` in `Game.ts`.
Use a policy function that can inspect:

- body radius
- body class
- relative speed
- radial speed
- player cosmic power state
- gameplay difficulty / mode if added later

The user's explicit design request can still map `>= 1c` unlocked direct impact to catastrophic for normal planets.

## Locked-target safety

If a body is currently locked and autopilot is active:

- catastrophic impact is disabled by default
- braking / motion clamping wins
- a failure to brake is a bug, not intended destruction

If the player explicitly disengages safety shortly before impact, free-flight policy may apply.

## Rocky-body local impact

Before whole-planet breakup exists, a sub-catastrophic impact should map naturally into the volume system.

Possible edit:

- `subtract-sphere` for compact blast cavity
- `subtract-capsule` for penetrating beam / impact channel
- future additional constructive/displacement fields for ejecta rims

Authoritative state remains CSG edits, not the temporary mesh.

## Crater scaling

Do not derive crater radius linearly from speed.
A direct linear mapping would explode memory and visual scale at relativistic values.
Use a gameplay curve with explicit caps per destruction stage.

Example conceptual transform:

```text
impact severity = log-scaled function of effective speed and body size
local crater radius = bounded severity curve
planet-scale disruption = separate state transition
```

## Planet-scale destruction cannot remain one intact CelestialBody

A truly destroyed planet needs a new body state.

Suggested body integrity states:

```text
INTACT
SCARRED
FRACTURED
DISRUPTING
DEBRIS_FIELD
DESTROYED
```

The current `CelestialBody` catalog is static physical definition.
Do not mutate the catalog constants directly.
Add runtime body-state overlay keyed by bodyId.

## Runtime body-state overlay

Suggested service:

`CelestialBodyStateStore`

Fields may include:

- integrity01
- destructionState
- accumulatedImpactSeverity
- dominant fracture axis
- fragment seed
- atmosphereRetention01
- visualEmission
- collisionMode
- navigationEnabled

The immutable catalog remains source data.

## Fracture representation

Do not voxelize Earth into trillions of cells to split it.
Planet-scale fracture can be represented hierarchically.

Possible sequence:

1. local volume damage at impact site
2. macro fracture planes / SDF operations
3. a small number of procedural rigid fragments
4. remaining body represented as coarse fractured shell
5. debris field represented statistically / instanced
6. only nearby fragment surfaces become detailed

## Destruction of a gas giant

Do not run rocky Marching Cubes through Jupiter.

A giant-planet catastrophic state needs a different model:

- atmospheric shock / luminous impact
- density-shell disruption approximation
- expanding cloud / ring debris
- runtime state mutation
- optional core proxy

No rocky cave chunks.

## Destruction of a star

A star cannot be treated as a stone sphere.

Gameplay options for a catastrophic player collision:

- huge flare
- photosphere disturbance
- mass-loss shell
- temporary luminosity spike
- stylized nova/supernova-like event only if the game explicitly permits it
- conversion to remnant state under fictional power rules

Separate service:

`StellarDestructionModel`

Do not reuse `PlanetVolumeField`.

## Explosion visuals

Visual effect layers can include:

- impact flash
- radial shock front
- ejecta plume
- volumetric dust/smoke proxy
- chunk/debris instancing
- exposure / bloom
- screen-space shock distortion
- local lighting flash
- sound only where game design intentionally uses nonphysical cinematic audio

Performance rule:

The explosion is presentation of authoritative state.
It must not become the destruction authority.

## Debris

Planetary debris must be hierarchical.

Near:

- finite rigid fragments
- collision only for nearby significant pieces

Mid:

- instanced fragments

Far:

- point / ring / cloud proxy

Do not create 100,000 physics rigid bodies.

## Navigation after destruction

A destroyed body may remain a navigation identity but change target type.

Examples:

- `Earth Debris Field`
- `Former Mars barycentre`
- `Solar Remnant`

Map and HUD should show state.

## Persistence

Catastrophic body state must save:

- body id
- integrity state
- deterministic fracture seed
- volume edits if applicable
- macro fragment descriptors
- event timestamp / simulation epoch if needed

Do not save generated triangle buffers.

## Test requirements

- locked 1c approach cannot catastrophically impact
- unlocked direct >= configured catastrophic threshold emits catastrophic event
- grazing high-speed contact classification is distinct from direct radial hit
- body-relative speed used, not barycentric speed
- one catastrophic event emitted per crossing
- impact event stable across 30/60/120 FPS
- rocky impact invalidates only affected volume regions initially
- catalog constants remain immutable
- destroyed state persists independently from generated mesh caches
- giant/star destruction does not instantiate rocky volume chunks
