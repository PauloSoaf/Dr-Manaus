# Agent Status Report - Iteration 36

## Progress Against Prompt (specs/Promptatual.md)

### Current Objective Focus
Fixing visual bugs related to the Earth's rendering, atmosphere shading, and the galactic star background overlapping the physical planets.

### Progress Made
1. **Ocluded Star Vectors (`StarSectorProvider.ts`)**:
   - Diagnosed that `StarSectorProvider` was calculating the galactic geometry using `METRES_PER_UNIT = 4e15`.
   - Prevented the provider from rendering cartesian sectors when inside the `sol` system, yielding the solar system sky rendering exclusively to `SpaceLayer` which is properly placed behind all planets.
2. **Atmospheric Edge (`EarthGlobe.ts`)**:
   - Eliminated the solid white blown-out HDR boundary at the edge of the planet.
   - Converted the `atmosphereMesh` to `FrontSide` and mapped `opacityNode` explicitly using a Fresnel calculation rather than simply driving the color to super-additive values.
   - Lowered the surface terrain `LIMB_GAIN` so the mesh surface does not duplicate the atmospheric ring effect.
3. **Planet Night-side Readability (`EarthGlobe.ts`)**:
   - Replaced a direct multiplicative multiplier (`NIGHT_FLOOR = 0.035`) with an additive `nightAmbient` vec3 term (`[0.004, 0.008, 0.018]`).
   - Ensures that extremely low albedo terrain (like the Natural Earth oceans mask) does not turn into a pure black hole on the unlit side of the planet.
4. **Planet Globe (`PlanetGlobe.ts`)**:
   - Repaired the previously unconsumed `uTileOpacity` parameter by assigning it to `this.material.opacityNode`, restoring cross-fade capability for LOD proxy swaps.

### Next Steps
Investigate minor failures in the CI test suite from prior iterations (`manaus-earth-integration.test.ts` / `universe-navigation.test.ts`) that might relate to `PlanetTerrainProvider` hooks or recent frame changes.
