# DR-MANAUS | Active Patch Tracker

- **Patch:** `D3` (Fratura Geomecânica da Crosta, Propagação Sísmica de Falhas e Degradação de Integridade)
- **Status:** IMPLEMENTADO, APROVADO LOCALMENTE (1.666/1.666 testes, 638/638 regressões, typecheck OK, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-11T15:55:00-04:00

## Mudanças do Patch
1. `src/world/destruction/GeomechanicalFractureService.ts`:
   - Serviço autoritativo de fratura geomecânica e propagação de falhas tectônicas (`GeomechanicalFractureService`).
   - Modelo de atenuação sísmica Sadovsky/anelástica $\sigma(r) = \sigma_0 (r_0 / \max(r_0, r))^{1.1} e^{-\alpha (r-r_0)}$ com tensão limite de escoamento de rochas ígneas e basálticas ($\sigma_y = 120\text{ MPa}$).
   - Geração procedural determinística de ramificações radiais de falhas tectônicas (`PlanetaryFaultSegment`), projetando vértices diretamente sobre o relevo canônico/procedural do planeta via `planetSurfaceRadius`.
   - Escavação de fissuras em CSG contínuo (`SubtractCapsuleEdit`) injetadas no `PlanetVolumeEditStore`.
   - Monitoramento e degradação cumulativa de integridade da crosta planetária por corpo celeste (`getCrustIntegrity`, `setCrustIntegrity`).
   - Isolamento de múltiplos corpos (impacto em um corpo não afeta o campo de tensão nem integridade de outros).
2. `src/player/powers/PowerSystem.ts`:
   - Adicionado hook de poderes `fractureCrust(epicenter, energyJoules)` em `PowerHooks`.
3. `src/game/Game.ts`:
   - Instanciado `GeomechanicalFractureService` vinculado ao `PlanetVolumeEditStore` e geradores de relevo.
   - Conexão do hook `fractureCrust` no `PowerSystem` e telemetria de falhas em `universeDebug()`.
4. `tests/geomechanical-fracture-service.test.ts`:
   - Suíte de 5 testes unitários validando atenuação de tensão dinâmica, geração de fissuras tectônicas, degradação de integridade da crosta, corte por limiar energético ($E \ge 10^{12}\text{ J}$) e isolamento multicorpo.
5. `docs/autonomous-development/SPEC-MASTER-TRACKER.md`:
   - Atualizado status de `DEST-05` (D3) para `IMPLEMENTED` e `DEST-04` (D2) para `CI_VERIFIED`.
