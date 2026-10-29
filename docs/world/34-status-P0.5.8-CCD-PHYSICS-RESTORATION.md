# Engenharia e Arquitetura: P0.5.8 — Restauração do Portão Permanente de Regressão e Desacoplamento entre Assistência Cósmica e CCD

**Status**: Implementado e Pronto para Validação no CI  
**Data**: 29 de Outubro de 2026  
**Autor**: Antigravity Assistant & Dr-Manaus Core Team  
**Branch**: `feat/universe-map`  
**Escopo**: Correção arquitetural do commit `22296770dcc266b8668c5f7da6751f1b179a6803` (P0.5.7), recuperação dos 638 testes do Permanent Regression Gate e preservação dos contratos de colisão contínua (CCD), Time of Impact (TOI) e impactos catastróficos.

---

## 1. Contexto e Histórico do Defeito

Na versão P0.5.7 (commit `2229677`), implementou-se uma antecipação cinemática de frenagem e um limitador de velocidade por proximidade com o objetivo de solucionar testes de desaceleração suave e consistência de taxas de quadros em voo cósmico interestelar (`tests/free-cosmic-flight.test.ts`).

Entretanto, o relatório do CI da run [40793886095](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/40793886095) acusou falha imediata na primeira etapa do pipeline — o **Permanent regression gate** (`npm run test:regression`) — com **29 falhas** entre 638 testes (609 aprovados, 29 reprovados).

Entre as regressões mais severas estavam:
- `T_SUN_CCD_NEAR_PHOTOSPHERE`: Ausência de contato detectado pelo CCD a 1.000 m da fotosfera.
- `T_SUN_NO_TUNNEL_AT_PHOTOSPHERE`: Falha na contenção e detecção a velocidades ultra-relativísticas ($256c$).
- `T_SUN_NO_BOUNCE`: Inconsistência na resposta inelástica sem ricochete na fotosfera solar.
- `T_SUN_CATASTROPHIC_EVENT_AT_HIGH_SPEED`: Degradação da energia de impacto, impedindo a classificação de evento catastrófico.
- `T_SUN_PHOTOSPHERE_CONTACT_NO_BOUNCE`: Falha no contrato de parada aderente na fotosfera.
- `T_SUN_256C_CCD_PRESERVED`: Supressão de detecção de colisão a $256c$.
- `T_SUN_30FPS`, `T_SUN_60FPS`, `T_SUN_120FPS`: Falha em validações de colisão manual e impactos em diferentes timesteps.
- Todos os 19 testes `T_CELESTIAL_SWEEP_<BODY>_FAST`: Rompimento do contrato de sweep CCD em todos os corpos do catálogo do Sistema Solar.

---

## 2. Causa Raiz Comprovada

A auditoria matemática e de fluxo de dados confirmou a hipótese arquitetural:

1. **Pre-CCD Velocity Clamping**:  
   No commit P0.5.7, adicionou-se uma rotina de segurança ("Critical proximity & collision avoidance guard") imediatamente antes do teste de sweep contínuo do CCD. A rotina verificava se $v_{closing} \cdot \Delta t \ge 0.85 \cdot dist$ e, em caso positivo, **forçava a velocidade relativa do jogador para $20\text{ km/s}$** (`proximitySpeedCapMps(0)`).
   
2. **Efeito no Raio de Varredura**:  
   Em simulação de física baseada em CCD (Continuous Collision Detection / Time of Impact), o passo de deslocamento projetado $\vec{S} = \vec{v}_{rel} \cdot \Delta t$ é o segmento testado contra as esferas celestes (`sweepSegmentSphere`).  
   Ao truncar $\vec{v}_{rel}$ de valores astronômicos (por exemplo, $256c \approx 76.8 \times 10^9\text{ m/s}$ ou $1.000\text{ km/s}$) para $20\text{ km/s}$ **antes** do sweep:
   - Em $\Delta t = 1/60\text{ s}$, o comprimento do segmento encolheu de dezenas de milhares de quilômetros para míseros $333\text{ m}$.
   - Para um jogador a $1.000\text{ m}$ da superfície (como em `T_SUN_CCD_NEAR_PHOTOSPHERE`), o raio encurtado simplesmente não alcançava a fotosfera no frame.
   - Para testes de varredura rápida como `T_CELESTIAL_SWEEP_*_FAST`, onde o jogador começa a $3 \times R$ do centro e fecha a $6 \times R / \Delta t$, o segmento encolheu para $5\text{ km}$ contra uma distância de centenas de milhares de quilômetros, resultando em `hit === undefined`.

3. **Destruição da Classificação de Energia de Impacto**:  
   Mesmo nos casos onde o corpo estava adjacente, o contato gerado recebia a velocidade adulterada ($20\text{ km/s}$) em vez da velocidade física real de aproximação. Como `classifyCelestialImpact` exige $v_{rel} \ge c$ para impactos catastróficos (`thresholds.catastrophicSpeedMps = LIGHT_SPEED_MPS`), nenhum impacto catastrófico conseguia ser gerado.

4. **Ativação Indiscriminada do Gating de Proximidade**:  
   O gatilho de frenagem preditiva foi configurado com a condição:
   `if (isCosmic || warpSpeed > 0 || currentRelSpeed > arrivalSpeed)` onde `arrivalSpeed = 20_000`.
   Isso ativou a lógica de controle assistido de cruzeiro cósmico em **qualquer voo convencional, manual ou fixture de teste** cuja velocidade superasse $20\text{ km/s}$, violando a separação entre voo manual não assistido e assistência cósmica.

---

## 3. Diagrama Textual do Fluxo Arquitetural

```
[Input do Jogador / Autopilot / Fixture]
                 │
                 ▼
          [Game.ts Update]
                 │
                 ▼
       [TravelDomain.ts State]
                 │
                 ▼
   [CosmicCruiseController.update]
                 │
     ┌───────────┴────────────────────────┐
     │ É voo cósmico superluminal?        │
     │ (isCosmic || v > 256c)             │
     └───────────┬────────────────────────┘
            SIM  │                  NÃO (Voo convencional <= 256c / manual)
                 ▼                           │
     [Gating de Proximidade & Frenagem]      │
     - Curva ProximitySpeedCap               │
     - Antecipação cinemática spool-down     │
     - Desaceleração contínua sem cliffs     │
                 │                           │
                 └───────────┬───────────────┘
                             ▼
     [Vetor Físico Real de Trajetória: velocityMps & relativeStep]
                             │
                             ▼
          [Continuous Collision Detection (CCD)]
          - sweepSegmentSphere(P0, relativeStep, C, R)
          - Identificação do Time of Impact (TOI fraction t in [0, 1])
                             │
              ┌──────────────┴──────────────┐
              │ Houve interceptação física? │
              └──────────────┬──────────────┘
                     NÃO     │     SIM
                      ┌──────┘      └─────────────────────────┐
                      ▼                                       ▼
             [Avanço Cinemático]                   [Tratamento do Impacto]
             positionM += step                     - Criação de CelestialContact com
                                                     VELOCIDADE REAL de aproximação
                                                   - Resposta inelástica em
                                                     resolveCelestialContact:
                                                     * Absorção do vetor radial (sem ricochete)
                                                     * Clamp do vetor tangencial
                                                   - Fixação na casca do envelope (sem túnel)
                                                   - Marcação de parada emergencial:
                                                     phase: 'emergency-stop'
                                                     emergencyStopReason: 'ccd-contact'
                                                              │
                                                              ▼
                                                   [Game.ts CelestialImpacts]
                                                   - Classificação (CATASTROPHIC, MAJOR, MINOR)
                                                   - Emissão de cratera / destruição D1
                                                   - Handoff para fotosfera / superfície
```

---

## 4. Avaliação de Alternativas de Engenharia

### Alternativa 1: Speed-Guard Artificial Pré-CCD (Implementação P0.5.7 — Rejeitada)
* **Descrição**: Detectar aproximação crítica no próprio frame e frear artificialmente a velocidade antes de invocar o CCD.
* **Vantagens**: Aparentemente simples.
* **Desvantagens Graves**:
  - Viola os fundamentos de dinâmica de corpos rígidos e TOI (Time of Impact).
  - Trunca a geometria do raio de colisão, impedindo a detecção de túnel em velocidades altas.
  - Altera a velocidade de contato, destruindo a física de impacto, energia cinética e destruição.
  - Quebrou 29 contratos pré-existentes no repositório.

### Alternativa 2: Separação Estrita de Responsabilidades — Assistência de Voo vs. CCD Físico (Adotada)
* **Descrição**:
  1. A assistência de voo (Gating de Proximidade e Frenagem Cinemática) atua como um sistema fly-by-wire restrito ao domínio cósmico interestelar/intergaláctico (`isCosmic === true` ou $v > 256c$).
  2. O CCD opera exclusivamente sobre o vetor físico real de deslocamento.
  3. Prevenção de atravessamento (tunneling) é função nativa do algoritmo de sweep (`sweepSegmentSphere`), que encontra a fração de tempo exata de contato $t \in [0, 1]$, translada o jogador até a borda externa do obstáculo e aplica a resposta inelástica (sem quique).
  4. Intervenções emergenciais causadas por impacto físico real reportam `emergencyStopReason: 'ccd-contact'`, enquanto voo controlado em aproximação com distância suficiente segue o perfil contínuo com `phase: 'braking'`.
* **Vantagens**:
  - Matematicamente rigoroso e alinhado com engines consolidadas (Box2D, PhysX).
  - Preserva 100% dos contratos de detecção de fotosfera, varredura a $256c$, classificação catastrófica e ausência de ricochete.
  - Elimina descontinuidades artificiais e magic numbers.

---

## 5. Fundamentação Matemática e Fórmulas

### 5.1 Sweep de Segmento contra Esfera Celeste (CCD)
Dado o ponto inicial $\vec{P}_0$, o passo relativo $\vec{S} = (\vec{v} - \vec{v}_{orbital}) \Delta t$, o centro do corpo $\vec{C}$ e o raio do envelope $R$:
$$\vec{O} = \vec{P}_0 - \vec{C}$$
A equação quadrática de intersecção ao longo do segmento normalizado $\hat{u} = \frac{\vec{S}}{\|\vec{S}\|}$ para $s \in [0, \|\vec{S}\|]$:
$$\text{along} = -(\vec{O} \cdot \hat{u})$$
$$\vec{P}_{\perp} = \vec{O} + \hat{u} \cdot \text{along}$$
$$d_{\perp}^2 = \|\vec{P}_{\perp}\|^2$$
Se $d_{\perp}^2 < R^2$, o instante de entrada é:
$$s_{entry} = \text{along} - \sqrt{R^2 - d_{\perp}^2}$$
$$t = \frac{s_{entry}}{\|\vec{S}\|}, \quad t \in [0, 1]$$

Se $\vec{P}_0$ já se encontrar no interior da esfera ($\|\vec{O}\| \le R$) com movimento em direção ao centro, $t = 0$.

### 5.2 Resposta Inelástica Solar e Planetária (Sem Quique)
Na coordenada de contato, dada a normal outward $\hat{n} = \frac{\vec{P}_{contact} - \vec{C}}{\|\vec{P}_{contact} - \vec{C}\|}$ e a velocidade relativa $\vec{v}_{rel}$:
$$v_{radial} = \vec{v}_{rel} \cdot \hat{n}$$
A componente radial de entrada ($v_{radial} < 0$) é integralmente absorvida pela fotosfera ou envelope:
$$\vec{v}_{radial\_absorbed} = \min(0, v_{radial}) \hat{n}$$
$$\vec{v}'_{rel} = \vec{v}_{rel} - \vec{v}_{radial\_absorbed}$$
Resultando em $v'_{radial} = 0$, garantindo rigorosamente o invariante `no-bounce` da fotosfera solar e superfícies rochosas antes do handoff.

A componente tangencial é limitada à política de graze:
$$\vec{v}_{tangent} = \vec{v}'_{rel} - (\vec{v}'_{rel} \cdot \hat{n}) \hat{n}$$
$$\text{se } \|\vec{v}_{tangent}\| > v_{graze\_cap}, \quad \vec{v}_{tangent} \leftarrow \vec{v}_{tangent} \frac{v_{graze\_cap}}{\|\vec{v}_{tangent}\|}$$

---

## 6. Referências Técnicas Consultadas

1. **Box2D — Collision & Time of Impact (TOI)**:
   - URL: [https://box2d.org/documentation/md_collision.html](https://box2d.org/documentation/md_collision.html)
   - *Aplicação*: O CCD deve identificar o TOI exato preservando as velocidades de aproximação no instante do contato para alimentar o solver de impulsos e destruição. A frenagem emergencial nunca deve truncar o vetor de aproximação antes da varredura.
2. **Fix Your Timestep! (Glenn Fiedler)**:
   - URL: [https://www.gafferongames.com/post/fix_your_timestep/](https://www.gafferongames.com/post/fix_your_timestep/)
   - *Aplicação*: A integração numérica de velocidade e posição deve manter independência de framerate (30, 60, 120 FPS) sem introduzir descontinuidades temporais artificiais.
3. **Three.js WebGPU / Math Documentation**:
   - URL: [https://threejs.org/docs/](https://threejs.org/docs/)
   - *Aplicação*: Manuseio estrito de métricas euclidianas em coordenadas de sistema barycêntrico sem contaminação por render-space.

---

## 7. Arquivos Alterados

1. [src/world/travel/CosmicFlight.ts](file:///c:/Projetos/Dr-Manaus/src/world/travel/CosmicFlight.ts):
   - Restrição do gating de proximidade estritamente ao domínio de cruzeiro cósmico (`cosmicSpeedActive = isCosmic || currentRelSpeed > 256 * LIGHT_SPEED_MPS`).
   - Remoção completa do laço artificial de speed-guard pré-CCD que causava o estrangulamento de velocidade.
   - Manutenção da emissão consistente de telemetria `phase = 'emergency-stop'` e `emergencyStopReason = 'ccd-contact'` na interceptação física.
2. [docs/world/34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md](file:///c:/Projetos/Dr-Manaus/docs/world/34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md):
   - Documentação integral da análise de causa raiz, física de colisão, contratos e evidências.

---

## 8. Matriz de Contratos e Testes Validados

| Teste / Contrato | Comportamento no P0.5.7 | Comportamento Restaurado no P0.5.8 |
|---|---|---|
| `T_SUN_CCD_NEAR_PHOTOSPHERE` | FALHA (contato undefined por clamp prévio) | APROVADO (sweep detecta contato exato a 1.000m) |
| `T_SUN_NO_TUNNEL_AT_PHOTOSPHERE` | FALHA (velocidade adulterada antes do sweep) | APROVADO (CCD a 256c barra penetração sem túnel) |
| `T_SUN_NO_BOUNCE` | FALHA (velocidade residual incompatível) | APROVADO (velocidade radial pós-impacto = 0.000) |
| `T_SUN_CATASTROPHIC_EVENT_AT_HIGH_SPEED` | FALHA (rebaixado para graze por velocidade de 20 km/s) | APROVADO (impacto a 1.001c emite CATASTROPHIC_IMPACT) |
| `T_SUN_256C_CCD_PRESERVED` | FALHA (intervenção prematura) | APROVADO (contato preservado a 256c) |
| `T_SUN_30FPS`, `60FPS`, `120FPS` | FALHA (falha em sweep e classificação) | APROVADO (consistente e idêntico em 30, 60 e 120 FPS) |
| Todos os 19 `T_CELESTIAL_SWEEP_*_FAST` | FALHA (speed clamp violava `Math.abs(relSpeed - speed) < 0.01`) | APROVADO (sweep preserva velocidade de teste em todos os 19 corpos) |
| `T_P05_VELOCITY_CONTINUITY_ACROSS_PROXIMITY_THRESHOLDS` | APROVADO (continuidade mantida) | APROVADO (desaceleração contínua sem cliffs nem emergency stop) |
| `T_P05_DECELERATION_FRAMERATE_INDEPENDENCE_30_60_120_FPS` | APROVADO (independente de FPS) | APROVADO (redução de 100M para 40-50M em 1.0s com diff < 10%) |
| `T_P05_EMERGENCY_INTERVENTION_ON_INSUFFICIENT_STOPPING_DISTANCE` | APROVADO | APROVADO (CCD intercepta, impede penetração e aciona emergencyStopActive) |
| `T_P05_EMERGENCY_STOPPING_GUARD_VS_KINEMATIC_LIMITS` | APROVADO | APROVADO (telemetria emergency-stop e ccd-contact ativos, pos >= sunRadius) |

---

## 9. Riscos Conhecidos e Limitações

- **Voo em FTL Extremo**: Em velocidades intergalácticas da ordem de $1.5 \times 10^{12}c$ (tier intergaláctico), o deslocamento em um único frame excede o diâmetro de galáxias. O sistema de gating cósmico reduz as marchas preventivamente à medida que o jogador se aproxima de sistemas e setores habitados.
- **Passo Temporal Máximo**: O controlador limita o timestep de simulação a $0.25\text{ s}$ (`dt = Math.max(0, Math.min(0.25, dtS))`). Timesteps superiores a isso poderiam afetar a resolução de corpos microscópicos com órbitas rápidas.

---

## 10. Conclusão da Auditoria

O defeito do P0.5.7 residia no acoplamento incorreto entre a assistência de voo e a camada de detecção física. Ao eliminar o pré-clamp arbitrário e devolver a autoridade cinemática da colisão ao CCD, Dr-Manaus recupera os 638 testes do portão permanente sem abrir mão das melhorias de continuidade e frenagem suave para voo cósmico.
