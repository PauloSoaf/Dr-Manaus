# Coordinate model

## Reuse existing types

Use:

```text
UniverseAddress
SectorIndex
CosmologicalAddress
ReferenceFrameGraph
SurfaceFrameService
CelestialSystemRuntime
```

Do not create a second cosmic address system.

## Add a location payload

Suggested:

```ts
interface UniverseLocation {
  address: UniverseAddress
  frameId: string

  surface?: {
    latDeg: number
    lonDeg: number
    altitudeM: number
  }

  systemPositionM?: [number, number, number]
  sectorOffsetM?: [number, number, number]
  cosmological?: CosmologicalAddress
}
```

## Teleport target union

```text
surface-geodetic
body-orbit
system-position
cosmic-sector
cosmological
catalog-object
```

No Three.js objects in DTOs.

## Input modes

### Geographic
Body, latitude, longitude, altitude.

### System
System X/Y/Z with km or AU.

### Galactic
Galaxy, Sector BigInt3, offset.

### Catalog
Named body/system/galaxy/anchor.

### Cosmology
Advanced until LSS architecture is valid.

## Shareable format

Version immediately:

```text
drm:v1://...
```

Roundtrip must preserve BigInt exactly.

No locale-dependent decimal parsing.
