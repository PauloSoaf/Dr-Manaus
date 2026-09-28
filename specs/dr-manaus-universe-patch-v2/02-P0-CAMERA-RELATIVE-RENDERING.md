# P0 - Camera-relative rendering e precisao

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

## Contrato numerico

Usar dois espacos explicitamente:

```text
LogicalSpace
  Float64
  metros reais
  frame hierarquico
  pode conter AU, km, m

RenderSpace
  Number/Float32-friendly
  camera-relative
  idealmente dezenas de km
  nunca AU
```

Objetivo de seguranca inicial:

```text
abs(renderPosition.x|y|z) <= 20_000_000 m para planet surface
abs(renderPosition.x|y|z) <= 5_000_000 m para local surface gameplay
```

Corpos muito distantes nao precisam manter distancia linear integral no renderer.
Eles precisam manter direcao, tamanho angular, oclusao e transicao de LOD.

## Motivo Three.js

O renderer atual usa `logarithmicDepthBuffer`.
Isso ajuda a profundidade, mas nao recupera bits perdidos em transformacoes Float32 gigantes.
O patch deve tratar profundidade e precisao espacial como problemas diferentes.

A documentacao atual do Three.js tambem expoe `reversedDepthBuffer`.
Ele pode ser benchmarkado depois, mas nao substitui camera-relative rendering.

## Task 001 - Criar tipo RenderOrigin

Objetivo: representar a origem visual separadamente da origem logica

Arquivos principais:
- `src/world/spatial/RenderOrigin.ts`
- `src/world/spatial/FloatingOrigin3D.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Criar RenderSpaceService

Objetivo: converter qualquer frame logico para coordenadas pequenas de render

Arquivos principais:
- `src/world/spatial/RenderSpaceService.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Definir RenderPose

Objetivo: transportar frame, logical position, render position e orientation

Arquivos principais:
- `src/world/spatial/RenderPose.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - API logicalToRender

Objetivo: converter posicao por frame sem passar por Float32 grande

Arquivos principais:
- `src/world/spatial/RenderSpaceService.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - API renderToLogical

Objetivo: permitir raycasts e teleports inversos

Arquivos principais:
- `src/world/spatial/RenderSpaceService.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Render origin segue observador

Objetivo: manter jogador perto de zero visual

Arquivos principais:
- `src/world/runtime/UniverseRuntime.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Render origin muda de frame

Objetivo: rebase seguro em handoff Terra Lua

Arquivos principais:
- `src/world/spatial/FloatingOrigin3D.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Rebase event explicito

Objetivo: notificar providers sem mover estado logico

Arquivos principais:
- `src/world/spatial/FloatingOrigin3D.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Earth tile centres relative

Objetivo: subtrair origem antes de EarthGlobe.add

Arquivos principais:
- `src/world/providers/EarthProvider.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Earth fallback relative

Objetivo: aplicar mesma regra ao coarse fallback

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Moon centre relative

Objetivo: converter Lua para observador antes de MoonGlobe

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Moon tiles relative

Objetivo: garantir tiles locais ao centro lunar renderizado

Arquivos principais:
- `src/world/planet/MoonGlobe.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Sol relative

Objetivo: preparar direcao e distancia relativa normalizada

Arquivos principais:
- `src/rendering/SpaceLayer.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Planet sprite relative

Objetivo: criar contrato para corpos distantes

Arquivos principais:
- `src/world/celestial/CelestialRenderState.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - Magnitude assertion

Objetivo: rejeitar mesh positions acima do budget

Arquivos principais:
- `src/rendering/RenderSafety.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Float32 budget

Objetivo: definir max render-local distance por dominio

Arquivos principais:
- `src/rendering/domains/RenderDomains.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Camera stays local

Objetivo: camera nunca recebe AU

Arquivos principais:
- `src/player/CameraController.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Player proxy stays local

Objetivo: player model nao acompanha coordenada logica absoluta

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - WorldRoot authority

Objetivo: worldRoot usado apenas para Manaus local

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - PlanetRoot authority

Objetivo: criar root separado para planetas

Arquivos principais:
- `src/rendering/domains/CelestialSceneRoots.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - CelestialRoot authority

Objetivo: criar root separado para corpos distantes

Arquivos principais:
- `src/rendering/domains/CelestialSceneRoots.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Origin snapshots

Objetivo: usar snapshot imutavel por frame de render

Arquivos principais:
- `src/world/spatial/RenderSpaceService.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - No mixed frame Vector3

Objetivo: banir Vector3 sem frame em APIs de provider novas

Arquivos principais:
- `src/world/providers/WorldProvider.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - Out parameters

Objetivo: reduzir alocacoes nas conversoes por frame

Arquivos principais:
- `src/world/spatial/RenderSpaceService.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - Precision unit tests

Objetivo: testar 1 AU com offsets de 1 metro

Arquivos principais:
- `tests/render-space.test.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - Earth orbit precision

Objetivo: testar Terra em barycentric e tile a menos de 10 Mm do render origin

Arquivos principais:
- `tests/earth-provider.test.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - Moon distance precision

Objetivo: testar 384400 km sem perder movimento de 1 m

Arquivos principais:
- `tests/moon-provider.test.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - Rebase continuity

Objetivo: medir delta de tela entre frames pre e pos rebase

Arquivos principais:
- `tests/render-space.test.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - Render origin telemetry

Objetivo: mostrar frame e origem no F3

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - Safety counter

Objetivo: contar objetos fora do budget

Arquivos principais:
- `src/rendering/RenderSafety.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 031 - Provider activation frame

Objetivo: passar render context na ativacao

Arquivos principais:
- `src/world/providers/WorldProvider.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 032 - Provider update render state

Objetivo: permitir reposicionar ativo sem recriar geometria

Arquivos principais:
- `src/world/providers/WorldProvider.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 033 - Separate geometry from placement

Objetivo: nao rebuildar tile ao rebase

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 034 - Batch rebase

Objetivo: reposicionar grupos, nao centenas de meshes quando possivel

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 035 - Frame-relative group

Objetivo: usar group transform por body quando apropriado

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 036 - Body centre local zero

Objetivo: tiles podem ser body-local e body group camera-relative

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 037 - Moon body group

Objetivo: mesma estrategia da Terra

Arquivos principais:
- `src/world/planet/MoonGlobe.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 038 - Sun body group

Objetivo: mesmo contrato para Sol

Arquivos principais:
- `src/world/celestial/SunVisual.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 039 - Planet body group

Objetivo: generalizar para planetas

Arquivos principais:
- `src/world/celestial/PlanetVisual.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 040 - No camera far abuse

Objetivo: far plane nao corrige precisao espacial

Arquivos principais:
- `src/rendering/domains/RenderDomains.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 041 - Benchmark log vs reverse depth

Objetivo: medir sem misturar com spatial precision

Arquivos principais:
- `src/rendering/RendererManager.ts`

Alteracao exigida:

- Implementar usando Float64 no lado logico e apenas offsets pequenos no lado Three.js.
- Preservar orientation ao converter frame.
- Nao tocar na geometria do tile ao mover a origem.
- Usar a mesma origem para camera, providers e telemetria naquele frame.

Validacao:

- Teste com observador na Terra e tile da Terra.
- Teste com observador 1 AU do zero do sistema.
- Teste antes/depois de rebase.
- Assertion de coordenadas finitas e abaixo do limite visual.

Nao aceitar:

- Enviar barycentric position diretamente a `Object3D.position`.
- Corrigir com camera.far maior.
- Recriar geometria a cada rebase.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
