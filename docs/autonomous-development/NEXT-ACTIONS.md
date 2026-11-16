# DR-MANAUS | Next Actions & Backlog Queue

## 1. Fila Priorizada de Execução Autônoma

1. **[EM PUBLICAÇÃO] `EARTH-DETAIL-RELIEF` (`P1-04` & `P1-07` — `02-REMAINING-BUGS.md`)**
   - Relevo continental hierárquico sub-grid (`hierarchicalElevationAt`) em `EarthElevation.ts` / `EarthGlobe.ts` e progressão contínua da cor do céu com a altitude (`skyColorAtAltitude`) em `Atmosphere.ts`.
   - Status: Implementado e validado localmente (`1.789/1.789` testes gerais, `638/638` regressões, build limpo). Publicando commit na branch `feat/universe-map`.

2. **[PRÓXIMA AÇÃO IMEDIATA] `ACCEPTANCE-ROUTE-01` (`16-TESTS-AND-ACCEPTANCE.md` & `15-CLEAN-CODE-ARCHITECTURE.md`)**
   - Implementar suíte automatizada de rota cósmica de longa sessão (`Manaus -> Moon -> Mars -> outer Solar System -> Milky Way sector -> external Milky Way -> M31 approach -> Great Attractor scale -> horizon representation -> return to Manaus`) validando limites de residência, ausência de coordenadas astronômicas brutas em buffers Float32 e invariantes de camada matemática pura (sem imports de Three.js em módulos matemáticos).
