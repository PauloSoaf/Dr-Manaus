# Terra WGS84 e superfície planetária

## Objetivo

Substituir a ideia de um chão infinito por uma Terra real em forma e escala.

A Terra será representada como elipsoide WGS84.

Valores principais:

```text
semi-major axis  6.378.137,0 m
flattening       1 / 298,257223563
polar radius     aproximadamente 6.356.752,3 m
```

## Não usar uma esfera de raio 100

A esfera pode existir somente como proxy visual de LOD muito distante.

O modelo lógico deve continuar WGS84.

## PlanetBody

```ts
interface PlanetBody {
  id: string;
  semiMajorAxisM: number;
  flattening: number;
  rotationPeriodS: number;
  parentFrame: string;
  surfaceProvider: PlanetSurfaceProvider;
}
```

Earth:

```ts
EarthBody = {
  id: 'earth',
  semiMajorAxisM: 6378137,
  flattening: 1 / 298.257223563,
  ...
}
```

## Tile system planetário

Recomendação: cubed sphere quadtree.

Estrutura:

```text
Earth
|
+-- +X face
+-- -X face
+-- +Y face
+-- -Y face
+-- +Z face
+-- -Z face
```

Cada face possui quadtree:

```text
face
+-- L0
    +-- L1
        +-- L2
            +-- ...
```

Endereço:

```ts
interface PlanetTileAddress {
  bodyId: 'earth';
  face: 0 | 1 | 2 | 3 | 4 | 5;
  level: number;
  x: number;
  y: number;
}
```

Vantagens:

- não depende de Web Mercator
- cobre polos
- evita uma singularidade única nos polos
- distribuição mais uniforme que longitude/latitude pura
- funciona bem com subdivisão hierárquica
- permite terrain LOD por Screen Space Error

## Geração de vértices

Para cada vértice do tile:

```text
cube face uv
      |
      v
direção normalizada
      |
      v
lat/lon geodésicos
      |
      v
WGS84 ECEF
      |
      + elevation
      |
      v
posição relativa ao frame de renderização
```

O DEM nunca precisa ser armazenado como uma malha planetária única.

## LOD conceitual

```text
espaço profundo
  globo mínimo

órbita
  topografia macroscópica
  oceanos
  continentes
  atmosfera

escala continental
  costa
  grandes rios
  relevo simplificado

escala regional
  DEM
  hidrografia
  cobertura terrestre

Manaus
  cidade real atual
  vias
  edifícios
  landmarks
  trânsito
  destruição
```

## Screen Space Error

Adotar o princípio usado por OGC 3D Tiles.

Fórmula aproximada:

```text
SSE =
  geometricErrorMeters * viewportHeight
  --------------------------------------
  2 * distance * tan(fov / 2)
```

Refinar quando:

```text
SSE > targetPixels
```

Sugestão inicial:

```text
High / Ultra: 1.5 a 2.0 px
Medium:       2.5 a 3.5 px
Low:          4.0 a 6.0 px
```

Adicionar hysteresis para evitar troca repetida na fronteira.

## Dados globais

Baseline recomendado:

```text
Natural Earth
  costas
  continentes
  oceanos
  grandes rios
  grandes lagos

Copernicus GLO-90
  relevo global

Copernicus GLO-30
  melhoria regional quando autorizado e necessário
```

Natural Earth é domínio público.

Copernicus GLO-30 e GLO-90 têm cobertura global e licença gratuita, mas os termos de atribuição precisam ser preservados. O acesso GLO-30 mudou em 2026 e exige registro CCM em determinados fluxos de serviço. Por isso GLO-90 deve ser suficiente para o baseline automatizado.

## DSM e dupla contagem

Copernicus DEM é um DSM, não um DTM puro.

Ele pode incluir:

```text
vegetação
edificações
infraestrutura
```

Não extrudar edifícios Overture sobre um DEM urbano bruto sem filtro, pois isso pode somar duas alturas.

Para Manaus:

1. manter inicialmente o chão atual
2. introduzir relevo por região em uma PR isolada
3. filtrar ou suavizar DSM sob áreas urbanas
4. calibrar landmarks
5. adicionar offset vertical geodésico somente depois de testes visuais

## Curvatura dentro de Manaus

A cidade não deve continuar como um único plano rígido de dezenas de quilômetros.

Estratégia:

```text
tile atual de 1024 m
        |
        v
centro geográfico do tile
        |
        v
ENU frame próprio
        |
        v
mesh existente dentro desse frame
```

Cada tile de Manaus pode manter sua geometria local quase sem alteração e ser orientado sobre o elipsoide no centro do tile.

Isso cria curvatura planetária sem entortar cada prédio individualmente.

## Estradas e objetos longos

Objetos que atravessam quilômetros precisam de segmentação.

Exemplos:

```text
Ponte Rio Negro
grandes avenidas
rios
orla
```

Eles devem ser amostrados em segmentos e transformados por frames locais ao longo da superfície.

## Oceano

O oceano global deve seguir o elipsoide.

O Rio Negro e águas locais de Manaus continuam sob responsabilidade do provider local para manter:

```text
cor
margens
Encontro das Águas
colisão visual
efeitos locais
```

A regra é:

```text
ManausWaterProvider
>
EarthOceanProvider
```

## Resultado esperado

Do Largo:

```text
o chão parece plano
```

A dezenas de quilômetros de altitude:

```text
a curvatura começa a aparecer
```

Em órbita:

```text
a Terra é um corpo completo real em proporção
```

Nenhuma dessas etapas exige trocar de mapa.
