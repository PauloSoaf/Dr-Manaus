# DR-MANAUS | Active Patch Tracker

- **Patch:** `D5` (Ruptura Catastrófica de Corpos Menores, Energia de Ligação Gravitacional e Dispersão de Enxame de Asteroides)
- **Status:** IMPLEMENTADO, APROVADO LOCALMENTE (1.676/1.676 testes, 638/638 regressões, typecheck OK, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-11T16:13:00-04:00

## Mudanças do Patch
1. `src/world/destruction/MinorBodyDisruptionService.ts`:
   - Serviço autoritativo de ruptura catastrófica de corpos menores astronômicos (`MinorBodyDisruptionService`).
   - Cálculo exato de energia de ligação auto-gravitacional $U = \frac{3}{5}\frac{GM^2}{R}$ e limiar dinâmico de dispersão catastrófica $Q_D^* \cdot M = U + M \cdot q_{\text{strength}}$ ($q_{\text{strength}} = 100\text{ kJ/kg}$).
   - Classificação estrita de imunidade: corpos maiores ($R > 500\text{ km}$, e.g. Terra, Lua, Marte, gigantes gasosos) são protegidos contra desintegração total, exigindo escavação ou fratura (D2/D3/D4).
   - Conversão de energia cinética excedente em velocidade de dispersão isotrópica/impulsiva de enxame de escombros ($v_{\text{disp}} = \sqrt{2(E - E_{\text{thresh}})/M}$).
   - Geração de aglomerado de asteroides (`AsteroidFieldCluster`) com 32 fragmentos em órbitas Keplerianas heliocêntricas determinísticas e distribuição de massa em lei de potência $N(r) \propto r^{-2.8}$.
   - Transição de estado de ciclo de vida do corpo para `'DISRUPTED'`.
2. `src/player/powers/PowerSystem.ts`:
   - Adicionado hook de poderes `disruptMinorBody(bodyId, energyJoules)` em `PowerHooks`.
3. `src/game/Game.ts`:
   - Instanciado `MinorBodyDisruptionService` acoplado ao `PlanetVolumeEditStore` e catálogo de corpos do sistema ativo.
   - Conexão do hook `disruptMinorBody` no `PowerSystem` e métricas de corpos destruídos em `universeDebug()`.
4. `tests/minor-body-disruption-service.test.ts`:
   - Suíte de 5 testes unitários validando cálculo de energia de ligação, imunidade garantida de grandes corpos, corte por limiar energético, geração de enxame orbital com conservação de massa e isolamento multicorpo.
5. `docs/autonomous-development/SPEC-MASTER-TRACKER.md`:
   - Atualizado status de `DEST-07` (D5) para `IMPLEMENTED`.
