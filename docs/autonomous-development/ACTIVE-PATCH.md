# DR-MANAUS | Active Patch Tracker

- **Patch:** `WGS84-MANAUS-03` — Paridade Sub-Decimétrica em Tiles Distantes (`SurfaceTileFrame`) e Material Único da Terra com `surfaceClass`, `ShallowWater`, Fresnel e Sun Glint (`05-MANAUS-FULL-WGS84-UNIFICATION.md` e `03-EARTH-SURFACE-BIOMES-OCEAN-ICE.md`)
- **Status:** IMPLEMENTED & VALIDATED LOCALLY (1.787/1.787 testes gerais, 638/638 regressões permanentes, 0 erros TypeScript, build Vite aprovado)
- **Branch:** `feat/universe-map`
- **SHA:** A ser gerado no commit
- **Atualizado:** 2026-11-16T14:11:00-04:00

## Mudanças do Patch WGS84-MANAUS-03

### 1. `src/world/spatial/SurfaceTileFrame.ts`:
- `getSceneMatrix()` e `localToEcef()` agora usam os passos de base da projeção legacy (`legacyLocalToEcef(legacyCentreX + 1, ...)` e `legacyLocalToEcef(..., legacyCentreZ + 1)`).
- Elimina o desvio acumulado de `6,90 m` norte-sul (`LEGACY_NORTH_SCALE = 1.00674`) ao longo de cada tile de 1.024 m, fazendo com que a base do prédio (`tileMatrix`), o asfalto da rua, a roda do veículo, a malha de terreno e o colisor curvo coincidam dentro de `< 5 cm` horizontais e `< 20 cm` verticais até nos cantos de tiles distantes (~16 km do anchor).

### 2. `src/world/planet/EarthLandMask.ts` e `src/world/planet/EarthGlobe.ts`:
- Implementada detecção determinística de plataforma costeira (`isCoastalShelfAt`) classificando águas costeiras em `EarthSurfaceClass.ShallowWater` com paleta `SURFACE_COLOURS.shallow`.
- `buildTileMesh` grava o atributo por vértice `surfaceClass` (`Float32BufferAttribute`, 1 componente) em todos os tiles do `EarthGlobe`.
- `EarthGlobe.buildMaterial` lê `attribute('surfaceClass', 'float')` em TSL dentro do **material único** do planeta, adicionando reflexo **Fresnel** e **specular Sun glint** exclusivamente sobre água (`Ocean = 0` e `ShallowWater = 4`), mantendo `Land = 1` e `Urban = 3` com aparência rugosa/fosca e `Ice = 2` com alto albedo.

### 3. Testes (`tests/wgs84.test.ts` e `tests/earth-surface-biomes-ocean-ice.test.ts`):
- `distant tile building base, road, vehicle wheel, ground and collider coincide within local tolerance (05-MANAUS-FULL-WGS84)`: valida coincidência no tile `9,-13` em `(0,0)`, `(512,512)` e `(980,980)`.
- `T_EARTH_SURFACE_05_TILE_SURFACE_CLASS_ATTRIBUTE_AND_SHALLOW_WATER`: valida atributo `surfaceClass` na geometria de `EarthGlobe` e classificação costeira `ShallowWater`.
