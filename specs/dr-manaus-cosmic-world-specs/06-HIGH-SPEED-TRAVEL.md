# Alta velocidade e travel domains

## Separar velocidade de gameplay de deslocamento astronômico

A velocidade do jogador local e a velocidade de travel não devem ser o mesmo número.

## Modos propostos

```text
ground
normal
fast
super
mega
interplanetary
cosmic
```

Mas os três últimos não precisam compartilhar a mesma implementação.

## LocalFlightController

Responsável por:

```text
normal
fast
super
mega
```

Ainda usa:

- local physics
- collision sweep
- buildings
- terrain
- destruction

## InterplanetaryTravelController

Ativado somente depois de sair da região de física local.

Estado:

```ts
interface InterplanetaryState {
  systemId: string
  positionM: Vec3Float64
  velocityMps: Vec3Float64
  referenceBodyId?: string
}
```

Render:

```text
player bubble local
planetary/celestial bodies relative to camera
```

Física urbana desativada.

## CosmicTravelController

Estado:

```ts
interface CosmicTravelState {
  address: UniverseAddress
  offsetM: Vec3
  velocitySectorMps: Vec3
}
```

A posição deve ser normalizada continuamente:

```text
sector bigint
+
offset < sector size
```

## Entrada e saída

### Local -> interplanetário

Só mudar de domínio quando:

- altitude segura
- não houver collider local relevante
- frame target estiver preparado
- camera transition preparada

### Interplanetário -> local

Ao aproximar de um body:

- escolher body
- preparar planet provider
- criar body local frame
- reduzir velocidade de travel
- carregar destination terrain
- só então entregar ao `PlayerController`

## FTL

Não usar:

```ts
PlayerController.velocity = 9.4607e18
```

Usar progressão lógica por travel domain.

Mesmo que HUD mostre:

```text
1000 ly/s
```

isso não precisa virar uma velocidade física aplicada por frame em Three.js.

## Valor interplanetário

Se a intenção continuar sendo 200.000 km/h:

```text
55.555,56 m/s
```

Corrigir o valor atual.

## Colisão

### Local

continuous sweep.

### Planetary fast

coarse body collision / altitude envelope.

### Interplanetary

sphere / ellipsoid / SOI-level tests.

### Cosmic

sector/system navigation, sem colisão de prédios.

## Prefetch

A previsão muda por domínio:

```text
local:
seconds ahead

interplanetary:
body intercept / trajectory

cosmic:
next sectors and target system
```
