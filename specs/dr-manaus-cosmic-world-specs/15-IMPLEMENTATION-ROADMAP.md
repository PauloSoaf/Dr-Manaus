# Roadmap de implementação

## Organização

Apesar de ser uma única mega task de produto, não implementar tudo em uma única PR.

A sequência abaixo minimiza regressões e permite merge incremental.

## Fase 0: congelar baseline

Entregas:

```text
registrar HEAD atual
corrigir docs/geodata.md
capturar métricas de performance
capturar screenshots de referência
adicionar tests de invariantes geográficos atuais
```

Resultado:

```text
sabemos exatamente o que não pode regredir
```

## Fase 1: Spatial Core

Criar:

```text
WGS84
GeodeticPosition
ECEF
ENU
ReferenceFrame
ReferenceFrameGraph
FloatingOrigin3D
SpatialPose
```

Ainda não mudar visualmente Manaus.

DoD:

```text
todos os testes atuais passam
novos testes matemáticos passam
```

## Fase 2: Manaus compatibility adapter

Criar `ManausFrameAdapter`.

Fazer `latLonToWorld()` delegar ao novo core sem mudar os resultados dentro da tolerância.

Encapsular:

```text
RealCityLayer
WorldStreamer
HLODManager
landmarks
```

em `ManausProvider`.

DoD:

```text
Manaus parece igual
```

## Fase 3: Global streaming scheduler

Criar:

```text
ProviderRegistry
GlobalStreamingScheduler
StreamingBudget
TileCache
PrefetchPredictor
```

Manaus continua sendo o único provider de cidade detalhada.

DoD:

```text
scheduler novo não piora streaming atual
```

## Fase 4: Terra WGS84 low LOD

Adicionar:

```text
EarthBody
cubed sphere quadtree
Natural Earth coast/ocean/river
planet low LOD
```

Primeiro objetivo visual:

```text
subir de Manaus
ver a curvatura
ver América do Sul
ver Terra
```

DoD:

```text
sem loading screen
sem Terra fake em escala arbitrária
```

## Fase 5: Terrain global

Adicionar:

```text
Copernicus GLO-90
terrain tiles
SSE
seam handling
```

GLO-30 fica opcional.

DoD:

```text
o planeta possui relevo global
Manaus não perde a cidade
```

## Fase 6: Curvar Manaus sobre a Terra

Aplicar transform por tile de 1.024 m.

Segmentar elementos longos conforme necessário.

Calibrar:

```text
roads
water
bridge
terrain
landmarks
```

DoD:

```text
solo continua visualmente correto
cidade acompanha planeta
```

## Fase 7: Atmosfera e render domains

Criar:

```text
LocalRenderDomain
PlanetRenderDomain
CelestialRenderDomain
atmosphere planet-aware
global ocean
cloud handoff
```

Remover dependência do sky sphere atual como solução final.

DoD:

```text
ground -> orbit é contínuo
```

## Fase 8: remover teto de 140 km

Só fazer depois que o domínio planetário estiver pronto.

Trocar:

```text
SPACE.maxAltitude
```

por regras de reference frame.

DoD:

```text
jogador pode sair da Terra
```

## Fase 9: Sistema Solar

Criar:

```text
CelestialBody
SolarSystem
EphemerisProvider
Sun
Moon
8 planets
```

Primeiro pouso:

```text
Lua
```

DoD:

```text
Manaus -> Lua -> Manaus
```

## Fase 10: Galaxy layer

Adicionar:

```text
Gaia subset
star sector
Milky Way density
system generation
```

DoD:

```text
sair do Sistema Solar
aproximar outra estrela
materializar system
```

## Fase 11: Universe sectors

Adicionar:

```text
galaxy sectors
procedural galaxies
observable-universe representation
cosmic travel mode
```

DoD:

```text
escala de universo sem crescimento proporcional de arquivo
```

## Fase 12: persistência

Promover mutações atuais para:

```text
WorldObjectId
tile mutation store
world seed
generator version
```

DoD:

```text
destruição persiste depois de viagem planetária
```

## Fase 13: hardening

Executar:

```text
performance
memory
browser fallback
cache eviction
network failure
save migration
long session
```

## Dependências

```text
Fase 1
  |
  v
Fase 2
  |
  +------> Fase 3
  |          |
  |          v
  +------> Fase 4 -> Fase 5 -> Fase 6
                         |
                         v
                      Fase 7
                         |
                         v
                      Fase 8
                         |
                         v
                      Fase 9
                         |
                         v
                      Fase 10
                         |
                         v
                      Fase 11
                         |
                         v
                      Fase 12 -> Fase 13
```

## Estratégia de feature flags

Adicionar flags temporárias:

```text
planetarySpatialCore
earthGlobe
planetTerrain
curvedManaus
newAtmosphere
solarSystem
galaxyTravel
```

Cada flag deve ser removida depois que a fase estabilizar.

Não deixar duas arquiteturas completas vivendo permanentemente.
