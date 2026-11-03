# DR-MANAUS | Checkpoint U4.4.1 — Viagem Real para Galáxias Procedurais

**Data:** 03 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline auditado (U4.3.2):** `b842cc8020779e90eac51366289766db63bb4e51`  
**CI Oficial U4.3.2:** GitHub Actions Run `41641242398` (SUCCESS: Typecheck, 638/638 regressões permanentes, 1.517/1.517 testes gerais, Build Vite em 1.13s)  
**Patch Atual:** U4.4.1  

---

## 1. Estado Oficial e Diagnóstico de Bloqueios do U4.3.2

O baseline U4.3.2 foi homologado com 100% de aprovação na automação do CI:
- **Typecheck:** Aprovado
- **Regressões Permanentes:** 638/638 aprovadas
- **Testes Gerais:** 1.517/1.517 aprovados
- **Build de Produção Vite:** Aprovado

A auditoria da arquitetura de viagem identificou 6 limitações fundamentais que impediam o trânsito até galáxias procedurais:
1. **Bloqueio A — `GalaxyEntryResolver`:** Suportava unicamente destinos canônicos (`milky_way` e `andromeda`), lançando exceção (`Unknown galaxy entry`) para qualquer identificador procedural.
2. **Bloqueio B — `GalaxyMaterializer.prepare()`:** Rejeitava galáxias fora de `knownGalaxyRuntime()`, o qual consultava estritamente o catálogo fixo de 2 entradas `LOCAL_GROUP_CATALOG`.
3. **Bloqueio C — `UniverseRuntime.installSystem()`:** Dependia exclusivamente de `knownGalaxyRuntime(address.galaxyId)` para comitar a galáxia ativa do jogador.
4. **Bloqueio D — `ProceduralSystemMaterializer.prepare()`:** Rejeitava galáxias desconhecidas (`!knownGalaxyRuntime(a.galaxyId)`), impedindo a instanciação de sistemas estelares em galáxias descobertas.
5. **Bloqueio E — `StarSector.generateStarSector()`:** Não consultava a morfologia da galáxia procedural, utilizando o perfil legado da Via Láctea como fallback para qualquer galáxia procedural desconhecida.
6. **Bloqueio F — `UniversalTravelPlan` e `addressSeparationM`:** Utilizavam apenas o vetor legado do Grupo Local via `observerGlobalPositionM`. Para galáxias fora do catálogo, a separação retornava `undefined`, inviabilizando o cálculo de rota e duração de voo.

---

## 2. Soluções Implementadas no Patch U4.4.1

### 2.1 Registro Dinâmico e Resolução de `GalaxyRuntime` (`GalaxyCoordinates.ts` e `GalaxyRuntime.ts`)
- `galaxyDefinition(id)` agora resolve identidades canônicas e galáxias procedurais:
  1. Consulta prioritária em `LOCAL_GROUP_CATALOG` (`milky_way`, `andromeda`).
  2. Consulta no cache LRU delimitado de 256 definições procedurais.
  3. Resolução e validação determinística via `parseGalaxyId(id)` e `ProceduralGalaxyGenerator`, rejeitando forjas e gerando a definição canônica com `proceduralMorphology`.
- `knownGalaxyRuntime(id)` instancia e retém a sessão `GalaxyRuntime` correspondente com cache delimitado (128 entradas) e suporte a limpeza (`clearGalaxyRuntimes()`).
- O comportamento e os dados de Via Láctea e Andrômeda permanecem 100% inalterados.

### 2.2 Geração Estelar Fiel à Morfologia Procedural (`StarSector.ts`)
- `generateStarSector(galaxyId, sector, options)` consulta `galaxyDefinition(galaxyId)`.
- Quando a galáxia possui `proceduralMorphology`, a densidade estelar local é calculada diretamente via `evaluateProceduralDensity(galDef.proceduralMorphology, galacticCentrePosM) * densityScale`.
- Avalia fielmente:
  - Concentração central no bulbo esferoidal (`calculateBulgeDensity`).
  - Barra estelar em galáxias barradas (`calculateBarDensity`).
  - Estrutura de disco fino e espesso (`calculateDiskDensity`).
  - Ondas de densidade espiral logarítmica com contraste de braços (`calculateSpiralArmModulation`).
  - Queda suave em direção ao halo (`calculateHaloDensity`).
- Setores galácticos refletem com rigor as características astronômicas geradas para a galáxia.

### 2.3 Resolução Determinística de Sistema de Entrada Seguro (`GalaxyEntryResolver.ts`)
- Implementada a função `proceduralGalaxyEntryDescriptor(galaxyId, catalog)`:
  - Pesquisa determinística em anel situado a $\approx 20\%$ do raio da galáxia (`radiusSectors = BigInt(Math.max(5, Math.floor((diameterLy * 0.2) / 100)))`).
  - Sequência ordenada de setores candidatos (`[r, 0, 0]`, `[r, 1, 0]`, `[r, -1, 0]`, `[r+5, 2, 0]`, `[r/2, 0, 0]`, `[10, 0, 0]`, `[5, 5, 0]`, `[0, 0, 0]`).
  - Seleção de sistema estelar com planetas rochosos e corpos passíveis de pouso.
  - Reproducibilidade estrita: a mesma galáxia procedural resolve exatamente o mesmo sistema de chegada em todas as visitas, sem teletransporte nem aleatoriedade em tempo de execução.
- `GalaxyEntryResolver.resolve()` direciona o alvo de galáxia para o sistema seguro de entrada resolvido.

### 2.4 Handoff Transacional, Preparação e Retorno ao Sol (`ProceduralSystemMaterializer.ts` e `UniversalTravelController.ts`)
- Reutilização integral do `UniversalTravelController` existente, mantendo seu ciclo de vida de fases:
  `spool` $\rightarrow$ `acceleration` $\rightarrow$ `cruise` $\rightarrow$ `deceleration` $\rightarrow$ `arrival-hold` $\rightarrow$ `arrival` $\rightarrow$ `complete`.
- `prepareTravel` prepara simultaneamente:
  1. A sessão da galáxia de destino (`GalaxyMaterializer.prepare(a.galaxyId)`), instanciando seu `StarSectorProvider` exclusivo.
  2. O subsistema estelar U1 (`ProceduralSystemRuntime`), registrando grafos de referenciais inerciais e de corpos.
  3. Posição segura de chegada (`safeSystemArrivalM`) a distância segura de órbitas e corpos físicos, com velocidade de chegada nula.
- **Rollback em Caso de Falha:** Qualquer erro na fase de preparação ou commit aciona o cancelamento, restaura a sessão anterior com a câmera intacta e limpa frames sem vazamento.
- **Retorno ao Sol:** A viagem reversa para `sol` / `milky_way` utiliza o pipeline canônico existente (`prepareSolarReturn`), restaurando integralmente o Sistema Solar e a Via Láctea.

### 2.5 Limites de Precisão Relativística e Separação Cosmológica (`GalaxyCoordinates.ts` e `UniversalTargetResolver.ts`)
- `addressSeparationM(a, ao, b, bo)` integra aritmética cosmológica:
  - Pares de galáxias com endereço cosmológico utilizam `cosmologicalSeparationVectorM(cosmoA, cosmoB)`.
  - Diferença BigInt exata antes da conversão para metros.
  - **Política Explícita de Domínio Seguro:** Para separações superiores a 1024 células cósmicas (~2 Gpc), onde a conversão para Float64 perde resolução métrica, o método retorna `undefined` e impede o planejamento de viagem com coordenadas imprecisas.
- `UniversalTargetResolver`:
  - Galáxias procedurais alcançáveis ($\le 1024$ células) passam do status informativo `'cosmological-future'` para a capacidade de viagem real `'intergalactic'`.
  - Galáxias além do limite seguro permanecem `'cosmological-future'`, com aviso informativo de alcance.

---

## 3. Matriz de Cobertura e Invariantes Arquiteturais

| Subsistema | Invariante | Garantia U4.4.1 |
| :--- | :--- | :--- |
| **Identidade Galáctica** | Determinismo Absoluto | Mesma semente e coordenadas BigInt produzem o mesmo `GalaxyRuntime` e as mesmas estrelas. |
| **Streaming e Descarte** | Provedor Único Ativo | Apenas um `StarSectorProvider` ativo por sessão; providers anteriores são desregistrados e descartados no commit. |
| **Segurança de Chegada** | Corredor Seguro | Chegada sempre em `safeSystemArrivalM` com velocidade local $\vec{v} = (0,0,0)$. |
| **Referenciais de Câmera** | Ausência de Coordenadas Absolutas | A câmera e a cena 3D operam estritamente no referencial local da estrela/sistema (`systemFrameId`). Coordenadas cósmicas BigInt nunca entram na GPU. |
| **Fronteira com BH0-BH2** | Buracos Negros Funcionais Bloqueados | Definições procedurais não instanciam provedores funcionais de buraco negro. |

---

## 4. Testes Automatizados Criados (`tests/procedural-travel.test.ts`)

A nova suíte contém 14 testes cobrindo todas as exigências do U4.4.1:
1. `T_U44_01_DYNAMIC_GALAXY_RUNTIME_REGISTRATION`: Registro e cache de `GalaxyRuntime` procedural.
2. `T_U44_02_CANONICAL_GALAXIES_PRESERVATION`: Preservação formal de Via Láctea e Andrômeda.
3. `T_U44_03_STELLAR_GENERATION_CONFORMS_TO_PROCEDURAL_MORPHOLOGY`: Geração estelar fiel à morfologia com densidade radial descendente.
4. `T_U44_04_DETERMINISTIC_ENTRY_SYSTEM_RESOLUTION`: Resolução determinística e repetível do sistema de entrada.
5. `T_U44_05_PROCEDURAL_TRAVEL_ROUTE_PLANNING`: Criação de plano de viagem com duração balanceada (15 a 30s).
6. `T_U44_06_TRANSACTIONAL_PREPARATION_AND_INSTALLATION`: Commit e troca atômica de galáxia e sistema.
7. `T_U44_07_SAFE_ARRIVAL_CORRIDOR_AND_ZERO_VELOCITY`: Chegada fora de órbitas com velocidade nula.
8. `T_U44_08_RETURN_TRIP_TO_SOLAR_SYSTEM`: Viagem completa de ida para galáxia procedural e retorno ao Sol.
9. `T_U44_09_CANCEL_AND_RESUME_PROCEDURAL_HYPERCRUISE`: Cancelamento em voo, desaceleração para coasting e retomada.
10. `T_U44_10_TRANSACTIONAL_ROLLBACK_ON_PREPARATION_FAILURE`: Rollback atômico em falha de preparação sem estado corrompido.
11. `T_U44_11_REPEATED_JOURNEYS_WITHOUT_PROVIDER_LEAKS`: Múltiplas viagens sequenciais sem duplicação de provedores.
12. `T_U44_12_COSMOLOGICAL_DISTANCES_AND_BIGINT_SAFETY`: Rejeição segura de viagens para alvos $> 1024$ células.
13. `T_U44_13_PRESERVATION_OF_EARTH_ANDROMEDA_HYPERCRUISE`: Hipercruzeiro canônico Terra-Andrômeda e retorno preservados.
14. `T_U44_14_HUD_AND_TELEMETRY_INTEGRITY_POST_ARRIVAL`: Telemetria, endereço e modo `anchored` corretos pós-chegada.

---

## 5. Roteiro Manual de Viagem e Retorno (Operador Humano)

No servidor de desenvolvimento ativo na porta `9999`:
1. **Acessar a Aplicação:** Abra `http://localhost:9999/`.
2. **Decolagem e Espaço Seguro:** Decole da Terra ou posicione a nave em espaço seguro do Sistema Solar.
3. **Abrir Mapa Cósmico e Selecionar Galáxia:**
   - Pressione `M`, selecione a aba **"Cosmos"**.
   - Aproxime/afaste o zoom e selecione uma galáxia procedural (ex.: *Cosmic Discovery DM-PG-...*).
   - Feche o mapa (`M`).
4. **Verificar Alvo Travado no HUD:**
   - O HUD exibe a galáxia procedural selecionada com distância em anos-luz / megaparsecs e status de *Hypercruise intergaláctico disponível*.
5. **Engajar Hypercruise:**
   - Pressione a tecla de engate de viagem intergaláctica.
   - Acompanhe a telemetria: *spool* $\rightarrow$ aceleração $\rightarrow$ cruzeiro $\rightarrow$ desaceleração $\rightarrow$ chegada.
6. **Chegada na Galáxia Procedural:**
   - A transição comita atomicamente o novo sistema estelar.
   - O jogador surge em corredor seguro com velocidade zero.
   - O fundo estelar exibe estrelas geradas pela morfologia da galáxia.
   - Navegue pelo sistema estelar procedural e inspecione seus planetas.
7. **Retorno ao Sistema Solar:**
   - Abra o mapa (`M`) ou selecione Sol no catálogo de alvos.
   - Inicie Hypercruise com destino a Sol.
   - Confirme a chegada e reintegração perfeita ao Sistema Solar na Via Láctea.
