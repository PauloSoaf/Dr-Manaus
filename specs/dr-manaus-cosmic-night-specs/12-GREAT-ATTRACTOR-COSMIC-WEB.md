# Grande Atrator e cosmic web

## Conceito correto

O Grande Atrator não é:

```text
um planeta
um super buraco negro
um ponto singular exato
```

É uma região de concentração de massa e fluxo peculiar de galáxias, associada à large-scale structure na direção do Norma Cluster.

## Real anchor

Modelar:

```text
Great Attractor region
Norma Cluster anchor
```

e não `GreatAttractorBlackHole`.

## LargeScaleStructureProvider

Escala:

```text
Mpc
```

Cada cosmic cell guarda:

```text
density
filament direction
void factor
cluster candidates
```

## Real + procedural

Real anchors substituem procedural data quando conhecidos.

Primeiros anchors:

```text
Local Group
Virgo region
Norma Cluster / Great Attractor
selected nearby clusters
```

## Visual

Muito longe:

```text
density field / cosmic web
```

Aproximando:

```text
clusters materialize
-> galaxies
-> galaxy interiors
```

## Gravity / flow

Não aplicar uma aceleração absurda no PlayerController.

No cosmological domain, o mass field pode influenciar:

- flow vector;
- trajectory prediction;
- galaxy velocities;
- navigation.

## Performance

- sparse cells;
- octree;
- 3D density texture/analytic field;
- instanced clusters;
- no millions of galaxy objects.
