# DR-MANAUS | Active Patch Tracker

- **Patch:** `BUGS-02.5` — Unificação Completa do Frame WGS84 em Manaus e Saneamento de `SolarSystem` (`specs/dr-manaus-cosmic-night-specs/02-REMAINING-BUGS.md` e `05-MANAUS-FULL-WGS84-UNIFICATION.md`)
- **Status:** IMPLEMENTED & VALIDATED LOCALLY (1.785/1.785 testes gerais, 638/638 regressões permanentes, 0 erros TypeScript, build Vite aprovado)
- **Branch:** `feat/universe-map`
- **SHA:** A ser gerado no commit
- **Atualizado:** 2026-11-16T14:01:00-04:00

## Mudanças do Patch BUGS-02.5

### 1. `src/world/spatial/SurfaceFrameService.ts`:
- Adicionada `legacyPoseToRenderLocalMatrix(x, y, z, out)`: constrói matriz $4\times 4$ estritamente ortonormal e dextrógira ($\det = +1$, eixos `+X` Leste, `+Y` Cima, `+Z` Sul) no frame local de renderização WGS84.

### 2. `src/world/lod/HLODManager.ts` e `src/world/landmarks/LandmarkManager.ts`:
- Corrigido o sinal do terceiro eixo de base em modo curvo (`north` `-Z` causava determinante $-1$ e inversão de normais/rotações); ambos agora usam `legacyPoseToRenderLocalMatrix`.

### 3. `src/world/realcity/airport.ts` e `src/world/landmarks/largo/index.ts`:
- `createAirport` curva vértices e normais da pista, taxiways, pátio, terminal, hangares, torre e tanques após o registro de `AuthoredDestruction` quando `localManausPresentationMode() === 'curved'`.
- `LargoDistrict` roteia sua matriz raiz por `manausTileSceneMatrix('largo', 0, 0, this.group.matrix)`.

### 4. `src/entities/PopulationManager.ts`, `src/missions/MissionManager.ts` e `src/game/Game.ts`:
- `PopulationManager` e `MissionManager` projetam posições renderizadas por `SurfaceFrameService.legacyPointToRenderLocal` quando em modo curvo, mantendo a simulação e os colisores base no espaço legado.
- `Game.ts` propaga a posição descurvada (`updatedLegacyPos`) para `streamer`, `hlod`, `traffic`, `largo`, `landmarks`, `population`, `missions`, `airport.appendColliders` e `streamer.prepare`, além de converter alvos locais para `PowerSystem`.

### 5. `src/world/celestial/SolarSystem.ts`:
- Removido o estado mutável legado `dynamicBodies` / `setSystemBodies()`, tornando `bodies` imutável sobre `SOLAR_SYSTEM_BODIES` (`P1-03`).

### 6. `tests/wgs84.test.ts`:
- Adicionado teste `legacyPoseToRenderLocalMatrix builds a right-handed orthonormal basis that aligns with curved colliders` validando determinante $+1$ e coincidência exata com `legacyColliderToRenderLocal` no centro, Aeroporto, Ponta Negra e MUSA.
