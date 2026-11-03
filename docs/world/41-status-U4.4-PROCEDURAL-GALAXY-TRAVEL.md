# DR-MANAUS | Checkpoint U4.4.4 — Hardening de Performance e Integridade da Viagem

**Data:** 03 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline auditado (U4.4.3):** `cc07b1c04b97d665c353b8c8d58513986494d6ca`  
**CI Oficial U4.4.3:** GitHub Actions Run `41662450492` (SUCCESS: Typecheck aprovado, 638/638 regressões permanentes, 1.533/1.533 testes gerais, build Vite aprovado em 1,28s)  
**Patch Atual:** U4.4.4  

---

## 1. Auditoria e Diagnóstico Pós-U4.4.3

Com o U4.4.3 integralmente aprovado no CI oficial, a auditoria arquitetural identificou dois riscos P0 de performance e integridade antes do teste visual de voo:

1. **P0 — Busca Pesada de Setores no Loop Contínuo de Renderização:**
   - No fluxo `Game.update() -> NavigationTargetState.validate() -> UniversalTargetResolver.resolve()`, a resolução do alvo era invocada a cada frame (60 FPS).
   - Para galáxias procedurais, `resolve()` chamava `hasProceduralGalaxyEntry(t.galaxyId, this.catalog)`.
   - Se a galáxia alvo não possuísse um sistema de entrada válido nos 13 setores candidatos, o U4.4.3 lançava erro, mas **não memorizava falhas** (apenas sucessos eram cacheados).
   - Como resultado, a mesma varredura determinística de até 13 setores estelares (geração de estrelas, ephemerides e perfis de corpos celestes) era recalculada repetidamente a cada frame (~16 ms), causando congelamento de interface e microstuttering.
   - *Correção de Alegação Anterior:* Alegações preliminares de ~0,001 ms por consulta no U4.4.3 não refletiam o pior caso algorítmico sem cache negativo. O U4.4.4 separa estritamente a complexidade teórica, a medição em execução e a validação visual.

2. **P0 — Contrato de Identidade do Cache de Entradas e Risco de Poluição Cruzada:**
   - Em `GalaxyEntryResolver.ts`, `resolvedEntryCache` utilizava como chave apenas `galaxyId`.
   - Além disso, consultava o cache antes de sincronizar deterministicamente a semente do catálogo recebido.
   - Cenário de colisão: se o Catálogo A (Seed A) resolvesse um sistema de entrada para `galaxy_c10_20_30_0`, e o Catálogo B (Seed B) consultasse a mesma galáxia, o Catálogo B recuperava o sistema gerado na Seed A, violando a integridade morfológica da semente.

3. **P1 — Autoridade Global de Semente e Coexistência de Runtimes:**
   - A chamada `setProceduralUniverseSeed()` limpava indiscriminadamente todos os runtimes procedurais, o que desestabilizava planos de viagem já em curso se outra consulta em segundo plano tocasse outro catálogo.
   - Definições e runtimes precisam ser isolados deterministicamente por chave composta `(seed, id)`.

---

## 2. Correções Implementadas no Patch U4.4.4

### 2.1 Remoção da Busca Pesada no Loop do HUD (`UniversalTargetResolver.ts`)
- [`UniversalTargetResolver.ts`](file:///c:/Projetos/Dr-Manaus/src/world/travel/UniversalTargetResolver.ts) não invoca mais geração de setores durante a validação por frame:
  ```typescript
  const entryStatus = peekProceduralGalaxyEntry(t.galaxyId, this.catalog.discovery.universeSeed);
  capability = entryStatus === false ? 'cosmological-future' : 'intergalactic';
  ```
- O método `peekProceduralGalaxyEntry()` opera em complexidade $O(1)$ direta no mapa de memória:
  - Se for `false` (confirmado sem entrada via cache negativo), reporta `'cosmological-future'`.
  - Se for `true` ou `undefined`, mantém a elegibilidade como candidato `'intergalactic'`.
  - A varredura real pesada de 13 setores candidatos é executada **uma única vez** no momento de engajamento do voo em `createTravelPlan()`.

### 2.2 Cache de Entrada com Chave de Semente e Cache Negativo (`GalaxyEntryResolver.ts`)
- [`GalaxyEntryResolver.ts`](file:///c:/Projetos/Dr-Manaus/src/world/travel/GalaxyEntryResolver.ts) implementa chave composta:
  ```typescript
  function entryCacheKey(seed: bigint, galaxyId: string): string {
    return `${seed.toString(16)}:${galaxyId}`;
  }
  const resolvedEntryCache = new Map<string, ProceduralTargetDescriptor | null>();
  ```
- Sincronização explícita da semente do catálogo antes de qualquer consulta ao cache ou instanciação de runtime.
- **Cache Negativo:** Se nenhum dos 13 setores candidatos contiver um sistema com corpos rochosos pousáveis, o resultado `null` é registrado na chave `(seed, galaxyId)`. Consultas subsequentes falham em $O(1)$ sem gerar uma única estrela.

### 2.3 Isolamento Multissemente em Coordenadas, Runtimes e Setores
- [`GalaxyCoordinates.ts`](file:///c:/Projetos/Dr-Manaus/src/world/galaxy/GalaxyCoordinates.ts):
  - Definições de galáxias procedurais indexadas por `galaxyDefCacheKey(seed, id)`.
  - Assinaturas `galaxyDefinition`, `galaxyCosmologicalAddress`, `observerGlobalPositionM` e `addressSeparationM` aceitam `universeSeed` explícito opcional (padrão: `activeUniverseSeed`).
- [`GalaxyRuntime.ts`](file:///c:/Projetos/Dr-Manaus/src/world/galaxy/GalaxyRuntime.ts):
  - Runtimes procedurais indexados por `${seed}:${id}`; galáxias canônicas mantêm chaves imutáveis.
  - `generateSector()` propaga deterministicamente a semente morfológica para o gerador de setores.
- [`StarSector.ts`](file:///c:/Projetos/Dr-Manaus/src/world/celestial/StarSector.ts):
  - `generateStarSector(galaxyId, sector, options)` aceita `options.universeSeed` e propaga à busca de `galaxyDefinition`.
- [`UniversalTravelPlan.ts`](file:///c:/Projetos/Dr-Manaus/src/world/travel/UniversalTravelPlan.ts):
  - `createTravelPlan` passa `catalog.discovery.universeSeed` ao calcular `addressSeparationM`.

---

## 3. Matriz de Testes Automatizados Expandida (20 Testes)

Em [`tests/procedural-travel.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/procedural-travel.test.ts), 4 novos testes foram adicionados utilizando contadores determinísticos de geração (sem depender de thresholds temporais voláteis em CI):

1. **`T_U44_17_NEGATIVE_ENTRY_CACHING_PREVENTS_REPEATED_SEARCHES`:**
   - Localiza uma galáxia sem sistema de entrada nos 13 setores candidatos.
   - Instrumenta o runtime com interceptor de chamadas para `generateSector`.
   - Executa 100 queries consecutivas de `hasProceduralGalaxyEntry`: comprova **exatamente 0 gerações estelares** nas 100 chamadas graças ao cache negativo.
2. **`T_U44_18_INTERLEAVED_MULTI_SEED_CATALOG_ISOLATION`:**
   - Cria Catálogo A (Seed A) e Catálogo B (Seed B) e consulta o mesmo ID galáctico alternadamente em loop.
   - Comprova que `defA.diameterLy !== defB.diameterLy`, `runtimeA !== runtimeB` e que consultas intercaladas não contaminam ou sobrescrevem os dados da outra semente.
3. **`T_U44_19_HUD_PER_FRAME_VALIDATION_ZERO_HEAVY_GENERATION`:**
   - Alvo travado em galáxia procedural ainda não preparada.
   - Simula 120 frames a 60 FPS de `NavigationTargetState.validate(resolver)`.
   - Comprova **0 gerações de setores estelares** no caminho crítico contínuo do HUD.
4. **`T_U44_20_PREPARED_DESTINATION_IDENTITY_PRESERVED_DURING_TRAVEL`:**
   - Inicia viagem Hypercruise para uma galáxia procedural.
   - Interpola voo até cruzeiro.
   - Dispara consultas de fundo a outro catálogo com semente estrangeira.
   - Conclui o voo e comprova que a nave chega ao destino exato originalmente preparado, sem desvio ou colisão de referencial.

---

## 4. Roteiro de Validação Visual Manual (Operador Humano)

Com o servidor local ativo em `http://localhost:9999/`:
1. **Decolagem:** A partir da Terra, decole para espaço seguro fora da atmosfera.
2. **Mapa Cosmos:** Pressione `M`, selecione a aba Cosmos e escolha uma galáxia procedural (ex.: `galaxy_c10_20_30_0`).
3. **HUD Fluido:** Confirme que a seleção do alvo ocorre sem quedas de framerate ou congelamentos.
4. **Hypercruise:** Pressione a tecla de viagem intergaláctica. Observe a rampa de aceleração $C^2$ suave, cruzeiro e desaceleração.
5. **Chegada:** Verifique a transição para o sistema estelar de entrada, presença de planetas rochosos navegáveis e velocidade local nula.
6. **Retorno:** Selecione o Sol, ative o voo de volta e confirme o retorno bem-sucedido ao Sistema Solar.
7. **Canônicas:** Repita o teste para Andrômeda e confirme a integridade contínua do Local Group.

---

## 5. Riscos Restantes

- **Homologação no CI:** Aguarda validação oficial do commit no GitHub Actions.
- **Teste Visual de Navegador:** Permanece como validação manual humana indispensável antes de declarar o marco U4 concluído.
