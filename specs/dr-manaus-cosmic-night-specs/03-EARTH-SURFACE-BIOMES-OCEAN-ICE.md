# Terra: superfície, oceano, floresta, gelo e Manaus

## Produto inicial

A Terra precisa ser legível imediatamente:

```text
terra = verde
oceano = azul
gelo = branco
Manaus = mancha urbanizada na região real da cidade
```

Antes de tentar desertos, savanas e dezenas de biomas, estabilizar essa leitura simples.

## Reusar o que já existe

`EarthLandMask.ts` já possui:

```text
isLandAt()
SURFACE_COLOURS
surfaceColour()
```

E usa Natural Earth.

Evoluir este sistema.

## EarthSurfaceClass

Criar:

```ts
export enum EarthSurfaceClass {
  Ocean = 0,
  Land = 1,
  Ice = 2,
  Urban = 3,
  ShallowWater = 4,
}
```

API:

```ts
classifyEarthSurface(latRad, lonRad): EarthSurfaceClass
```

## Política visual

### Ocean

Se land mask for false:

```text
Ocean
```

Com dado de costa/shelf:

```text
ShallowWater
```

### Land

Toda terra sem ice/urban:

```text
Land = verde
```

Remover por enquanto a heurística automática de `arid` baseada apenas em latitude.

Depois pode entrar um land-cover real.

### Manaus

Não desenhar 647 mil buildings de órbita.

Criar urban overlay de baixo custo derivado do manifest/cobertura real.

Do espaço:

```text
forest green
Manaus gray/olive cluster
rivers/ocean blue
```

### Ice

Não pintar todo terreno acima de uma latitude como gelo permanente.

Adicionar dataset/mask offline de:

- Antarctica;
- Greenland ice sheet;
- optional polar sea ice visual.

## Material único

Para manter performance:

```text
1 Earth surface material
surfaceClass attribute/texture
```

TSL:

```text
Ocean:
  blue
  low roughness appearance
  Fresnel
  Sun glint

Land:
  green
  high roughness

Ice:
  high albedo
  cool white

Urban:
  muted gray/olive
```

## Oceano global

Não criar wave geometry para o planeta todo.

O oceano deve ser efeito de material:

```text
ellipsoid surface
+
water classification
+
Fresnel
+
specular Sun
+
small normal perturbation
```

Nenhum milhão de wave meshes.

## Vegetação fora de Manaus

LOD:

```text
Orbit:
green albedo only

50 km - 5 km:
macro canopy detail in shader/texture

< 5 km:
procedural vegetation for active surface tiles only

< 1 km:
instanced clusters/trees

Manaus urban:
suppress vegetation where urban/buildings/roads exist
```

## Determinismo

Vegetação procedural:

```text
seed = body + surface tile + generator version
```

## Tests

Exemplos:

```text
Amazon interior -> Land
Atlantic -> Ocean
Antarctica interior -> Ice
Manaus anchor -> Urban
same coordinate -> same result
```
