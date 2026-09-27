# Bug matrix

| ID | Severidade | Arquivo principal | Problema | Correção alvo |
|---|---|---|---|---|
| P0-01 | crítica | `ManausProvider.ts` | provider registrado mas não implementado | implementar adapter real ou desregistrar |
| P0-02 | crítica | `EarthProvider.ts` | globo substitui ground cedo demais | restaurar gate seguro |
| P0-03 | crítica | building/HLOD/chunks | curvatura parcial/esférica | tile frame WGS84 |
| P0-04 | crítica | `flightConfig.ts` / `PlayerController.ts` | FTL na física local | travel controller separado |
| P0-05 | crítica | `UniverseRuntime.ts` | sector state sobrescrito | authority explícita |
| P0-06 | crítica | `SolarSystem.ts` | Sistema Solar substituído | generic system runtime |
| P1-01 | alta | `flightConfig.ts` | velocidade interplanetária inconsistente | corrigir requisito/valor |
| P1-02 | alta | `EarthGlobe.ts` | terrain random por tile | DEM real |
| P1-03 | alta | `UniverseRenderer.ts` | sem scheduler/eviction | streaming lifecycle |
| P1-04 | alta | `UniverseRenderer.ts` | setor vem de player local | usar cosmic address |
| P1-05 | alta | `UniverseAddress.ts` | bigint passa por Number | preservar bigint |
| P1-06 | alta | `SystemGenerator.ts` | órbita calculada e descartada | orbital elements |
| P1-07 | alta | `CameraController.ts` | sceneScale parcial | render-local frames |
| P1-08 | alta | `WorldMutationStore.ts` | persistence incompleta | IndexedDB + schema |
| P2-01 | média | `CurveManaus.ts` | arquivo vazio | remover ou implementar |
| P2-02 | média | docs/status | status otimista | usar estados factuais |
