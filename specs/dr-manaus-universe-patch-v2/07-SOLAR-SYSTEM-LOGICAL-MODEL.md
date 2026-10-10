# Modelo logico do Sistema Solar

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

## Direcao de dados

O modelo atual ja possui `SOLAR_SYSTEM_BODIES` e `OfflineEphemeris`.
Nao substituir isso por uma biblioteca pesada no P0.

Evolucao recomendada:

```text
v2
OfflineEphemeris aproximado
+ provenance

v3
samples JPL Horizons gerados offline
+ interpolacao local

runtime
zero chamadas HTTP
```

## Task 001 - Versionar body manifest

Objetivo: tirar constantes de uso espalhado

Arquivos principais:
- `src/world/celestial/SolarSystemManifest.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Sun body record

Objetivo: massa, raio, rotacao, frame

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Planet body records

Objetivo: Mercurio a Netuno

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - Moon record

Objetivo: preservar valores atuais

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - Natural satellite schema

Objetivo: suportar muitas luas

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - Ring schema

Objetivo: Saturno e outros

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - Atmosphere profile

Objetivo: por corpo

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - Surface profile

Objetivo: rocky/gas/ice

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Landing capability

Objetivo: flag de gameplay

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Ephemeris source metadata

Objetivo: registrar origem e validade

Arquivos principais:
- `src/world/celestial/EphemerisProvider.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Offline approximate elements

Objetivo: manter fallback

Arquivos principais:
- `src/world/celestial/OfflineEphemeris.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Horizons sample format

Objetivo: definir import offline futuro

Arquivos principais:
- `src/world/celestial/HorizonsEphemeris.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - No runtime network

Objetivo: ephemeris sempre bundled

Arquivos principais:
- `src/world/celestial/EphemerisProvider.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Epoch API

Objetivo: tempo unico

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - Time scale docs

Objetivo: documentar simplificacao UTC/TDB

Arquivos principais:
- `docs/world/solar-time.md`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - Body position API

Objetivo: Float64 Vec3

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Body velocity API

Objetivo: Float64 Vec3

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Body orientation API

Objetivo: quaternion por epoch

Arquivos principais:
- `src/world/celestial/BodyRotation.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Angular size API

Objetivo: para render LOD

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Surface distance API

Objetivo: para handoff

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Dominance API

Objetivo: para physics authority

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Relative state API

Objetivo: player-body state

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 023 - Parent child positions

Objetivo: Moon soma Earth

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 024 - Planet barycenters

Objetivo: documentar aproximacoes

Arquivos principais:
- `src/world/celestial/OfflineEphemeris.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 025 - Sun centre

Objetivo: root dinamico

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 026 - Solar lighting direction

Objetivo: Earth/Moon/planet

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 027 - Eclipse geometry

Objetivo: futuro, nao P0

Arquivos principais:
- `src/world/celestial/EclipseModel.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 028 - Gravity gameplay policy

Objetivo: ficcao separada de dados

Arquivos principais:
- `src/world/travel/InterplanetaryController.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 029 - FTL policy

Objetivo: velocidade de gameplay separada

Arquivos principais:
- `src/player/flightConfig.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 030 - Travel acceleration curves

Objetivo: nao alterar ephemeris

Arquivos principais:
- `src/world/travel/InterplanetaryController.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 031 - Body lookup stable

Objetivo: IDs nao mudam em saves

Arquivos principais:
- `src/world/celestial/CelestialBody.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 032 - Manifest tests

Objetivo: valores finitos e hierarquia valida

Arquivos principais:
- `tests/solar-manifest.test.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 033 - Orbit regression tests

Objetivo: ordem e distancia plausiveis

Arquivos principais:
- `tests/solar-system.test.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 034 - Angular size tests

Objetivo: Lua e Sol ~0.5 grau vistos da Terra

Arquivos principais:
- `tests/solar-system.test.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 035 - Moon distance test

Objetivo: ~384400 km medio como sanity

Arquivos principais:
- `tests/solar-system.test.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 036 - No renderer import

Objetivo: modelo solar nao importa Three render objects

Arquivos principais:
- `src/world/celestial/SolarSystem.ts`

Alteracao exigida:

- Manter dados fisicos separados de parametros visuais.
- Registrar unidade em cada campo.
- Usar IDs estaveis.
- Nao chamar rede em runtime.

Validacao:

- Schema validation.
- Sanity orbital.
- Determinismo por epoch.
- Compatibilidade com saves.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
