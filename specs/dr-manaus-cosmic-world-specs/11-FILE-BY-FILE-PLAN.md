# Plano arquivo por arquivo

## `src/world/providers/EarthProvider.ts`

Agora:

- restaurar gate seguro
- restaurar exclusão/ownership de Manaus
- remover comentário de “perfectly on globe”

Depois:

- usar ownership real pelo registry
- só remover gate após Manaus migration completa

## `src/world/providers/ManausProvider.ts`

Refatorar completamente.

Não aceitar stub registrado.

Implementar adapter real ou desregistrar temporariamente.

## `src/world/realcity/buildingGeometry.ts`

Remover curvatura local duplicada quando o tile frame estiver pronto.

Geometria deve permanecer tile-local.

## `src/world/chunks/ChunkMeshes.ts`

Remover cálculos esféricos e allocations por instance.

Transform do tile/group deve fazer a curvatura.

## `src/world/lod/HLODManager.ts`

Mesmo princípio:

```text
HLOD local
+
tile frame transform
```

não curvatura manual por instância.

## `src/world/planet/EarthGlobe.ts`

Remover Simplex terrain aleatório.

Separar:

```text
surface base
elevation provider
material
```

## `src/world/spatial/UniverseAddress.ts`

Corrigir conversão bigint.

Adicionar testes com valores > 2^53.

Adicionar canonical offset type se necessário.

## `src/world/runtime/UniverseRuntime.ts`

Remover recenter cósmico baseado diretamente em `playerPose` local.

Introduzir:

```text
travel domain
active system
active body
cosmic address + offset
```

`spatialContext.bodyId` não pode ficar hardcoded como `earth` no futuro.

## `src/world/celestial/SolarSystem.ts`

Não usar `setSystemBodies()` para transformar o Sistema Solar em outro sistema.

Separar runtime genérico.

## `src/world/celestial/SystemGenerator.ts`

Adicionar orbital elements determinísticos.

Usar `starMass` de forma coerente.

Evitar proxies físicos absurdamente simples quando eles afetam gameplay.

## `src/world/celestial/UniverseRenderer.ts`

Reescrever como renderer de dados streamados.

Não gerar/setor diretamente sem lifecycle.

Implementar:

- demand
- activation
- eviction
- disposal
- LOD
- bounded residents

## `src/player/flightConfig.ts`

Corrigir interplanetary constant.

Remover cosmic speed da tabela física local ou marcar como travel speed usado por controller separado.

## `src/player/PlayerController.ts`

Remover responsabilidade de FTL.

Restaurar altitude/transition guard adequado até travel domains existirem.

## `src/player/CameraController.ts`

Não introduzir sceneScale parcial.

Camera deve receber posição render-local pronta.

## `src/world/persistence/WorldMutationStore.ts`

Transformar em interface/store assíncrona.

Evitar `localStorage.setItem` a cada alteração grande.

## `src/rendering/CurveManaus.ts`

Remover se não houver plano real de uso.

Não deixar arquivo vazio.

## `src/rendering/curveMaterial.ts`

Remover se a estratégia oficial for frame por tile.

Não manter arquitetura concorrente.

## `docs/world/15-status.md`

Corrigir estados.

Usar apenas:

```text
not started
in progress
integrated
verified
```

Evitar `done` sem acceptance.
