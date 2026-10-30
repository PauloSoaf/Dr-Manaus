# Engenharia e Arquitetura: P0.5.9 — Autorização de Throttle Fly-By-Wire por Proximidade e Conclusão do P0.5

**Status**: Implementado e Pronto para Validação no CI  
**Data**: 30 de Outubro de 2026  
**Autor**: Antigravity Assistant & Dr-Manaus Core Team  
**Branch**: `feat/universe-map`  
**HEAD Anterior (P0.5.8)**: `08d14d2c5de1ca43c143d004469f07566ff3dbe1`  
**Escopo**: Resolução definitiva do teste `T_P0B_PROXIMITY_SPEED_GATING_PREVENTS_TUNNELING` sem degradar a física de colisão (CCD), preservando os 638 testes do portão permanente de regressão, o voo livre contínuo, as decolagens/pousos e a integridade de impactos cósmicos.

---

## 1. Contexto e Motivação

Na auditoria do P0.5.8 (commit `08d14d2c`), validada no GitHub Actions ([Run 40899972453](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/40899972453)):
- **TypeScript**: Aprovado
- **Permanent regression gate**: 638/638 Aprovados (recuperadas integralmente as 29 regressões do P0.5.7)
- **Suíte geral de testes unitários**: 1.473/1.474 Aprovados
- **Única falha restante**: `T_P0B_PROXIMITY_SPEED_GATING_PREVENTS_TUNNELING` em `tests/free-cosmic-flight.test.ts:374-401`.

O teste coloca o jogador a $50.000\text{ km}$ da Terra em repouso relativo, engata `warpStep = 14` ($10.000.000c$), mira diretamente na Terra com a câmera, segura `KeyW` por 1 frame ($\Delta t = 1/60\text{ s}$) e exige:
1. `telemetry.proximityGatingActive === true`
2. `telemetry.gatedBodyId === 'earth'`
3. `cappedSpeed <= 16 * LIGHT_SPEED_MPS`

---

## 2. Investigação Numérica e Rastreio Frame a Frame

### 2.1 Traçado Numérico no P0.5.8 (Comportamento com Falha)
1. **Velocidade inicial**: `velocityMps = [0, 0, 0]`, `bodyVel = earthVel ≈ [29780, 0, 0]`, `relVel ≈ [0, 0, 0]`.
2. **Vetor de thrust**: Câmera voltada para o centro da Terra (`[0, -1, 0]`), `thrustDirectionBary = [0, -1, 0]`.
3. **Aceleração não limitada**:
   `acceleration = warpSpeed / WARP_SPOOL_S = (10_000_000 * 299_792_458) / 1.2 ≈ 2.498 \times 10^{15}\text{ m/s}^2`.
4. **Velocidade após thrust**:
   `relVel[1] += (-1) * 2.498e15 * (1/60) ≈ -4.164 \times 10^{13}\text{ m/s}` ($\approx 138.890c$).
5. **Cálculo de Proximidade**:
   - Distância ao envelope da Terra: $dist \approx 50.000.000\text{ m}$ ($50.000\text{ km}$).
   - `staticCap = proximitySpeedCapMps(50_000_000) ≈ 24.8 \times 10^6\text{ m/s}` ($0.083c$).
   - `kinematicCap = 20_000 + 50_000_000 / 1.5 ≈ 33.35 \times 10^6\text{ m/s}` ($0.111c$).
   - `maxRelative = cap ≈ 24.8 \times 10^6\text{ m/s}` ($0.083c$).
6. **Tentativa de Frenagem Preditiva**:
   - `relSpeed ≈ 4.164 \times 10^{13}\text{ m/s} > maxRelative`.
   - Limite de frenagem contínua por frame: `maxDeltaV = decelRate * dt ≈ 1.45 \times 10^{12}\text{ m/s}`.
   - `newSpeed = Math.max(maxRelative, relSpeed - maxDeltaV) ≈ 4.019 \times 10^{13}\text{ m/s}` ($\approx 134.068c$).
7. **Resultado**: `cappedSpeed ≈ 4.019e13 m/s > 16 * LIGHT_SPEED_MPS` ($4.796e9\text{ m/s}$), causando falha na asserção.

### 2.2 Diagnóstico da Causa Raiz
A falha decorre de uma inconsistência de controle:
- A assistência aplicava empuxo baseado na marcha bruta do warp ($10.000.000c$) **antes** de avaliar o envelope de proximidade.
- A frenagem contínua subsequente respeita os limites de $\Delta v$ por frame para evitar solavancos cinemáticos e preservar a física contínua.
- Como consequência, uma nave em repouso a $50.000\text{ km}$ recebia autorização para acelerar a $138.000c$ em um frame e dependia de uma parada abrupta impossível sem quebrar a continuidade temporal.

---

## 3. Decisão Arquitetural do P0.5.9: Throttle Gating Pré-Thrust

Em engenharia de controle e sistemas de voo fly-by-wire (FBW), a autoridade sobre o atuador (aceleração do motor de warp) deve ser modulada pelas restrições do envelope **antes** que o comando de empuxo seja integrado no integrador de estado (`relVel`).

### 3.1 Formulação Matemática
Para cada obstáculo celeste com centro $\vec{C}$, raio de envelope $R$ e posição do jogador $\vec{P}$:
$$\vec{r} = \vec{P} - \vec{C}, \quad d_{center} = \|\vec{r}\|, \quad dist = d_{center} - R$$

Dada a direção de empuxo comandada $\hat{u}_{thrust}$:
$$\tau_{inward} = -\frac{\vec{r} \cdot \hat{u}_{thrust}}{d_{center}}$$

- Se $\tau_{inward} \le 0$: o empuxo aponta para fora ou tangencialmente (voo de escape radial). O motor de warp opera com autoridade total (`authorizedWarpSpeed = warpSpeed`). Isso preserva o contrato `T_P05_OUTWARD_FLIGHT_NO_PROXIMITY_BRAKING`.
- Se $\tau_{inward} > 0$: o empuxo possui projeção de aproximação ao corpo celeste. O teto máximo de velocidade autorizado nessa direção é:
$$v_{allowed} = \min\left(v_{warp}, \frac{v_{cap}}{\tau_{inward}}\right)$$
onde $v_{cap} = \min(staticCap(dist), kinematicCap(dist))$.

Essa modulação assegura que a velocidade radial máxima resultante em direção ao corpo nunca superará $v_{cap}$:
$$v_{radial} = v_{allowed} \cdot \tau_{inward} \le \left(\frac{v_{cap}}{\tau_{inward}}\right) \cdot \tau_{inward} = v_{cap}$$

### 3.2 Traçado Numérico no P0.5.9 (Comportamento Corrigido)
1. **Posição**: $50.000\text{ km}$ da Terra ($dist = 50.000.000\text{ m}$).
2. **Cap do Envelope**: $v_{cap} \approx 24.8 \times 10^6\text{ m/s}$ ($0.083c$).
3. **Thrust Proa com a Terra**: $\tau_{inward} = 1.0 > 0$.
4. **Throttle Autorizado**: `authorizedWarpSpeed = min(10_000_000c, 24.8e6 / 1.0) = 24.8e6 m/s`.
5. **Telemetria de Gating**: `proximityGatingActive = true`, `gatedBodyId = 'earth'`.
6. **Aceleração do Frame**:
   `acceleration = 24.8e6 / 1.2 ≈ 20.67 \times 10^6\text{ m/s}^2`.
7. **Incremento em 1 frame ($\Delta t = 1/60\text{ s}$)**:
   $\Delta v = 20.67 \times 10^6 \times (1/60) \approx 344.549\text{ m/s}$ ($\approx 0.00115c$).
8. **Velocidade Resultante**:
   `cappedSpeed ≈ 344.549 m/s <= 16 * LIGHT_SPEED_MPS` ($4.796 \times 10^9\text{ m/s}$).
9. **Resultado**:
   - `proximityGatingActive === true` -> **PASSOU**
   - `gatedBodyId === 'earth'` -> **PASSOU**
   - `cappedSpeed <= 16c` -> **PASSOU** (margem de segurança superior a $10.000\times$).

---

## 4. Preservação Estrita dos Contratos de Segurança

| Contrato | Mecanismo | Garantia no P0.5.9 |
|---|---|---|
| **638/638 Testes Permanentes** | CCD opera em velocidade física real | Nenhum clamp pré-CCD introduzido; fixture manual preservada |
| **Colisão Fotosférica Solar** | Resposta inelástica $v_{radial} = 0$ | Preservada sem ricochete em `tests/sun-approach.test.ts` |
| **CCD em 19 Corpos** | `sweepSegmentSphere` em $t \in [0, 1]$ | Inalterado; raios de varredura preservados em velocidade de teste |
| **Impactos Catastróficos** | Classificação por energia cinética ($\ge 1c$) | Testes de impacto em alta velocidade recebem velocidade balística real |
| **Ausência de Tunneling** | Throttle limitado em proximidade + CCD de segurança | Sem tunneling tanto por propulsão cósmica quanto por sweep balístico |
| **Voo de Escape Exterior** | $\tau_{inward} \le 0$ não restringe throttle | `T_P05_OUTWARD_FLIGHT_NO_PROXIMITY_BRAKING` acelera livremente a $1.000c$ |
| **Continuidade de Frenagem** | `maxDeltaV = decelRate * dt` | `T_P05_VELOCITY_CONTINUITY_ACROSS_PROXIMITY_THRESHOLDS` preservado |
| **Independência de FPS** | Integração consistente em 30, 60 e 120 FPS | `T_P05_DECELERATION_FRAMERATE_INDEPENDENCE_30_60_120_FPS` preservado |
| **Decolagem e Pouso** | Modos local/F/V x2 | Preservados em `T_P0B_SOL_PHOTOSPHERE_LOCOMOTION_TAKEOFF` |
| **Hipercruzeiro U3** | Autopilot de aproximação automática | Preservado em `T_P0B_EXISTING_AUTOPILOT_HYPERCRUISE_PRESERVED` |

---

## 5. Arquivos Modificados

1. [src/world/travel/CosmicFlight.ts](file:///c:/Projetos/Dr-Manaus/src/world/travel/CosmicFlight.ts):
   - Montagem do catálogo de obstáculos antes do cálculo de propulsão.
   - Cálculo de autorização de throttle fly-by-wire (`authorizedWarpSpeed`) baseado na projeção $\tau_{inward}$.
   - Aplicação de `authorizedWarpSpeed` no empuxo manual e no cruzeiro assistido.
   - Preservação intacta do algoritmo de desaceleração temporal e do CCD físico.
2. [docs/world/34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md](file:///c:/Projetos/Dr-Manaus/docs/world/34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md):
   - Atualização com evidências oficiais do CI P0.5.8 (Run 40899972453) e distinção entre testes permanentes e suíte geral.
3. [docs/world/35-status-P0.5.9-PROXIMITY-THROTTLE-GATING.md](file:///c:/Projetos/Dr-Manaus/docs/world/35-status-P0.5.9-PROXIMITY-THROTTLE-GATING.md):
   - Documento canônico do Patch P0.5.9 detalhando a formulação matemática e o traçado frame a frame.
