# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-08 / VIVO-09` (Assentamentos Alienígenas Modulares, Cúpulas, Torres, Habitantes e Reputação de Facções)
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE (1.727/1.727 testes unitários, 638/638 regressões, typecheck 0 erros, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T13:00:00-04:00

## Mudanças do Patch
1. `src/world/life/AlienSettlementManager.ts`:
   - Criado subsistema de assentamentos modulares com renderização `InstancedMesh`.
   - 5 arquétipos estruturais: `habitat-dome`, `comm-tower`, `energy-pylon`, `perimeter-wall` e `ancient-monolith`.
   - 4 papéis sociais de habitantes: `worker`, `guard`, `elder`, `sentinel`.
   - Lógica de disposição diplomática baseada em reputação: `friendly` (saudação ao herói), `neutral`, `hostile`, `guardians`.
   - Mobilização tática de guardas e fuga de civis ao sofrer dano ou ataque.
   - Suporte a destruição estrutural e reconstrução completa via poder `reconstruct`.
2. `src/core/SaveManager.ts`:
   - Adicionado campo `factionReputations?: Record<string, number>` a `SaveData`.
   - Implementados métodos de consulta e modificação diplomática `getFactionReputation(factionId)` e `modifyFactionReputation(factionId, delta)` com clamps $[-100, +100]$ e persistência automática.
3. `src/game/Game.ts`:
   - Instanciado `alienSettlements` e anexado a `worldRoot`.
   - Integrado `alienSettlements.targets` ao `PowerSystem`.
   - Conectados hooks de `hit`, `damageInRadius` e `reconstruct` do jogador aos assentamentos.
   - Conectado ciclo de `update` por frame e telemetria no HUD F3.
4. `specs/universo-vivo/08-ALIEN-SETTLEMENTS-AND-FACTIONS.md`:
   - Especificação técnica consolidada para arquitetura modular, diplomacia e combate em assentamentos.
5. `tests/alien-settlement-manager.test.ts`:
   - Suíte de 6 testes unitários cobrindo ciclo de vida, supressão em mundos estéreis, spawn modular, saudação amigável, mobilização defensiva e reconstrução com ganho de reputação.
