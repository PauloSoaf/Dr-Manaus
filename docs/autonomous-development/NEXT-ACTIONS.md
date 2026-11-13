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

## Patch Atual: Transição de Altitude e Apresentação Atmosférica
- **TRANS-01 (`04-EARTH-ALTITUDE-TRANSITION.md`)** — Transição contínua da Terra de 0m a 400.000m, eliminação formal do chão preto (`localWeight + planetWeight >= 0.99`), desvanecimento atmosférico contínuo e histerese segura de ownership. 7 novos testes unitários adicionados.

## Próximos Passos de Engenharia (Roadmap Contínuo)
1. **LOD-STREAM-01 (`14-COSMIC-LOD-STREAMING-PERFORMANCE.md`)**:
   - Auditoria de streaming de LOD angular e orçamento de memória de geometria celeste.
2. **SOLAR-02 (`07-SOLAR-SYSTEM-COMPLETE.md`)**:
   - Consolidação de órbitas e anéis planetários detalhados (Saturno, Júpiter, Urano, Netuno).

## Estado Geral do Projeto
- **Total de Testes Unitários:** 1.773 / 1.773 Aprovados (100%)
- **Testes de Regressão Permanente:** 638 / 638 Aprovados (100%)
- **Typecheck TypeScript:** 0 Erros
- **Vite Production Build:** Aprovado
- **Status do Repositório:** Pronto para commit e publicação da branch `feat/universe-map`.
