# Permanent cross-feature regression gate

Mandatory for U3 and every later checkpoint (U4, BH0–BH2, U5, U6):

1. `npm run typecheck`
2. `npm run test:regression`
3. Focused tests for the change
4. `npm run check:impact-fidelity` with the existing tolerances
5. `npm test` and `npm run build`
6. `npm run test:browser:regression`
7. `git diff --check`, then inspect CI for the exact pushed SHA

The unit gate in `tests/regression/` registers the existing runtime contract suites directly.
This keeps the original assertions, test names and fidelity thresholds authoritative instead
of duplicating them in a second implementation. Coverage includes actual Manaus data and water,
forest footprints, aerial curvature and transitions, Solar ephemerides, target lock, Warp/CCD,
Sun photosphere, Moon/Mars landing, D1 volume publication and D1.2 collider fidelity, U0 BigInt
identity, U1 playable generated systems, U2 galaxy ownership/roundtrips and bounded rendering.

`scripts/regression-browser.mjs` runs the existing local Manaus, aerial, Solar/U1 and U2 runners
sequentially, followed by the U3 production runner. Each runner owns and closes its server and
browser, checks page/console errors and writes ignored artifacts. A missing checkpoint fails
the gate. CI runs the unit gate before the full suite and build; native GPU browser validation
is a separate local gate and is never reported as CI coverage.

Do not declare a checkpoint complete while any gate fails. Fix the regression first. Browser
automation complements the user's manual gameplay and visual acceptance; it does not replace it.

For native Windows GPU validation, set `$env:DR_BROWSER_GPU='1'` before running the browser gate.
The orchestrator uses ports 4193/4194 for Manaus and 5187 for sequential space checkpoints.
U3 is now also imported by the permanent unit gate; its initial pre-feature baseline was 488 tests.
At the U3 checkpoint, the gate passes 557 tests: those 488 contracts plus 69 U3 tests. The full
unit suite passes 1,337 tests. The U3 browser runner repeats five production roundtrips and
checks real provider/frame/visual/geometry counts, cancellation, atomic arrival and final body legs.

## Requirement traceability

IDs below identify contracts, not duplicate tests. Each row points to runtime suites registered by the unit gate; presentation, local movement and landing also run through the browser gate above.

| Contract | Existing authoritative runtime suite(s) |
|---|---|
| `T_REG_MANAUS_STARTS_AT_TEATRO` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_LOCAL_WORLD_VISIBLE` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_REAL_CITY_STREAMING` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_BUILDINGS_HAVE_COLLISION` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_WATER_SYSTEM_ACTIVE` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_RIO_NEGRO_EXISTS` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_ENCONTRO_DAS_AGUAS_EXISTS` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_FOREST_NO_WATER` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_PROCEDURAL_TREES_NO_WATER` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_LOCAL_FLIGHT` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_FLOATING_ORIGIN` | golden-path-boot.test.ts, realcity.test.ts, manaus-aerial.test.ts, flight-input.test.ts |
| `T_REG_MANAUS_AERIAL_READY` | manaus-aerial.test.ts |
| `T_REG_MANAUS_VISIBLE_15KM` | manaus-aerial.test.ts |
| `T_REG_MANAUS_VISIBLE_20KM` | manaus-aerial.test.ts |
| `T_REG_MANAUS_VISIBLE_60KM` | manaus-aerial.test.ts |
| `T_REG_MANAUS_VISIBLE_100KM` | manaus-aerial.test.ts |
| `T_REG_RIO_NEGRO_AERIAL_VISIBLE` | manaus-aerial.test.ts |
| `T_REG_MANAUS_NO_TRANSITION_GAP` | manaus-aerial.test.ts |
| `T_REG_MANAUS_NO_FLAT_CITY_IN_ORBIT` | manaus-aerial.test.ts |
| `T_REG_MANAUS_AERIAL_BODY_FIXED` | manaus-aerial.test.ts |
| `T_REG_SOLAR_BODY_COUNT` | solar-system.test.ts, navigation-lock.test.ts, cosmic-flight.test.ts, space-controls.test.ts |
| `T_REG_SOLAR_REAL_DISTANCES` | solar-system.test.ts, navigation-lock.test.ts, cosmic-flight.test.ts, space-controls.test.ts |
| `T_REG_SOLAR_MOON_PARENT_EARTH` | solar-system.test.ts, navigation-lock.test.ts, cosmic-flight.test.ts, space-controls.test.ts |
| `T_REG_SOLAR_TAB` | solar-system.test.ts, navigation-lock.test.ts, cosmic-flight.test.ts, space-controls.test.ts |
| `T_REG_SOLAR_SHIFT_TAB` | solar-system.test.ts, navigation-lock.test.ts, cosmic-flight.test.ts, space-controls.test.ts |
| `T_REG_SOLAR_TARGET_LOCK` | solar-system.test.ts, navigation-lock.test.ts, cosmic-flight.test.ts, space-controls.test.ts |
| `T_REG_SOLAR_COSMIC_FLIGHT` | solar-system.test.ts, navigation-lock.test.ts, cosmic-flight.test.ts, space-controls.test.ts |
| `T_REG_SOLAR_WARP_1C_256C` | solar-system.test.ts, navigation-lock.test.ts, cosmic-flight.test.ts, space-controls.test.ts |
| `T_REG_SOLAR_X_CANCEL` | solar-system.test.ts, navigation-lock.test.ts, cosmic-flight.test.ts, space-controls.test.ts |
| `T_REG_SOLAR_FLOATING_ORIGIN` | solar-system.test.ts, navigation-lock.test.ts, cosmic-flight.test.ts, space-controls.test.ts |
| `T_REG_SUN_RADIUS_695700KM` | sun-approach.test.ts |
| `T_REG_SUN_NO_2R_COLLISION` | sun-approach.test.ts |
| `T_REG_SUN_PHOTOSPHERE_CCD` | sun-approach.test.ts |
| `T_REG_SUN_256C_NO_TUNNEL` | sun-approach.test.ts |
| `T_REG_SUN_NO_BOUNCE` | sun-approach.test.ts |
| `T_REG_SUN_NO_LANDING` | sun-approach.test.ts |
| `T_REG_SUN_PROCEDURAL_VISUAL` | sun-approach.test.ts |
| `T_REG_SUN_CORONA_NOT_COLLISION` | sun-approach.test.ts |
| `T_REG_MOON_APPROACH` | moon-landing-hardening.test.ts, planetary-landing-integration.test.ts, celestial-ccd-p0.test.ts |
| `T_REG_MOON_LANDING` | moon-landing-hardening.test.ts, planetary-landing-integration.test.ts, celestial-ccd-p0.test.ts |
| `T_REG_MOON_HIGH_SPEED_CCD` | moon-landing-hardening.test.ts, planetary-landing-integration.test.ts, celestial-ccd-p0.test.ts |
| `T_REG_MARS_APPROACH` | moon-landing-hardening.test.ts, planetary-landing-integration.test.ts, celestial-ccd-p0.test.ts |
| `T_REG_MARS_LANDING` | moon-landing-hardening.test.ts, planetary-landing-integration.test.ts, celestial-ccd-p0.test.ts |
| `T_REG_PLANET_SAFE_CAPTURE` | moon-landing-hardening.test.ts, planetary-landing-integration.test.ts, celestial-ccd-p0.test.ts |
| `T_REG_GAS_GIANT_NO_LANDING` | moon-landing-hardening.test.ts, planetary-landing-integration.test.ts, celestial-ccd-p0.test.ts |
| `T_REG_TAKEOFF` | moon-landing-hardening.test.ts, planetary-landing-integration.test.ts, celestial-ccd-p0.test.ts |
| `T_REG_D1_IMPACT_POLICY` | rocky-impact-destruction-service.test.ts, planet-volume-collision-runtime.test.ts |
| `T_REG_D1_MINOR_IMPACT` | rocky-impact-destruction-service.test.ts, planet-volume-collision-runtime.test.ts |
| `T_REG_D1_MAJOR_IMPACT` | rocky-impact-destruction-service.test.ts, planet-volume-collision-runtime.test.ts |
| `T_REG_D1_VOLUME_COLLIDER` | rocky-impact-destruction-service.test.ts, planet-volume-collision-runtime.test.ts |
| `T_REG_D1_MULTI_CRATER` | rocky-impact-destruction-service.test.ts, planet-volume-collision-runtime.test.ts |
| `T_REG_D1_PUBLISHED_REPLACEMENT` | rocky-impact-destruction-service.test.ts, planet-volume-collision-runtime.test.ts |
| `T_REG_D12_HIGH_RES_8M` | high-res-impact.test.ts, crater-fidelity.test.ts |
| `T_REG_D12_CRATER_RADIUS_TOLERANCE` | high-res-impact.test.ts, crater-fidelity.test.ts |
| `T_REG_D12_VISUAL_COLLIDER_AGREEMENT` | high-res-impact.test.ts, crater-fidelity.test.ts |
| `T_REG_U0_UNIVERSAL_TARGET_KEY` | universal-navigation-target.test.ts |
| `T_REG_U0_BIGINT_IDENTITY` | universal-navigation-target.test.ts |
| `T_REG_U0_PLAYER_ADDRESS_NOT_TARGET` | universal-navigation-target.test.ts |
| `T_REG_U0_ANDROMEDA_TARGET` | universal-navigation-target.test.ts |
| `T_REG_U0_SGRA_TARGET` | universal-navigation-target.test.ts |
| `T_REG_U0_M31_TARGET` | universal-navigation-target.test.ts |
| `T_REG_U0_TARGET_SURVIVES_REBASE` | universal-navigation-target.test.ts |
| `T_REG_U1_PROCEDURAL_SYSTEM_DETERMINISM` | playable-procedural-systems.test.ts |
| `T_REG_U1_GENERATED_STAR` | playable-procedural-systems.test.ts |
| `T_REG_U1_GENERATED_PLANETS` | playable-procedural-systems.test.ts |
| `T_REG_U1_GENERATED_MOONS` | playable-procedural-systems.test.ts |
| `T_REG_U1_DYNAMIC_VISUALS` | playable-procedural-systems.test.ts |
| `T_REG_U1_ROCKY_LANDING` | playable-procedural-systems.test.ts |
| `T_REG_U1_MOON_LANDING` | playable-procedural-systems.test.ts |
| `T_REG_U1_GIANT_NO_LANDING` | playable-procedural-systems.test.ts |
| `T_REG_U1_PROVIDER_UNLOAD` | playable-procedural-systems.test.ts |
| `T_REG_U1_REVISIT_SAME_SYSTEM` | playable-procedural-systems.test.ts |
| `T_REG_U1_GLOBAL_EPOCH` | playable-procedural-systems.test.ts |
| `T_REG_U2_ACTIVE_GALAXY` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_MW_SECTOR_ZERO_SOLAR` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_ANDROMEDA_LOCAL_COORDS` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_ANDROMEDA_SYSTEM` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_M31_OWNERSHIP` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_M31_20KLY_RANGE` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_SGRA_26KLY_FROM_SOL` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_SGRA_INTERGALACTIC_FROM_M31` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_EXTERNAL_GALAXY_PROXY` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_NO_ACTIVE_GALAXY_DUPLICATE` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_ANDROMEDA_ROUNDTRIP` | galaxy-runtime-andromeda.test.ts |
| `T_REG_U2_MANAUS_AFTER_ROUNDTRIP` | galaxy-runtime-andromeda.test.ts |
| `T_REG_NO_ASTRONOMICAL_OBJECT3D_POSITION` | render-space.test.ts, star-sector-provider.test.ts, galaxy-runtime-andromeda.test.ts |
| `T_REG_RENDER_COORDINATES_BOUNDED` | render-space.test.ts, star-sector-provider.test.ts, galaxy-runtime-andromeda.test.ts |
| `T_REG_NO_MATH_RANDOM_PROCEDURAL_WORLD` | render-space.test.ts, star-sector-provider.test.ts, galaxy-runtime-andromeda.test.ts |
| `T_REG_PROVIDER_COUNT_BOUNDED` | render-space.test.ts, star-sector-provider.test.ts, galaxy-runtime-andromeda.test.ts |
| `T_REG_FRAME_COUNT_BOUNDED` | render-space.test.ts, star-sector-provider.test.ts, galaxy-runtime-andromeda.test.ts |
| `T_REG_DYNAMIC_VISUAL_COUNT_BOUNDED` | render-space.test.ts, star-sector-provider.test.ts, galaxy-runtime-andromeda.test.ts |
| `T_REG_NO_PROVIDER_LEAK_AFTER_ROUNDTRIP` | render-space.test.ts, star-sector-provider.test.ts, galaxy-runtime-andromeda.test.ts |
| `T_REG_NO_FRAME_LEAK_AFTER_ROUNDTRIP` | render-space.test.ts, star-sector-provider.test.ts, galaxy-runtime-andromeda.test.ts |
