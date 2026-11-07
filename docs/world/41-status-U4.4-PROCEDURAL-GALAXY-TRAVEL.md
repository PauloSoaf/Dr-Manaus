# DR-MANAUS | Checkpoint U4.4.9 — Recuperação das Regressões U2/U3 e Reutilização Correta de Sessões

**Data:** 07 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline auditado (U4.4.8):** `60eff2731fb61d82f4dbcd5ca7841283c41477b9`  
**CI Oficial U4.4.8:** GitHub Actions Run `42394939637` (FAILURE: TypeScript PASS, Regressões permanentes 627/638 — 11 falhas em U2/U3)  
**Último Baseline Verde:** `cc07b1c04b97d665c353b8c8d58513986494d6ca` (U4.4.3, Run `41662450492`)  
**Patch Atual:** U4.4.9  

---

## 1. Diagnóstico da Causa Raiz das 11 Regressões no U4.4.8

No commit `60eff2731fb61d82f4dbcd5ca7841283c41477b9`, a guarda contra colisão de provedores adicionada em `GalaxyMaterializer.install()` expôs um defeito de equivalência de sessão em `GalaxyMaterializer.prepare()`:
- A sessão inicial da Via Láctea (`g.prepare('milky_way')`) ou de Andrômeda possuia `old.galaxy.universeSeed === undefined`.
- Quando `ProceduralSystemMaterializer.prepare(target)` preparava um sistema procedural dentro da Via Láctea ou de Andrômeda, chamava `this.galaxies?.prepare(a.galaxyId, uSeed)` passando `uSeed = DEFAULT_UNIVERSE_SEED` explicitamente.
- A condição `if (old?.galaxy.id === id && (universeSeed === undefined || old.galaxy.universeSeed === universeSeed))` avaliava `false` (`undefined !== 0x44524d414e415553n`).
- Como consequência, `GalaxyMaterializer.prepare()` deixava de reutilizar a sessão canônica ativa e instanciava um segundo `StarSectorProvider` com o mesmo ID canônico (`galaxy/star-sectors` ou `galaxy/star-sectors/andromeda`).
- Isso causou diretamente as 11 falhas:
  1. Os 2 testes de U2 (`U2 QA transports retain one Solar snapshot across U1 and U2 transitions` e `T_U2_U1_MILKY_WAY_PROCEDURAL_REGRESSION`) falharam imediatamente ao lançar `Conflito de provider: "galaxy/star-sectors" já registrado por outra instância`.
  2. Os 9 testes de U3 (`T_U3_BODY_TARGET_FINAL_COSMIC_FLIGHT`, `T_U3_MW_PROCEDURAL_INTERSTELLAR`, `T_U3_PROCEDURAL_TO_SOL`, `T_U3_PROCEDURAL_A_TO_B`, `T_U3_ANDROMEDA_INTERSTELLAR`, `T_U3_B_WARP_RESTORED_AFTER_ARRIVAL`, `T_U3_B_WARP_BLOCKED_WHEN_INPUT_DISABLED`, `T_U3_B_WARP_BLOCKED_WHEN_PANEL_OPEN`, `T_U3_REPEAT_TRAVEL_NO_LEAK`) capturaram essa mesma exceção dentro do bloco `try { this.prepared!.commit(); } catch (e) { s.preparationError = String(e); s.phase = 'arrival-hold'; ... }` de `UniversalTravelController.update()`, retendo a viagem indefinidamente em `arrival-hold` até estourar o limite de iterações de `finish(f)`.

---

## 2. Correções Implementadas no Patch U4.4.9

### 2.1 Identidade Normalizada Canônica vs. Procedural (`GalaxyDefinition.ts` e `GalaxyRuntime.ts`)
- Exportada `isCanonicalGalaxyId(id?: string): boolean` para identificar galáxias canônicas (`milky_way`, `andromeda`, etc.).
- Para galáxias canônicas, `GalaxyRuntime.universeSeed` é sempre `undefined` e as instâncias singleton canônicas são preservadas mesmo quando `clearGalaxyRuntimes()` limpa runtimes procedurais.
- Implementada `sameGalaxyIdentity(a, id, universeSeed)`:
  - Se `a?.id !== id`, retorna `false`.
  - Se `isCanonicalGalaxyId(id)` for `true`, retorna `true` (a identidade canônica independe de `universeSeed`).
  - Se for galáxia procedural, compara a semente universal efetiva (`effectiveRuntimeSeed === effectiveTargetSeed`).

### 2.2 Contrato de Reutilização de Sessão e Colisão de Providers (`GalaxyMaterializer.ts` e `StarSectorProvider.ts`)
- `GalaxyMaterializer.prepare(id, universeSeed)` reutiliza `old` se e somente se `old?.ready && sameGalaxyIdentity(old.galaxy, id, universeSeed)`.
- Sessões descartadas (`!old.ready`) jamais são reutilizadas, e handles reutilizados verificam `!old.ready || this.current !== old` em `install()` e `!old.ready` em `activate()`.
- `StarSectorProvider` mantém IDs canônicos (`galaxy/star-sectors` e `galaxy/star-sectors/andromeda`) sem sufixo de seed, e qualifica IDs procedurais por `universeSeed`.
- A proteção contra colisão em `GalaxyMaterializer.install()` permanece ativa e rigorosa contra instâncias distintas não autorizadas.

### 2.3 Revisão de `sameSystem` e Planos de Viagem (`UniversalTravelPlan.ts` e `GalaxyCoordinates.ts`)
- `sameSystem(a, b, seedA, seedB)` retorna `true` para o mesmo sistema em galáxias canônicas independentemente de `seedA`/`seedB`, e exige igualdade estrita (`seedA !== undefined && seedB !== undefined && seedA === seedB`) quando sementes são informadas para galáxias procedurais.
- `travelAnchor`, `createTravelPlan` e `addressSeparationM` tratam galáxias canônicas de forma invariante à seed universal, preservando integralmente a classificação `interstellar`/`intergalactic` de U2/U3.

### 2.4 Novos Testes de Contrato (`tests/procedural-travel.test.ts`)
- **`T_U44_25_GALAXY_SESSION_REUSE_AND_PROVIDER_COLLISION_CONTRACTS`:** cobre os cenários A–F (reuso da Via Láctea com seed explícita, reuso de Andrômeda sob outra seed, reuso procedural Seed A $\rightarrow$ Seed A, troca transacional Seed A $\rightarrow$ Seed B, não-reuso de sessão descartada e bloqueio de colisão por provider não autorizado).
- **`T_U44_26_CANONICAL_AND_MULTI_SEED_HYPERCRUISE_REGRESSION_CONTRACTS`:** cobre os cenários G–J e `sameSystem` (Hypercruise Terra-Andrômeda, ciclo Sol $\rightarrow$ procedural Via Láctea $\rightarrow$ Sol, 5 ciclos completos multi-perna sem vazamento, rollback de ativação com retry e invariância de `sameSystem`).

---

# DR-MANAUS | Checkpoint U4.4.8 — Correção dos 3 Testes e Integridade Transacional

**Data:** 07 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline auditado (U4.4.7):** `13452196b3cef9c82688e3091a5121a88b29ced8`  
**CI Oficial U4.4.7:** GitHub Actions Run `42392441997` (FAILURE: TypeScript PASS, 638/638 regressões permanentes PASS, 3 falhas nos testes gerais: 1.538/1.541)  
**Falhas confirmadas no U4.4.7:**
- `T_U44_17`: `ReferenceError: registerProceduralGalaxyDefinition is not defined`
- `T_U44_23`: `Error: TEST: endereço procedural de galáxia conhecida requerido`
- `T_U44_24`: `Error: Galáxia e endereço incoerentes`  
**Último Baseline Verde:** `cc07b1c04b97d665c353b8c8d58513986494d6ca` (U4.4.3, Run `41662450492`)  
**Patch Atual:** U4.4.8  

---

## 1. Auditoria e Diagnóstico da Reprovação do U4.4.7

O commit `13452196b3cef9c82688e3091a5121a88b29ced8` ultrapassou com sucesso o Typecheck e a suíte completa de 638 testes de regressões permanentes, expondo 3 falhas de runtime na suíte geral:

1. **`T_U44_17` — Ausência de Imports de Suporte:**
   - O teste determinístico invocava `registerProceduralGalaxyDefinition`, `GalaxyRuntime` e tipava `GalaxyDefinition` sem que esses símbolos tivessem sido importados em `tests/procedural-travel.test.ts`.
   - **Correção:** Inclusão dos imports nominais de `GalaxyCoordinates`, `GalaxyRuntime` e `GalaxyDefinition`.

2. **`T_U44_23` — Violação de Contrato em `ProceduralSystemMaterializer.prepare()`:**
   - O teste passava um alvo de galáxia cru (`targetB = catalogB.target(procGalaxyId)!`, com `kind: 'galaxy'` e sem `systemId`) diretamente para `ProceduralSystemMaterializer.prepare()`.
   - O contrato do materializador exige alvos no nível de sistema ou corpo celeste (`kind in ['star', 'system', 'body']` e `systemId` preenchido). No fluxo real de gameplay, alvos galácticos sempre passam antes por resolução de ponto de entrada.
   - **Correção:** Resolução prévia do alvo galáctico através de `new GalaxyEntryResolver(catalogB).resolve(targetB)`, passando o descritor resolvido (`resolvedTargetB`) para `prepare()`.

3. **`T_U44_24` — Invariante de Ativação em `GalaxyMaterializer.activate()`:**
   - `GalaxyMaterializer.activate()` possui a asserção de integridade `if (this.universe.address.galaxyId !== id) throw Error('Galáxia e endereço incoerentes')`.
   - O teste tentava chamar `activate()` manualmente com a galáxia em `'milky_way'`, sem executar a transição de sistema estelar correspondente.
   - **Correção:** Inicialização da galáxia de origem sob Seed A através do fluxo real do materializador (`ProceduralSystemMaterializer.install()`), alinhando o endereço cósmico do universo antes de calcular a rota trans-semente.

4. **Hardening Adicional:**
   - **Guarda de Colisão de Providers (`GalaxyMaterializer.ts`):** `install()` agora checa se já existe um provedor registrado com o mesmo ID. Se for a mesma instância, a chamada é idempotente; se for uma instância diferente (`existing !== sectors`), lança erro explícito de colisão.
   - **Diferenciação de Sementes em `sameSystem()` (`UniversalTravelPlan.ts` e `UniversalTravelController.ts`):** A função `sameSystem()` agora aceita e compara `seedA` e `seedB`. Galáxias com mesma identificação e setor sob sementes distintas não são consideradas o mesmo sistema estelar.
   - **Domínio Intergaláctico sob Sementes Distintas (`UniversalTravelPlan.ts`):** A classificação do domínio como `'interstellar'` agora exige igualdade estrita entre `actualOrigin.universeSeed` e `uSeed`.

---

# DR-MANAUS | Checkpoint U4.4.7 — Desbloqueio do CI e Segurança Transacional dos Providers

**Data:** 07 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline auditado (U4.4.6):** `491d6a429d09e33f9bc4785e8d4b4adbf803a470`  
**CI Oficial U4.4.6:** GitHub Actions Run `42054100700` (FAILURE: 6 erros TS2448/TS2454 em `src/world/runtime/ProceduralSystemMaterializer.ts(177)` por uso de `u` antes de sua declaração em `returnToSolar()`)  
**Último Baseline Verde:** `cc07b1c04b97d665c353b8c8d58513986494d6ca` (U4.4.3, Run `41662450492`)  
**Patch Atual:** U4.4.7  

---

## 1. Auditoria e Diagnóstico da Reprovação do U4.4.6

O commit `491d6a429d09e33f9bc4785e8d4b4adbf803a470` falhou no Typecheck do GitHub Actions com os erros:
- `TS2448: Block-scoped variable 'u' used before its declaration.` (linha 177)
- `TS2454: Variable 'u' is used before being assigned.` (linha 177)

Além da correção imediata de inicialização de variáveis, a auditoria identificou um potencial bloqueio transacional ao tentar substituir ou transicionar sessões de uma mesma galáxia procedural sob sementes distintas:
1. **P0 — Colisão de IDs no `ProviderRegistry`:**
   - `StarSectorProvider.id` utilizava apenas `galaxy/star-sectors/${galaxyId}`.
   - Quando uma nova sessão da mesma galáxia sob outra semente era instalada antes do descarte da anterior (padrão de commit em duas fases), `ProviderRegistry.register()` rejeitava o provedor por ID duplicado.
   - Isso impedia o teste `T_U44_23` de atingir a falha simulada de ativação.
2. **P1 — Resolução Métrica de Rotas Multissemente (`GalaxyCoordinates.ts`):**
   - `addressSeparationM()` recebia uma única semente universal, forçando origem e destino a adotarem a mesma semente na avaliação morfológica e cosmológica.
3. **P1 — Reforço dos Testes de Apresentação e Rollback:**
   - `T_U44_22` requeria validação geométrica estrita do proxy de 20 km e invariância contra mutações de catálogo em segundo plano.
   - `T_U44_23` requeria instrumentação detalhada de checkpoints para comprovar a falha específica no estágio de ativação e a integridade completa dos provedores e cena pós-rollback.

---

## 2. Correções Implementadas no Patch U4.4.7

### 2.1 Ordem de Declaração em `ProceduralSystemMaterializer.ts`
- Declarado `const u = this.universe` antes de qualquer cálculo de `originSeed` em `returnToSolar()`, sanando todos os 6 diagnósticos TS2448/TS2454.

### 2.2 Qualificação de Identidade em `StarSectorProvider.ts` e `GalaxyMaterializer.ts`
- Implementada a função `starSectorProviderId(galaxyId, universeSeed)`:
  - Para `milky_way`: `galaxy/star-sectors`.
  - Para `andromeda` e canônicas: `galaxy/star-sectors/${galaxyId}`.
  - Para procedurais: `galaxy/star-sectors/${galaxyId}/${universeSeed.toString(16)}`.
- Isso garante IDs estritamente distintos durante a transição entre sementes diferentes da mesma galáxia, permitindo que a nova sessão seja instalada sem conflito no `ProviderRegistry`, enquanto a sessão antiga permanece ativa e disponível para rollback atômico em caso de falha.
- Adicionada guarda defensiva `if (!this.universe.providers.get(sectors!.id))` em `GalaxyMaterializer.install()`.

### 2.3 Suporte a Sementes Distintas em `GalaxyCoordinates.ts` e `UniversalTravelPlan.ts`
- Introduzida a interface `AddressSeparationOptions { originSeed?: bigint; destinationSeed?: bigint }`.
- `addressSeparationM()` agora avalia o ponto de partida `a` com `originSeed` e o destino `b` com `destinationSeed`, calculando os vetores cosmológicos e deslocamentos locais de cada galáxia sob sua respectiva autoridade de semente.
- `createTravelPlan()` repassa `{ originSeed, destinationSeed: uSeed }`.

---

## 3. Matriz de Testes Expandida (24 testes)

1. **`T_U44_22_GALAXY_PROVIDER_PRESENTATION_ORIENTATION_MULTI_SEED`:**
   - Comprova visibilidade, posicionamento na esfera proxy de 20 km ($r = 20.000\text{ m}$), normalização do quaternion de orientação ($\|\mathbf{q}\| = 1$) e invariância absoluta perante mutações de catálogo em background.
2. **`T_U44_23_ROLLBACK_PRESERVES_ORIGIN_UNIVERSE_SEED`:**
   - Instrumentação de checkpoints para cada etapa: `prepare`, `install`, `activationFailed`, `rollback`.
   - Comprova que a falha ocorre exclusivamente na fase de ativação simulada (sem colisão prévia no `ProviderRegistry`).
   - Valida que o provedor original de Seed A permanece registrado e ativo, que o provedor de Seed B é descartado, que a geometria original continua anexada ao grafo de cena e que o frame do jogador permanece íntegro.
   - Valida uma instalação subsequente com sucesso sob Seed B, confirmando que o provedor anterior é aposentado e exatamente 1 provedor de setores permanece registrado.
3. **`T_U44_24_CROSS_SEED_TRAVEL_PLAN_CALCULATION`:**
   - Comprova cálculo métrico de distância e duração para viagens entre galáxias procedurais sob sementes distintas.

---

# DR-MANAUS | Checkpoint U4.4.6 — Correção do CI e Fechamento do Contrato Multissemente

**Data:** 05 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline auditado (U4.4.5):** `9d52c851dad6c482eb4cc63bf7379f95a69ee3d2`  
**CI Oficial U4.4.5:** GitHub Actions Run `41692307028` (FAILURE: 2 erros TS2300 em `src/world/runtime/UniverseRuntime.ts(3,10)` e `(29,10)` por import duplicado de `ProceduralSystemRuntime`)  
**Último Baseline Verde:** `cc07b1c04b97d665c353b8c8d58513986494d6ca` (U4.4.3, Run `41662450492`)  
**Patch Atual:** U4.4.6  

---

## 1. Auditoria e Diagnóstico da Reprovação do U4.4.5

O commit `9d52c851dad6c482eb4cc63bf7379f95a69ee3d2` falhou no Typecheck do GitHub Actions com os erros:
- `src/world/runtime/UniverseRuntime.ts(3,10) TS2300: Duplicate identifier 'ProceduralSystemRuntime'.`
- `src/world/runtime/UniverseRuntime.ts(29,10) TS2300: Duplicate identifier 'ProceduralSystemRuntime'.`

Além do desbloqueio imediato do TypeScript, a auditoria arquitetural identificou três pontos de vazamento ou risco de contexto de semente:
1. **P0 — Localização cosmológica ativa (`UniverseRuntime.location`):**
   - O getter `location` consultava `galaxyCosmologicalAddress(this.activeGalaxy.id)` sem informar a semente da galáxia ativa.
   - Em caso de consulta de catálogo com outra semente em segundo plano, o método recorria à semente global mutável, gerando risco de reportar coordenadas cosmológicas de outra morfologia.
2. **P1 — Contexto de apresentação em `GalaxyProvider`:**
   - Métodos como `update()` utilizavam `globalTargetDeltaM()` e `galaxyDefinition()` sem a semente universal contextualizada da sessão, gerando risco de rotação ou posição incorreta no renderizador macroscópico.
3. **P1 — Rollback de sessão em `ProceduralSystemMaterializer`:**
   - O rollback em caso de falha de instalação chamava `u.restoreSystem(..., this.catalog.discovery.universeSeed)`.
   - Essa semente pertencia ao catálogo de *destino*, o que poderia corromper a restauração da sessão de *origem* caso seus contextos fossem distintos.
4. **Alinhamento dos Anchors de Viagem (`UniversalTravelPlan.ts`):**
   - `travelAnchor()` gerava o vetor global sem semente explícita. Agora ancora a `universeSeed` da galáxia ativa na origem e a `universeSeed` do destino na chegada.

---

## 2. Correções Implementadas no Patch U4.4.6

### 2.1 Correção de Compilação (`UniverseRuntime.ts`)
- Removido o import redundante de `ProceduralSystemRuntime` na linha 29.
- O getter `UniverseRuntime.location` agora utiliza diretamente a definição instalada:
  ```typescript
  cosmological: this.activeGalaxy.definition.proceduralMorphology?.cosmologicalAddress
    ?? galaxyCosmologicalAddress(this.activeGalaxy.id, this.activeGalaxy.universeSeed)
    ?? { cell: { x: 0n, y: 0n, z: 0n }, localMpc: [0, 0, 0] },
  ```

### 2.2 Contexto de Semente na Apresentação (`GalaxyProvider.ts` e `GalaxyMaterializer.ts`)
- `GalaxyProviderOptions` recebe `universeSeed?: bigint`.
- `GalaxyProvider.update()` recebe e utiliza `universeSeed ?? this.universeSeed` para calcular o delta de apresentação `globalTargetDeltaM()` e a orientação `orientGalaxyVector(active, ...)`.
- `GalaxyMaterializer` repassa `session.galaxy.universeSeed` em cada frame de atualização externa.

### 2.3 Rollback Seguro com Preservação da Semente de Origem (`ProceduralSystemMaterializer.ts`)
- O snapshot pré-instalação captura formalmente a semente de origem:
  ```typescript
  const originSeed = u.activeGalaxy.universeSeed ?? (u.activeSystem instanceof ProceduralSystemRuntime ? u.activeSystem.universeSeed : undefined);
  const snapshot = { runtime: u.activeSystem, address: u.address, pose: clonePose(u.player), velocity: u.localVelocityMps, universeSeed: originSeed };
  ```
- Em caso de exceção durante `install()`, `prepareTravel()` ou `returnToSolar()`, a restauração executa:
  ```typescript
  u.restoreSystem(snapshot.runtime, snapshot.address, snapshot.pose, snapshot.velocity, snapshot.universeSeed);
  ```

### 2.4 Coerência de Anchors (`UniversalTravelPlan.ts`)
- `travelAnchor(address, offsetM, universeSeed?: bigint)` computa a posição global no referencial da semente correta.
- `createTravelPlan()` calcula a origem usando `originSeed = u.activeGalaxy.universeSeed ?? uSeed` e o destino usando a `uSeed` do catálogo de destino.

---

## 3. Matriz de Testes Ampliada (23 testes)

1. **`T_U44_21_ACTIVE_GALAXY_LOCATION_AFTER_FOREIGN_CATALOG_QUERY`:**
   - Comprova que consultas de fundo a catálogos com sementes estrangeiras não alteram `UniverseRuntime.location.cosmological`, mantendo íntegra a morfologia da galáxia ativa e permitindo retorno seguro ao Sol.
2. **`T_U44_22_GALAXY_PROVIDER_PRESENTATION_ORIENTATION_MULTI_SEED`:**
   - Comprova que instâncias de `GalaxyProvider` sob diferentes sementes universais calculam coordenadas e visibilidade preservando sua autoridade morfológica.
3. **`T_U44_23_ROLLBACK_PRESERVES_ORIGIN_UNIVERSE_SEED`:**
   - Comprova que falhas de hardware/ativação durante a materialização acionam rollback atômico que preserva a `universeSeed` original, a morfologia e o endereço do sistema de origem sem corrupção.

---

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
