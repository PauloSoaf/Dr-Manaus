# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-11` (Atmosfera Dinâmica Planetária, Perigos Ambientais, Névoas Alienígenas e Áudio Multi-Meio)
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE (1.735/1.735 testes unitários, typecheck 0 erros)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T13:12:00-04:00

## Mudanças do Patch
1. `src/world/life/PlanetaryHazardService.ts`:
   - Criado serviço puro e determinístico para avaliação de perigos ambientais (`PlanetaryHazardService.evaluateHazard`).
   - 7 arquétipos de perigos: `none`, `radiation-storm`, `acidic-downpour`, `cryogenic-blizzard`, `toxic-spores`, `thermal-scorch`, `vacuum-exposure`.
   - Níveis de alerta (`nominal`, `caution`, `critical`), dano por segundo, dicas de mitigação e rótulos para HUD.
   - Gerador de paletas atmosféricas e abóbada celeste (`PlanetaryAtmospherePalette`): cores de céu, horizonte, zênite, brilho, sol, névoa e densidade de espalhamento óptico.
2. `src/world/life/PlanetaryHazardRenderer.ts`:
   - Renderizador volumétrico de intempéries alienígenas com GPU `LineSegments` via nós TSL (`positionLocal`, `time`, `vec3`).
   - 0 alocações por frame; ancoragem de posição em torno do jogador.
   - Tintura e opacidade dinâmicas por perigo (violeta ionizado para tempestade de radiação, verde ácido para chuva corrosiva, ciano para nevascas criogênicas, esmeralda para esporos).
3. `src/audio/AudioManager.ts`:
   - Ampliado suporte de meios atmosféricos em `AudioEnvironment.medium`: `'earth-atmosphere' | 'alien-dense' | 'alien-thin' | 'alien-toxic' | 'cryogenic-winds' | 'vacuum' | 'airless-surface'`.
   - Curvas de transferência acústica e resposta em frequência adaptadas por meio planetário em `environmentalAudioMix`.
   - Sintetizador sonoro para perigos e alertas: alarmes periódicos, clicks de radiação e rajadas de vendaval.
4. `src/rendering/Atmosphere.ts`:
   - Adicionado suporte a paletas planetárias dinâmicas via `setPlanetaryAtmosphere(palette | null)`.
   - Interpolação suave (`lerp`) entre abóbadas e névoas planetárias, com supressão em mundos sem atmosfera e preservação 100% canônica do ciclo dia/noite da Terra em Manaus.
5. `src/game/Game.ts`:
   - Instanciado `PlanetaryHazardRenderer` e integrado ao ciclo de atualização de frame.
   - Conectada avaliação contínua de perigos e atmosfera ao corpo dominante ativo.
   - Disparo de notificações e áudio de alerta ambiental (`ALERTA AMBIENTAL: ...`) em perigos cautelares ou críticos.
   - Exibição de telemetria no HUD F3: `'UNIVERSO VIVO · Perigo'` e `'UNIVERSO VIVO · Atmosfera'`.
6. `specs/universo-vivo/11-PLANETARY-HAZARDS-AND-SKY.md`:
   - Especificação técnica consolidada do subsistema.
7. `tests/planetary-hazards-and-sky.test.ts`:
   - Suíte de 8 testes cobrindo segurança na Terra, vácuo na Lua e asteroides, perfil marciano, tempestade ácida em Vênus, nevasca e sobreaquecimento, esporos fúngicos, acústica multi-meio e ciclo de vida do renderizador.
