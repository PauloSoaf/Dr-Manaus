# Performance, LOD e streaming cósmico

## Representações por escala

```text
L0 local: metres/km
L1 planet: km/radii
L2 system: AU
L3 stellar: ly
L4 galaxy: kpc
L5 group: Mpc
L6 cosmic: tens/hundreds Mpc
L7 horizon: Gpc
```

Cada domínio usa coordenadas locais.

## Provider hierarchy

```text
EarthSurfaceProvider
PlanetProvider
SolarSystemProvider
StarSectorProvider
GalaxyProvider
LocalGroupProvider
LargeScaleStructureProvider
CosmologyProvider
```

## Hard caps

Ponto de partida High:

```text
planet tiles <= 160
star sectors <= 27
local visible stars <= 16k
representative galaxy points <= 80k
high-detail galaxy <= 1
full black-hole lens <= 1
high-detail planet surface <= 1
```

Ajustar por profiling.

## Angular LOD

```text
< 1 px:
point

1-16 px:
billboard

16-200 px:
low mesh

large:
full provider
```

## Workers

Mover para workers:

- terrain tile build;
- star sector generation;
- galaxy samples;
- catalog transforms;
- procedural system precompute.

## GPU

Preferir:

- Points;
- InstancedMesh;
- BatchedMesh;
- shared materials;
- typed buffers;
- TSL.

## TSL

Para novos shaders WebGPU:

```text
src/rendering/nodes/
```

com modules:

- ocean;
- atmosphere;
- galaxy;
- black hole lens;
- accretion.

Não adicionar novos hacks `onBeforeCompile()` no caminho WebGPURenderer.

## Cache

Canonical key:

```text
provider/version/address
```

## Infinite provider contract

Todo provider infinito possui:

```text
max resident
LRU
abort
deactivate
dispose
telemetry
```

## Main thread

Nada de geração síncrona pesada no tick.

Slice ou Worker.

## Telemetry

F3 adicionar:

- Travel domain;
- active body/system;
- galaxy;
- cosmic address;
- surface/planet tiles;
- star sectors;
- galaxy points;
- GPU MB;
- cache hit;
- streaming ms;
- active black hole lens.
