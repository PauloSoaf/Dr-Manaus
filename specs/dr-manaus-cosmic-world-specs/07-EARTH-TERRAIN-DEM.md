# Terra, terreno e DEM

## Objetivo

A Terra deve parecer e medir como a Terra.

O relevo global não deve ser um planeta procedural genérico.

## Remover do Earth base

Em `src/world/planet/EarthGlobe.ts` remover o uso de:

```ts
new SimplexNoise()
```

para produzir montanhas da Terra.

## Problemas atuais

- não determinístico por padrão
- nova instância por tile
- possível seam entre tiles
- relevo fictício
- não corresponde a Andes, Himalaias etc.
- custo extra no build
- dificulta testes de fronteira

## Pipeline recomendado

### Base

```text
WGS84 ellipsoid
```

### Land/ocean mask

```text
Natural Earth
```

para low LOD.

### Elevation

Preferência:

```text
Copernicus DEM GLO-90
```

como base global.

Opcional para áreas selecionadas:

```text
Copernicus DEM GLO-30
```

### Manaus

Pode ter source mais detalhada futuramente, mas não precisa bloquear a arquitetura.

## Offline preprocessing

Não consultar serviços geográficos durante gameplay.

Criar pipeline:

```text
source DEM
-> crop / normalize
-> quantize
-> tile
-> compress
-> manifest
-> runtime cache
```

Tile key:

```text
earth-dem/{face}/{level}/{x}/{y}
```

## Mesh generation

A posição de cada sample:

```text
tile UV
-> cube sphere direction
-> geodetic
-> elevation sample
-> WGS84 ECEF
-> tile-local offset
```

## Crack prevention

Implementar pelo menos uma estratégia:

- skirts
- edge stitching
- shared edge samples
- geomorphing entre LODs

Preferência inicial:

```text
shared edge samples + skirts
```

por simplicidade.

## Microdetail procedural

Pode existir, mas apenas como camada visual:

```text
real DEM
+
deterministic small-scale noise
```

Regras:

- seed global
- função contínua em coordenadas geodésicas
- amplitude pequena
- não alterar macroscale
- não romper tile borders
