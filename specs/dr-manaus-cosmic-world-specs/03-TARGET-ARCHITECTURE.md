# Arquitetura alvo

## Princípio central

```text
estado lógico real
!=
estado de renderização
!=
estado de física local
```

Os três precisam se relacionar por contratos explícitos.

## Camadas

```text
Universe Addressing
  galaxy / sector / system / body

Celestial Model
  systems / bodies / ephemerides / gravity domains

Reference Frames
  system frame
  body-fixed frame
  local surface frame
  render-local frame

World Providers
  Earth low LOD
  Earth DEM
  hydrology
  Manaus
  authored landmarks
  procedural planets
  star sectors

Global Streaming
  demand
  priority
  prefetch
  cache
  budget
  activation
  eviction

Gameplay Local
  player
  collisions
  combat
  destruction
  traffic
  NPCs

Render Domains
  local
  planetary
  celestial
  galactic
```

## Autoridades

### PlayerController

Autoridade somente para movimento dentro do reference frame ativo.

Nunca deve acumular coordenadas galácticas.

### UniverseRuntime

Autoridade para:

```text
UniverseAddress
active system
active body
active reference frame
logical travel state
handoffs
```

### ReferenceFrameGraph

Autoridade para transformações entre frames.

Nenhuma classe deve copiar matemática de curvatura manualmente.

### GlobalStreamingScheduler

Autoridade única para orçamento de conteúdo que pode crescer sem limite.

## Coordenada recomendada

### Superfície / cidade

```text
Logical:
Geodetic + body ID

Tile:
{ bodyId, face, level, x, y }

Local:
Float64 position within tile/frame

GPU:
Float32 camera-relative
```

### Sistema Solar

```text
system-relative Float64
+
body-local frame
```

### Galáxia

```text
SectorIndex bigint
+
offset Float64 dentro do setor
```

Nunca:

```text
Vector3(9.46e18, ...)
```

na física ou GPU.

## Travel state machine

```text
LOCAL_SURFACE
PLANETARY
INTERPLANETARY
INTERSTELLAR
```

Transitions:

```text
LOCAL_SURFACE
  player physics + city collisions

PLANETARY
  body frame + coarse terrain + no city simulation distante

INTERPLANETARY
  solar-system logical position
  bodies as angular representations
  local player bubble near zero

INTERSTELLAR
  sector + offset
  galaxy provider
  local system materialized only on approach
```

## Renderização

Não tentar colocar universo inteiro em uma cena.

```text
LocalRenderRepresentation
PlanetRepresentation
CelestialRepresentation
GalaxyRepresentation
```

Cada representação possui:

- own precision policy
- own LOD
- own visibility
- own scheduler demands
- own disposal

## Regra de uma única transformação

A mesma posição geográfica deve gerar:

```text
render transform
collider transform
traffic transform
destruction transform
audio transform
raycast transform
```

a partir do mesmo frame.

Não criar fórmulas paralelas em:

```text
buildingGeometry
HLOD
ChunkMeshes
roads
landmarks
```

## Regra de determinismo

Todo conteúdo procedural precisa ser função de:

```text
globalSeed
+
stable address
+
generatorVersion
```

Exemplo:

```text
universeSeed
 -> galaxySeed
 -> sectorSeed
 -> starSeed
 -> systemSeed
 -> bodySeed
 -> planetTileSeed
```
