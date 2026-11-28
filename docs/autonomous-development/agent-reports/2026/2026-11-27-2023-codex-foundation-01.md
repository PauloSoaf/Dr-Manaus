# Sessão FOUNDATION-01-CODEX-001

- Agente: Codex
- Modelo: GPT-6, variante UNKNOWN
- Ambiente: Codex, PowerShell no Windows
- Início: 2026-11-27T20:23:31-04:00
- Validação encerrada: 2026-11-27T20:36:15-04:00
- Branch: `feat/universe-map`
- HEAD inicial: `8d94a865c42b536c89fd3e2b680e5b4a311136d5`
- Checkpoint: FOUNDATION-01
- Estado: VISUAL_VALIDATION_PENDING

A sessão iniciou a recuperação de engine, física e runtime a partir dos anexos do usuário e da auditoria histórica. A autoria da última sessão anterior não foi confirmada. Cinco alterações preexistentes em população, grid espacial, tráfego, embarcações e seus testes foram preservadas fora dos commits da sessão.

## Auditoria e implementação

O [baseline](../../foundation/FOUNDATION-00.md) reconcilia o HEAD auditado com Git e registra falhas anteriores à implementação. A [auditoria de runtime](../../foundation/FOUNDATION-01.md) descreve a ordem efetiva de `Game.tick`, os contratos de `PlayerController`, `PhysicsWorld`, `RenderSpaceService`, `WorldStreamer`, `GenerationPool`, `OceanHorizonPresentation`, `ChunkMeshes` e os testes de referência. As ADRs FOUNDATION-001/002 registram alternativas e consequências.

- `Game.ts` chama subpassos locais e delimita a travessia de portais ao deslocamento do próprio passo do jogador ou veículo. A pose visual do jogador acompanha a travessia.
- `PlayerController.ts` aplica até quatro subpassos em caminhada e natação. Flutuação, `toggleFlight` e teleporte consultam a fase compartilhada.
- `WorldStreamer.ts` valida a área oceânica coberta por malhas residentes, cancela preparação invalidada e ignora erros de geração de registros descartados.
- `OceanHorizonPresentation.ts` usa o centro real do clipmap para decidir sobre o cap, liberando o material substituído. `ChunkMeshes.ts` libera também material e geometria de megawaves.
- `.gitattributes` conserva o hash dos GeoJSON Natural Earth em checkouts Windows. Os dados versionados permaneceram iguais.
- Adicionados laboratório headless e cinco regressões. Nenhum arquivo de produção foi removido.

## Verificação local

No checkout limpo de `348e27bbff769e0d1f6643020951dd2e5aa4edbf`, passaram `npm run typecheck`, `npm run test:regression` (639/639), `npm test` (2.031/2.031), `npm run build` e `git diff --check`. Vite levou 1,93 s e informou aviso de tamanho de bundles. O ensaio headless mediu variação de 0,030 m na caminhada, 0,046 m de ápice, 0,017 s no pouso e 0,009 m de flutuação sob as seis cadências. Frame time e memória gráfica não foram medidos.

A reauditoria verificou região cancelada, erro antigo, fallback parcial e completo, correspondência de fase e preservação do sweep de voo. As regressões CT-08-04 e CT-08-06 da árvore compartilhada antecedem este trabalho e não ocorreram no checkout publicado. Testes automatizados de navegador foram omitidos conforme a instrução da fase. Não houve homologação manual.

## Publicação

Commits de governança e implementação: `e58af1a`, `3d70525` e `348e27b`. Push confirmado em `origin/feat/universe-map` para `348e27b`. O workflow Validation terminou com sucesso nesse SHA. O commit posterior de handoff registra a sessão. [GitHub Actions](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/46088496601).

## Continuidade

O checkpoint continua aberto. O próximo trabalho é rastrear descontinuidades e resolver a autoridade do jogador durante entrada, condução e saída de veículo. Completar cenários de rebase/água e homologar o oceano e a memória sob trânsito prolongado antes de avançar.
