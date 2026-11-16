# DR-MANAUS | Next Actions — Sequência de Engenharia Contínua

## Concluídos e Validados em CI (100% Verde no GitHub Actions)
- **U4.5.4.1** — Hotfix de consistência geométrica e relevo canônico ETOPO5.
- **BH0 a BH2.2** — Buracos negros completos, relatividade, buracos estelares e túnel de minhoca 3D.
- **U5, U6, U7** — Mapa Universal multiescala, horizonte cosmológico e teleporte universal infinito.
- **ISSUE-01 a ISSUE-04** — Anel de fótons, cache Atlas e transição suave Terra-órbita.
- **D2 a D5** — Escavação profunda, fratura tectônica, destruição macro planetária e dispersão de corpos menores.
- **VIVO-01 a VIVO-19** — Universo Vivo completo + validação in-browser Playwright 60 FPS (`5250a5e`).
- **EARTH-01 (`MAN-05`)** — Classificação determinística da superfície terrestre (`c596bc8`).
- **GRAV-01 & GRAV-02** — Fontes de gravidade celeste, regime zero-g inercial e integração no runtime (`badfa32`, `b423e93`).
- **TRANS-01** — Transição contínua da Terra 0–400 km sem chão preto (`51eb4df`).
- **PLAN-07 & SOLAR-03** — Perfis visuais unificados de planetas e consumo no renderer (`7d5ce9b`, `fd0cd3e`).
- **LOD-STREAM-01** — Hard caps High para streaming cósmico e planetário (`6fd79da`).
- **COSMIC-WEB-01** — Campo analítico da Teia Cósmica e Grande Atrator (`38da789`).
- **WGS84-MANAUS-01 & BUGS-02.1..4** — Fachada `SurfaceFrameService` com cache LRU, reuso em `WaterSystem` e isolamento de rupturas (`159a949`, `413db0a`, `6294778`, `917c791`, `64a1aa6`).

## Patch Atual: BUGS-02.5 (Unificação Completa de Manaus no Frame WGS84)
- `SurfaceFrameService.legacyPoseToRenderLocalMatrix` com base ortonormal dextrógira ($\det = +1$).
- Correção de orientação em `HLODManager` e `LandmarkManager`.
- Curvatura WGS84 aplicada a `airport.ts`, `LargoDistrict`, `PopulationManager`, `MissionManager` e propagação de `legacyPos` em `Game.ts`.
- Remoção de `setSystemBodies` mutável em `SolarSystem.ts`.

## Próximos Passos de Engenharia (Roadmap Contínuo)
1. **EARTH-OCEAN-ICE-VEG (`02-REMAINING-BUGS.md` P1-04 / P1-07 / P1-08 & `03-EARTH-SURFACE-BIOMES-OCEAN-ICE.md`)**:
   - Refinar comportamento óptico de oceano (Fresnel/specular glint), detalhe de elevação hierárquica near-surface e transição contínua entre domo atmosférico local e casca planetária.
2. **CURVED-MANAUS-E2E (`05-MANAUS-FULL-WGS84-UNIFICATION.md` & `16-TESTS-AND-ACCEPTANCE.md`)**:
   - Testes de paridade espacial entre base de prédio, rua, veículo, terreno e colisor em tiles distantes do anchor com `curvedManaus` ativo.

## Estado Geral do Projeto
- **Total de Testes Unitários:** 1.785 / 1.785 Aprovados (100%)
- **Testes de Regressão Permanente:** 638 / 638 Aprovados (100%)
- **Typecheck TypeScript:** 0 Erros
- **Vite Production Build:** Aprovado (2.04s)
- **Status do Repositório:** Pronto para commit e publicação da branch `feat/universe-map`.
