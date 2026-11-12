# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-12 / VIVO-13 / VIVO-14` (Ruptura Planetária Catastrófica, Cinturão de Destroços e Reconstrução Cósmica)
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE (1.716/1.716 testes unitários, 638/638 regressões, typecheck 0 erros, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T12:39:00-04:00

## Mudanças do Patch
1. `src/player/powers/PowerSystem.ts`:
   - Adicionada habilidade `planetRupture` com atalho de teclado `Digit9` e dock no HUD.
   - Adicionado mecanismo de acúmulo de carga de 2,5s com intensificação procedural de tremor e aura antes do impacto cósmico ($10^{28}\text{ J}$).
   - Integrada a reconstrução cósmica (`reconstruct`, tecla `R`) ao ciclo de vida planetário, acionando o hook `restoreBody` para desfazer rupturas planetárias e disrupções de corpos menores.
2. `src/world/destruction/MacroBodyFractureService.ts`:
   - Adicionado método `rupturePlanet(bodyId, energyJoules)` esculpindo cavidade primária e 5 calotas de fissura ortogonais e antípodas através de CSG no `PlanetVolumeEditStore`.
   - Adicionado anel de destroços keplerianos (`CelestialDebrisRing`) com 16 fragmentos discretos.
   - Adicionado método `restorePlanet(bodyId)` expurgando todas as edições volumétricas subtrativas e restaurando o estado do planeta.
   - Adicionados métodos de consulta `isBodyFracturedOrRuptured(bodyId)` e `getPlan(bodyId)`.
3. `src/world/destruction/MinorBodyDisruptionService.ts`:
   - Adicionado método `restoreBody(bodyId)` desfazendo a disrupção e limpando o enxame de asteroides do corpo menor.
   - Adicionados métodos de consulta `isBodyDisrupted(bodyId)` e `getPlan(bodyId)`.
4. `src/core/SaveManager.ts`:
   - Adicionado campo `rupturedBodies?: string[]` a `SaveData`.
   - Implementadas operações idempotentes `isBodyRuptured`, `recordBodyRupture` e `recordBodyRestoration` com persistência automática.
5. `src/game/Game.ts`:
   - Conectados hooks `planetRupture`, `restoreBody` e `getActiveBodyId` ao `PowerSystem`.
   - Restaurado o estado de corpos rompidos no `initialize()` a partir do `save.data.rupturedBodies`.
   - Adicionada métrica `'UNIVERSO VIVO · Corpos Rupturados'` aos relatórios de telemetria e HUD F3.
6. `src/ui/icons.ts`:
   - Adicionado ícone e atalho visual de Ruptura Planetária (`planetRupture`) ao dock de superpoderes.
7. `specs/universo-vivo/12-PLANETARY-RUPTURE-POWER.md`:
   - Especificação técnica consolidada para destruição e reconstrução de escala cósmica.
8. `tests/planet-rupture-power.test.ts`:
   - Suíte de 5 testes unitários cobrindo o acionamento do poder, calotas ortogonais, persistência no `SaveManager`, restauração planetária e disrupção/restauração de corpos menores.
