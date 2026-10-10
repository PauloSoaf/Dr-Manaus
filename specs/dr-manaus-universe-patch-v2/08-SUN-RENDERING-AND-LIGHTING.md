# Sol, iluminacao e representacao estelar

## SUN-APPROACH-P0 entregue sobre D1 — 2026-10-07

O catálogo mantém R solar 695.700.000 m e R terrestre 6.378.137 m. A antiga margem estelar
R criava colisão em 2R. Agora CCD usa fotosfera + max(100.000 m, R×0,0001), enquanto o
autopiloto usa observação a 0,03R. Corona e glow não participam da física.
SunMaterial reconstrói esfera analítica em coordenadas relativas à câmera, com granulação,
limb darkening, manchas/faculae, corona assimétrica e seis arcos High/Ultra. Uma quad limitada,
1 draw, 2 triângulos, 1 material ativo; recorte óptico distante e tela cheia apenas de perto.
Sem novo pós-processamento bloom, landing, heat gameplay ou volume. Exigir aceitação manual.
Relatório atual: [21-status-SUN-APPROACH-P0.md](../../docs/world/21-status-SUN-APPROACH-P0.md).
O baseline e as tasks abaixo são contexto histórico; o código atual e esse relatório prevalecem.

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

## Task 001 - SunVisual class

Objetivo: separar Sol do SpaceLayer legado

Arquivos principais:
- `src/world/celestial/SunVisual.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Angular radius

Objetivo: tamanho aparente por distancia

Arquivos principais:
- `src/world/celestial/SunVisual.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Direction relative

Objetivo: posicao visual por direcao camera-relative

Arquivos principais:
- `src/world/celestial/SunVisual.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Disc LOD

Objetivo: sprite/disc para distancia comum

Arquivos principais:
- `src/world/celestial/SunVisual.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Sphere LOD

Objetivo: esfera quando angularmente grande

Arquivos principais:
- `src/world/celestial/SunVisual.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Surface LOD

Objetivo: nao pousavel; limite de aproximacao

Arquivos principais:
- `src/world/celestial/SunVisual.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Photosphere material

Objetivo: emissao, limb darkening aproximado

Arquivos principais:
- `src/world/celestial/SunMaterial.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Corona shell

Objetivo: efeito escalavel

Arquivos principais:
- `src/world/celestial/SunMaterial.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Bloom integration

Objetivo: opcional e budgeted

Arquivos principais:
- `src/rendering/`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Sun light source

Objetivo: DirectionalLight/local direction

Arquivos principais:
- `src/rendering/Atmosphere.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - No PointLight at 1 AU

Objetivo: evitar precisao e attenuation absurdos

Arquivos principais:
- `src/rendering/Atmosphere.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Planet lighting

Objetivo: todos corpos recebem mesma solar direction

Arquivos principais:
- `src/world/providers/`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Shadow/eclipses future

Objetivo: oclusao por angular geometry

Arquivos principais:
- `src/world/celestial/EclipseModel.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Exposure

Objetivo: evitar estourar tone mapping

Arquivos principais:
- `src/rendering/RendererManager.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - Starfield coexistence

Objetivo: Sol nao some com stars layer

Arquivos principais:
- `src/rendering/SpaceLayer.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Legacy sun migration

Objetivo: SpaceLayer deixa de ser source of truth

Arquivos principais:
- `src/rendering/SpaceLayer.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Solar approach safety

Objetivo: definir minimum playable distance

Arquivos principais:
- `src/world/travel/InterplanetaryController.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Heat effect optional

Objetivo: gameplay posterior

Arquivos principais:
- `src/world/celestial/SunVisual.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Solar scale test

Objetivo: 1 AU angular diameter plausivel

Arquivos principais:
- `tests/sun-visual.test.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Precision test

Objetivo: Sun nunca em Mesh.position 1.5e11

Arquivos principais:
- `tests/sun-visual.test.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Direction test

Objetivo: Sun visual alinhado com ephemeris

Arquivos principais:
- `tests/sun-visual.test.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Lighting test

Objetivo: Earth day side aponta para Sol

Arquivos principais:
- `tests/sun-lighting.test.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - Performance modes

Objetivo: Low/Medium/High/Ultra

Arquivos principais:
- `src/rendering/`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - Fallback

Objetivo: disc simples se shader falhar

Arquivos principais:
- `src/world/celestial/SunVisual.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - Debug

Objetivo: F3 angular size e distance

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Derivar visual de estado logico do Sol.
- Manter coordenada renderizada pequena.
- Priorizar direcao e tamanho angular sobre distancia linear no GPU.

Validacao:

- Testar visto da Terra.
- Testar visto de Marte.
- Testar aproximacao.
- Testar quality presets.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
