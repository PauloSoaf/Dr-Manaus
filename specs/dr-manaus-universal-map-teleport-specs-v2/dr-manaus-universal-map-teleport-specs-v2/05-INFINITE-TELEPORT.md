# Infinite teleport

## Keep local precision path

The current 2.5 km raycast can remain as a local high-detail query.

Rename its meaning conceptually:

```text
LOCAL_AIM_RAYCAST_M
```

The correction is:

```text
local raycast miss != teleport failure
```

## Resolver order

```text
1. loaded local collider
2. active-body analytical surface
3. celestial angular target
4. armed map/coordinate target
```

## Analytical surface targeting

Earth:

```text
camera ray vs WGS84 ellipsoid
```

Moon:

```text
camera ray vs lunar ellipsoid/sphere
```

No need to stream the whole ray path.

## Celestial picking

Do not raycast astronomical meshes.

Use:

```text
logical body direction
apparent angular radius
screen-space reticle angle
```

from the celestial runtime.

## UniversalTeleportService

Local destinations may still delegate to the current `PowerSystem.teleportTo()` backend after its arbitrary legality checks are removed.

Remote destinations must not.

Remote flow:

```text
resolve
prepare target hierarchy
atomic handoff
safe arrival
arrival VFX
retire source
```

## Remove old gameplay caps

These cannot remain universal rules:

```text
2500 m
abs(x/z) <= 100000
```

They may remain only as local query/broadphase constraints.

## Supported target rollout

Verify in this order:

```text
1 Manaus local
2 arbitrary Earth geodetic
3 Moon surface/orbit
4 Mars safe orbit
5 arbitrary Solar-system position
6 remote Milky-Way sector
7 another generated system
8 Andromeda after GalaxyProvider hardening
9 cosmological targets after LSS hardening
```

## Same service

All use the same service:

```text
E
Map -> TRANSLOCATE
Coordinate form
Landmark travel
```

Discovery gating may remain for landmark fast travel.

Coordinates do not require discovery.

## Black-hole policy

No generic "safe landing".

Default:

```text
safe observation distance
```

Inside event horizon requires explicit dangerous/fantasy rule.
