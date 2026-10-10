# Streaming, performance e cache para escala planetaria

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

## Task 001 - Frame budget 16.67ms

Objetivo: 60 fps desktop

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Streaming main-thread 4ms

Objetivo: budget hardening

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Activation <=2 heavy/frame

Objetivo: preservar

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Fetch concurrency 4

Objetivo: baseline

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Decode workers

Objetivo: terrain/tiles

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - GPU upload queue

Objetivo: limitar

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Local systems suspended

Objetivo: space performance

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Planet scheduler

Objetivo: prioridade body visible

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Moon scheduler

Objetivo: proximity

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Celestial cheap path

Objetivo: far bodies

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Geometry cache

Objetivo: body tile

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Decoded cache

Objetivo: RAM

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Compressed cache

Objetivo: IndexedDB

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - LRU

Objetivo: body-aware

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - Pinned parent tiles

Objetivo: no holes

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Rebase no reload

Objetivo: zero fetch

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Telemetry p50/p95

Objetivo: streaming

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Telemetry GPU estimate

Objetivo: budget

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Draw call budget

Objetivo: planet

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Triangle budget

Objetivo: planet

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Atmosphere quality

Objetivo: samples

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Cloud quality

Objetivo: steps

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - Shadow quality

Objetivo: body dependent

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - Dynamic resolution

Objetivo: last resort

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - Worker transferables

Objetivo: zero copy where possible

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - No synchronous fetch

Objetivo: runtime

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - No live OSM/JPL

Objetivo: runtime

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - Profile interplanetary

Objetivo: new script

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - Profile Earth-Moon

Objetivo: new script

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - Profile reentry

Objetivo: new script

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 031 - Profile low hardware

Objetivo: preset

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 032 - Memory leak test

Objetivo: 100 handoffs

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 033 - Cache thrash test

Objetivo: Earth-Moon loop

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 034 - Long session test

Objetivo: 30 min

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 035 - Precision perf test

Objetivo: 1 AU

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 036 - CI perf trend

Objetivo: artifact

Arquivos principais:
- `src/world/streaming/`
- `src/rendering/`
- `scripts/profile-celestial.mjs`

Alteracao exigida:

- Instrumentar antes de otimizar.
- Usar budgets compartilhados.
- Degradar detalhe antes de quebrar simulacao.

Validacao:

- Registrar p50/p95.
- Comparar local/orbit/moon.
- Detectar leak de geometria/textura.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
