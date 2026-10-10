# Transição contínua da Terra e correção do chão preto

## Sintoma

Hoje pode ocorrer:

```text
Manaus
-> sobe
-> superfície some / preto
-> planeta aparece depois
```

Isso é P0 visual.

## Causa

Em `Game.ts`:

```ts
const localGround = !earth.globe.visible
flatTerrain.visible = localGround
```

Isso é um switch binário.

`EarthProvider.opacity` existe, mas não controla o material.

Também há `cityOwnsGround`, que pode omitir tiles finos sob Manaus.

## EarthTransitionController

Criar:

```ts
interface EarthTransitionState {
  localWeight: number
  regionalWeight: number
  planetWeight: number
  atmosphereWeight: number
  targetCoverageReady: boolean
}
```

## Regra fundamental

Nunca:

```text
desligar representação atual
e depois esperar a nova carregar
```

Sempre:

```text
request next representation
-> wait until active/ready
-> overlap/crossfade
-> retire previous
```

## Bandas iniciais

Ajustar visualmente, mas ponto de partida:

```text
0 - 8 km:
local 1.0

8 - 20 km:
local -> regional

20 - 60 km:
regional -> planet

60 km+:
planet 1.0
```

## ManausRegionalProxy

Criar HLOD curvo barato para altitude intermediária:

- WGS84 patch;
- green forest;
- Rio Negro/Solimões blue;
- urban Manaus footprint;
- major city silhouette;
- optional major roads.

Não precisa de building individual.

## Readiness

Adicionar:

```ts
EarthProvider.isCoverageReady(position, requiredLod)
```

O blend não avança além do peso seguro se os tiles target não estiverem ativos.

## Atmosphere

Adicionar transition contínua:

```text
blue sky
-> deep blue
-> navy
-> black vacuum
```

A atmosphere local não pode simplesmente desaparecer.

## Crossfade

Evitar z-fighting de duas superfícies quase coplanares.

Preferir:

- dithered transition;
- alpha hash;
- LOD morph;
- slight depth-separated representation.

## Browser test

Capturar:

```text
100 m
1 km
5 km
10 km
15 km
20 km
30 km
50 km
80 km
120 km
400 km
```

Olhando para baixo no lado diurno:

- nenhum frame majoritariamente preto;
- nenhuma região vazia sob Manaus;
- nenhum planeta aparecendo instantaneamente.

## Acceptance

Voo vertical:

```text
Teatro -> 400 km
```

deve ser um único movimento contínuo.
