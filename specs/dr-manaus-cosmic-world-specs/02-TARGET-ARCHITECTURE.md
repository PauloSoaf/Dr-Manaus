# Arquitetura alvo

## Objetivo

Permitir uma viagem contínua:

```text
Largo de São Sebastião
        |
        v
Manaus
        |
        v
Amazonas
        |
        v
Brasil
        |
        v
Terra inteira
        |
        v
Lua e Sistema Solar
        |
        v
Via Láctea
        |
        v
outras galáxias
        |
        v
volume observável representado pelo jogo
```

Sem exigir que todas essas regiões existam como geometria carregada ao mesmo tempo.

## Separação obrigatória

A arquitetura passa a ter quatro camadas conceituais.

```text
Spatial Model
  coordenadas reais
  hierarquia de corpos
  reference frames
  tempo astronômico

World Providers
  Manaus
  Terra global
  Sistema Solar
  estrelas
  universo procedural

Streaming Runtime
  demanda
  prioridade
  cache
  geração
  cancelamento
  orçamento

Render Domains
  local
  planetário
  celestial
```

Nenhuma dessas camadas deve depender de `Game.ts` como fonte de verdade.

## Estrutura sugerida

```text
UniverseRuntime
|
+-- SpatialRuntime
|   +-- ReferenceFrameGraph
|   +-- FloatingOrigin3D
|   +-- SpatialAddress
|
+-- WorldRuntime
|   +-- ProviderRegistry
|   +-- GlobalStreamingScheduler
|   +-- TileCache
|   +-- PrefetchPredictor
|
+-- CelestialRuntime
|   +-- SolarSystem
|   +-- Ephemeris
|   +-- GalaxySectors
|   +-- UniverseSectors
|
+-- RenderRuntime
    +-- LocalRenderDomain
    +-- PlanetRenderDomain
    +-- CelestialRenderDomain
```

## Hierarquia espacial

```text
Universe
|
+-- Local Group
    |
    +-- Milky Way
        |
        +-- Solar System
            |
            +-- Sun
            +-- Mercury
            +-- Venus
            +-- Earth
            |   |
            |   +-- EarthFixedFrame
            |       |
            |       +-- PlanetSurface
            |           |
            |           +-- Global terrain
            |           +-- Global water
            |           +-- Manaus overlay
            |
            +-- Mars
            +-- Jupiter
            +-- ...
```

O renderer não precisa conhecer toda essa árvore. Ele recebe apenas transforms relativas ao frame ativo.

## Interface de provider

Cada fonte de mundo deve obedecer um contrato comum.

Exemplo conceitual:

```ts
export interface WorldProvider {
  readonly id: string;
  readonly priority: number;

  covers(context: SpatialContext): boolean;

  plan(context: StreamingContext): TileDemand[];

  load(
    demand: TileDemand,
    signal: AbortSignal
  ): Promise<TilePayload>;

  activate(
    payload: TilePayload,
    frame: ActiveReferenceFrame
  ): ActiveTile;

  deactivate(tile: ActiveTile): void;
}
```

Providers iniciais:

```text
ManausRealCityProvider
ManausProceduralProvider
EarthBaseProvider
EarthTerrainProvider
EarthHydrologyProvider
EarthAtmosphereProvider
SolarSystemProvider
GaiaStarProvider
ProceduralGalaxyProvider
ProceduralUniverseProvider
```

## Ordem de propriedade

Quando duas fontes cobrem o mesmo lugar, a de maior fidelidade vence.

Exemplo:

```text
Manaus authored landmark
>
Manaus real city
>
Manaus procedural filler
>
Earth generic terrain
>
Earth coarse globe
```

Essa regra formaliza o comportamento que hoje já existe em:

```text
RealCityLayer
replacesChunk()
replacesCollider()
HLOD.setRealCoverage()
```

## Não transformar tudo em uma classe

Evitar:

```text
UniverseManager.ts
50.000 linhas
```

O `Game` deve orquestrar sistemas por fachada.

Exemplo:

```ts
class Game {
  readonly universe: UniverseRuntime;
  readonly player: PlayerController;
  readonly rendering: RendererManager;
}
```

O `UniverseRuntime` expõe apenas operações de alto nível:

```ts
universe.update(playerSpatialState, velocity, dt)
universe.prepare(destination)
universe.queryColliders(localQuery)
universe.damage(localEvent)
universe.restore(localEvent)
```

## Continuidade visual

Trocar reference frame não pode resultar em teleporte perceptível.

A transição deve conservar:

```text
posição aparente
orientação
velocidade
direção da câmera
tamanho angular dos corpos
iluminação
estado do streaming
```

A troca de frame é uma transformação matemática, não um evento de gameplay.

## Escala lógica e escala de renderização

A escala lógica é física.

Exemplo:

```text
raio equatorial da Terra = 6.378.137 m
Terra -> Sol médio       = ~149,7 milhões km
```

A escala enviada ao renderer depende do domínio.

Um Sol a uma UA não precisa existir na GPU em `x = 149700000000`.

O renderer pode representar o Sol por tamanho angular correto em uma camada celestial. Ao se aproximar, uma representação planetária assume progressivamente.

A posição lógica continua real durante toda a viagem.

## Inspiração técnica em Megaton Rainfall

O próprio desenvolvedor de Megaton Rainfall descreveu publicamente:

- Terra em tamanho real
- cidades e terreno procedurais
- transição contínua do solo ao espaço
- grandes cidades com muitos objetos relativamente simples
- forte uso de instancing
- densidade e distância de detalhe ajustadas conforme hardware

A arquitetura do DR Manaus não tenta copiar internamente o engine do jogo. Ela usa esses objetivos como referência de experiência e aplica soluções compatíveis com Three.js/WebGPU e com o código que já existe no projeto.
