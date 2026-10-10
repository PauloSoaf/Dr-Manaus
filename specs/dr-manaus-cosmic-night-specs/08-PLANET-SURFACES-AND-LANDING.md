# Superfícies de outros planetas

## Uma arquitetura, muitos planetas

Não criar engines separados.

Criar:

```text
PlanetSurfaceProvider
PlanetMaterialProfile
PlanetAtmosphereProfile
PlanetTerrainProvider
```

## Real bodies

Quando dados pequenos/públicos existirem:

- radius real;
- macro albedo real;
- elevation real quando viável.

## Procedural worlds

Tipos:

```text
rocky
icy
desert
oceanic
volcanic
gas giant
```

## Procedural terrain

Permitido em planetas fictícios.

Regras:

- deterministic;
- continuous body coordinates;
- no per-tile independent random;
- hierarchical octaves;
- stable generatorVersion.

## LOD

Orbit:

```text
cheap sphere/quadtree
```

Approach:

```text
SSE quadtree
```

Ground:

```text
local terrain chunks + collision
```

## Handoff

```text
celestial
-> planet
-> surface
-> local frame
```

Previous representation remains until next is ready.

## Performance

Somente um planet surface em high detail por vez.

Todos os outros corpos ficam em cheap celestial/planet LOD.

## Mutations

Salvar deltas por planetary tile.

Nunca salvar mesh inteiro.
