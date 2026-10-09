# Patch v2 - indice e ordem obrigatoria

## Checkpoint atual — MANAUS-AERIAL-PRESENTATION-P0 (2026-10-08)

Novo anexo sobre `5b176f42fd6bf442a8cff130f077c2c6f79ee5cf`: hotfix Manaus/rio/árvores
antes de U0. Contrato: [MANAUS-AERIAL-PRESENTATION-P0.md](MANAUS-AERIAL-PRESENTATION-P0.md).
Camada aérea curva Earth-fixed, apresentação apenas, pronta antes da retirada do root local;
água real ampliada, skyline/ruas agregados e máscara conservadora de copas. Handoff
8/15/13/60 km e ground único preservados. Fonte/cache/licença, custos e evidências:
[25-status-MANAUS-AERIAL-PRESENTATION-P0.md](../docs/world/25-status-MANAUS-AERIAL-PRESENTATION-P0.md).
Validação: 1.108/1.108 unit, 109/109 focados, typecheck/build/diff PASS; browsers Manaus
(dez capturas até 200 km), espacial completo e local PASS em GPU Intel Arc/D3D11, zero erros.
Documentar, commit e push autorizados. **PARAR para validação manual do hotfix; U0 recebido
é a próxima tarefa, depois da aceitação. D1 congelado e ordem do epic preservada.**

## Checkpoint anterior — D1.1-FINAL-HARDENING (2026-10-08)

O último anexo aceita D1.2 no HEAD `c92249bc221c9f4ec16c6840f0823d77ffb9454f` e muda a prioridade:
fechar D1.1, congelar destruição em D1 e avançar depois para o Universe Map.
Contrato: [D1.1-FINAL-HARDENING.md](D1.1-FINAL-HARDENING.md).
Implementado: regiões completas múltiplas com histerese, direção solar real/modelo intacto/albedo
compartilhados, frustum culling, máscaras filtradas por tile, preparo de índices/cobertura/máscaras
antes do commit atômico; saves preservam metadados opcionais de impacto. Sem mudança em MC,
D0, C4, Sol ou destruição local de Manaus. HIGH 33³/8 m e STANDARD 17³/16 m preservados.
Evicção por bytes permite retorno após mudança de prioridade/janela, sem repetir trabalho estável.
Typecheck/build/diff PASS; novos 28, focados 373, completos 1.080; fidelidade 24/24 PASS sem mudar
tolerâncias; browsers volume/espacial completo e curto Game/local PASS; benchmark antes/depois 12/12 PASS.
Resultados, custos, limites e validação manual:
[24-status-D1.1-FINAL-HARDENING.md](../docs/world/24-status-D1.1-FINAL-HARDENING.md).
Roadmap novo: [UNIVERSE-MAP-COMPLETION-EPIC.md](UNIVERSE-MAP-COMPLETION-EPIC.md),
U0→U1→U2→U3→U4→BH0→BH1→BH2→U5→U6. D2–D5 preservados e adiados.
Documentação/commit/push autorizados. **PARAR para aceitação manual depois de D1.1-FINAL;
U0 é o próximo checkpoint, não uma implementação automática nesta entrega.**

## Checkpoint anterior — D1.2 HIGH-RES IMPACT CORE (2026-10-08)

Novo anexo autoriza exclusivamente D1.2 sobre `9e02dbed21a91cdea5db7c50c12c89a8673af7a6`.
Perfil padrão preservado 256 m / 17³ / 16 m; impactos pequenos/médios usam perfil explícito
`impact-high` 256 m / 33³ / 8 m, identidade diferente, assinaturas de geração e faces externas
para normais contínuas. Região HIGH inteira sem redução de raio; limites por bytes/count,
preparo incremental no scheduler e troca conjunta mesh/collider/máscara. Budget insuficiente
mantém autoridade antiga com `high-res-budget`. Sem Transvoxel/LOD misto; sem perfil 4 m.
**`npm run check:impact-fidelity` PASS: 24/24 Lua/Marte/Terra × 260/800 × fases 0/2/4/6 m**,
sem mudar tolerâncias; erro máximo de raio 7,248 m e profundidade 0,2134 m.
Typecheck/build/diff PASS; focados 410/410, completos 1.052/1.052, browsers volume/espacial
curto com Game real PASS, zero erros; benchmarks padrão/alta resolução e 12 impactos PASS.
Arquitetura, custos, testes e aceitação: [23-status-D1.2-HIGH-RES-IMPACT-CORE.md](../docs/world/23-status-D1.2-HIGH-RES-IMPACT-CORE.md).
Sol/Manaus/C4 preservados. Documentar, commit e push autorizados.
**PARAR depois de D1.2 para validação manual; não retomar D1.1 automaticamente nem iniciar D2.**

## Checkpoint anterior — D1.1: parada no gate de fidelidade (2026-10-07)

Novo anexo autoriza o hardening D1.1 sobre o Sol entregue em `644e2def54fe39213f1be6b4053749b8ecc305c0`.
O gate foi medido antes das mudanças funcionais: limite de 8 m no raio e min(4 m, 15%) na
profundidade, sem relaxamento posterior. O erro de raio chegou a 13,075 m; cinco de seis
fixtures Lua/Marte/Terra excedem o limite. **`npm run check:impact-fidelity` retorna 1**.
Medição cruza collider/mesh publicados e contorno analítico da CSG/relevo; inclui footprint
de substituição e diagnóstico JSON. Testes de medição passando não significam aceitação.
O anexo exige STOP quando a tolerância é excedida: **D1.1 NÃO concluído; D1.2 HIGH-RES IMPACT
CORE necessário antes de D2**. Residência múltipla, iluminação solar dos volumes, frustum,
máscaras por tile e otimização de publicação continuam pendentes. Sol/D1/P0 preservados.
Resultados, baseline e pendências: [22-status-D1.1-FIDELITY-GATE.md](../docs/world/22-status-D1.1-FIDELITY-GATE.md).
Typecheck/build/diff PASS; focados 361/361; completos 1.003/1.003; browsers volume/espacial/local
PASS, zero erros; benchmark baseline 12/12 PASS. Gate de fidelidade FAIL continua separado.
Documentação, commit e push continuam autorizados. Não alterar a tolerância para esconder o erro.

## Checkpoint anterior — SUN-APPROACH-P0 (2026-10-07)

O novo anexo autoriza corrigir o Sol sobre o D1 já entregue em `b1ab6a8`.
O limite manual deixa de ser 2R: fotosfera + 100 km de margem CCD. Autopiloto separado para
0,03R = 20.871 km acima da fotosfera. Raios físicos e distâncias preservados. Fotosfera procedural,
corona óptica, LOD angular, detalhe ligado à orientação/rotação solar, glare direcional, HUD/F3.
Sol continua sem pouso, terreno, volume rochoso ou destruição. D1 existente preservado.
Contrato e aceitação: [21-status-SUN-APPROACH-P0.md](../docs/world/21-status-SUN-APPROACH-P0.md).
Typecheck/build/diff PASS; focados 189/189; completos 1.000/1.000; browser espacial/local e
sessão solar nova PASS, zero erros. CI de implementação `95de682` PASS; SHA final conferido após push.
**PARAR para aceitação manual solar; não expandir D1 nem iniciar D2/D5.**

## Checkpoint anterior — LOCAL-IMPACT-DESTRUCTION-D1 (2026-10-07)

O anexo atual aceita `02df01c542c7e9917f01534c1fbf78244381ce49` e autoriza exclusivamente D1,
com documentação, commit e push. MINOR/MAJOR em superfícies rochosas capazes geram um único
subtract-sphere; demanda de produção, MC, collider D0 e supressão do intacto publicam juntos.
Lua/Marte devem ter crateras físicas caminháveis; Terra controlada fora de Manaus. SAFE/GRAZE/
CATASTROPHIC, gigantes e Sol permanecem sem edits. P0 local e CCD/pouso preservados.
Contrato, correção do sinal da calota, budgets e aceitação:
[20-status-LOCAL-IMPACT-DESTRUCTION-D1.md](../docs/world/20-status-LOCAL-IMPACT-DESTRUCTION-D1.md).
Typecheck/build/diff PASS; focados 407/407; completos 964/964. Browsers volume/espacial/local/
Manaus PASS, zero erros; aceitação com Game novo e três benchmarks PASS. CI do código/testes
`61f8094` PASS; SHA/CI da entrega final são conferidos depois do push e informados na resposta.
**Parar para aceitação manual depois de D1; não iniciar D2, integridade ou fragmentação.**
As paradas históricas anteriores a D1 abaixo foram substituídas por esta autorização.

## Checkpoint anterior — IMPACT-DESTRUCTION-P0 / Manaus local (2026-10-06)

O último anexo aceita o HEAD `267caf5d0a8c6ce435e16270c165965bec7c2445` e autoriza
o impacto/destruição local antes do D1. Um ImpactFootprint derivado do contato real controla
cratera, core, blast, impulso, reação, entidades e efeitos. Limites locais: raio 1.200 m,
profundidade 600 m; consulta apenas inventário residente; filas sem perda, 16 colapsos pesados/frame
e caminho barato separado de até 1.024 remoções/frame, com prioridade para o núcleo.
Props, NPCs, carros, árvores e todas as partes do mobiliário participam; reconstrução coerente.
Contrato, curvas, testes, limites e evidência: [19-status-IMPACT-DESTRUCTION-P0.md](../docs/world/19-status-IMPACT-DESTRUCTION-P0.md).
Typecheck/build PASS; focados 145/145; completos 886/886. Browsers local/Manaus/espacial PASS,
zero erros; CI do código e da correção da fixture PASS. O SHA documental final é conferido
no CI depois do push e informado na entrega.
Documentar, commit e push seguem autorizados. **PARAR depois deste checkpoint para teste manual.**
D1, CelestialImpactEvent criando PlanetVolumeEdit, fragmentação e novas features universais
continuam fora do escopo. C4 e D0 preservados.

## Checkpoint anterior — D0 / PLANET VOLUME COLLISION (2026-10-06)

O anexo mais recente autoriza exclusivamente D0 a partir de
`4db33426104c9e93d27cbe53a3a3349311e011a8`, após C4. Colisão derivada dos arrays
Phase 3, BVH determinístico incremental no scheduler existente, cache limitado,
sweep contínuo cápsula/triângulo, piso/parede/teto e troca atômica de revisão.
Ativação explícita somente no laboratório; terreno normal e eventos C4 preservados.
Contrato, testes, limites e roteiro: [18-status-VOLUME-COLLISION-D0.md](../docs/world/18-status-VOLUME-COLLISION-D0.md).
Typecheck/build/diff PASS; focados 321/321; completos 831/831; browsers volume, espacial
e local PASS, zero erros; benchmark com nove casos de colisão PASS. CI do código `424c54c`
PASS; o SHA final de validação/documentação é conferido depois do push e informado na resposta.
A parada histórica D0 foi substituída pela autorização local IMPACT-DESTRUCTION-P0 acima.
Não iniciar D1 ou impactos celestes criando edits/destruição planetária.

## Checkpoint anterior — C4 / CELESTIAL IMPACT POLICY (2026-10-05)

O último anexo aceita PLANET-FLIGHT-LANDING-1.1 no HEAD
`9083c8e53936ed71a45b7a6da75acc3d2965ff2d` para progressão e autoriza **somente C4**.
Contrato: CCD → contato com fatos anteriores à resposta → política pura → evento transitório
→ consumidor. Classificar com velocidade relativa ao corpo atingido, separar direto/raspão,
proteger o mesmo alvo com piloto ativo ou intenção F e emitir uma vez por episódio físico.
Lock manual não impede impacto catastrófico direto ≥1c. Preservar CCD, pouso e streaming.
Documentação, commit e push continuam autorizados.

Contrato implementado, matriz dos 19 corpos, limiares, schema, testes e resultados individuais:
[`17-status-CELESTIAL-IMPACT-POLICY.md`](../docs/world/17-status-CELESTIAL-IMPACT-POLICY.md).
Typecheck/build/diff PASS; focados 286/286; completos 777/777; browser espacial e local PASS,
zero erros. O browser preserva Lua/Marte F e verifica os cinco casos C4 com eventos reais.
GitHub Actions PASS no SHA exato `29220e2`; evidência no relatório canônico.
A parada histórica C4 foi substituída pela autorização explícita D0 acima. C4 permanece
sem destruição, VFX, edição de volume, fragmentação ou nova biblioteca física.

## Checkpoint anterior — PLANET-FLIGHT-LANDING-1.1 (2026-10-04, aceito para progressão)

O anexo mais recente congela `42a930a8fb5eaa9d4c0f00b3ef198046a495e7bc` e autoriza
somente estabilização: restaurar Shift cósmico e Shift+Tab, manter B local/B Warp,
validar captura inelástica e prefetch, testar o fluxo F no browser e remover scratch.
Preservar PlanetaryLandingIntent, capture/hold, CCD e tiers locais explícitos.
Documentar, commit e push continuam autorizados por checkpoint.

Implementado e validado: Shift espacial e ciclo reverso restaurados, ETA crítico atualizado,
hold concluído dentro de 5 cm, HUD encerrando captura após handoff e scratch removido.
Typecheck/build/diff PASS; focados 248/248; completos 740/740; browser espacial e local PASS
com zero erros. Os smokes percorrem controles reais e pouso F na Lua/Marte; validação humana
ainda é necessária antes de qualquer avanço.

Contrato e resultados finais individuais:
[`16-status-PLANET-FLIGHT-LANDING-1.md`](../docs/world/16-status-PLANET-FLIGHT-LANDING-1.md).
A parada histórica de 1.1 foi substituída pela autorização C4 acima.

## Checkpoint anterior — NAV-LOCK-1 (2026-10-03)

O usuário aceitou manualmente C0 no HEAD **`386c531a450ab6770b9da454267081f0501989b9`**:
pouso lento na Lua, colisão de alta velocidade sem atravessar e interceptação celestial.
O último anexo autoriza **TARGET LOCK + AUTOPILOT CAPTURE + MAP LOCK** juntos e somente eles.
Essa autorização substitui a parada anterior em C0.

Contrato implementado: [`03-TARGET-LOCK-AUTOPILOT-AND-MAP.md`](dr-manaus-universe-roadmap/03-TARGET-LOCK-AUTOPILOT-AND-MAP.md).
Uma identidade em `Game.navigation`, consumida por mapa, HUD e voo; efeméride ao vivo;
Tab/Shift+Tab selecionam/ciclam no cone de 15°, **P** liga/desliga piloto, Backspace libera.
R mantém reconstrução de matéria; câmera permanece manual. Seleção não liga piloto nem teleporta.
O controlador existente calcula frenagem `v²/(2a)`, limita o comando pela distância/warp,
captura na margem de `bodyArrivalPolicy` e aproxima corpos pousáveis com cobertura e velocidades
seguras. Corpos sem pouso autorizado fazem standoff e acompanham a velocidade orbital.
O CCD de todos os 19 corpos e os gates de handoff C0 continuam como autoridades finais.

Resultados e roteiro manual: [`15-status.md`](../docs/world/15-status.md).
Documentar, commit e push por checkpoint, conforme autorização persistente.
**PARAR em NAV-LOCK-1.** A validação manual deste checkpoint é necessária antes de qualquer
impacto catastrófico, energia de impacto, edição de volume, fragmentação ou destruição planetária.

## Checkpoint anterior — CELESTIAL-CCD-P0 / C0 (aceito manualmente em 2026-10-03)

O ZIP `dr-manaus-universe-roadmap.zip` foi extraído em
[`dr-manaus-universe-roadmap/`](dr-manaus-universe-roadmap/README.md): **20 Markdown, 4.497 linhas**,
lidos integralmente. Baseline real: `9c6d5b24b8b55e7fe836899d034057747872436e`,
branch `feat/universe-map`. Executar somente o primeiro checkpoint, conforme
[`02-PATCH-CELESTIAL-CCD-P0.md`](dr-manaus-universe-roadmap/02-PATCH-CELESTIAL-CCD-P0.md).

Implementado: sweep genérico de terreno com motion clamping, separação de velocidades de
aproximação/handoff/solver, gate por velocidade radial real e cobertura, envelopes para os
19 corpos, resposta relativa ao corpo atingido, contrato CelestialContact e telemetria F3/trace
do primeiro passo local. Lua e Marte compartilham TerrainProvider; gigantes/estrelas não recebem
piso. O sweep cósmico existente continua ativo até o retorno seguro. Marching Cubes, mapa,
efemérides, poderes e volume Phase 3 não fazem parte desta alteração.

Contrato: [planetary-handoff-and-volume-phase1.md](../docs/world/planetary-handoff-and-volume-phase1.md).
Resultados medidos: [15-status.md](../docs/world/15-status.md). C0 agora está aceito manualmente.
Documentar, commit e push por checkpoint, conforme autorização persistente.
O gate de C0 foi satisfeito e substituído pelo checkpoint NAV-LOCK-1 acima.
O restante do pacote organiza checkpoints futuros independentes.

## Checkpoint anterior — PLANET-VOLUME-3 / Phase 3 (2026-10-02)

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
