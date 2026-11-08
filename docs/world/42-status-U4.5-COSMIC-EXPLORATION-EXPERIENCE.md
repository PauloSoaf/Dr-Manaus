# Status Report — U4.5.1 / U4.5.1.1 Cosmic Exploration Experience

**Date**: 2026-11-08  
**Branch**: `feat/universe-map`  
**Baseline**: Commit `97c6ad14c67b8316201ce83c2a56ffe3c096a294` (U4.4.9 CI Approved)  
**Audited U4.5.1 Commit**: `d49c6161c22d6f70cdeb702698a2a282396f93cd` (GitHub Actions Run `42444989687`)  
**Recovery Commit (U4.5.1.1)**: `b039dca3fbaf97c88ede521bed9e8fa955c24e15`  

---

## 1. Diagnóstico do U4.5.1 e Recuperação no U4.5.1.1

O commit `d49c6161c22d6f70cdeb702698a2a282396f93cd` introduziu a camada de experiência visual do U4.5.1, porém reprovou na compilação TypeScript oficial (GitHub Actions Run `42444989687`) com 8 erros de tipo e incompatibilidades de contrato identificadas em auditoria. O patch **U4.5.1.1** sana integralmente todos os pontos preservando o ganho visual:

### 1.1 Correção dos 8 Erros de Compilação TypeScript
1. `Game.ts:179` e `Game.ts:800` (`TS2339: Property 'setDirection' does not exist on type 'HypercruisePresentation'`):
   - **Causa**: `setDirection(direction)` havia sido removido na reimplementação de `HypercruisePresentation`, e `this.lines.quaternion.copy(camera.quaternion)` sobrescrevia a orientação do corredor relativístico com a câmera.
   - **Correção**: Restaurado o método `setDirection(direction: readonly number[] | { readonly x: number; readonly y: number; readonly z: number }): void` em `HypercruisePresentation`, aceitando tanto tupla `Vec3` quanto `THREE.Vector3`. A orientação agora normaliza vetores válidos, rejeita entradas não finitas (`NaN`/`Infinity`) ou degeneradas, alinha `this.root.quaternion` via `targetQuaternion` com interpolação suave em `update()` e remove a rotação acoplada em `this.lines.quaternion`.
2. `HypercruisePresentation.ts:14` (`TS2305: Module '"../world/galaxy/GalaxyCoordinates"' has no exported member 'galaxyCenterM'`):
   - **Causa**: Import de função inexistente `galaxyCenterM`.
   - **Correção**: Substituído pelas autoridades reais `galaxyCosmologicalAddress`, `cosmologicalSeparationVectorM`, `orientGalaxyVector`, `galaxyLocalPositionM` e `boundedGalaxySector`.
3. `HypercruisePresentation.ts:405-407` (`TS2339: sectorOffsetM` inexistente em `TravelAnchor`; `TS18048: oPos/dPos possibly undefined`):
   - **Causa**: `TravelAnchor` expõe `offsetM: Vec3` (e não `sectorOffsetM`), e `observerGlobalPositionM()` retorna `Vec3 | undefined` fora do domínio de setores limitados.
   - **Correção**: Implementada `computeAnchorDistancesM()` utilizando `origin.offsetM`, `destination.offsetM`, `galaxyCosmologicalAddress()` e `cosmologicalSeparationVectorM()` (que subtrai células em `BigInt` antes de converter deslocamentos relativos no domínio seguro), com fallback determinístico para `distanceTravelledM` e `distanceRemainingM` quando fora do domínio `Float64` (`sepVec === undefined`), sem produzir `NaN` ou inventar coordenadas globais.
4. `UniversalMapPanel.ts:11` (`TS2724: ResolvedNavigationTarget` inexistente):
   - **Causa**: O tipo exportado por `UniversalTargetResolver.ts` chama-se `ResolvedUniversalTarget`.
   - **Correção**: Ajustado o import e a assinatura de `renderUniversalTargetCardHtml` para `ResolvedUniversalTarget`.

### 1.2 Correções Arquiteturais e Funcionais (P0 / P1)
- **Modo Superluminal Local `> 10c` (`Game.ts` e `HypercruisePresentation.ts`)**:
  - Eliminado o `fakeState: any` em `Game.ts` que fabricava um destino falso em Andrômeda sem `plan.origin`.
  - Criado o contrato tipado `LocalSuperluminalEffectState` (`{ kind: 'local-superluminal', effectiveSpeedMps, phase }`) aceito por `HypercruisePresentation.update()`, exibindo o efeito de velocidade local sem instanciar ou exibir proxies intergalácticos e sem tocar no `UniversalTravelController`.
- **Política Estrita de Visibilidade de Proxies (`HypercruisePresentation.ts`)**:
  - Em viagens `interstellar` (dentro da mesma galáxia) e no modo `local-superluminal`, todos os proxies galácticos permanecem ocultos (`hideAllProxies()`).
  - Em viagens `intergalactic`, apenas os proxies da galáxia de origem e da galáxia de destino ficam visíveis (`isOrigin || isDest`), posicionados no eixo do corredor a $\pm 20\,\text{km}$.
- **Remoção do Fallback Enganoso para a Via Láctea (`ensureGalaxyProxy`)**:
  - Removido o fallback `?? LOCAL_GROUP_CATALOG[0]`. Se `galaxyDefinition(galaxyId, effectiveSeed)` retornar `undefined`, `ensureGalaxyProxy()` retorna `undefined` sem rotular a Via Láctea com o ID de outra galáxia.
- **Painel de Navegação Honesto (`UniversalMapPanel.ts`)**:
  - `describeNavigationGuidance()` consulta `peekProceduralGalaxyEntry(targetGalaxyId, universeSeed)` em $O(1)$ (sem geração estelar no loop de UI) e distingue explicitamente os estados `confirmed` (`"sistema de entrada confirmado"`), `pending-validation` (`"aguardando validação de entrada"`), `active-system`, `observational-only` e `unavailable`.
- **Janela Localizada de Cross-Fade Dual-LOD (`GalaxyMorphologyRenderer.ts`)**:
  - Implementada janela localizada de transição entre níveis já materializados (`[13.6 px, 22.4 px]` para LOD 0 $\leftrightarrow$ LOD 1 e `[238 px, 350 px]` para LOD 1 $\leftrightarrow$ LOD 2), mantendo ambos os níveis adjacentes temporariamente visíveis com alfas complementares (`isCrossfading = true`) sem alocar geometria extra nem violar a materialização preguiçosa.
- **Correção dos Contratos na Suíte `tests/cosmic-exploration-u45.test.ts`**:
  - Corrigida a instanciação de `new UniversalTargetCatalog(universe.solarSystem, discovery)` (passando `CelestialSystemRuntime` e `ProceduralGalaxyDiscovery(seed)`).
  - Substituída a chamada estática inexistente `GalaxyEntryResolver.resolve` por `hasProceduralGalaxyEntry(g.id, catalog)`.
  - Adicionados testes explícitos para `setDirection()`, voo `> 10c`, `observerGlobalPositionM() === undefined`, células `BigInt` acima de `Number.MAX_SAFE_INTEGER` (`9_007_199_254_740_993n`), rejeição de IDs de galáxia inexistentes, ocultação de proxies em trânsito interestelar, estado `pending-validation` vs `confirmed` no painel e janela de cross-fade LOD.

---

## 2. Melhorias Visuais do U4.5.1

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

## 3. Alterações no Mapa Cosmos e Painel de Destino

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
   - **NAVEGAÇÃO**: Capacidade real (`travelCapabilityLabel`), diagnóstico explícito de prontidão (`NavigationReadinessState`) ou razão de bloqueio e dica do atalho `[P]`.

---

## 4. Comportamento por Fase de Hypercruise

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

## 5. Transições de Morfologia Galáctica e Cross-Fade Dual-LOD

- **Três Níveis Hierárquicos**:
  - `LOD 0` (Impostor distante em quad planar XZ, `< 16 px`): pegada mínima pré-alocada no construtor.
  - `LOD 1` (Morfologia extragaláctica intermediária, `16 px` a `280 px`): instanciado preguiçosamente em `ensureLod1()`.
  - `LOD 2` (Nuvem de partículas estelares 3D em GPU, `>= 280 px`): instanciado preguiçosamente com pré-aquecimento preditivo.
- **Histerese e Cross-Fade**:
  - Banda de histerese direcional de 15% (`hysteresisRatio = 0.85`), eliminando *popping* e *thrashing* no limiar de troca.
  - Pré-aquecimento preditivo (`preheatLod2()`) dispara em `>= 60%` do limiar LOD 1 $\rightarrow$ LOD 2 (`168 px`), garantindo lookup $O(1)$ ao cruzar `280 px`.
  - Janela de cross-fade dual-LOD (`isCrossfading`) com alfas complementares nos intervalos `[13.6 px, 22.4 px]` e `[238 px, 350 px]`, garantindo continuidade suave sem alocar geometria extra.

---

## 6. Recursos GPU Criados e Descartados

- **Geometria de linhas do Hypercruise**: 1 `BufferGeometry` pré-alocado no construtor (`positions` e `colors` de `384 * 6` floats reutilizados in-place; zero alocação por frame).
- **Proxies de galáxias em trânsito**: até 5 canônicas + `MAX_PROCEDURAL_PROXIES = 8` procedurais em cache LRU. Ao evictar um proxy procedural ou chamar `HypercruisePresentation.dispose()`, `pointCloudProvider.release(geometry)` e `material.dispose()` liberam imediatamente os buffers não referenciados.
- **Renderizador morfológico (`GalaxyMorphologyRenderer`)**: LOD 1 e LOD 2 são instanciados preguiçosamente (`ensureLod1`, `ensureLod2`) e liberados com contagem de referência em `dispose()`.

---

## 7. Testes Adicionados (`tests/cosmic-exploration-u45.test.ts`)

1. `T_U45_01`: Diferenciação visual por fase e domínio (`interstellar` vs `intergalactic`), contrato de `setDirection()`, modo `> 10c` superluminal local e `reducedMotion`.
2. `T_U45_02_05_06`: Renderização de proxy procedural em trânsito intergaláctico, política de visibilidade (apenas origem e destino visíveis), rejeição de IDs de galáxias inexistentes (`undefined`), crescimento angular na aproximação, zero alocação de geometria por frame (`proxyBuildsCount` constante em 180 frames) e descarte limpo em `dispose()`.
3. `T_U45_03_04`: Proibição estrita de `Math.random()` durante trânsito procedural e renderização dos mapas, coordenadas limitadas (`< 50 km`), ocultação de proxies em trânsito interestelar e fallback para setores e células `BigInt` extremas (`> Number.MAX_SAFE_INTEGER`).
4. `T_U45_07_08_09`: Atualização do cache de galáxias visíveis em pan sub-célula (`panOffsetMpc`), hit-test preciso, zoom relativo ao cursor e distinção visual entre galáxia canônica (`#38bdf8`), atual (`#ef4444`) e selecionada (`#facc15`).
5. `T_U45_10`: Painel de destino honesto (`UniversalMapPanel`), refletindo o estado do cache de entrada procedural (`pending-validation` vs `confirmed`), estruturado em 4 seções sem `NaN` ou `undefined`.
6. `T_U45_11_12`: Continuidade de orientação (`orientationEuler`) entre proxy de trânsito e descritor da galáxia ativa, janela de cross-fade dual-LOD (`isCrossfading`) e estabilidade de histerese sem *thrashing* (`lodTransitionCount`).
7. `T_U45_13_14`: Isolamento multissemente de proxies (`seedA` vs `seedB`), telemetria enriquecida, ciclo completo Sol $\leftrightarrow$ galáxia procedural $\leftrightarrow$ Andrômeda, cancelamento em `cruise` $\rightarrow$ `emergency-deceleration` $\rightarrow$ `coasting` $\rightarrow$ `resume()` e descarte completo da apresentação.

---

## 8. Riscos Restantes e Limitações Conhecidas

- O pré-aquecimento de LOD 2 (`preheatLod2`) permanece síncrono na thread principal ao atingir `60%` do limiar projetado (`168 px`); a transferência para Web Worker dedicado permanece planejada para a etapa futura **U4.5.4**.
- Galáxias procedurais que, por determinismo de semente, não possuam sistema estelar com planeta rochoso pousável nos setores candidatos permanecem corretamente classificadas como `cosmological-future` (observação cosmológica, com motivo explicado na seção **NAVEGAÇÃO** do painel).

---

## 9. Checklist de Homologação Visual no Navegador

1. **Decolagem e Entrada em Voo Espacial**: decolar de Manaus/Terra até o espaço interplanetário seguro (`frame = solar-system/barycentric`).
2. **Mapa Cosmos (`M` $\rightarrow$ aba `Cosmos`)**:
   - Verificar silhuetas distintas para galáxias espirais, espirais barradas, elípticas e irregulares.
   - Testar pan sub-célula e amplo (arrastar mouse) e zoom no cursor (roda do mouse), confirmando que galáxias nas bordas aparecem continuamente sem sumiço.
   - Passar o mouse sobre galáxias (anel de hover + cursor `pointer`) e clicar em uma galáxia procedural (retículo dourado `#facc15`).
3. **Painel de Destino (`#universal-target-card`)**:
   - Confirmar exibição das 4 seções (**IDENTIDADE**, **POSIÇÃO**, **EXPLORAÇÃO**, **NAVEGAÇÃO**) e a indicação honesta de status (`sistema de entrada confirmado` ou `aguardando validação`).
4. **Trânsito Hypercruise (`P`)**:
   - Observar a progressão visual das fases `SPOOL` $\rightarrow$ `ACCELERATION` $\rightarrow$ `CRUISE` (paleta violeta-índigo intergaláctica) $\rightarrow$ `DECELERATION` $\rightarrow$ `ARRIVAL`.
   - Confirmar que o proxy 3D da galáxia procedural de destino aparece à frente, cresce suavemente em escala angular mantendo sua morfologia/inclinação e faz cross-fade suave na chegada.
   - Conferir a telemetria HUD/Mapa mostrando `FASE`, `GALÁXIA DE DESTINO`, `VELOCIDADE EFETIVA` e `VELOCIDADE LOCAL: 0 m/s · FRAME ANCORADO`.
5. **Chegada e Retorno ao Sol**:
   - Verificar chegada no corredor seguro do sistema estelar de entrada da galáxia procedural e retorno completo à Via Láctea / Sistema Solar (`sol`).
