# DR-MANAUS | Active Patch Tracker

- **Patch:** `EARTH-01` — Classificação Determinística da Superfície Terrestre, Biomas, Oceano, Calotas de Gelo e Manaus Urbano (`specs/dr-manaus-cosmic-night-specs/03-EARTH-SURFACE-BIOMES-OCEAN-ICE.md`)
- **Status:** IMPLEMENTED & VALIDATED LOCALLY (1.759/1.759 testes gerais, 638/638 regressões permanentes, 0 erros TypeScript, 6/6 testes Playwright no navegador)
- **Branch:** `feat/universe-map`
- **SHA:** A ser gerado no commit
- **Atualizado:** 2026-11-13T12:20:00-04:00

## Mudanças do Patch

### 1. `src/world/planet/EarthLandMask.ts`:
- Adicionado enum canônico `EarthSurfaceClass`:
  - `Ocean = 0`: Águas profundas oceânicas.
  - `Land = 1`: Cobertura vegetal/continental verde.
  - `Ice = 2`: Calotas de gelo permanentes e geleiras continentais/polares.
  - `Urban = 3`: Mancha urbana de Manaus.
  - `ShallowWater = 4`: Plataforma costeira / águas rasas.
- Implementada função pura e determinística `classifyEarthSurface(latRad, lonRad): EarthSurfaceClass`:
  - Manaus definida por bounding box geodésico de alta resolução (`[-3.40°, -2.86°]` lat, `[-60.30°, -59.76°]` lon) -> `EarthSurfaceClass.Urban`.
  - Calotas continentais de gelo: Antártica ($< -60^\circ$ lat), Groenlândia ($[60^\circ, 84^\circ]\text{N}$ e $[-60^\circ, -20^\circ]\text{W}$) e ilhas árticas ($> 78^\circ\text{N}$) -> `EarthSurfaceClass.Ice`.
  - Banquisas e plataformas de gelo polar no oceano ($< -75^\circ$ ou $> 84^\circ$) -> `EarthSurfaceClass.Ice`.
  - Terras emersas restantes -> `EarthSurfaceClass.Land`.
  - Oceanos restantes -> `EarthSurfaceClass.Ocean`.
- Adicionada paleta urbana `urban: [0.320, 0.340, 0.300]` em `SURFACE_COLOURS`.
- Atualizado `surfaceColour` para derivar as cores primárias diretamente de `classifyEarthSurface`.

### 2. `src/world/planet/EarthSurface.ts`:
- Exposta a API `classAt(direction: Vec3): EarthSurfaceClass` no objeto canônico `EarthSurfaceGenerator`.
- Exportado o tipo enum `EarthSurfaceClass`.

### 3. `tests/earth-surface-biomes-ocean-ice.test.ts`:
- Suíte dedicada cobrindo:
  - `T_EARTH_SURFACE_01_CLASSIFICATION_DETERMINISM`: Garantia de determinismo e estabilidade de amostragem.
  - `T_EARTH_SURFACE_02_REGIONAL_CLASSES`: Cobertura correta da Amazônia (`Land`), Atlântico (`Ocean`), Antártica (`Ice`), Groenlândia (`Ice`) e Manaus (`Urban`).
  - `T_EARTH_SURFACE_03_COLOUR_CONSISTENCY`: Coerência entre classes e paletas de cores sRGB.
  - `T_EARTH_SURFACE_04_SURFACE_ADAPTER_INTEGRATION`: Integração de `EarthSurfaceGenerator.classAt` e `colourAt` a partir de vetores de direção 3D.
