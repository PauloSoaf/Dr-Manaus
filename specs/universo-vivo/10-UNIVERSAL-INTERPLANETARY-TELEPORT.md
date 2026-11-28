# DR-MANAUS | VIVO-10: Teleporte Universal Interplanetário e Intergaláctico Seguro

## Status
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE
- **Data:** 2026-11-12
- **Milestone:** `VIVO-10`
- **Módulos Afetados:** `src/world/travel/UniversalTeleportService.ts`, `src/world/travel/UniversalNavigationTarget.ts`, `src/world/spatial/AnalyticalSurfaceIntersection.ts`.

---

## 1. Visão Geral e Arquitetura

O marco `VIVO-10` completa a infraestrutura de teleporte cósmico e interplanetário instantâneo do Dr-Manaus (`UniversalTeleportService`), garantindo:
1. Pouso direto e seguro na superfície de Marte e em qualquer planeta procedural gerado em qualquer sistema estelar ou galáxia.
2. Handoff transacional com preparação de sistema e galáxia (`prepareSystem`).
3. Resolução analítica de mira em Estágio 2 para Marte e corpos procedurais sob o jogador.
4. Rollback transacional atômico de 100% de todo o estado em caso de cancelamento, coordenadas inválidas ou falha de destino.

### 1.1 Pouso Direto em Superfície Planetária
- Para a Terra:
  - Se dentro de Manaus: pousa nos colliders urbanos ou terreno compilado com altura segura.
  - Se fora de Manaus: gera frame geodético ENU dinâmico `earth/surface/${lat}_${lon}` ancorado em ECEF.
- Para a Lua:
  - Ancorado em `moon/fixed` com raio esférico canônico e frame geodético.
- Para Marte:
  - Ancorado em `mars/fixed` utilizando `MARS_RADIUS_EQUATORIAL_M`, gerando frame dinâmico `mars/surface/${lat}_${lon}`.
- Para Corpos Procedurais (Exoplanetas, Luas Alienígenas):
  - Consulta o perfil do corpo celeste e seu raio equatorial.
  - Assegura o frame de rotação fixa `${bodyId}/fixed`.
  - Gera frame ENU dinâmico de superfície `${bodyId}/surface/${lat}_${lon}` orientado pelos vetores Leste, Normal e Norte.
  - Garante memória limitada através da política FIFO de descarte para os 32 frames mais antigos.

### 1.2 Transição Inter-Sistemas e Intergaláctica
Quando o alvo de teleporte reside em um sistema estelar diferente do atual (`target.systemId !== universe.address.systemId`):
- O serviço empacota um `UniversalNavigationTarget` canônico com endereço de universo estruturado.
- Invoca o hook `prepareSystem(navTarget)` do materializador de sistemas.
- Executa o commit transacional, carregando os corpos celestes e frames do sistema de destino antes de ancorar o jogador.

### 1.3 Rollback Transacional Atômico
Antes de iniciar qualquer mutação no runtime ou no jogador:
- O serviço captura uma fotografia atômica de rollback:
  - Frame de referência anterior (`universe.player.frame`).
  - Posição e orientação no frame (`universe.player.position`, `universe.player.orientation`).
  - Endereço cosmológico (`universe.address`).
  - Posição e velocidade no espaço local do jogador (`player.position`, `player.velocity`).
- Se qualquer exceção for lançada (corpo não encontrado, coordenada NaN, erro de carregamento ou sinal abortado):
  - Restaura instantaneamente todos os valores originais.
  - Cancela qualquer estado flutuante.
  - Retorna `{ success: false, message: ... }` sem corromper o estado do jogo.

---

## 2. Verificação e Testes

A suíte `tests/universal-teleport-interplanetary.test.ts` valida:
- `T_VIVO10_01_MARS_SURFACE_TELEPORT`: Pouso direto em Marte com frame de superfície e altitude segura.
- `T_VIVO10_02_PROCEDURAL_PLANET_SURFACE_TELEPORT`: Pouso direto em corpos procedurais com resolução esférica.
- `T_VIVO10_03_CROSS_SYSTEM_HANDOFF_WITH_PREPARE_SYSTEM`: Handoff entre sistemas estelares distintos.
- `T_VIVO10_04_TRANSACTIONAL_ROLLBACK_ON_INVALID_DESTINATION`: Rollback completo e exato quando o destino falha.
- `T_VIVO10_05_STAGE_2_MARS_AND_PROCEDURAL_AIM_RESOLUTION`: Resolução analítica em Estágio 2 a partir da órbita.

