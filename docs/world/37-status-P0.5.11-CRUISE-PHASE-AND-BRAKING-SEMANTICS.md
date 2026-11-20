# Engenharia e Arquitetura: P0.5.11 — Restauração do Cruzeiro Interestelar e Semântica de Fases de Voo e Frenagem

**Status**: Implementado e Pronto para Validação no CI  
**Data**: 01 de Novembro de 2026  
**Autor**: Antigravity Assistant & Dr-Manaus Core Team  
**Branch**: `feat/universe-map`  
**HEAD Anterior (P0.5.10)**: `97d96a1606cd6e08cf3521acd48f1b53a53c2062`  
**Escopo**: Correção semântica da classificação de fases de voo, separando o regulador de velocidade máxima em cruzeiro interestelar (*cruise speed governor*) da frenagem preditiva por aproximação planetária (*proximity braking*), preservando todos os 638 testes do portão permanente e garantindo consistência na telemetria.

---

## 1. Contexto e Motivação

No Patch P0.5.10 ([commit 97d96a1](https://github.com/PauloSoaf/Dr-Manaus/commit/97d96a1606cd6e08cf3521acd48f1b53a53c2062)), foram solucionadas com sucesso a identificação determinística da Terra e a independência de ordenação do catálogo de corpos celestes. A auditoria do GitHub Actions ([Run 41139310901](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/41139310901)) reportou:
- **Typecheck**: Aprovado
- **Permanent regression gate**: 638/638 Aprovados (100%)
- **Suíte geral**: 1.474/1.475 Aprovados (99.93%)
- **Única falha remanescente**:
  ```text
  T_P0B_SOLAR_SYSTEM_TO_INTERSTELLAR_SPACE_WASD
  Esperado: cosmic-cruise
  Obtido: braking
  tests/free-cosmic-flight.test.ts:273
  ```

O teste inicia o jogador a $10.000\text{ AU}$ do Sol (`[0, 1e15, 0]`), engata o tier interestelar (`warpStep = 10`, equivalente a $1.000c$) e mantém `KeyW + ShiftLeft` por 60 passos de $0,1\text{ s}$ em espaço profundo. O teste exige:
1. `speed >= 1000 * LIGHT_SPEED_MPS`
2. `telemetry.phase === 'cosmic-cruise'`

---

## 2. Diagnóstico Numérico e Causa Raiz

### 2.1 O Mecanismo do Erro no P0.5.10
No P0.5.10, foi introduzida a seguinte linha no integrador de velocidade de cruzeiro (`CosmicFlight.ts:588-589`):
```ts
newSpeed = Math.max(maxRelative, relSpeed - maxDeltaV);
decelerationApplied = true;
phase = 'braking';
```

Ao acelerar em espaço profundo com o comando de empuxo `KeyW`:
1. Durante os primeiros $1,2\text{ s}$ ($12$ passos de $\Delta t = 0,1\text{ s}$), a aceleração $a = v_{warp} / \text{WARP\_SPOOL\_S} = 1.000c / 1,2$ eleva a velocidade de $0$ até $1.000c$. A fase é classificada em `thrustDirectionBary` como `'cosmic-cruise'`.
2. No passo 13, a nave já se encontra em $1.000c$. O empuxo manual adiciona um incremento discreto de Euler:
   $$v_{rel} \gets 1.000c + a \cdot \Delta t = 1.083,3c$$
3. O controlador avalia `maxRelative = authorizedWarpSpeed = 1.000c`.
4. Como $relSpeed = 1.083,3c > maxRelative$, o código entrava no bloco de regulação:
   $$newSpeed = \max(1.000c, 1.083,3c - \Delta v_{max}) = 1.000c$$
5. No P0.5.10, essa saturação de velocidade acionava incondicionalmente:
   ```ts
   decelerationApplied = true;
   phase = 'braking';
   ```
6. Consequentemente, **em todos os frames em que a nave viajava na velocidade máxima da marcha comandada pelo jogador**, o regulador que aparava o resíduo numérico sobrescrevia a fase de voo de `'cosmic-cruise'` para `'braking'`.

---

## 3. Separação Conceitual das Autoridades de Voo

Para restabelecer a integridade semântica exigida, foram desacoplados formalmente os 7 regimes de voo:

| Regime de Voo | Gatilho / Condição | Comportamento da Velocidade | Fase Resultante (`telemetry.phase`) | Aceleração (`telemetry.accelerationMps2`) | Telemetria de Proximidade |
|---|---|---|---|---|---|
| **1. Aceleração Manual de Warp** | `thrustDirectionBary > 0.01` e $v < v_{warp}$ | Aceleração linear com rampa de spool ($a = v_{warp} / 1.2$) | `cosmic-cruise` ($>256c$) ou `acceleration` | $a = v_{warp} / 1.2 > 0$ | Inativa (`proximityGatingActive = false`) |
| **2. Regulador de Cruzeiro (Speed Governor)** | `thrustDirectionBary > 0.01` e $v \ge v_{warp}$ sem obstáculo próximo | Velocidade saturada em $v_{warp}$; apara resíduo de integração | Mantém `cosmic-cruise` ou `acceleration` | $a = 0$ (regime permanente em cruzeiro) | Inativa (`proximityGatingActive = false`) |
| **3. Frenagem Preditiva de Proximidade** | $d_{obs}$ restringe envelope (`decelGatingActive = true`) e $v > v_{cap}$ | Desaceleração cinemática contínua limitada por $\Delta v_{max}$ | `braking` | $a = -appliedDecel < 0$ | Ativa (`proximityGatingActive = true`, `gatedBodyId = obs.id`) |
| **4. Frenagem Manual Solicitada** | `context.inputBrake` ativo (`KeyQ` ou `KeyX`) | Aplicação de freio espacial (`BASE_BRAKE_ACCEL`) ou corte de marcha | `braking` | $a = -appliedDecel < 0$ | Inativa em espaço livre |
| **5. Frenagem do Piloto Automático** | Modo assistido U3 em aproximação ($d_{stop} \ge d_{rem} \times 0.5$) | Perfil de desaceleração de captura | `braking` | $a = -cruiseAccel < 0$ | Segue plano de viagem |
| **6. Parada de Emergência** | Projeção em 1 frame intercepta envelope ou impacto CCD | Clamp de segurança para evitar tunelamento | `emergency-stop` | $a = -appliedDecel \ll 0$ | Flag `emergencyStopActive = true` |
| **7. Captura e Pouso** | Intenção de pouso ativa (`KeyF`) perto de superfície ou fotosfera | Integração acoplada ao referencial do corpo | `landing-capture` ou `landing-hold` | Ditada pelo controlador de pouso | Subordinada ao pouso |

---

## 4. Formulação Matemática da Solução (P0.5.11)

No arquivo [CosmicFlight.ts](file:///c:/Projetos/Dr-Manaus/src/world/travel/CosmicFlight.ts):

### 4.1 Separação entre `speedGovernor` e `proximityDecelApplied`
```ts
const relSpeed = Math.hypot(relVel[0], relVel[1], relVel[2]);
let newSpeed = relSpeed;
let proximityDecelApplied = false;

if (!assisted && relSpeed > maxRelative && relSpeed > 0) {
  const spoolDecel = relSpeed / WARP_SPOOL_S;
  const maxPredictiveDecel = (relSpeed / WARP_SPOOL_S + BASE_BRAKE_ACCEL) * 2.5;
  const predictiveDecel = Math.min(requiredDecelMps2, maxPredictiveDecel);
  const decelRate = Math.max(BASE_BRAKE_ACCEL, spoolDecel, predictiveDecel);
  const maxDeltaV = decelRate * dt;
  newSpeed = Math.max(maxRelative, relSpeed - maxDeltaV);

  // A fase só transita para 'braking' se a redução for decorrente de restrição de proximidade
  if (decelGatingActive) {
    proximityDecelApplied = true;
    phase = 'braking';
  }
}
```

### 4.2 Tratamento da Aceleração em Regime Permanente
Quando o jogador sustenta empuxo manual em cruzeiro interestelar e atinge a velocidade da marcha ($newSpeed = authorizedWarpSpeed$), a nave está em regime de cruzeiro permanente sem variação líquida de velocidade. A aceleração informada à telemetria deve ser nula:
```ts
if (newSpeed < relSpeed && relSpeed > 0) {
  const appliedDecel = (relSpeed - newSpeed) / Math.max(1e-6, dt);
  const scale = newSpeed / relSpeed;
  relVel[0] *= scale; relVel[1] *= scale; relVel[2] *= scale;

  if (proximityDecelApplied || context.inputBrake || phase === 'braking' || phase === 'emergency-stop') {
    acceleration = -appliedDecel;
  } else if (thrustDirectionBary.lengthSq() > 0.01 && Math.abs(newSpeed - authorizedWarpSpeed) < 1e-3 * Math.max(1, authorizedWarpSpeed)) {
    // Regulador de cruzeiro em regime permanente: aceleração resultante é zero
    acceleration = 0;
  } else {
    // Spool-down por redução de marcha ou desaceleração livre sem empuxo
    acceleration = -appliedDecel;
  }
}
```

### 4.3 Telemetria no HUD ([Game.ts](file:///c:/Projetos/Dr-Manaus/src/game/Game.ts))
Atualizada a função `hudFlight()` para permitir que `phase === 'cosmic-cruise'` seja exibido no HUD durante o cruzeiro interestelar livre, refletindo a label canônica `"VOO CÓSMICO LIVRE"`.

---

## 5. Novos Testes de Validação

Adicionado o teste unitário **`T_P0511_INTERSTELLAR_CRUISE_PHASE_AND_SPEED_GOVERNOR_SEMANTICS`** em [tests/free-cosmic-flight.test.ts](file:///c:/Projetos/Dr-Manaus/tests/free-cosmic-flight.test.ts), cobrindo explicitamente:
1. **Regulador em Espaço Profundo**: 30 passos sustentados a $1.000c$. Garante que `phase === 'cosmic-cruise'`, `proximityGatingActive === false`, `gatedBodyId === undefined` e `accelerationMps2 === 0`.
2. **Frenagem por Proximidade**: Aproximação do Sol a $50.000\text{ km}$ e $50.000.000\text{ m/s}$. Garante que `phase === 'braking'`, `proximityGatingActive === true`, `gatedBodyId === 'sun'` e `accelerationMps2 < 0`.
3. **Frenagem Manual**: Acionamento de `KeyQ` em espaço profundo. Garante que `phase === 'braking'` sem ativar `proximityGatingActive`.

---

## 6. Auditoria de Fontes: Distinção entre Engenharia Real e Gameplay

Conforme auditado, a monografia **NASA SP-8015 (1968)** (*Guidance and Navigation for Entry Vehicles*) trata estritamente de reentrada atmosférica, balística de aproximação suborbital e limites térmico-dinâmicos de veículos aeroespaciais.
- Ela foi citada nas notas de engenharia exclusivamente como precedente histórico para o conceito de **corredores delimitados de velocidade em função da distância ao corpo central**.
- Registra-se com clareza a distinção: os princípios físicos reais de engenharia de controle (como proteção de envelope de voo em Stevens et al., 2015, e geometria de fechamento radial em Battin, 1999) inspiram a robustez do software, mas **a propulsão de dobra espacial superluminal (FTL/warp) é um sistema de mecânica de jogabilidade fictícia próprio do Dr-Manaus**, não devendo ser atribuído a publicações governamentais da NASA.

---

## 7. Preservação Estrita dos Contratos Existentes

- **Portão Permanente (638/638)**: CCD balístico, fotosfera solar inelástica e 19 corpos celestes intocados.
- **Identificação da Terra (P0.5.10)**: Mantida intacta; testada com ordenação invertida `[earth, mars]` vs `[mars, earth]`.
- **Prevenção de Tunelamento (P0.5.9)**: Throttle limiter pré-thrust preservado.
- **Voo de Escape (P0.5.6)**: Outward flight sem restrições indevidas preservado.
- **Transição Transacional de Galáxias (P0.5.6)**: Rollback e deferred handoff preservados.
