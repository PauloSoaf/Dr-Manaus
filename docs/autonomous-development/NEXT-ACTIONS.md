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
- **WGS84-MANAUS-01 & BUGS-02.1..5** — Fachada `SurfaceFrameService` com cache LRU, base ortonormal dextrógira ($\det = +1$), curvatura de aeroporto/Largo/NPCs/missões e `SolarSystem.bodies` imutável (`159a949`, `413db0a`, `6294778`, `917c791`, `64a1aa6`, `7aa8696`).

## Patch Atual: WGS84-MANAUS-03
- Jacobiana de escala legacy em `SurfaceTileFrame.getSceneMatrix()` garantindo coincidência entre prédio, rua, roda de veículo, terreno e colisor em toda a extensão de tiles distantes.
- Classificação `ShallowWater` costeira, atributo `surfaceClass` em `EarthGlobe` e shader TSL único com Ocean Fresnel e Sun glint.

## Próximos Passos de Engenharia (Roadmap Contínuo)
1. **EARTH-DETAIL-RELIEF (`02-REMAINING-BUGS.md` P1-04 / P1-07)**:
   - Hierarquia determinística de micro-relevo near-surface para altitudes `< 15 km` em regiões não-urbanas da Terra (preservando cota zero sobre oceano e Manaus).
   - Continuidade visual entre domo atmosférico local e casca atmosférica planetária na faixa de transição (8–20 km).

## Estado Geral do Projeto
- **Total de Testes Unitários:** 1.787 / 1.787 Aprovados (100%)
- **Testes de Regressão Permanente:** 638 / 638 Aprovados (100%)
- **Typecheck TypeScript:** 0 Erros
- **Vite Production Build:** Aprovado
- **Status do Repositório:** Pronto para commit e publicação da branch `feat/universe-map`.
