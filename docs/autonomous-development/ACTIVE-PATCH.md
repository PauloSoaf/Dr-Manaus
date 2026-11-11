# DR-MANAUS | Active Patch Tracker

- **Patch:** `D2` (Escavação Planetária Profunda e Túneis Volumétricos Contínuos)
- **Status:** IMPLEMENTADO, VALIDAÇÃO COMPLETA EM ANDAMENTO
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-11T15:45:00-04:00

## Mudanças do Patch
1. `src/world/destruction/PlanetExcavationService.ts`:
   - Serviço autoritativo de escavação planetária e perfuração contínua de túneis volumétricos (`PlanetExcavationService`).
   - Interseção analítica raio vs elipsoide planetário (`intersectRayPlanetEllipsoid`) determinando pontos de entrada e saída $A_{\text{entry}}$ e $B_{\text{exit}}$.
   - Suporte a túneis transplanetários completos (atravessando o diâmetro da Terra, Lua e Marte com o núcleo vazio $d > 0$) e poços/furos subterrâneos cegos com profundidade finita (`maxDepthM`).
   - Escavação de redes de cavernas e túneis subterrâneos multi-segmento interligando waypoints 3D arbitrários.
   - Preservação estrita do invariante de memória esparsa: armazena operações CSG mínimas sem expansão em grade voxel global.
   - Serialização e restauração completa de túneis em JSON via `serializePlanetVolumeEdits` / `deserializePlanetVolumeEdits`.
2. `src/world/planet/volume/PlanetVolumeRuntime.ts`:
   - Adicionada API `requestEditRegion(editId)` para demandar regiões ativas de chunks volumétricos afetadas por escavações.
3. `src/player/powers/PowerSystem.ts`:
   - Adicionado hook `excavate(origin, direction, radius, maxDepth)` para poderes direcionais e perfuração contínua.
4. `src/game/Game.ts`:
   - Instanciação de `PlanetExcavationService` acoplado ao `PlanetVolumeEditStore` e aos corpos do sistema ativo.
   - Conexão do hook `excavate` ao sistema de poderes e exposição de métricas em `universeDebug()`.
5. `tests/planet-excavation-service.test.ts`:
   - 6 testes unitários cobrindo interseção analítica, perfuração transplanetária, furos cegos, redes de cavernas, invariante de memória e persistência.
6. `docs/autonomous-development/SPEC-MASTER-TRACKER.md`:
   - Atualizado status de `DEST-04` (D2) de `DEFERRED` para `IMPLEMENTED`.
