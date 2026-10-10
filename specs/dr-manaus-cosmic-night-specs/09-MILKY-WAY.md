# Via Láctea

## Anchors

Modelo inicial:

```text
diâmetro aproximado: 100.000 ly
Sistema Solar: ~26.000 ly do centro galáctico
```

Esses números ficam no logical model, nunca na GPU como metros absolutos.

## GalaxyDefinition

```ts
interface GalaxyDefinition {
  id: string
  type: 'barred-spiral' | 'spiral' | 'elliptical' | 'irregular'
  diameterLy: number
  thicknessLy: number
  orientation: Quat
  centre: CosmicAddress
  densityProfile: GalaxyDensityProfile
  centralBlackHole?: BlackHoleDefinition
}
```

## MilkyWayDensityField

Componentes:

```text
thin disc
thick disc
central bar
bulge
spiral arm modulation
halo
dust lanes
star-forming regions
```

É density function, não lista de 100 bilhões de estrelas.

## Galaxy LOD

### G0 outside

1 galaxy impostor.

### G1 approach

low-res volumetric galaxy.

### G2 inside

analytic star/dust field around camera.

### G3 local

StarSectorProvider.

### G4 system

individual star system.

## Budgets

Exemplo:

```text
galaxy impostor: 1 draw
representative galaxy points: <= 80k
local visible sector stars: <= ~16k
high-detail star system: 1
```

Medir antes de aumentar.

## Sagittarius A*

Central SMBH da Via Láctea.

Usar o generic BlackHole subsystem.

## Dust extinction

Sem dust, uma Via Láctea de points parece uma nuvem homogênea.

Adicionar dust field no shader/volume representation.

## Star sectors

Worker gera typed arrays.

GPU usa shared material/batched points.

Eviction obrigatório.

## Coordinates

```text
galaxyId
sector BigInt3
local offset
```

Somente diferenças pequenas viram Number/render coordinates.
