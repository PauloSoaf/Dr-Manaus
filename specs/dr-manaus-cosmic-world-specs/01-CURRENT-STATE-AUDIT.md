# Auditoria do estado atual

## Diagnóstico geral

A direção arquitetural é correta, mas o último salto de implementação foi amplo demais.

A branch possui uma boa fundação espacial, porém o commit final passou a tratar como concluídas várias fases que ainda são apenas scaffolding ou implementação parcial.

O problema não é quantidade de código. O problema é quebra dos contratos que a própria arquitetura definiu.

## Componentes que estão em bom caminho

### Spatial core

Arquivos principais:

```text
src/world/spatial/WGS84.ts
src/world/spatial/ECEF.ts
src/world/spatial/ENU.ts
src/world/spatial/ReferenceFrame.ts
src/world/spatial/ReferenceFrameGraph.ts
src/world/spatial/FloatingOrigin3D.ts
src/world/spatial/ManausFrameAdapter.ts
src/world/spatial/UniverseAddress.ts
```

Essa camada deve permanecer independente de Three.js sempre que possível.

### Streaming global

Arquivos:

```text
src/world/streaming/GlobalStreamingScheduler.ts
src/world/streaming/TileCache.ts
src/world/streaming/StreamingBudget.ts
src/world/streaming/PrefetchPredictor.ts
src/world/streaming/TileDemand.ts
src/world/runtime/ProviderRegistry.ts
```

A ideia está correta:

- demanda global
- prioridade
- orçamento
- cancelamento
- cache
- activations por frame
- prefetch por direção e velocidade

O erro atual é registrar sistemas como providers sem realmente colocá-los sob esse scheduler.

### Terra WGS84

Arquivos:

```text
src/world/planet/CubeSphere.ts
src/world/planet/PlanetBody.ts
src/world/planet/PlanetQuadtree.ts
src/world/planet/PlanetTileAddress.ts
src/world/planet/ScreenSpaceError.ts
src/world/planet/EarthGlobe.ts
src/world/providers/EarthProvider.ts
```

A base de cube sphere + WGS84 + SSE é adequada.

O terrain procedural aleatório inserido depois deve ser removido e substituído por DEM real.

### Sistema Solar

Arquivos:

```text
src/world/celestial/CelestialBody.ts
src/world/celestial/EphemerisProvider.ts
src/world/celestial/OfflineEphemeris.ts
src/world/celestial/SolarSystem.ts
```

O modelo lógico do Sistema Solar real é aproveitável.

Ele não deve ser substituído por um sistema procedural quando o jogador atravessar um setor.

## Estado real das fases

A classificação mais segura hoje é:

```text
Spatial core                     sólido
Manaus compatibility adapter     sólido
Global scheduler                 sólido isoladamente
Earth globe                      funcional, precisa hardening
Global DEM                       não implementado
Manaus curved on WGS84            não concluído
Atmosphere planetária            parcial
Interplanetary travel            protótipo
Solar System                     lógico, parcial em gameplay
Galaxy                           protótipo
Universe sectors                 base de addressing
Persistence                      protótipo incompleto
Hardening                        ainda necessário
```

## Regra de status

Uma fase só pode ser `done` quando:

1. implementação existe
2. está integrada no fluxo real
3. possui testes do contrato
4. não duplica sistema antigo
5. não introduz regressão visual
6. não depende de comentários prometendo comportamento futuro
7. não possui `throw new Error("not fully wired")`
8. não possui método crítico vazio
9. passa quality gates
