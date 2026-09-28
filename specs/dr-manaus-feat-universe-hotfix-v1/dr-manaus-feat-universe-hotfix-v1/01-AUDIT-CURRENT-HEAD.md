# Auditoria do HEAD atual

## Base

```text
feat/universe-map
14c726803cf9028137f845e73a948d63f8cbc2f9
```

A branch está 40 commits à frente da `main` auditada anteriormente.

## 1. Loop de domínio interplanetário

Fluxo atual em `Game.tick`:

```text
updateTravelDomain()
-> TravelDomain pode mudar para interplanetary
-> PlayerController deixa de atualizar
-> InterplanetaryController passa a ser a autoridade
-> UniverseRuntime.updateSystemPose()
-> no frame seguinte updateTravelDomain() consulta UniverseRuntime.telemetry
```

O problema está na telemetria.

Em `UniverseRuntime.telemetry`, o código começa obtendo:

```ts
const geodetic = this.playerGeodetic();
```

`playerGeodetic()` chama a projeção legada de Manaus.

Quando o frame do jogador já é:

```text
solar-system/barycentric
```

as coordenadas do sistema solar são interpretadas como:

```text
x/y/z locais de Manaus
```

Depois o código encontra corretamente o `dominantBody`.

Porém, quando esse corpo é a Terra, `altitudeM` continua vindo do `geodetic.heightM` calculado pelo caminho errado.

Consequência:

```text
interplanetary
-> altitude falsa
-> TravelDomain entende que voltou para baixo do limite
-> returned
-> handoffTo('earth')
-> Player volta para local
-> input/tier continua pedindo interplanetary
-> departed
-> repete
```

Esse comportamento é compatível com o relato de teleporte repetido e perda de controle.

## 2. `requested` está ligado ao estado errado

`Game.updateTravelDomain()` usa:

```ts
requested: this.player.speedMode === 'interplanetary'
```

Mas `PlayerController.update()` não executa enquanto:

```ts
travelDomain.localPhysicsActive === false
```

Logo `speedMode` vira estado visual antigo, não intenção atual do usuário.

A intenção correta é derivada de:

```text
player.interplanetaryMode
+
boost realmente pressionado
```

Não de um `speedMode` congelado.

## 3. Soltar boost não pode causar handoff imediato

Hoje `TravelDomain.considerReturning()` faz:

```ts
if (!context.requested) {
  this.toLocal();
  return { kind: 'returned', reason: 'released' };
}
```

Isso é conceitualmente errado para voo interplanetário.

No espaço:

```text
soltar thrust = coasting
```

não:

```text
soltar thrust = voltar para a física local
```

Esse comportamento sozinho já pode causar saltos bruscos de frame.

O domínio interplanetário só deve entregar o jogador ao domínio local quando ele estiver realmente dentro de uma região segura de reentrada e com velocidade relativa ao corpo compatível com a física local.

## 4. Velocidade absoluta do sistema solar é confundida com velocidade do jogador

`InterplanetaryState.velocityMps` está no frame baricêntrico.

A Terra possui velocidade orbital no frame do sistema.

Hoje o freio atua em:

```text
velocidade baricêntrica completa
```

Isso significa que frear o personagem pode remover também a velocidade que ele deveria compartilhar com a Terra.

O correto é controlar:

```text
relativeVelocity = playerBarycentricVelocity - bodyBarycentricVelocity
```

Thrust, brake, limites e reentrada devem usar essa velocidade relativa.

## 5. Proxy visual sofre com rebase

Durante o modo interplanetário:

```ts
const local = this.universe.floatingOrigin.toRenderLocal(this.universe.player.position);
this.player.position.set(local[0], local[1], local[2]);
```

Quando `FloatingOrigin3D` rebasa, `local` muda abruptamente.

A posição lógica não mudou, mas a posição do proxy do personagem mudou.

A câmera segue o `PlayerController.position`, portanto vê um salto que pode ter centenas ou milhares de metros.

O proxy visual precisa ficar estável em torno da câmera. Rebase é responsabilidade do mundo renderizado, não do personagem local.

## 6. Sistemas de Manaus continuam rodando fora de Manaus

Mesmo com `local === false`, o loop ainda chama trechos como:

```text
WorldStreamer.update
HLODManager.update
LargoDistrict.update
discovery sweep
alguns cálculos de áudio/localização
```

Isso desperdiça CPU e mantém lógica local viva durante travel interplanetário.

## 7. Curvatura parcial ativa mesmo com feature flag desligada

Em `src/core/config.ts`:

```ts
curvedManaus: false
```

Porém `src/world/geodata/terrain.ts` chama `SurfaceFrameService` diretamente para:

```text
groundCover
terrain-backdrop
shore polygons
roads
road markings
```

sem verificar a flag.

Isso viola o contrato da própria feature flag.

## 8. Sistema de crateras continua plano

`TerrainDestruction` continua estruturado em:

```text
x/z legado
heightfield plano
bowl em Y local
mask baseado em positionWorld + origin
```

A curvatura parcial do terreno faz render e deformação usarem frames diferentes.

Além disso, o mask só considera uma superfície recortável quando:

```ts
surfaceMinY <= global.y <= surfaceMaxY
```

Se a curvatura move o chão inferior para fora dessa faixa, o plano verde deixa de ser descartado e aparece dentro do buraco.

## 9. EarthProvider ainda merece hardening

`EarthProvider.playerEcef()` converte qualquer frame para Manaus e só então usa o adaptador legado.

Para frames planetários ou baricêntricos, o caminho correto é:

```text
frame atual
-> earth/fixed
-> ECEF
```

sem passar pela projeção plana de Manaus.

Também deve ser verificado que posições enviadas ao renderer são camera-relative/floating-origin-relative antes de chegar a Float32.
