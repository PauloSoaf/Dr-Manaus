# PLANET-FLIGHT-LANDING-1.1 — estabilização

Baseline auditada: `42a930a8fb5eaa9d4c0f00b3ef198046a495e7bc`, branch
`feat/universe-map`. Checkpoint iniciado em 2026-10-03 e continuado em 2026-10-04.
Escopo: corrigir controles, validar pouso e limpar o repositório. **Sprint C4 não iniciado.**

## Controles e causa da regressão

O checkpoint 1 substituiu por `KeyB` o modificador espacial que representava Shift.
A variável também controlava o ciclo reverso de alvos; a animação lia B separadamente.
Agora `Game.cosmicBoostHeld` lê exclusivamente `ShiftLeft || ShiftRight` e fornece
o mesmo significado ao controlador, à animação e ao ciclo reverso.
O passo espacial foi extraído de `tick` para `updateInterplanetaryFlight` para ser
exercitado diretamente pelos testes com o controlador e os frames reais.

| Domínio | Teclas | Comportamento |
| --- | --- | --- |
| Local | F, depois W | Decolar; voo normal |
| Local | Shift + W | Voo rápido |
| Local | B + W | Super |
| Local | V, soltar/repetir B + W | Mega |
| Local | V duplo, soltar/repetir B + W | Interplanetário acima do piso de altitude; abaixo dele, limitado a Mega |
| Espaço | W / Shift + W | Propulsão manual / assistência de cruzeiro cósmico com alvo alinhado |
| Espaço | Shift sem direção | Modificador; não cria W nem aceleração |
| Espaço | B | Um passo de Warp por toque; segurar não cria propulsão nem boost Shift |
| Espaço | X | Freio e cancelamento de Warp |
| Espaço | S | Freia a componente frontal antes de inverter |
| Espaço | A/D, Espaço/Ctrl | Movimento lateral e vertical |
| Espaço | Tab / Shift+Tab | Travar/próximo / anterior; B+Tab continua avançando |
| Espaço | P / Backspace | Ligar/desligar piloto / liberar alvo e cancelar piloto |
| Espaço | F | Solicitar ou cancelar pouso num corpo pousável ao alcance |

**SPACE Shift remained cosmic boost; SPACE B remained Warp** é o contrato preservado.
A implementação anterior o violava; este patch o restaura. O modelo local explícito foi mantido.

## Captura e streaming

`PlanetaryLandingIntent`, capture/hold, `landingCaptureStep` e `resolveCelestialContact`
continuam sendo as autoridades existentes. F zera Warp e cancela o piloto antes da captura
relativa ao corpo. O contato absorve a velocidade para dentro, nunca a reflete para fora,
e limita a componente tangencial. A captura espera cobertura antes de entregar o jogador
a TravelDomain, ao frame local ENU e ao CCD do terreno.

Um teste adicional reproduziu a aproximação assintótica que permanecia em capture apesar
de praticamente parada acima da altura de espera. A tolerância de **5 cm** agora conclui
a transição para hold, sem reposicionar o jogador nem gerar velocidade para fora. O caso
é testado a 30/60/120 FPS; as integrações Lua/Marte agora exigem a fase landing-hold real
por pelo menos 60 passos enquanto falta o patch, em vez de inferir hold só pela velocidade.

Depois do handoff, o HUD deixava a última fase cósmica ativa e podia anunciar “aguardando
superfície” sobre o chão. Os testes Lua/Marte reproduziram o aviso; agora a captura local
terminada fica idle e o alvo correspondente ao corpo local aparece como chegada. O lock
é preservado. O browser também exige CHEGADA no HUD depois do contato com o terreno.

O prefetch usa direção de touchdown no frame fixo do corpo, ETA finito e até cinco tiles
críticos. `landingCoverageReady` exige fallback e esse patch; não exige todos os tiles
visuais ou refinamentos do horizonte. O limite `maxTiles=96` permanece.
Dois defeitos foram reproduzidos pelos novos testes: ETA antigo no cache por até 0,25 s
e aceitação de ETA infinito. O provider agora atualiza a prioridade das demandas em cache
sem refazer a quadtree e rejeita ETA/direção não finitos.

O modo físico continua pertencendo à apresentação; prefetch não habilita planeta distante.
A prova de elegibilidade percorre seis direções da Lua no limite de captura (~6,95 Mm de
folga), na metade e a 10 km: apresentação coarse/surface, fallback e execução do patch
pelo scheduler real. Nenhum override global de streaming foi necessário.

Também foram corrigidas referências ausentes no F3 (`FLIGHT`, estado de pouso e ETA),
reproduzidas por `npm run typecheck` no código da baseline.

## Evidência e higiene

A afirmação histórica de **689/689** não é usada como evidência deste checkpoint.
O `failed_tests.txt` anterior registrava **670/689**, sem provar a árvore final daquele teste.
Os resultados abaixo são de novas execuções desta implementação.

Removidos `diff.patch`, `failed_tests.txt` e `src/player/Dr-Manaus.code-workspace`.
O `.gitignore` cobre esses scratches e workspaces locais. Logs, JSON e screenshots ficam
em `artifacts/`, ignorado pelo Git. Uma busca nos Markdown vivos de `docs/` e `specs/`
não encontrou links dependentes dos `iteration-*.md` removidos; eles não foram recriados.

A API legada retornou `statuses: []` para a baseline, mas a API de Checks mostrou o job
**Unit, types and build**, concluído com falha:
[execução da baseline](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/37170825085).
Não confundir ausência de commit statuses com ausência de GitHub Actions.

## Validação desta árvore

Resultados desta implementação, executados na ordem exigida:

| Verificação | Resultado |
| --- | --- |
| TYPECHECK | PASS |
| FOCUSED TESTS | PASS — 248/248 |
| FULL TESTS | PASS — 740/740, zero falhas, zero skipped |
| BUILD | PASS — aviso existente de tamanho do bundle |
| BROWSER SPACE | PASS — zero console/page errors |
| BROWSER LOCAL | PASS — zero console/page errors |
| DIFF CHECK | PASS |

Regressões: `space-controls.test.ts` (13 nomes obrigatórios),
`planetary-landing.test.ts` (19 nomes obrigatórios e invariantes adicionais),
`rocky-landing-prefetch.test.ts` (10 nomes obrigatórios e propriedade do modo),
e integração direta do pouso com Game/terreno.
Matriz de captura: 30/60/120 FPS × 2/8/100/260 km/s, incluindo contato com corpo móvel.
São **51 novos testes**, cobrindo todos os **42 nomes exigidos** e casos adicionais.
Os dois testes de integração usam Game, frames, provider e controlador reais: F a 8 km/s,
cancelamento de Warp/piloto, hold por pelo menos 60 passos sem patch, carregamento somente
do patch crítico, handoff local ENU/Falling, CCD/Grounded, caminhada, salto e F para decolar,
na Lua e em Marte. O teste prova readiness do patch com cobertura visual geral incompleta.

Commits de implementação: `71eda8b` (controles/F3), `91227c4` (captura/prefetch/testes)
e `070303b` (limpeza); `530ed87` corrige a conclusão de capture em hold,
e `0d52327` encerra o aviso de captura depois do handoff local.
O smoke e este registro são fechados no commit de validação seguinte.

O smoke espacial existente percorreu Manaus com F/W/Shift/B/V e saída real, depois
Shift boost/W, B Warp, X e os três ciclos Tab/Shift+Tab/B+Tab. Lua e Marte usam fixtures
de aproximação explícitas a **8 km/s**, com lock, Warp e piloto previamente ativos. F entra
pelo InputController; só as Promises de load dos tiles de detalhe são adiadas para provar
a espera por cobertura real. A liberação ativa o patch, seguida por handoff/Falling,
gravidade/CCD/Grounded e CHEGADA no HUD; caminhada/salto/F decolagem passam na Lua,
e Marte repete pouso e decolagem. Os patches observados tinham **um tile crítico** cada.
As regressões NAV-LOCK-1 de Lua, Marte e standoff/cancelamento em Júpiter também passaram.
F3 foi exercitado. JSON e screenshots estão em `artifacts/space-hardening-*`, ignorados.

Limites desta evidência: as fixtures encurtam viagens astronômicas; não representam uma
viagem contínua Terra–Marte. O atraso deliberado de tiles prova o gate de segurança e
não mede latência normal nem desempenho no hardware do usuário. Testes automáticos
não substituem a validação manual abaixo.

O smoke local existente também passou: boot/cidade real, 40 carros verificados nas vias,
menu/configurações, destruição urbana e cratera de aproximadamente 24 m, voo local explícito,
saída espacial acima do piso, órbita acima de 1.000 km, globo/fallback com transformações
limitadas, coast sem oscilação, X e reentrada por piloto automático. A instrumentação
registrou exatamente uma saída e um retorno, com retomada do domínio Manaus.
Esse smoke confirma a retomada do domínio local; não prova pousos em toda a Terra nem
um retorno ao Largo. O terreno terrestre continua o local existente, sem novo DEM global.
O script foi atualizado para B/V/repetir B, mantendo Shift cósmico, e para aguardar o
piloto terminar a aproximação em vez de cancelá-lo com X. Resumo e trace ficam em
`artifacts/browser-summary.json` e `artifacts/browser-trace.zip`, ignorados.

## Validação manual obrigatória

Na Terra: F; W normal; Shift+W rápido; B+W Super; V e repetir B para Mega;
V duplo acima do piso e repetir B para Interplanetário.
No espaço: Shift+W; B para mudar Warp; X para frear; Tab e Shift+Tab para próximo/anterior.
Na Lua: aproximar rápido, F, observar captura sem rebote, espera de superfície limitada,
handoff automático, contato com o chão, caminhada, salto e nova decolagem com F.
Repetir o pouso em Marte ao menos uma vez.

**REQUIRES USER MANUAL VALIDATION. Parar neste checkpoint. Não iniciar Sprint C4.**
