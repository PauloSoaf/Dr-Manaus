# Matriz de testes e criterios de aceite

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

## Gate de release do patch

Comandos minimos:

```bash
npm run typecheck
npm test
npm run build
npm run test:browser
```

Cenarios obrigatorios no browser:

```text
Manaus -> 9 km -> interplanetary -> 100 km -> 1000 km -> coast
-> thrust -> retorno -> Manaus

Terra -> Lua -> aproximacao -> surface domain -> pouso
-> decolagem -> Terra
```

O segundo cenario so vira gate quando a fase lunar estiver implementada.

## Task 001 - RenderSpace 1 AU + 1 m precision

Objetivo: criar cobertura automatizada para RenderSpace 1 AU + 1 m precision

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Earth tile render coordinate bounded

Objetivo: criar cobertura automatizada para Earth tile render coordinate bounded

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Moon centre bounded

Objetivo: criar cobertura automatizada para Moon centre bounded

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Rebase continuity

Objetivo: criar cobertura automatizada para Rebase continuity

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Frame handoff atomicity

Objetivo: criar cobertura automatizada para Frame handoff atomicity

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Velocity conservation

Objetivo: criar cobertura automatizada para Velocity conservation

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Orientation continuity

Objetivo: criar cobertura automatizada para Orientation continuity

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Earth altitude barycentric

Objetivo: criar cobertura automatizada para Earth altitude barycentric

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Moon altitude body-fixed

Objetivo: criar cobertura automatizada para Moon altitude body-fixed

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Dominant body hysteresis

Objetivo: criar cobertura automatizada para Dominant body hysteresis

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Coasting

Objetivo: criar cobertura automatizada para Coasting

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Reentry speed gate

Objetivo: criar cobertura automatizada para Reentry speed gate

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Local suspension

Objetivo: criar cobertura automatizada para Local suspension

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - RealCity resumes

Objetivo: criar cobertura automatizada para RealCity resumes

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - WorldStreamer pauses

Objetivo: criar cobertura automatizada para WorldStreamer pauses

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Earth globe visible barycentric

Objetivo: criar cobertura automatizada para Earth globe visible barycentric

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Moon globe visible barycentric

Objetivo: criar cobertura automatizada para Moon globe visible barycentric

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Sun angular size

Objetivo: criar cobertura automatizada para Sun angular size

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Moon angular size

Objetivo: criar cobertura automatizada para Moon angular size

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Earth angular size from Moon

Objetivo: criar cobertura automatizada para Earth angular size from Moon

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Planet LOD hysteresis

Objetivo: criar cobertura automatizada para Planet LOD hysteresis

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - No double surface

Objetivo: criar cobertura automatizada para No double surface

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - No black frame

Objetivo: criar cobertura automatizada para No black frame

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - No NaN transforms

Objetivo: criar cobertura automatizada para No NaN transforms

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - No Mesh.position > render budget

Objetivo: criar cobertura automatizada para No Mesh.position > render budget

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - Crater ghost ground

Objetivo: criar cobertura automatizada para Crater ghost ground

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - Crater persistence Earth

Objetivo: criar cobertura automatizada para Crater persistence Earth

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - Crater persistence Moon

Objetivo: criar cobertura automatizada para Crater persistence Moon

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - Terrain physics visual agreement

Objetivo: criar cobertura automatizada para Terrain physics visual agreement

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - Browser takeoff

Objetivo: criar cobertura automatizada para Browser takeoff

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 031 - Browser interplanetary enter

Objetivo: criar cobertura automatizada para Browser interplanetary enter

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 032 - Browser 100 km

Objetivo: criar cobertura automatizada para Browser 100 km

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 033 - Browser 1000 km

Objetivo: criar cobertura automatizada para Browser 1000 km

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 034 - Browser coast

Objetivo: criar cobertura automatizada para Browser coast

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 035 - Browser camera turn

Objetivo: criar cobertura automatizada para Browser camera turn

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 036 - Browser resume thrust

Objetivo: criar cobertura automatizada para Browser resume thrust

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 037 - Browser reentry

Objetivo: criar cobertura automatizada para Browser reentry

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 038 - Browser single handoff

Objetivo: criar cobertura automatizada para Browser single handoff

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 039 - Browser Manaus restore

Objetivo: criar cobertura automatizada para Browser Manaus restore

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 040 - Browser Earth-Moon approach

Objetivo: criar cobertura automatizada para Browser Earth-Moon approach

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 041 - Browser Moon landing

Objetivo: criar cobertura automatizada para Browser Moon landing

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 042 - Browser Moon takeoff

Objetivo: criar cobertura automatizada para Browser Moon takeoff

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 043 - Browser return Earth

Objetivo: criar cobertura automatizada para Browser return Earth

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 044 - Browser no reload

Objetivo: criar cobertura automatizada para Browser no reload

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 045 - Browser screenshot artifacts

Objetivo: criar cobertura automatizada para Browser screenshot artifacts

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 046 - Build

Objetivo: criar cobertura automatizada para Build

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 047 - Typecheck

Objetivo: criar cobertura automatizada para Typecheck

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 048 - Unit full suite

Objetivo: criar cobertura automatizada para Unit full suite

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 049 - Browser SwiftShader

Objetivo: criar cobertura automatizada para Browser SwiftShader

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 050 - Browser optional GPU

Objetivo: criar cobertura automatizada para Browser optional GPU

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 051 - Memory handoff loop

Objetivo: criar cobertura automatizada para Memory handoff loop

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 052 - Performance profile

Objetivo: criar cobertura automatizada para Performance profile

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 053 - Provider disposal

Objetivo: criar cobertura automatizada para Provider disposal

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 054 - Scheduler no hole

Objetivo: criar cobertura automatizada para Scheduler no hole

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 055 - Cache eviction

Objetivo: criar cobertura automatizada para Cache eviction

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 056 - Save migration

Objetivo: criar cobertura automatizada para Save migration

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 057 - UniverseCoordinates moon

Objetivo: criar cobertura automatizada para UniverseCoordinates moon

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 058 - UniverseCoordinates mars

Objetivo: criar cobertura automatizada para UniverseCoordinates mars

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 059 - Offline ephemeris deterministic

Objetivo: criar cobertura automatizada para Offline ephemeris deterministic

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 060 - No runtime network

Objetivo: criar cobertura automatizada para No runtime network

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 061 - Feature flags

Objetivo: criar cobertura automatizada para Feature flags

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 062 - CI required checks

Objetivo: criar cobertura automatizada para CI required checks

Arquivos principais:
- `tests/`
- `scripts/browser-test.mjs`

Alteracao exigida:

- Definir pre-condicao.
- Executar comportamento real.
- Coletar estado observavel.
- Falhar com mensagem numerica.

Validacao:

- Teste deve falhar se o bug correspondente for reintroduzido.
- Nao depender apenas de comentario ou screenshot.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
