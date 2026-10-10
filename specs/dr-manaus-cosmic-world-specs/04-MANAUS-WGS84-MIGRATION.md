# Migração de Manaus para WGS84

## Objetivo

Preservar a Manaus atual visualmente e funcionalmente, mas posicioná-la matematicamente sobre a Terra.

Não regenerar a cidade.

## Não fazer

Não aplicar independentemente:

```text
drop = R * (1 - cos(theta))
```

em vários geradores.

Isso cria drift e sistemas divergentes.

## Estratégia

### Etapa A

Manter a projeção compilada como coordenada interna dos assets atuais.

```text
legacy Manaus XY/XZ
```

### Etapa B

Dividir Manaus em frames locais por tile.

Para cada tile de 1024 m:

```text
tile center legacy
 -> legacyLocalToGeodetic
 -> WGS84 geodetic
 -> ECEF
 -> local ENU frame
```

### Etapa C

Toda geometria de um tile continua pequena.

```text
building vertex:
tile-local float32

tile transform:
computed from WGS84/ECEF/ENU
```

Isso reduz erro e evita reprocessar cada vértice com coordenadas planetárias.

## Componentes que devem migrar juntos

### Grupo 1 render

- real city buildings
- roofs
- procedural fallback
- HLOD
- roads
- lane markings
- vegetation
- Largo
- Teatro
- Arena
- aeroporto
- Ponte Rio Negro
- Ponta Negra
- water meshes

### Grupo 2 gameplay

- building colliders
- ground collision
- road graph
- traffic positions
- destruction queries
- crater positions
- teleport target
- landmark detection
- mission targets
- raycasts

## Contrato de tile

Criar uma estrutura conceitual semelhante a:

```ts
interface SurfaceTileFrame {
  bodyId: string
  tileId: string
  centreGeodetic: Geodetic
  centreEcef: EcefPosition
  localFrameId: string

  legacyToLocal(x: number, y: number, z: number): Vec3
  localToEcef(local: Vec3): EcefPosition
}
```

## Handoff visual

Até a migração inteira passar nos testes:

```text
EarthProvider.minAltitudeM = 15000
```

ou gate equivalente seguro.

Depois:

```text
0-2 km
Manaus + terrain local

2-20 km
Manaus HLOD + Earth terrain

20-100 km
planet detail gradually dominates

100 km+
planetary representation
```

Os números podem ser ajustados por teste visual.

## Critérios de Manaus preservada

Os seguintes landmarks não podem mudar de posição relativa de forma perceptível:

- Monumento à Abertura dos Portos
- Teatro Amazonas
- Arena da Amazônia
- aeroporto
- Ponta Negra
- Ponte Rio Negro

Os testes devem congelar:

```text
distâncias relativas
bearing
lat/lon
altitude
```

## Aceite

Subir verticalmente sobre o Teatro precisa resultar em:

```text
Teatro
-> bairro
-> Manaus
-> Amazonas
-> Brasil
-> América do Sul
-> Terra
```

sem:

- terrain desaparecendo cedo
- cidade duplicada
- cidade flutuando
- ruas planas atravessando planeta
- prédios inclinados de forma diferente dos colliders
- pop brusco no handoff
