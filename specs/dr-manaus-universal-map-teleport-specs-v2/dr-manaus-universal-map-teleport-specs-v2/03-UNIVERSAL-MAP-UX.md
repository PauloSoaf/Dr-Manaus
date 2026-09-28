# Universal Map UX

## Keep M

The existing `M` map remains the entry point.

Do not create a second navigation menu.

Refactor the UI around:

```text
UniversalMapPanel
MapNavigationModel
SurfaceMapRenderer
PlanetMapRenderer
SystemMapRenderer
GalaxyMapRenderer
CosmologyMapRenderer
```

`CityMap` can remain the Manaus surface renderer.

## Breadcrumb

Always show known hierarchy:

```text
UNIVERSE / LOCAL GROUP / MILKY WAY / SOL / EARTH / MANAUS
```

Do not fabricate levels.

## One location authority

The panel reads:

```text
UniverseRuntime.navigationState
```

and nothing else for current logical location.

Do not independently reconstruct location from:

- `PlayerController.position`;
- render coordinates;
- Earth-only telemetry;
- camera position.

## Current location card

Possible Earth state:

```text
Galaxy      Milky Way
Sector      0,0,0
System      Sol
Body        Earth
Place       Manaus
Lat/Lon     -3.1303, -60.0234
Altitude    38 m
Domain      Local surface
```

Possible Moon state:

```text
Galaxy      Milky Way
Sector      0,0,0
System      Sol
Body        Moon
Altitude    12 km
Domain      Lunar
```

Interstellar:

```text
Galaxy      Milky Way
Sector      15,-2,931
Domain      Interstellar
```

If runtime cannot prove a field, show unavailable instead of Earth data.

## Map levels

### Surface
Manaus/city map and body-surface view.

### Planet
Earth/Moon map/globe.

### System
Bodies and current logical position.

### Galaxy
Only after `UniverseAddress` is driven by gameplay.

### Local Group / Cosmology
Only after cosmic providers are hardened.

## Search result metadata

Every target returns:

```text
label
kind
target
precision
availability
```

Precision values:

```text
measured
approximate
procedural
gameplay-placeholder
```

Do not display placeholder cosmic XYZ as real astronomical precision.

## Existing placeholder warning

Current code explicitly places Andromeda on an arbitrary axis and uses approximate synthetic large-scale vectors.

The map should either:

- hide raw XYZ;
- label them approximate;
- or replace them with sourced catalog data before exposing them.
