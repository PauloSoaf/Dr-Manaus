# Roadmap de planetas e luas

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

## Sequencia recomendada

```text
1. Earth camera-relative
2. Moon camera-relative
3. Earth -> Moon -> surface -> Earth
4. Sun visual real
5. Mars
6. Mercury/Venus
7. Jupiter + Galilean moons
8. Saturn + rings + Titan/Enceladus
9. Uranus
10. Neptune + Triton
```

Nao implementar todos os corpos em uma unica PR.

## Task 001 - Mercurio provider roadmap

Objetivo: preparar Mercurio como rocky; sem atmosfera densa

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Mercurio` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Venus provider roadmap

Objetivo: preparar Venus como rocky; atmosfera densa e superficie extrema

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Venus` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Mars provider roadmap

Objetivo: preparar Mars como rocky; primeiro planeta apos Lua

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Mars` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Jupiter provider roadmap

Objetivo: preparar Jupiter como gas giant; nao pousavel no sentido terrestre

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Jupiter` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Saturn provider roadmap

Objetivo: preparar Saturn como gas giant; aneis obrigatorios

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Saturn` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Uranus provider roadmap

Objetivo: preparar Uranus como ice giant; tilt extremo

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Uranus` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Neptune provider roadmap

Objetivo: preparar Neptune como ice giant; vento/atmosfera visual futura

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Neptune` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Phobos provider roadmap

Objetivo: preparar Phobos como moon; superficie pousavel

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Phobos` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Deimos provider roadmap

Objetivo: preparar Deimos como moon; superficie pousavel

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Deimos` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Io provider roadmap

Objetivo: preparar Io como moon; vulcanico

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Io` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Europa provider roadmap

Objetivo: preparar Europa como moon; gelo

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Europa` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Ganymede provider roadmap

Objetivo: preparar Ganymede como moon; grande lua

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Ganymede` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Callisto provider roadmap

Objetivo: preparar Callisto como moon; craterado

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Callisto` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Titan provider roadmap

Objetivo: preparar Titan como moon; atmosfera densa

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Titan` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - Enceladus provider roadmap

Objetivo: preparar Enceladus como moon; gelo e plume futuro

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Enceladus` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Triton provider roadmap

Objetivo: preparar Triton como moon; retrogrado

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`
- `src/world/providers/PlanetSurfaceProvider.ts`
- `src/world/celestial/CelestialVisualProvider.ts`

Alteracao exigida:

- Adicionar metadata de `Triton` ao manifest sem ativar automaticamente.
- Definir representacao celestial, planetaria e surface.
- Definir se o corpo e pousavel.
- Definir surface data provider e fallback.
- Definir atmosphere/rings se aplicavel.
- Usar ephemeris offline e frame hierarquico.

Validacao:

- Body schema test.
- Angular LOD test.
- Frame conversion test.
- Provider activation test quando feature flag for ligada.

Nao aceitar:

- Copiar textura generica e chamar de concluido.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Generic rocky body

Objetivo: extrair base de Earth/Moon sem perder especializacoes

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Gas giant visual

Objetivo: nao criar terrain collider

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Ring system

Objetivo: camera-relative ring mesh

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Atmosphere profiles

Objetivo: Rayleigh/Mie parametrizado

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Surface dataset registry

Objetivo: dados por body

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Moon catalog

Objetivo: natural satellites versionados

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - Feature flags per body

Objetivo: ativacao progressiva

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - Body loading menu

Objetivo: mapa do universo

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - Travel target resolver

Objetivo: body orbit/surface

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - Body discovery

Objetivo: descoberta por sistema

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - Body persistence

Objetivo: save namespace

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - Body LOD policy

Objetivo: angular size

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - Body performance budget

Objetivo: limite por qualidade

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - Body shaders

Objetivo: familias rocky/gas/ice

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 031 - Body cloud layers

Objetivo: quando aplicavel

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 032 - Body rings culling

Objetivo: Saturno

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 033 - Body shadow

Objetivo: planetary eclipse

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 034 - Body sun direction

Objetivo: lighting

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 035 - Body local gravity

Objetivo: surface gameplay

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 036 - Body escape transition

Objetivo: surface -> travel

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 037 - Body landing transition

Objetivo: travel -> surface

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 038 - Body teleport debug

Objetivo: ferramenta de QA

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 039 - Body screenshots

Objetivo: golden references

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 040 - Body telemetry

Objetivo: F3

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 041 - Body CI matrix

Objetivo: feature test

Arquivos principais:
- `src/world/celestial/`
- `src/world/providers/`
- `tests/`

Alteracao exigida:

- Implementar contrato generico somente depois do caso Earth/Moon estar provado.
- Permitir override por corpo.
- Nao sacrificar precisao ou streaming para simplificar API.

Validacao:

- Teste com pelo menos um rocky e um gas giant.
- Teste de feature flag.
- Teste de disposal.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
