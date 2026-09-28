# Melhorias diretamente relacionadas

Estas mudanças não são novos sistemas. São hardening necessário para não deixar o bug voltar.

## P0-A Pausar sistemas locais no espaço

Em `Game.tick`, quando:

```ts
local === false
```

não continuar atualizando por frame:

```text
WorldStreamer
HLODManager
LargoDistrict
TrafficSystem
PopulationManager
terrain destruction
ForestBackdrop
district lookup
landmark discovery
```

O scheduler planetário/cósmico continua.

Manaus deve ficar congelada ou desacoplada até o retorno.

## P0-B Atmosphere/SpaceLayer não podem usar `player.position.y` no interplanetário

Hoje o proxy local pode continuar com uma altitude antiga.

Usar:

```text
local ? player.position.y : universe.telemetry.altitudeM
```

para sistemas cuja entrada semântica seja altitude.

Melhor ainda: cada render domain recebe altitude do frame que representa.

## P0-C HUD precisa distinguir velocidades

Mostrar duas grandezas quando útil:

```text
Velocidade relativa ao corpo
Velocidade baricêntrica
```

Para pilotagem, destacar a relativa ao corpo.

Não mostrar zero simplesmente porque o proxy visual está parado.

## P0-D Actor suppression no espaço

Se o domínio é interplanetário:

```text
NPC count = 0
traffic count = 0
```

Não reativar atores porque `player.velocity` visual foi zerada.

## P0-E `UniverseRuntime.playerEcef()` precisa ser frame-aware

Hoje o caminho legado ainda pode ser usado com posição que não é de Manaus.

Regra:

```text
MANAUS_FRAME_ID -> legacyLocalToEcef
EARTH_FIXED -> usar diretamente
outro frame -> frames.convertPosition(frame, EARTH_FIXED)
```

Isso vale para:

```text
quadtree selection
telemetry
Earth provider planning
```

## P1-A EarthProvider não deve passar pelo frame legado sem necessidade

`EarthProvider.playerEcef()` deve fazer conversão direta para `earth/fixed`.

Evitar:

```text
barycentric -> Manaus local -> legacy geodetic -> ECEF
```

O adaptador de Manaus existe para assets compilados de Manaus, não para o Sistema Solar.

## P1-B Render de provider deve ser floating-origin-relative

Auditar:

```text
EarthProvider.toSceneMetres
MoonProvider.setCentre
GalaxyProvider
BlackHoleProvider
LargeScaleStructureProvider
```

Nenhum `Mesh.position` final deve receber coordenadas astronômicas absolutas em Float32.

Contrato:

```text
logical position: Float64/reference frame
render position: logical - active render origin
```

Ao rebasear:

```text
a posição lógica não muda
a posição de tela não dá salto
```

## P1-C Evitar duas origens independentes governando o mesmo frame

Atualmente existem:

```text
Game.origin
UniverseRuntime.floatingOrigin
```

No domínio local isso é aceitável durante migração.

No domínio interplanetário, `Game.origin` não deve tentar rebasing de uma posição que já é apenas proxy visual.

Regra:

```text
local domain -> Game.origin governa worldRoot
interplanetary -> universe floating origin governa providers cósmicos
```

Não aplicar os dois ao mesmo objeto.

## P1-D Documentação de status

Depois do patch, atualizar `docs/world/15-status.md`.

Registrar explicitamente:

```text
TravelDomain: implemented, but only mark verified after browser scenario
Curved Manaus: still partial/off
Terrain destruction: flat-domain stable
Interplanetary reentry: regression-tested
```

Não marcar como concluído só porque os arquivos existem.
