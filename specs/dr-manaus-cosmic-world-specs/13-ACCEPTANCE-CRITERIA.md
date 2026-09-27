# Acceptance criteria

## Merge blocker

Não fazer merge em `main` se qualquer P0 estiver aberto.

## AC-01 Manaus ground

Ao iniciar no Largo:

- terrain existe
- roads existem
- city existe
- colliders correspondem
- no duplicated Earth patch visível
- landmarks continuam nos mesmos lugares

## AC-02 Earth handoff

Subir gradualmente não pode remover o terreno local antes de a representação planetária estar pronta.

## AC-03 WGS84

A Terra deve manter:

```text
semi-major axis = 6378137 m
inverse flattening = 298.257223563
```

Toda transformação usa a implementação central.

## AC-04 Manaus tile frames

Não deve existir fórmula de curvatura copiada em vários geradores.

## AC-05 provider real

`ManausProvider` só pode ser chamado de integrado quando:

- plan real
- load real
- activate real
- deactivate real
- dispose real
- tests

## AC-06 no cosmic Vector3

Nenhuma posição enviada a:

- Three.js object position
- physics
- local collision
- camera local state

deve carregar diretamente magnitudes interestelares.

## AC-07 bigint precision

Endereços acima de `Number.MAX_SAFE_INTEGER` permanecem exatos.

## AC-08 deterministic universe

Same seed + same address = same result.

## AC-09 bounded star streaming

Resident sectors e star objects possuem limite e eviction.

## AC-10 Solar System immutable definition

Visitar outro sistema não remove a definição de Earth/Sun do catálogo.

## AC-11 procedural orbit

Corpos procedurais não ficam todos em `[0,0,0]`.

## AC-12 real Earth elevation

A Terra não usa random noise como macro-relevo.

## AC-13 tile seam

Tiles adjacentes compartilham bordas compatíveis.

## AC-14 persistence

Uma mutation sobrevive:

```text
unload tile
reload tile
leave body
return body
reload page
```

conforme o tipo de save.

## AC-15 tests

Obrigatório:

```text
npm test
npm run build
```

Browser/integration suite deve estar documentada com resultado real.

## AC-16 documentation truth

Nenhuma fase pode estar `done` se houver stub ou integração parcial.
