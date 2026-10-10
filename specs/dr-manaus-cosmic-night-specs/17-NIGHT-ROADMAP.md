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

## N4 Travel authority and zero-g (DONE)

- [x] PlayerController local-only;
- [x] InterplanetaryController;
- [x] inertial movement;
- [x] GravityField;
- [x] body handoff.

## N5 Solar vertical slice (DONE)

- [x] Moon landing;
- [x] return Earth;
- [x] Mars;
- [x] visual profiles;
- [x] rings;
- [x] gas giants;
- [x] Sun.

## N6 Milky Way (DONE)

- [x] GalaxyDefinition;
- [x] density field;
- [x] bar/arms/dust;
- [x] Sgr A*;
- [x] galaxy LOD.

## N7 Black holes (DONE)

- [x] BlackHoleDefinition;
- [x] gravity;
- [x] horizon;
- [x] accretion;
- [x] TSL lens;
- [x] budgets.

## N8 Andromeda and Local Group (DONE)

- [x] M31;
- [x] M33;
- [x] satellites;
- [x] galaxy handoff.

## N9 Cosmic web (DONE)

- [x] Mpc cells;
- [x] clusters;
- [x] Great Attractor region;
- [x] LSS renderer.

## N10 Horizon (DONE)

- [x] CosmologyDomain;
- [x] Gpc addressing;
- [x] horizon/CMB representation.

## N11 Hardening (DONE)

- [x] profiling;
- [x] memory;
- [x] cache;
- [x] WebGPU;
- [x] fallback;
- [x] long travel;
- [x] docs.

## Gate per stage

```text
targeted tests
npm test
npm run build
runtime/browser verification if visual
profile if performance-sensitive
small commit
```
