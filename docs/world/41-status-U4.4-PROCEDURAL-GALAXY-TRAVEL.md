# DR-MANAUS | Checkpoint U4.4.5 — Correção do CI e da Identidade Multissemente

**Data:** 03 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline auditado (U4.4.4):** `6beec63c57675eccb0fa270862354885b97a3671`  
**CI Oficial U4.4.4:** GitHub Actions Run `41679047476` (FAILURE: 1 erro TS2322 em `src/world/travel/GalaxyEntryResolver.ts(66,5)`)  
**Último Baseline Verde:** `cc07b1c04b97d665c353b8c8d58513986494d6ca` (U4.4.3, Run `41662450492`)  
**Patch Atual:** U4.4.5  

---

## 1. Auditoria e Diagnóstico da Reprovação do U4.4.4

O commit `6beec63c57675eccb0fa270862354885b97a3671` falhou no Typecheck do CI com o erro:
`TS2322: Type 'ProceduralTargetDescriptor | undefined' is not assignable to type 'ProceduralTargetDescriptor'`.

Além da falha de compilação, a revisão de código identificou três inconsistências estruturais na autoridade multissemente:

1. **P0 — Erro TS2322 em `GalaxyEntryResolver.ts`:**
   - O código verificava `resolvedEntryCache.has(key)` e em seguida `if (cached === null) throw ...`.
   - O compilador TypeScript não infere que `has(key)` garante que `get(key) !== undefined`. Portanto, `cached` permanecia com tipo `ProceduralTargetDescriptor | undefined`.
   - Correção: distinguir explicitamente os 3 estados (`undefined` para ausência de cache, `null` para cache negativo e `ProceduralTargetDescriptor` para sucesso) sem supressões ou casts inseguros.

2. **P0 — Confusão entre `universeSeed` e `galaxySeed`:**
   - `ProceduralGalaxyGenerator.generateGalaxy(universeSeed, cell, index)` produz `descriptor.seed` via hash.
   - Logo, `descriptor.seed !== universeSeed`.
   - No U4.4.4, `GalaxyCoordinates.ts` usava `def.proceduralMorphology?.seed ?? seed` como chave de cache, indexando a definição sob a semente da galáxia em vez da semente universal. Quando `galaxyDefinition(id, universeSeed)` era consultada, ocorria cache miss e regeneração.
   - De forma análoga, `GalaxyRuntime.generateSector()` repassava `this.definition.proceduralMorphology?.seed` como se fosse `universeSeed`, fazendo com que `generateStarSector()` buscasse a galáxia com a semente errada.

3. **P1 — Alinhamento de Materialização e Setores Estelares:**
   - `StarSectorProvider`, `GalaxyMaterializer`, `ProceduralSystemMaterializer` e `UniverseRuntime` necessitavam de propagação explícita de `universeSeed` para que a galáxia preparada mantivesse sua identidade morfológica exata mesmo se o jogador ou uma consulta de fundo tocasse outro catálogo.

4. **P1 — Fragilidade do Teste T_U44_17:**
   - O teste anterior buscava uma galáxia sem entrada nas primeiras 20 galáxias descobertas, assumindo que pelo menos uma existiria incidentalmente.
   - Substituído por fixture determinística estrita e controlada.

---

## 2. Correções Implementadas no Patch U4.4.5

### 2.1 Correção do Narrowing de Tipos (`GalaxyEntryResolver.ts`)
- [`GalaxyEntryResolver.ts`](file:///c:/Projetos/Dr-Manaus/src/world/travel/GalaxyEntryResolver.ts) agora distingue os três estados em uma única consulta:
  ```typescript
  const key = entryCacheKey(seed, galaxyId);
  const cached = resolvedEntryCache.get(key);
  if (cached === null) {
    throw Error(`No populated and landable entry system in procedural galaxy ${galaxyId}`);
  }
  if (cached !== undefined) {
    return cached;
  }
  ```
- O compilador infere o tipo `ProceduralTargetDescriptor` de forma 100% estrita e sem asserções.
- `peekProceduralGalaxyEntry()` e `hasProceduralGalaxyEntry()` utilizam a mesma semântica direta.

### 2.2 Separação Formal entre `universeSeed` e `galaxySeed`
- [`GalaxyDefinition.ts`](file:///c:/Projetos/Dr-Manaus/src/world/celestial/GalaxyDefinition.ts): adicionada propriedade `universeSeed?: bigint`.
- [`GalaxyCoordinates.ts`](file:///c:/Projetos/Dr-Manaus/src/world/galaxy/GalaxyCoordinates.ts):
  - `registerProceduralGalaxyDefinition(def, universeSeed)` utiliza a `universeSeed` para a chave de cache `${universeSeed.toString(16)}:${def.id}`.
  - `galaxyDefinition(id, universeSeed)` grava `def.universeSeed = universeSeed` ao materializar novas definições.
- [`GalaxyRuntime.ts`](file:///c:/Projetos/Dr-Manaus/src/world/galaxy/GalaxyRuntime.ts):
  - Armazena `readonly universeSeed?: bigint` e indexa runtimes por `runtimeCacheKey(id, universeSeed)`.
  - `generateSector()` repassa `this.universeSeed` (ou `this.definition.universeSeed`), garantindo que o setor seja povoado de acordo com a morfologia da semente correta.

### 2.3 Propagação de Semente em Streaming e Materialização
- [`StarSectorProvider.ts`](file:///c:/Projetos/Dr-Manaus/src/world/providers/StarSectorProvider.ts): aceita `universeSeed` em `options` e repassa para `generateStarSector()`.
- [`GalaxyMaterializer.ts`](file:///c:/Projetos/Dr-Manaus/src/world/galaxy/GalaxyMaterializer.ts): `prepare(id, universeSeed)` instancia `StarSectorProvider` com a semente universal da galáxia.
- [`ProceduralSystemMaterializer.ts`](file:///c:/Projetos/Dr-Manaus/src/world/runtime/ProceduralSystemMaterializer.ts): propaga `universeSeed` do catálogo para `ProceduralSystemRuntime`, `galaxies.prepare()`, `installSystem()` e `restoreSystem()`.
- [`UniverseRuntime.ts`](file:///c:/Projetos/Dr-Manaus/src/world/runtime/UniverseRuntime.ts): `installSystem()` e `restoreSystem()` aceitam `universeSeed` explícito e preservam a semente ativa da galáxia.

---

## 3. Matriz de Testes Reforçada (`tests/procedural-travel.test.ts`)

1. **`T_U44_17_NEGATIVE_ENTRY_CACHING_PREVENTS_REPEATED_SEARCHES`:**
   - Utiliza fixture determinística controlada: galáxia com 0 estrelas candidatas nos 13 setores.
   - Comprova exatamente 13 chamadas na primeira varredura determinística.
   - Armazena `null` no cache negativo.
   - Comprova que 100 consultas subsequentes não realizam nenhuma nova chamada de geração (total mantido em 13).
   - Comprova que `seedB` possui cache independente e que galáxias válidas continuam resolvendo normalmente.
2. **`T_U44_18_INTERLEAVED_MULTI_SEED_CATALOG_ISOLATION`:**
   - Comprova que Catálogo A e Catálogo B produzem definições e runtimes isolados.
   - Comprova reutilização idêntica de instâncias (`defA2 === defA1` e `runtimeA2 === runtimeA1`) em cache quente sob a mesma semente.
   - Comprova que os setores gerados refletem a densidade e morfologia da respectiva semente universal.
3. **`T_U44_19_HUD_PER_FRAME_VALIDATION_ZERO_HEAVY_GENERATION`:**
   - Preserva a validação de 120 frames sem geração estelar contínua no HUD.
4. **`T_U44_20_PREPARED_DESTINATION_IDENTITY_PRESERVED_DURING_TRAVEL`:**
   - Inicia viagem procedural, dispara consultas em semente estrangeira durante o voo e confirma na chegada a preservação da `universeSeed`, da morfologia do destino e da população de corpos celestes.

---

## 4. Roteiro de Validação Visual Manual (Operador Humano)

No servidor local ativo em `http://localhost:9999/`:
1. Acesse `http://localhost:9999/`.
2. Decole da Terra para espaço seguro.
3. Pressione `M`, acesse Cosmos e selecione `galaxy_c10_20_30_0`.
4. Trave o alvo no HUD (observe ausência total de microtravamentos).
5. Engaje o Hypercruise, observe cruzeiro e desaceleração.
6. Na chegada, inspecione a estrela de entrada e planetas rochosos.
7. Retorne ao Sol com sucesso.
8. Repita para Andrômeda.
