# DR-MANAUS | Active Patch Tracker

- **Patch:** `U7` + `Cosmic Target Hardening` (Clean Architecture & World-Model Isolation)
- **Status:** CONCLUÍDO, PUBLICADO E CI APROVADO
- **Branch:** `feat/universe-map`
- **Data/Hora:** 2026-11-11T10:13:00-04:00

## Modificações do Patch
1. `src/world/travel/UniversalTeleportService.ts`:
   - Serviço central unificado de teleporte sem limites artificiais de alcance ($\pm 100\text{ km}$ e $2500\text{ m}$ removidos como regras universais).
   - Cadeia determinística de resolução em 4 estágios: colisor local carregado (`LOCAL_AIM_RAYCAST_M = 2500 m`), superfície analítica do corpo ativo, alvo angular celeste, e alvo armado / formulário de coordenadas.
   - Handoff atômico transacional: sincronização simultânea de endereço `UniverseAddress`, estado de navegação, referencial espacial, posição lógica, `TravelDomain`, origem flutuante e `PlayerController`.
   - Gerenciamento de memória com reciclagem automática de referenciais dinâmicos de superfície (`MAX_DYNAMIC_SURFACE_FRAMES = 32`).
   - Cancelamento limpo via `AbortSignal` com preservação estrita do estado de origem em caso de aborto.
2. `src/world/spatial/AnalyticalSurfaceIntersection.ts`:
   - Interseção analítica raio vs elipsoide WGS84 da Terra em coordenadas ECEF, com mapeamento geodésico fechado sem streaming prévio da rota.
   - Interseções analíticas raio vs esfera para a Lua ($R = 1.737.400\text{ m}$) e elipsoide para Marte.
3. `src/world/travel/CelestialAngularPicker.ts`:
   - Seleção angular de corpos celestes diretamente do runtime celeste por vetor de direção, raio angular aparente e cone de retículo, sem colisão de malhas 3D.
4. `src/world/streaming/GlobalStreamingScheduler.ts`:
   - Adicionada API `prepareDemands(demands, signal)` para carregamento crítico de destinos antes da transição.
5. `src/player/powers/PowerSystem.ts`, `src/game/Game.ts` e `src/ui/HUD.ts`:
   - Integração da tecla `E`, do HUD e do mapa ao `UniversalTeleportService`.
   - Remoção de checagem restritiva de `discovered` para coordenadas e URIs `drm:v1://`.
6. `tests/universal-teleport-service.test.ts`:
   - Suíte de 14 testes automatizados cobrindo os 4 níveis de resolução, teleporte geodésico na Terra e corpos do sistema solar, preservação exata de `BigInt`, política de buracos negros, cancelamento e limite de memória.
7. Documentação técnica:
   - `docs/world/15-status.md`
   - `docs/world/53-status-U7-INFINITE-TELEPORT-HANDOFF.md`

## Validações
- `node --import tsx --test tests/universal-teleport-service.test.ts`: PASS (14/14)
- Suíte completa de marcos recentes e coordenadas: PASS (62/62)
- `npm run typecheck`: PASS (0 erros)
- `npm run build`: PASS (Vite 8.3.0)
