# DR-MANAUS | Next Actions — Sequência de Engenharia Contínua

## Concluídos e Validados em CI (100% Verde no GitHub Actions)
- **U4.5.4.1** — Hotfix de consistência geométrica e relevo canônico ETOPO5.
- **BH0 a BH2.2** — Buracos negros completos, relatividade, buracos estelares e túnel de minhoca 3D.
- **U5, U6, U7** — Mapa Universal multiescala, horizonte cosmológico e teleporte universal infinito.
- **ISSUE-01 a ISSUE-04** — Anel de fótons, cache Atlas e transição suave Terra-órbita.
- **D2 a D5** — Escavação profunda, fratura tectônica, destruição macro planetária e dispersão de corpos menores.
- **VIVO-01 a VIVO-16** — Universo Vivo completo: biosferas determinísticas, biomas, flora instanciada WebGPU, fauna e IA de predação/manadas, scanner cósmico, assentamentos, combate multi-domínio, teleporte universal seguro, perigos planetários, ruptura planetária e reconstrução cósmica.
- **VIVO-17 a VIVO-19** — Correção real de gameplay, máquina de estados com hold de 2,5s, apresentação em 7 fases observáveis com ocultação de globo intacto, referencial limpo de entidades de vida em `activePlanetaryLifeRoot`, persistência determinística e benchmarks.
- **VALIDAÇÃO IN-BROWSER PLAYWRIGHT 60 FPS** — Suíte executada em Chromium real com aceleração gráfica (`scripts/universo-vivo-browser-validation.mjs`), aprovando todos os 6 critérios de aceitação e 60.0 FPS estáveis.
- **EARTH-01 (`MAN-05`)** — Classificação determinística da superfície terrestre (`classifyEarthSurface`), biomas, oceano, calotas polares de gelo e mancha urbana de Manaus (`specs/dr-manaus-cosmic-night-specs/03-EARTH-SURFACE-BIOMES-OCEAN-ICE.md`). Validado no CI com SHA `c596bc8` (Runs #43461716161 e #43461727550 SUCCESS).
- **GRAV-01 (`06-ZERO-G-AND-GRAVITY-DOMAINS.md`)** — Fontes de gravidade celeste (`GravitySource`), point-mass Newton ($a = -\mu \vec{r}/r^3$), regime zero-g inercial, threshold de gameplay e dinâmica orbital qualitativa em `InterplanetaryController`. Validado no CI com SHA `badfa32` (Runs #43462682665 e #43462669631 SUCCESS).
- **TRANS-01 (`04-EARTH-ALTITUDE-TRANSITION.md`)** — Transição contínua da Terra de 0m a 400.000m, eliminação formal do chão preto (`localWeight + planetWeight >= 0.99`), desvanecimento atmosférico contínuo e histerese segura de ownership. Validado no CI com SHA `51eb4df` (Runs #43463682957 e #43463672694 SUCCESS).
- **LOD-STREAM-01 (`14-COSMIC-LOD-STREAMING-PERFORMANCE.md`)** — Hard caps High centralizados para tiles planetários, setores estelares, estrelas visíveis e pontos de galáxia, preservando SSE, cache LRU e budgets do scheduler.
- **COSMIC-WEB-01 (`12-GREAT-ATTRACTOR-COSMIC-WEB.md`)** — Campo esparso analítico de densidade, filamentos, vazios e candidatos de clusters reais no `LargeScaleStructureProvider`, com Norma/Great Attractor como anchor físico.
- **WGS84-MANAUS-01 (`05-MANAUS-FULL-WGS84-UNIFICATION.md`)** — Facade `SurfaceFrameService` com frame por tile, conversão legacy→render-local e transformação de colliders, mantendo cache por corpo/tile.

## Patch Atual: Integração de gravidade no runtime
- **GRAV-02 (`06-ZERO-G-AND-GRAVITY-DOMAINS.md`)** — `Game` agora constrói fontes de gravidade a partir dos corpos ativos e as fornece ao contexto de voo interplanetário, mantendo a dinâmica fora da física ENU local.

## Próximos Passos de Engenharia (Roadmap Contínuo)
1. **SOLAR-03 (`07-SOLAR-SYSTEM-COMPLETE.md`)**:
   - Consumir `PlanetVisualProfile` na camada visual canônica dos corpos.
2. **BUGS-02 (`02-BUGS-REMAINING.md`)**:
   - Propagar o `SurfaceFrameService` para roads, água, landmarks, tráfego e colliders restantes.

## Estado Geral do Projeto
- **Total de Testes Unitários:** 1.779 / 1.779 Aprovados (100%)
- **Testes de Regressão Permanente:** 638 / 638 Aprovados (100%)
- **Typecheck TypeScript:** 0 Erros
- **Vite Production Build:** Aprovado
- **Status do Repositório:** Pronto para commit e publicação da branch `feat/universe-map`.
