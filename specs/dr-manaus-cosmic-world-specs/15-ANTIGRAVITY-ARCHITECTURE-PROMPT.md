# Prompt de arquitetura para Antigravity

Faça uma revisão arquitetural da `feat/universe-map` antes de adicionar novas features.

Objetivo:

corrigir o modelo para suportar:

```text
Manaus
-> Terra WGS84
-> Sistema Solar
-> setores interestelares
-> sistemas procedurais
```

sem usar uma única coordenada global gigante.

## Arquitetura obrigatória

Separe:

```text
logical universe position
render-local position
local physics position
```

Implemente authority boundaries claros:

```text
PlayerController
  somente local frame

UniverseRuntime
  address / active body / active system / travel domain

ReferenceFrameGraph
  conversões

GlobalStreamingScheduler
  world-content budget

Render representations
  local / planet / celestial / galaxy
```

## Manaus

Não curve prédios individualmente com aproximações duplicadas.

Migre por `SurfaceTileFrame` usando a infraestrutura WGS84/ECEF/ENU já existente.

O mesmo transform precisa ser usado por:

```text
buildings
roads
water
landmarks
colliders
traffic
destruction
```

Até isso estar pronto, mantenha o handoff da Terra em altitude segura.

## Travel

Introduza:

```text
LocalTravel
InterplanetaryTravel
CosmicTravel
```

Não aplique cosmic speed ao `PlayerController`.

## Celestial systems

Não mutar `SolarSystem` para representar qualquer sistema procedural.

Crie runtime genérico de star system e mantenha o Sistema Solar como definição estável.

## Procedural generation

Toda geração:

```text
seeded
stable IDs
versioned
address based
```

## Deliverables

Ao finalizar esta rodada:

1. ADR curto da arquitetura final
2. diagrama de authority
3. interfaces principais
4. migration plan
5. testes de boundary
6. nenhum código duplicando coordinate math
7. docs/status corrigidos
