# Lua pousavel e vertical slice Terra-Lua

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

## Task 001 - MoonBodySurfaceAdapter

Objetivo: converter lat/lon/height lunar

Arquivos principais:
- `src/world/spatial/MoonFrameAdapter.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Moon surface frame

Objetivo: criar local tangent frame

Arquivos principais:
- `src/world/spatial/BodySurfaceFrame.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Moon landing gate

Objetivo: range, speed e surface readiness

Arquivos principais:
- `src/world/travel/TravelDomain.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Moon terrain provider

Objetivo: usar tiles existentes

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Moon DEM interface

Objetivo: permitir trocar procedural por real

Arquivos principais:
- `src/world/planet/MoonSurface.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Moon collision height

Objetivo: physics provider

Arquivos principais:
- `src/physics/`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Moon local gravity

Objetivo: 1.62 m/s2 aproximado

Arquivos principais:
- `src/physics/`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Player jump gravity

Objetivo: usar gravity profile do body

Arquivos principais:
- `src/player/PlayerController.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Moon flight mode

Objetivo: hover e flight adaptados

Arquivos principais:
- `src/player/PlayerController.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Moon destruction

Objetivo: crateras com bodyId moon

Arquivos principais:
- `src/world/destruction/TerrainDestruction.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Moon persistence

Objetivo: salvar deformacao por tile/body

Arquivos principais:
- `src/world/persistence/WorldMutationStore.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Moon material

Objetivo: regolith sem green fallback

Arquivos principais:
- `src/world/planet/MoonGlobe.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Moon lighting

Objetivo: solar direction real

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Moon night

Objetivo: sem atmosphere ambient artificial

Arquivos principais:
- `src/world/planet/MoonGlobe.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - Moon horizon

Objetivo: curvature correta

Arquivos principais:
- `src/world/planet/MoonGlobe.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Moon local origin

Objetivo: floating origin sobre superficie

Arquivos principais:
- `src/world/spatial/RenderSpaceService.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Moon streamer

Objetivo: SSE perto do solo

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Moon collider budget

Objetivo: heightfield, nao collider por triangulo

Arquivos principais:
- `src/physics/`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Moon spawn

Objetivo: safe landing query

Arquivos principais:
- `src/world/travel/Handoff.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Moon return

Objetivo: surface -> interplanetary

Arquivos principais:
- `src/world/travel/Handoff.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Moon map target

Objetivo: HUD body orbit/surface

Arquivos principais:
- `src/ui/HUD.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Moon coordinates

Objetivo: UniverseCoordinates surface moon

Arquivos principais:
- `src/world/spatial/UniverseCoordinates.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - Moon debug teleport

Objetivo: dev only

Arquivos principais:
- `src/ui/HUD.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - Moon no atmosphere

Objetivo: audio/sky policy

Arquivos principais:
- `src/rendering/Atmosphere.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - Moon stars visible

Objetivo: space background

Arquivos principais:
- `src/rendering/SpaceLayer.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - Earth in lunar sky

Objetivo: Earth visual provider

Arquivos principais:
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - Earth angular size

Objetivo: correct relative

Arquivos principais:
- `tests/moon-sky.test.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - Landing e2e

Objetivo: Earth -> Moon -> land

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - Takeoff e2e

Objetivo: Moon -> space

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - Return e2e

Objetivo: Moon -> Earth -> Manaus

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 031 - No reload

Objetivo: toda viagem sem reload

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 032 - Surface readiness

Objetivo: parent tiles ate child pronto

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 033 - LOD cracks

Objetivo: skirt/morph se necessario

Arquivos principais:
- `src/world/planet/MoonGlobe.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 034 - Real data future

Objetivo: LOLA/LRO adapter slot

Arquivos principais:
- `src/world/planet/MoonSurfaceData.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 035 - Procedural fallback

Objetivo: deterministico

Arquivos principais:
- `src/world/planet/MoonSurface.ts`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 036 - Moon acceptance

Objetivo: vertical slice oficial

Arquivos principais:
- `docs/world/`

Alteracao exigida:

- Nao generalizar toda a engine antes da Lua funcionar.
- Usar o mesmo RenderSpace do P0.
- Surface domain so ativa quando provider esta pronto.
- Persistencia sempre namespaced por `moon`.

Validacao:

- Unit de frame.
- Physics de superficie.
- Browser landing.
- Browser return.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
