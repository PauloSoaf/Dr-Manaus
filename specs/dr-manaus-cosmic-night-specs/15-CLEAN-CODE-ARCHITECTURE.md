# Clean code para o universo

## Evitar God objects

Não criar:

```text
UniverseManager.ts
SpaceManager.ts
CosmicRenderer.ts
```

contendo tudo.

## Estrutura sugerida

```text
src/world/
  spatial/
  travel/
  gravity/
  planet/
  celestial/
  galaxy/
  cosmology/
  providers/
  streaming/
  persistence/

src/rendering/
  domains/
  nodes/
  celestial/
  galaxy/
  blackhole/
```

## Gravity

```text
gravity/GravitySource.ts
gravity/GravityField.ts
gravity/BodyGravitySource.ts
gravity/BlackHoleGravitySource.ts
```

## Travel

```text
travel/TravelDomain.ts
travel/LocalTravelController.ts
travel/InterplanetaryController.ts
travel/InterstellarController.ts
travel/CosmologicalController.ts
travel/TravelHandoff.ts
```

## Galaxy

```text
galaxy/GalaxyDefinition.ts
galaxy/GalaxyDensityField.ts
galaxy/MilkyWayDefinition.ts
galaxy/AndromedaDefinition.ts
galaxy/LocalGroupCatalog.ts
```

## Black holes

```text
blackhole/BlackHoleDefinition.ts
blackhole/BlackHoleRenderer.ts
blackhole/BlackHoleLensingNode.ts
blackhole/AccretionDisk.ts
```

## Earth

```text
planet/earth/EarthSurfaceClassifier.ts
planet/earth/EarthOceanNode.ts
planet/earth/EarthIceMask.ts
planet/earth/EarthTransitionController.ts
planet/earth/ManausRegionalProxy.ts
```

## Rules

### Math layer

Sem Three.js import em:

- WGS84;
- gravity equations;
- orbital math;
- cosmic addressing;
- deterministic generation.

### Render layer

Nunca modifica logical state.

### Provider

Nunca lê keyboard/input diretamente.

### Game.ts

Não deve conter fórmulas de planetas/galáxias.

Chama facades.

## Naming

Não chamar `centreX` algo que na prática é tile corner.

Frame code precisa de nomes exatos.

## Status vocabulary

Use:

```text
not-started
prototype
integrated
verified
```

Não `done` se feature flag está off.
