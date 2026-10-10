# Bug matrix

| ID | Severidade | Arquivo principal | Problema | Correção alvo |
|---|---|---|---|---|
| P0-01 | ~~crítica~~ resolvido | `ManausProvider.ts` | provider registrado mas não implementado | implementar adapter real ou desregistrar |
| P0-02 | ~~crítica~~ resolvido | `EarthProvider.ts` | globo substitui ground cedo demais | restaurar gate seguro |
| P0-03 | crítica | building/HLOD/chunks | curvatura parcial/esférica | tile frame WGS84 |
| P0-04 | ~~crítica~~ resolvido | `flightConfig.ts` / `PlayerController.ts` | FTL na física local | travel controller separado |
| P0-05 | crítica | `UniverseRuntime.ts` | sector state sobrescrito | authority explícita |
| P0-06 | crítica | `SolarSystem.ts` | Sistema Solar substituído | generic system runtime |
| P1-01 | ~~alta~~ resolvido | `flightConfig.ts` | velocidade interplanetária inconsistente | corrigir requisito/valor |
| P1-02 | ~~alta~~ resolvido | `EarthGlobe.ts` | terrain random por tile | DEM real |
| P1-03 | ~~alta~~ resolvido | `UniverseRenderer.ts` | sem scheduler/eviction | streaming lifecycle |
| P1-04 | ~~alta~~ resolvido | `UniverseRenderer.ts` | setor vem de player local | usar cosmic address |
| P1-05 | ~~alta~~ resolvido | `UniverseAddress.ts` | bigint passa por Number | preservar bigint |
| P1-06 | ~~alta~~ resolvido | `SystemGenerator.ts` | órbita calculada e descartada | orbital elements |
| P1-07 | ~~alta~~ resolvido | `CameraController.ts` | sceneScale parcial | render-local frames |
| P1-08 | ~~alta~~ resolvido | `WorldMutationStore.ts` | persistence incompleta | IndexedDB + schema |
| P2-01 | ~~média~~ resolvido | `CurveManaus.ts` | arquivo vazio | remover ou implementar |
| P2-02 | ~~média~~ resolvido | docs/status | status otimista | usar estados factuais |

## Estado em 2026-09-26

Resolvido nesta passagem:

- **P0-01** `ManausProvider` removido e desregistrado. A opção escolhida foi "retirar o registro até
  a integração estar pronta"; Sprint H2 é quem o implementa.
- **P0-02** gate restaurado, mas como opção (`cityOwnsGround`) ligada a `FEATURES.curvedManaus` em
  vez de constante. O gate cai sozinho quando a cidade estiver curvada, não por um comentário.
- **P1-01** interplanetária é 800 000 km/h (222 222 m/s) e `maxSpeed` acompanha.
- **P1-05** `sectorIndex` preserva `bigint`. Antes passava por `Number` e dois setores a algumas
  centenas de anos-luz de distância colapsavam no mesmo índice. Coberto por teste.
- **P2-01** `CurveManaus.ts` (arquivo vazio) removido.

Parcial:

- **P0-04** a física local já não recebe FTL: o tier `cosmic` (que resolvia para mega, sem chip de
  HUD e sem velocidade própria) foi removido, e o teto de altitude voltou. O `TravelDomain`
  continua por fazer — Sprint H5.

Regressões corrigidas do Sprint H0 anterior:

- `coveredByCity()` tinha sido desligado com `curvedManaus: false`, o que é exatamente o que P0-02
  proíbe. Voltou.
- Três testes tinham sido marcados `test.skip` em vez de corrigidos, incluindo o que guarda a
  rotação dos tiles. Todos voltaram a rodar: dois passaram assim que o gate voltou, e o terceiro
  apontava para o shell de atmosfera novo, que compartilha o grupo com os tiles.
- O teto de altitude tinha sido removido. O roadmap diz para removê-lo **depois** do handoff
  (Sprint H5), que ainda não existe.

Gate do Sprint H0: build verde, 250 testes verdes, 0 skipped.

## Segunda passagem

- **P1-02** noise removido (já estava) e DEM real no lugar: ETOPO5 da NOAA, domínio público,
  reamostrado offline para 512x256 (341 KB). Tiles vizinhos amostram a mesma coordenada, então as
  bordas coincidem sem tratamento de seam. Relevo real não aparece em silhueta — 0,2% do raio — e
  por isso a *inclinação* é exagerada só para o sombreamento, com a superfície na altura correta.
- **P1-03 / P1-04** `UniverseRenderer` virou `StarSectorProvider`, um `WorldProvider`: o scheduler
  decide, o budget vale, setor sem demanda é desativado e a geometria é liberada. O setor vem do
  endereço cósmico, não de metros de Manaus. Atrás de `FEATURES.galaxyTravel`.
- **P1-06** elementos orbitais gravados no corpo na geração e lidos pelo runtime. Antes o runtime
  re-derivava com o mesmo seed mas outra sequência de saques, então a órbita dada e a desenhada
  não tinham relação — e o que falhava caía em `[0,0,0]`.
- **P1-07** `sceneScale` removido dos dois lados: do `CameraController`, que o aceitava e que
  multiplicava `camera.near` com ele, e do `UniverseRuntime`, que o calculava sem leitor.
- A origem de render passou a rebasear Y também. Era o motivo de a skin quebrar em altitude: a
  100 000 km o personagem era esfolado a 1e8 em float32, onde um ulp vale oito metros.

Falta: P0-04 (`TravelDomain`, Sprint H5), P1-08 (persistência), P2-02, Sprint H2
(`ManausProvider`).

## Terceira passagem

- **P1-08** contrato de persistência fechado: schema version com migração, generator version,
  endereço de corpo/sistema/setor, IndexedDB com fallback, escrita assíncrona e coalescida,
  validação campo a campo na leitura, quota tratada por descarte do corpo mais antigo. 10 testes.
- **P2-02** `docs/world/15-status.md` dizia que a fase 6 estava pronta, que o `ManausProvider`
  estava criado e registrado, e que o gate de 15 km tinha sido removido. Nada disso era verdade —
  o provider foi apagado no commit seguinte e `FEATURES.curvedManaus` continua desligada. O
  documento agora registra o que está ligado, e traz a correção por escrito.

Estado: todos os P0 e P1 resolvidos exceto **P0-04** (metade: física local já não vê FTL, mas o
`TravelDomain` não existe — Sprint H5). P2 resolvidos.

Falta de roadmap: Sprint H2 (`ManausProvider`), Sprint H5 (travel domain, Lua), fase 6 (ligar
`curvedManaus`), atmosfera como volume, oceano, Sprint H9 (hardening).

## Quarta passagem

- **P0-04 fechado.** A primeira metade (tirar FTL da física local) já estava. A segunda é o
  `TravelDomain`: dois domínios, o jogador está em exatamente um, e a física urbana roda em um e
  não no outro. Entrada exige altitude segura, ausência de collider relevante e pedido explícito —
  os três gates que a spec nomeia — e a recusa carrega o motivo, porque "a tecla não fez nada" é a
  frase menos depurável de um jogo. Saída por soltar, por desacelerar ou por aproximar de um corpo.
  Estado em float64, e colisão reduzida a um envelope de altitude: voar contra um planeta a
  222 km/s para na superfície em vez de atravessá-la. 9 testes.

Todos os P0, P1 e P2 da matriz estão resolvidos.

Falta de roadmap (não são bugs): Sprint H2 (`ManausProvider`), Sprint H5 completo (handoff de
corpo e pouso na Lua), fase 6 (ligar `curvedManaus`), atmosfera como volume, oceano, Sprint H9.
