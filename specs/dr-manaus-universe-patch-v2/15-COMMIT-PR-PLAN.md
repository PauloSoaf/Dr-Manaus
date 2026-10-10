# Plano de commits e PRs

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

## PR split recomendado

```text
PR A - RenderSpace P0
PR B - Earth/Moon provider hardening + browser E2E
PR C - body handoff + lunar surface
PR D - angular celestial LOD + Sun
PR E - Mars/generalized planet provider
```

Nao fazer uma mega PR do Sistema Solar inteiro.

## Task 001 - test(render): add failing camera-relative precision tests

Objetivo: testes primeiro

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - feat(spatial): add RenderOrigin and RenderSpaceService

Objetivo: core

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - refactor(provider): pass render context separately

Objetivo: contract

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - fix(earth): make Earth body-local and camera-relative

Objetivo: earth

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - fix(moon): make Moon body-local and camera-relative

Objetivo: moon

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - fix(game): suspend all Manaus systems during interplanetary

Objetivo: authority

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - test(browser): add real interplanetary flight scenario

Objetivo: e2e

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - fix(render): bind far range to visible representations

Objetivo: depth

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - feat(handoff): atomic body frame transition

Objetivo: handoff

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - test(handoff): Earth Moon round-trip state

Objetivo: tests

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - feat(moon): add lunar surface domain

Objetivo: moon surface

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - test(browser): add Earth Moon landing vertical slice

Objetivo: e2e moon

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - feat(celestial): add angular LOD state

Objetivo: lod

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - feat(sun): add camera-relative Sun visual

Objetivo: sun

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - refactor(solar): version body manifest and provenance

Objetivo: data

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - ci: run unit build and browser smoke

Objetivo: ci

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - docs(world): update measured status

Objetivo: docs

Arquivos principais:
- `git history`

Alteracao exigida:

- Commit pequeno e reversivel.
- Nao misturar formatacao ampla.
- Mensagem explica comportamento.

Validacao:

- Rodar testes focados antes do commit.
- Rodar suite completa nos milestones.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
