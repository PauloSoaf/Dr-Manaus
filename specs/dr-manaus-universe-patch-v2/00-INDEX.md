# Patch v2 - indice e ordem obrigatoria

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


Este pacote substitui o hotfix v1 como guia de implementacao do proximo ciclo.
O hotfix v1 corrigiu o ping-pong de dominio e o ghost ground, mas a auditoria do HEAD atual
encontrou um risco P0 restante: providers planetarios ainda podem transformar um centro de tile
para `solar-system/barycentric` e entregar numeros na ordem de 1 AU ao `Mesh.position`.

Isso precisa ser corrigido antes de ampliar o Sistema Solar.

## Ordem de leitura

1. `01-CURRENT-HEAD-RISK-AUDIT.md`
2. `02-P0-CAMERA-RELATIVE-RENDERING.md`
3. `03-P0-RENDER-DOMAIN-AUTHORITY.md`
4. `04-P0-REAL-BROWSER-E2E.md`
5. `05-P0-EARTH-MOON-PROVIDER-HARDENING.md`
6. `06-REFERENCE-FRAMES-AND-HANDOFFS.md`
7. `07-SOLAR-SYSTEM-LOGICAL-MODEL.md`
8. `08-SUN-RENDERING-AND-LIGHTING.md`
9. `09-MOON-LANDING-AND-SURFACE.md`
10. `10-PLANETS-AND-MOONS-ROADMAP.md`
11. `11-CELESTIAL-LOD-AND-ANGULAR-RENDERING.md`
12. `12-STREAMING-PERFORMANCE-CACHE.md`
13. `13-TEST-MATRIX-AND-ACCEPTANCE.md`
14. `14-FILE-BY-FILE-IMPLEMENTATION.md`
15. `15-COMMIT-PR-PLAN.md`
16. `16-MASTER-AGENT-PROMPT.md`
17. `17-SOURCES-AND-DATA-PROVENANCE.md`

## Definition of done global

O patch so pode ser chamado de estavel quando:

```text
Manaus continua jogavel
crateras continuam corretas
saida da Terra acontece sem teleport visual
Earth permanece visivel e estavel em frame barycentric
Moon permanece visivel e estavel em frame barycentric
coasting funciona
reentrada acontece uma vez
nenhum provider envia 1 AU para Float32 render transform
browser test percorre o fluxo real
```

## Task 001 - Congelar baseline e invariantes

Objetivo: registrar o estado exato antes do patch

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Congelar baseline e invariantes` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Criar RenderSpace

Objetivo: separar explicitamente logical space de render-local

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Criar RenderSpace` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Camera-relative Earth

Objetivo: fazer a Terra ficar proxima da origem visual durante travel

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Camera-relative Earth` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Camera-relative Moon

Objetivo: fazer a Lua obedecer a mesma regra

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Camera-relative Moon` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Remover autoridade duplicada

Objetivo: evitar Game.origin e FloatingOrigin3D competindo

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Remover autoridade duplicada` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Ocultar/suspender Manaus fora do dominio local

Objetivo: evitar cidade fantasma no espaco

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Ocultar/suspender Manaus fora do dominio local` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Browser E2E real

Objetivo: testar decolagem sem teleport artificial

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Browser E2E real` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Reentrada unica

Objetivo: provar handoff sem ping-pong

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Reentrada unica` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Lua pousavel

Objetivo: dar ao MoonProvider um dominio de superficie completo

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Lua pousavel` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Sol visual

Objetivo: renderizar o Sol por angular size e distancia relativa

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Sol visual` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Planetas

Objetivo: generalizar provider e corpo visual

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Planetas` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Luas

Objetivo: adicionar satelites por dados e fases

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Luas` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Streaming

Objetivo: controlar budgets por dominio

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Streaming` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Persistencia

Objetivo: preservar estado por bodyId

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `Persistencia` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - CI

Objetivo: publicar test/build/browser checks

Arquivos principais:
- `docs/world/15-status.md`
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Executar a fase `CI` somente depois dos gates anteriores.
- Manter compatibilidade com Manaus e com os testes existentes.
- Registrar a decisao de arquitetura no status do projeto.

Validacao:

- Adicionar ou atualizar teste que falha antes da mudanca e passa depois.
- Rodar unit, build e browser quando a fase tocar renderer ou input.

Nao aceitar:

- Marcar fase como concluida apenas por existir codigo sem smoke real.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
