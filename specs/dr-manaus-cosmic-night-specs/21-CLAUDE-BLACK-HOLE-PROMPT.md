# Prompt específico: buracos negros

Implemente um subsystem reutilizável.

## Arquivos sugeridos

```text
src/world/gravity/GravitySource.ts
src/world/gravity/GravityField.ts
src/world/blackhole/BlackHoleDefinition.ts
src/world/blackhole/BlackHoleGravitySource.ts
src/rendering/blackhole/BlackHoleRenderer.ts
src/rendering/nodes/BlackHoleLensingNode.ts
src/rendering/blackhole/AccretionDisk.ts
tests/black-hole.test.ts
```

## Física

```text
r_s = 2GM/c²
```

Fora do horizon:

point-mass gravity is acceptable baseline.

Inside horizon:

normal physical escape disabled unless explicit fictional power rule.

## Visual tiers

Far:

```text
point
```

Mid:

```text
shadow + disk billboard
```

Near:

```text
TSL gravitational lens
accretion disk
```

## Lensing

Não fazer full GR ray tracing.

Use screen-space approximation:

```text
render background
-> project black hole centre
-> compute deflection based on angular impact parameter
-> sample displaced UV
```

At most one full lens active.

## Accretion

Annular mesh + TSL:

- radial heat;
- rotation;
- approaching side brighter;
- receding side dimmer;
- lens-bent appearance.

## First integration

Sagittarius A*.

Then M31 central SMBH.

Then rare procedural stellar black holes.

## Quality tiers

```text
Low: point/billboard
Medium: simplified lens
High: lens + disk
Ultra: enhanced lens sampling
```

Profile GPU cost before increasing quality.
