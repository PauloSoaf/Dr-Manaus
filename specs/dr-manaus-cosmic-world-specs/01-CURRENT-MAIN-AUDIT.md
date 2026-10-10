# Auditoria da main atual

## Snapshot

A análise foi feita sobre:

```text
PauloSoaf/Dr-Manaus
main
d2e03428b1d9ba90fdc7b2a5112c280e6686fead
Merge pull request #2 from PauloSoaf/feat/caracter-animation
```

A branch `feat/caracter-animation` já foi integrada à `main`. Esta especificação considera a árvore resultante do merge como fonte de verdade.

## Stack

`package.json` atualmente usa:

```text
three                 ^0.186.0
@gltf-transform/core  ^4.5.0
@gltf-transform/functions ^4.5.0
typescript            ^7.0.2
vite                  ^8.3.0
@playwright/test      ^1.63.0
tsx                   ^4.23.13
```

O renderer já usa `WebGPURenderer` e pode cair para WebGL 2.

## Estado geográfico de Manaus

A fonte de verdade atual está em `src/world/geodata/geodata.ts` e nos testes.

O `world zero` atual é:

```ts
GEO_ORIGIN = {
  lat: -3.130333,
  lon: -60.022528
}
```

Esse ponto corresponde ao Monumento à Abertura dos Portos no Largo de São Sebastião.

O Teatro Amazonas é uma posição separada a oeste do monumento.

A projeção atual é local e equiretangular:

```text
+X = leste
+Z = sul
Y  = altura
1 unidade aproximadamente 1 metro
```

As funções existentes:

```ts
latLonToWorld()
worldToLatLon()
```

continuam úteis como camada de compatibilidade de Manaus, mas não devem ser usadas como sistema global do planeta.

## Inconsistência documental encontrada

`docs/geodata.md` ainda descreve uma origem anterior baseada no Teatro Amazonas em aproximadamente:

```text
-3.1303, -60.0234
```

Isso está desatualizado em relação ao código, manifest e testes atuais.

A sprint deve corrigir esse documento. Não deve alterar o código atual para fazê-lo combinar com a documentação antiga.

## Manifest da cidade real

`public/geodata/real-city/manifest.json` contém atualmente:

```text
generatedAt          2026-09-20T00:11:06.443Z
tileSize             1024 m
proceduralChunkSize  128 m
tiles                645
buildings             647085
roads                 52034
pois                  52225
skylineBlocks         7734
landmarkFeatures      634
namedRoads            40767
waterPolygons         241
districtCount         62
landmaskWaterCells    54996
roadSegments          59645
roadNodes             43635
```

Esse volume de conteúdo deve ser tratado como patrimônio do projeto. A nova arquitetura deve carregar e posicionar esse conteúdo, não regenerá-lo como uma cidade genérica.

## Streaming existente

`WORLD` atualmente usa:

```text
chunkSize               128 m
detailRadius             480 m
mediumRadius             1350 m
aggregateRadius          5400 m
horizonRadius            24000 m
maxActiveChunks          64
maxCachedChunks          30
maxRequests              4
streamingBudgetMs        4 ms
prefetchSeconds          2.8 s
originThreshold          2048 m
maxActivationsPerFrame   2
```

O `WorldStreamer` já possui:

- planejamento direcional de chunks
- geração assíncrona
- pool de Web Workers
- fallback quando Worker falha
- cache de chunks
- limite de ativações por frame
- `prepare()` para teleporte
- cancelamento lógico por revisão após mudança brusca de área
- destruição persistente dentro do runtime
- supressão de conteúdo procedural onde a cidade real cobre a área

Isso deve ser generalizado, não refeito do zero.

## Cidade real existente

`RealCityLayer` já implementa uma ideia muito próxima do que queremos em escala planetária:

```text
near
  células de 256 m
  fachadas
  janelas
  telhados
  colisão

shell
  tiles de 1.024 m
  footprints reais
  geometria simplificada

skyline
  massas urbanas agregadas
  para tiles não residentes
```

Configuração atual:

```text
detailEnter          340 m
detailExit           400 m
shellRadius          1850 m
shellRadiusCruise    1500 m
shellRadiusFast      1050 m
maxTiles             24
maxConcurrentLoads   3
maxQueuedJobs        8
fastSpeed            700 m/s
megaSpeed            2400 m/s
detailSpeedLimit     620 m/s
leadSeconds          1.6 s
maxLead              3200 m
buildBudgetMs        3.5 ms
maxColliders         900
```

Essa arquitetura deve se tornar uma implementação de `ManausProvider`.

## HLOD existente

O projeto já diferencia:

```text
detail
medium
aggregate
horizon
```

Há limites explícitos para instâncias e o HLOD remove sua representação no mesmo frame em que a cobertura detalhada entra, evitando sobreposição visível.

O HLOD planetário deve reutilizar o mesmo princípio com métricas de Screen Space Error.

## Floating origin atual

`Game.ts` já possui:

```ts
readonly origin = new Vector3();
```

E durante o tick:

```ts
if (
  Math.hypot(
    player.position.x - origin.x,
    player.position.z - origin.z
  ) > WORLD.originThreshold
) {
  origin.set(
    Math.round(player.position.x / 1024) * 1024,
    0,
    Math.round(player.position.z / 1024) * 1024
  );

  worldRoot.position.copy(origin).negate();
}
```

Isso é um bom começo. O problema é que o frame lógico continua sendo um plano de Manaus e o rebase é somente X/Z.

A evolução deve:

- manter a ideia
- permitir X/Y/Z
- usar uma origem geodésica ou celestial
- separar posição lógica de posição renderizável
- evitar colocar ECEF de milhões de metros diretamente em buffers GPU

## Renderer atual

A câmera está definida como:

```ts
PerspectiveCamera(58, 1, 0.15, 260000)
```

O renderer usa:

```ts
new WebGPURenderer({
  antialias: true,
  alpha: false,
  logarithmicDepthBuffer: true,
  forceWebGL: ...
})
```

Three.js r186 também oferece `reversedDepthBuffer`, mas a sprint não deve simplesmente aumentar o `far` para unidades astronômicas. O problema precisa ser resolvido por domínios de renderização e reference frames.

## Espaço atual

O espaço atual é um efeito visual, não um Sistema Solar físico.

`SPACE`:

```text
atmosphereTop  9000 m
karman         26000 m
orbit          60000 m
maxAltitude    140000 m
```

`PlayerController` bloqueia a altitude em `SPACE.maxAltitude`.

`SpaceLayer` usa:

```text
STAR_RADIUS   150000
SHELL_RADIUS  170000
SUN_DISTANCE  120000
EARTH_RADIUS  6371000
```

As estrelas e o Sol ficam em um rig preso à câmera.

Isso foi correto para criar a sensação atual de subida ao espaço, mas deve virar um fallback visual durante a migração. Não pode continuar sendo a representação final do Sistema Solar.

## Perfil de alta velocidade existente

`scripts/profile-flight.mjs` já testa:

```text
100 m/s
500 m/s
2.000 m/s
5.000 m/s
10.000 m/s
```

O teste mede principalmente CPU e observa tiles, chunks, filas, colisores e trânsito.

Esse script deve continuar existindo e ganhar perfis planetários.

## Pontos fortes a preservar

- Manaus real compilada
- Largo e Teatro
- Arena da Amazônia
- Ponta Negra
- Ponte Rio Negro
- aeroporto
- malha viária
- trânsito
- bairros
- landmask
- destruição
- reconstrução
- HLOD
- generation pool
- perfil de voo
- testes determinísticos
- fallback WebGL 2
- controles e animações da branch recém-integrada

## Bloqueadores para escala planetária

O código atual ainda assume:

1. mapa global plano
2. origem geográfica fixa de Manaus
3. altitude máxima de 140 km
4. Sol e estrelas como decoração presa à câmera
5. chunks identificados apenas por X/Z
6. terreno global como malha local
7. hidrografia específica de Manaus
8. física e destruição referenciadas ao mesmo plano local
9. nenhuma noção de planeta pai
10. nenhuma noção de reference frame celestial
11. nenhuma persistência espacial hierárquica
12. nenhuma representação interplanetária real

Esses bloqueadores são o foco da mega sprint.
