# P0 - Autoridade de simulacao e render

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

## Task 001 - Criar SimulationDomain enum

Objetivo: deixar local/interplanetary/surface-body explicitos

Arquivos principais:
- `src/world/travel/TravelDomain.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Criar RenderDomain enum

Objetivo: separar o que simula do que desenha

Arquivos principais:
- `src/rendering/domains/RenderDomains.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Game local authority

Objetivo: PlayerController manda somente no dominio local

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Travel authority

Objetivo: InterplanetaryController manda somente no travel

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Surface body authority

Objetivo: criar autoridade ao pousar em outro corpo

Arquivos principais:
- `src/world/travel/SurfaceDomain.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Freeze local systems

Objetivo: pausar RealCity alem de streamer/HLOD

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Hide local root

Objetivo: retirar Manaus visualmente quando apropriado

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Preserve local state

Objetivo: nao destruir cidade ao sair

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Mission semantics

Objetivo: nao atualizar missoes locais no espaco

Arquivos principais:
- `src/missions/MissionManager.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Power semantics

Objetivo: definir quais poderes existem por dominio

Arquivos principais:
- `src/player/powers/PowerSystem.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Audio semantics

Objetivo: separar audio atmosferico de space

Arquivos principais:
- `src/audio/AudioManager.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Atmosphere authority

Objetivo: usar body atmosphere profile

Arquivos principais:
- `src/rendering/Atmosphere.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Water authority

Objetivo: water somente em bodies que possuem

Arquivos principais:
- `src/rendering/WaterSystem.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Traffic authority

Objetivo: traffic apenas local Earth/Manaus

Arquivos principais:
- `src/world/traffic/TrafficSystem.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - Population authority

Objetivo: NPCs apenas em providers locais ativos

Arquivos principais:
- `src/entities/PopulationManager.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Discovery authority

Objetivo: landmark discovery por body

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Destruction authority

Objetivo: terrain destruction recebe body/frame

Arquivos principais:
- `src/world/destruction/TerrainDestruction.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Save authority

Objetivo: mutation keys por body/frame

Arquivos principais:
- `src/world/persistence/WorldMutationStore.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Origin authority local

Objetivo: Game.origin apenas Manaus

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Origin authority cosmic

Objetivo: RenderSpace/FloatingOrigin3D fora de Manaus

Arquivos principais:
- `src/world/spatial/RenderSpaceService.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Camera authority

Objetivo: CameraController segue proxy visual

Arquivos principais:
- `src/player/CameraController.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Proxy authority

Objetivo: proxy visual nunca vira posicao logica

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - HUD authority

Objetivo: HUD exibe dados do simulation domain

Arquivos principais:
- `src/ui/HUD.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - F3 domain diagnostics

Objetivo: mostrar simulation/render frame e origin

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - Transitions atomic

Objetivo: trocar dominio em uma operacao

Arquivos principais:
- `src/world/travel/TravelDomain.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - Transition events

Objetivo: emitir departed/enteredSurface/returned

Arquivos principais:
- `src/world/travel/TravelDomain.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - No dual stepping

Objetivo: assert que dois controllers nao integram no mesmo frame

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - No hidden local updates

Objetivo: instrumentar perf counters por dominio

Arquivos principais:
- `src/game/Game.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - Provider visibility policy

Objetivo: provider nao decide sozinho se scene root aparece

Arquivos principais:
- `src/world/providers/WorldProvider.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - Domain tests

Objetivo: testar sistemas suspensos

Arquivos principais:
- `tests/domain-authority.test.ts`

Alteracao exigida:

- Definir uma unica fonte de verdade para o frame.
- Tornar a transicao atomica.
- Garantir que sistemas do dominio inativo nao integrem tempo nem posicao.

Validacao:

- Contadores de update antes/depois da troca.
- Testar 600 frames no espaco e confirmar zero updates locais proibidos.
- Testar retorno e retomada sem reset indevido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
