# Coordenadas e reference frames

## Problema

Um único `Vector3` não consegue representar com qualidade suficiente:

```text
milímetros em uma fachada
metros em Manaus
milhões de metros na Terra
unidades astronômicas
anos-luz
bilhões de anos-luz
```

Mesmo que JavaScript use `Number` em double precision na CPU, posições acabam em buffers float32 na GPU. Além disso, operações de física local não devem depender de números astronômicos.

## Solução

Usar uma árvore de reference frames.

```text
UniverseFrame
|
+-- MilkyWayFrame
    |
    +-- SolarBarycentricFrame
        |
        +-- EarthInertialFrame
            |
            +-- EarthFixedFrame
                |
                +-- ManausENUFrame
                    |
                    +-- RenderLocalFrame
```

## Tipos mínimos

```ts
export interface GeodeticPosition {
  latRad: number;
  lonRad: number;
  heightM: number;
}

export interface EcefPosition {
  xM: number;
  yM: number;
  zM: number;
}

export interface LocalPosition {
  xM: number;
  yM: number;
  zM: number;
}

export type ReferenceFrameId = string;

export interface SpatialPose {
  frame: ReferenceFrameId;
  position: [number, number, number];
  orientation: [number, number, number, number];
}
```

Evitar reutilizar livremente `Vector3` para posições de naturezas diferentes.

## WGS84

Constantes oficiais:

```text
a   = 6378137.0 m
1/f = 298.257223563
f   = 1 / 298.257223563
e²  = f * (2 - f)
```

Conversão geodésica para ECEF:

```text
N = a / sqrt(1 - e² sin²(phi))

X = (N + h) cos(phi) cos(lambda)
Y = (N + h) cos(phi) sin(lambda)
Z = ((1 - e²)N + h) sin(phi)
```

Onde:

```text
phi     latitude geodésica
lambda  longitude
h       altura sobre o elipsoide
```

## ENU

Para gameplay no solo, a base local continua em metros:

```text
E = East
N = North
U = Up
```

O projeto atual usa:

```text
+X east
+Z south
+Y up
```

Para evitar quebrar Manaus de uma vez, o adapter deve mapear:

```text
local X = +East
local Y = +Up
local Z = -North
```

Assim o sentido atual de Z continua consistente.

## Manaus compatibility frame

Criar:

```ts
const MANAUS_ANCHOR = {
  lat: -3.130333,
  lon: -60.022528,
  heightM: 0
};
```

E:

```ts
class ManausLocalFrame {
  geoToLegacyLocal(...)
  legacyLocalToGeo(...)
  ecefToLegacyLocal(...)
  legacyLocalToEcef(...)
}
```

Nas primeiras PRs, `latLonToWorld()` e `worldToLatLon()` podem delegar a esse adapter.

Isso permite manter os testes existentes enquanto a fonte de verdade passa a ser WGS84.

## Floating origin 3D

O algoritmo atual rebasa apenas X/Z.

O novo sistema deve ter:

```ts
class FloatingOrigin3D {
  frame: ReferenceFrameId;
  logicalOrigin: SpatialPose;
  localOffset: Vector3;

  shouldRebase(player: SpatialPose): boolean;
  rebase(player: SpatialPose): RebaseEvent;
}
```

O rebase deve considerar:

```text
X
Y
Z
frame atual
velocidade
domínio de renderização
```

No modo local, a posição do jogador na GPU deve continuar próxima de zero.

Meta:

```text
abs(renderLocal.x) < alguns quilômetros
abs(renderLocal.y) < alguns quilômetros
abs(renderLocal.z) < alguns quilômetros
```

em gameplay de superfície.

## Rebase sem quebrar física

Não alterar silenciosamente a posição lógica do jogador.

Fluxo:

```text
player logical position
        |
        v
SpatialRuntime
        |
        +-> escolhe origin
        |
        v
logicalToRenderLocal()
        |
        v
physics / render local
```

Sistemas locais recebem o mesmo evento:

```ts
interface RebaseListener {
  onRebase(event: RebaseEvent): void;
}
```

Componentes que precisam ser auditados:

```text
PlayerController
CameraController
PhysicsWorld
TerrainDestruction
DestructionSystem
RealCityLayer
WorldStreamer
HLODManager
TrafficSystem
PopulationManager
LandmarkManager
LargoDistrict
WeatherSystem
WaterSystem
```

## Escala galáctica

Não usar um `Number` absoluto em metros para o universo.

Usar hierarquia.

Exemplo:

```ts
interface UniverseAddress {
  galaxyId: string;
  sector: {
    x: bigint;
    y: bigint;
    z: bigint;
  };
  systemId?: string;
  bodyId?: string;
  childFrame?: string;
}
```

Dentro de um setor:

```text
posição relativa em double
```

Entre setores:

```text
índices inteiros
```

Isso evita tentar representar:

```text
10^26 m + 1 m
```

no mesmo número.

## Invariantes

1. Um objeto não muda de lugar logicamente durante rebase.
2. A distância entre dois objetos do mesmo frame não muda durante rebase.
3. A orientação da câmera não muda durante rebase.
4. A velocidade física local não muda durante rebase.
5. Nenhum buffer de vértices precisa receber coordenadas astronômicas.
6. Um reference frame não depende de informação visual para existir.
7. A renderização é uma projeção do modelo espacial, nunca a fonte de verdade.
