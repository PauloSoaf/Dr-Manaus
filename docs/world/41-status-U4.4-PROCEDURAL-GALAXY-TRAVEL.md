# DR-MANAUS | Checkpoint U4.4.2 — Correção do CI e Integridade da Viagem Procedural

**Data:** 03 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline auditado (U4.4.1):** `e46d10d29ae6789ba7c7e7d47d19d30e935d3352`  
**CI Oficial U4.4.1:** GitHub Actions Run `41653156652` (FAILURE: 2 erros TS2305 em `GalaxyCoordinates.ts`)  
**Último Baseline Verde:** `b842cc8020779e90eac51366289766db63bb4e51` (U4.3.2, Run `41641242398`)  
**Patch Atual:** U4.4.2  

---

## 1. Auditoria e Diagnóstico da Reprovação do U4.4.1

O commit `e46d10d29ae6789ba7c7e7d47d19d30e935d3352` (U4.4.1) foi reprovado na etapa de **Typecheck** do GitHub Actions:
- `TS2305: Module './ProceduralGalaxyGenerator' has no exported member 'parseGalaxyId'`.
- `TS2305: Module './ProceduralGalaxyGenerator' has no exported member 'DEFAULT_UNIVERSE_SEED'`.

A auditoria minuciosa do código revelou 5 problemas estruturais e de integridade física/cosmológica:
1. **P0 — Imports Provenientes do Módulo Incorreto (`GalaxyCoordinates.ts`):** `parseGalaxyId` e `DEFAULT_UNIVERSE_SEED` pertencem e são exportados por `ProceduralGalaxyDiscovery.ts`.
2. **P0 — Dupla Multiplicação de Escala de Densidade Estelar (`StarSector.ts`):** `evaluateProceduralDensity` já multiplica intrinsecamente pela escala morfológica `descriptor.densityScale`. O código anterior multiplicava novamente por `galDef.densityScale`, aplicando a escala ao quadrado.
3. **P0 — Origem Cosmológica Incorreta no Runtime (`UniverseRuntime.ts`):** O getter `location.cosmological` utilizava fallback fixo `(0,0,0)` com offset nulo para todas as galáxias não procedurais, fazendo com que o jogador em Andrômeda reportasse incorretamente a origem da Via Láctea.
4. **P1 — Separação Intergaláctica Sem Deslocamento Local (`GalaxyCoordinates.ts`):** `addressSeparationM` utilizava puramente os centros cosmológicos das galáxias, ignorando o setor de saída, offset submétrico do observador e sistema de chegada com as orientações intrínsecas de cada galáxia.
5. **P1 — Resolução de Entrada com Fallback Inválido (`GalaxyEntryResolver.ts`):** `proceduralGalaxyEntryDescriptor` permitia selecionar sistemas com 0 planetas como fallback e varria apenas 8 setores, arriscando quedas em sistemas estelares desabitados.
6. **P1 — Divergência Potencial de Semente e Identidade:** Risco de discordância entre o catálogo de alvos e o runtime quando descobertas utilizam sementes personalizadas.

---

## 2. Correções Implementadas no Patch U4.4.2

### 2.1 Correção dos Módulos e Autoridade de Semente (`GalaxyCoordinates.ts`)
- Segregação correta das importações:
  - `parseGalaxyId` e `DEFAULT_UNIVERSE_SEED` importados de `./ProceduralGalaxyDiscovery`.
  - `ProceduralGalaxyGenerator` e `cosmologicalSeparationVectorM` importados de `./ProceduralGalaxyGenerator`.
- Ausência de dependência circular: `ProceduralGalaxyDiscovery` não importa `GalaxyCoordinates`.
- Implementação de autoridade configurável de semente:
  - `setProceduralUniverseSeed(seed: bigint)` e `getProceduralUniverseSeed(): bigint`.
  - `clearProceduralGalaxyDefinitions()` limpa o cache de definições e redefine a semente para `DEFAULT_UNIVERSE_SEED`.
  - `galaxyDefinition(id)` utiliza a semente ativa, mantendo coerência absoluta com o catálogo de descoberta.

### 2.2 Deslocamentos Tridimensionais Locais em Trajetos Intergalácticos (`GalaxyCoordinates.ts`)
- A função `addressSeparationM(a, ao, b, bo)` foi aprimorada:
  - Calcula a separação métrica entre os centros cosmológicos via `cosmologicalSeparationVectorM`.
  - Projeta a posição 3D local do ponto de origem `localA` no referencial da galáxia A (considerando setor, offset métrico e matriz de orientação de Euler).
  - Projeta a posição 3D local do sistema de chegada `localB` no referencial da galáxia B.
  - O vetor total de separação é: $\vec{r}_{total} = \vec{r}_{sep} + \vec{r}_{localB} - \vec{r}_{localA}$.
  - A distância euclidiana final $d = \|\vec{r}_{total}\|$ reflete com precisão os sistemas reais de saída e entrada, preservando a distância canônica Terra-Andrômeda (~2.48 milhões de anos-luz).

### 2.3 Densidade Estelar Fiel e Não Duplicada (`StarSector.ts`)
- `evaluateProceduralDensity(galDef.proceduralMorphology, galacticCentrePosM)` já incorpora a escala intrínseca de morfologia.
- `generateStarSector()` agora aplica estritamente o modificador opcional de geração por setor:
  `density = evaluateProceduralDensity(galDef.proceduralMorphology, galacticCentrePosM) * sectorOptionScale`.
- Para galáxias canônicas (Via Láctea e Andrômeda), a escala do catálogo continua aplicada normalmente.

### 2.4 Telemetria e Coordenadas Cosmológicas Ativas (`UniverseRuntime.ts`)
- O getter `UniverseRuntime.location` agora consulta a autoridade central `galaxyCosmologicalAddress(this.activeGalaxy.id)`:
  - Via Láctea: `cell: (0,0,0)`, `localMpc: [0, 0, 0]`.
  - Andrômeda: `cell: (0,0,0)`, `localMpc: [0, 0.767, 0]`.
  - Triângulo: `cell: (0,0,0)`, `localMpc: [0, 0.84, 0]`.
  - Galáxias procedurais: `proceduralMorphology.cosmologicalAddress`.
  - Fallback defensivo: `cell: (0,0,0)`, `localMpc: [0, 0, 0]`.
- Garante que a telemetria, HUD e `UniversalTargetResolver` operem a partir da posição cosmológica verídica do observador.

### 2.5 Resolução Determinística e Garantia de Entrada Válida (`GalaxyEntryResolver.ts`)
- Ampliação do leque de candidatos para **13 setores determinísticos**:
  - Eixos cardeais no raio médio (~20% do diâmetro): `[+r, 0, 0]`, `[+r, 1, 0]`, `[+r, -1, 0]`, `[-r, 0, 0]`, `[0, +r, 0]`, `[0, -r, 0]`.
  - Diagonais nos 4 quadrantes: `[+r/2, +r/2, 0]`, `[-r/2, +r/2, 0]`, `[+r/2, -r/2, 0]`, `[-r/2, -r/2, 0]`.
  - Anéis intermediários e núcleo: `[+r/2, 0, 0]`, `[0, +r/2, 0]`, `[0, 0, 0]`.
- **Política Estrita de Entrada:**
  - Rejeita qualquer estrela sem planetas (`star.planetCount <= 0`).
  - Destino prioritário: sistema com planeta rochoso e lua passível de pouso (`canLand`).
  - Destino secundário: sistema com planeta rochoso passível de pouso.
  - Se nenhum sistema satisfizer a política, lança exceção controlada `Error('No populated and landable entry system in procedural galaxy ' + galaxyId)`. Zero fabricação de destinos inválidos.

### 2.6 Sincronização de Descoberta e Catálogo (`UniversalTargetCatalog.ts` e `ProceduralGalaxyDiscovery.ts`)
- Adicionado `ProceduralGalaxyDiscovery.getGalaxyDefinition(id)`.
- `UniversalTargetCatalog` sincroniza imediatamente a semente ativa e registra as definições descobertas em `registerProceduralGalaxyDefinition(def)`.
- Elimina caches divergentes entre o mapa cósmico, catálogo e runtime espacial.

---

## 3. Matriz de Verificação dos Testes Automatizados (`tests/procedural-travel.test.ts`)

A suíte foi reformulada com tipagem estrita (zero `any`) e expandida para 16 testes oficiais:
1. `T_U44_01_DYNAMIC_GALAXY_RUNTIME_REGISTRATION`: Resolução dinâmica e cache de `GalaxyRuntime` procedural.
2. `T_U44_02_CANONICAL_GALAXIES_PRESERVATION`: Preservação formal de Via Láctea e Andrômeda com SMBHs.
3. `T_U44_03_STELLAR_GENERATION_CONFORMS_TO_PROCEDURAL_MORPHOLOGY`: Validação de densidade morfológica e comprovação de ausência de dupla escala de densidade.
4. `T_U44_04_DETERMINISTIC_ENTRY_SYSTEM_RESOLUTION`: Resolução determinística exigindo planetas e superfícies pousáveis.
5. `T_U44_05_PROCEDURAL_TRAVEL_ROUTE_PLANNING`: Planejamento de rota intergaláctica com duração calibrada.
6. `T_U44_06_TRANSACTIONAL_PREPARATION_AND_INSTALLATION`: Transação atômica e substituição de provedores.
7. `T_U44_07_SAFE_ARRIVAL_CORRIDOR_AND_ZERO_VELOCITY`: Chegada segura com velocidade exatamente nula fora da zona estelar perigosa.
8. `T_U44_08_RETURN_TRIP_TO_SOLAR_SYSTEM`: Viagem de ida e volta completa entre Sol e galáxia procedural.
9. `T_U44_09_CANCEL_AND_RESUME_PROCEDURAL_HYPERCRUISE`: Interrupção em voo, desaceleração emergencial e retomada.
10. `T_U44_10_TRANSACTIONAL_ROLLBACK_ON_PREPARATION_FAILURE`: Rollback atômico em falha de preparação.
11. `T_U44_11_REPEATED_JOURNEYS_WITHOUT_PROVIDER_LEAKS`: Ciclos repetidos garantindo provedor único ativo.
12. `T_U44_12_COSMOLOGICAL_DISTANCES_AND_BIGINT_SAFETY`: Validação de sensibilidade métrica a offsets locais e limite BigInt (> 1024 células).
13. `T_U44_13_PRESERVATION_OF_EARTH_ANDROMEDA_HYPERCRUISE`: Hipercruzeiro Terra-Andrômeda e verificação das coordenadas cosmológicas de Andrômeda (`localMpc: [0, 0.767, 0]`).
14. `T_U44_14_HUD_AND_TELEMETRY_INTEGRITY_POST_ARRIVAL`: Integridade de telemetria e HUD ancorado na chegada.
15. `T_U44_15_MORPHOLOGY_DIVERSITY_ENTRY_VALIDATION`: Validação de sistemas de entrada em galáxias espirais, barradas, elípticas e irregulares.
16. `T_U44_16_CUSTOM_SEED_CONSISTENCY_AND_AUTHORITY`: Consistência e compartilhamento único de semente e definições entre catálogo e coordenadas.

---

## 4. Procedimento de Validação Manual (Operador Humano)

No servidor de desenvolvimento ativo na porta `9999`:
1. Abra o navegador em `http://localhost:9999/`.
2. Decole da Terra ou posicione a nave em órbita segura.
3. Pressione `M`, acesse a aba **"Cosmos"** e selecione uma galáxia procedural (ex.: `galaxy_c1_2_3_0`).
4. Trave o alvo no HUD e engaje o Hypercruise intergaláctico.
5. Observe a sequência completa de voo: *spool* $\rightarrow$ aceleração $\rightarrow$ cruzeiro $\rightarrow$ desaceleração $\rightarrow$ chegada no sistema estelar procedural.
6. Verifique o HUD exibindo a galáxia procedural, a estrela de entrada e seus planetas rochosos.
7. Selecione o Sol no catálogo ou mapa e inicie a rota de retorno, confirmando a reintegração com o Sistema Solar.
