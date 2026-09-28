# Reference frames, body handoff e reentrada

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

## Task 001 - Canonical frame IDs

Objetivo: eliminar strings divergentes como manaus/legacy-local

Arquivos principais:
- `src/world/spatial/FrameIds.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Frame registry

Objetivo: centralizar IDs e helpers

Arquivos principais:
- `src/world/spatial/FrameIds.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Earth body-fixed

Objetivo: definir origem e rotacao claramente

Arquivos principais:
- `src/world/runtime/UniverseRuntime.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Manaus legacy surface

Objetivo: manter compatibilidade

Arquivos principais:
- `src/world/spatial/ManausFrameAdapter.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Moon body-fixed

Objetivo: usar frame registrado existente

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Moon surface-local

Objetivo: criar ENU-like local frame no pouso

Arquivos principais:
- `src/world/spatial/BodySurfaceFrame.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Mars body-fixed

Objetivo: preparar sem ativar superficie

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Generic body surface frame

Objetivo: lat/lon/height para qualquer corpo

Arquivos principais:
- `src/world/spatial/BodySurfaceFrame.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Body rotation

Objetivo: aplicar rotationPeriod e axial tilt

Arquivos principais:
- `src/world/celestial/BodyRotation.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Epoch consistency

Objetivo: todos frames usam mesmo tempo

Arquivos principais:
- `src/world/runtime/UniverseRuntime.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Handoff request object

Objetivo: descrever from/to/reason

Arquivos principais:
- `src/world/travel/Handoff.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Handoff snapshot

Objetivo: congelar pos/vel/orientation

Arquivos principais:
- `src/world/travel/Handoff.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Velocity conversion

Objetivo: rotacionar e subtrair body velocity corretamente

Arquivos principais:
- `src/world/travel/Handoff.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Orientation conversion

Objetivo: preservar camera/player heading

Arquivos principais:
- `src/world/travel/Handoff.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - Surface entry

Objetivo: criar local position sem teleport visual

Arquivos principais:
- `src/world/travel/Handoff.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Surface exit

Objetivo: subir para body-fixed/system state

Arquivos principais:
- `src/world/travel/Handoff.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Hysteresis body authority

Objetivo: evitar Terra/Lua flip-flop

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - SOI optional metric

Objetivo: usar sphere of influence como criterio adicional

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Dominant acceleration metric

Objetivo: manter mas com memoria/histerese

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Lagrange zones

Objetivo: nao exigir handoff imediato

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Atomic handoff

Objetivo: nenhum frame intermediario invalido

Arquivos principais:
- `src/world/runtime/UniverseRuntime.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Render handoff

Objetivo: trocar render origin no mesmo tick

Arquivos principais:
- `src/world/spatial/RenderSpaceService.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - Physics handoff

Objetivo: local physics so liga apos surface ready

Arquivos principais:
- `src/world/travel/TravelDomain.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - Streaming handoff

Objetivo: preload target antes de surface domain

Arquivos principais:
- `src/world/streaming/GlobalStreamingScheduler.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - Persistence handoff

Objetivo: body mutation store troca depois do commit

Arquivos principais:
- `src/world/persistence/WorldMutationStore.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - Rollback

Objetivo: se target provider falha, permanecer no dominio anterior

Arquivos principais:
- `src/world/travel/Handoff.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - Handoff telemetry

Objetivo: expor phase e target

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - Handoff tests Earth Moon

Objetivo: ida e volta

Arquivos principais:
- `tests/handoff.test.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - Velocity conservation test

Objetivo: sem impulso artificial

Arquivos principais:
- `tests/handoff.test.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - Orientation continuity test

Objetivo: camera nao gira sozinha

Arquivos principais:
- `tests/handoff.test.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 031 - Frame graph cycle guard

Objetivo: manter invariantes atuais

Arquivos principais:
- `src/world/spatial/ReferenceFrameGraph.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 032 - Frame transforms precision

Objetivo: offset de 1 m em 1 AU

Arquivos principais:
- `tests/reference-frame-precision.test.ts`

Alteracao exigida:

- Tratar frame ID como tipo/constante, nao string solta.
- Converter posicao, direcao e orientation por APIs distintas.
- Separar velocidade relativa e velocidade do parent body.
- Executar handoff como transacao.

Validacao:

- Round trip frame A -> B -> A.
- Teste de velocidade relativa.
- Teste de orientation.
- Teste de falha/rollback.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
