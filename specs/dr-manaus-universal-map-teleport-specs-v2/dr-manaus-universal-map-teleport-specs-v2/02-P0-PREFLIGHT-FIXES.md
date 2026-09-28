# P0 preflight fixes before Universal Map / Teleport

## P0-01 Interplanetary mode can collapse after one frame

Current flow:

```text
enter interplanetary
-> Game sets player.velocity = 0
-> next updateTravelDomain reads player.velocity.length()
-> TravelDomain sees speed below minTravelSpeed
-> return to local
```

Fix:

while interplanetary, domain transition logic must use:

```text
length(travelDomain.state.velocityMps)
```

not local `PlayerController.velocity`.

## P0-02 Interplanetary state starts at the wrong barycentric position

`TravelDomain.considerEntering()` currently creates:

```ts
positionM: [0, bodyRadius + altitude, 0]
```

while saying `systemId = sol`.

That is not the player's actual position relative to the solar-system barycentre.

Fix:

on `entered`, convert the exact current pose to:

```text
solar-system/barycentric
```

and initialize `InterplanetaryState` from it.

Velocity must also be converted into the target frame.

## P0-03 Body envelope is centered on barycentric origin

`InterplanetaryController` currently checks:

```text
radius = length(positionM)
floor = bodyRadius + margin
```

But `positionM` is system/barycentric.

Fix TravelContext:

```ts
referenceBodyCenterM: Vec3
```

Then use:

```text
relative = positionM - bodyCenterM
radius = length(relative)
```

## P0-04 Scheduler stops during interplanetary travel

`UniverseRuntime.update()` runs the scheduler.

`UniverseRuntime.updateSystemPose()` does not.

`Game` calls `updateSystemPose()` in interplanetary mode.

Therefore Moon/star/planet streaming can freeze exactly when travelling in space.

Fix:

refactor both update paths through one internal runtime-advance function that always updates:

```text
time
ephemeris
active system
floating origin
SpatialContext
scheduler
telemetry
```

when streaming is enabled.

## P0-05 SpatialContext is wrong outside Manaus

Current `spatialContext()` hardcodes:

```ts
bodyId: 'earth'
altitudeM: this.playerGeodetic().heightM
```

even when `playerPose.frame` is `solar-system/barycentric`.

`playerGeodetic()` interprets the current coordinates as Manaus legacy coordinates.

Fix:

introduce canonical navigation state:

```ts
interface NavigationState {
  address: UniverseAddress
  frameId: string
  systemId?: string
  bodyId?: string
  dominantBodyId?: string
  altitudeM?: number
  geodetic?: GeodeticPosition
  systemPositionM?: Vec3
  localVelocityMps: Vec3
}
```

Geodetic data only exists when the active frame/body meaningfully supports it.

## P0-06 UniverseAddress is not gameplay authority

`UniverseRuntime.address` starts at Solar/Earth but normal gameplay does not drive it.

`StarSectorProvider` admits this and falls back to sector zero.

Fix:

- add `address` officially to `SpatialContext`;
- update address during handoffs and teleports;
- remove cast hacks;
- star-sector centre comes from the authoritative address.

## P0-07 StarSectorProvider still converts absolute BigInt during activation

Current `activate()` contains:

```ts
Number(content.sector.x) * SECTOR_SIZE_M
```

Fix:

```text
delta = content.sector - centreSector
Number(delta)
```

Only relative small deltas may become Number.

## P0-08 GalaxyProvider is nondeterministic

Current code uses:

```ts
Math.random()
```

to create 50,000 representative points.

Fix:

seed by:

```text
galaxy.id
generatorVersion
catalog seed
```

Same input must produce identical point buffers.

## P0-09 Galaxy/LSS/BlackHole providers violate WorldProvider contract

Current macro providers contain patterns like:

```text
plan() -> []
load() -> rejected Promise
activate() -> throw
deactivate() -> empty
```

yet they are registered as `WorldProvider`.

Fix one of two ways:

A. make them real bounded providers;

or

B. remove the WorldProvider identity and make them explicit finite render-domain services.

Do not keep an interface that is intentionally nonfunctional.

## P0-10 BlackHoleProvider sends galactic metres into Three.js

Current code does:

```ts
group.position.set(def.positionM[0], def.positionM[1], def.positionM[2])
```

Sgr A* is placed on the order of `1e20` physical metres.

That is forbidden for render coordinates.

Fix:

```text
logical black-hole address
-> relative direction/distance
-> render-domain position/angular representation
```

Physical Schwarzschild radius also needs a render representation, not a raw local-scene radius.

## P0-11 Black hole is not functional yet

Current implementation is:

- black sphere;
- emissive torus.

It does not yet implement:

- GravitySource;
- event-horizon gameplay;
- gravitational lensing;
- bounded lensing effect.

Do not expose it in map UI as a fully functional target until those pieces exist.

## P0-12 LargeScaleStructureProvider uses Earth altitude as cosmological state

Current visibility is based on:

```text
context.altitudeM >= 9e21
```

That mixes body altitude and cosmological scale.

Fix:

visibility/demand must depend on:

```text
navigation domain
cosmological address
active scale
```

not Earth altitude.

## P0-13 Manaus is still mixed between coordinate frames

Current code curves several things:

- real-city tiles;
- roads;
- generalized terrain;
- many colliders.

But other systems remain legacy/flat:

- HLOD;
- WaterSystem;
- landmark anchors;
- traffic positions;
- local PlayerController coordinates.

Most importantly, physics may receive curved colliders while the player remains in legacy coordinates.

Fix the local authority before coordinate teleport depends on it.

Either:

```text
everything legacy while curvedManaus=false
```

or:

```text
player + render + colliders + roads + water + landmarks + traffic
all use the same true local frame
```

## P0-14 Moving body frames are registered once

`SolarSystem.registerFrames()` writes body positions into the frame graph once.

`SolarSystem.update()` updates ephemeris state but does not refresh frame origins.

Fix:

- update moving frames every ephemeris tick; or
- implement dynamic reference-frame transforms.

Teleport to Moon/Mars must use current body positions.
