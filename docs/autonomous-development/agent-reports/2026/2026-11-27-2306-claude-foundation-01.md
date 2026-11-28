# Sessão FOUNDATION-01-CLAUDE-001

## Identificação

- Agente: Claude
- Modelo: `claude-sonnet-5-5` (Claude Sonnet 5.5)
- Ambiente: Claude Code, extensão do VS Code, Windows 11, PowerShell e Git Bash
- Session ID: `FOUNDATION-01-CLAUDE-001`
- Início: 2026-11-27T23:06:54-04:00
- Encerramento: 2026-11-28T03:02:14-04:00
- Branch: `feat/universe-map`
- HEAD inicial: `7884462ad56a6a1f14a666e2d99d9734696c1ea7`
- HEAD de implementação: `a3a5a90647ad89cbf707c10ed4904b210aa76647`
- Checkpoint: FOUNDATION-01
- Status: `VISUAL_VALIDATION_PENDING`

## Contexto recebido

- Agente anterior: Codex, sessão [FOUNDATION-01-CODEX-003](2026-11-27-2242-codex-foundation-01.md), interrompida por limite de uso durante os gates finais. A branch local estava 6 commits à frente de `origin/feat/universe-map` (`e0c24f5`): 4 do F01-HOTFIX-001 integrado por fast-forward e 2 da sessão 003 (`59a18b5`, `7884462`).
- O usuário entregou a continuação em `prompt.md`: o prompt da FOUNDATION-01 e o novo F01-HOTFIX-002 (streaming terrestre e horizonte), mais o export da conversa com o Codex. Os dois arquivos são material do usuário e ficam fora do repositório.
- Pendências herdadas: homologação visual de condução, oceano e hotfix; medição de memória e GPU; testes de CI dos commits locais.

## Objetivo

1. Concluir o handoff da sessão 003: reexecutar os gates, revisar os commits e publicar.
2. Continuar a FOUNDATION-01 (referenciais, teleporte, autoridade de terreno e água).
3. Iniciar o F01-HOTFIX-002 em branch própria, sem funcionalidades novas de gameplay.

O hotfix tem sessão própria, `F01-HOTFIX-002-CLAUDE-001`, na branch `fix/f01-global-terrain-streaming`, com especificação e relatório lá.

## Verificação inicial em `7884462`

- `npm run typecheck`: aprovado. `npm run test:regression`: 639/639. `npm run build`: aprovado.
- `npm test`: primeira execução 2043/2044, com falha só em `CT-17-03` (limite de tempo de parede: 26,75 ms contra 25 ms), enquanto uma sonda minha rodava em paralelo. Isolado, o teste passou 3 vezes em 5,8 a 6,4 ms. Reexecução completa sem carga paralela: 2044/2044.
- Revisão adversarial dos diffs de `59a18b5` e `7884462`: sem regressão encontrada. O retorno antecipado de `Game.tick` é seguro porque o loop é do `setAnimationLoop`.

## Arquivos inspecionados

`Game.ts` (tick, vínculo de física, região de streaming, teleporte e horizonte); `WorldStreamer`, `ChunkPriority`, `ChunkMeshes`, `BuildingGenerator` e `chunk.worker`; `EarthElevation`, `EarthLandMask`, `EarthSurface`, `PlanetSurface` e `PlanetTerrainProvider`; `ManausBathymetry`, `geodata`, `UniversalLiquidSystem`, `WaterSystem`, `SwimmingPool` e `OceanHorizonPresentation`; `UniversalTeleportService`, `PowerSystem`, `PlayerController` e `PhysicsWorld`; a governança em `docs/`.

## Referências consultadas

GPU Gems, cap. 1: a constante de fase da onda é `speed·2π/L`, o que dá ω = `speed·√(g·k)` com a dispersão de águas profundas. As demais referências do mapa da FOUNDATION-01 foram herdadas das sessões do Codex e não foram relidas.

## Bugs identificados e causas raiz

Todos reproduzidos com código de produção antes da correção.

| # | Sintoma | Causa raiz | Commit |
| --- | --- | --- | --- |
| 1 | Superfície do oceano a até 56,6 m/s; megaondas de Thalassa a até 17.494 m/s. | A fase usava a velocidade de fase (m/s) como frequência angular. | `d75419c` |
| 2 | No Atlântico, o jogador oscilava entre queda, natação e solo e não mergulhava. | A física local resolvia contra a superfície desenhada, com o mar sólido no nível zero, enquanto a batimetria declarava leito a −250 m. A oscilação que restou depois do leito vinha das ondas do item 1. | `9712ced`, `d75419c` |
| 3 | Teleportes de superfície fora de Manaus ficavam no domínio espacial, sem gravidade e sem chão. | Os frames `<corpo>/surface/...` não eram vinculados à física. | `5092b71` |
| 4 | Marte chegava a 27° do destino, inclinado 26,8°; na Lua, o jogador ia para o centro. | Âncoras esféricas com Y para cima fora da Terra; latitude e longitude ignoradas na Lua. | `5092b71` |
| 5 | Chegada abaixo do relevo (972 m em Brasília; 3,6 km na cratera Gusev). | Altitude relativa ao elipsoide. | `5092b71` |
| 6 | Voltar de La Paz para Manaus pousava 3,6 km acima do Largo. | O pouso era calculado no chão da origem. | `5092b71` |
| 7 | Chão invisível: chunks planos em y=0 enquanto a física usava o relevo (972 m em Brasília, 3.641 m em La Paz); árvores no plano; mar no plano tangente. | Chunks sem relevo fora de Manaus. | `439c7e1` |
| 8 | Chunks secos eram cortados acima de 45 m pelo culling. | O solvente oceânico padrão dava limites de oceano a todo chunk. | `439c7e1` |
| 9 | Planícies costeiras inteiras sem vegetação e com cor de areia. Defeito introduzido pela minha própria `439c7e1`. | O relevo grosseiro achata a planície para 0,6 m, e árvores e solo exigiam 1 m ou mais. | `a3a5a90` |

## Decisões arquiteturais

[ADR-FOUNDATION-004](../../ARCHITECTURE-DECISIONS.md) (solo local único da Terra fora de Manaus), ADR-FOUNDATION-005 (referenciais de superfície vinculáveis e chegada no solo real) e ADR-FOUNDATION-006 (dispersão de águas profundas).

## Arquivos

- **Criados:** `src/world/chunks/EarthTerrainTile.ts`, `src/world/planet/EarthGroundPalette.ts`, `LocalSurface.ts`, `PlanetSurfaceField.ts`, os testes `foundation-earth-surface`, `foundation-ground-chunks`, `foundation-teleport-binding`, `foundation-water-dispersion`, `tests/helpers/earth-surface.ts` e este relatório. O relatório da sessão CODEX-003 foi versionado.
- **Modificados:** `Game.ts`, `PowerSystem.ts`, `WaterSystem.ts`, `chunk.worker.ts`, `BuildingGenerator.ts`, `Chunk.ts`, `ChunkMeshes.ts`, `geodata.ts`, `EarthElevation.ts`, `EarthLandMask.ts`, `EarthSurface.ts`, `PlanetSurface.ts`, `PlanetTerrainProvider.ts`, `WorldStreamer.ts`, `UniversalTeleportService.ts`, `ManausBathymetry.ts`, `OceanHorizonPresentation.ts`, `SwimmingPool.ts`, `UniversalLiquidSystem.ts`, os testes `fluid-registry`, `ocean-world-thalassa` e `universal-teleport-interplanetary`, e a documentação de governança.
- **Removidos:** nenhum.

## Detalhes da implementação

- `LocalSurface` é o solver único do solo e do nível do mar curvo, usado por colisão, batimetria, chunks e worker (sem Three.js no bundle do worker, com teste).
- `EarthGroundSurface` define o solo jogável: praia a 0,6 m, plataforma rasa de 12 m e leito a −250 m. Globo, órbita e volume continuam em `EarthSurfaceGenerator`.
- Chunks da Terra amostram o mesmo solver em grade 9×9, com cores por bioma, saias nas bordas, árvores e colisores no solo, água só nas células molhadas e culling medido pela geometria.
- Teleportes usam frames `surface-enu` no elipsoide do próprio corpo e altitude acima do solo ou do mar. A física é religada antes de consultar o chão.
- `gerstnerAngularFrequency` é compartilhada por CPU, material TSL, rio de Manaus e piscina. Os multiplicadores da piscina e do copo foram reescalados para manter o movimento anterior.

## Testes

- **Criados:** os quatro arquivos `foundation-*` listados acima. O arquivo de chunks inclui o caso das planícies costeiras.
- **Alterados, sem afrouxar:** o oráculo de `fluid-registry` passou a usar ω = `speed·√(g·k)`; a busca de cristas de Thalassa varre mais espaço com os mesmos limites; `T_VIVO10_01` deixou de aceitar a altura relativa ao elipsoide e exige 2 m acima do solo real, no local pedido e com a vertical alinhada.
- **Mutação:** o teste de culling falha quando os limites antigos são restaurados.

## Resultados

| Estado | Tipagem | Regressão | `npm test` | Build |
| --- | --- | --- | --- | --- |
| `7884462` | aprovada | 639/639 | 2044/2044 | aprovado |
| `439c7e1` | aprovada | 639/639 | 2065/2065 | aprovado |
| `a3a5a90` | aprovada | no CI | 2067/2067 | aprovado |

Sob carga paralela já falharam testes de tempo de parede (F01-11). Isolados, passam, e nenhum limite foi alterado.

## Medições de desempenho

Nenhuma nova medição de quadro, GPU ou memória: `NOT_MEASURED`. As medições de CPU do streaming estão no relatório do F01-HOTFIX-002.

## Auditoria de regressão

Caminhos alternativos reavaliados: teleporte por mira, retorno a Manaus, blink sobre o mar, recorte sob volumes publicados e descarte da geometria própria dos chunks na evicção. A suíte permanente passou em cada gate listado e no CI.

## Validação visual

Pendente. Nenhum teste automatizado de navegador, pela política da fase. O [roteiro manual](../../foundation/FOUNDATION-01.md#roteiro-manual-de-solo-teleporte-e-água) cobre solo, teleporte e água. O movimento da água mudou visivelmente (`d75419c`, revertível isoladamente).

## Limitações conhecidas

F01-07 a F01-11 em [KNOWN-ISSUES](../../KNOWN-ISSUES.md): Thalassa fora do sistema ativo, sem reancoragem do ENU em voo longo, marcas de queimado relativas a y=0, escavação volumétrica divergente em faixas costeiras e testes sensíveis à carga. O horizonte terrestre além dos chunks é tratado no F01-HOTFIX-002.

## Commits

`046a9be` (handoff), `d75419c`, `9712ced`, `5092b71`, `439c7e1`, `4d6a8e0`, `a68ce74`, `a3a5a90`.

## Push

Publicados em `origin/feat/universe-map` sem force push. Os dois arquivos do usuário (`prompt.md` e a conversa exportada) continuam sem versionamento de propósito.

## CI

SUCCESS no push e no PR de `046a9be`, `439c7e1` e `a3a5a90` (tipagem, regressão, testes e build no Ubuntu com Node 22). Links no [CI-HISTORY](../../CI-HISTORY.md).

## Pendências

- Homologação manual do roteiro desta sessão, da condução e do oceano.
- Medição de memória, GPU e ciclo de vida em sessão longa.
- Validação do F01-HOTFIX-002 pelo usuário antes da integração.

## Próximas ações

Ver [NEXT-ACTIONS](../../NEXT-ACTIONS.md).

## Veredito final

`VISUAL_VALIDATION_PENDING`. O checkpoint FOUNDATION-01 continua aberto. Nenhum P0 ou P1 conhecido sem correção; a homologação manual continua obrigatória.
