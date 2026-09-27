# Prompt específico: cosmos

Use somente após Earth acceptance.

## C1 Travel authority

Criar `InterplanetaryController`.

`PlayerController` continua local-only.

Adicionar zero-g inertia + GravityField.

## C2 Sistema Solar

Usar infraestrutura existente.

Implementar Moon landing primeiro.

Depois Mars e demais major bodies.

## C3 Galaxy subsystem

Criar:

```text
GalaxyDefinition
GalaxyDensityField
GalaxyProvider
LocalGroupCatalog
```

## C4 Milky Way

Modelar:

- ~100k ly diameter;
- Sun ~26k ly from centre;
- central bar;
- spiral modulation;
- dust;
- Sgr A*.

## C5 StarSector integration

Adicionar `UniverseAddress` oficialmente ao streaming context.

Remover cast hack.

Nunca transformar BigInt absoluto gigante em Number.

## C6 Andromeda

M31 ~2.5M ly.

Reusar GalaxyProvider.

## C7 Local Group

Milky Way, M31, M33, satellites selected.

## C8 Large scale

Cosmic web + Great Attractor region.

## C9 Horizon

CosmologyDomain + observable horizon.

## Performance

Never generate:

```text
all stars
all systems
all galaxies
```

Only current representation and nearby demand.

Hard caps required at every level.
