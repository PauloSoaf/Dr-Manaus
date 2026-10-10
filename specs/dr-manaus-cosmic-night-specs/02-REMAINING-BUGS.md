# Bugs e gaps restantes

## P0-01 TravelDomain ainda não controla o player

Em `Game.ts`:

```ts
updateTravelDomain(dt)
const local = travelDomain.localPhysicsActive
...
player.update(...)
```

`player.update()` ainda roda nos dois domínios.

Então no interplanetário:

- PlayerController ainda integra posição;
- a velocidade ainda mora na Vector3 local;
- câmera continua seguindo essa posição;
- TravelDomain mantém um segundo estado lógico paralelo.

Correção:

```text
LOCAL:
PlayerController é autoridade.

INTERPLANETARY:
InterplanetaryController / TravelDomain é autoridade.
PlayerController vira uma representação local perto da câmera.
```

## P0-02 Interplanetary speed ainda está no controller local

Atual:

```ts
FLIGHT.speeds.interplanetary = 222_222
```

Mesmo sem FTL, 222 km/s ainda é aplicado no mesmo controller que usa o mundo local.

Mover esse tier para o domínio interplanetário.

`PlayerController` deve controlar no máximo movimento compatível com local simulation.

## P0-03 SurfaceTileFrame está parcial

Config:

```ts
FEATURES.curvedManaus = false
```

Porém:

```text
RealCityLayer.ts
ChunkMeshes.ts
```

já usam `createSurfaceTileFrame()` incondicionalmente.

Enquanto isso:

```text
HLODManager
RoadNetwork
ground cover
WaterSystem
LargoDistrict
LandmarkManager
TrafficSystem
colliders
```

ainda operam majoritariamente no plano legado.

Isso cria divergência espacial.

## P0-04 Chão preto na transição

`EarthProvider` calcula:

```ts
opacity
```

mas essa opacidade não é propagada ao material.

A decisão real em `Game.ts` é booleana:

```ts
flatTerrain.visible = !earth.globe.visible
```

Ao mesmo tempo, com `cityOwnsGround=true`, tiles finos do globo dentro de Manaus são omitidos.

Portanto pode acontecer:

```text
flat terrain desaparece
+
planet tile abaixo de Manaus ainda não existe
=
buraco / preto
```

## P0-05 Roads podem divergir dos buildings

RealCity building tiles já têm matrix de SurfaceTileFrame.

RoadNetwork é carregado como group próprio e continua no espaço legado.

Prédio curvo + rua plana não pode ser estado final.

## P0-06 Render e collider podem divergir

Visual de building pode estar no tile frame.

Collider continua com `x/z` legado.

PhysicsWorld precisa receber collider convertido no mesmo active local frame usado pelo render.

## P1-01 StarSectorProvider usa address por cast informal

Hoje:

```ts
(context as { address?: ... }).address
```

Mas `SpatialContext` não contém `UniverseAddress` oficialmente.

Adicionar ao contrato.

## P1-02 StarSectorProvider converte setor absoluto em Number durante activate

Evitar:

```ts
Number(content.sector.x) * SECTOR_SIZE_M
```

Posicionar sempre por:

```text
sector - currentCentreSector
```

em BigInt e só converter a diferença pequena para Number.

## P1-03 SolarSystem mantém API mutável antiga

Remover ou deprecar:

```text
dynamicBodies
setSystemBodies()
```

quando os consumidores novos estiverem migrados.

## P1-04 ETOPO atual é low LOD

512x256 é adequado ao globo visto de longe.

Não é terrain suficiente para:

```text
15 km
5 km
1 km
pouso
```

Adicionar hierarchy de elevation data.

## P1-05 status docs estão desatualizados

`docs/world/15-status.md` ainda menciona browser smoke falhando e, em outra seção, diz que não há terrain, embora commits posteriores indiquem o contrário.

Reexecutar e atualizar fatos.

## P1-06 sem CI publicado

O HEAD atual não possui workflow/status checks disponíveis via GitHub.

Não é bug do código, mas reduz confiança no merge.

## P1-07 atmosphere gap

O sky dome local de 44 km simplesmente deixa de aparecer quando `planetaryView=true`.

O shell planetário não substitui totalmente o sky visto dentro da alta atmosfera.

## P1-08 Earth surface ainda é simplificada

A land mask já distingue terra e água.

Mas falta:

- oceano com Fresnel/specular;
- urban overlay de Manaus visto de altitude;
- ice mask real;
- vegetação regional near-surface;
- transition contínua.
