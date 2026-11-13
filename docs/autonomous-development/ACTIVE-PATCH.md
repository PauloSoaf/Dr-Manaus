# DR-MANAUS | Active Patch Tracker

- **Patch:** `GRAV-01` — Fontes de Gravidade Celeste, Regime Zero-G Inercial e Dinâmica Orbital em `InterplanetaryController` (`specs/dr-manaus-cosmic-night-specs/06-ZERO-G-AND-GRAVITY-DOMAINS.md`)
- **Status:** IMPLEMENTED & VALIDATED LOCALLY (1.766/1.766 testes gerais, 638/638 regressões permanentes, 0 erros TypeScript, build Vite 100% verde)
- **Branch:** `feat/universe-map`
- **SHA:** A ser gerado no commit
- **Atualizado:** 2026-11-13T12:26:00-04:00

## Mudanças do Patch

### 1. `src/world/celestial/GravitySource.ts` (Novo Módulo Canônico):
- Implementada a interface `GravitySource`:
  - `id: string`: Identificador do corpo celeste.
  - `frameId: string`: Referencial físico do corpo.
  - `mu: number`: Parâmetro gravitacional padrão $\mu = G \cdot M$ ($\text{m}^3/\text{s}^2$).
  - `collisionRadiusM: number`: Raio equatorial de colisão física.
  - `influenceRadiusM: number`: Raio da esfera de influência (Laplace/Hill).
  - `accelerationAt(positionM: Vec3): Vec3`: Função de aceleração gravitacional vetorial baseada na lei do inverso do quadrado $\vec{a} = -\mu \frac{\vec{r}}{r^3}$ com suavização geométrica no núcleo.
- Implementado helper `createPointMassGravitySource` e gerador de fonte a partir de `CelestialBody` (`gravitySourceFromBody`).
- Implementadas funções utilitárias:
  - `netGravityAcceleration(sources, pos)`: Soma vetorial N-corpos.
  - `dominantGravitySource(sources, pos)`: Identificação da fonte de atração primária.
  - `isZeroG(sources, pos, threshold)`: Verificação do threshold inercial de gameplay (`GAMEPLAY_ZERO_G_ACCEL_THRESHOLD = 1e-4 m/s^2`).

### 2. `src/world/travel/InterplanetaryController.ts`:
- Adicionado suporte à aceleração gravitacional celeste no método `update()`.
- Se fontes de gravidade (`context.gravitySources`) ou aceleração direta (`context.netGravityMps2`) estiverem presentes, a aceleração gravitacional é integrada ao vetor de velocidade relativa e do sistema.
- Se nenhuma fonte estiver presente ou o jogador estiver longe de corpos celestes (zero-g), a velocidade é estritamente conservada segundo a primeira lei de Newton (deriva inercial pura sem drag implícito e sem queda em -Y).
- A desaceleração (`brake`) permanece estritamente vinculada a uma ação/poder ativo do jogador, nunca a atrito atmosférico artificial no vácuo espacial.
- Expostos métodos de consulta: `gravityAt(pos, context)`, `isZeroG(pos, context)` e `dominantGravity(pos, context)`.

### 3. `src/world/travel/TravelDomain.ts`:
- Expandido `TravelContext` com campos tipados `gravitySources?: readonly GravitySource[]` e `netGravityMps2?: Vec3`.

### 4. `tests/zero-g-and-gravity-domains.test.ts` (7 Novos Testes):
- `T_ZERO_G_01_NO_SOURCE_VELOCITY_PRESERVED`: Conservação inercial sem arrasto nem queda ao soltar comandos.
- `T_ZERO_G_02_EARTH_ACCELERATION_POINTS_INWARD`: Aceleração da Terra orientada diretamente ao baricentro com módulo $\frac{\mu}{r^2}$.
- `T_ZERO_G_03_INVERSE_SQUARE_LAW_DOUBLE_DISTANCE`: Validação empírica da lei de gravitação universal ao dobrar a distância ($\approx \frac{1}{4}$).
- `T_ZERO_G_04_MOON_DOMINANT_NEARBY`: Predomínio do campo lunar em sua esfera de influência.
- `T_ZERO_G_05_ZERO_G_THRESHOLD_AND_IS_ZERO_G`: Classificação binária do estado de microgravidade para a física do jogador.
- `T_ZERO_G_06_QUALITATIVE_ORBITAL_MOTION`: Estabilidade de órbita circular qualitativa ($v = \sqrt{\mu / r}$) com desvio radial $< 0,5\%$.
- `T_ZERO_G_07_SYSTEM_COORDINATES_SEPARATE_FROM_LOCAL`: Coordenadas astronômicas em float64 preservadas fora do PhysicsWorld local.
