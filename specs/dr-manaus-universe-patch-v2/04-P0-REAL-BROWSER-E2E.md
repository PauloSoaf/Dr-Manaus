# P0 - Browser E2E real de Manaus ao espaco

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

## Task 001 - Boot real

Objetivo: provar que o jogo inicia sem erro

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Takeoff real

Objetivo: acionar F e subir por input

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Mega arm

Objetivo: armar mega por V

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Interplanetary arm

Objetivo: double tap V com timing real

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Cross 9 km

Objetivo: atingir entryAltitude sem setPosition

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Domain enter

Objetivo: esperar transition departed

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - 100 km ascent

Objetivo: continuar com B e direcao

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - 1000 km ascent

Objetivo: provar estabilidade prolongada

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Coast 10s

Objetivo: soltar B e nao retornar

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Camera rotate

Objetivo: mover mouse durante coasting

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Resume thrust

Objetivo: reativar B sem snap

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Earth visible

Objetivo: assert globe visible em barycentric

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Earth size stable

Objetivo: medir bounding box ou screen projection

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - No teleport counter

Objetivo: medir delta do proxy por frame

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - No ping pong

Objetivo: registrar dominio por frame

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Render coords bounded

Objetivo: inspecionar planet meshes

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Moon direction

Objetivo: confirmar Lua no hemisferio correto

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Moon approach

Objetivo: via debug travel controlado, nao setPosition local

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Reentry setup

Objetivo: orientar para Terra e frear

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Single handoff

Objetivo: confirmar uma transicao para local

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Manaus resume

Objetivo: streamer e RealCity retomam

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Crater smoke

Objetivo: criar cratera e screenshot

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - Ghost ground pixel check

Objetivo: amostrar screenshot ou usar geometry/material assertions

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - Artifacts

Objetivo: salvar JSON por etapa

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - Screenshots

Objetivo: salvar frames ground/orbit/deep/reentry

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - Telemetry trace

Objetivo: salvar 1 Hz durante percurso

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - Failure dump

Objetivo: salvar ultimos 300 frames em falha

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - Headless GPU mode

Objetivo: executar SwiftShader baseline

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - Real GPU optional

Objetivo: modo DR_BROWSER_GPU

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - Timeout policy

Objetivo: usar condicoes, nao sleeps longos

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 031 - Speed-up test mode

Objetivo: permitir acceleration multiplier apenas de tempo

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 032 - No direct player set

Objetivo: lint/assert no cenario E2E

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 033 - No direct universe pose

Objetivo: E2E principal so usa controles

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 034 - Frame graph trace

Objetivo: capturar active frame

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 035 - Body trace

Objetivo: capturar dominantBody

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 036 - Origin trace

Objetivo: capturar render origin

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 037 - Precision trace

Objetivo: max abs render object position

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 038 - Perf trace

Objetivo: fps/frame/streaming por fase

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 039 - Visual thresholds

Objetivo: definir criterios objetivos

Arquivos principais:
- `scripts/browser-test.mjs`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 040 - CI artifact upload

Objetivo: guardar imagens e json

Arquivos principais:
- `.github/workflows/ci.yml`

Alteracao exigida:

- Executar o cenario com APIs publicas ou input real.
- Capturar telemetria antes, durante e depois.
- Falhar com mensagem diagnostica especifica.

Validacao:

- Rodar no browser headless.
- Salvar artifact com estado minimo para reproduzir.
- Nao considerar screenshot isolada como prova suficiente.

Nao aceitar:

- Teleportar `player.position` para simular voo no teste principal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
