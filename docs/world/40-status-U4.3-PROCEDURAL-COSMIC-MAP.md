# DR-MANAUS | Checkpoint U4.3 / U4.3.1 — Streaming Espacial e Mapa Universal Procedural

**Data:** 03 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline auditado (U4.3):** `0dc9c0070ece4bb9548dd6807dca7647ab31a21f`  
**CI Oficial U4.3:** GitHub Actions Run `41580919276` (FAILURE: 3 erros TS2339 em `ProceduralGalaxyDiscovery.ts`)  

---

## 1. Auditoria do CI e Causas Raízes do U4.3

A auditoria pós-publicação do U4.3 identificou os seguintes problemas:
1. **TS2339 em `ProceduralGalaxyDiscovery.ts` (linhas 341, 345, 346):** O subsistema tentava acessar `context.cosmological`, propriedade inexistente no contrato oficial de `StreamingContext` em `WorldProvider.ts`.
2. **Alegação inoperante de `ManagedSubsystem`:** `ProceduralGalaxyDiscovery` declarava implementar `ManagedSubsystem`, mas seu método `advance()` era vazio e o subsistema não estava registrado em `GlobalStreamingScheduler`.
3. **Seleção de galáxias procedurais no mapa em cache frio:** `CosmologyMapRenderer.hitTest()` gerava chaves no formato `galaxy/galaxy_c...`. `UniversalTargetCatalog.find()` não tratava esse prefixo ao consultar a descoberta, impedindo que o clique travasse o alvo em cache frio.
4. **Caminho de raio zero em `discoverRegion()`:** A consulta com `radiusCells = 0` selecionava `PRECOMPUTED_OFFSETS_R1` por usar `r <= 1`, incluindo células vizinhas indevidamente.
5. **Import inválido em teste unitário:** `tests/procedural-galaxy-map.test.ts` importava `../src/celestial/SolarSystem`, que reside em `src/world/celestial/SolarSystem.ts`.
6. **Perda de precisão e risco de loop infinito na grade cósmica:** `CosmologyMapRenderer.draw()` convertia `centerCell.x` para `Number` e iterava incrementalmente em Float64, suscetível a loops infinitos em magnitudes superiores a $2^{53}$.
7. **Cobertura visual limitada em zoom distante:** O mapa permitia zoom até 120 Mpc, mas `discoverRegion()` limitava a 48 galáxias próximas, deixando a maior parte do campo visual vazia.
8. **Validação de identidades canônicas:** `findGalaxyById()` permitia recuperar galáxias pelo índice na célula sem validar se o ID solicitado correspondia à identidade verdadeira, abrindo brecha para aliases procedurais falsificados de entidades canônicas (ex.: `galaxy_c0_0_0_0` para a Via Láctea).

---

## 2. Correções Implementadas no Patch U4.3.1

### 2.1 Contrato de Streaming e Descoberta (`WorldProvider.ts` e `ProceduralGalaxyDiscovery.ts`)
- `SpatialContext` e `StreamingContext` receberam o campo opcional `readonly cosmological?: CosmologicalAddress`, garantindo compatibilidade futura com endereçamento cosmológico.
- `ProceduralGalaxyDiscovery` removeu a alegação espúria de `implements ManagedSubsystem` (`covers`, `plan`, `advance`, `stats`). A descoberta cósmica em U4.3 é estritamente orientada ao mapa e orçada por consulta síncrona com cache LRU limitado a 128 células. O streaming 3D contínuo pertence a U4.4.
- `discoverRegion()` corrigiu o caminho de raio zero: `if (r === 0)` retorna estritamente as galáxias da célula central. Consultas com `maxGalaxies <= 0` retornam `[]`.
- Adicionado `discoverVisibleRegion(centerCell, zoomMpc, maxGalaxies)`: amostragem plana adaptativa multiescala no plano cosmológico visível com striding determinístico e decimação (1 galáxia por célula amostrada) para campos visuais de até 120 Mpc.
- `findGalaxyById()` agora valida a identidade canônica e rejeita aliases procedurais que tentem forjar entidades do Grupo Local.

### 2.2 Seleção de Alvos e Resolução de Ponta a Ponta (`UniversalTargetCatalog.ts` e `UniversalTargetResolver.ts`)
- `UniversalTargetCatalog.find(query)`: normaliza o prefixo `galaxy/` recebido dos cliques do mapa (`rawId = query.startsWith('galaxy/') ? decodeURIComponent(query.slice(7)) : query`).
- Resolução e armazenamento bidirecional em cache (`target.key` e `objectId`), garantindo que o primeiro clique do jogador em qualquer galáxia do mapa resolva e trave o alvo imediatamente, mesmo em cache frio.
- `UniversalTargetResolver.resolve()`: processa galáxias procedurais antes de checar `entry.globalPositionM`, impedindo que caiam em cálculos de referenciais locais do Grupo Local.
- Cálculo de distâncias cosmológicas baseado em `cosmologicalSeparationVectorM`, com subtrações BigInt exatas antes da conversão para metros.
- Fronteira U4.3/U4.4 estritamente mantida: `travelCapability: 'cosmological-future'` com mensagem *"Navegação intergaláctica procedural disponível em U4.4"*.

### 2.3 Eliminação de Perda de Precisão na Grade Cosmológica (`MapRenderers.ts`)
- `CosmologyMapRenderer.draw()` não converte coordenadas absolutas de células para Float64 em loops.
- A grade itera inteiros relativos pequenos (`relX = -spanCells .. spanCells`, onde `spanCells <= 16`).
- As coordenadas de rótulo são geradas via aritmética BigInt exata: `(this.centerCell.x + BigInt(relX)).toString(10)`.
- Seguro contra coordenadas extremas ($2^{64}$, $-(2^{53}+1)$) e números negativos, com garantia formal de ausência de loops sem progresso.

---

## 3. Contratos de Precisão e Invariantes Numéricas

| Domínio | Escala | Tipo de Dado | Garantia Matemática |
| :--- | :--- | :--- | :--- |
| **Célula Cosmológica** | $2.0 \text{ Mpc}$ ($~6.17 \times 10^{22} \text{ m}$) | `BigInt` | Precisão exata em qualquer distância cósmica, inclusive superior a $2^{53}$ e $2^{64}$. |
| **Offset Local de Célula** | $[-1.0, 1.0] \text{ Mpc}$ | `Float64` (`number`) | Espaçamento ULP $< 10^{-15} \times 1 \text{ Mpc} \approx 30 \text{ m}$ no interior da célula. |
| **Diferença Relativa de Posição** | Distâncias intergalácticas | Subtração BigInt antes de conversão | Elimina cancelamento catastrófico e overflow de representação Float32. |
| **Iteração de Grade do Mapa** | $[-16, 16]$ células | Inteiros pequenos relativos | Elimina estagnação de somador Float64 e loops infinitos. |

---

## 4. Testes Automatizados (`tests/procedural-galaxy-map.test.ts`)

A suíte cobre 9 blocos de testes unitários:
1. `T_U43_01_COSMOLOGICAL_CELL_DISCOVERY_DETERMINISM`:
   - Geração determinística de células idênticas em instâncias independentes.
   - Preservação estrita das 5 entidades do Grupo Local na célula (0,0,0).
   - Descoberta procedural de 1 a 4 galáxias com morfologias válidas da sequência de Hubble.
2. `T_U43_02_BIGINT_CELL_ARBITRARY_MAGNITUDE_AND_SIGNS`:
   - Coordenadas de células na magnitude de $10^{16}$ (muito acima de $2^{53}$).
   - Coordenadas negativas preservadas integralmente na serialização e desserialização (`parseGalaxyId`, `parseCosmologicalCellKey`).
3. `T_U43_03_BOUNDED_LRU_CACHE_EVICTION`:
   - Capacidade máxima respeitada (`maxCachedCells = 8`), prevenindo vazamento de memória sob exploração massiva.
   - Limpeza total com `clearCache()`.
4. `T_U43_04_SPATIAL_REGION_EXPLORATION_LIMITS`:
   - Raio zero estritamente restrito à célula central.
   - Raio um e raio dois.
   - Teto rígido de galáxias (`maxGalaxies`) e retorno de lista vazia para limite zero.
   - Células negativas e independência de ordem de descoberta.
5. `T_U43_05_UNIVERSAL_TARGET_CATALOG_PROCEDURAL_INTEGRATION`:
   - Resolução de alvos procedurais em `UniversalTargetCatalog`.
   - Compatibilidade estrita com `universalTargetKey` (`galaxy/...`).
   - Resolução em cache frio com prefixo `galaxy/` (cenário real do clique no mapa).
   - Rejeição estrita de aliases forjados (`galaxy_c0_0_0_0`, `galaxy_c0_0_0_1`).
   - Preservação de todos os alvos solares e canônicos.
6. `T_U43_06_UNIVERSAL_TARGET_RESOLVER_PROCEDURAL_TRAVEL_SEPARATION`:
   - Separação entre seleção (U4.3) e viagem contínua (U4.4).
   - `travelCapability: 'cosmological-future'` para galáxias procedurais com rótulo descritivo.
   - Cálculo finito e preciso de distância relativa para células próximas e distantes.
7. `T_U43_07_SEARCH_AND_QUERY_RESOLUTION`:
   - Busca por nome canônico, ID procedural, sintaxe de coordenadas de célula (`c:x,y,z`) e prefixo de designação (`DM-PG`).
8. `T_U43_08_COSMOLOGY_AND_GALAXY_MAP_RENDERERS`:
   - Zoom contínuo e clamping de zoom ($[4, 120] \text{ Mpc}$).
   - Amostragem multiescala em 120 Mpc via `discoverVisibleRegion`.
   - Coordenadas BigInt extremas ($2^{64}$ e $-(2^{53}+1)$) sem loops sem progresso nem perda de precisão.
   - Panning com rebase de célula central através de fronteiras.
   - Adaptação morfológica em `GalaxyMapRenderer` para galáxias elípticas e espirais.
9. `T_U43_09_STREAMING_CONTEXT_CONTRACT_AND_BUDGET`:
   - Validação dos contratos de tipo de `SpatialContext` e `StreamingContext` com campo opcional `cosmological`.

---

## 5. Arquivos Alterados no U4.3.1

| Arquivo | Estado | Mudanças no U4.3.1 |
| :--- | :--- | :--- |
| `src/world/providers/WorldProvider.ts` | Modificado | Adicionado campo opcional `cosmological` a `SpatialContext` e `StreamingContext`. |
| `src/world/galaxy/ProceduralGalaxyDiscovery.ts` | Modificado | Removida interface ManagedSubsystem; corrigido raio zero; adicionado `discoverVisibleRegion`; blindagem de aliases canônicos em `findGalaxyById`. |
| `src/world/travel/UniversalTargetCatalog.ts` | Modificado | Suporte a prefixo `galaxy/` em `find()`; resolução em cache frio; cache bidirecional. |
| `src/world/travel/UniversalTargetResolver.ts` | Modificado | Reordenação de resolução procedural antes de globalPositionM; cálculo cosmológico exato de distância. |
| `src/ui/map/MapRenderers.ts` | Modificado | Eliminação de loops Float64 absolutos na grade; integração de `discoverVisibleRegion` para zoom até 120 Mpc. |
| `tests/procedural-galaxy-map.test.ts` | Modificado | Correção do import de `SolarSystem`; cobertura para raio 0, cache frio, BigInt extremo, zoom 120 Mpc e contrato de streaming. |
| `docs/world/15-status.md` | Modificado | Atualização do status consolidado para U4.3.1. |
| `docs/world/40-status-U4.3-PROCEDURAL-COSMIC-MAP.md` | Modificado | Relatório técnico completo do patch U4.3.1. |

---

## 6. Fronteira Funcional com U4.4

- **U4.3.1 (Concluído neste patch):** Descoberta procedural determinística, mapa cosmológico interativo, busca multiescala, seleção de alvos em cache frio e travamento no HUD.
- **U4.4 (Próxima fase - bloqueada até validação do CI):** Hipercruzeiro contínuo intergaláctico até galáxias procedurais, desaceleração, handoff para LODs de partículas GPU (`GalaxyMaterializer`) e chegada.
- **BH0–BH2:** Buracos negros relativísticos e horizontes permanecem estritamente bloqueados.
