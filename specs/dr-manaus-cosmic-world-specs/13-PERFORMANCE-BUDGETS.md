# Budgets de performance

## Filosofia

Performance é requisito de arquitetura.

Não é uma etapa final de otimização.

## Meta de frame

Desktop alvo:

```text
60 FPS
16,67 ms total
```

A aplicação continua adaptativa para hardware inferior.

## Budget de streaming

Manter como referência o limite atual:

```text
4 ms de main thread
```

O novo scheduler deve controlar o total combinado de:

```text
planning
activation
geometry upload
provider callbacks
cache work
```

`RealCityLayer` atualmente possui budget próprio de 3,5 ms. Na arquitetura global, os dois budgets não podem simplesmente somar sem coordenação.

## Ativações

Manter teto semelhante ao atual:

```text
2 ativações pesadas por frame
```

Tiles planetários muito leves podem ter classe diferente.

## Workers

Continuar usando Web Workers para:

```text
terrain decoding
procedural generation
mesh preparation
vector clipping
normal generation
```

Transferir buffers.

Evitar cópia de arrays grandes.

## Rede

Default inicial:

```text
até 4 requests concorrentes
```

Separar prioridade:

```text
critical
visible
prefetch
background
```

## GPU memory

Introduzir budget explícito.

Sugestão inicial de telemetria:

```text
soft target High: 512 MB de conteúdo gerenciado
hard target High: 768 MB
```

Esses números precisam ser validados em hardware real.

Não são garantia de memória total do navegador.

## RAM

Rastrear no mínimo:

```text
decoded terrain bytes
vector tile bytes
city tile bytes
geometry staging bytes
cache entries
```

## Boot

O planeta não pode aumentar brutalmente o carregamento inicial.

Meta:

```text
bootstrap planetário adicional <= 12 MB comprimidos
```

O restante entra por streaming.

Character GLB e animation library atuais são orçamento separado.

## Draw calls

Princípios:

```text
instancing
merged geometry
material batching
HLOD
no object per window
no object per tree at horizon
```

Isso já é seguido pelo projeto.

## Velocidade

Quanto maior a velocidade:

```text
menor densidade urbana
menor distância de detalhes finos
maior distância de prefetch macro
menor número de atores
```

Nunca manter simulação de NPCs vários quilômetros atrás.

## Altitude

Quanto maior a altitude:

```text
menos city detail
mais terrain aggregate
mais planet detail relevante
```

## Perfil atual

Manter:

```text
npm run profile
```

Adicionar:

```text
npm run profile:planet
npm run profile:orbit
npm run profile:reference-frames
```

## Cenários mínimos

### Ground

```text
Largo
Arena
Ponta Negra
Ponte
```

### Supersonic

```text
100
500
2.000
5.000
10.000 m/s
```

### Planet

```text
10 km altitude
50 km
100 km
500 km
2.000 km
```

### Travel

```text
Manaus -> Lua
Lua -> Terra
```

## Métricas

Coletar:

```text
FPS
frame ms
CPU ms
renderer draw calls
triangles
geometries
textures
active tiles
queued tiles
decoded MB
GPU managed MB
stream ms
SSE max
cache hit %
worker queue
reference frame changes
rebases
```

## Política de degradação

Se budget estourar:

1. reduzir detail richness
2. reduzir actor density
3. atrasar tile filho mantendo o pai
4. diminuir resolução dinâmica
5. reduzir sombras
6. reduzir atmosphere samples
7. reduzir cloud detail

Nunca:

```text
bloquear main thread até terminar geração
remover pai antes de filho estar pronto
carregar planeta inteiro
```
