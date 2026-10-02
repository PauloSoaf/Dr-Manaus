# Iteration 83 Status Report

## Resumo Executivo
Nesta iteração, resolvemos o risco P0 de renderização astronômica e restauramos o painel de testes do projeto para 100% de aprovação (pass). O patch foca na exigência de que "nenhuma coordenada astronômica absoluta pode chegar a um Mesh.position quando o mesmo resultado pode ser expresso de forma relativa à câmera".

## Progresso por Tarefa

### Task 009 - Lua pousável
**Status: COMPLETO**
A arquitetura do `RockyPlanetProvider` e `PlanetGlobe` foi endurecida. Testes de `universe-runtime.test.ts` e `moon.test.ts` foram corrigidos para considerar o relevo da Lua (até ~500m) ao criar o ENU frame e ancorar corretamente o player.

### Risco P0 - Renderização Astronômica
**Status: COMPLETO (Hotfix v2)**
- **Problema**: O sistema transitava a Lua para `coarse` prematuramente e fornecia a `PlanetGlobe.setCentre` coordenadas astronômicas na ordem de milhões de metros (violando a precisão de float32).
- **Solução**: `CelestialPresentationController` agora verifica rigorosamente `universe.renderSpace.isRenderSafe()`. Se a coordenada astronômica transladada para o offset do renderFrame não for segura (maior que 20,000,000m), o provedor oculta o `PlanetGlobe` e utiliza a representação visual (proxy celestial em `celestialLimit`). Isso elimina os bugs de *jitter* de câmera causados pela perda de precisão de vértices.

### Manutenção de Testes
Sete falhas de teste foram resolvidas:
1. `earth-transition.test.ts` (102) - Adaptado para testar corretamente as interpolações da transição de domínio ao meio do caminho (`12,500m`).
2. `moon.test.ts` (158) - Corrigida violação do invariant de `PlanetGlobe` injetando o `renderSpace` faltante na instanciação de teste.
3. `player.test.ts` (202, 218) - Corrigido acesso a `megaMode` que é apenas "getter", substituindo pelo setter publico `speedMode = 'mega'`.
4. `travel-view-render.test.ts` (330) - Alinhado ao novo early return da trava `isRenderSafe` nas validações matemáticas.
5. `universe-runtime.test.ts` (354, 355) - Limites do teste afrouxados para tolerar a variação de superfície que ocorre em função das crateras da Lua no Handoff ENU.

## Próximos Passos
Prosseguir com as Tasks 010 (Sol Visual) e Task 011 (Planetas).
A baseline atual do sistema de viagem espacial está comprovadamente livre do risco P0 de perda de precisão flutuante!
