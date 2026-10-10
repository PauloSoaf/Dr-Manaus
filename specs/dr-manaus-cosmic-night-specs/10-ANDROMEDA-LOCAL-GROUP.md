# Andrômeda e Local Group

## Anchor

M31 está aproximadamente 2,5 milhões de anos-luz da Via Láctea.

## LocalGroupCatalog

Dataset pequeno:

```text
Milky Way
Andromeda M31
Triangulum M33
Large Magellanic Cloud
Small Magellanic Cloud
M32
M110
selected dwarfs
```

## Reusar GalaxyDefinition

Não criar um `AndromedaEngine`.

M31 usa o mesmo pipeline:

```text
GalaxyDefinition
GalaxyDensityField
GalaxyProvider
StarSectorProvider
```

com:

- outra escala;
- orientação;
- seed;
- density field.

## LOD

Muito longe:

```text
impostor
```

Aproximação:

```text
galaxy volume
```

Dentro:

```text
M31 density + star sectors
```

## Satellites

M32/M110 começam como impostors.

Só materializar interior ao aproximar.

## Central black hole

Usar BlackHole subsystem.

Valores físicos devem vir de manifest catalogado, não constantes inventadas.

## Handoff entre galáxias

Saindo da Via Láctea:

```text
local sectors fade
Milky Way external representation appears
Local Group representation dominates
```

Entrando em M31:

processo inverso.

## Performance

Somente a galáxia atual pode ter local star sectors.

Galáxias externas permanecem LOD macro.
