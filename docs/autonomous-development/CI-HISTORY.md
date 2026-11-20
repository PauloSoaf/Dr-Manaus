# DR-MANAUS | CI History & Verification Log

Este documento rastreia os runs oficiais de validação do GitHub Actions no repositório `PauloSoaf/Dr-Manaus` na branch `feat/universe-map`.

| Run ID | Commit SHA | Milestone | Testes Gerais | Regressões Permanentes | Status | Causa Raiz / Observações |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `42541489643` | `375584e` | U4.5.2.3 | 1.563 / 1.563 | 638 / 638 | APROVADO | Fixture do Atlas Cósmico estabilizado com `ResolvedUniversalTarget` autêntico |
| `42543820898` | `356b98e` | U4.5.3 | 1.573 / 1.573 | 638 / 638 | APROVADO | Diversidade estelar e planetária procedural, classes O-M, gravidade superficial |
| `42558085566` | `d9e777f` | U4.5.3.1 | 1.579 / 1.579 | 638 / 638 | APROVADO | Integração real de mundos procedurais ao Atlas, pouso em fotosfera, taxonomia canônica |
| `42940721868` | `d41fc2d` | U4.5.4 | 1.585 / 1.587 | 638 / 638 | FALHA | Falhas em `T_U454_07` (elipsoide direcional vs esfera) e `T_U454_08` (cota NOAA ETOPO5 5742m vs asserção >8000m) |
| `43034411855` | `3eda1ca` | U7 + Test Fix | 1.637 / 1.637 | 638 / 638 | APROVADO | 100% verde: U5, U6, U7 e normalização unitária em T_U454_07 |
| `43034426451` | `3eda1ca` | U7 + Test Fix | 1.637 / 1.637 | 638 / 638 | APROVADO | Validação concorrente aprovada (Vite 8.3.0, TypeScript 0 erros) |
| `43036032343` | `b118829` | Cosmic Hardening | 1.637 / 1.637 | 638 / 638 | APROVADO | Desacoplamento de BlackHoleDefinition, limpeza de LargeScaleStructureProvider e matriz 100% verde |
| `43036554791` | `ac307f1` | Status Documentation | 1.637 / 1.637 | 638 / 638 | APROVADO | Validação de push: build de produção, regressões permanentes e 100% verde |
| `43036567036` | `ac307f1` | Status Documentation | 1.637 / 1.637 | 638 / 638 | APROVADO | Validação de Pull Request #4 aprovada integralmente |
| `43038048375` | `57d0312` | Atlas URI Search | 1.637 / 1.637 | 638 / 638 | APROVADO | Busca direta por URI compartilhável `drm:v1://` no CosmicAtlasModel |
| `43038059459` | `57d0312` | Atlas URI Search | 1.637 / 1.637 | 638 / 638 | APROVADO | Validação de Pull Request #4 aprovada para suporte a URI no Atlas |
| `43039228790` | `2e06284` | ISSUE-01 Photon Ring | 1.637 / 1.637 | 638 / 638 | APROVADO | Anel de fótons relativístico orientado ao observador contornando a sombra de buracos negros |
| `43042460961` | `063190f` | ISSUE-02 Atlas Scale | 1.640 / 1.640 | 638 / 638 | APROVADO | Cache consolidado de targetMap, bodyMetadataCache e query $O(N)$ em passagem única |
| `43042445861` | `063190f` | ISSUE-02 Atlas Scale | 1.640 / 1.640 | 638 / 638 | APROVADO | Validação de Pull Request #4 aprovada integralmente |
| `43043695919` | `57d058c` | ISSUE-04 Earth Trans | 1.642 / 1.642 | 638 / 638 | APROVADO | orbitLift para nevoeiro orbital e desvanecimento Hermite cúbico da casca atmosférica WGS84 |
| `43043685486` | `57d058c` | ISSUE-04 Earth Trans | 1.642 / 1.642 | 638 / 638 | APROVADO | Validação de Pull Request #4 aprovada integralmente |



- 7dc0f57 (BH1.1/BH2.1): push run 43055389258 SUCCESS; pull_request run 43055399191 FAILURE at 'Unit tests' (log unavailable without auth). Local: 1648/1648 x3, regression 638/638. Tree identical to HEAD (main is a stale ancestor, merge clean) -> investigating flake. 2026-11-11T12:16:00-04:00

- 5a4eb38: push + pull_request SUCCESS -> 7dc0f57 PR failure classified as flake. BH1.2 (HUD black-hole telemetry) validated locally 1648/1648, 638/638. 2026-11-11T12:22:00-04:00
- fdad6f7 (BH1.2 HUD Telemetry): push run 43057588955 SUCCESS; PR run 43057599012 SUCCESS. 1.648/1.648 passed.
- 2b677af (BH1.3 Stellar Black Holes): push run 43078901001 SUCCESS; PR run 43078910480 SUCCESS. 1.651/1.651 passed.
- a7c476e (BH2.2 Wormhole Presentation & 54 Specs Tracker): push run 43088038666 SUCCESS; PR run 43088050501 SUCCESS. 1.655/1.655 passed. 2026-11-11T15:33:00-04:00
- 7a543e7 (D2 Deep Planetary Excavation): push run 43090344377 SUCCESS; PR run 43090353806 SUCCESS. 1.661/1.661 passed. 2026-11-11T15:45:00-04:00
- c260032 (D3 Geomechanical Crust Fracture): push run 43091828500 SUCCESS; PR run 43091841173 SUCCESS. 1.666/1.666 passed. 2026-11-11T15:58:00-04:00
- d22efdd (D4 Partial Planetary Fracture & Debris Rings): push run 43093427827 SUCCESS; PR run 43093436603 SUCCESS. 1.671/1.671 passed. 2026-11-11T16:08:00-04:00
- 72e6468 (D5 Minor Body Disruption & Asteroid Fields): push run 43094667147 SUCCESS; PR run 43094679407 SUCCESS. 1.676/1.676 passed. 2026-11-11T16:17:00-04:00
- 365a5cc (Documentation & Master Tracker Sync): push run 43095309023 SUCCESS. 1.676/1.676 passed. 2026-11-11T16:22:00-04:00
- eaeab77 (VIVO-01 Deterministic Biosphere Profile & Seed Channels): push run 43248198129 SUCCESS; PR run 43248209627 SUCCESS. 1.681/1.681 passed, 638/638 regressions. 100% verde. 2026-11-12T11:31:00-04:00
- e39ddf5 (VIVO-02 Deterministic Biomes & Climate Service): push run 43249484116 SUCCESS; PR run 43249500485 SUCCESS. 1.687/1.687 passed, 638/638 regressions. 100% verde. 2026-11-12T11:37:00-04:00
- 2b3c8f8 (VIVO-03 Instanced Alien Flora Renderer): push run 43250867443 SUCCESS; PR run 43250880996 SUCCESS. 1.692/1.692 passed, 638/638 regressions. 100% verde. 2026-11-12T11:45:00-04:00
- f037141 (VIVO-04 Alien Fauna Manager & Economic AI): push run 43252195971 SUCCESS; PR run 43252212393 SUCCESS. 1.697/1.697 passed, 638/638 regressions. 100% verde. 2026-11-12T11:53:00-04:00
- b479840 (VIVO-05 Scanner Cósmico de Espécies Alienígenas): push run 43253323529 SUCCESS; PR run 43253338186 SUCCESS. 1.701/1.701 passed, 638/638 regressions. 100% verde. 2026-11-12T11:59:00-04:00
- f9ed8ae (VIVO-06 Combate Multi-Domínio com Alvos Planetários em PowerSystem e Game): push run 43255766467 SUCCESS; PR run 43255780686 SUCCESS. 1.706/1.706 passed, 638/638 regressions. 100% verde. 2026-11-12T12:12:00-04:00
- e139447 (VIVO-10 Teleporte Universal Interplanetário e Intergaláctico Seguro): push run 43257969760 SUCCESS; PR run 43258191682 SUCCESS. 1.711/1.711 passed, 638/638 regressions. 100% verde. 2026-11-12T12:25:00-04:00
- 1a0c951 (VIVO-12/13/14 Ruptura Planetária, Cinturão de Destroços e Reconstrução Cósmica): push run 43261169662 SUCCESS; PR run 43261187011 SUCCESS. 1.716/1.716 passed, 638/638 regressions. 100% verde. 2026-11-12T12:41:00-04:00
- 141f193 (VIVO-07 IA Ecológica Avançada: Predação, Manadas Flocking e Alarme Coletivo): push run 43263095058 SUCCESS; PR run 43263108111 SUCCESS. 1.721/1.721 passed, 638/638 regressions. 100% verde. 2026-11-12T12:52:00-04:00
- ad2763a (VIVO-08/09 Assentamentos Alienígenas Modulares, Habitantes e Reputação de Facções): push run 43264849873 SUCCESS; PR run 43264866334 SUCCESS. 1.727/1.727 passed, 638/638 regressions. 100% verde. 2026-11-12T13:02:00-04:00
- 4f3d25a (VIVO-11 Céu Dinâmico Planetário, Perigos Ambientais e Áudio Multi-Meio): push run 43267134084 SUCCESS; PR run 43267142842 SUCCESS. 1.735/1.735 passed, 638/638 regressions. 100% verde. 2026-11-12T13:15:00-04:00
- 6920ca8 (VIVO-15 Ruínas Ancestrais, Colossos Mecânicos e Primeiro Contato): push run 43268650312 SUCCESS; PR run 43268662875 SUCCESS. 1.741/1.741 passed, 638/638 regressions. 100% verde. 2026-11-12T13:21:00-04:00
- 5c0474a (VIVO-16 Benchmarks de Desempenho, Estabilidade de Heap e Polimento Final): push run 43269394686 SUCCESS; PR run 43269409524 SUCCESS. 1.746/1.746 passed, 638/638 regressions. 100% verde. 2026-11-12T13:25:00-04:00
- 0e4c56e (Docs & Consolidacao): push run 43270554841 SUCCESS. 1.746/1.746 passed, 638/638 regressions. 100% verde.
- ddc0651 (VIVO-17 a VIVO-19 Ruptura Planetária Visível, Máquina de Estados e Integridade de Ecossistemas): push run 43279810593 SUCCESS; PR run 43279821204 SUCCESS. 1.755/1.755 passed, 638/638 regressions. 100% verde. 2026-11-12T14:28:00-04:00
- cede50f (Docs Consolidacao): push run 43280485788 SUCCESS; PR run 43280494782 SUCCESS. 1.755/1.755 passed, 638/638 regressions. 100% verde. 2026-11-12T14:35:00-04:00
- 5250a5e (Validação In-Browser Playwright 60 FPS e Ruptura Visual Refinada): push run 43459833115 SUCCESS; PR run 43459843322 SUCCESS. 1.755/1.755 passed, 638/638 regressions. 100% verde. 2026-11-13T12:11:00-04:00
