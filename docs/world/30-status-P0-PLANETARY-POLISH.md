# P0 — Planetary Presentation, Earth 3D Map, Rivers, Manaus Far LOD & Flight Polish

Baseline: `225e99507856e4508c558bc94e56c0b07d0d5d1c`, `feat/universe-map`.
Scope is strictly within the P0 Planetary Polish checkpoint: presentation, illumination, flight pose, solar landing, 3D Earth map, and Manaus orbital LOD. U4 (procedural galaxies) and BH0–BH2 remain future work.

## 1. Architectural Highlights

### Solar Lighting, Day/Night Transitions and Occlusion
- **Solar Elevation & Lighting**: Created `src/rendering/SolarElevation.ts` calculating solar elevation relative to planetary surface tangents and normals. Day/twilight/night transitions compute continuous lighting weights with twilight attenuation.
- **Occlusion Testing**: Implemented `src/rendering/celestial/occlusion.ts` evaluating line-of-sight and penumbra factors from the Sun across celestial occluders.
- **Night Ambient Floor**: Enhanced planet shader uniforms in `src/rendering/celestial/PlanetVisual.ts` and `GeographicBodyVisual.ts` ensuring night hemispheres retain an ambient floor (`uAmbient`) so night sides remain identifiable against deep space without artificial neon glow.

### Moon Lighting and Earthshine
- **Phase Floor**: Updated `SOLAR_BODY_PROFILES.moon.visual` in `src/world/celestial/CelestialBodyProfile.ts` with `phaseFloor: 0.14`, neutral albedo `[0.76, 0.76, 0.78]`, and subtle cool earthshine ambient `[0.10, 0.10, 0.12]`.
- **Illumination Shader**: Moon shader computes phased irradiance with earthshine blending on unlit sectors, preventing pitch-black lunar silhouettes while preserving distinct crescent and gibbous phases.

### Player Flight Orientation & Procedural Flight Pose
- **Singularity-Free 3D Orientation**: Implemented `src/player/animations/FlightOrientation.ts` calculating a stable orthonormal basis aligned with player 3D velocity. It eliminates gimbal lock and avoids discontinuous roll/yaw flips when flying through the local zenith or polar verticals.
- **Procedural Aerodynamic Pose**: Created `src/player/animations/ProceduralFlightPose.ts` and integrated it into `src/player/CharacterModel.ts`. Velocity pitch, yaw rates, and banking generate smooth procedural spine/pelvis offsets that blend harmoniously with existing authorial humanoid flight animations.

### Solar Photosphere Landing
- **Profile Configuration**: Set `canLand: true` and `landingMode: 'photosphere'` on `SOLAR_BODY_PROFILES.sun`.
- **Surface Simulation**: Provides a smooth ENU tangent plane heightfield at the solar radius without invoking Marching Cubes, voxel carving, or rock crater destruction.
- **CCD & Standoff**: Safe sweep and proximity controls in `src/world/celestial/SystemGenerator.ts` and `src/world/travel/TravelDomain.ts` distinguish the Sun's fluid photosphere from rocky bodies, permitting controlled near-surface hovering and descent.

### 3D Earth Map with Natural Earth River Layers
- **Offline Natural Earth Geodata**: Generated `src/world/geodata/earth-rivers.json` via `scripts/geodata/build-earth-rivers.mjs` containing public-domain continental coastlines and major South American/Amazon river pathways.
- **Layer & Renderer**: Built `src/world/planet/EarthRiverLayer.ts` and `src/ui/map/PlanetMap3DRenderer.ts`. The 3D map renders a spherical Earth globe with drag-based yaw/pitch rotation (pitch clamped to $\pm\pi/2.2$), mouse wheel zoom, continental outlines, Amazon river system, and geodetic markers for Manaus and player coordinates.
- **Lifecycle & Resource Disposal**: Integrated cleanly into `src/ui/map/UniversalMapPanel.ts` and `MapRenderers.ts` with `<canvas id="planet-3d-canvas">`, ensuring all geometries, materials, and listeners are disposed upon panel closing.

### Manaus Far-Distance LOD (Tier C) & Orbital Transition
- **Far LOD Disc & Night Glow**: Extended `src/rendering/ManausAerialPresentation.ts` with Tier C presentation: a body-fixed far marker disc and nocturnal city glow anchored at `MANAUS_ANCHOR_ECEF`.
- **Continuous Cross-Fade**: Fades seamlessly from Tier B aerial mesh (15 km – 100 km) to Tier C orbital presentation (100 km – 500 km).
- **Orbital Culling**: Flat local city geometry is completely culled (`opacity === 0`) at orbital altitudes ($\ge 500$ km), eliminating flat-plane projection artifacts from orbit.

---

## 2. Diagnostics & Telemetry

Added 18 diagnostic metrics in `src/game/Game.ts` under the F3 debug overlay:
1. `EARTH MAP · Mode / Zoom`: 3D globe state and zoom factor.
2. `EARTH MAP · Center Lat/Lon`: Center coordinates of 3D globe view.
3. `EARTH MAP · Rivers / Detail`: River layer visibility and vector count.
4. `MANAUS FAR · LOD Tier`: Active Manaus presentation tier (A, B, or C).
5. `MANAUS FAR · Distance / Alt`: Real-time geocentric distance and altitude.
6. `MANAUS FAR · Opacity`: Cross-fade blending weight.
7. `MANAUS FAR · Night glow`: Nocturnal illumination intensity.
8. `MOON · Phase / Angle`: Lunar phase fraction and solar angle.
9. `MOON · Phase floor`: Earthshine ambient floor value.
10. `MOON · Earthshine ambient`: Effective lunar night irradiance.
11. `SUN · Elevation / Azimuth`: Solar angles in local horizontal frame.
12. `SUN · Day/Night weight`: Day vs. night lighting factor.
13. `SUN · Twilight state`: Dawn/dusk atmospheric attenuation factor.
14. `SUN · Landing mode / Surface`: Photosphere tangent plane descriptor.
15. `FLIGHT · 3D Velocity vector`: Cartesian speed vector in active frame.
16. `FLIGHT · Bank / Pitch angle`: Aerodynamic banking and pitch angles.
17. `FLIGHT · Singularity guard`: Zenith singularity avoidance status.
18. `FLIGHT · Pose blend weight`: Procedural vs. clip animation blend ratio.

---

## 3. Automated Validation & Test Evidence

### Unit & Regression Suites
| Gate / Suite | Tests | Result |
|---|---:|---|
| `npm run typecheck` | — | **PASS** (0 errors) |
| `tests/earth-map-3d.test.ts` | 10 | **PASS** |
| `tests/earth-rivers.test.ts` | 4 | **PASS** |
| `tests/manaus-far-lod.test.ts` | 10 | **PASS** |
| `tests/flight-orientation-polish.test.ts` | 9 | **PASS** |
| `tests/planetary-lighting.test.ts` | 10 | **PASS** |
| `tests/moon-lighting.test.ts` | 8 | **PASS** |
| `npm run test:regression` | 610 | **PASS** (610/610) |
| `npm run check:impact-fidelity` | 24 | **PASS** (24/24) |
| `npm test` (Full Repository Suite) | 1,390 | **PASS** (1,390/1,390) |
| `npm run build` | — | **PASS** (Vite bundle built in 2.06s) |

### Browser Automation Checkpoint
`scripts/planetary-polish-browser.mjs` executed in Playwright headless browser:
- **Flow A (3D Earth Map)**: Opens universal map at Earth level, confirms 3D canvas visibility, simulates drag rotation and zoom wheel interactions, validates clean disposal upon close. **PASS**.
- **Flow B (Manaus Far LOD)**: Tests altitudes 15 km (aerial Tier B), 100 km (Tier B/C fade), 500 km (Tier C orbit disc), and 1,000 km (complete local mesh culling). **PASS**.
- **Flow C (Solar Lighting & Day/Night)**: Simulates horizontal noon, sunset, and midnight positions, confirming continuous solar elevation and smooth day/night weights. **PASS**.
- **Flow D (Moon Lighting & Earthshine)**: Tests lunar irradiance across new moon, half, and full phases, confirming non-zero earthshine floor (0.14). **PASS**.
- **Flow E (Flight Orientation & Pose)**: Evaluates steep climbs, dives, and zenith passages, confirming finite orthonormal basis without flips and continuous aerodynamic bank/pitch blending. **PASS**.
- **Flow F (Photosphere Landing)**: Confirms photosphere landing mode flags, tangent plane heightfield, and safe descent behavior without cratering. **PASS**.

---

## 4. Acceptance Criteria & Constraints
- **Preservation of Core Regressions**: Permanent regression gate (`npm run test:regression`) strictly satisfied with zero tolerance erosion.
- **No Remote Geodata Calls**: All river and map assets are local, offline public-domain vectors.
- **Strict Scope Boundaries**: U4 (procedural galaxies) and BH0–BH2 (black hole general relativity / accretion disks) remain untouched and deferred to their scheduled checkpoints.
