# Hotfix P0 - voo interplanetário

## Resultado esperado

Depois deste patch:

```text
double tap V
-> interplanetary armado

B acima da altitude de entrada
-> entra uma única vez no domínio interplanetário

soltar B
-> para o thrust e continua em inércia

rebase do floating origin
-> não move visualmente o personagem nem a câmera

aproximar-se novamente da Terra
-> só retorna ao domínio local quando altitude e velocidade forem seguras
```

Não pode existir alternância `local -> interplanetary -> local -> interplanetary` sem uma causa física real.

---

## 1. UniverseRuntime: tornar geodesia dependente do frame

Arquivos:

```text
src/world/runtime/UniverseRuntime.ts
src/world/spatial/*
```

### Regra

Nunca executar:

```text
legacyLocalToGeodetic()
legacyLocalToEcef()
```

sobre uma posição cujo frame não seja `MANAUS_FRAME_ID`.

### `playerEcef()`

Implementar lógica equivalente a:

```ts
playerEcef() {
  if (this.playerPose.frame === MANAUS_FRAME_ID) {
    return legacyLocalToEcef(
      this.playerPose.position[0],
      this.playerPose.position[1],
      this.playerPose.position[2],
    );
  }

  const ecef = this.frames.convertPosition(
    this.playerPose.frame,
    EARTH_FIXED_FRAME_ID,
    this.playerPose.position,
  );

  return {
    xM: ecef[0],
    yM: ecef[1],
    zM: ecef[2],
  };
}
```

### `playerGeodetic()`

Mesmo princípio:

```ts
if frame === MANAUS_FRAME_ID:
    legacyLocalToGeodetic()

senão:
    current frame -> earth/fixed
    ECEF -> geodetic
```

Não usar o adaptador legado para posições baricêntricas.

---

## 2. Centralizar resolução de corpo dominante

Hoje `spatialContext()` e `telemetry` implementam lógicas diferentes.

Criar um helper interno, por exemplo:

```ts
resolveBodyContext()
```

retornando:

```ts
{
  systemPositionM,
  dominantBody,
  bodyPositionM,
  bodyVelocityMps,
  altitudeM
}
```

### Para frame baricêntrico

Calcular:

```text
player system position
distance to each body
dominantBody = menor distância
altitude = distanceToBodyCentre - bodyRadius
```

Para a Terra perto da superfície, quando houver conversão válida para `earth/fixed`, preferir altitude geodésica WGS84.

### Invariante

`telemetry.altitudeM` e `SpatialContext.altitudeM` precisam vir da mesma resolução.

Nunca manter duas fórmulas independentes.

---

## 3. TravelDomain: `requested` só entra, não mantém o domínio

Arquivo:

```text
src/world/travel/TravelDomain.ts
```

Hoje:

```ts
if (!context.requested) {
  return local;
}
```

Remover esse comportamento.

### Semântica nova

`requested` significa:

```text
quero iniciar travel interplanetário
```

Depois que o domínio já é interplanetário:

```text
soltar o botão = thrust zero / coasting
```

### Histerese

Sugestão inicial:

```text
entryAltitudeM  = 9_000
returnAltitudeM = 7_000
```

Não usar a mesma fronteira para entrada e saída.

### Velocidade de handoff

A física local atual consegue lidar com mega flight de aproximadamente 8 km/s.

Usar uma margem explícita, por exemplo:

```text
maxLocalReturnSpeedMps = 10_000
```

Retornar ao domínio local somente quando:

```text
altitude <= returnAltitudeM
AND
relativeSpeedToBody <= maxLocalReturnSpeedMps
```

Se o personagem está a 100.000 km da Terra e solta B:

```text
fica interplanetary
fica em coasting
não teleporta
```

---

## 4. InterplanetaryController: controlar velocidade relativa ao corpo

Arquivo:

```text
src/world/travel/InterplanetaryController.ts
```

Adicionar no contexto:

```ts
bodyVelocityMps?: Vec3
envelopeMarginM?: number
maxRelativeSpeedMps?: number
```

### Passo correto

```ts
relative = playerVelocity - bodyVelocity

apply thrust(relative)
apply brake(relative)
clamp relative speed

playerVelocity = bodyVelocity + relative

position += playerVelocity * dt
```

### Freio

O freio nunca deve apagar a velocidade orbital do corpo.

Teste obrigatório:

```text
player tem exatamente a mesma velocidade baricêntrica da Terra
relative speed = 0

freio pressionado
-> velocidade baricêntrica final continua aproximadamente igual à velocidade da Terra
```

### Limite

Não deixar o integrador acelerar indefinidamente.

Usar como limite inicial:

```text
222_222 m/s
```

ou a fonte de verdade definida para a velocidade interplanetária.

Evitar constante duplicada.

---

## 5. Remover envelope hardcoded de 14 km

Hoje existe:

```ts
bodyRadius + 14000
```

Isso conflita com a intenção de devolver o jogador ao domínio local em altitude inferior.

Mover para configuração/contexto.

Sugestão:

```text
envelopeMarginM = 1_000
```

O envelope é uma proteção para não atravessar o corpo, não o ponto de handoff de domínio.

---

## 6. Game: intenção vem do input real

Arquivo:

```text
src/game/Game.ts
```

Não usar:

```ts
this.player.speedMode === 'interplanetary'
```

como fonte de verdade de `requested`.

Usar intenção atual:

```ts
const requested =
  this.player.interplanetaryMode
  && this.input.held('KeyB');
```

Isso evita depender de `speedMode` congelado quando `PlayerController.update()` está pausado.

---

## 7. Game: não mover o proxy do player a cada rebase

Remover o comportamento:

```ts
const local = floatingOrigin.toRenderLocal(...)
player.position.set(...)
```

a cada frame interplanetário.

O `PlayerController.position` durante travel deve ser um proxy visual estável.

Opção mínima:

```text
ao sair do domínio local:
guardar uma renderAnchor
manter o personagem nessa âncora
mover universo/planetas relativamente à câmera
```

O rebase muda a origem lógica do mundo, não a posição aparente do personagem.

Se o renderer precisar de offset, aplicar nos providers/roots, não no player visual.

---

## 8. Game: thrust alinhado à câmera

O thrust atual reconstrói direção usando yaw/pitch com rotações globais.

Em travel, usar os vetores reais da câmera:

```text
cameraForward
cameraRight
cameraUp
```

Sugestão:

```ts
forward = camera.getWorldDirection(...)
right = forward x worldUp
up = right x forward
```

Entradas:

```text
W/S -> forward/back
A/D -> strafe
Space/Ctrl -> vertical
```

Se B estiver pressionado e nenhuma tecla direcional estiver pressionada:

```text
usar forward
```

Isso mantém a semântica que o boost local já possui.

---

## 9. Game: velocidade visual correta

Hoje o código zera:

```ts
player.velocity
```

no espaço.

Depois usa essa mesma velocidade para:

```text
SpeedVFX
shake
HUD
actor suppression
```

Criar um helper:

```text
currentGameplaySpeedMps()
```

No local:

```text
player.velocity.length()
```

No interplanetário:

```text
|travelVelocity - dominantBodyVelocity|
```

Usar essa velocidade para:

```text
HUD
VFX
FOV
debug
```

Não usar a velocidade baricêntrica absoluta para HUD de pilotagem.

---

## 10. Handoff de retorno

Ao retornar:

```text
UniverseRuntime.handoffTo(body)
player.teleport(localPosition)
```

Usar `teleport()` completo, não apenas `position.set()`.

Isso reseta:

```text
grounded state
dodge
impact
slam
velocity
titan support
```

Se for preservar velocidade de reentrada, convertê-la explicitamente de:

```text
system/barycentric relative velocity
-> target local frame direction
```

e só então reatribuir no `PlayerController`.

Não transportar velocidade de um frame para outro sem conversão.
