# Sistema Solar, galáxia e universo

## Sistema Solar

Preservar a definição real existente.

Não substituir `SolarSystem.bodies` quando entrar em outro setor.

Criar catálogo:

```ts
interface StarSystemDefinition {
  id: string
  rootStar: CelestialBody
  bodies: readonly CelestialBody[]
  ephemeris: EphemerisProvider
}
```

```text
solar
alpha-centauri-like-procedural-123
procedural-sector-x-y-z-star-4
```

## Active system

`UniverseRuntime` guarda:

```text
activeSystemId
activeSystemRuntime
```

Trocar de sistema não destrói o catálogo anterior.

## Sistemas procedurais

`SystemGenerator` deve gerar:

- star
- planet count
- planet radius
- mass
- semi-major axis
- eccentricity
- inclination
- longitude / anomaly
- rotation
- axial tilt
- moons
- stable IDs

O valor `currentOrbitM` precisa virar dado real do sistema.

## Procedural ephemeris

Criar:

```text
ProceduralEphemeris.ts
```

que resolve órbitas de corpos gerados deterministicamente.

Não depender do `OfflineEphemeris` do Sistema Solar para IDs desconhecidos.

## Star sectors

`StarSector` deve continuar pure/deterministic.

Mas a renderização passa pelo scheduler.

## Galaxy LOD

Não renderizar milhares de estrelas de todo setor em qualquer distância.

Exemplo:

```text
galaxy far:
disc/bulge volumetric impostor

sector far:
density cloud

sector mid:
bright stars

sector near:
individual star points

system approach:
star body + planets
```

## Universo observável

O jogo não precisa materializar o universo.

Endereçamento:

```text
galaxy cluster
galaxy
sector bigint
offset
```

Pode ser expandido depois.

A primeira meta é:

```text
Terra
-> Sistema Solar
-> sair do sistema
-> setor estelar
-> aproximar outro sistema
```

Antes de falar em bilhões de galáxias.

## Determinismo

A mesma coordenada precisa sempre gerar o mesmo resultado.

Nunca usar `Math.random()` para geração persistente.

## Escala visual

Corpos distantes podem usar tamanho angular/remapping.

Isso não muda o estado lógico.

```text
logical distance: real
render distance: representational
```
