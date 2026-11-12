# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-05` (Scanner Cósmico de Espécies Alienígenas, Taxonomia e Persistência no Save)
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE (1.701/1.701 testes vitest, 638/638 regressões, typecheck 0 erros, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T11:56:00-04:00

## Mudanças do Patch
1. `src/world/life/CosmicSpeciesScanner.ts`:
   - Serviço de varredura cósmica de espécies alienígenas (`CosmicSpeciesScanner`).
   - Algoritmo de mira cônica angular ($< 23^\circ$) com alcance configurável (até 75m), selecionando espécimes de fauna e flora no campo de visão.
   - Nomenclatura binomial e taxonomia determinísticas geradas a partir do corpo celeste de origem e morfologia (ex: *Chitinus quadrupes var. titan*, *Lumina mycenis var. earth*).
   - Classificação biológica com categoria (`fauna`/`flora`), dieta (`herbivore`, `carnivore`, `omnivore`, `radiotrophic`, `chemotrophic`, `photosynthetic`), temperamento (`passive`, `skittish`, `defensive`, `apex-aggressive`) e escala de ameaça de 1 a 5.
   - Identificação de novas descobertas com persistência transacional em `SaveManager`.
2. `src/core/SaveManager.ts`:
   - Adicionada propriedade opcional `discoveredSpecies?: string[]` a `SaveData`.
   - Adicionados métodos de consulta e descoberta `isSpeciesDiscovered(speciesId)` e `discoverSpecies(speciesId)`.
3. `src/game/Game.ts`:
   - Instanciado `speciesScanner` acoplado ao `SaveManager`.
   - Telemetria de depuração no HUD exibindo contadores de espécies catalogadas e fauna ativa.
4. `specs/universo-vivo/05-SPECIES-SCANNER-AND-ATLAS.md`:
   - Especificação técnica completa do scanner cósmico e catálogo taxonômico.
5. `tests/cosmic-species-scanner.test.ts`:
   - Suíte de 4 testes unitários cobrindo taxonomia determinística de fauna e flora, mira cônica angular e persistência de descobertas no `SaveManager`.
6. `docs/autonomous-development/CI-HISTORY.md` & `SPEC-MASTER-TRACKER.md`:
   - Registrado CI aprovado para VIVO-04 (`f037141`, 1.697 testes) e status `IMPLEMENTED` para VIVO-05.
