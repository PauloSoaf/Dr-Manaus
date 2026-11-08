# Status Report — U4.5.1 Cosmic Exploration Experience

**Date**: 2026-11-07
**Branch**: `feat/universe-map`
**Baseline**: Commit `97c6ad14c67b8316201ce83c2a56ffe3c096a294` (U4.4.9 CI Approved)

---

## 1. Melhorias Visuais Realizadas

O patch **U4.5.1** eleva a experiência de exploração cósmica do DR-MANAUS em quatro frentes integradas, preservando todas as autoridades espaciais (`UniverseAddress`, `FloatingOrigin3D`, `UniversalTravelController`, `GalaxyEntryResolver` e identidade por seed de `GalaxyRuntime`):

- **Hypercruise Cinematográfico (`src/rendering/HypercruisePresentation.ts`)**:
  - Substituição das 384 linhas monocromáticas uniformes por um túnel relativístico multicamada com cores por vértice (`vertexColors`), paralaxe radial (filamentos internos rápidos vs marcadores externos profundos), paleta diferenciada entre domínio `interstellar` (azul-ciano Cerenkov) e `intergalactic` (violeta-índigo profundo com cauda âmbar), interpolação exponencial suave independente de taxa de quadros (`1 - Math.exp(-dt * 9.5)`) e modo opcional `reducedMotion`.
- **Proxies de Galáxias Procedurais em Trânsito (`src/rendering/HypercruisePresentation.ts`)**:
  - Galáxias procedurais agora recebem proxies morfológicos reais durante o trânsito intergaláctico, resolvidos a partir da `universeSeed` correta via `galaxyDefinition(id, seed)` e `resolveGalaxyDescriptor(def)`.
- **Mapa Cosmos e Mapa Galáxia (`src/ui/map/MapRenderers.ts`)**:
  - Silhuetas morfológicas 2D aprimoradas (`spiral`, `barred-spiral`, `elliptical`, `irregular`) respeitando orientação (`orientationEulerRad`) e achatamento (`axisRatio`), anéis de estado distintos (canônica `#38bdf8`, atual `#ef4444`, selecionada `#facc15`, hover `rgba(224,242,254,0.85)`) e desambiguação inteligente de rótulos.
- **Painel de Destino e Telemetria (`src/ui/map/UniversalMapPanel.ts`, `src/ui/HypercruiseTelemetry.ts`)**:
  - Reorganização do `#universal-target-card` em 4 blocos hierárquicos (**IDENTIDADE**, **POSIÇÃO**, **EXPLORAÇÃO**, **NAVEGAÇÃO**) e telemetria enriquecida com fase descritiva, galáxia de destino e separação explícita entre velocidade FTL efetiva e velocidade física local (`0 m/s · FRAME ANCORADO`).

---

## 2. Alterações no Mapa Cosmos e Painel de Destino

1. **Correção do Cache de Região Visível (`CosmologyMapRenderer`)**:
   - Anteriormente, `cachedVisibleKey` dependia apenas de `centerCell` e `zoomMpc`. Deslocamentos sub-célula (`panOffsetMpc` dentro de $\pm 2,0\,\text{Mpc}$) podiam deslocar a janela visual sem atualizar o conjunto de galáxias descobertas nas bordas.
   - Agora a chave de cache incorpora `universeSeed`, `effectiveCenterCell` (deslocado por `Math.round(panOffsetMpc / COSMOLOGICAL_CELL_SIZE_MPC)`), `effectiveSpanMpc` com margem de pan e buckets de meio-Mpc (`panBucketX`, `panBucketY`), preservando aritmética `BigInt3` exata e evitando redescobertas em redraws ociosos.
2. **Navegação e Interação**:
   - `changeZoom(deltaY, cursorX?, cursorY?)` mantém o ponto sob o cursor ancorado durante o zoom no mapa Cosmos.
   - `updateHover(x, y)` atualiza o destaque sob o cursor e o estilo de ponteiro (`pointer` / `grab` / `grabbing`).
   - `hitTest(x, y)` prioriza o marcador mais próximo do clique dentro do raio de seleção.
3. **Hierarquia do Painel de Destino (`#universal-target-card`)**:
   - **IDENTIDADE**: Nome, tipo e classificação (`Canônica` vs `Procedural Sintética`) + chave canônica.
   - **POSIÇÃO**: Galáxia, célula cosmológica `[x, y, z]` ou setor `x,y,z` e distância formatada.
   - **EXPLORAÇÃO**: Morfologia Hubble e família (`spiral`, `barred-spiral`, `elliptical`, `irregular`), diâmetro em `kly`, estrelas estimadas e estado de materialização (`sim` / `não`).
   - **NAVEGAÇÃO**: Capacidade real (`travelCapabilityLabel`), diagnóstico explícito de prontidão ou razão de bloqueio e dica do atalho `[P]`.

---

## 3. Comportamento por Fase de Hypercruise

| Fase | Comportamento Visual (`targetPhaseProfile`) |
| :--- | :--- |
| `spool` | Contração radial (`radialScale: 0.74`), traços curtos (`lengthScale: 0.18`), alinhamento ciano elétrico (`opacity: 0.48`), sem flash branco. |
| `acceleration` | Alongamento progressivo (`lengthScale: 0.28 -> 1.10`), expansão radial para o corredor de dobra (`radialScale: 0.76 -> 1.0`) e aceleração de fluxo (`speedScale: 0.45 -> 1.35`). |
| `cruise` | Corredor estabilizado com distinção entre `interstellar` (`lengthScale: 1.0`, ciano estelar) e `intergalactic` (`lengthScale: 1.18`, índigo-violeta cósmico com cauda dourada). |
| `deceleration` / `emergency-deceleration` | Compressão gradual dos traços (`lengthScale -> 0.22`), abertura radial (`radialScale -> 1.16`) e transição cromática âmbar/laranja de frenagem. |
| `arrival-hold` | Estado suspenso calmo (`lengthScale: 0.14`, `speedScale: 0.08`, tom verde-água de sincronização) enquanto aguarda commit assíncrono do destino. |
| `arrival` / `complete` | Contração final dos filamentos (`lengthScale: 0.06`), redução suave de opacidade e cross-fade do proxy de destino para a cena real de `GalaxyMaterializer`. |
| `coasting` | Deriva residual de baixa opacidade (`opacity: 0.22`, `speedScale: 0.10`) preservando a direção da rota para retomada sem salto. |

---

## 4. Suporte à Apresentação de Galáxias Procedurais

- `HypercruisePresentation.ensureGalaxyProxy(galaxyId, universeSeed)` indexa proxies por `proxyCacheKey(galaxyId, universeSeed)` (`id` para canônicas; `${id}@${seedHex}` para procedurais).
- Cada proxy utiliza `GalaxyPointCloudProvider.getGeometry(descriptor, 'Low', 1024)` com retenção explícita (`retain` / `release`), gerando 1.024 partículas determinísticas (via `SplitMix64`, zero `Math.random()`) que refletem fielmente:
  - Braços espirais logarítmicos (`spiral`),
  - Barra triaxial central + braços (`barred-spiral`),
  - Elipsoide triaxial suave (`elliptical`),
  - Aglomerados estelares assimétricos (`irregular`),
  - Orientação espacial `orientationEuler` e população espectral dominante.
- Todos os nós permanecem estritamente limitados à esfera de `20.000 m` (`< 50.000 m`) em torno da câmera.

---

## 5. Contratos de Transição LOD

- `GalaxyMorphologyRenderer` mantém os limiares (`lodThreshold01 = 16 px`, `lodThreshold12 = 280 px`) e a banda de histerese direcional de 15% (`hysteresisRatio = 0.85`).
- Pré-aquecimento preditivo (`preheatLod2()`) dispara em `>= 60%` do limiar LOD 1 $\rightarrow$ LOD 2 (`168 px`), garantindo lookup $O(1)$ ao cruzar `280 px`.
- Exposição alfa (`uLod0Alpha`, `uLod1Alpha`, `uLod2Alpha`) é modulada continuamente dentro de cada nível (`getLodAlphas()`) e auditada por `lodTransitionCount`, `lastProjectedPx` e `lastDistanceM`.

---

## 6. Recursos GPU Criados e Descartados

- **Geometria de linhas do Hypercruise**: 1 `BufferGeometry` pré-alocado no construtor (`positions` e `colors` de `384 * 6` floats reutilizados in-place; zero alocação por frame).
- **Proxies de galáxias em trânsito**: até 5 canônicas + `MAX_PROCEDURAL_PROXIES = 8` procedurais em cache LRU. Ao evictar um proxy procedural ou chamar `HypercruisePresentation.dispose()`, `pointCloudProvider.release(geometry)` e `material.dispose()` liberam imediatamente os buffers não referenciados.
- **Renderizador morfológico (`GalaxyMorphologyRenderer`)**: LOD 1 e LOD 2 são instanciados preguiçosamente (`ensureLod1`, `ensureLod2`) e liberados com contagem de referência em `dispose()`.

---

## 7. Testes Adicionados (`tests/cosmic-exploration-u45.test.ts`)

1. `T_U45_01`: Diferenciação visual por fase e domínio (`interstellar` vs `intergalactic`), ausência de `NaN` nas transições e modo `reducedMotion`.
2. `T_U45_02_05_06`: Renderização de proxy procedural em trânsito intergaláctico, crescimento angular na aproximação, zero alocação de geometria por frame (`proxyBuildsCount` constante em 180 frames) e descarte limpo em `dispose()`.
3. `T_U45_03_04`: Proibição estrita de `Math.random()` durante trânsito procedural e renderização dos mapas + garantia de coordenadas limitadas (`< 50 km`).
4. `T_U45_07_08_09`: Atualização do cache de galáxias visíveis em pan sub-célula (`panOffsetMpc`), hit-test preciso, zoom relativo ao cursor e distinção visual entre galáxia canônica (`#38bdf8`), atual (`#ef4444`) e selecionada (`#facc15`).
5. `T_U45_10`: Estruturação do painel `#universal-target-card` nas 4 seções (`IDENTIDADE`, `POSIÇÃO`, `EXPLORAÇÃO`, `NAVEGAÇÃO`), indicação do atalho `[P]` e ausência de `NaN`/`undefined`.
6. `T_U45_11_12`: Continuidade de orientação (`orientationEuler`) entre proxy de trânsito e descritor da galáxia ativa + estabilidade de histerese LOD sem *thrashing* (`lodTransitionCount`) e pré-aquecimento de LOD 2.
7. `T_U45_13_14`: Isolamento multissemente de proxies (`seedA` vs `seedB`), telemetria enriquecida, viagem completa Sol $\leftrightarrow$ galáxia procedural, cancelamento em `cruise` $\rightarrow$ `coasting` $\rightarrow$ `resume()` até Andrômeda e ocultação limpa da apresentação na chegada.

---

## 8. Riscos Restantes e Limitações Conhecidas

- O pré-aquecimento de LOD 2 (`preheatLod2`) continua síncrono na thread principal ao atingir `60%` do limiar projetado; a transferência para Web Worker dedicado permanece planejada para a etapa futura **U4.5.4**.
- Galáxias procedurais que, por determinismo de semente, não possuam sistema estelar com planeta rochoso pousável nos setores candidatos permanecem corretamente classificadas como `cosmological-future` (observação cosmológica, com motivo explicado na seção **NAVEGAÇÃO** do painel).

---

## 9. Checklist de Homologação Visual

1. **Decolagem e Entrada em Voo Espacial**: decolar de Manaus/Terra até o espaço interplanetário seguro (`frame = solar-system/barycentric`).
2. **Mapa Cosmos (`M` $\rightarrow$ aba `Cosmos`)**:
   - Verificar silhuetas distintas para galáxias espirais, espirais barradas, elípticas e irregulares.
   - Testar pan sub-célula e amplo (arrastar mouse) e zoom no cursor (roda do mouse), confirmando que galáxias nas bordas aparecem continuamente sem sumiço.
   - Passar o mouse sobre galáxias (anel de hover + cursor `pointer`) e clicar em uma galáxia procedural (retículo dourado `#facc15`).
3. **Painel de Destino (`#universal-target-card`)**:
   - Confirmar exibição das 4 seções (**IDENTIDADE**, **POSIÇÃO**, **EXPLORAÇÃO**, **NAVEGAÇÃO**) e a mensagem `Atalho [P] · Iniciar Hypercruise Intergaláctico`.
4. **Trânsito Hypercruise (`P`)**:
   - Observar a progressão visual das fases `SPOOL` $\rightarrow$ `ACCELERATION` $\rightarrow$ `CRUISE` (paleta violeta-índigo intergaláctica) $\rightarrow$ `DECELERATION` $\rightarrow$ `ARRIVAL`.
   - Confirmar que o proxy 3D da galáxia procedural de destino aparece à frente, cresce suavemente em escala angular mantendo sua morfologia/inclinação e faz cross-fade suave na chegada.
   - Conferir a telemetria HUD/Mapa mostrando `FASE`, `GALÁXIA DE DESTINO`, `VELOCIDADE EFETIVA` e `VELOCIDADE LOCAL: 0 m/s · FRAME ANCORADO`.
5. **Chegada e Retorno ao Sol**:
   - Verificar chegada no corredor seguro do sistema estelar de entrada da galáxia procedural e retorno completo à Via Láctea / Sistema Solar (`sol`).
