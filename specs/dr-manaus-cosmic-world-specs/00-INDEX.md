# DR Manaus Cosmic World

## Pacote de especificações

Baseline técnico analisado:

- Repositório: `PauloSoaf/Dr-Manaus`
- Branch de referência: `main`
- HEAD analisado: `d2e03428b1d9ba90fdc7b2a5112c280e6686fead`
- Merge: PR #2, `feat/caracter-animation`
- Data do snapshot: 2026-09-25
- Stack principal: Three.js r186, WebGPURenderer, TypeScript 7, Vite 8, Playwright
- Objetivo: evoluir o mapa atual de Manaus para uma arquitetura contínua de Manaus -> Terra em tamanho real -> Sistema Solar -> Via Láctea -> universo navegável, sem carregar o mundo inteiro em memória

Este pacote é uma especificação de arquitetura e implementação. Ele não propõe descartar a Manaus atual. O objetivo é encapsular e migrar o que já existe para uma arquitetura espacial hierárquica.

## Ordem recomendada de leitura

1. `01-CURRENT-MAIN-AUDIT.md`
2. `02-TARGET-ARCHITECTURE.md`
3. `03-COORDINATES-AND-REFERENCE-FRAMES.md`
4. `04-EARTH-WGS84-AND-PLANET-SURFACE.md`
5. `05-MANAUS-PRESERVATION-AND-MIGRATION.md`
6. `06-GEODATA-PIPELINE.md`
7. `07-STREAMING-HLOD-AND-CACHE.md`
8. `08-RENDER-DOMAINS-ATMOSPHERE-OCEAN.md`
9. `09-PHYSICS-DESTRUCTION-AND-HIGH-SPEED.md`
10. `10-SOLAR-SYSTEM.md`
11. `11-GALAXY-AND-OBSERVABLE-UNIVERSE.md`
12. `12-PERSISTENCE-AND-STABLE-IDS.md`
13. `13-PERFORMANCE-BUDGETS.md`
14. `14-TEST-STRATEGY.md`
15. `15-IMPLEMENTATION-ROADMAP.md`
16. `16-FILE-BY-FILE-PLAN.md`
17. `17-ACCEPTANCE-CRITERIA.md`
18. `18-RISKS-AND-GUARDRAILS.md`
19. `19-SOURCE-RESEARCH.md`
20. `20-AGENT-EXECUTION-CONTRACT.md`

## Decisões centrais

A Terra será um elipsoide WGS84 real. O código atual de Manaus continuará usando metros e continuará visualmente reconhecível, mas será ancorado na Terra por frames geodésicos.

A GPU nunca receberá o universo inteiro em um único `Vector3`. O estado lógico será hierárquico e de alta precisão. O renderer receberá apenas coordenadas locais apropriadas ao domínio visual atual.

O sistema atual de floating origin será preservado como conceito. Hoje ele rebasa X/Z a cada 2.048 m. A nova implementação generaliza isso para X/Y/Z, reference frames e escalas planetárias.

A Manaus compilada continuará sendo a camada de maior prioridade. Fora da cobertura real de Manaus, o planeta poderá ter terreno e hidrografia reais em LOD baixo ou médio, mas não será necessário gerar todas as cidades do mundo nesta etapa.

O Sistema Solar terá corpos com raios e distâncias lógicas reais. Efemérides podem vir de JPL Horizons ou de dados offline derivados dele. A renderização distante usa tamanho angular e representação escalada.

A Via Láctea e o universo não serão um banco de trilhões de objetos. Setores serão determinísticos, procedurais e gerados quando necessários. Catálogos reais entram apenas onde fizerem sentido.

## Regra de arquitetura

```text
universo lógico gigantesco
        |
        v
reference frame ativo
        |
        v
coordenadas locais estáveis
        |
        v
streaming + LOD + cache
        |
        v
cena Three.js pequena
```

O princípio é simples:

```text
o mundo lógico pode ser enorme
a cena renderizada nunca deve ser enorme
```
