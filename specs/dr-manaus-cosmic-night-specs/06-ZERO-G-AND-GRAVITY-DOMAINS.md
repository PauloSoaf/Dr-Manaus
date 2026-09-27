# Zero-g e gravidade

## Gameplay desejado

No espaço longe de um corpo dominante:

```text
sem "baixo" global
sem queda para -Y
sem drag artificial
movimento inercial
```

Fisicamente a gravidade não é zero em todo o espaço.

No jogo, zero-g significa:

```text
aceleração gravitacional relevante abaixo do threshold de gameplay
```

## GravitySource

Criar:

```ts
interface GravitySource {
  id: string
  frameId: string
  mu: number
  collisionRadiusM: number
  influenceRadiusM: number

  accelerationAt(positionM: Vec3): Vec3
}
```

## Point-mass baseline

Para corpo suficientemente distante da superfície:

```text
a = -mu * r / |r|^3
```

## InterplanetaryController

Criar:

```text
src/world/travel/InterplanetaryController.ts
```

Responsável por:

- system position Float64;
- system velocity Float64;
- thrust;
- inertial drift;
- gravity;
- body interception;
- domain handoff.

`PlayerController` não integra system coordinates.

## Zero input

No espaço:

```text
soltar input
-> velocidade continua
```

Braking precisa ser uma ação/poder, não drag implícito.

## Rendering

Logical:

```text
position millions/billions km
```

Render:

```text
player and camera close to origin
bodies represented relatively
```

## Gravity source selection

Não calcular milhares de fontes.

Sistema Solar:

- Sun;
- nearest/dominant planet;
- nearest moon when relevant.

Procedural system idem.

## Near surface

Blend controladamente:

```text
celestial gravity
<->
gameplay local gravity
```

quando entrar no local surface domain.

## Orbit

Com velocidade tangencial adequada, deve ser possível qualitativamente orbitar.

Não precisa ser um simulador astrodinâmico de precisão NASA.

## Tests

- no source -> velocity preserved;
- Earth acceleration points inward;
- at double distance acceleration ~ quarter;
- Moon may become dominant nearby;
- PlayerController local coords stay bounded;
- system coordinates never go into local PhysicsWorld.
