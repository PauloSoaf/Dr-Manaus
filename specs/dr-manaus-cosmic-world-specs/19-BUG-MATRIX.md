# Bug matrix

| ID | Severidade | Arquivo principal | Problema | Correção alvo |
|---|---|---|---|---|
| P0-01 | ~~crítica~~ resolvido | `ManausProvider.ts` | provider registrado mas não implementado | implementar adapter real ou desregistrar |
| P0-02 | ~~crítica~~ resolvido | `EarthProvider.ts` | globo substitui ground cedo demais | restaurar gate seguro |
| P0-03 | crítica | building/HLOD/chunks | curvatura parcial/esférica | tile frame WGS84 |
| P0-04 | ~~crítica~~ parcial | `flightConfig.ts` / `PlayerController.ts` | FTL na física local | travel controller separado |
| P0-05 | crítica | `UniverseRuntime.ts` | sector state sobrescrito | authority explícita |
| P0-06 | crítica | `SolarSystem.ts` | Sistema Solar substituído | generic system runtime |
| P1-01 | ~~alta~~ resolvido | `flightConfig.ts` | velocidade interplanetária inconsistente | corrigir requisito/valor |
| P1-02 | alta | `EarthGlobe.ts` | terrain random por tile | DEM real |
| P1-03 | alta | `UniverseRenderer.ts` | sem scheduler/eviction | streaming lifecycle |
| P1-04 | alta | `UniverseRenderer.ts` | setor vem de player local | usar cosmic address |
| P1-05 | ~~alta~~ resolvido | `UniverseAddress.ts` | bigint passa por Number | preservar bigint |
| P1-06 | alta | `SystemGenerator.ts` | órbita calculada e descartada | orbital elements |
| P1-07 | alta | `CameraController.ts` | sceneScale parcial | render-local frames |
| P1-08 | alta | `WorldMutationStore.ts` | persistence incompleta | IndexedDB + schema |
| P2-01 | ~~média~~ resolvido | `CurveManaus.ts` | arquivo vazio | remover ou implementar |
| P2-02 | média | docs/status | status otimista | usar estados factuais |

## Estado em 2026-09-26

Resolvido nesta passagem:

- **P0-01** `ManausProvider` removido e desregistrado. A opção escolhida foi "retirar o registro até
  a integração estar pronta"; Sprint H2 é quem o implementa.
- **P0-02** gate restaurado, mas como opção (`cityOwnsGround`) ligada a `FEATURES.curvedManaus` em
  vez de constante. O gate cai sozinho quando a cidade estiver curvada, não por um comentário.
- **P1-01** interplanetária é 800 000 km/h (222 222 m/s) e `maxSpeed` acompanha.
- **P1-05** `sectorIndex` preserva `bigint`. Antes passava por `Number` e dois setores a algumas
  centenas de anos-luz de distância colapsavam no mesmo índice. Coberto por teste.
- **P2-01** `CurveManaus.ts` (arquivo vazio) removido.

Parcial:

- **P0-04** a física local já não recebe FTL: o tier `cosmic` (que resolvia para mega, sem chip de
  HUD e sem velocidade própria) foi removido, e o teto de altitude voltou. O `TravelDomain`
  continua por fazer — Sprint H5.

Regressões corrigidas do Sprint H0 anterior:

- `coveredByCity()` tinha sido desligado com `curvedManaus: false`, o que é exatamente o que P0-02
  proíbe. Voltou.
- Três testes tinham sido marcados `test.skip` em vez de corrigidos, incluindo o que guarda a
  rotação dos tiles. Todos voltaram a rodar: dois passaram assim que o gate voltou, e o terceiro
  apontava para o shell de atmosfera novo, que compartilha o grupo com os tiles.
- O teto de altitude tinha sido removido. O roadmap diz para removê-lo **depois** do handoff
  (Sprint H5), que ainda não existe.

Gate do Sprint H0: build verde, 250 testes verdes, 0 skipped.
