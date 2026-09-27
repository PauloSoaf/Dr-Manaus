# Bugs e riscos críticos

## P0-01 ManausProvider é apenas scaffolding

Arquivo:

```text
src/world/providers/ManausProvider.ts
```

Estado atual:

```ts
plan() {
  return [];
}

load() {
  return Promise.reject(new Error('ManausProvider.load not fully wired'));
}

activate() {
  throw new Error('ManausProvider.activate not fully wired');
}

deactivate() {}
dispose() {}
```

Mesmo assim ele é registrado em:

```text
src/game/Game.ts
```

Isso não significa que Manaus esteja usando o scheduler global.

Correção:

- ou terminar o provider
- ou retirar o registro até a integração estar pronta

Não manter provider fake registrado em produção.

## P0-02 Handoff da Terra ocorre cedo demais

Arquivo:

```text
src/world/providers/EarthProvider.ts
```

Mudança problemática:

```ts
minAltitudeM: 0
```

Com `fadeM = 10_000` e:

```ts
globe.visible = opacity > 0.01
```

o globo pode ficar visível aproximadamente a partir de 100 m.

Em `Game.ts`:

```ts
const localGround = !this.earth.globe.visible;
this.flatTerrain.visible = localGround;
```

Resultado potencial:

```text
subir ~100 m
-> globo fica visible
-> flatTerrain some
-> Manaus ainda não está integralmente migrada
```

Correção imediata:

```text
restaurar gate de 15 km
ou outro valor seguro
até a migração completa de Manaus
```

Não remover `coveredByCity()` antes de o overlap estar matematicamente resolvido.

## P0-03 Curvatura de Manaus é parcial e esférica

Arquivos alterados:

```text
src/world/realcity/buildingGeometry.ts
src/world/chunks/ChunkMeshes.ts
src/world/lod/HLODManager.ts
```

A implementação usa:

```text
R = 6378137
theta = distance / R
drop = R * (1 - cos(theta))
scale = sin(theta) / theta
```

Problemas:

- é uma dobra esférica
- não usa o elipsoide WGS84 já implementado
- não usa ECEF/ENU
- só afeta alguns renderables
- normals não são necessariamente rotacionadas com o mesmo frame
- física continua em outro espaço
- roads podem continuar planas
- água continua plana
- landmarks podem continuar planos
- Largo pode continuar plano
- aeroporto pode continuar plano
- traffic graph continua no sistema legado
- colliders não recebem necessariamente a mesma transformação

Correção:

curvar por tile/frame, não por hacks independentes em cada gerador.

## P0-04 FTL dentro da física local

Arquivos:

```text
src/player/flightConfig.ts
src/player/PlayerController.ts
```

Estado atual:

```ts
cosmic: 9.4607e18
```

Esse valor entra na mesma `Vector3 velocity` usada por:

```text
PhysicsWorld.move
CameraController
WorldStreamer
DestructionSystem
Traffic / actors
collision sweeps
local world position
```

Isso viola o princípio central:

```text
o universo lógico pode ser enorme
a cena e a física local não
```

Correção:

remover cosmic speed da física local.

Criar domínio de travel separado.

## P0-05 setor cósmico é recalculado sobre uma pose que é sobrescrita

Arquivo:

```text
src/world/runtime/UniverseRuntime.ts
```

No início de cada `update`:

```ts
playerPose.position = localPosition do PlayerController
```

Depois o runtime tenta normalizar a posição para outro setor.

No frame seguinte o `PlayerController.position` local entra de novo e sobrescreve essa normalização.

Correção:

o endereço cósmico deve ser autoridade para travel cósmico.

O `PlayerController` deve continuar sendo autoridade somente dentro do reference frame local.

## P0-06 sistema procedural substitui o Sistema Solar real

Arquivos:

```text
src/world/runtime/UniverseRuntime.ts
src/world/celestial/SolarSystem.ts
```

Ao mudar de setor:

```ts
solarSystem.setSystemBodies(system.bodies)
```

Isso substitui:

```text
Sun
Mercury
Venus
Earth
Moon
Mars
...
```

por corpos procedurais.

Outras partes continuam esperando IDs como:

```text
earth
sun
```

Correção:

não mutar `SolarSystem` para representar sistemas arbitrários.

Criar:

```text
CelestialSystemRuntime
SolarSystemCatalogEntry
ProceduralSystemRuntime
```

e trocar o sistema ativo por referência, sem destruir a definição do sistema solar.

## P1-01 velocidade interplanetária inconsistente

Arquivo:

```text
src/player/flightConfig.ts
```

Comentário:

```text
55 556 m/s
```

Código:

```ts
1_155_556
```

O código é aproximadamente 20,8 vezes maior que o valor documentado.

Decidir explicitamente qual velocidade é desejada.

Se a intenção for 200.000 km/h:

```text
200000 / 3.6 = 55.555,56 m/s
```

## P1-02 Earth terrain usa noise aleatório por tile

Arquivo:

```text
src/world/planet/EarthGlobe.ts
```

Estado atual:

```ts
const noise = new SimplexNoise();
```

Problemas:

- o `SimplexNoise` usa random por padrão
- a instância nasce dentro de `buildTileMesh`
- cada tile pode usar uma permutation table diferente
- dois tiles vizinhos podem discordar na borda
- o planeta deixa de ser determinístico
- não representa o relevo real da Terra
- custo de criação desnecessário por tile

Correção:

remover esse noise do Earth base.

Usar DEM real.

## P1-03 UniverseRenderer foge do scheduler

Arquivo:

```text
src/world/celestial/UniverseRenderer.ts
```

Problemas:

- carrega 27 setores diretamente
- não possui eviction
- não usa `GlobalStreamingScheduler`
- não usa `TileCache`
- não respeita budget
- meshes acumulam
- não há dispose por setor
- `frustumCulled = false`
- carrega até 1000 estrelas por setor
- não há HLOD galáctico

Correção:

star sectors devem ser `WorldProvider` ou serviço equivalente governado pelo scheduler.

## P1-04 UniverseRenderer calcula setor usando a posição local errada

Ele usa:

```text
runtime.player.position
```

Mas a fonte correta em travel interestelar é:

```text
runtime.address.sector
+
offset local canônico
```

## P1-05 sectorIndex destrói a vantagem do bigint

Arquivo:

```text
src/world/spatial/UniverseAddress.ts
```

Problema:

```ts
BigInt(Math.trunc(Number(x)))
```

Se `x` já é bigint gigante:

```text
bigint
-> Number
-> perde bits
-> bigint
```

Correção conceitual:

```ts
function toBigInt(value: bigint | number): bigint {
  if (typeof value === 'bigint') return value;
  if (!Number.isSafeInteger(value)) throw new RangeError(...);
  return BigInt(value);
}
```

## P1-06 planetas procedurais não possuem órbitas reais no runtime

Arquivo:

```text
src/world/celestial/SystemGenerator.ts
```

`currentOrbitM` é calculado mas não é persistido no `CelestialBody`.

O `OfflineEphemeris` não conhece IDs procedurais.

Resultado:

corpos procedurais podem acabar resolvidos em `[0,0,0]`.

Correção:

gerar elementos orbitais determinísticos e usar um ephemeris procedural.

## P1-07 sceneScale está incompleto

`CameraController.update()` aceita `sceneScale`, mas `Game.ts` continua chamando sem ele.

Além disso, escalar `camera.near` diretamente junto com a cena não deve ser feito sem medir estabilidade de depth e clipping.

Não usar `sceneScale` como remendo para substituir reference frames.

## P1-08 persistência não fecha o contrato

Arquivo:

```text
src/world/persistence/WorldMutationStore.ts
```

Hoje salva basicamente:

```text
craters por bodyId
discoveries
```

Faltam:

- stable object IDs
- destroyed buildings
- reconstruction
- tile ownership
- generator version
- schema version
- migration
- world seed
- mutation coordinates
- body / system / sector address
- eviction
- quota handling
- IndexedDB
- async persistence
- corruption handling

## P2-01 arquivos mortos/inacabados

```text
src/rendering/CurveManaus.ts
```

arquivo vazio.

```text
src/rendering/curveMaterial.ts
```

parece tentativa alternativa não integrada.

Decidir:

- remover
- ou transformar em implementação oficial testada

Não deixar duas estratégias de curvatura concorrentes.

## P2-02 documentação está mais otimista que o código

`docs/world/15-status.md` marca:

```text
Curve Manaus: done
ManausProvider: done
```

Isso deve voltar para `partial` até passar os critérios deste pacote.
