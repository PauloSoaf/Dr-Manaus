# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-15` (Ruínas Ancestrais, Colossos Mecânicos, Primeiro Contato e Anomalias Cósmicas)
- **Status:** IMPLEMENTED & LOCAL VALIDATION IN PROGRESS
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T13:20:00-04:00

## Mudanças do Patch
1. `src/world/life/CosmicAnomaliesAndRuinsManager.ts`:
   - Subsistema procedural completo para sítios arqueológicos monumentais e chefes colossais.
   - 3 arquétipos de ruínas: `ancient-sanctuary` (complexo escalonado com 4 obeliscos perimétricos), `hyper-relic` (núcleo octaédrico levitante) e `guardian-spire`.
   - Entidade de chefe `ColossusBossTarget` (1.200 HP, escala 20m) com lógica de combate multifásica:
     - Fase 1 (100% - 50% HP): marcha pesada (6 m/s), pisões sísmicos radiais.
     - Fase 2 (< 50% HP): sobrecarga/enrage (10.5 m/s) com escudos defletores (dano absorvido em 50%).
   - Primeiro contato: detecção de aproximação (< 38m) marcando descoberta em `SaveManager.discoverRuin`, concedendo +20 de reputação com facção de guardiões e despertando sentinelas colossais adormecidos.
   - Derrota de colossos: registra id em `SaveManager.recordColossusDefeat`, concede +35 de reputação e notifica jogador.
   - Restauração: poder `reconstruct` conserta ruínas avariadas e premia +15 de reputação.
2. `src/core/SaveManager.ts`:
   - Adicionados campos persistentes `discoveredRuins?: string[]` e `defeatedColossi?: string[]`.
   - Implementados métodos `isRuinDiscovered`, `discoverRuin`, `isColossusDefeated` e `recordColossusDefeat`.
3. `src/game/Game.ts`:
   - Instanciado `CosmicAnomaliesAndRuinsManager` e anexado a `worldRoot`.
   - Conectados alvos de ruínas e colossos a `PowerSystem.targets`.
   - Conectados hooks de `hit`, `damageInRadius` e `reconstruct`.
   - Conectada atualização por frame e métricas no HUD F3 (`UNIVERSO VIVO · Ruínas`, `UNIVERSO VIVO · Colossos`).
4. `specs/universo-vivo/15-ANOMALIES-RUINS-AND-COLOSSI.md`:
   - Especificação técnica consolidada para ruínas, primeiro contato e combate com titãs.
5. `tests/cosmic-anomalies-and-ruins.test.ts`:
   - Suíte de 6 testes unitários cobrindo inicialização, supressão em mundos estéreis, spawn arqueológico, primeiro contato, combate com fases/escudo/derrota e restauração por reconstrução.
