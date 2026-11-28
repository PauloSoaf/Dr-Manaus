# F01-HOTFIX-002: relatório de execução

## Identificação

- Agente: Claude. Modelo: `claude-sonnet-5-5`.
- Sessão: `F01-HOTFIX-002-CLAUDE-001`. Início: 2026-11-27T23:58:38-04:00. Encerramento: 2026-11-28T03:08:14-04:00.
- Ambiente: Claude Code no VS Code, Windows 11, Node 22.20.0.
- Branch `fix/f01-global-terrain-streaming`, em worktree próprio. HEAD inicial `a68ce74`, depois rebaseado sobre `c6318e7` (`feat/universe-map`) antes da primeira publicação.
- [Especificação](2026-11-27-2358-claude-f01-hotfix-002-spec.md).

## Contexto e objetivo

O jogador, voando fora de Manaus, via um quadrado de chunks cercado de vazio. O prompt do hotfix pede cobertura terrestre contínua até ~260 km, vegetação por bioma, streaming por tempo de chegada, culling e classificação corretos e instrumentação, sem funcionalidades de gameplay. A base de solo, água e culling veio da FOUNDATION-01 (`d75419c` a `a3a5a90`).

## Arquivos inspecionados e referências

`Game.ts`, `WorldStreamer`, `ChunkPriority`, `GenerationPool`, `ChunkMeshes`, `OceanHorizonPresentation`, `ForestBackdrop`, `HLODManager`, `EarthProvider`, `EarthSurface`, `EarthLandMask` e a paleta de solo. Referências aplicadas: GPU Gems 2, cap. 2 (clipmaps), e a seleção REPLACE do Cesium. Das demais referências do prompt, só os princípios gerais foram usados, sem releitura.

## Bugs e causas raiz

| Problema | Causa | Correção |
| --- | --- | --- |
| Quadrado de terreno cercado de vazio fora de Manaus | Globo oculto abaixo de 8 km e horizonte só oceânico | Horizonte terrestre aninhado |
| Anel oceânico decidido pela âncora, não pelo jogador | Classificação pelo referencial | Classificação pela posição geodésica atual |
| Floresta só em Manaus | `ForestBackdrop` e HLOD exclusivos | Copas geodésicas por bioma |
| Antecipação presa em 1,6 km e dois workers fixos | Limites fixos no planejador e no pool | Faixas por tempo de chegada e workers por hardware |
| Planícies costeiras sem vegetação (defeito da `439c7e1`, achado pelos testes das copas) | Limite de árvores acima da altura da praia | `a3a5a90` na `feat/universe-map` |

Dois defeitos foram introduzidos e corrigidos nesta mesma sessão, antes de publicar:

- O corredor de voo mais longo pedia mais chunks do que o cache guarda. Em voo estável a 1.200 m/s, a contagem de gerados subiu de 432 para 592 em 60 quadros. O plano passou a ser limitado ao que permanece residente.
- Quando o furo das copas passou a seguir a cobertura real, ele podia zerar durante o carregamento. Agora há um espaço livre mínimo de 64 m.

Durante a sessão, relatei ao usuário um bug latente no planejador antigo: uma entrada preditiva apagaria a marca `immediate` de um chunk próximo. A análise posterior mostrou que isso não era alcançável com a fórmula original. O código atual preserva a marca na junção, com um teste que falha se ela for sobrescrita.

## Decisões

[ADR-F01H2-001 a 003](../../ARCHITECTURE-DECISIONS.md).

## Arquivos

- **Criados:** `EarthHorizonPresentation.ts`, `EarthCanopyLayer.ts`, `StreamingDiagnostics.ts`, três testes `f01-hotfix-002-*`, a especificação e este relatório.
- **Modificados:** `Game.ts`, `Chunk.ts`, `EarthGroundPalette.ts`, `ChunkPriority.ts`, `GenerationPool.ts`, `WorldStreamer.ts` e a governança.
- **Removidos:** nenhum. Nenhum teste existente foi alterado.

## Implementação

- **Horizonte:** níveis de 0 a 12,8 km e de 6 a 262 km, 128 segmentos, montagem de 1,5 ms por quadro em buffers de trabalho e publicação atômica. Afunda 1,5 m (perto) e 4 m (longe) sob o terreno próximo e converge em 2,5 e 20 km. Usa a mesma transição de opacidade do solo local.
- **Copas:** células geodésicas de 40 m até 2,8 km (a especificação previa 3,2 km; o valor foi reduzido junto com a histerese de um tile), um tile por quadro, sem vegetação na água, no gelo ou na faixa de praia, e com árvores derrubadas respeitadas. O furo segue o raio coberto por chunks residentes (mínimo de 64 m).
- **Streaming:** faixas por urgência, alcance até 6 km, disco que encolhe em voo muito rápido, plano limitado a 64 ativos mais 24 de antecipação, evicção do que não foi pedido primeiro, 2 a 4 workers e cancelamento do que deixou de ser pedido antes de chegar a um worker.
- **Diagnóstico (F3):** latência, fila, geração e construção de malha em p50/p95/p99 (janela de 256 amostras); pedidos, gerados, ativados, cancelados, descartados e falhas; acerto de cache; tempo até cobertura física e detalhada após troca de região; estatísticas do horizonte e das copas. Só calcula com o painel aberto. O upload de GPU não é observável dali e não é informado.

**Troca de região (§8):** os chunks e colisores antigos são descartados de imediato, porque pertencem a outro referencial. O horizonte é reconstruído na mesma chamada, então não há quadro sem terreno. A física do solo é analítica e vale desde a troca. As copas voltam um tile por quadro. Só os destinos em Manaus esperam os chunks (`prepareManaus`). Fora de Manaus, as árvores dos chunks e seus colisores chegam nos quadros seguintes e, até lá, o terreno desenhado perto do jogador pode ficar até 1,5 m abaixo do solo físico.

## Testes

29 testes novos: 15 do horizonte, 5 das copas e 9 do streaming.

- **Horizonte:** cobertura em todos os azimutes até 250 km em sete sítios (Amazônia, Brasil central, Saara, Europa, Himalaia, Antártida e Atlântico); paridade com o solo físico perto do jogador; água só onde há água; nenhum buraco a 300, 3.000 e 10.000 m/s com orçamento apertado (a 10.000 m/s, com 39 reconstruções imediatas); âncora nova; handoff; cobertura dos chunks.
- **Copas:** densidade por bioma (Amazônia 19.344 agrupamentos, Europa 7.516, Saara 271, 0 no gelo e no mar); apoio no solo físico e fora da água na costa; determinismo entre âncoras; tiles limitados em 40 km de percurso; furo, altitude e árvores derrubadas.
- **Streaming:** alcance por velocidade; ordem das faixas; marca `immediate`; plano dentro da residência em oito velocidades e quatro raios; sem regeneração em voo estável; métricas e cobertura, inclusive no preset Ultra; copas sem anel vazio; workers; percentis.

Mutações verificadas: sobrescrever a marca `immediate` quebra o teste correspondente. O teste de regeneração falhava antes do limite de residência.

## Resultados em `30e25bf`

Tipagem aprovada, regressões 639/639, `npm test` 2096/2096, build aprovado e `git diff --check` limpo.

## Medições de CPU (Node, sem GPU)

Intel Core Ultra 9 185H, 22 threads, 32 GB, Node 22.20.0.

| Medida | Resultado |
| --- | --- |
| Planejador por chamada | p50 0,01 a 0,05 ms; p95 até 0,07 ms |
| Alcance do pedido mais distante, disco de 480 m | 80 m/s: 448 → 448 m; 300: 960 → 960 m; 1.200: 1.728 → 2.240 m; 3.000: 1.728 → 6.080 m (antes → depois). A 3.000 m/s, o disco detalhado cai para ~230 m |
| Geração de um chunk da Terra | p50 0,21 a 0,24 ms; p95 0,31 a 0,51 ms |
| Construção das malhas do chunk | p50 0,13 a 0,20 ms; p95 0,23 a 0,52 ms |
| Nível completo do horizonte, sem orçamento | p50 2,4 (longe) e 3,1 ms (perto); p95 5,4 e 6,5 ms; máximo 8 ms (36 construções). A primeira construção do processo, com aquecimento, levou ~27 e ~16 ms |
| Tile de copas (posições) | p50 0,06 ms; p95 0,12 ms. Com a malha, ~0,3 ms |

FPS, tempo de GPU, upload, memória em sessão longa e frame time em jogo: `NOT_MEASURED`. Os testes automatizados de navegador estão proibidos nesta etapa. Não há baseline anterior com a mesma instrumentação. A única comparação antes/depois é a do planejador, medida com o arquivo original de `a3a5a90`.

## Cenários do §19

| Cenário | Cobertura |
| --- | --- |
| Amazônia, interior, Saara, floresta temperada, montanha, polo | Testes headless do horizonte e das copas |
| Costa | Testes de água só onde há água, copas fora do mar e chunks costeiros |
| Voo normal, rápido, super e mega | Horizonte sem buracos até 10.000 m/s; streaming sem regeneração a 1.200 m/s |
| Teleporte entre continentes e 360° | Reconstrução por âncora nova e cobertura em todos os azimutes; vínculo do teleporte testado na FOUNDATION-01 |
| Decolagem, pouso e altitude orbital | Handoff de opacidade testado; aparência manual |
| Destruição e retorno a regiões visitadas | Árvores derrubadas e determinismo; recorte sob volumes |
| Manaus, transição floresta–deserto, múltiplos rebases, voo prolongado | Manual. O rebase não regenera por construção: só uma âncora nova troca a região. Não há teste dedicado |

## Auditoria de regressão

Manaus continua com seu terreno, HLOD e rio; o horizonte e as copas só atuam na Terra fora de Manaus, e Thalassa continua com o horizonte oceânico. A suíte permanente e a completa passaram no código final.

## Validação visual

Pendente. Roteiro (build desta branch, console com F12):

1. `await __DR_MANAUS__.universalTeleport.teleport('-5, -65')` (Amazônia). Se chegar voando, aperte **F**. Espere alguns segundos e gire a câmera 360°. O esperado é floresta e relevo até o horizonte em todas as direções, sem quadrado verde nem anel pelado.
2. Voe baixo, cada vez mais rápido, e depois suba. Nada deve sumir antes do substituto aparecer: sem buracos, sem copas engolindo a câmera, sem terreno piscando.
3. Suba acima de 15 km até o globo e volte. O relevo local deve trocar de lugar com o planeta sem quadro vazio e sem tremulação.
4. `await __DR_MANAUS__.universalTeleport.teleport('23, 12')` (Saara, quase sem árvores), `'-16.5, -68.15'` (La Paz, montanhas) e `'-8.05, -34.9'` (costa de Pernambuco: mar só onde há água e árvores só em terra).
5. Com **F3** aberto, anote as linhas "Streaming ·", "Horizonte terrestre" e "Copas distantes", o FPS e o frame time, parado e voando rápido.

O relevo é grosseiro de propósito, porque os dados têm ~78 km por amostra. Montanhas e litoral têm forma aproximada.

## Limitações

F01-12 a F01-14 em [KNOWN-ISSUES](../../KNOWN-ISSUES.md). Fora do escopo: texturas, normal maps, triplanar, impostores e HLOD urbano fora de Manaus. O cache continua em memória, sem IndexedDB, porque não há benefício demonstrado.

## Commits

`2cb4366` (especificação), `66d584c` (horizonte), `653b3a7` (copas), `a48cc47` (streaming), `30e25bf` (espaço livre das copas) e o commit deste relatório.

## Push e CI

Publicado em `origin/fix/f01-global-terrain-streaming`, sem force push e sem merge. CI SUCCESS em `3262e18` ([run 46119814061](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/46119814061)), registrado no [CI-HISTORY](../../CI-HISTORY.md). O commit que registra esse resultado vem depois do SHA validado.

## Próximas ações

Validação em jogo pelo usuário. Se aprovada, `git merge --ff-only` em `feat/universe-map`, depois de confirmar que nenhuma outra sessão alterou os mesmos sistemas.

## Veredito

`VISUAL_VALIDATION_PENDING`. Sem merge automático.
