# DR-MANAUS | Active Patch Execution

## 1. Identificação do Patch
- **Patch ID:** `EARTH-DETAIL-RELIEF` (`P1-04` & `P1-07`)
- **Título:** Relevo continental hierárquico sub-grid para a Terra (`hierarchicalElevationAt`) e progressão contínua da cor do céu com a altitude (`skyColorAtAltitude`)
- **Status:** `IMPLEMENTED`
- **Branch Alvo:** `feat/universe-map`

---

## 2. Escopo Técnico Implementado
1. **Relevo Continental Hierárquico Sub-Grid (`src/world/planet/EarthElevation.ts`, `EarthSurface.ts`, `EarthGlobe.ts`, `P1-04`)**:
   - Implementada `hierarchicalElevationAt(latRad, lonRad, lodLevel)` que preserva exatamente o modelo canônico NOAA ETOPO5 em `lodLevel <= 5` e adiciona micro-topografia multi-oitava determinística sobre `Land` e `Ice` em `lodLevel >= 6`.
   - Mantém `0 m` sobre `Ocean`, `ShallowWater` e `Urban` (região de Manaus) em todos os níveis de LOD para garantir encaixe sem costuras com a cidade curva.
   - Integrada em `EarthSurfaceGenerator.heightAtLod` e em `buildTileMesh` (`EarthGlobe.ts`).
2. **Progressão Contínua de Cor Atmosférica por Altitude (`src/rendering/Atmosphere.ts`, `Game.ts`, `P1-07`)**:
   - Implementada `skyColorAtAltitude(altitudeM, out)` com transição monotônica:
     - `0–8 km`: azul troposférico (`#4e8bb2`);
     - `8–25 km`: azul estratosférico profundo (`#1d54a0`);
     - `25–60 km`: azul marinho mesosférico (`#07204b`);
     - `60–100 km+`: vácuo negro (`#010206`).
   - Acoplado `this.atmosphere.atmosphereWeight = state.atmosphereWeight` no loop de transição da Terra em `Game.ts`.

---

## 3. Validação Local
- **TypeScript (`npx tsc --noEmit`):** 0 erros
- **Testes Direcionados:** `tests/earth-surface-biomes-ocean-ice.test.ts` (`6/6 pass`), `tests/earth-altitude-transition.test.ts` (`8/8 pass`), `tests/earth-globe.test.ts` (`12/12 pass`)
- **Suíte Geral (`npm test`):** `1.789/1.789 pass`
- **Suíte de Regressão (`npm run test:regression`):** `638/638 pass`
- **Build de Produção (`npm run build`):** `built` sem erros
