# LOD celestial baseado em tamanho angular

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

## Task 001 - Angular radius metric

Objetivo: base de LOD

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Point LOD

Objetivo: subpixel

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Disc LOD

Objetivo: pequeno corpo

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Sphere LOD

Objetivo: corpo resolvido

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Planet LOD

Objetivo: tiles visiveis

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Surface LOD

Objetivo: physics ativo

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Crossfade point-disc

Objetivo: sem pop

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Crossfade disc-sphere

Objetivo: sem pop

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Crossfade sphere-tiles

Objetivo: sem dupla superficie

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Hysteresis angular

Objetivo: evitar flicker

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Distance independent policy

Objetivo: mesma logica para planetas

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Pixel threshold presets

Objetivo: quality dependent

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Occlusion

Objetivo: body behind body

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Horizon culling

Objetivo: planet surface

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - Backface culling

Objetivo: winding correto

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Atmosphere shell LOD

Objetivo: Earth/Venus etc

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Cloud LOD

Objetivo: Earth/Venus/Jupiter

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Ring LOD

Objetivo: Saturn/Uranus

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Shadow LOD

Objetivo: eclipses

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Sun LOD

Objetivo: disc/corona

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Moon LOD

Objetivo: sky/sphere/surface

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Earth from Moon

Objetivo: sphere/tiles

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - Texture resolution

Objetivo: screen-size based

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - Geometry budget

Objetivo: triangles based on angular size

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - GPU upload budget

Objetivo: staggered

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - No all planets meshes

Objetivo: only relevant detailed bodies

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - Far bodies batch

Objetivo: instancing/sprites

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - Star system culling

Objetivo: view cone

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - Render layer policy

Objetivo: local/planet/celestial

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - Depth policy

Objetivo: log/reverse benchmark

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 031 - Telemetry

Objetivo: lod mode per body

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 032 - Test angular thresholds

Objetivo: deterministic

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 033 - Test no pop

Objetivo: pixel delta

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 034 - Test max draw calls

Objetivo: budget

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 035 - Test max triangles

Objetivo: budget

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`
- `src/rendering/domains/RenderDomains.ts`
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Derivar decisao de tamanho angular e viewport.
- Aplicar histerese.
- Manter duas representacoes apenas durante crossfade curto.
- Liberar a mais cara ao sair do band.

Validacao:

- Testar thresholds para 720p e 1080p.
- Testar aproximacao e afastamento.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
