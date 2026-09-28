# Plano arquivo por arquivo

Baseline congelada deste pacote:

```text
branch: feat/universe-map
HEAD: 2609e4d30901720f9b18e05939f717e590dc7140
```

Este documento descreve o proximo patch da arquitetura planetaria/celeste do DR Manaus.
A ordem e deliberada. Primeiro estabilizar coordenadas, render e testes de transicao.
Depois transformar Lua, Sol e planetas em destinos reais do jogo.

A regra central do patch e:

```text
coordenadas logicas podem ser enormes
coordenadas entregues ao renderer devem permanecer pequenas
```

O estado logico continua em metros reais e em frames hierarquicos.
O renderer recebe apenas posicoes relativas ao observador ou ao render origin.

## Task 001 - src/game/Game.ts

Objetivo: orquestrar dominio, suspensao local, render context e E2E telemetry

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - src/world/runtime/UniverseRuntime.ts

Objetivo: fonte de verdade de frame, body context e render origin

Arquivos principais:
- `src/world/runtime/UniverseRuntime.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - src/world/spatial/RenderSpaceService.ts

Objetivo: novo servico camera-relative

Arquivos principais:
- `src/world/spatial/RenderSpaceService.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - src/world/spatial/RenderOrigin.ts

Objetivo: novo tipo de origem visual

Arquivos principais:
- `src/world/spatial/RenderOrigin.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - src/world/spatial/ReferenceFrameGraph.ts

Objetivo: conversao logica, sem responsabilidade de render

Arquivos principais:
- `src/world/spatial/ReferenceFrameGraph.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - src/world/spatial/FloatingOrigin3D.ts

Objetivo: rebases logicos/render origin

Arquivos principais:
- `src/world/spatial/FloatingOrigin3D.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - src/world/spatial/FrameIds.ts

Objetivo: IDs canonicos

Arquivos principais:
- `src/world/spatial/FrameIds.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - src/world/spatial/BodySurfaceFrame.ts

Objetivo: surface frames genericos

Arquivos principais:
- `src/world/spatial/BodySurfaceFrame.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - src/world/providers/WorldProvider.ts

Objetivo: RenderContext e hooks de rebase

Arquivos principais:
- `src/world/providers/WorldProvider.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - src/world/providers/EarthProvider.ts

Objetivo: Earth body-local + render-relative

Arquivos principais:
- `src/world/providers/EarthProvider.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - src/world/providers/MoonProvider.ts

Objetivo: Moon body-local + render-relative

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - src/world/providers/PlanetSurfaceProvider.ts

Objetivo: generalizacao futura

Arquivos principais:
- `src/world/providers/PlanetSurfaceProvider.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - src/world/planet/EarthGlobe.ts

Objetivo: group body-local, tiles relative

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - src/world/planet/MoonGlobe.ts

Objetivo: group body-local, tiles relative

Arquivos principais:
- `src/world/planet/MoonGlobe.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - src/world/celestial/SolarSystem.ts

Objetivo: relative state, body orientation, dominance hysteresis

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - src/world/celestial/CelestialBody.ts

Objetivo: manifest/schema

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - src/world/celestial/OfflineEphemeris.ts

Objetivo: fallback offline

Arquivos principais:
- `src/world/celestial/OfflineEphemeris.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - src/world/celestial/HorizonsEphemeris.ts

Objetivo: futuro dataset sampled

Arquivos principais:
- `src/world/celestial/HorizonsEphemeris.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - src/world/celestial/SunVisual.ts

Objetivo: Sol visual

Arquivos principais:
- `src/world/celestial/SunVisual.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - src/world/celestial/CelestialVisualProvider.ts

Objetivo: far body representation

Arquivos principais:
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - src/world/celestial/CelestialRenderState.ts

Objetivo: LOD state

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - src/world/travel/TravelDomain.ts

Objetivo: state machine

Arquivos principais:
- `src/world/travel/TravelDomain.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - src/world/travel/InterplanetaryController.ts

Objetivo: relative motion

Arquivos principais:
- `src/world/travel/InterplanetaryController.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - src/world/travel/Handoff.ts

Objetivo: transacao de frame

Arquivos principais:
- `src/world/travel/Handoff.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - src/world/travel/SurfaceDomain.ts

Objetivo: surface physics body

Arquivos principais:
- `src/world/travel/SurfaceDomain.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - src/rendering/domains/RenderDomains.ts

Objetivo: ranges e layers

Arquivos principais:
- `src/rendering/domains/RenderDomains.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - src/rendering/domains/CelestialSceneRoots.ts

Objetivo: roots

Arquivos principais:
- `src/rendering/domains/CelestialSceneRoots.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - src/rendering/RendererManager.ts

Objetivo: depth mode benchmark

Arquivos principais:
- `src/rendering/RendererManager.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - src/rendering/Atmosphere.ts

Objetivo: body-aware atmosphere

Arquivos principais:
- `src/rendering/Atmosphere.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - src/rendering/SpaceLayer.ts

Objetivo: migrar legacy Sun/Moon

Arquivos principais:
- `src/rendering/SpaceLayer.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 031 - src/player/CameraController.ts

Objetivo: proxy local

Arquivos principais:
- `src/player/CameraController.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 032 - src/player/PlayerController.ts

Objetivo: gravity/body policy

Arquivos principais:
- `src/player/PlayerController.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 033 - src/physics/PhysicsWorld.ts

Objetivo: surface provider

Arquivos principais:
- `src/physics/PhysicsWorld.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 034 - src/world/destruction/TerrainDestruction.ts

Objetivo: body/frame awareness

Arquivos principais:
- `src/world/destruction/TerrainDestruction.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 035 - src/world/persistence/WorldMutationStore.ts

Objetivo: body namespace

Arquivos principais:
- `src/world/persistence/WorldMutationStore.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 036 - src/ui/HUD.ts

Objetivo: location/domain/body

Arquivos principais:
- `src/ui/HUD.ts`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 037 - scripts/browser-test.mjs

Objetivo: E2E real

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 038 - scripts/profile-celestial.mjs

Objetivo: performance

Arquivos principais:
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 039 - .github/workflows/ci.yml

Objetivo: checks

Arquivos principais:
- `.github/workflows/ci.yml`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 040 - docs/world/15-status.md

Objetivo: status medido

Arquivos principais:
- `docs/world/15-status.md`

Alteracao exigida:

- Aplicar somente as responsabilidades descritas.
- Nao transferir logica de outro subsistema para este arquivo por conveniencia.
- Atualizar testes junto com a mudanca.

Validacao:

- Typecheck.
- Teste unitario especifico.
- Browser se tocar renderer/input.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
