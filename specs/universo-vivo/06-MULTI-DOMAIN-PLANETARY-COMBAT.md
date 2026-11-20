# DR-MANAUS | VIVO-06: Combate Multi-Domínio com Alvos Planetários em PowerSystem e Game

## Status
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE
- **Data:** 2026-11-12
- **Milestone:** `VIVO-06`
- **Módulos Afetados:** `src/player/powers/PowerSystem.ts`, `src/game/Game.ts`, `src/world/life/AlienFaunaManager.ts`, `src/world/life/AlienFloraRenderer.ts`, `src/world/destruction/PlanetExcavationService.ts`.

---

## 1. Visão Geral e Arquitetura

O marco `VIVO-06` unifica o sistema de combate do Dr-Manaus em escala cósmica, permitindo que todas as habilidades ofensivas (`punch`, `kick`, `kineticStrike`, `meteorPunch`, `energy`, `laser`, `shockwave`) e de suporte (`reconstruct`) operem com coerência física e volumétrica completa tanto na Terra quanto em qualquer planeta, lua ou exoplaneta procedural do universo.

### 1.1 Unificação de Alvos Multi-Domínio
Em `PowerSystem.ts` e `Game.ts`:
- O hook `targets()` agrega de forma transparente:
  - Alvos civis, veículos e anomalias de Manaus (quando `manausSimulationActive`).
  - Alvos de fauna e criaturas alienígenas ativas (`AlienFaunaManager.targets`) em qualquer corpo celeste habitado.
- Os alvos compartilham a interface comum `Target` com tipo estendido `kind: 'creature'`.
- O cone de mira (`acquireTarget`) e o auto-lock priorizam criaturas de acordo com distância angular e tolerância de cone, permitindo disparos precisos em terceira pessoa.

### 1.2 Destruição e Splash Damage Unificados (`damage`)
Quando uma explosão, feixe ou impacto físico ocorre (`hooks.damage(point, radius, amount, deform)`):
1. **Dano em Estruturas Urbanas**: Em Manaus, danifica e desestabiliza edifícios via `DestructionSystem.damageAt()`.
2. **Erradicação de Flora Alienígena**: Remove instâncias de vegetação dentro do raio de destruição via `AlienFloraRenderer.destroyInRadius()`.
3. **Dano e Impulso em Fauna Alienígena**: Aplica dano em área e impulso radial a todas as criaturas vivas no raio via `AlienFaunaManager.damageInRadius()`.
4. **Crateras em Volumes Planetários**: Em corpos celestes com física local ativa, ataques de alta energia ($\ge 5000\text{ J}$ ou com flag `deform`) escavam crateras volumétricas subtraindo esferas no `PlanetVolumeEditStore` via `PlanetExcavationService.carveSphere()`.

### 1.3 Impactos Cinemáticos Pesados e Meteor Slam (`applyLocalImpact`)
Quando o Dr-Manaus aterrissa em velocidade extrema ($\ge 800\text{ m/s}$) ou executa um `meteorPunch` / `kineticStrike` em solo extraterrestre:
- A permissão de deformação `canDeformSurface` reconhece superfícies planetárias ativas.
- `applyLocalImpact(point, footprint)`:
  - Escava uma cratera volumétrica proporcional ao `craterRadiusM` do footprint via `carveSphere()`.
  - Destrói a flora ao redor da cratera.
  - Arremessa criaturas próximas radialmente de acordo com o impulso cinético do impacto.
  - Desencadeia `hitStop` e tremor de câmera coerentes.

### 1.4 Reconstrução Cósmica Unificada (`reconstruct`)
A habilidade cósmica `reconstruct` do Dr-Manaus recupera a integridade de todos os domínios:
- Restaura criaturas derrotadas, revivendo-as com saúde máxima no estado `'idle'`.
- Regenera espécimes de flora alienígena destruídos, permitindo que a vegetação procedimental ressurja.
- Reconstrói edifícios, pontes e estradas danificadas na cidade de Manaus.

---

## 2. Métodos e APIs Adicionados

### 2.1 `PlanetExcavationService`
```ts
/**
 * Carves a spherical impact crater or blast cavity on a celestial body.
 */
carveSphere(bodyId: string, centerBodyFixedM: BodyFixedPoint, radiusM: number): string
```

### 2.2 `AlienFaunaManager`
```ts
/**
 * Applies area damage and radial physical impulse to all creatures within radius.
 */
damageInRadius(center: Vector3, radiusM: number, damage: number, impulse = 20): number

/**
 * Applies damage and physical impulse to a creature when hit by Dr-Manaus powers.
 */
hit(id: string, force: number, damage?: number): boolean
```

### 2.3 `AlienFloraRenderer`
```ts
/**
 * Restores destroyed flora in a radius around center, allowing them to regrow.
 */
reconstruct(center: Vector3, radiusM: number): number
```

---

## 3. Verificação e Testes

A suíte `tests/planetary-combat-integration.test.ts` valida:
- `T_VIVO06_01_MULTI_DOMAIN_TARGET_INTEGRATION`: Entidades de fauna registradas como alvos com propriedades válidas de combate.
- `T_VIVO06_02_AREA_DAMAGE_AND_FAUNA_KNOCKBACK`: Dano em área, knockback radial e transição de estado (`knocked` / `defeated`).
- `T_VIVO06_03_FLORA_DESTRUCTION_AND_RECONSTRUCTION`: Erradicação de flora em zona de impacto e reconstituição determinística via `reconstruct`.
- `T_VIVO06_04_PLANETARY_VOLUME_CRATERING`: Criação e persistência de crateras esféricas em `PlanetVolumeEditStore`.
- `T_VIVO06_05_CELESTIAL_SURFACE_POWER_COMBAT_FLOW`: Fluxo completo de combate multi-domínio orquestrado por `Game.ts`.

