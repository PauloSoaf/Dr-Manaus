# Testes e acceptance

## Primeiro

Reexecutar e corrigir `docs/world/15-status.md`.

Não confiar apenas no texto antigo nem no commit message.

## Earth classification

Tests:

```text
Amazon coordinate -> Land
Atlantic -> Ocean
Antarctica -> Ice
Manaus -> Urban
```

## Earth transition

Checkpoints:

```text
0
5
10
15
20
30
50
80
120
400 km
```

Daytime nadir screenshots.

Assert:

- no black/missing ground;
- no abrupt representation gap;
- no duplicate planet patch.

## Manaus curved

Em tile distante:

```text
building
road
ground
collider
traffic
```

coincidem.

## Travel

Interplanetary:

- PlayerController position remains bounded;
- InterplanetaryController logical state advances;
- releasing thrust preserves velocity;
- urban physics disabled;
- body gravity works.

## Gravity

For point-mass range:

```text
a(2r) ~ a(r)/4
```

## Solar vertical slice

```text
Earth -> Moon -> Moon surface -> Earth
```

## Galaxy

- deterministic sector;
- max resident enforced;
- BigInt exact;
- no absolute BigInt -> Number render placement;
- eviction frees geometry.

## Andromeda

Manifest distance around 2.5M ly.

## Black hole

- Schwarzschild radius;
- gravity;
- horizon;
- lens threshold;
- max full lens count = 1.

## Cosmology

No Float32 scene coordinate receives Mpc/Gpc magnitude.

## Long session

Route:

```text
Manaus
-> Moon
-> Mars
-> outer Solar System
-> Milky Way sector
-> external Milky Way
-> M31 approach
-> Great Attractor scale
-> horizon representation
-> return
```

Monitor memory and residency.

## Merge blockers

No merge while:

- ground-black transition exists;
- render/collider frames diverge;
- TravelDomain has duplicate authority;
- galaxy address is fallback-only;
- Moon handoff is not functional.
