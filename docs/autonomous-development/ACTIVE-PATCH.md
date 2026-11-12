# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-01` (Sementes de Canal Ortogonais Determinísticas e Perfil de Biosfera Planetária)
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE (1.681/1.681 testes vitest, 638/638 regressões, typecheck OK, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T11:28:00-04:00

## Mudanças do Patch
1. `src/world/life/PlanetaryBiosphere.ts`:
   - Geração de canais de semente ortogonais independentes (`deriveSeedChannels`): `climateSeed`, `lifeSeed`, `floraSeed`, `faunaSeed`, `factionSeed` a partir do `bodyId` e `systemSeed`.
   - Perfil de biosfera determinístico (`generatePlanetaryBiosphere` / `PlanetaryBiosphereProfile`):
     - Habitabilidade (`habitabilityScore` 0-1) e tiers de vida (`sterile`, `microbial`, `vegetative`, `fauna`, `civilized`).
     - Bioquímica de base (`carbon`, `silicon`, `ammonia`, `methane-solvent`, `prebiotic-none`).
     - Perfis canônicos para corpos do Sistema Solar (Terra, Marte, Titã, Lua, Mercúrio, Vênus, Sol) e classificação paramétrica para qualquer corpo procedural.
2. `src/world/celestial/CelestialBodyProfile.ts`:
   - Adicionada propriedade opcional `biosphere?: PlanetaryBiosphereProfile` em `WorldEnvironment`.
   - `bodyProfile()` resolve deterministicamente o perfil de biosfera para qualquer corpo celeste com ambiente.
3. `src/world/celestial/SystemGenerator.ts`:
   - Estrela central, planetas e luas procedurais recebem profiles com `biosphere` sem alterar o fluxo PRNG do gerador orbital.
4. `src/world/exploration/CosmicAtlasModel.ts`:
   - Cache de metadados planetários (`bodyMetadataCache`) e entradas de consulta (`CosmicAtlasEntry`) expõem `biosphere`.
5. `specs/universo-vivo/00-ROADMAP-UNIVERSO-VIVO.md` & `specs/universo-vivo/01-BIOSPHERE-AND-SEEDS.md`:
   - Especificação e roadmap completo da expansão Universo Vivo.
6. `tests/planetary-biosphere-profile.test.ts`:
   - 5 testes cobrindo derivação determinística e ortogonal de canais, perfis canônicos (Terra habitável, Lua estéril, Titã microbiana com solvente de metano), classificação procedural, e imutabilidade do stream PRNG estelar/planetário.
