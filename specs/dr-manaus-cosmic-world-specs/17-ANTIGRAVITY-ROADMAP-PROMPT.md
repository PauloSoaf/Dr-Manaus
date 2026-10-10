# Prompt de roadmap e execução contínua para Antigravity

Use o roadmap abaixo como fila de trabalho autônoma.

Não pule fases porque parecem simples.

Não implemente a próxima fase se o gate atual falhar.

## Loop operacional

Repita:

```text
pick next unchecked task
read involved files
read related tests
write failing/coverage test
implement minimal change
run targeted tests
run npm test
run npm run build
inspect runtime when visual
update docs
commit
move to next task
```

Continue executando esse loop sem parar por iniciativa própria enquanto a próxima tarefa estiver claramente definida e não houver blocker externo.

## Ordem

### H0

- safe Earth handoff
- remove fake random Earth terrain
- fix interplanetary constant
- disable local cosmic FTL
- truthful status docs
- remove dead files

### H1

- SurfaceTileFrame
- buildings
- roads
- water
- landmarks
- colliders
- traffic
- destruction
- acceptance tests

### H2

- real ManausProvider
- shared scheduler budget
- activation/deactivation
- cancellation
- cache/eviction

### H3

- DEM pipeline
- terrain provider
- edge continuity
- LOD morph/skirt
- performance

### H4

- planetary atmosphere
- ocean
- day/night
- transition

### H5

- travel domain state machine
- Earth -> Moon
- Moon -> Earth
- remove altitude ceiling only now

### H6

- bigint cosmic address
- cosmic travel
- streamed star sectors
- bounded UniverseRenderer

### H7

- procedural systems
- orbital elements
- procedural ephemeris
- another-star vertical slice

### H8

- IndexedDB persistence
- stable object IDs
- per-tile mutations
- return trip persistence

### H9

- profiling
- leak tests
- stress tests
- WebGPU/browser tests
- docs
- merge readiness

## Não declarar merge-ready até

- todos P0 fechados
- `npm test` verde
- `npm run build` verde
- browser state conhecido
- Manaus preservada
- Earth handoff sem hole
- FTL fora da física local
- BigInt testado
- star sectors bounded
- no fake DEM
- docs verdadeiras
