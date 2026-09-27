# Roadmap noturno

O Claude deve executar esta fila em ordem.

## N0 Truth pass

- git status/log;
- rerun npm test;
- npm run build;
- browser smoke;
- update factual status;
- record baseline.

## N1 Earth visual repair

- EarthSurfaceClass;
- land green;
- ocean blue optical behavior;
- ice mask;
- Manaus urban overlay;
- tests.

## N2 Altitude transition

- EarthTransitionController;
- readiness gate;
- ManausRegionalProxy;
- atmosphere blend;
- remove black ground interval.

## N3 Curved Manaus complete

- SurfaceFrameService;
- buildings;
- roads;
- HLOD;
- terrain;
- water;
- landmarks;
- traffic;
- colliders;
- destruction.

Only after verified:

```text
FEATURES.curvedManaus = true
```

## N4 Travel authority and zero-g

- PlayerController local-only;
- InterplanetaryController;
- inertial movement;
- GravityField;
- body handoff.

## N5 Solar vertical slice

- Moon landing;
- return Earth;
- Mars;
- visual profiles;
- rings;
- gas giants;
- Sun.

## N6 Milky Way

- GalaxyDefinition;
- density field;
- bar/arms/dust;
- Sgr A*;
- galaxy LOD.

## N7 Black holes

- BlackHoleDefinition;
- gravity;
- horizon;
- accretion;
- TSL lens;
- budgets.

## N8 Andromeda and Local Group

- M31;
- M33;
- satellites;
- galaxy handoff.

## N9 Cosmic web

- Mpc cells;
- clusters;
- Great Attractor region;
- LSS renderer.

## N10 Horizon

- CosmologyDomain;
- Gpc addressing;
- horizon/CMB representation.

## N11 Hardening

- profiling;
- memory;
- cache;
- WebGPU;
- fallback;
- long travel;
- docs.

## Gate per stage

```text
targeted tests
npm test
npm run build
runtime/browser verification if visual
profile if performance-sensitive
small commit
```
