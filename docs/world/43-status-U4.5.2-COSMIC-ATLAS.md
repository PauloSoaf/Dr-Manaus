# DR-MANAUS | Patch U4.5.2 — Atlas de Descobertas, Favoritos e Navegação Galáctica

## 1. Visão Geral

- **Patch:** U4.5.2
- **Título:** Atlas de Descobertas, Favoritos e Navegação Galáctica
- **Baseline Auditado:** `721f70d44331ee36b9eb4e93d5e79854dba88886` (CI 100% aprovado no GitHub Actions Runs `42515552252` e `42515546294`).
- **Commit Publicado:** `fbf8a54`
- **Branch de Trabalho:** `feat/universe-map`
- **Repositório:** [https://github.com/PauloSoaf/Dr-Manaus](https://github.com/PauloSoaf/Dr-Manaus)

---

## 2. Objetivos e Entregas

### P0 — Atlas de Descobertas (`CosmicAtlasModel.ts`)
- Modelo centralizado de exploração cósmica sem duplicação de autoridade.
- Rastreamento unificado de:
  - `discoveredGalaxies`: galáxias canônicas e procedurais descobertas através de navegação, mapa Cosmos ou busca espacial.
  - `identifiedSystems`: sistemas estelares catalogados ou descobertos.
  - `visitedTargets`: destinos onde o jogador esteve de fato presente.
  - `favoriteKeys`: destinos favoritados pelo usuário.
  - `history`: log cronológico de descobertas e chegadas.
- **Regra Estrita de Visitação:**
  *Nenhum alvo é marcado como visitado apenas porque foi renderizado, catalogado ou pesquisado no mapa.* O status `✓ VISITADO` é emitido exclusivamente quando o jogador ingressa ou transloca para o endereço correspondente via `recordArrival()` ou no encerramento de Hypercruise (`arrived`).

### P1 — Favoritos, Pesquisa e Filtros
- Alternância rápida de favoritos (`toggleFavorite(key)` / `isFavorite(key)`).
- Pesquisa em tempo real:
  - Correspondência por nome (`Milky Way`, `Andromeda`, `M31`, `Sol`, `Terra`).
  - Correspondência por designação procedural (`DM-PG`, `galaxy_c...`).
  - Coordenadas de célula cosmológica (`c:0,0,0` ou `x,y,z`).
- Filtros estruturados:
  - Tipo: `Todas`, `Galáxias`, `Sistemas`, `Planetas/Luas`.
  - Status: `Todos`, `★ Favoritos`, `✓ Visitados`, `Aptos p/ Voo`.
  - Morfologia: `Todas`, `Espiral`, `Espiral Barrada`, `Elíptica`, `Irregular`.
  - Ordenação: `Nome`, `Distância`, `Estrelas`, `Diâmetro`.
- Persistência retrocompatível no `SaveManager` (`favorites`, `visitedTargets`), serializando chaves canônicas como strings seguras no `localStorage` sem expor BigInt a erros de parsing.

### P2 — Navegação Contextual Integrada
- Seleção de qualquer alvo no Atlas sincroniza com `MapNavigationModel.selectedTargetKey`.
- Botão `[LOCALIZAR NO MAPA]`:
  - Transiciona suavemente para o nível de mapa pertinente (`cosmology` para galáxias, `galaxy` ou `system` para sistemas internos).
- Botão `[INICIAR VIAGEM (P)]`:
  - Visível e acionável apenas quando a rota de navegação é elegível (`confirmed` ou `pending-validation`).
  - Reutiliza diretamente o `UniversalTravelController` e preserva toda a segurança de decolagem/pouso e consumo de atalhos de voo.

### P3 — Experiência Visual e Otimização
- Adicionado nível de visualização `Atlas` na barra de navegação do mapa universal.
- Renderizador de visão completa (`renderAtlasView`) com estatísticas em tempo real, grid responsivo de cartões e paginação em blocos de 24 itens (`Carregar mais`), garantindo fluidez e zero DOM bloat.
- Cartão `#universal-target-card` atualizado com botão de favoritar direto (`★ FAVORITO` / `☆ FAVORITAR`) e etiqueta de visitação (`✓ Visitado` / `Não visitado`).
- **Zero alocação de malhas 3D:** a interface do Atlas opera puramente sobre descritores de metadados astronômicos sem materializar estrelas ou planetas 3D em segundo plano.

---

## 3. Arquivos Modificados e Criados

1. [src/world/exploration/CosmicAtlasModel.ts](file:///c:/Projetos/Dr-Manaus/src/world/exploration/CosmicAtlasModel.ts) (Novo)
2. [src/core/SaveManager.ts](file:///c:/Projetos/Dr-Manaus/src/core/SaveManager.ts) (Modificado)
3. [src/ui/map/UniversalMapPanel.ts](file:///c:/Projetos/Dr-Manaus/src/ui/map/UniversalMapPanel.ts) (Modificado)
4. [src/ui/HUD.ts](file:///c:/Projetos/Dr-Manaus/src/ui/HUD.ts) (Modificado)
5. [src/game/Game.ts](file:///c:/Projetos/Dr-Manaus/src/game/Game.ts) (Modificado)
6. [tests/cosmic-atlas-u452.test.ts](file:///c:/Projetos/Dr-Manaus/tests/cosmic-atlas-u452.test.ts) (Novo)
7. [docs/world/15-status.md](file:///c:/Projetos/Dr-Manaus/docs/world/15-status.md) (Modificado)
8. [docs/world/43-status-U4.5.2-COSMIC-ATLAS.md](file:///c:/Projetos/Dr-Manaus/docs/world/43-status-U4.5.2-COSMIC-ATLAS.md) (Novo)

---

## 5. Patch Corretivo U4.5.2.1: Recuperação do CI e Estabilidade do Atlas

- **Baseline auditado:** Commit `b4ca622255d934259686ee2ce822e1487f72715d` (CI Run `42519003427` reprovado com 2 erros TS2339).
- **Problemas resolvidos:**
  1. `Game.ts:157-158`: corrigido erro TS2339 (`Property 'descriptor' does not exist on type 'UniversalNavigationTarget'`) usando diretamente `destination.key`.
  2. `UniversalMapPanel.ts`: ordem de inicialização do construtor corrigida. `buildDomSkeleton()` constrói o DOM primeiro; `renderers` e `atlasModel` são instanciados antes das primeiras chamadas a `updateCard()` e `updateBreadcrumb()`.
  3. Desacoplamento de `describeNavigationGuidance` para `src/world/travel/NavigationGuidance.ts`, eliminando dependências circulares entre interface e modelo de exploração.
  4. Estabilidade do DOM no Atlas Cósmico: introdução da flag `atlasDirty` e cache de endereço (`lastRecordedAddressKey`) para evitar reconstruções a cada frame, preservando `scrollTop`, foco de busca e intervalo de seleção de texto.
  5. Busca por coordenadas celestes (`c:0,0,0`): unificação da busca procedural com comparação exata de coordenadas `BigInt3` e chave de descoberta.
  6. Suíte `tests/cosmic-atlas-u452.test.ts` expandida com testes de construtor real e estabilidade da DOM.

---

## 6. Patch Corretivo U4.5.2.2: Fechamento dos 2 Testes e Unificação de Estatísticas

- **Baseline auditado:** Commit `b43ea015b1b3ab37862ace7570b927d23062824f` (CI Run `42535234334`: TypeScript PASS, 638/638 regressões aprovadas, 1.560/1.562 testes gerais, falhas em `T_U452_01` e `T_U452_12`).
- **Problemas resolvidos:**
  1. `T_U452_01_ATLAS_BASELINE_INITIALIZATION`: alinhada a asserção às galáxias reais de `LOCAL_GROUP_CATALOG` (`milky_way` e `andromeda`, contagem canônica = 2), sem inventar galáxias fictícias ou corromper a autoridade de coordenadas. Adicionada verificação explícita de `galaxy/milky_way`, `galaxy/andromeda`, distinção entre canônicas e procedurais, e consistência entre `getStatistics()` e `query().statistics`.
  2. `T_U452_12_ATLAS_UPDATE_DOM_STABILITY`: no construtor de `UniversalMapPanel`, inicializados `this.lastAtlasGalaxyId = initialLocation.address.galaxyId`, `this.lastAtlasSelectedKey = undefined` e `this.atlasDirty = false`. Elimina o falso positivo de transição no primeiro tick de `update()`, garantindo exatamente 0 reconstruções em updates ociosos.
  3. Unificação de Estatísticas (`CosmicAtlasModel.ts`): centralização em `collectTargetMap()` e `computeStatistics()`, aplicando deduplicação canônica em $O(N)$ e garantindo coerência matemática absoluta entre `getStatistics()` e `query().statistics`.
  4. Suíte de testes: adicionado `T_U452_13_STATISTICS_UNIFICATION_AND_DEDUPLICATION` e expandido `T_U452_12` com validação de updates consecutivos e seleção.

---

## 7. Roteiro de Homologação Manual

1. Abrir o jogo na porta 9999 (`http://localhost:9999`).
2. Pressionar `M` para abrir o Mapa Universal.
3. Clicar no botão `Atlas` na barra superior de níveis.
4. Validar estatísticas no cabeçalho: contagem de galáxias canônicas, procedurais, sistemas, destinos visitados e favoritos.
5. Digitar "Andromeda" no campo de busca: verificar filtragem instantânea e botão de favoritar `☆`.
6. Clicar em `☆` no cartão de Andrômeda: confirmar transição para `★` dourado e incremento do contador de favoritos.
7. Clicar em `[LOCALIZAR NO MAPA]`: confirmar que o mapa transiciona para a visualização `Cosmos`, centralizando e selecionando Andrômeda com retículo dourado `#facc15`.
8. No painel lateral `#universal-target-card`, confirmar a presença do botão `★ FAVORITO` sincronizado.
9. Recarregar a página (`F5`): confirmar persistência dos favoritos salvos via `SaveManager`.
10. Testar filtros de tipo (`Galáxias`, `Sistemas`), filtros de status (`★ Favoritos`, `✓ Visitados`) e paginação (`Carregar mais`).


