# DR Manaus Cosmic Night Specs

Pacote de continuação para:

```text
PauloSoaf/Dr-Manaus
branch: feat/universe-map
HEAD auditado: f5afb4d148b8040ce367ea2463bdcbb4695f1ea5
```

Objetivos desta rodada:

1. consolidar o hardening já feito;
2. corrigir os defeitos visuais atuais da Terra;
3. terminar a transição Manaus -> planeta sem chão preto;
4. completar zero-g e travel domains;
5. transformar o Sistema Solar lógico em mundo navegável;
6. construir Via Láctea, Andrômeda e Local Group;
7. implementar buracos negros funcionais;
8. representar Grande Atrator e large-scale structure;
9. representar o horizonte do universo observável sem tratá-lo como uma parede física;
10. preservar performance, streaming incremental, clean code e testes.

Este pacote não pede um big bang refactor. Ele define uma sequência de vertical slices com quality gates.

## Ordem

1. `01-AUDIT-AFTER-HARDENING.md`
2. `02-REMAINING-BUGS.md`
3. `03-EARTH-SURFACE-BIOMES-OCEAN-ICE.md`
4. `04-EARTH-ALTITUDE-TRANSITION.md`
5. `05-MANAUS-FULL-WGS84-UNIFICATION.md`
6. `06-ZERO-G-AND-GRAVITY-DOMAINS.md`
7. `07-SOLAR-SYSTEM-COMPLETE.md`
8. `08-PLANET-SURFACES-AND-LANDING.md`
9. `09-MILKY-WAY.md`
10. `10-ANDROMEDA-LOCAL-GROUP.md`
11. `11-BLACK-HOLES.md`
12. `12-GREAT-ATTRACTOR-COSMIC-WEB.md`
13. `13-OBSERVABLE-UNIVERSE-HORIZON.md`
14. `14-COSMIC-LOD-STREAMING-PERFORMANCE.md`
15. `15-CLEAN-CODE-ARCHITECTURE.md`
16. `16-TESTS-AND-ACCEPTANCE.md`
17. `17-NIGHT-ROADMAP.md`
18. `18-CLAUDE-NIGHT-MASTER-PROMPT.md`
19. `19-CLAUDE-EARTH-PROMPT.md`
20. `20-CLAUDE-COSMIC-PROMPT.md`
21. `21-CLAUDE-BLACK-HOLE-PROMPT.md`
22. `22-SOURCES.md`

## Regra da noite

O agente deve trabalhar em loop enquanto a sessão permitir:

```text
ler
-> testar o comportamento atual
-> implementar mudança pequena
-> targeted tests
-> npm test
-> npm run build
-> browser/runtime verification quando visual
-> profile quando hot path
-> commit pequeno
-> próxima task desbloqueada
```

Não parar no primeiro build verde.
Não marcar fase como finalizada porque a classe existe.
Não avançar para cosmologia enquanto um P0 da Terra estiver quebrado.
