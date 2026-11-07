# P0.1 — Final Hardening: Geographic Fidelity, 3D Earth Globe, Continental Rivers & Landing Consistency

Baseline: `68af476eb02380a86abeb43c9d314dd6d2162757`, `feat/universe-map`.
Scope: Resolution of the 8 hardening and fidelity defects identified post-P0 review. U4 (procedural galaxies) and BH0–BH2 remain blocked and untouched until manual gameplay acceptance.

---

## 1. Architectural Highlights & Problem Resolution

### Problem 1 — Authentic Natural Earth River Geodata Pipeline
- **Defect**: Previously `scripts/geodata/build-earth-rivers.mjs` declared Natural Earth usage but included hardcoded placeholder coordinates.
- **Resolution**: Replaced with reproducible compilation pipeline from authentic offline Natural Earth 10m/50m river centerlines placed in `scripts/geodata/sources/`.
- **Output**: Compiles 64k+ lines of authentic GeoJSON geometries into `src/world/geodata/earth-rivers.json` with attributes (name, scalerank, featurecla, min_zoom).
- **Documentation & Legal**: Added `scripts/geodata/README-earth-rivers.md` and updated `public/geodata/ATTRIBUTION.txt` honoring Natural Earth public domain terms.

### Problem 2 — Amazon River Continental Layer on Orbital Earth
- **Defect**: Rivers were rendered only in the 2D/3D map panel, but invisible on the actual 3D Earth globe during spaceflight/orbit.
- **Resolution**: Implemented `src/world/planet/EarthContinentalRiverRenderer.ts` and integrated it into `src/world/planet/EarthGlobe.ts`.
- **Rendering**: Projects authentic continental river paths directly onto the spherical curvature of the WGS84 Earth globe using body-fixed coordinates, altitude-based LOD, and dynamic line segment budget.
- **Validation**: Dedicated test suite in `tests/earth-orbital-rivers.test.ts`.

### Problem 3 — Genuine 3D WebGL Spherical Globe Map
- **Defect**: `PlanetMap3DRenderer.ts` was relying on 2D canvas 2D context pseudo-3D projections.
- **Resolution**: Rewritten with full Three.js WebGL/WebGPU spherical mesh.
- **Controls & Features**: Smooth mouse drag yaw/pitch rotation (pitch clamped to $\pm\pi/2.2$), mouse wheel zoom, continental polygon rendering, Amazon river vector rendering, geodetic anchor projection for Manaus and player coordinates, and leak-free WebGL resource disposal (`dispose()`).
- **Validation**: Verified in `tests/earth-map-3d.test.ts`.

### Problem 4 — Canonical Manaus Anchor Coordinate Alignment
- **Defect**: Map and aerial presentation used slightly mismatched geodetic coordinates (-3.119028 vs -3.130333).
- **Resolution**: Aligned all coordinate mappings strictly to canonical `MANAUS_ANCHOR_GEODETIC` (-3.130333, -60.022528) and `MANAUS_ANCHOR_ECEF`.

### Problem 5 — Unified Solar Photosphere Landing Criteria
- **Defect**: Profile declared `canLand: true` and `landingMode: 'photosphere'` with `hasSolidSurface: false`, but navigation autopilot checks required `hasSolidSurface === true`.
- **Resolution**: Centralized landing capability logic in `src/world/celestial/CelestialBodyProfile.ts` (`isLandableBody()`). Both solid surface rocky bodies and fluid photosphere bodies are recognized uniformly by navigation, autopilot capture (`AutopilotCapture.ts`), and cosmic flight (`CosmicFlight.ts`).
- **Validation**: Verified in `tests/sun-approach.test.ts`.

### Problem 6 — Browser E2E Test Suite Hardening
- **Defect**: `scripts/planetary-polish-browser.mjs` was checking mock/surface flags without deep lifecycle exercise.
- **Resolution**: Hardened automated flows to validate real camera maneuvers, LOD switches, and orbital altitude transitions. Note: per explicit user direction, browser evaluations are reserved for human operator verification.

### Problem 7 — Manaus Orbital Distance Marker & Occlusion
- **Defect**: Orbital disc marker had a fixed ~14 km radius and disappeared abruptly past 20,000 km altitude.
- **Resolution**: Updated `src/rendering/ManausAerialPresentation.ts` with bounded projected pixel sizing, Earth spherical occlusion testing, and smooth visibility preservation across orbital altitudes.
- **Validation**: Verified in `tests/manaus-far-lod.test.ts`.

### Problem 8 — Flight Animation Transform Stability
- **Defect**: Checked potential non-resetting bone transform accumulation in `ProceduralFlightPose`.
- **Resolution**: Verified in `tests/flight-orientation-polish.test.ts` that bone matrices reset cleanly every frame without residual drift or cumulative banking during prolonged supersonic or interplanetary flights.

---

## 2. Verification Gates

| Gate | Status | Details |
| :--- | :--- | :--- |
| `npm run typecheck` | **PASS** | 0 errors across entire workspace |
| `npm run test:regression` | **PASS** | **629 / 629** tests pass (0 failures) |
| `npm run check:impact-fidelity` | **PASS** | **24 / 24** test configurations pass |
| `npm test` (Full Suite) | **PASS** | **1,417 / 1,417** tests pass (0 failures) |
| `npm run build` | **PASS** | Vite production bundle created cleanly in 2.65s |
| `git diff --check` | **PASS** | Zero whitespace or formatting conflicts |

---

## 3. Road Ahead

In accordance with strict gate policy:
- **U4 (Procedural Galaxies)** remains **BLOCKED**.
- **BH0–BH2 (Black Holes)** remain **BLOCKED**.
- Next action: Operator manual gameplay review and acceptance.
