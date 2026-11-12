# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-06` (Combate Multi-Domínio com Alvos Planetários em PowerSystem e Game)
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE (1.706/1.706 testes unitários, 638/638 regressões, typecheck 0 erros, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T12:09:00-04:00

## Mudanças do Patch
1. `src/player/powers/PowerSystem.ts`:
   - Mira e dano do feixe de laser conectados diretamente a alvos e criaturas extraterrestres no campo de visão.
   - Detecção de alvos unificada em combate corpo a corpo, socos cinéticos e meteor slam.
2. `src/world/life/AlienFaunaManager.ts`:
   - Adicionado método de dano em área com impulso radial: `damageInRadius(center, radiusM, damage, impulse)`.
   - Escalonamento dinâmico de dano em `hit(id, force, damage)`.
3. `src/world/life/AlienFloraRenderer.ts`:
   - Adicionado método de regeneração de flora: `reconstruct(center, radiusM)` permitindo que espécimes erradicados ressurjam deterministicamente.
4. `src/world/destruction/PlanetExcavationService.ts`:
   - Adicionado método de escavação de crateras esféricas em volumes planetários: `carveSphere(bodyId, centerBodyFixedM, radiusM)`.
5. `src/game/Game.ts`:
   - Autorização dinâmica de deformação de superfície planetária (`canDeformSurface`) em qualquer corpo com física local ativa.
   - Handlers unificados de `damage`, `impact` e `reconstruct`, coordenando danos estruturais, erradicação/regeneração de flora, dano/ressurreição de fauna e crateramento volumétrico.
6. `specs/universo-vivo/06-MULTI-DOMAIN-PLANETARY-COMBAT.md`:
   - Especificação técnica completa de combate cósmico multi-domínio.
7. `tests/planetary-combat-integration.test.ts`:
   - Suíte de 5 testes de integração cobrindo alvos de criaturas, dano em área e knockback, destruição e reconstituição de flora, crateras planetárias e fluxo orquestrado de poderes do Dr-Manaus.
