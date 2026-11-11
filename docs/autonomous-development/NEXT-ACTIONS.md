# DR-MANAUS | Next Actions

Concluídos e publicados: U4.5.4.1, BH0, BH1 (módulo), BH2 (módulo), U5, U6, U7, ISSUE-01/02/04.

## Sequência técnica pendente (ordem estrita)
1. **BH1.2** — Expor `BlackHoleRuntime.proximity` no HUD/telemetria (zona, rs, dilatação temporal, aviso de captura) e `debug` do Game.
2. **BH1.3** — Incluir buracos negros estelares procedurais (`generateStellarBlackHole`) do setor atual no `BlackHoleRuntime`.
3. **BH2.2** — Apresentação do túnel (overlay/shader) ligada a `transit.phase`/`progress01`.
4. **SPEC-TRACKER** — Expandir `SPEC-MASTER-TRACKER.md` além de 28 linhas, reclassificando itens sem integração em runtime.
5. Retomar D2–D5 adiados após os itens acima.

Cada passo: implementar → testar (`npm test`, `test:regression`, `typecheck`, `build`) → commit → push → verificar CI → seguir.
