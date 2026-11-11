# DR-MANAUS | Active Patch Tracker

- **Patch:** `BH1.1 / BH2.1` — integração em runtime de gravidade e trânsito de buracos negros
- **Status:** IMPLEMENTADO, VALIDAÇÃO LOCAL EM ANDAMENTO (pendente: push + CI)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-11T12:05:00-04:00

## Mudanças
1. `BlackHoleTransitController` agora é transacional: `startTransit` apenas reserva o índice N+1; `commitTransit()` persiste no `SaveManager` somente após emergência confirmada; `abortTransit()` descarta a reserva.
2. Novo `src/world/travel/BlackHoleRuntime.ts`: avalia proximidade, aplica Paczyński–Wiita em voo cósmico (nunca em física local ENU/Manaus), dispara trânsito ao cruzar o horizonte.
3. `Game.updateInterplanetaryFlight` chama `BlackHoleRuntime.step`; `updateBlackHoleTransit` avança as fases e faz o handoff (galáxia + posição fora do horizonte), com rollback em falha.
4. Testes: `tests/black-hole-runtime-integration.test.ts` (6) e `black-hole-transit-bh2.test.ts` atualizado ao contrato transacional.

## Lacunas conhecidas
- HUD ainda não exibe telemetria de proximidade (`BlackHoleRuntime.proximity`).
- Buracos negros estelares procedurais não são consultados pelo runtime (apenas centrais Sgr A* / M31*).
- Apresentação visual do túnel (shader/HUD) ainda não existe.
