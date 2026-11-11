# DR-MANAUS | Active Patch Tracker

- **Patch:** `D4` (Destruição Planetária Parcial, Separação de Calotas e Dispersão de Anéis de Escombros Orbitais Keplerianos)
- **Status:** IMPLEMENTADO, APROVADO LOCALMENTE (1.671/1.671 testes, 638/638 regressões, typecheck OK, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-11T16:05:00-04:00

## Mudanças do Patch
1. `src/world/destruction/MacroBodyFractureService.ts`:
   - Serviço autoritativo de destruição macroscópica planetária (`MacroBodyFractureService`).
   - Cálculo analítico de elementos orbitais Keplerianos (energia orbital específica $\epsilon$, momento angular $\vec{h}$, vetor excentricidade $\vec{e}$, semieixo maior $a$, periapsis $r_p$, apoapsis $r_a$, inclinação $i$).
   - Classificação física rigorosa de trajetórias: `BOUND_ORBITAL_RING` ($e < 1, r_p \ge R_{\text{parent}}$), `SUB_ORBITAL_REENTRY` ($e < 1, r_p < R_{\text{parent}}$) e `HYPERBOLIC_ESCAPE` ($e \ge 1, \epsilon \ge 0$).
   - Detachamento de calotas/placas continentais com escavação de cavidade esférica profunda via `SubtractSphereEdit` no `PlanetVolumeEditStore`.
   - Agregação de anel/nuvem de escombros celestes (`CelestialDebrisRing`) com distribuição de massa em lei de potência $N(r) \propto r^{-2.5}$.
   - Disparo automático quando integridade da crosta cai abaixo do limiar crítico (`CRITICAL_CRUST_INTEGRITY_THRESHOLD = 0.35`).
   - Conservação estrita de massa planetária ($M_{\text{rem}} = M_0 - \sum M_{\text{frag}}$) e transição de estado para `'PARTIALLY_FRACTURED'`.
2. `src/player/powers/PowerSystem.ts`:
   - Adicionado hook `macroFracture(epicenter, capRadiusM, capDepthM, ejectionSpeedMps)` em `PowerHooks`.
3. `src/game/Game.ts`:
   - Instanciado `MacroBodyFractureService` acoplado ao `PlanetVolumeEditStore` e `GeomechanicalFractureService`.
   - Conectado hook `macroFracture` e telemetria de destruição em `universeDebug()`.
4. `tests/macro-body-fracture-service.test.ts`:
   - Suíte de 5 testes unitários validando classificação de órbitas de escombros, escavação de cavidade CSG e preservação de relevo esférico externo, gatilho de integridade crítica, conservação estrita de massa e isolamento multicorpo.
5. `docs/autonomous-development/SPEC-MASTER-TRACKER.md`:
   - Atualizado status de `DEST-06` (D4) para `IMPLEMENTED` e `DEST-07` (D5) para `NEXT_IN_PIPELINE`.
