# Fontes, dados e provenance

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

## Notas de pesquisa atuais

JPL Horizons atualmente documenta versao 4.98e, de 25 de agosto de 2026, e usa DE441 para movimentos de barycenters planetarios em intervalos longos.

Three.js documenta `logarithmicDepthBuffer` e `reversedDepthBuffer`.
O WebGPURenderer pode usar WebGPU e fazer fallback para WebGL2.

A NASA Moon Fact Sheet lista raio equatorial lunar de 1738.1 km, raio polar de 1736.0 km, gravidade superficial de aproximadamente 1.62 m/s2 e velocidade de escape de aproximadamente 2.38 km/s.
A NASA publica distancia media Terra-Lua de aproximadamente 384400 km.

Estes numeros sao referencia de sanity check. O jogo deve guardar a fonte de verdade em manifests versionados.

## Task 001 - Three.js WebGPURenderer

Objetivo: WebGPU com fallback WebGL2 e opcoes de depth

Arquivos principais:
- `docs/world/data-provenance.md`

Alteracao exigida:

- Registrar URL: https://threejs.org/docs/pages/WebGPURenderer.html
- Registrar data de consulta.
- Registrar quais campos do jogo derivam desta fonte.
- Nao copiar dataset para runtime sem licenca/provenance.

Validacao:

- Verificar fonte oficial.
- Versionar qualquer asset derivado.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 002 - Three.js Renderer

Objetivo: logarithmicDepthBuffer e reversedDepthBuffer

Arquivos principais:
- `docs/world/data-provenance.md`

Alteracao exigida:

- Registrar URL: https://threejs.org/docs/pages/Renderer.html
- Registrar data de consulta.
- Registrar quais campos do jogo derivam desta fonte.
- Nao copiar dataset para runtime sem licenca/provenance.

Validacao:

- Verificar fonte oficial.
- Versionar qualquer asset derivado.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 003 - Three.js reverse depth example

Objetivo: benchmark/reference

Arquivos principais:
- `docs/world/data-provenance.md`

Alteracao exigida:

- Registrar URL: https://threejs.org/examples/webgpu_reversed_depth_buffer.html
- Registrar data de consulta.
- Registrar quais campos do jogo derivam desta fonte.
- Nao copiar dataset para runtime sem licenca/provenance.

Validacao:

- Verificar fonte oficial.
- Versionar qualquer asset derivado.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 004 - JPL Horizons manual

Objetivo: ephemerides e DE441

Arquivos principais:
- `docs/world/data-provenance.md`

Alteracao exigida:

- Registrar URL: https://ssd.jpl.nasa.gov/horizons/manual.html
- Registrar data de consulta.
- Registrar quais campos do jogo derivam desta fonte.
- Nao copiar dataset para runtime sem licenca/provenance.

Validacao:

- Verificar fonte oficial.
- Versionar qualquer asset derivado.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 005 - NASA Moon Fact Sheet

Objetivo: raio, massa, gravidade

Arquivos principais:
- `docs/world/data-provenance.md`

Alteracao exigida:

- Registrar URL: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
- Registrar data de consulta.
- Registrar quais campos do jogo derivam desta fonte.
- Nao copiar dataset para runtime sem licenca/provenance.

Validacao:

- Verificar fonte oficial.
- Versionar qualquer asset derivado.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 006 - NASA Moon Facts

Objetivo: distancia media e contexto

Arquivos principais:
- `docs/world/data-provenance.md`

Alteracao exigida:

- Registrar URL: https://science.nasa.gov/moon/facts/
- Registrar data de consulta.
- Registrar quais campos do jogo derivam desta fonte.
- Nao copiar dataset para runtime sem licenca/provenance.

Validacao:

- Verificar fonte oficial.
- Versionar qualquer asset derivado.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 007 - JPL approximate elements

Objetivo: documentar intervalo de validade

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 008 - DE441 future samples

Objetivo: documentar geracao offline

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 009 - Moon DEM future

Objetivo: registrar fonte quando adotada

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 010 - Planet textures future

Objetivo: preferir dados NASA/public domain ou licenca clara

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 011 - Attribution UI

Objetivo: exibir quando licenca exigir

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 012 - Manifest checksum

Objetivo: detectar asset divergente

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 013 - Retrieved date

Objetivo: reprodutibilidade

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 014 - Generator version

Objetivo: reprodutibilidade

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 015 - No runtime API dependency

Objetivo: offline first

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 016 - License tests

Objetivo: manifest nao vazio

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 017 - Data fallback

Objetivo: jogo roda sem optional high-res

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 018 - Source priority

Objetivo: measured > authored > procedural fallback

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 019 - Coordinate convention

Objetivo: documentar ecliptic/body-fixed

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 020 - Unit convention

Objetivo: SI

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 021 - Time convention

Objetivo: seconds from J2000 simplificado

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.

## Task 022 - Precision disclaimer

Objetivo: gameplay nao navigation-grade

Arquivos principais:
- `docs/world/data-provenance.md`
- `src/world/celestial/`

Alteracao exigida:

- Registrar explicitamente.
- Associar ao manifest ou generator.
- Manter fallback deterministico.

Validacao:

- Review de provenance.
- Teste de manifest se aplicavel.

Gate de conclusao:

- O comportamento deve estar coberto por teste automatizado e por telemetria suficiente para diagnosticar regressao.
- Nenhuma coordenada astronomica absoluta pode chegar a um `Mesh.position` quando o mesmo resultado pode ser expresso camera-relative.
