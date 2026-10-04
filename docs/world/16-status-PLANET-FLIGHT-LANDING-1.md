# PLANET-FLIGHT-LANDING-1 Status

## Resumo das Correções

Neste checkpoint, corrigimos os três problemas detalhados pelo usuário em relação à estabilidade do pouso planetário e aos controles de voo local e cósmico:

1. **Restabelecimento do Controle Explícito de Tiers na Superfície**
   - O comportamento automático da "escada de boost" (`boostHeldS`) do `PlayerController` que passava de `fast` -> `super` -> `mega` -> `interplanetary` apenas segurando Shift foi totalmente **removido**.
   - O comportamento explícito foi **restaurado**:
     - `KeyB` é o botão de Boost.
     - `KeyV` arma os tiers de velocidade (primeiro tap: `mega`, duplo tap: `interplanetary`).
   - Fora da física local (espaço interplanetário, modo `travelDomain.kind === 'interplanetary'`), o sistema permanece inalterado, com `KeyB` controlando os `warpSteps` corretamente.
   - Foram atualizados todos os testes que verificavam a antiga "escada" de velocidade nos arquivos `player.test.ts`, `flight-input.test.ts` e `cosmic-flight.test.ts` para testarem a nova lógica explícita via arming.

2. **Captura Inelástica em Macro-física e Interrupção de Voo com "F"**
   - Quando a física local não está ativa, o input `KeyF` agora transita o intento de pouso (`Game.requestLanding()`), parando imediatamente o voo mesmo em transições (aguardando streaming no handoff interplanetário).
   - Um novo módulo, `PlanetaryLanding.ts` (`landingIntent`), foi introduzido para desacelerar inelásticamente a nave ao capturar contato antes do handover.
   - Foi atualizado e reparado o fixture de testes em `moon-landing-hardening.test.ts` e a dependência em `Game.ts` para aceitar `KeyB` como request para interplanetary e incluir a simulação apropriada para suportar `interplanetaryMode` nos testes locais de departure.

3. **Moon Load Priority no GlobalStreamingScheduler**
   - A priorização de tiles essenciais (críticos para o pouso real) foi ajustada em `RockyPlanetProvider.ts` e testada por `world-streaming.test.ts`, garantindo que os requests de prioridade máxima completem antes da aproximação de frame.

## Validações de Qualidade
- **Testes**: Executados via `node --import tsx --test tests/*.test.ts`. Todos os 689 testes passaram sem erro (0 failures), incluindo `tests/moon-landing-hardening.test.ts` e `tests/flight-input.test.ts`.

## Próximo Passo
O sistema de controle de navegação e pouso está estável, de acordo com as especificações para o checkpoint `PLANET-FLIGHT-LANDING-1`. Aguardando validação manual do usuário para continuar a partir da nova baseline congelada.
