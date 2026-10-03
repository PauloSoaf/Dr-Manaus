# Cosmic coordinates and observable-universe semantics

## Why another coordinate layer is required

Solar System barycentric Float64 metres are excellent inside a star system.
They are not a good universal absolute coordinate for tens of billions of light-years.

JavaScript Number provides finite precision; at enormous magnitudes, metre-level offsets cannot coexist with universe-scale absolute values.
The project already solved a similar problem locally with reference frames and floating origin.
The universe should extend that same principle hierarchically.

## Coordinate hierarchy

Recommended logical hierarchy:

```text
CosmologicalAddress
  cosmic sector: BigInt x/y/z
  local offset within cosmic sector: Float64

GalaxyAddress
  galaxyId
  galactic sector: BigInt x/y/z
  local offset: Float64

SystemAddress
  systemId
  system barycentric position: Float64 metres

Body frames
  body-fixed
  local ENU

Render frame
  camera-relative / render-local Float32-safe
```

Never collapse all levels into one `Vector3`.

## Sector sizes

Choose sector sizes so local offsets retain useful precision.

Possible conceptual scales:

- galactic star sector: 100 ly, consistent with current project direction
- cosmic sector: 1–10 Mpc depending on density/streaming design

Use exact integer sector indices plus bounded local offsets.

## Origin rebasing

A travel handoff changes which frame owns the local offset.
It does not move the universe.

At each hierarchy:

- logical address remains authoritative
- renderer remains near zero
- only nearby representations receive Float32 coordinates

## Known galaxies

Curated galaxy positions should be represented in the same cosmic-sector address format as generated galaxies.
Do not maintain a second global-metre authority solely for known objects.

## Observable universe radius

A useful game constant can represent the approximate present-day radius of the observable universe (~46.5 billion light-years in common cosmological descriptions).
Treat it as a visualization/navigation horizon around the observer/reference cosmology.

It is not evidence that the entire universe has that radius.
The actual universe may be much larger or potentially infinite.

## No center

Do not encode:

```text
UNIVERSE_CENTER = [0,0,0]
```

as a physical cosmological claim.

The coordinate origin is only a mathematical reference.
NASA's explanation of the Big Bang explicitly notes that the universe does not have a center and that expansion occurred everywhere rather than from a single point in existing space.

## Gameplay naming

Good labels:

- Cosmological Reference
- Observer Origin
- Local Group Reference
- Observable Horizon
- CMB Surface

Avoid:

- Real Center of Universe
- Physical Edge of Space

unless clearly described as fictional lore.

## Observable horizon destination

Map interaction can allow:

1. choose direction in universe map
2. select `Observable Horizon`
3. hypercruise toward a presentation target
4. progressively change large-scale LOD
5. enter CMB / early-universe visualization mode

The player should not hit an invisible collision wall.

## Cosmic time caveat

At cosmological distances, “seeing” a galaxy means seeing light from its past.
A game that lets the player physically fly there in seconds is already using fictional travel.
The first implementation can keep one simulation epoch and treat object states as game-present positions.

Document that simplification rather than mixing light-cone cosmology into normal gameplay prematurely.

## Large-scale map

Suggested hierarchy:

```text
Surface map
Planet system
Solar / star system
Galactic sector
Galaxy
Local Group / cluster
Large-scale universe
Observable horizon
```

Each level chooses a new projection and scale.
Do not draw a Moon orbit and an observable-universe horizon on one numeric scale.

## Tests

- converting between sector/local forms roundtrips
- negative BigInt sectors work
- moving across sector boundary preserves continuous local displacement
- render coordinates remain bounded
- Andromeda address stable
- procedural galaxy addresses deterministic
- horizon distance calculation finite
- no code interprets cosmological reference origin as physical center
