# DR-MANAUS | Active Patch Tracker

- **Patch:** `BUGS-02.3` — Fachada WGS84 no transform de tiles Manaus (`specs/dr-manaus-cosmic-night-specs/02-REMAINING-BUGS.md`)
- **Status:** IMPLEMENTED & VALIDATED LOCALLY (1.784/1.784 testes gerais, 638/638 regressões, 0 erros TypeScript, build Vite aprovado)
- **Branch:** `feat/universe-map`
- **SHA:** A ser gerado no commit
- **Atualizado:** 2026-11-13T16:25:00-04:00

## Mudanças do Patch BUGS-02.3

- `SurfaceFrameService` agora invalida frames quando o centro do tile muda.
- O cache usa LRU bounded (limite configurável, padrão 512) para evitar crescimento indefinido.
- `ManausSurfacePresentation` resolve matrizes de tile pela fachada compartilhada, sem criar frames diretamente.
- `tests/wgs84.test.ts` cobre invalidação, limite, retenção e o caminho de apresentação.

## Mudanças do Patch

### 1. `src/rendering/celestial/CelestialBodyVisualLayer.ts`:
- `PlanetVisualProfile` só é aplicado aos IDs presentes em `SOLAR_BODY_PROFILES`.
- Mundos procedurais preservam albedo, anéis, bandas, haze e demais parâmetros determinísticos do `CelestialBodyProfile`.

### 2. `src/rendering/celestial/PlanetaryRupturePresentation.ts`:
- Cada `bodyId` possui meshes, materiais, posição e estado visual independentes.
- Restauração remove somente a sessão do corpo solicitado; múltiplos planetas podem permanecer destruídos.
- Posições são atualizadas individualmente no frame de renderização.

### 3. `src/game/Game.ts` e `src/player/powers/PowerSystem.ts`:
- O globo permanece visível durante as fases iniciais mesmo após o save registrar a ruptura.
- Posições de ruptura são convertidas por `RenderSpaceService`.
- A entrada pública de ruptura não ignora mais a carga de 2,5 segundos.

### 4. Testes:
- `tests/planet-visual-profiles.test.ts`: diversidade de três mundos procedurais e preservação de anéis.
- `tests/vivo-18-planetary-rupture-presentation.test.ts`: sessões simultâneas e restauração isolada.

### 5. Histórico de SOLAR-02:
- `src/world/celestial/PlanetVisualProfile.ts` permanece como contrato canônico:
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
