# Roadmap de hardening

## Sprint H0 Snapshot e proteção

Objetivo:

não piorar a cidade enquanto a arquitetura é corrigida.

Tasks:

1. registrar baseline visual
2. restaurar Earth handoff seguro
3. remover fake terrain noise
4. corrigir interplanetary constant
5. desligar cosmic local physics
6. corrigir status docs
7. remover arquivos mortos óbvios

Gate:

```text
Manaus igual ou melhor que antes
build verde
unit tests verdes
```

## Sprint H1 Manaus surface frames

1. criar `SurfaceTileFrame`
2. mapear tile legacy -> geodetic -> ECEF -> ENU
3. aplicar transform por tile
4. buildings
5. roads
6. water
7. landmarks
8. colliders
9. traffic
10. destruction

Gate:

```text
render e collider coincidem
landmarks preservados
sem seam perceptível
```

## Sprint H2 Global scheduler integration

1. decidir adapter migration
2. terminar `ManausProvider`
3. compartilhar budget
4. teleports
5. cancellation
6. eviction
7. telemetry

Gate:

```text
nenhum subsystem de Manaus ignora budget global relevante
```

## Sprint H3 Earth terrain real

1. DEM preprocessing
2. elevation provider
3. tile sampling
4. skirts/edges
5. cache
6. performance

Gate:

```text
adjacent edges match
same input deterministic
global terrain recognizable
```

## Sprint H4 Planet atmosphere/ocean

1. atmosphere outside limb
2. atmosphere inside sky
3. ocean
4. day/night
5. transition
6. quality presets

## Sprint H5 Travel domain

1. `TravelDomain`
2. local
3. interplanetary
4. handoff
5. Moon vertical slice
6. return Earth
7. remove altitude ceiling only after successful handoff

Vertical slice:

```text
Teatro
-> órbita
-> Lua
-> órbita
-> Teatro
```

## Sprint H6 Cosmic addressing

1. fix bigint
2. sector offset
3. FTL controller
4. star sector scheduler
5. bounded renderer
6. active system transition

Vertical slice:

```text
Solar System
-> next sector
-> another generated star
-> return Solar System
```

## Sprint H7 Procedural systems

1. stable system IDs
2. orbital elements
3. procedural ephemeris
4. planets
5. moons
6. planet provider bootstrap

## Sprint H8 Persistence

1. IndexedDB
2. schema
3. stable IDs
4. per-tile mutations
5. return-to-Manaus persistence test

## Sprint H9 Hardening

1. profiling
2. memory leaks
3. long travel
4. repeated body handoffs
5. repeated sector transitions
6. save compatibility
7. WebGPU
8. WebGL fallback where supported
