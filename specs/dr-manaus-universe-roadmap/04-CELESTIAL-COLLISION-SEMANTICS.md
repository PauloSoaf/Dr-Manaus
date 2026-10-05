# Celestial collision semantics

## Principle

“Every planet is collidable” must be defined by body class.
A collision is a logical event in the body's physical domain, not necessarily contact with a triangle mesh.

## 1. Rocky planets and rocky/icy moons

Examples:

- Earth
- Moon
- Mars
- Mercury
- Venus
- future rocky exoplanets

Broad phase:

- conservative body ellipsoid / sphere envelope in system coordinates

Narrow / terminal phase:

- body-fixed surface direction
- actual terrain height when provider exists
- local ENU terrain sweep after handoff
- later volume SDF/mesh collision when caves and cuts exist

Possible outcomes:

- assisted capture
- ground contact
- low-speed crash
- high-speed impact
- catastrophic impact
- entry into an existing carved tunnel, only when volume collision says empty

## 2. Gas giants

Examples:

- Jupiter
- Saturn

They do not have a conventional solid surface for character walking.
Do not treat the visible cloud radius as a stone wall.

Recommended collision layers:

1. outer atmosphere interaction radius
2. deep-atmosphere hazard radius
3. core-proxy catastrophic radius, only as a gameplay abstraction

First implementation can use one or two concentric logical envelopes.

Suggested outcomes:

- autopilot capture outside atmosphere
- free flight enters atmosphere -> heating / drag / visibility effects later
- sufficiently deep / high-energy collision -> catastrophic player event or body-impact event

No `PlanetTerrainProvider` handoff.

## 3. Ice giants

Examples:

- Uranus
- Neptune

Same general model as gas giants, with different visual/hazard parameters.
No fake walkable cloud floor.

## 4. Stars

Example:

- Sun
- generated stars

Collision layers should be stellar, not rocky:

1. safe navigation exclusion / observation radius
2. corona interaction radius
3. photosphere radius
4. destructive deep-star domain

Autopilot should stop at safe observation radius by default.
Manual/unlocked impact may cross safety envelopes and trigger heat/destruction logic.

Do not make `canLand=true` for stars.

## 5. Black holes

Black holes should not use a generic sphere bounce.

Future collision semantics:

- outer navigation warning / capture radius
- photon-sphere presentation region
- event-horizon crossing
- no normal “bounce off surface”

The existing Sgr A* provider should eventually use a separate `BlackHoleEncounterController`.

## 6. Moons not yet landable

SOLAR-12 added multiple solid moons as lightweight proxies without terrain providers.
They still need high-speed collision envelopes now.

That means:

- cannot be crossed numerically
- can be targeted
- can be orbited / approached
- do not hand off to local walking until a real surface provider is implemented

## 7. Collision authority hierarchy

Use the most detailed available authority:

```text
interplanetary high speed
  -> analytic celestial envelope

near landable intact body
  -> physical surface radius / terrain provider

near edited volumetric region
  -> volume collider (future Phase 6)

inside carved empty region
  -> no intact-surface collision where volume field says empty
```

Avoid simultaneously colliding against an intact heightfield and a carved cave ceiling in the same region.
Phase 5/6 must define exclusive coverage ownership.

## 8. Collision response modes

C4 implementation separates `ContactResponseMode` (existing inelastic graze/capture) from
`CelestialImpactClassification` (SAFE_CAPTURE/GRAZE/MINOR/MAJOR/CATASTROPHIC). The modes
below remain future semantic suggestions, not implemented physical consequences.
See [canonical C4 status](../../docs/world/17-status-CELESTIAL-IMPACT-POLICY.md).

Define response separately from detection.

Suggested enum:

```text
ASSISTED_CAPTURE
SAFE_STOP
LOW_SPEED_IMPACT
HIGH_SPEED_IMPACT
CATASTROPHIC_IMPACT
ATMOSPHERIC_ENTRY
STELLAR_ENTRY
EVENT_HORIZON_CROSSING
```

The detector reports contact; the policy decides outcome.

## 9. Relative speed

Always classify impact using velocity relative to the contacted body.

Do not use absolute barycentric velocity.
Earth's orbital velocity around the Sun must not make a stationary Earth landing look like a 30 km/s impact.

For moon impacts, subtract the moon's live barycentric velocity.

## 10. Impact direction

Track:

- radial inward speed
- tangential speed
- total relative speed
- body surface normal

This allows:

- glancing pass
- grazing atmosphere
- direct impact
- orbital insertion
- skimming terrain

to behave differently.

## 11. Collision radius vs visible proxy radius

Never use presentation-size floors for collision.

A distant 2.5 px proxy may be visually enlarged for legibility.
Its collision radius remains the real logical body radius / collision envelope.

## 12. Stars and giant planets remain visible

Visibility and collision must be independent.
A body can be represented by an angular proxy while its logical collision envelope remains at real coordinates.

## 13. Generated bodies

Procedural bodies must create collision metadata from deterministic physical parameters, not from rendered mesh bounds.
The system generator should emit:

- body radius
- mass
- body class
- atmosphere profile
- landability
- collision kind
- destruction capability

before any visual mesh is created.

## 14. Tests

For every body class:

- finite collision envelope
- correct live center
- segment crossing caught
- tangent segment not falsely caught
- starting outside and moving away no hit
- starting inside handled deterministically
- assisted target uses safe response
- unlocked target can emit impact response
- presentation scaling never changes logical collision radius
