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

## Patch Atual: Módulo de Superfície Terrestre
- **EARTH-01 (`MAN-05`)** — Classificação determinística da superfície terrestre (`classifyEarthSurface`), biomas, oceano, calotas polares de gelo e mancha urbana de Manaus (`specs/dr-manaus-cosmic-night-specs/03-EARTH-SURFACE-BIOMES-OCEAN-ICE.md`). Validado com 4/4 testes novos e 1.759 testes gerais.

## Próximos Passos de Engenharia (Roadmap Contínuo)
1. **HERO-05 / GRAV-01 (`06-ZERO-G-AND-GRAVITY-DOMAINS.md`)**:
   - Implementar a interface `GravitySource` canônica com campos `id`, `frameId`, `mu`, `collisionRadiusM`, `influenceRadiusM` e `accelerationAt(positionM: Vec3): Vec3`.
   - Implementar point-mass gravity $a = -\mu \frac{\vec{r}}{|\vec{r}|^3}$ e seleção dos corpos celestes dominantes (Sol, planeta próximo, lua próxima).
   - Conectar no `InterplanetaryController` o cálculo de gravidade celeste vs gravidade local de superfície e threshold de zero-g inercial no espaço profundo.
2. **EARTH-02 / TRANS-01 (`04-EARTH-ALTITUDE-TRANSITION.md`)**:
   - Polimento da transição contínua de altitude de 0m a 2.000km, blend de névoa atmosférica e iluminação cósmica.

## Estado Geral do Projeto
- **Total de Testes Unitários:** 1.759 / 1.759 Aprovados (100%)
- **Testes de Regressão Permanente:** 638 / 638 Aprovados (100%)
- **Typecheck TypeScript:** 0 Erros
- **Vite Production Build:** Aprovado
- **Status do Repositório:** Pronto para commit e publicação da branch `feat/universe-map`.
