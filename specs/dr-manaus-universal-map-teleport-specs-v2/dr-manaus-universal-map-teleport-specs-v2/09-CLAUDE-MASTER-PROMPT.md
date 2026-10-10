# Claude master prompt - Universal Map + Infinite Teleport v2

Work on:

```text
PauloSoaf/Dr-Manaus
branch: feat/universe-map
audited HEAD: 40758f1ec22676c6ede429457aa7a24a93d37430
```

Do not merge to main.

This supersedes the previous universal-map prompt.

Do not recreate systems that now exist.

Current code already has:

```text
InterplanetaryController
TravelDomain
EarthTransitionController
SurfaceFrameService
MoonProvider
GalaxyProvider
BlackHoleProvider
LargeScaleStructureProvider
ManausSubsystem
StarSectorProvider
UniverseAddress
CosmologicalAddress
```

Some are prototypes with incorrect contracts. Fix before using them as map/teleport truth.

## Phase A - mandatory hardening

1. Fix interplanetary transition speed authority. Use logical travel velocity, not zeroed local PlayerController velocity.
2. Initialize interplanetary barycentric state from the actual current pose.
3. Make body envelope relative to body centre.
4. Make scheduler advance during `updateSystemPose`.
5. Remove hardcoded Earth body/altitude from `SpatialContext`.
6. Create canonical `UniverseRuntime.navigationState`.
7. Make `UniverseAddress` authoritative and include it in SpatialContext.
8. Remove absolute BigInt -> Number placement from StarSectorProvider.
9. Make GalaxyProvider deterministic.
10. Make GalaxyProvider/LSS/BlackHole either real providers or stop registering them as WorldProvider.
11. Remove raw galactic metres from BlackHoleProvider Three.js transforms.
12. Do not call black holes functional until GravitySource/event horizon/lensing exist.
13. Drive LSS by navigation domain/address, not Earth altitude.
14. Resolve mixed Manaus frames before surface coordinate teleport depends on them.
15. Keep moving celestial reference frames synchronized with ephemeris.

Add tests for every item.

Only after Phase A is green continue.

## Phase B - universal map

Keep `M`.

Evolve existing map into:

```text
Universe
-> group
-> galaxy
-> sector
-> system
-> body
-> surface
-> city
```

Use `UniverseRuntime.navigationState` as sole current-location source.

Add:

```text
breadcrumb
where-am-I card
search
coordinate modes
destination card
distance
precision/status
TRANSLOCATE
```

Do not show placeholder coordinates as measured astronomy.

## Phase C - coordinates

Reuse `UniverseAddress`.

Add logical location/target DTOs around it.

No Three.js Vector3 in navigation DTOs.

Modes:

```text
Geographic
System
Galactic
Catalog
Cosmology advanced
```

Use versioned serializer:

```text
drm:v1://...
```

BigInt roundtrip exact.

## Phase D - E teleport

The existing 2.5 km raycast becomes only the local precise resolver.

Do not replace it with a giant distance.

Resolver order:

```text
local collider
active-body analytical surface
celestial angular target
armed map/coordinate target
```

Earth analytical target uses WGS84 ray/ellipsoid intersection.

## Phase E - one teleport service

All:

```text
E
map
coordinate form
landmark travel
```

must converge on one `UniversalTeleportService`.

Remote pipeline:

```text
resolve
prepare destination only
atomic handoff
safe arrival
VFX
retire source
```

Never stream the travel path.

## Destination rollout

Verify sequentially:

```text
Manaus
Earth arbitrary geodetic
Moon
Mars orbit
Solar-system space
remote Milky-Way sector
generated system
Andromeda
cosmological targets
```

Do not expose later levels as verified before their backend passes tests.

## Work method

For each item:

1. inspect consumers;
2. write/reproduce test;
3. implement minimal complete change;
4. targeted tests;
5. npm test;
6. npm run build;
7. browser test for UI/render;
8. small commit;
9. continue.

Do not rush.

Definition of done:

```text
correct spatial authority
+
navigation state
+
hierarchical map
+
coordinate parser
+
target resolver
+
destination preparation
+
atomic handoff
+
safe arrival
+
tests
+
browser verification
```
