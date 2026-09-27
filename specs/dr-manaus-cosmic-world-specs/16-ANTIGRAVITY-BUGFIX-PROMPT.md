# Prompt de correção de bugs para Antigravity

Corrija os bugs abaixo em ordem. Não pule para galaxy polish antes de fechar P0.

## P0

### 1. `src/world/providers/ManausProvider.ts`

Hoje é stub.

Escolha uma estratégia correta:

A. implementar adapter real para os subsistemas atuais

ou

B. retirar o provider do registry temporariamente

Não deixe métodos críticos vazios ou lançando `not fully wired`.

### 2. `src/world/providers/EarthProvider.ts`

Restaure um handoff seguro.

O planeta não pode substituir o flat ground a ~100 m.

Enquanto Manaus não estiver totalmente em WGS84, use gate próximo do comportamento anterior e preserve city ownership.

### 3. Curvatura

Remova hacks de curvatura independentes de:

```text
buildingGeometry.ts
ChunkMeshes.ts
HLODManager.ts
```

somente depois de introduzir um transform por tile/frame equivalente.

Não cause regressão visual.

### 4. `src/player/flightConfig.ts`

Resolva a inconsistência:

```text
comentário: 55 556 m/s
código: 1 155 556 m/s
```

Se o requisito é 200.000 km/h, use 55.555,56 m/s.

### 5. `PlayerController`

Retire cosmic FTL da física local.

### 6. `UniverseRuntime`

Não normalize sector em uma pose que será sobrescrita pelo local player no frame seguinte.

Crie estado de travel explícito.

### 7. `SolarSystem`

Não substitua `dynamicBodies` do Sistema Solar por sistema procedural.

## P1

### 8. `UniverseAddress.sectorIndex`

Nunca faça:

```text
bigint -> Number -> bigint
```

Adicione teste acima de `Number.MAX_SAFE_INTEGER`.

### 9. `EarthGlobe`

Remova `new SimplexNoise()` como macro-terrain.

### 10. `UniverseRenderer`

Adicionar lifecycle:

```text
stream
activate
evict
dispose
```

e usar address correto.

### 11. `SystemGenerator`

Persistir orbital elements.

Criar ephemeris procedural.

### 12. persistence

Não declarar Fase 12 resolvida só por salvar crateras no localStorage.

## Validação após cada grupo

Rode:

```bash
npm test
npm run build
```

E rode testes browser quando a mudança atingir renderização.

Atualize `docs/world/15-status.md` com estado factual.
