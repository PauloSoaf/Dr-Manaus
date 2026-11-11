# Status: Milestone U7 · Teleporte Universal Infinito e Handoff Seguro de Destino

## Resumo da Entrega
Implementação completa da arquitetura de teleporte universal e handoff atômico definida nas especificações `specs/dr-manaus-universal-map-teleport-specs-v2/05-INFINITE-TELEPORT.md` e `06-DESTINATION-PREPARATION-HANDOFF.md`.

O sistema substitui o antigo raycast limitado a 2,5 km e as restrições arbitrárias ($\pm 100\text{ km}$) por uma cadeia determinística de quatro resolvedores e um serviço unificado (`UniversalTeleportService`) com transações atômicas, cancelamento seguro e memória estritamente limitada.

---

## 1. Cadeia de Resolução em Quatro Níveis (Resolver Order)
A tecla `E`, o botão `TRANSLOCAR` do mapa, o formulário de coordenadas e o menu de marcos convergem para o mesmo serviço:

1. **Colisor Local Carregado (`LOCAL_AIM_RAYCAST_M = 2500 m`)**:
   - Consulta direta de física contra colisores em cena.
   - Pouso seguro com cálculo de folga de solo (`PhysicsWorld.safeLanding`).
2. **Superfície Analítica do Corpo Ativo (Analytical Surface)**:
   - **Terra WGS84**: Interseção analítica raio vs elipsoide WGS84 ($a = 6.378.137\text{ m}, b = 6.356.752,31\text{ m}$) em coordenadas ECEF. Sem necessidade de pré-carregar malhas ao longo do raio.
   - Conversão fechada para latitude, longitude e altitude geodésica.
   - Se dentro da cobertura compilada de Manaus, converte para projeção local; se fora, cria/reutiliza um referencial de superfície `surface-enu`.
   - **Lua**: Interseção analítica raio vs esfera lunar ($R = 1.737.400\text{ m}$).
   - **Marte**: Interseção analítica raio vs elipsoide marciano ($a = 3.396.200\text{ m}, c = 3.376.200\text{ m}$).
3. **Alvo Angular Celeste (Celestial Angular Picking)**:
   - Sem raycast de malhas astronômicas.
   - Cálculo analítico no runtime celeste (`pickCelestialBodyFromRay`) avaliando vetor de visada, raio angular aparente e cone de retículo (15°).
   - Classificação com bônus de tamanho aparente e seleção imediata de corpos (Lua, Marte, Sol, planetas).
4. **Alvo Armado / Formulário de Coordenadas**:
   - Suporte a URIs canônicas `drm:v1://`, tuplas `"lat, lon, alt"` e identificadores do catálogo (`UniversalTargetCatalog`).

---

## 2. Invariantes de Chegada Segura (Safe Arrival)
- **Superfície**: altitude + folga de segurança (2 m de clearance vertical).
- **Órbita**: centro do corpo + direção $\times$ (raio equatorial + altitude orbital segura, e.g. Marte a $+250\text{ km}$).
- **Espaço Livre**: gravidade zero no referencial do sistema.
- **Buracos Negros**: política padrão de distância de observação segura ($R_{\text{obs}} = \max(6 \times r_s, 100.000\text{ m})$), garantindo que o jogador surja fora da ISCO e da esfera de fótons sem pouso genérico destrutivo no horizonte.

---

## 3. Transação Atômica e Cancelamento (Atomic Handoff)
- Uma única transação síncrona atualiza:
  - `UniverseRuntime.address`
  - `navigationState`
  - `activeSystem`
  - `playerPose.frame` e coordenadas lógicas
  - `TravelDomain` (`reset()` para local, `enterSystem()` para espaço/órbita)
  - `floatingOrigin.reset()`
  - `PlayerController` (posição e cancelamento de velocidades residuais)
- **Cancelamento**: Um novo comando de teleporte aborta o anterior via `AbortController`. Falhas de preparação revertem e deixam o estado de origem completamente intocado.
- **Memória Limitada**: Limite de 32 referenciais dinâmicos de superfície (`MAX_DYNAMIC_SURFACE_FRAMES = 32`). Referenciais antigos são reciclados para evitar vazamento em saltos sucessivos.

---

## 4. Verificação e Testes
- **Suíte dedicada**: `tests/universal-teleport-service.test.ts` (14/14 testes aprovados, 100%).
- **Suítes de regressão completas**:
  - `tests/universal-map-multiscale-u5.test.ts` (7/7)
  - `tests/cosmological-structure-u6.test.ts` (7/7)
  - `tests/black-hole-transit-bh2.test.ts` (7/7)
  - `tests/black-hole-gravity-bh1.test.ts` (7/7)
  - `tests/cosmic-atlas-u452.test.ts` (13/13)
  - `tests/universe-coordinates.test.ts` (7/7)
  - **Total**: **62/62 testes aprovados** (100%).
- `npm run typecheck` (`tsc --noEmit`): **0 erros**.
- `npm run build` (Vite 8.3.0): **Build de produção aprovado em 1.92s**.
