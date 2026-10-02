# Patch v2 - indice e ordem obrigatoria

## Checkpoint atual — PLANET-VOLUME-3 / Phase 3 (2026-10-02)

O anexo mais recente aprova Phase 2 por inspeção estática no HEAD
`a752f7ceb24811ece5c0ceafdc275fd217d7b272` e pede o próximo patch: Marching Cubes.
Implementado: mesher puro/resumível para chunks MIXED, posições locais/normais/índices,
cache de malhas limitado, jobs/batches adaptativos no scheduler existente e laboratório visual
isolado em `/?volumeLab=1`, com Terra/Lua/Marte intactos ou com corte sphere/capsule.
O jogo padrão continua sem demanda/malhas volumétricas, com terreno e colisão existentes.

Contrato e medidas: [planetary-handoff-and-volume-phase1.md](../docs/world/planetary-handoff-and-volume-phase1.md).
Validações: [15-status.md](../docs/world/15-status.md).
Manter documentação, commit e push em cada checkpoint conforme autorização persistente.
Encerrar na Phase 3. Não iniciar Transvoxel, cobertura do PlanetGlobe, colisão volumétrica,
poderes planetários, travessia jogável ou Task 013. Aprovação estática não substitui teste manual.

## Checkpoint anterior — PLANET-VOLUME-2 / Phase 2 (aceito por inspeção estática)

Pedido mais recente aceita SOLAR-12 e autoriza chunks volumétricos residentes esparsos a partir
de `2f5d8200f6003e8d9a1fb205d154192792c6b00e`, branch `feat/universe-map`.
Implementado: chaves body-fixed, grade diádica 17³, amostragem pura retomável, cache LRU limitado
por chunks/bytes, invalidação add/remove por região conservadora, demanda local por distância/LOD
e integração ao `GlobalStreamingScheduler` existente. Demanda é debug explícito, desligado por
padrão; edits lógicos sozinhos alocam zero chunks. Terra/Lua/Marte usam o mesmo pipeline.

Contrato, medidas e roadmap: [planetary-handoff-and-volume-phase1.md](../docs/world/planetary-handoff-and-volume-phase1.md).
Resultados e validação manual: [15-status.md](../docs/world/15-status.md).
Documentar, commit e push em cada checkpoint, conforme autorização persistente do usuário.
O bloqueio histórico de Marching Cubes foi superado pelo pedido Phase 3 acima.
Transvoxel, integração ao terreno, colisores, poderes e Task 013 continuam fora do escopo atual.

## Checkpoint anterior — SOLAR-12 / Task 012 (aceito no pedido PLANET-VOLUME-2)

O usuário confirmou os testes manuais de SPACE-HARDENING-1 no HEAD
`e0d4e8a460981232678eb067718fddb47fa2b522` e autorizou avançar à Task 012.
SOLAR-12 adiciona nove luas por dados no catálogo existente (19 corpos), órbitas hierárquicas,
orientação síncrona, fases solares, perfis visuais leves, labels com prioridade e foco de luas no
mapa. O mapa consome posições vivas do jogo; seleção e navegação não teleportam.
As novas luas são sólidas e não pousáveis, sem novos providers de terreno. A Lua da Terra
preserva dados NASA, pouso, caminhada/salto/decolagem e seu pipeline existente.

Contrato e fontes: [docs/world/10-solar-system.md](../docs/world/10-solar-system.md).
Validações automáticas e matriz manual pendente: [docs/world/15-status.md](../docs/world/15-status.md).
O bloqueio histórico de Phase 2 foi superado pelo pedido PLANET-VOLUME-2 acima.
Task 013, planetas anões e superfícies novas continuam fora do escopo.

## Checkpoint anterior — SPACE-HARDENING-1 (aceito manualmente pelo usuário)

Os pedidos mais recentes do usuário delimitam este checkpoint de estabilização, incluindo Lua
pisável como P0 e mapa universal como P1. Baseline real: `f8f451250e564958ffad20d26b72df3fe4c9e6de`,
branch `feat/universe-map`. A baseline congelada do pacote abaixo é histórica.

Implementado e verificado: câmera espacial sem clamp local, áudio por meio/densidade, Terra
geográfica, cobertura lunar completa e exclusiva, dados NASA offline, retorno real ao terreno
lunar com caminhada/salto/decolagem e mapa ampliado com canvas responsivo/zoom/labels.
Resultado histórico: 491 testes unitários e 110 focados passando; typecheck/build/diff check e smoke
`npm run test:browser:space` passando. O usuário posteriormente confirmou os testes manuais.

Estado e limitações: [docs/world/15-status.md](../docs/world/15-status.md).
Contrato/causas/arquivos: [docs/world/10-solar-system.md](../docs/world/10-solar-system.md).
Dados e licença: [docs/world/06-geodata-pipeline.md](../docs/world/06-geodata-pipeline.md).

O bloqueio anterior da Task 012 foi superado pela validação manual e pelo pedido SOLAR-12 acima.

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
