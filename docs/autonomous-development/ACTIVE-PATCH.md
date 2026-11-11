# DR-MANAUS | Active Patch Tracker

- **Patch:** `U5` — Interactive Multi-Scale Universal Map, Canonical Breadcrumbs and Shareable Coordinate Model
- **Status:** CONCLUÍDO & VALIDADO (Pronto para Commit & Push)
- **Branch:** `feat/universe-map`
- **Data/Hora:** 2026-11-11T09:15:00-04:00

## Modificações do Patch
1. `src/ui/map/MapNavigationModel.ts`:
   - Escalas multiescala (`surface`, `planet`, `system`, `sector`, `galaxy`, `local-group`, `cosmology`, `atlas`).
   - Resolução hierárquica `resolveHierarchy()` respeitando `UNIVERSE / LOCAL GROUP / MILKY WAY / SOL / TERRA / MANAUS` sem fabricação.
   - Rotulagem estrita de precisão `MapPrecision` (`measured`, `approximate`, `procedural`, `gameplay-placeholder`).
   - Formatação direta `formatShareableUri()` com preservação exata de `BigInt`.
   - Busca universal `search()` anotando alvos com orientação de voo e disponibilidade.
2. `src/world/spatial/UniverseCoordinates.ts`:
   - Adicionadas funções utilitárias `toTeleportTarget()`, `formatLocation()`, `fromTargetDescriptor()`.
3. `src/ui/map/UniversalMapPanel.ts`:
   - Botão `COPIAR URI` para transferir coordenadas da localização atual para o clipboard.
   - Integração da hierarquia de breadcrumbs clicáveis com tooltip de precisão.
   - Renderização explícita de precisão no cartão de localização (`where-am-i-card`) e no cartão do alvo de navegação (`universal-target-card`).
   - Suporte a busca universal no campo de coordenadas ao digitar texto ou nomes de destinos.
4. `tests/universal-map-multiscale-u5.test.ts`:
   - 7 testes automatizados cobrindo todos os contratos do U5 (100% aprovados).
5. Documentação técnica:
   - `docs/world/15-status.md`
   - `docs/world/51-status-U5-UNIVERSAL-MAP-MULTISCALE.md`

## Validações
- `node --import tsx --test tests/universal-map-multiscale-u5.test.ts`: PASS (7/7)
- Suíte completa de marcos recentes e coordenadas: PASS (49/49)
- `npm run typecheck`: PASS (0 erros)
- `npm run build`: PASS (Vite 8.3.0)
