# Prompt mestre para agente de codigo

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


Voce e o agente de implementacao responsavel pelo proximo patch do DR Manaus.

Leia todos os arquivos deste pacote antes de alterar codigo.

Prioridade absoluta:

```text
1. estabilidade camera-relative
2. autoridade de dominio
3. browser E2E real
4. Earth/Moon provider hardening
5. body handoff
6. Lua pousavel
7. Sol
8. planetas e luas
```

Nao pule a etapa 1 para adicionar conteudo visual novo.

## Regras inegociaveis

- Nao usar `main` como base.
- Nao ligar `FEATURES.curvedManaus` neste patch P0.
- Nao enviar coordenadas AU para `Mesh.position`.
- Nao usar `camera.far` como correcao de precision.
- Nao reintroduzir `player.position = floatingOrigin.toRenderLocal(...)` em travel.
- Nao testar voo orbital apenas com `player.position.set`.
- Nao fazer live fetch de JPL, OSM, Copernicus ou outro dataset no gameplay.
- Nao apagar testes existentes para fechar a suite.
- Nao criar novo sistema duplicando `SolarSystem` sem migracao.
- Nao misturar surface physics de um corpo com outro.

## Saida obrigatoria do agente

Ao terminar cada PR, responder com:

```text
baseline SHA
HEAD final
arquivos alterados
root causes tratados
testes novos
npm test
npm run build
npm run test:browser
screenshots/artifacts gerados
metricas de render coordinate
metricas de performance
riscos ainda abertos
proximo passo
```

## Task 001 - Start audit

Objetivo: confirmar branch e HEAD

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Read mandatory files

Objetivo: ler Game/Runtime/Providers/RenderDomains/tests

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Write failing tests first

Objetivo: P0 precision

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Implement RenderSpace

Objetivo: core

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Migrate Earth

Objetivo: provider

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Migrate Moon

Objetivo: provider

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Suspend local domain

Objetivo: Game

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Create real E2E

Objetivo: browser

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Run gates

Objetivo: unit/build/browser

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Only then handoff

Objetivo: body transition

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Only then lunar surface

Objetivo: Moon

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Only then Sun

Objetivo: visual

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Only then generalize planets

Objetivo: roadmap

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Update docs from measurements

Objetivo: status

Arquivos principais:
- `repository`

Alteracao exigida:

- Seguir exatamente a ordem do pacote.
- Se o HEAD avancou, reauditar os trechos tocados.
- Nao marcar fase como pronta sem teste correspondente.
- Preservar Manaus como baseline de regressao.

Validacao:

- Registrar resultados numericos.
- Listar arquivos alterados.
- Listar testes executados.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
