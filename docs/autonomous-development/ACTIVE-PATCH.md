# DR-MANAUS | Active Patch Tracker

- **Patch:** `SOLAR-03` — Consumo do perfil visual unificado (`specs/dr-manaus-cosmic-night-specs/07-SOLAR-SYSTEM-COMPLETE.md`)
- **Status:** IMPLEMENTED & VALIDATED LOCALLY (typecheck aprovado, testes de perfil visual 4/4; suíte completa pendente deste patch)
- **Branch:** `feat/universe-map`
- **SHA:** A ser gerado no commit
- **Atualizado:** 2026-11-13T15:40:00-04:00

## Mudanças do Patch

### 1. `src/rendering/celestial/CelestialBodyVisualLayer.ts`:
- O renderer consulta `getPlanetVisualProfile` como fonte canônica de albedo e escalas de anéis.
- Perfis legados continuam fornecendo parâmetros de iluminação e apresentação específicos, sem duplicar a classificação visual.

### 2. `tests/wgs84.test.ts`:
- Verifica identidade do frame por tile, cache e transformação de collider.

### 3. `src/world/celestial/PlanetVisualProfile.ts`:
- Implementada a interface `PlanetVisualProfile`:
  - `bodyId: string`: Identificador do corpo celeste normalizado.
  - `surfaceType: 'rocky' | 'ice' | 'gas' | 'star'`: Classificação física de superfície.
  - `atmosphere: AtmosphereProfile`: Parâmetros de atmosfera (pressão em atm, scale height em m, espalhamento Rayleigh e névoas).
  - `rings?: RingProfile`: Dimensões em metros e fatores de escala de anéis planetários (raios interno/externo, opacidade analítica).
  - `terrain: TerrainProfile`: Topologia de relevo, limites de elevação em metros (`maxElevationM`, `minElevationM`), tipo de superfície e modo de pouso (`none`, `surface`, `photosphere`).
  - `albedo: readonly [number, number, number]`: Cores sRGB de refletância média.
- Implementada função de consulta e derivação determinística `getPlanetVisualProfile(bodyId: string): PlanetVisualProfile`:
  - Sol: `surfaceType: 'star'`, pouso na fotosfera, sem anéis.
  - Terra: `surfaceType: 'rocky'`, elevações canônicas (+8.848m Monte Everest, -11.034m Fossa das Marianas), atmosfera N2-O2 de 1 atm.
  - Lua: `surfaceType: 'rocky'`, crateras e relevo LRO (+10.786m, -9.174m), sem atmosfera.
  - Marte: `surfaceType: 'rocky'`, Olympus Mons (+21.287m), Hellas Planitia (-8.200m), atmosfera fina (0.006 atm).
  - Gigantes gasosos (Júpiter e Saturno): `surfaceType: 'gas'`, sem pouso em superfície sólida, camadas de nuvens.
  - Saturno: Anéis analíticos autênticos com raio interno de 75.335.000m ($1,25 \times R$) e raio externo de 138.616.400m ($2,30 \times R$).
  - Gigantes de gelo (Urano e Netuno): `surfaceType: 'ice'`, sem pouso sólido convencional.

### 4. `tests/cosmological-structure-u6.test.ts`:
- Verifica células densas na região Norma/Great Attractor e células vazias distantes.

### 5. `tests/planet-visual-profiles.test.ts` (4 Novos Testes):
- `T_PLANET_PROFILE_01_SOLAR_COVERAGE`: Cobertura de todos os 10 corpos principais do Sistema Solar e albedo RGB.
- `T_PLANET_PROFILE_02_SATURN_RINGS`: Dimensões físicas dos anéis de Saturno e relações de raio interno/externo.
- `T_PLANET_PROFILE_03_ATMOSPHERE_AND_TERRAIN`: Relevos canônicos da Terra, Lua e Marte com atmosferas correspondentes.
- `T_PLANET_PROFILE_04_GAS_GIANTS_CANNOT_LAND`: Bloqueio de pouso sólido em gigantes gasosos e pouso fotoférico no Sol.
