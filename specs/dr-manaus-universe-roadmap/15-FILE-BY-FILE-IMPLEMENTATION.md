# File-by-file implementation guide

This is a planning map, not a command to edit every file in one sprint.

## `src/world/travel/CosmicFlight.ts`

Keep Solar barycentric flight; split contact detection from response; add assisted/free-flight collision context; keep segment-sphere CCD.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/travel/BodyNavigation.ts`

Remain identity-based target authority; later add collision metadata adapter and universal-address compatibility.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/travel/TravelDomain.ts`

Split capture speed from local handoff speed; never send unsafe inward speed into local terrain physics.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/game/Game.ts`

Wire state, input and HUD only; do not become location of autopilot equations or body-class impact rules.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/player/InputController.ts`

Add Tab/Shift+Tab actions and explicit autopilot engage/cancel actions without colliding with browser focus behavior.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/ui/HUD.ts`

Render lock, target state, distance, ETA, braking/dropout phase; map actions call same selection authority.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/ui/map/UniversalMapPanel.ts`

Map click locks identity; no position snapshot; later support universal NavigationAddress.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/runtime/UniverseRuntime.ts`

Own frame/address handoffs; later generalize outside Solar domain while keeping bounded render origins.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/celestial/CelestialBodyProfile.ts`

Add data-driven collision/approach/destruction capabilities, not ID-specific branches.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/celestial/SolarSystem.ts`

Keep curated Solar authority; do not mix procedural galaxy generation into it.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/planet/PlanetTerrainProvider.ts`

Implement/participate in swept terrain contact contract for local rocky surfaces.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/physics/PhysicsWorld.ts`

Expose continuous terrain sweep / future generic LocalCollisionField; preserve Manaus behavior.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/player/PlayerController.ts`

Use motion clamping result; Grounded transition after swept contact; preserve tangential movement.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/planet/volume/PlanetVolumeRuntime.ts`

Phase 6 later adds collision representation bounded by same resident demand; do not become impact policy owner.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/planet/volume/PlanetVolumeMesher.ts`

Remain pure mesher; do not import gameplay, Game or HUD.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/providers/GalaxyProvider.ts`

Evolve into presentation consumer of logical GalaxyDescriptor; remove logical-position authority from visual provider.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/providers/StarSectorProvider.ts`

Keep scheduler-driven deterministic sectors; later pair star visuals with lazily resolved SystemDescriptors.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/providers/LargeScaleStructureProvider.ts`

Remain macro presentation; do not define literal physical edge/center.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/world/celestial/GalaxyDefinition.ts`

Split curated definitions from generated descriptors when procedural galaxy runtime lands.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.

## `src/core/config.ts`

Keep feature flags temporary and measurable; add domain budgets, not magical unbounded speeds scattered through code.

### Constraints

- Preserve current single authority for its domain.
- Add tests before broad refactor.
- Keep astronomical state out of Float32 render transforms.
- Do not import UI into pure world/math modules.
- Do not introduce body-specific branches when profile/capability data can express the rule.
