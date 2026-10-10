# P0 - Hardening de EarthProvider e MoonProvider

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

## Task 001 - EarthProvider receives RenderContext

Objetivo: separar SpatialContext de placement

Arquivos principais:
- `src/world/providers/EarthProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Earth globe group body-local

Objetivo: tiles ficam relativos ao centro da Terra

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Earth group camera-relative

Objetivo: somente group recebe centre relative

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Earth fallback same transform

Objetivo: coarse fallback segue body group

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Earth atmosphere shell same root

Objetivo: halo acompanha group

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Earth sun direction frame-aware

Objetivo: direcao nao usa translacao

Arquivos principais:
- `src/world/providers/EarthProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Earth plan camera body-relative

Objetivo: quadtree recebe observer em earth-fixed

Arquivos principais:
- `src/world/providers/EarthProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Earth no Manaus detour

Objetivo: barycentric vai direto earth-fixed

Arquivos principais:
- `src/world/providers/EarthProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Moon centre system-relative

Objetivo: armazenar centre logical em system frame

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Moon group camera-relative

Objetivo: converter centro para RenderSpace

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Moon observer moon-local

Objetivo: quadtree usa jogador relativo a Lua

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Moon orientation body frame

Objetivo: nao usar Earth-fixed como aproximacao final

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Moon fixed frame rotation

Objetivo: adicionar body rotation model

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Moon provider visibility angular

Objetivo: trocar gates Earth-altitude por angular/range

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - Moon surface activation

Objetivo: stream quando modo surface/planet pedir

Arquivos principais:
- `src/world/providers/MoonProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Provider rebase hook

Objetivo: reposicionar group sem reload

Arquivos principais:
- `src/world/providers/WorldProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Provider frame change hook

Objetivo: recalcular orientation quando frame muda

Arquivos principais:
- `src/world/providers/WorldProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Provider safety assertion

Objetivo: verificar centre magnitude

Arquivos principais:
- `src/world/providers/WorldProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Shared PlanetSurfaceProvider

Objetivo: generalizar apos Earth/Moon estaveis

Arquivos principais:
- `src/world/providers/PlanetSurfaceProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Body visual vs surface provider

Objetivo: nao misturar sprite distante com tiles

Arquivos principais:
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Provider ownership

Objetivo: terrain/body channels claros

Arquivos principais:
- `src/world/runtime/ProviderRegistry.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Provider disposal

Objetivo: sem leaks ao trocar corpo

Arquivos principais:
- `src/world/providers/WorldProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - Provider cache keys body-scoped

Objetivo: impedir tile earth/moon colidir

Arquivos principais:
- `src/world/streaming/TileDemand.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - Provider telemetry

Objetivo: tiles, body, range, render centre

Arquivos principais:
- `src/world/providers/WorldProvider.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - Provider tests Earth

Objetivo: 1 AU logical, km render

Arquivos principais:
- `tests/earth-provider.test.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - Provider tests Moon

Objetivo: 384400 km logical, km render

Arquivos principais:
- `tests/moon-provider.test.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - Frame-change tests

Objetivo: Earth to barycentric to Moon

Arquivos principais:
- `tests/provider-frame-handoff.test.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - Rebase no reload

Objetivo: tile object identity permanece

Arquivos principais:
- `tests/provider-frame-handoff.test.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - Fallback no hole

Objetivo: coarse body sempre disponivel

Arquivos principais:
- `tests/earth-transition.test.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - No duplicate surfaces

Objetivo: body visual e surface tile crossfade

Arquivos principais:
- `tests/celestial-lod.test.ts`

Alteracao exigida:

- Guardar posicoes logicas em Float64 e frame explicito.
- Posicionar roots usando RenderSpace.
- Manter vertices relativos ao tile/body.
- Nao descarregar geometria apenas porque a origem mudou.

Validacao:

- Testar frame local.
- Testar frame barycentric.
- Testar rebase.
- Testar ativacao/desativacao.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
