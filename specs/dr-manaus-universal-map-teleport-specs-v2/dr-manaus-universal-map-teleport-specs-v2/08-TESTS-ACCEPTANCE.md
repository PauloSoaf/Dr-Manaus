# Tests and acceptance

## Preflight

### Interplanetary remains active
Enter and run multiple frames. Logical travel speed keeps domain interplanetary.

### Entry barycentric correctness
Surface/local position converts to current Earth barycentric position + offset.

### Body-relative envelope
Uses player minus body centre.

### Scheduler runs in space
Scheduler frame and Moon/star demands advance during `updateSystemPose`.

### SpatialContext
Moon state reports Moon body/altitude. No fake Earth geodetic coordinates.

### Address authority
Travel/teleport updates `UniverseAddress`.

### BigInt
No absolute sector is converted to Number for placement.

### Deterministic galaxy
Same input -> same point buffer.

### Black-hole render safety
No Three.js object receives galactic physical coordinates.

## Map

Earth shows Milky Way/Sol/Earth/Manaus.

Moon shows Moon and does not show Manaus lat/lon.

Galactic sector displays exact BigInt.

## Teleport

- local 500 m target;
- Earth target beyond 2.5 km;
- no ±100 km universal rejection;
- arbitrary Earth lat/lon;
- Moon target;
- Mars safe orbit;
- remote exact sector;
- cancellation A -> B;
- bounded memory after repeated jumps.

## Browser

Map opens on `M`.

Breadcrumb, coordinate validation, selected destination, precision status and preparation progress work.

## Verification commands

Record actual results for:

```text
npm test
npm run build
npm run test:browser
```

Current HEAD has no published GitHub CI status, so do not claim green CI unless one is added.
