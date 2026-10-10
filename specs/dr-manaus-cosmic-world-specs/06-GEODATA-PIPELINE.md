# Pipeline de geodata

## Princípio

Gameplay não deve depender de chamadas diretas a serviços cartográficos.

O projeto atual já segue isso para Manaus.

A nova arquitetura mantém:

```text
fonte externa
   |
   v
script de ingestão
   |
   v
normalização
   |
   v
compilação
   |
   v
tiles versionados
   |
   v
runtime offline / estático
```

## Fontes propostas

### Natural Earth

Uso:

```text
continentes
costas
oceanos
grandes ilhas
rios
lagos
fronteiras somente se houver uso de gameplay/UI
```

Características:

```text
1:110m
1:50m
1:10m
domínio público
```

Para o globo inicial, 1:110m e 1:50m são suficientes.

### Copernicus DEM

Baseline:

```text
GLO-90
90 m
global
```

Melhoria:

```text
GLO-30
30 m
global
acesso sujeito ao fluxo CCM atual
```

O pipeline deve converter o DEM para tiles próprios. Não buscar GeoTIFF em runtime.

### Overture Maps

Continuar como fonte para Manaus.

Release atual durante esta especificação:

```text
2026-09-23.0
```

Temas relevantes:

```text
buildings
transportation
base
divisions
```

Buildings e Transportation são ODbL.

### OpenStreetMap

Continuar para:

```text
vias
features específicas
correções locais
landmarks
```

Manter atribuição de contribuidores e ODbL.

### JPL Horizons

Uso:

```text
posição
velocidade
efemérides
corpos do Sistema Solar
```

Não consultar por frame.

Opções:

1. gerar tabela offline para uma faixa de datas
2. usar elementos orbitais simplificados para gameplay
3. combinar tabela + propagação local

### Gaia DR3

Não empacotar 1,8 bilhão de fontes.

Criar extratos offline.

Exemplo:

```text
bright-stars.bin
nearby-stars.bin
named-stars.json
```

## Diretórios sugeridos

```text
scripts/geodata/
  earth/
    fetch-natural-earth.mjs
    fetch-copernicus.mjs
    build-earth-tiles.mjs
  manaus/
    build-manaus-tiles.mjs
  astronomy/
    build-solar-ephemeris.mjs
    build-gaia-catalog.mjs

public/world/
  earth/
    manifest.json
    globe/
    terrain/
    vectors/
    manaus/
  solar/
    manifest.json
    ephemeris/
  galaxy/
    catalogs/
```

## Manifest versionado

Exemplo:

```json
{
  "schemaVersion": 1,
  "datasetVersion": "2026-09-25",
  "body": "earth",
  "sources": [
    "Natural Earth",
    "Copernicus DEM",
    "Overture Maps",
    "OpenStreetMap"
  ]
}
```

Cada tile deve poder ser invalidado independentemente.

## Formato runtime

Não assumir JSON para tudo.

JSON atual é útil e deve ser preservado na migração.

Para escala global, preferir progressivamente:

```text
TypedArray binário
GLB para geometria authored
KTX2/WebP/AVIF para texturas conforme suporte
dados vetoriais compactados
índices espaciais compactos
```

## Compressão

Tiles devem ser independentes e cacheáveis.

Evitar:

```text
earth.json de 2 GB
```

Preferir:

```text
manifest pequeno
tile pequeno
filhos carregados por demanda
```

## Geração determinística

Todo conteúdo procedural deve depender de:

```text
worldSeed
providerId
tileAddress
schemaVersion
```

Exemplo:

```ts
seed = hash64(
  worldSeed,
  providerId,
  tile.face,
  tile.level,
  tile.x,
  tile.y
);
```

Reabrir o mesmo tile precisa gerar o mesmo resultado.

## Atualização de Manaus

O pipeline deve conseguir atualizar Overture/OSM sem destruir authored content.

Separar:

```text
source-generated
authored-overrides
```

Landmarks manuais sempre vencem dados genéricos.

## Atribuição

Criar um arquivo de runtime e um arquivo documental de créditos.

Sugestão:

```text
public/world/ATTRIBUTION.txt
docs/data-licenses.md
```

Deve incluir, conforme fonte utilizada:

```text
OpenStreetMap contributors
Overture Maps Foundation
Copernicus DEM notices
Natural Earth, opcionalmente citado
JPL/NASA
ESA/Gaia
```

## Não misturar licença com autoria

Cada dataset precisa registrar:

```text
source
version
retrievedAt
license
attribution
transformations
bounding region
compiler version
```

Isso também aumenta reprodutibilidade.
