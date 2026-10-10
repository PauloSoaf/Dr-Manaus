# Streaming, HLOD e cache

## Objetivo

O jogo não carrega o mundo.

Ele carrega uma janela de relevância.

Essa janela muda conforme:

```text
posição
velocidade
direção
FOV
altitude
corpo atual
modo de viagem
memória disponível
tempo de CPU
erro visual
```

## Scheduler global

Criar:

```ts
class GlobalStreamingScheduler {
  providers: WorldProvider[];
  cache: TileCache;
  budget: StreamingBudget;
  predictor: PrefetchPredictor;

  update(context: StreamingContext): void;
}
```

Ele não substitui imediatamente `WorldStreamer`.

Inicialmente:

```text
GlobalStreamingScheduler
        |
        +-> Earth provider
        |
        +-> ManausProvider
                |
                +-> WorldStreamer atual
                +-> RealCityLayer
                +-> HLODManager
```

## TileDemand

```ts
interface TileDemand {
  key: string;
  providerId: string;
  priority: number;
  geometricErrorM: number;
  screenSpaceError: number;
  distanceM: number;
  timeToContactS: number;
  gameplayCritical: boolean;
  representation: 'active' | 'near' | 'mid' | 'far' | 'planet';
}
```

## Prioridade

Uma heurística recomendada:

```text
priority =
  visual error
  + view cone relevance
  + time to contact
  + gameplay criticality
  + provider priority
  - already cached bonus
```

A distância sozinha não é suficiente.

## Estados

```text
UNLOADED
QUEUED
FETCHING
DECODING
READY_CPU
ACTIVATING
ACTIVE
DORMANT
EVICTING
FAILED
```

Mudança de região ou teleporte deve invalidar requests antigos por geração/revisão ou `AbortController`.

## HLOD

Níveis conceituais:

```text
ACTIVE
  física
  destruição
  entidades
  texturas completas

NEAR
  geometria detalhada
  sem simulação desnecessária

MID
  shell
  materiais simples
  sem fittings

FAR
  massas agregadas
  impostors
  sem colisão

PLANET
  superfície agregada
  cidade como sinal visual, não como 600 mil prédios
```

## Screen Space Error

O LOD planetário deve ser orientado por erro visual.

O sistema atual baseado em raios continua válido para Manaus local.

A camada global decide quando um tile planetário precisa refinar.

## Hysteresis

Exemplo:

```text
refina em SSE > 2.0
volta para pai em SSE < 1.4
```

Evita thrashing.

## Velocidade

O código atual já reduz detalhe em alta velocidade.

Generalizar.

Exemplo:

```text
0 a 620 m/s
  near completo

620 a 2.400 m/s
  near reduzido
  shell priorizado

2.400 a 10.000 m/s
  skyline
  prefetch forte

acima disso
  prioridade muda para terrain e planet surface
  cidade deixa de construir fachadas
```

Não usar esses valores como verdade universal. Eles são ponto de partida compatível com o jogo atual.

## Prefetch corridor

O atual `planChunks` limita prediction a 1.600 m.

Isso é bom para Manaus, mas insuficiente em viagem planetária.

Novo predictor:

```text
leadDistance =
  speed * targetLeadTime

limitado pelo domínio e pelo LOD
```

Quanto maior a velocidade:

```text
maior o corredor
menor o detalhe solicitado antecipadamente
```

Não tentar pré-carregar edifícios a 100 km/s.

## Budget único

Hoje existem budgets separados em `WorldStreamer` e `RealCityLayer`.

O novo scheduler precisa de um teto global.

Exemplo:

```ts
interface StreamingBudget {
  mainThreadMs: number;
  workerJobs: number;
  concurrentFetches: number;
  gpuUploadBytesPerFrame: number;
  gpuMemorySoftMB: number;
  gpuMemoryHardMB: number;
}
```

## Main thread

Objetivo inicial:

```text
streaming + build + activation
p95 <= 4 ms por frame
```

Em picos excepcionais, adiar ativação é melhor que travar o frame.

## Cache

Camadas:

```text
L0 metadata
  memória

L1 decoded tile
  RAM

L2 compressed tile
  IndexedDB / Cache Storage

L3 source asset
  servidor estático
```

Não assumir persistência infinita.

Implementar LRU por bytes e por última utilização.

## Pinned tiles

Gameplay pode fixar:

```text
tile do jogador
destino de teleporte
arena de missão
tile sendo destruído
tile com estado persistente ainda não serializado
```

Pin deve ter limite.

## Fallback

Se um tile de alta qualidade não estiver pronto:

```text
manter pai visível
```

Nunca mostrar buraco.

## Falha de rede

O jogo precisa continuar com:

```text
proxy planetário
cache anterior
procedural fallback quando permitido
```

Manaus empacotada localmente não deve depender de rede externa.

## Métricas F3

Adicionar:

```text
active reference frame
planet tile count
planet max SSE
pending fetches
pending worker jobs
decoded MB
GPU tile MB
cache hit rate
rebases
frame transitions
active provider
celestial domain
```

Manter métricas atuais de cidade.
