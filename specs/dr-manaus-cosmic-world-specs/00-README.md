# DR Manaus Universe Hardening Pack

## Objetivo

Este pacote define a correção arquitetural da branch `feat/universe-map` antes de qualquer merge para `main`.

Snapshot analisado:

```text
repositório: PauloSoaf/Dr-Manaus
main: d2e03428b1d9ba90fdc7b2a5112c280e6686fead
feat/universe-map: d79f4e9c77200db06cfe5a34058d3fc37b8fe48c
checkpoint anterior ao salto final: 00d25cc4f5a259b1145a1c59f1f2db68336169c1
```

A branch está 12 commits à frente da `main`.

A decisão deste pacote é:

```text
NÃO fazer merge da feat/universe-map na main ainda.
```

Não é necessário jogar a branch fora. A fundação anterior contém componentes bons que devem ser preservados:

- WGS84
- ECEF / ENU
- reference frames
- `ManausFrameAdapter`
- floating origin 3D
- `PlanetQuadtree`
- cube sphere
- Screen Space Error
- `GlobalStreamingScheduler`
- `TileCache`
- `PrefetchPredictor`
- `EarthProvider`
- Natural Earth landmask
- modelo lógico inicial do Sistema Solar
- arquitetura de providers
- cidade atual de Manaus
- streaming atual da cidade
- destruição e reconstrução
- testes existentes

O problema está principalmente em funcionalidades recentes que foram marcadas como finalizadas antes da integração estar realmente fechada.

## Regra principal

O agente deve trabalhar assim:

```text
uma mudança arquitetural
        |
        v
testes específicos
        |
        v
build
        |
        v
teste de integração
        |
        v
inspeção visual quando aplicável
        |
        v
commit pequeno
        |
        v
próxima mudança
```

Nunca:

```text
implementar 8 fases
        |
        v
npm test
        |
        v
declarar tudo concluído
```

## Ordem de leitura

1. `01-CURRENT-STATE-AUDIT.md`
2. `02-CRITICAL-BUGS.md`
3. `03-TARGET-ARCHITECTURE.md`
4. `04-MANAUS-WGS84-MIGRATION.md`
5. `05-STREAMING-PROVIDERS.md`
6. `06-HIGH-SPEED-TRAVEL.md`
7. `07-EARTH-TERRAIN-DEM.md`
8. `08-SOLAR-GALAXY-UNIVERSE.md`
9. `09-PERSISTENCE.md`
10. `10-TEST-PERFORMANCE-QUALITY-GATES.md`
11. `11-FILE-BY-FILE-PLAN.md`
12. `12-ROADMAP.md`
13. `13-ACCEPTANCE-CRITERIA.md`
14. `14-ANTIGRAVITY-MASTER-PROMPT.md`
15. `15-ANTIGRAVITY-ARCHITECTURE-PROMPT.md`
16. `16-ANTIGRAVITY-BUGFIX-PROMPT.md`
17. `17-ANTIGRAVITY-ROADMAP-PROMPT.md`
18. `18-REVIEW-CHECKLIST.md`

## Resultado esperado

Ao final do hardening:

```text
Manaus continua boa como hoje
+
Terra WGS84 real
+
transição local -> planetária correta
+
streaming único e orçado
+
voo interplanetário separado da física local
+
endereçamento cósmico estável
+
Sistema Solar real preservado
+
universo procedural determinístico
+
nenhuma geometria astronômica enviada como coordenada gigante para a GPU
```
