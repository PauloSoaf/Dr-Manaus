# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-17 a VIVO-19` (Correção Real de Gameplay, Ruptura Planetária Visível, Integridade dos Referenciais de Vida e Persistência Determinística)
- **Status:** IMPLEMENTED & LOCAL VALIDATION PASSED (1.755/1.755 testes unitários, 638/638 regressões, 0 erros TypeScript, build de produção aprovado)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T14:25:00-04:00

## Mudanças do Patch

### VIVO-17: Máquina de Estados de Ruptura, Suporte Orbital e Referenciais de Vida
1. `src/player/powers/PowerSystem.ts`:
   - Implementada máquina de estados estrita para o poder `planetRupture`: `idle -> charging -> ready -> executing -> cooldown -> idle`.
   - Tecla 9 seleciona o poder sem disparar ruptura imediata.
   - Segurar o gatilho (`isHolding`) por 2,5s acumula carga; soltar antes do tempo cancela o carregamento.
   - Proteção de disparo único por ativação (`ruptureNeedsRelease = true`), impedindo que manter a tecla pressionada dispare um segundo ciclo após o cooldown.
   - Ativação de poderes autorizada durante voo orbital (`powers.update` executado quando fora de hipercruzeiro/viagem interestelar).
   - Resolução de alvo prioritária: alvo bloqueado na navegação (`getTargetBodyId`) tem precedência sobre o corpo dominante sob os pés (`getActiveBodyId`).
2. `src/world/life/CosmicAnomaliesAndRuinsManager.ts`:
   - Corrigida a geração de ruínas: conversão do raio geocêntrico (~6.371.000m) para coordenadas locais ENU no plano tangente do jogador.
   - Colossos posicionados na cota do terreno local ENU.
   - Adicionado método `clear()` e desanexação de nó raiz em `dispose()`.
3. `src/game/Game.ts`:
   - Criado nó `activePlanetaryLifeRoot` (filho de `actorRoot`), desacoplando entidades de vida (flora, fauna, assentamentos, ruínas, perigos) de `worldRoot` (`earth.manausSurfaceAnchor`).
   - Limpeza transacional de entidades de ecossistema (`clearEcosystemEntities`) em handoffs celestes e transições para o espaço profundo.
4. `tests/vivo-17-ecosystem-and-power.test.ts`:
   - Suíte dedicada validando máquina de estados, proteção de disparo único e ancoramento correto no referencial ativo.

### VIVO-18: Apresentação Visual da Ruptura Planetária e Estado Físico Destruído
1. `src/rendering/celestial/PlanetaryRupturePresentation.ts`:
   - Implementadas 7 fases visuais observáveis: fissuras na crosta intacta, brilho incandescente do núcleo, separação de chunks 3D de crosta (`InstancedMesh`), ocultação do globo intacto, deriva radial de fragmentos, onda de choque esférica expansiva e anel kepleriano de destroços persistente.
   - Suporte a carregamento direto de corpo previamente destruído salvo em disco (`loadPersistedRupture` direto para fase 7).
   - Suporte a restauração cósmica reversível (`restore`).
2. `src/game/Game.ts`:
   - Ocultação e supressão visual do globo planetário intacto para corpos com ruptura confirmada.
   - Bloqueio de captura e pouso (`surfaceReadyForLanding`) e física de superfície (`bindSurfacePhysics`) em corpos destruídos.
   - Transição segura caso a Terra seja destruída enquanto o jogador estiver em Manaus: elevação de emergência para `Flight` a +2500m no distrito `DESTROÇOS`.
3. `src/world/exploration/CosmicAtlasModel.ts`:
   - Exibição de `[MUNDO EM RUÍNAS - CINTURÃO DE DESTROÇOS]` no Atlas para corpos destruídos.
   - Métodos de invalidação de cache (`invalidateCache`).
4. `tests/vivo-18-planetary-rupture-presentation.test.ts`:
   - Validação da progressão das 7 fases, ocultação de malha intacta e integridade do Atlas.

### VIVO-19: Persistência Determinística, Reconstrução e Desempenho
1. `src/world/destruction/MacroBodyFractureService.ts`:
   - Substituído `Date.now()` em IDs de corte CSG por identificadores determinísticos `${plan.planId}:rupture_cap_${i}`.
2. `tests/vivo-19-deterministic-restoration-and-performance.test.ts`:
   - Validação da reconstrução cósmica integral (remoção de cortes, restauração de globo, retorno ao status normal de pouso e Atlas).
   - Validação de IDs determinísticos de corte CSG entre sessões.
