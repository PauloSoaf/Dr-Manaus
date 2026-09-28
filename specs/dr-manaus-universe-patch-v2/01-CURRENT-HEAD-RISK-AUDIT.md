# Auditoria de risco do HEAD atual

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

## Estado confirmado

A branch atual contem os hotfixes de voo relativo e terreno.
O HEAD auditado para este pacote e `2609e4d30901720f9b18e05939f717e590dc7140`.

O risco central restante nao e o mesmo do patch anterior.
Agora a posicao logica esta melhor, mas ainda existe caminho para o renderer receber posicao absoluta.

Exemplo conceitual atual:

```text
tile centre em earth/fixed
-> frames.convertPosition(earth/fixed, solar-system/barycentric)
-> ~1.5e11 m
-> EarthGlobe.add()
-> Mesh.position
```

Isto nao deve sobreviver ao patch v2.

## Task 001 - EarthProvider ainda usa frame atual como scene frame

Objetivo: provar que `toSceneMetres` pode retornar coordenadas astronomicas

Arquivos principais:
- `src/world/providers/EarthProvider.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - EarthGlobe aceita posicao sem contrato de magnitude

Objetivo: impedir que `add()` receba centro absoluto de sistema solar

Arquivos principais:
- `src/world/planet/EarthGlobe.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - MoonProvider mistura distancia e frame

Objetivo: separar centro logico da Lua do centro render-local

Arquivos principais:
- `src/world/providers/MoonProvider.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - MoonGlobe depende de centro de cena

Objetivo: tornar o centro explicitamente render-relative

Arquivos principais:
- `src/world/planet/MoonGlobe.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Game.origin e FloatingOrigin3D coexistem

Objetivo: definir quem manda em cada dominio

Arquivos principais:
- `src/game/Game.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - RealCity atualiza durante travel

Objetivo: suspender a cidade quando `local=false`

Arquivos principais:
- `src/game/Game.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Browser orbit test teleporta

Objetivo: substituir por fluxo de input real

Arquivos principais:
- `scripts/browser-test.mjs`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - T8 nao testa proxy visual

Objetivo: criar teste de camera/model continuity

Arquivos principais:
- `tests/universe-runtime.test.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Far plane cresce por altitude Earth-centric

Objetivo: tornar range baseado nas representacoes visiveis

Arquivos principais:
- `src/rendering/domains/RenderDomains.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Celestial frames nao carregam rotacao de corpo

Objetivo: separar translacao orbital de rotacao superficial

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Earth fixed frame e body frame precisam contrato claro

Objetivo: eliminar aliases confusos

Arquivos principais:
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Moon landing usa frame parcial

Objetivo: preparar surface-local frame por corpo

Arquivos principais:
- `src/world/runtime/UniverseRuntime.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - dominantBody por aceleracao pode trocar perto de Lagrange

Objetivo: adicionar histerese de autoridade

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - provider ownership nao e render ownership

Objetivo: separar streaming coverage de visibilidade de dominio

Arquivos principais:
- `src/world/providers/WorldProvider.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - celestial layer ainda nao e um compositor

Objetivo: criar politica de representacao coerente

Arquivos principais:
- `src/rendering/domains/RenderDomains.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Sol ainda e local sky disc

Objetivo: preparar corpo celeste real sem quebrar Atmosphere

Arquivos principais:
- `src/rendering/SpaceLayer.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - SPACE.maxAltitude continua sendo teto global

Objetivo: migrar para limites por dominio

Arquivos principais:
- `src/core/config.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Moon DEM e procedural

Objetivo: documentar claramente ate dados reais entrarem

Arquivos principais:
- `src/world/planet/MoonSurface.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - dados dos planetas estao embutidos

Objetivo: criar manifest versionado

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - sem CI associado ao HEAD

Objetivo: criar workflow que publica status

Arquivos principais:
- `/.github/workflows/`
- `tests/`

Alteracao exigida:

- Localizar todas as leituras e escritas relacionadas antes de editar.
- Adicionar assertion de invariantes no teste mais proximo do sistema.
- Evitar correcoes locais que mantenham duas fontes de verdade.

Validacao:

- Criar teste de regressao com coordenadas de magnitude real.
- Verificar comportamento local em Manaus e comportamento baricentrico.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
