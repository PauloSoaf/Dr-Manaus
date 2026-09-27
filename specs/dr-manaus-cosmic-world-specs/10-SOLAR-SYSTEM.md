# Sistema Solar

## Objetivo

Transformar o espaço atual de background em um Sistema Solar logicamente real em escala.

## Corpos mínimos

```text
Sun
Mercury
Venus
Earth
Moon
Mars
Jupiter
Saturn
Uranus
Neptune
```

Corpos anões e luas adicionais podem vir depois.

## Dados

Fontes:

```text
NASA
JPL Horizons
```

O JPL Horizons fornece efemérides de:

```text
Sol
planetas
Lua
satélites
asteroides
cometas
barycenters
```

A consulta não deve ocorrer por frame.

## CelestialBody

```ts
interface CelestialBody {
  id: string;
  name: string;
  parentId?: string;

  equatorialRadiusM: number;
  polarRadiusM?: number;
  massKg?: number;

  rotationPeriodS?: number;
  axialTiltRad?: number;

  frameId: string;
  surface?: PlanetSurfaceProvider;
}
```

## EphemerisProvider

```ts
interface EphemerisSample {
  epochTdb: number;
  positionM: [number, number, number];
  velocityMps: [number, number, number];
}

interface EphemerisProvider {
  sample(bodyId: string, time: number): EphemerisSample;
}
```

## Estratégia recomendada

Primeira versão:

```text
dados offline amostrados
+
interpolação
```

Alternativa:

```text
elementos orbitais simplificados
```

Para gameplay, uma precisão de navegação científica não é necessária. O importante é:

```text
ordem correta
distância coerente
raio coerente
movimento estável
reprodutibilidade
```

## Escala lógica

Exemplos de referência:

```text
Earth equatorial diameter  aproximadamente 12.756 km
Earth average Sun distance aproximadamente 149,7 milhões km
Mars average Sun distance  aproximadamente 227,9 milhões km
Jupiter average distance   aproximadamente 778 milhões km
Neptune average distance   aproximadamente 4,5 bilhões km
```

Os valores finais do manifest devem vir de dataset versionado, não de constantes espalhadas pelo código.

## Renderização distante

Um planeta a milhões de quilômetros:

```text
não recebe mesh de terreno
```

Recebe:

```text
sphere/impostor
phase
albedo
atmosphere se aplicável
tamanho angular correto
```

Ao se aproximar:

```text
CelestialRepresentation
       |
       v
PlanetRepresentation
       |
       v
PlanetTileSurface
```

## Terra

A Terra usa o provider mais sofisticado.

Os outros planetas inicialmente podem usar:

```text
sphere real no modelo lógico
low-res height / procedural surface
textura licenciada
```

A arquitetura deve permitir adicionar dados reais depois.

## Lua

A Lua é o primeiro teste de outro corpo pousável.

Critérios:

```text
sair de Manaus
ver Terra diminuindo
aproximar Lua
trocar reference frame
descer
chegar ao solo
olhar para trás e ver Terra
```

Esse caminho valida toda a arquitetura antes de tentar Marte.

## Sol

O Sol não deve ser uma superfície pousável comum na primeira versão.

Pode possuir:

```text
collision exclusion
visual surface
corona
danger volume
```

Se gameplay exigir entrar no Sol, isso deve ser uma regra ficcional separada.

## Tempo

Criar um relógio astronômico separado do relógio visual atual.

```text
simulationTime
dayNightPresentation
```

O usuário pode continuar escolhendo Morning/Noon/Golden Hour/Night como modo visual durante a migração.

Depois, um modo real pode derivar iluminação do tempo astronômico.

## Acceptance path

```text
Manaus
-> 100 km
-> Terra inteira
-> Lua
-> órbita lunar
-> superfície lunar
-> volta para Terra
-> Manaus
```

Sem reload completo da aplicação.
