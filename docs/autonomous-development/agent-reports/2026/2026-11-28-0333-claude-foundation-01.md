# Sessão FOUNDATION-01-CLAUDE-002

## Identificação

- Agente: Claude
- Modelo: `claude-sonnet-5-5` (Claude Sonnet 5.5)
- Ambiente: Claude Code, extensão do VS Code, Windows 11, Node 22.20.0, Intel Core Ultra 9 185H
- Session ID: `FOUNDATION-01-CLAUDE-002`
- Início: 2026-11-28T03:33:30-04:00
- Encerramento: 2026-11-28T03:53:53-04:00
- Branch: `feat/universe-map`
- HEAD inicial: `4a91ff2` (F01-HOTFIX-002 integrado por fast-forward no início da sessão)
- HEAD de implementação: `dff3c22`
- Checkpoint: FOUNDATION-01
- Status: `VISUAL_VALIDATION_PENDING`

## Contexto recebido

O usuário testou o hotfix e relatou melhora geral ("a base do jogo tá melhorando"), sem validar o roteiro item a item. Pediu para continuar melhorando a FOUNDATION, sem bugs e com renderização mais rápida: voar da cidade até o Sol sem perceber carregamentos, vendo só transições de detalhe. O fast-forward de `fix/f01-global-terrain-streaming` foi feito com base nesse retorno. A homologação item a item continua pendente. Nenhum outro agente publicou nada entre as sessões.

## Objetivo

Encontrar e remover travadas e trabalho desperdiçado por quadro no caminho da cidade ao espaço, com evidência medida, sem funcionalidades novas.

## Arquivos inspecionados e referências

`Game.ts` (tick, HUD e apresentação celeste), `HUD.ts`, `CelestialPresentationController`, `CelestialBodyVisualLayer`, `PlanetVisual`, `EarthProvider`, `RockyPlanetProvider`, `PlanetGlobe`, `PlanetVolumeSurfaceMask`, `PlanetVolumeRuntime`, `GlobalStreamingScheduler`, `PlanetProviderRegistry`, `EarthContinentalRiverRenderer`, `ManausAerialPresentation`, `HLODManager`. Nenhuma referência externa nova. A ideia de manter a representação anterior até a nova estar pronta já vinha do ADR-F01H2-001.

## Bugs e causas raiz

| # | Sintoma medido | Causa | Commit |
| --- | --- | --- | --- |
| 1 | Aproximar-se da Lua congelava o jogo: 261 a 284 ms numa chamada, repetidos a cada nova aproximação. | O globo de reserva (6 faces de 65²) era construído de uma vez e destruído em `'off'`. | `01797e1` |
| 2 | Quadros de 28 a 42 ms durante a mesma aproximação. | Os níveis 0 a 2 da Lua, também em 65², eram gerados dentro do agendador. | `01797e1` |
| 3 | Trabalho e alocações em todo quadro com o F3 fechado. | O objeto de diagnóstico era montado a cada quadro, mas o HUD só o lê, a 10 Hz, com o painel aberto. | `270345c` |
| 4 | Corte visível do disco para o globo (a Lua com ~190 px). | O disco sumia no mesmo quadro em que o globo ficava pronto. | `dff3c22` |

Os planetas procedurais rochosos usam a mesma resolução densa (65) e são cobertos pela correção. O custo deles não foi medido separadamente.

Medidos e sem necessidade de mudança: o HLOD de Manaus (pior quadro de 8 ms parado e de até 3,3 ms em voo, a até 1.200 m/s); os tiles do globo da Terra (0,6 a 1,7 ms de mediana); os rios continentais (construídos no início); e a apresentação aérea (construída na tela de carregamento).

## Decisões

[ADR-FOUNDATION-007](../../ARCHITECTURE-DECISIONS.md).

## Arquivos

- **Criados:** `tests/foundation-planet-loading.test.ts` e este relatório.
- **Modificados:** `Game.ts`, `CelestialPresentationController.ts`, `PlanetGlobe.ts`, `PlanetVolumeRuntime.ts`, `PlanetProviderRegistry.ts`, `RockyPlanetProvider.ts` e a governança.
- **Removidos:** nenhum.

## Implementação

- `planetTileSteps` gera um tile uma linha de vértices por passo. `buildPlanetTileMesh` percorre o mesmo gerador, então a saída é idêntica, e há teste.
- `PlanetGlobe.prepareFallback(superfície, orçamento)` constrói sem montar. `ensureFallback` só monta com as seis faces prontas, e `releaseFallback` mantém a geometria. A máscara de volume é reaplicada a cada remontagem. Os geradores de superfície não guardam estado, e a ruptura de planetas só altera a visibilidade, então o cache não traz de volta nada destruído.
- Com `slices` (`PLANET_LOADING`, só no jogo), os tiles mais densos que 17² entram numa fila avançada por `advanceLoading`. Pedidos cancelados ou de um provedor descartado são rejeitados. Os globos dos planetas distantes são preparados com 2 ms por quadro. Sem `slices`, tudo continua síncrono.
- O disco se dissolve sobre o globo em 0,6 s quando o chamador pede (`handoffFadeS`, `nowS`). Um disco maior que a tela é trocado na hora.
- O diagnóstico do HUD é montado só com o F3 aberto. A limpeza de malhas antigas do volume, que acontecia dentro do getter de métricas, passou a ser chamada explicitamente em todo quadro (`pruneStaleMeshes`). O cache é limitado a 8 malhas.

## Testes

- **Criados:** 6 casos em `foundation-planet-loading.test.ts`: reutilização sem recalcular vértices; fatias sem planeta parcial e com saída idêntica; preparo sem montagem; tiles densos fatiados, idênticos e com cancelamento; dissolução com reinício e troca imediata quando o disco cobre a tela; aproximação sempre com exatamente uma representação. Os casos de reutilização, fatias, preparo e aproximação falharam no código anterior.
- **Alterados:** nenhum teste existente.

## Resultados

| Estado | Tipagem | Regressão | `npm test` | Build |
| --- | --- | --- | --- | --- |
| `01797e1` | aprovada | 639/639 | 2101/2101 (2ª execução; na 1ª, só CT-06-03, F01-11) | aprovado |
| `270345c` | aprovada | no gate seguinte | 2101/2101 | aprovado |
| `dff3c22` | aprovada | 639/639 | 2102/2102 (2ª execução; na 1ª, só CT-06-03, F01-11) | aprovado |

`CT-06-03` passou 3 de 3 vezes isolado. Ele mede o `HLODSystem`, que não foi alterado.

## Medições de desempenho

Em Node, sem GPU.

| Medida | Antes | Depois |
| --- | --- | --- |
| Aproximação simulada da Lua (540 quadros): quadros acima de 16 ms | 17 | 0 |
| Pior quadro | 316 ms | 8 ms |
| p99 | 32 ms | 7 ms |
| Tiles no fim | 96 | 96 |
| Globo de reserva pronto | no quadro 0 (travado) | no quadro 64, com o disco visível até lá |

"Antes" é o mesmo cenário sem fatias, que reproduz o comportamento anterior numa aproximação contínua. Preparar os planetas solares ocupa cerca de 300 ms de trabalho, divididos em fatias de 2 ms por quadro. A geometria guardada ocupa cerca de 1,5 MB.

O custo do HUD não foi medido: o `Game` não roda sem renderer. FPS, GPU, upload e memória: `NOT_MEASURED`.

## Auditoria de regressão

Foram reavaliados: os contratos de `'off'` sem globo montado e do disco oculto com o globo pronto (mantidos quando não há `handoffFadeS`); os gates de pouso (`landingCoverageReady` usa os tiles padrão de nível 8, que continuam imediatos); `retireProvider` na troca de sistema; a máscara de volume na remontagem; a limpeza de malhas com o F3 fechado.

## Validação visual

Pendente. [Roteiro de aproximação](../../foundation/FOUNDATION-01.md#carregamento-de-planetas). Nenhum teste automatizado de navegador, pela política da fase.

## Limitações

F01-15 e F01-16 em [KNOWN-ISSUES](../../KNOWN-ISSUES.md): material por tile (hipótese não medida) e troca instantânea na saída do globo.

## Commits

`01797e1`, `270345c`, `dff3c22` e o commit deste relatório.

## Push e CI

Publicado em `origin/feat/universe-map` sem force push. CI SUCCESS no push e no PR de `683a599` ([run 46123306748](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/46123306748)), registrado no [CI-HISTORY](../../CI-HISTORY.md). O commit que registra esse resultado vem depois do SHA validado.

## Pendências e próximas ações

[NEXT-ACTIONS](../../NEXT-ACTIONS.md).

## Veredito

`VISUAL_VALIDATION_PENDING`. O checkpoint FOUNDATION-01 continua aberto.
