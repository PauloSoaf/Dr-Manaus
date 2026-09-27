# Auditoria após o hardening

## Veredito

Sim: a branch melhorou significativamente desde `d79f4e9`.

HEAD auditado:

```text
f5afb4d
fix(realcity): stop facade work from starving the shell tier
```

Desde a revisão anterior foram adicionados 13 commits de correção/integração.

## Melhorias confirmadas

### 1. ManausProvider fake foi removido

O antigo provider registrado mas não implementado foi apagado.

Isso é correto. Melhor nenhum provider do que uma abstração falsa com `plan()=[]`, `load()` rejeitando e `activate()` lançando erro.

### 2. O gate seguro da Terra voltou

`EarthProvider` voltou para:

```ts
minAltitudeM default = 15_000
cityOwnsGround default = true
```

Isso evita a regressão anterior em que o globo substituía o chão da cidade a baixa altitude.

### 3. BigInt foi corrigido

`UniverseAddress.sectorIndex()` preserva `bigint` diretamente e não passa mais por `Number`.

Isso fecha um problema real de precisão cósmica.

### 4. UniverseRenderer antigo foi removido

Saiu o renderer que carregava 27 setores por conta própria, sem eviction, sem scheduler e sem lifecycle.

### 5. Star sectors viraram provider

Novo:

```text
src/world/providers/StarSectorProvider.ts
```

Agora há:

- load;
- activate;
- deactivate;
- dispose;
- scheduler budget;
- limite de estrelas;
- feature flag.

### 6. Fake terrain procedural da Terra foi removido

O `SimplexNoise` aleatório por tile saiu.

Novo:

```text
src/world/planet/EarthElevation.ts
src/world/geodata/earth-elevation.json
```

O low LOD da Terra usa relief real derivado de ETOPO.

### 7. Sistemas procedurais ganharam runtime próprio

Novos:

```text
CelestialSystemRuntime.ts
ProceduralSystemRuntime.ts
```

`SystemGenerator.ts` agora guarda órbitas em cada corpo.

### 8. Travel domain existe

Novo:

```text
src/world/travel/TravelDomain.ts
```

Há distinção entre simulação local e interplanetária.

### 9. Floating origin agora rebasa Y

`Game.ts` rebasa X/Y/Z, importante em altitude orbital para manter skinning/camera próximos da origem render local.

### 10. Persistence evoluiu

`WorldMutationStore.ts` recebeu schema/version/addressing/IndexedDB.

### 11. Browser shell starvation foi corrigido

O último commit identifica corretamente que detalhe de fachadas estava consumindo o budget e impedindo a shell de progredir.

O commit relata smoke browser verde após reservar budget para shell.

## O que ainda impede considerar a arquitetura completa

A próxima etapa é integração.

Os principais gaps restantes:

```text
TravelDomain não é a autoridade da posição interplanetária
SurfaceTileFrame é aplicado somente a partes de Manaus
Earth transition é binária e pode gerar chão preto
oceano não tem representação óptica própria
atmosphere local -> planetária ainda possui gap
galaxy address ainda não é dirigido por gameplay
Sistema Solar ainda não possui body handoff/pouso completo
cosmology ainda não existe
```

A direção está agora muito melhor. O próximo risco seria voltar a correr e construir galáxias por cima de uma Terra com handoff quebrado.
