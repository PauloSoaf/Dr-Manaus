# Cosmic target hardening

## GalaxyProvider

Current issues:

```text
Math.random
static macro placement
no galaxy-relative handoff
fake WorldProvider lifecycle
```

Before "Teleport to Andromeda" is verified:

- deterministic seeded generation;
- current-domain-relative render position;
- real provider lifecycle or remove provider identity;
- logical catalog separated from rendering.

## BlackHoleProvider

Current issues:

```text
raw positionM in Three.js
raw physical horizon radius in local scene
definition type lives in provider
no gravity
no lensing
fake provider lifecycle
```

Move model type to a world-model module.

Suggested:

```text
src/world/blackhole/BlackHoleDefinition.ts
```

Renderer consumes relative/angular state.

## LargeScaleStructureProvider

Do not use Earth altitude as scale.

Introduce domain/scale state such as:

```text
local
interplanetary
interstellar
intergalactic
cosmological
```

or equivalent.

## Catalog source quality

Attach provenance/quality to catalog positions.

Current approximate vectors are okay as placeholders for visuals, not as precise coordinate entry values.

## Sagittarius A*

Do not define it twice.

Current Game creates Sgr A* separately while `GalaxyDefinition` also contains a central black hole.

Choose the catalog/model as single source of truth.

## Local Group

M31/M33/satellites should share a generic galaxy subsystem.

No per-galaxy engine duplication.
