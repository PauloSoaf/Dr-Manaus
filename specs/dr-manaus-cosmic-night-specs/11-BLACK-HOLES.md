# Buracos negros funcionais

## Requisitos

Um black hole precisa ter:

- mass;
- gravity;
- event horizon;
- visible shadow;
- gravitational lensing;
- accretion disk optional;
- photon-ring approximation;
- gameplay boundary;
- bounded performance cost.

## Schwarzschild radius

Baseline não rotativo:

```text
r_s = 2GM / c²
```

## BlackHoleDefinition

```ts
interface BlackHoleDefinition {
  id: string
  massKg: number
  spin01: number
  address: CosmicAddress
  accretion?: {
    innerRadiusRs: number
    outerRadiusRs: number
    temperatureK: number
    luminosity: number
  }
}
```

## Gravity

Longe:

```text
Newtonian GM/r²
```

Perto:

pode adicionar uma gameplay approximation.

Não resolver equações de Einstein completas por frame.

## Event horizon

É boundary lógica.

Ao cruzar em physical mode:

- trajetória normal não escapa;
- lensing/distortion aumenta;
- regras de gameplay ficam explícitas.

Se o protagonista puder sobreviver/escapar por ficção, isso deve ser uma feature de poderes, não uma consequência de um bug.

## Rendering LOD

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
TSL lensing
accretion disk
```

## Lensing

Não raytrace o universo inteiro.

Pipeline:

```text
render background/scene
-> projected black hole centre
-> screen-space angular deflection
-> sample distorted background
```

Somente o BH mais relevante usa full lens.

## Accretion disk

Annular mesh.

TSL:

- radial heat gradient;
- rotation;
- approaching side brighter;
- receding side dimmer;
- bent visual via lensing.

## Photon ring

Approximation shader.

Não meshes infinitos.

## First real target

Sagittarius A*.

Depois:

- M31 central SMBH;
- rare procedural stellar black holes.

## Performance

```text
full lensing BH: max 1
mid-detail BH: <= 4
far BH: points/impostors
```

Quality tiers:

```text
Low: no full lens
Medium: simplified lens
High: lens + disk
Ultra: higher sample quality
```

## Tests

- Schwarzschild formula;
- gravity ~1/r² far away;
- event horizon state transition;
- lens turns off beyond threshold;
- only one full-screen lens active.
