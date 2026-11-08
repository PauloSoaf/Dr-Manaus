# Status Report — U4.5.1 / U4.5.1.1 Cosmic Exploration Experience

**Date**: 2026-11-08
**Branch**: `feat/universe-map`
**Baseline**: Commit `97c6ad14c67b8316201ce83c2a56ffe3c096a294` (U4.4.9 CI Approved)
**Audited U4.5.1 Commit**: `d49c6161c22d6f70cdeb702698a2a282396f93cd` (GitHub Actions Run `42444989687`)

---

## 1. Diagnóstico do U4.5.1 e Correções Realizadas no U4.5.1.1

O commit `d49c6161c22d6f70cdeb702698a2a282396f93cd` introduziu a camada visual do U4.5.1, porém reprovou na etapa de TypeScript do GitHub Actions (Run `42444989687`) com 8 erros de compilação e inconsistências de contrato identificadas em auditoria. O patch **U4.5.1.1** corrige integralmente todos os pontos preservando as melhorias visuais:

### 1.1 Correção dos 8 Erros TypeScript Oficiais
1. `Game.ts:179` e `Game.ts:800` (`TS2339: Property 'setDirection' does not exist on type 'HypercruisePresentation'`):
   - **Causa**: `setDirection(direction)` havia sido removido na reimplementação de `HypercruisePresentation`, e `this.lines.quaternion.copy(camera.quaternion)` sobrescrevia a orientação do corredor.
   - **Correção**: Restaurado o método `setDirection(direction: readonly number[]): void` em `HypercruisePresentation`, com normalização segura, rejeição de vetores não finitos/nulos, alinhamento de `this.root.quaternion` via `targetQuaternion` (`slerp` suave em `update`) e remoção da rotação duplicada em `this.lines.quaternion`.
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

## 2. Comportamento por Fase de Hypercruise

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

## 3. Recursos GPU Criados e Descartados

- **Geometria de linhas do Hypercruise**: 1 `BufferGeometry` pré-alocado no construtor (`positions` e `colors` de `384 * 6` floats reutilizados in-place; zero alocação por frame).
- **Proxies de galáxias em trânsito**: até 5 canônicas + `MAX_PROCEDURAL_PROXIES = 8` procedurais em cache LRU. Ao evictar um proxy procedural ou chamar `HypercruisePresentation.dispose()`, `pointCloudProvider.release(geometry)` e `material.dispose()` liberam imediatamente os buffers não referenciados.
- **Renderizador morfológico (`GalaxyMorphologyRenderer`)**: LOD 1 e LOD 2 são instanciados preguiçosamente (`ensureLod1`, `ensureLod2`) e liberados com contagem de referência em `dispose()`.

---

## 4. Riscos Restantes e Homologação Visual

- O pré-aquecimento de LOD 2 (`preheatLod2`) permanece síncrono na thread principal ao atingir `60%` do limiar projetado (`168 px`); a transferência para Web Worker dedicado permanece planejada para o **U4.5.4**.
- A homologação visual no navegador permanece pendente de verificação manual após a confirmação do GitHub Actions.
