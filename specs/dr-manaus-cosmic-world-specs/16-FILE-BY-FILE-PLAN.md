# Plano por arquivo

## Novos módulos

### Spatial

```text
src/world/spatial/
  units.ts
  WGS84.ts
  Geodetic.ts
  ECEF.ts
  ENU.ts
  SpatialPose.ts
  ReferenceFrame.ts
  ReferenceFrameGraph.ts
  FloatingOrigin3D.ts
  ManausFrameAdapter.ts
  UniverseAddress.ts
```

Responsabilidade:

```text
matemática e endereçamento
zero dependência de renderização
```

### Runtime

```text
src/world/runtime/
  UniverseRuntime.ts
  WorldRuntime.ts
  SpatialRuntime.ts
  ProviderRegistry.ts
```

### Streaming

Manter arquivos atuais durante migração e adicionar:

```text
src/world/streaming/
  GlobalStreamingScheduler.ts
  StreamingBudget.ts
  TileDemand.ts
  TileCache.ts
  PrefetchPredictor.ts
```

`WorldStreamer.ts` vira provider local progressivamente.

### Planet

```text
src/world/planet/
  PlanetBody.ts
  EarthBody.ts
  PlanetTileAddress.ts
  CubeSphere.ts
  PlanetQuadtree.ts
  ScreenSpaceError.ts
  PlanetSurface.ts
  EarthTerrainProvider.ts
  EarthVectorProvider.ts
  EarthOceanProvider.ts
```

### Providers

```text
src/world/providers/
  WorldProvider.ts
  ManausProvider.ts
  ManausRealCityProvider.ts
  ManausProceduralProvider.ts
  EarthProvider.ts
  SolarSystemProvider.ts
  GalaxyProvider.ts
  UniverseProvider.ts
```

### Celestial

```text
src/world/celestial/
  CelestialBody.ts
  SolarSystem.ts
  EphemerisProvider.ts
  OfflineEphemeris.ts
  BodyHandoff.ts
  StarCatalog.ts
  StarSector.ts
  GalaxySector.ts
```

### Render domains

```text
src/rendering/domains/
  RenderDomain.ts
  LocalRenderDomain.ts
  PlanetRenderDomain.ts
  CelestialRenderDomain.ts
  RenderDomainComposer.ts
```

## Arquivos atuais a alterar

### `src/game/Game.ts`

Hoje instancia quase tudo diretamente.

Objetivo:

```text
reduzir responsabilidade
```

Migrar para:

```ts
this.universe = new UniverseRuntime(...);
```

O `Game` continua responsável por loop, input e integração de gameplay, mas não por conhecimento interno de todas as camadas espaciais.

### `src/core/config.ts`

Separar:

```text
LOCAL_WORLD
REAL_CITY
PLANET_STREAMING
RENDER_DOMAINS
TRAVEL
PERFORMANCE
```

`SPACE.maxAltitude` deixa de ser teto global.

### `src/world/geodata/geodata.ts`

Manter API de compatibilidade.

Mover matemática WGS84 para `spatial`.

`GEO_ORIGIN` continua como anchor de Manaus.

### `src/world/realcity/RealCityLayer.ts`

Fase 1:

```text
nenhuma reescrita
```

Fase 2:

```text
receber frame/transform do provider
```

Fase 3:

```text
requests coordenados pelo scheduler global
```

### `src/world/streaming/WorldStreamer.ts`

Não renomear de imediato se isso gerar diff inútil.

Primeiro criar adapter.

Depois, opcionalmente renomear para `ManausProceduralStreamer`.

### `src/world/lod/HLODManager.ts`

Continuar local.

Não transformá-lo em HLOD planetário.

Criar `PlanetQuadtree` separado.

### `src/rendering/Atmosphere.ts`

Migrar de altitude local simples para `PlanetAtmosphereContext`.

Manter API temporária:

```ts
setAltitude()
```

até o novo sistema estar ativo.

### `src/rendering/SpaceLayer.ts`

Transformar em fallback.

A parte de stars pode ser reaproveitada.

Sol, Lua e limb final devem vir do modelo planetário/celestial.

### `src/rendering/RendererManager.ts`

Adicionar compositor de domínios.

Não aumentar `camera.far` para unidades astronômicas.

Testar reversed depth em benchmark separado.

### `src/player/PlayerController.ts`

Substituir clamp de `SPACE.maxAltitude`.

Adicionar `SpatialController` ou adapter para posição lógica.

Não fazer o PlayerController conhecer galáxias.

### `src/player/CameraController.ts`

Continuar recebendo local render position.

Mover transformação lógica -> render local para SpatialRuntime.

### `src/physics/PhysicsWorld.ts`

Continuar local.

Adicionar macro collision API separada para planet/body.

### Destruction

Arquivos:

```text
TerrainDestruction.ts
DestructionSystem.ts
AuthoredDestruction.ts
```

Adicionar suporte a stable world IDs e mutation sink.

## Scripts novos

```text
scripts/geodata/build-earth-tiles.mjs
scripts/geodata/build-earth-vectors.mjs
scripts/geodata/build-solar-ephemeris.mjs
scripts/geodata/build-gaia-catalog.mjs

scripts/profile-planet.mjs
scripts/profile-orbit.mjs
```

## Testes novos

```text
tests/wgs84.test.ts
tests/reference-frames.test.ts
tests/floating-origin-3d.test.ts
tests/planet-tiles.test.ts
tests/provider-ownership.test.ts
tests/earth-streaming.test.ts
tests/solar-system.test.ts
tests/celestial-handoff.test.ts
tests/universe-seed.test.ts
tests/world-persistence.test.ts
```

## Docs a atualizar

```text
docs/geodata.md
docs/world-architecture.md
docs/data-licenses.md
docs/performance.md
```

Corrigir especificamente a origem antiga descrita em `docs/geodata.md`.
