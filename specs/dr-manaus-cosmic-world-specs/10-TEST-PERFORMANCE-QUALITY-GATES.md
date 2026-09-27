# Testes, performance e quality gates

## Regra

`npm test` passar não é prova suficiente para uma mudança visual ou de integração.

## Gates por commit

Executar:

```bash
npm test
npm run build
```

quando aplicável.

Para alterações visuais:

```bash
npm run test:browser
```

ou teste Playwright equivalente.

## Nenhuma regressão conhecida pode ser escondida

Se um teste já falhava no baseline:

- documentar
- não atribuir falsamente à mudança atual
- mas também não dizer que a suíte inteira está verde

## Testes obrigatórios novos

### Manaus handoff

```text
at 0 m: local ground visible
at 100 m: local ground still valid until intended handoff
at 5 km: no holes
at 15 km: blend controlled
at 30 km: planet representation valid
```

### Provider integration

Assert:

```text
ManausProvider.plan != []
load real demand works
activate produces actual tile/subsystem activation
deactivate releases
dispose aborts
```

### WGS84 tile frame

Testar:

- tile center roundtrip
- shared edge
- landmark world position
- collider/render coincidence

### BigInt

Testar acima de:

```text
Number.MAX_SAFE_INTEGER
```

Garantir que:

```text
sectorIndex(hugeBigInt).x === hugeBigInt
```

### FTL

Assert:

```text
PlayerController.position remains local
PhysicsWorld never receives cosmic magnitude
UniverseAddress changes instead
```

### Procedural system

Assert:

- same seed => same planets
- distinct planets => distinct orbits
- body positions finite
- no unknown-body default `[0,0,0]`
- Solar System remains intact

### Terrain

Assert:

- same tile build twice => identical bytes/positions
- adjacent tile edges match
- elevation is from provider
- no random seam

### UniverseRenderer

Assert:

- max sectors resident bounded
- eviction happens
- scheduler budget respected
- dispose frees geometries/material refs

## Performance budgets

Continuar usando budgets explícitos.

Exemplo inicial:

```text
main-thread streaming: <= 4 ms budget
heavy activations: <= 2/frame
GPU upload: bounded
resident sectors: bounded
resident Earth tiles: bounded
```

Não otimizar por comentário.

Medir.

## Browser profiling scenarios

1. Teatro, parado
2. voo 120 m/s
3. voo 500 m/s
4. mega 8 km/s
5. saída da atmosfera
6. órbita
7. Lua
8. cosmic travel
9. retorno para Manaus
