# DR-MANAUS | Checkpoint U4.3 — Streaming Espacial e Mapa Universal Procedural

**Data:** 03 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline anterior:** `9fab30fcd114170d4ac3754cadc13dbab9166730` (U4.2.3 aprovado integralmente no GitHub Actions Run 41577361396)  

---

## 1. Contexto e Status de Entrada

O commit baseline `9fab30fcd114170d4ac3754cadc13dbab9166730` (U4.2.3) estabilizou a suíte visual e morfológica no GitHub Actions CI:
- **Typecheck:** Aprovado sem erros de tipagem.
- **Portão Permanente de Regressões:** 638/638 aprovados.
- **Suíte Geral de Testes:** 1.506/1.506 aprovados.
- **Build de Produção (Vite):** Aprovado.

Com a base visual do U4.2.3 estabilizada, o objetivo de **U4.3** é construir o mapa cosmológico procedural, integrando streaming espacial determinístico, catálogo universal de alvos procedurais, busca multiescala e navegação interativa sem violar contratos de física, precisão numérica ou autoridades de viagem existentes.

---

## 2. Decisões de Arquitetura e Engenharia

### 2.1 Descoberta e Streaming de Células Cosmológicas (`ProceduralGalaxyDiscovery.ts`)
1. **Particionamento Espacial em Células BigInt:** O universo cosmológico é particionado em células regulares de $2.0 \text{ Mpc}$ ($~6.523 \text{ Mly}$), endereçadas por triplas inteiras `BigInt3` ($C_x, C_y, C_z$).
2. **Determinismo Estrito:** Baseado em `ProceduralGalaxyGenerator` (U4.1/U4.1.1) utilizando hash FNV-1a de 64 bits com codificação canônica e finalizador SplitMix64 (`GALAXY_GENERATOR_VERSION = 2`). Zero chamadas a `Math.random` ou relógio do sistema.
3. **Orçamento e Cache LRU Bounded:** A autoridade de descoberta mantém um cache LRU estritamente limitado (`maxCachedCells = 128`), garantindo que a exploração livre ou deslocamentos cosmológicos rápidos nunca provoquem vazamento de memória ou alocação descontrolada.
4. **Exploração Concêntrica por Vizinhança:** `discoverRegion(centerCell, radius, maxGalaxies)` realiza busca radial em conchas esféricas concêntricas ordenadas por $dx^2 + dy^2 + dz^2$, priorizando células visíveis próximas ao observador ou centro de visualização do mapa, com teto rígido de galáxias por requisição (`maxGalaxies <= 64`).
5. **Integração com `GlobalStreamingScheduler`:** Implementa a interface `ManagedSubsystem` (`covers`, `plan`, `advance`, `stats`), permitindo controle centralizado do orçamento de quadros.

### 2.2 Integração ao Catálogo Universal (`UniversalTargetCatalog.ts` e `UniversalTargetResolver.ts`)
1. **Preservação de Entidades Canônicas:** A célula `(0, 0, 0)` mantém intacto o Grupo Local canônico:
   - Via Láctea (`milky_way`), Andrômeda (`andromeda`), Triângulo (`triangulum`), Grande Nuvem de Magalhães (`large_magellanic_cloud`), Pequena Nuvem de Magalhães (`small_magellanic_cloud`).
   - Todos os alvos do Sistema Solar, âncoras cósmicas e horizonte observável permanecem inalterados.
2. **Alvos Galácticos Procedurais:**
   - Contrato canônico: `kind: 'galaxy'`, `objectId: id`, `galaxyId: id`, chave estável `galaxy/${encodeURIComponent(galaxyId)}`.
   - Compatível com a gramática de `universalTargetKey` sem introduzir campos espúrios.
3. **Fronteira Funcional Estrita entre U4.3 e U4.4 (Seleção vs. Viagem):**
   - Em U4.3, galáxias procedurais são **selecionáveis**, **pesquisáveis** e **exploráveis** no mapa.
   - O resolvedor atribui `domain: 'cosmological'` e `travelCapability: 'cosmological-future'` para galáxias procedurais.
   - O rótulo da capacidade é explicitamente apresentado na UI: *"Navegação intergaláctica procedural disponível em U4.4"*, impedindo acionamento indevido de trânsito contínuo antes da homologação da fase U4.4.
   - Alvos canônicos existentes (ex: Andrômeda) preservam `travelCapability: 'intergalactic'`, mantendo 100% funcional o hipercruzeiro de U3.

### 2.3 Renderização do Mapa Cosmológico e Galáctico (`MapRenderers.ts`)
1. **`CosmologyMapRenderer`:**
   - Substituição do protótipo estático de pontos pseudo-aleatórios por renderizador cosmológico funcional baseado em células $2 \text{ Mpc}$.
   - Grade cosmológica com linhas de células e coordenadas `[x, y]` em coordenadas relativas.
   - Diferenciação morfológica visual:
     - **Espirais (Sa, Sb, Sc):** Núcleo brilhante, disco elíptico inclinado e arcos espirais azul-celestes (`#38bdf8`).
     - **Espirais Barradas (SBa, SBb, SBc):** Barra central orientada pelo ângulo intrínseco com braços espirais a partir das pontas (`#c084fc`).
     - **Elípticas (E0, E3, E7):** Gradiente suave esferoidal âmbar/dourado (`#fbbf24`), com achatamento proporcional à excentricidade real.
     - **Lenticulares (S0):** Disco lenticular brilhante sem braços (`#e2e8f0`).
     - **Irregulares (Irr):** Aglomerados estelares assimétricos mosqueados ciano/magenta (`#34d399` / `#38bdf8`).
   - Destaque canônico com anéis para o Grupo Local e retícula vermelha (`#ef4444`) para a galáxia atual do jogador.
   - Zoom contínuo (`zoomMpc` de 4 a 120 Mpc) e translação espacial com mouse drag (pan).
   - Teste de impacto (`hitTest`) retornando chaves canônicas de alvos para seleção direta.
2. **`GalaxyMapRenderer`:**
   - Adaptativo à morfologia da galáxia inspecionada (`location.address.galaxyId` ou alvo selecionado).
   - Espirais desenham o número exato de braços ($N_{\text{arms}} = 2$ ou $4$), ângulo de abertura (pitch angle) e barra central caso ativa.
   - Galáxias elípticas renderizam contornos esferoidais sem inventar braços espirais inexistentes.

### 2.4 Interface e Experiência de Navegação (`UniversalMapPanel.ts`)
1. **Controles Interativos:**
   - Roda do mouse no nível `cosmology` ajusta zoom multiescala.
   - Arraste do mouse (drag-to-pan) desloca a visão cosmológica rebaseando as células centrais sem descontinuidade.
   - Clique em qualquer galáxia no mapa cosmológico seleciona o alvo correspondente.
2. **Ficha de Alvo Expandida:** Apresenta tipo morfológico Hubble, diâmetro óptico em anos-luz, população estelar estimada em bilhões, coordenadas da célula BigInt e classificação (canônica vs procedural).
3. **Busca e Localização:** Campo de coordenadas e busca aceita IDs procedurais (`galaxy_c...`), coordenadas de células (`c:10,20,-30`), designações procedurais (`DM-PG ...`) e nomes canônicos.

---

## 3. Contratos de Precisão e Invariantes Numéricas

| Domínio | Escala | Tipo de Dado | Garantia Matemática |
| :--- | :--- | :--- | :--- |
| **Célula Cosmológica** | $2.0 \text{ Mpc}$ ($~6.17 \times 10^{22} \text{ m}$) | `BigInt` | Precisão exata em qualquer distância cósmica, inclusive superior a $2^{53}$ e $2^{64}$. |
| **Offset Local de Célula** | $[-1.0, 1.0] \text{ Mpc}$ | `Float64` (`number`) | Espaçamento ULP $< 10^{-15} \times 1 \text{ Mpc} \approx 30 \text{ m}$ no interior da célula. |
| **Diferença Relativa de Posição** | Distâncias intergalácticas | Subtração BigInt antes de conversão | Elimina cancelamento catastrófico e overflow de representação Float32. |
| **Posição Absoluta Float64 Legada** | $\|C\| \le 1024n$ | `Float64` ou `undefined` | Conversão direta para metros apenas dentro do domínio delimitado (`cosmologicalPositionM`). |

---

## 4. Testes Automatizados Adicionados (U4.3)

Arquivo de testes: `tests/procedural-galaxy-map.test.ts`
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
   - Teto rígido de galáxias por consulta (`maxGalaxies`).
   - Priorização radial da célula central.
5. `T_U43_05_UNIVERSAL_TARGET_CATALOG_PROCEDURAL_INTEGRATION`:
   - Resolução de alvos procedurais em `UniversalTargetCatalog`.
   - Compatibilidade estrita com `universalTargetKey` (`galaxy/...`).
   - Preservação de todos os alvos solares e canônicos.
6. `T_U43_06_UNIVERSAL_TARGET_RESOLVER_PROCEDURAL_TRAVEL_SEPARATION`:
   - Separação entre seleção (U4.3) e viagem contínua (U4.4).
   - `travelCapability: 'cosmological-future'` para galáxias procedurais com rótulo descritivo.
   - Cálculo finito e preciso de distância relativa para células próximas e distantes.
7. `T_U43_07_SEARCH_AND_QUERY_RESOLUTION`:
   - Busca por nome canônico, ID procedural, sintaxe de coordenadas de célula (`c:x,y,z`) e prefixo de designação (`DM-PG`).
8. `T_U43_08_COSMOLOGY_AND_GALAXY_MAP_RENDERERS`:
   - Zoom contínuo e clamping de zoom ($[4, 120] \text{ Mpc}$).
   - Panning com rebase de célula central através de fronteiras.
   - Adaptação morfológica em `GalaxyMapRenderer` para galáxias elípticas e espirais.

---

## 5. Arquivos Alterados e Novos no U4.3

| Arquivo | Estado | Responsabilidade no U4.3 |
| :--- | :--- | :--- |
| `src/world/galaxy/ProceduralGalaxyDiscovery.ts` | **Novo** | Autoridade de streaming e busca de galáxias procedurais com cache LRU limitado e `ManagedSubsystem`. |
| `src/world/travel/UniversalTargetCatalog.ts` | Modificado | Integração da descoberta procedural, resolução de chaves galácticas e cache bounded de alvos. |
| `src/world/travel/UniversalTargetResolver.ts` | Modificado | Cálculo de distância cosmológica e separação estrita da capacidade de viagem para U4.4. |
| `src/ui/map/MapRenderers.ts` | Modificado | `CosmologyMapRenderer` multi-escala procedural e `GalaxyMapRenderer` adaptativo à morfologia. |
| `src/ui/map/UniversalMapPanel.ts` | Modificado | Zoom/pan interativo na cosmologia, ficha estendida de alvo procedural e busca integrada. |
| `tests/procedural-galaxy-map.test.ts` | **Novo** | Suíte de testes unitários para streaming, catálogo e renderizadores do mapa. |
| `docs/world/15-status.md` | Modificado | Atualização do status arquitetural consolidado para o checkpoint U4.3. |
| `docs/world/40-status-U4.3-PROCEDURAL-COSMIC-MAP.md` | **Novo** | Documento técnico de especificação e evidência da fase U4.3. |

---

## 6. Fronteira Funcional com Fases Subsequentes

- **U4.3 (Concluído neste commit):** Descoberta, exploração no mapa, busca, seleção de alvos procedurais e renderização morfológica esquemática.
- **U4.4 (Próxima fase):** Trânsito contínuo por hipercruzeiro intergaláctico até galáxias procedurais, desaceleração assintótica, materialização em tempo de execução via `GalaxyMaterializer` e handoff de chegada.
- **BH0–BH2:** Buracos negros relativísticos, lentes gravitacionais e horizontes continuam estritamente bloqueados.
