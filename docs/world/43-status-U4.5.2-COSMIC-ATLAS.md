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

## 4. Roteiro de Homologação Manual

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
