# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-04` (Fauna Alienígena, Taxonomia Morfológica, IA Econômica a 8 Hz e Combate Multi-Domínio)
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE (1.697/1.697 testes vitest, 638/638 regressões, typecheck 0 erros, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T11:50:00-04:00

## Mudanças do Patch
1. `src/world/life/AlienFaunaManager.ts`:
   - Gerenciador determinístico e de baixo consumo para criaturas e fauna alienígena (`AlienFaunaManager`).
   - 5 morfologias procedurais de baixo polígono via `InstancedMesh`:
     - `amphibious-crawlers`: rastejadores de carapaça baixa para costas e pântanos.
     - `chitinous-quadrupeds`: quadrúpedes corpulentos blindados.
     - `avian-gliders`: planadores aéreos de asas amplas que navegam correntes a 15-30m de altitude.
     - `serpentine-burrowers`: rastejadores cilíndricos segmentados.
     - `bipedal-predators`: predadores ágeis bípedes com postura ofensiva.
   - Máquina de estados (FSM) de IA com tick econômico descorrelacionado a 8 Hz (`FAUNA_AI_TICK_SEC = 0.125s`):
     - Estados `idle`, `patrolling`, `fleeing`, `aggressive`, `knocked`, `defeated`.
     - Fuga automática ao detectar aproximação rápida ou proximidade menor que 22m do Dr-Manaus.
     - Integração de física e colisão de solo a 60 FPS com alinhamento contínuo à normal da superfície.
   - Aplicação de dano e impulso cinético (`hit(id, force, damage)`) e recomposição via poderes (`reconstruct`).
2. `src/core/types.ts`:
   - Adicionada variante `'creature'` ao tipo `Target['kind']`.
3. `src/player/powers/PowerSystem.ts`:
   - Suporte direto a impacto de ondas de choque em alvos do tipo `'creature'`.
4. `src/game/Game.ts`:
   - Instanciado `alienFauna` e adicionado à árvore de cena `worldRoot`.
   - Generalização de miras e acertos em `PowerSystem`: `targets` inclui `[...manausTargets, ...this.alienFauna.targets]`, permitindo que socos, chutes, lasers, mira assistida e shockwaves atinjam fauna alienígena em qualquer planeta habitável.
   - Loop principal atualiza fauna com superfície e biosfera ativas (`this.alienFauna.update(dt, this.player.position, activeSurface, activeBiosphere)`).
   - Poder de restauração (`reconstruct`) reconstrói criaturas abatidas.
5. `specs/universo-vivo/04-ALIEN-FAUNA-MANAGER.md`:
   - Especificação técnica completa de fauna alienígena e IA econômica.
6. `tests/alien-fauna-manager.test.ts`:
   - Suíte de 5 testes unitários cobrindo pool de criaturas, supressão em mundos estéreis (Lua), spawning ativo em mundos habitáveis (Terra), comportamento de IA a 8 Hz e reações a combate / dano / nocaute / reconstrução.
7. `docs/autonomous-development/CI-HISTORY.md` & `SPEC-MASTER-TRACKER.md`:
   - Registrado CI aprovado para VIVO-03 (`2b3c8f8`, 1.692 testes) e status `IMPLEMENTED` para VIVO-04.
