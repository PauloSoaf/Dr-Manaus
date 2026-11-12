# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-02` (Clima e Biomas Determinísticos por Coordenada e Habitat Planetário)
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE (1.687/1.687 testes vitest, 638/638 regressões, typecheck 0 erros, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T11:35:00-04:00

## Mudanças do Patch
1. `src/world/life/PlanetaryBiomeService.ts`:
   - Serviço autoritativo de clima e classificação contínua de biomas planetários (`PlanetaryBiomeService`).
   - Termodinâmica determinística:
     - Gradiente latitudinal de insolação (equador mais quente, polos mais frios com queda de 35K a 80K).
     - Gradiente adiabático de altitude ($\approx 6.5\text{ K/km}$ escalonado pela pressão atmosférica).
     - Perturbação trigonométrica harmônica contínua livre de descontinuidades baseada em `climateSeed`.
   - Modelo de precipitação/umidade latitudinal (máximo equatorial ITCZ, cinturão árido subtropical a $\pm 25^\circ$, tempestades temperadas e secura polar).
   - Taxonomia de 25 biomas distribuídos entre marinhos (`deep-abyss`, `oceanic-shelf`, `coastal-waters`, `methane-sea`, `ammonia-basin`), estéreis/vácuo (`barren-rock`, `cratered-highlands`, `basalt-plains`, `vacuum-dust`, `extreme-cryo-ice`), hostis/vulcânicos (`magma-fields`, `sulfuric-wastes`, `scorched-crags`, `crystal-desert`), criogênicos (`tholin-plateaus`, `cryo-dunes`, `nitrogen-plains`) e vivos (`alien-rainforest`, `fungal-canopy`, `bioluminescent-wetlands`, `temperate-woodland`, `savanna-steppe`, `alien-taiga`, `subpolar-lichen`, `glacial-cap`).
   - Paletas de cores hexadecimais para terreno, rocha, folhagem e líquidos, além de densidade de vegetação e arquétipo de flora.
2. `src/world/planet/PlanetSurface.ts`:
   - Adicionado método opcional `biomeAt?(direction: Vec3): PlanetaryBiomeSample` em `PlanetSurfaceGenerator`.
3. `src/world/planet/ProceduralPlanetSurface.ts`:
   - Integração de amostragem de bioma por direção geocêntrica em `createProceduralPlanetSurface`.
4. `specs/universo-vivo/02-BIOMES-AND-CLIMATE.md`:
   - Especificação técnica completa de clima e biomas por habitat.
5. `tests/planetary-biome-service.test.ts`:
   - Suíte de 6 testes unitários cobrindo determinismo, gradientes térmicos de latitude/altitude, estratificação marinha batimétrica, mundos estéreis, mundos criogênicos de metano (Titã), matriz de Whittaker e integração direta na superfície procedural.
6. `docs/autonomous-development/CI-HISTORY.md` & `SPEC-MASTER-TRACKER.md`:
   - Registrado CI aprovado para VIVO-01 (`eaeab77`, 1.681 testes) e status `IMPLEMENTED` para VIVO-02.
