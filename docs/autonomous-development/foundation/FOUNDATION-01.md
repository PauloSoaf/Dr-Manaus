# FOUNDATION-01 — engine e runtime

Objetivo: estabilizar tempo, referência e autoridade física sem avançar o conteúdo. Depende do [baseline](FOUNDATION-00.md), dos contratos existentes de domínio, de streaming e da regressão permanente. A [sessão 001](../agent-reports/2026/2026-11-27-2023-codex-foundation-01.md) entregou tempo e cobertura. A [sessão 002](../agent-reports/2026/2026-11-27-2041-codex-foundation-01.md) entregou condução e diagnóstico em `d89fccc`.

## Ordem real de `Game.tick`

```mermaid
flowchart TD
  A["Timestamp, navegação e transição de domínio"] --> B["Vincular física, câmera de mira e região"]
  B --> C["Fase da água, cidade e coleta de colisores"]
  C --> D["Veículo ou personagem, com portal / pose de trânsito"]
  D --> E["Portal, universo, prefetch e streaming celeste"]
  E --> F["Raízes, floating origin, streaming local e oceano"]
  F --> G["Destruição, tráfego, veículo vazio, NPCs e missões"]
  G --> H["Câmera, apresentação celeste e poderes"]
  H --> I["Clima, água visual, culling e outros efeitos"]
  I --> J["Render, telemetria, HUD e limpeza de input"]
```

| Etapa | Leitura e autoridade de escrita | Relógio e referencial |
| --- | --- | --- |
| Domínio e mira | `TravelDomain` decide partida/retorno. `bindSurfacePhysics` instala o provedor e gravidade. A câmera prepara ângulos para o controle. | `dt`. ENU ativo ou referencial baricêntrico do sistema. |
| Água, cidade e colisores | Atualiza fase de água e dados de cidade. O seletor `activePhysicsColliders` separa geometria curva de Manaus e superfícies planetárias. | Água usa timestamp de frame. Cidade usa coordenadas legadas quando Manaus curva está ativa. |
| Movimento local | A pé, `PlayerController` e `PhysicsWorld.move` resolvem controles, sweep, terreno e correções. Montado, apenas `VehicleController` integra e o jogador copia o resultado. Portal aplica a pose antes de o universo consumir a posição. | `dt` subdividido para caminhada/natação. `worldDt` na condução. ENU ativo, sem subtrair origem visual. |
| Universo e streaming | Universo lê posição/velocidade locais; em trânsito as integra fora do ENU. Prefetch e streaming celestial precedem o streaming local. | `dt` no universo local e voo no sistema. Trânsito universal recebe `rawDt`. |
| Origem e camadas | `UniverseRuntime`/`RenderSpaceService` mantêm referenciais. `Game` espelha origem inversa nas raízes, no líquido e na câmera. Cidade autoral fica ancorada à superfície terrestre. | ENU lógico em precisão dupla e offsets relativos para render. |
| Destruição e entidades | Rota de destruição usa distância efetivamente voada pelo personagem. Veículo utiliza sua própria colisão e não aciona a destruição do personagem por velocidade. Tráfego, barcos, veículo vazio, destroços, população e missões usam tempo de mundo. | `dt` para destruição por voo, `worldDt` para entidades. Fase fluvial usa `performance.now()`. |
| Apresentação e poderes | Câmera atualiza `globalPosition` e a matriz antes da mira dos poderes. Poderes podem alterar posição por teleporte. Atmosfera, VFX, culling e HUD leem a pose derivada. | `dt` para câmera, `dt/worldDt` nos poderes, `rawDt` nas transições visuais e medição. |
| Render e input | Renderizador recebe cena e câmera. HUD publica estado, contatos e desempenho. `InputController.endFrame` limpa as bordas. | Uma execução por frame. |

## Relógios e decisão de integração

`lastTime` guarda a marca do callback de render. `rawDt` mede o intervalo do frame com piso de 1 ms. `dt` limita esse intervalo a 60 ms. `worldDt` aplica fator 0,14 enquanto o poder temporal está ativo. `armClockS` mede tempo integrado do jogador para o duplo toque de voo. A água usa uma fase compartilhada em segundos da marca de frame. `universe.time` representa época astronômica. `performance.now()` também mede orçamento e deadlines. `Date.now()` é tempo civil para metadados, separado da integração física.

O passo híbrido seleciona até quatro subpassos iguais de aproximadamente 60 Hz em terra ou água. É aplicada margem de 0,2 ms para timestamp irregular a 60 Hz. A simulação local descarta atraso acima de 60 ms, sem fila de recuperação. Voo, troca de voo e boost conservam o sweep de um passo por frame. Os subpassos usam `InputController.consume`, que remove a borda no primeiro consumo. Universo, streaming e câmera continuam uma vez por frame. Flutuação amostra a fase de cada subpasso e converge para a marca visual no último. Troca de voo e teleporte reutilizam a fase conhecida. A política de suspensão para trânsito universal segue pendente.

O limite de integração e o orçamento de recuperação seguem [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/). A separação entre input, simulação e render segue [Game Loop, de Robert Nystrom](https://raw.githubusercontent.com/munificent/game-programming-patterns/master/book/game-loop.markdown). O descarte de materiais foi checado nos tipos locais da versão 0.186 e no [índice oficial de Three.js](https://threejs.org/docs/).

## Autoridade física e espacial

| Escrita | Proprietário atual e contrato |
| --- | --- |
| Posição, velocidade e estado em terra | `PlayerController.update` com solução de `PhysicsWorld`. Altura sólida vem do provedor ativo, incluindo terreno destruído e leito. Altura líquida só classifica natação/flutuação. A colisão atual usa volume conservador com sweep, altura do personagem e margem, além do provedor volumétrico quando ativo. |
| Spawn, teleporte e retorno | `PlayerController.teleport`, `Game.finishSurfaceReturn`, serviço de teleporte e handoff galáctico. São correções explícitas. Portal de jogador e veículo usa segmento do próprio passo para excluir saltos entre frames. |
| Exceções de autoridade | Stress route e handoffs de superfície têm eventos no diagnóstico. Entrada, condução e saída têm caminhos próprios. O desembarque limpa o estado anterior de movimento e conserva a altura e a velocidade do veículo. |
| Rebase | Conversão de `ReferenceFrameGraph` e `RenderSpaceService` preserva pose lógica. `renderOriginVec` publica o offset. Câmera e animação operam na apresentação. |

`celestialRoot` pertence à apresentação celeste. `planetaryRoot` agrupa os provedores de corpos. `manausAuthoredRoot` conserva a âncora terrestre. `activeProceduralSurfaceRoot` abriga chunks e oceano no ENU da região. `actorRoot` recebe jogadores e atores com origem inversa. `activePlanetaryLifeRoot` agrega vida no domínio ativo. Visibilidade não define o conjunto de colisores. Os testes de rebase já existentes cobrem transformação, ondas e separação de raízes. Falta integrar voo e natação ao teste multieixos com transições reais.

## Solo, água e referenciais fora de Manaus

Entregue pela sessão [FOUNDATION-01-CLAUDE-001](../agent-reports/2026/2026-11-27-2306-claude-foundation-01.md). Decisões: [ADR-FOUNDATION-004 a 006](../ARCHITECTURE-DECISIONS.md).

| Contrato | Autoridade | Verificação |
| --- | --- | --- |
| Solo jogável da Terra | `EarthGroundSurface` + `LocalSurface.verticalSurfaceHeight`: terra com relevo, praia, plataforma rasa e leito de −250 m. Globo, órbita e volume continuam em `EarthSurfaceGenerator`. | `foundation-earth-surface.test.ts` |
| Chão desenhado | Chunks da Terra amostram o mesmo solver (9×9), com árvores e colisores no solo, água só nas células molhadas e recorte sob volumes publicados. | `foundation-ground-chunks.test.ts` |
| Nível do mar | Elipsoide (`localSeaLevelY`). Batimetria, ondas, água dos chunks e horizonte oceânico acompanham a curvatura. | Idem |
| Água e flutuação | Leito igual ao colisor. Ondas com ω = speed·√(g·k) em CPU e GPU. | `foundation-water-dispersion.test.ts`, nado e praia em `foundation-earth-surface.test.ts` |
| Teleporte de superfície | Frame `surface-enu` do corpo, âncora no elipsoide do corpo, altitude acima do solo ou do mar, física religada antes de consultar o chão. | `foundation-teleport-binding.test.ts` |
| Região de streaming | Âncora lida do frame físico. Âncora nova regenera os chunks mesmo com o mesmo id regional. | Idem |
| Culling | Limites medidos da geometria (relevo, árvores, prédios, ondas). Os limites do solvente só valem quando não há medição. | Mutação confirmou que o teste falha com os limites antigos |

## Streaming e recursos

`WorldStreamer` separa solicitado, carregando, pronto, ativo e cache. Cobertura próxima para água exige, em cada célula que intersecta o disco de 384 m no centro do clipmap, chunk ativo da região certa, anexado à raiz e com malha oceânica. Culling momentâneo por câmera fica fora do cálculo de residência. Região parcial ou nova mantém o cap. Sobreposição transitória e a costura entre os anéis exigem inspeção gráfica.

Uma preparação iniciada antes de `clear()` falha quando a região é substituída. Respostas antigas não publicam chunks e rejeições antigas não contaminam o preparo atual. `setSolvent` descarta o material compartilhado anterior. `ChunkMeshes.dispose` agora libera os recursos do oceano de megawaves. Falta ensaio prolongado de workers, VRAM e alternância de domínio.

## Carregamento de planetas

A geometria densa dos planetas rochosos é construída em fatias por quadro e guardada para o retorno ([ADR-FOUNDATION-007](../ARCHITECTURE-DECISIONS.md)). O disco distante só sai depois que o globo está pronto e se dissolve sobre ele. Numa aproximação simulada da Lua em Node, os quadros acima de 16 ms caíram de 17 (pior: 316 ms) para nenhum (pior: 8 ms), com os mesmos 96 tiles ao fim (`foundation-planet-loading.test.ts`). O painel F3 só é montado enquanto está aberto.

Roteiro manual: suba de Manaus ao espaço, trave a Lua com **Tab** e use o piloto automático com **P**. Durante a aproximação, o jogo não deve congelar. A Lua deve passar do disco para o relevo sem corte. Saia, volte e repita a aproximação.

## Evidências e aceite

`tests/helpers/foundation-lab.ts` usa jogador, colisão e batimetria de produção. Cenários atuais: solo plano, parede, salto e áreas rasa/profunda. Nas seis cadências (30, 60, 120 e 144 FPS, variável e picos de 60 ms), distância em 1 s ficou entre 6,116 e 6,146 m, ápice entre 1,722 e 1,767 m, pouso entre 0,750 e 0,767 s e diferença vertical máxima de flutuação de 0,009 m. São métricas headless de movimento. O desempenho de frame, GPU e memória ainda não foi medido.

| Gate | Evidência atual |
| --- | --- |
| A–C: tempo, colisão, água | Laboratório cobre caminhada, parede, salto, wading e flutuação. Percursos contínuos de margem, rampa e escadas (CODEX-003). Mergulho, praia e leito no oceano fora de Manaus (CLAUDE-001). |
| D–E: rebase e domínio | `foundation-continuity.test.ts` cruza câmera, múltiplos rebases em voo e natação no rio (sessão CODEX-003). Teleporte entre Terra, Lua, Marte e volta a Manaus em `foundation-teleport-binding.test.ts`. |
| F: deslocamento autorizado | Diagnóstico opt-in separa posição lógica, pose visual, câmera, origem, eventos e correções de colisão por subpasso. Teste headless cobre posse, piloto, desembarque aéreo e tecla E fora de alcance. Falta validar a apresentação em jogo. |
| G: recursos | Cancelamento e reentrada validados no streamer. Geometrias próprias dos chunks de relevo são descartadas na evicção. Falta medição prolongada. |
| H: cobertura | Teste real de preparo parcial, cobertura completa e região nova. Falta inspeção gráfica da costura. |
| I–J: regressão | `a3a5a90`: tipagem, 2.067 testes e build aprovados; CI com as 639 regressões SUCCESS. Veja o [CI por SHA](../CI-HISTORY.md). |

Veredito parcial: `VISUAL_VALIDATION_PENDING`. O checkpoint continua aberto. Testes automatizados de navegador omitidos pela política da fase. Homologação manual e o restante dos critérios precedem FOUNDATION-02.

Limitações desta rodada: não há reancoragem do ENU em voos longos. As demais pendências estão em [KNOWN-ISSUES](../KNOWN-ISSUES.md).

O [F01-HOTFIX-002](../agent-reports/2026/2026-11-27-2358-claude-f01-hotfix-002-report.md) acrescenta o horizonte terrestre de até 262 km, florestas distantes e streaming por tempo de chegada (ADR-F01H2-001 a 003). Sem ele, fora de Manaus e abaixo de 8 km só os chunks próximos têm terreno.

## Sessões, commits e CI

| Sessão | Entrega | Commits | CI |
| --- | --- | --- | --- |
| CODEX-001 | Tempo, cobertura do oceano, laboratório | até `f13477c` | SUCCESS |
| CODEX-002 | Condução e diagnóstico | até `d89fccc` | SUCCESS |
| CODEX-003 (interrompida) | Tráfego e continuidade em rebase | `59a18b5`, `7884462` | validados no push da sessão seguinte |
| CLAUDE-001 | Solo, água, teleporte e referenciais fora de Manaus | `046a9be` a `a3a5a90` | SUCCESS |
| F01-HOTFIX-002 (paralela) | Streaming e horizonte terrestre | `2cb4366` a `4a91ff2`, integrados por fast-forward | SUCCESS |
| CLAUDE-002 | Carregamento de planetas e custo do HUD | `01797e1`, `270345c`, `dff3c22` | ver [CI-HISTORY](../CI-HISTORY.md) |

## Roteiro manual de solo, teleporte e água

Abra o jogo, aperte **F12** e use o console. Cada comando é um teleporte. Se chegar voando, aperte **F** para descer.

1. `await __DR_MANAUS__.universalTeleport.teleport('-15.7939, -47.8828')` (Brasília): o personagem deve pousar no chão visível, entre árvores plantadas no solo. Antes, flutuava sem gravidade.
2. `await __DR_MANAUS__.universalTeleport.teleport('10, -35')` (Atlântico): flutue sem alternar de pose, mergulhe com **Ctrl** e volte à tona.
3. `await __DR_MANAUS__.universalTeleport.teleport('-16.5, -68.15')` (La Paz, 3.640 m) e depois `await __DR_MANAUS__.universalTeleport.teleport(__DR_MANAUS__.player.position.clone().set(38, 2.2, 12))`: deve voltar ao Largo no nível do chão.
4. `await __DR_MANAUS__.universalTeleport.teleport({kind:'surface-geodetic',galaxyId:'milky_way',systemId:'sol',bodyId:'moon',latDeg:0.674,lonDeg:23.47,altitudeM:2})`: chegada na superfície lunar com gravidade fraca.
5. Em Manaus, olhe o Rio Negro e entre na água. As ondas agora são lentas e contínuas, em vez de tremer várias vezes por segundo.

O [F01-HOTFIX-001](../agent-reports/2026/2026-11-27-2131-f01-hotfix-001.md) trata em branch paralela as regressões de câmera, malha do terreno e escavação. A integração depende da validação visual e da revisão contra a sprint.

## Roteiro manual de condução

1. Abra a prévia local da sessão em `http://127.0.0.1:9998/?motionTrace=1`. Aproxime-se de um carro até aparecer **E · Pilotar**. Em terra, **V** alterna os veículos e posiciona o selecionado à frente.
2. Entre com **E**, acelere com **W**, vire e freie com **Espaço**. Pare e saia com **E**. O personagem deve aparecer ao lado, e depois voltar a andar e pular normalmente. Observe a câmera na entrada e na saída.
3. Entre de novo, use **V** até **SAUCER** e segure **Espaço** para subir um pouco. Solte e pressione **E**. O personagem deve aparecer à altura do veículo e cair daí.
4. Se houver salto, registre a tecla, o tipo de veículo e o que mudou de posição primeiro. O diagnóstico em `window.__DR_MANAUS__.motionTrace.snapshot()` guarda os últimos 240 quadros e está disponível apenas na URL acima.
