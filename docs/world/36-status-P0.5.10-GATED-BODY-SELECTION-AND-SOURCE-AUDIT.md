# Engenharia e Arquitetura: P0.5.10 — Separação Estrutural de Canais de Gating, Resolução de Telemetria e Auditoria Bibliográfica

**Status**: Implementado e Pronto para Validação no CI  
**Data**: 30 de Outubro de 2026  
**Autor**: Antigravity Assistant & Dr-Manaus Core Team  
**Branch**: `feat/universe-map`  
**HEAD Anterior (P0.5.9)**: `42e21bdf813d1b65c0615f78107ecb1ee2bd9542`  
**Escopo**: Resolução da divergência de telemetria no teste `T_P0B_PROXIMITY_SPEED_GATING_PREVENTS_TUNNELING` (identificação incorreta de Marte em vez da Terra), garantia de independência de ordenação do catálogo de corpos celestes e auditoria rigorosa de referências bibliográficas aeroespaciais.

---

## 1. Contexto e Motivação

No Patch P0.5.9 ([commit 42e21bdf](https://github.com/PauloSoaf/Dr-Manaus/commit/42e21bdf813d1b65c0615f78107ecb1ee2bd9542)), a introdução da limitação de aceleração de dobra (*Fly-By-Wire Throttle Limiter*) solucionou com sucesso o problema de velocidade excessiva:
- A velocidade após 1 frame de empuxo a $50.000\text{ km}$ da Terra caiu de $138.000c$ para $\approx 0.00115c$, cumprindo com folga a exigência cinemática $v \le 16c$.
- O portão permanente permaneceu 100% aprovado (638/638).
- A suíte completa atingiu 1.473/1.474 testes aprovados.

Contudo, na auditoria do GitHub Actions ([Run 41119879842](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/41119879842)), a única asserção que falhou mudou de natureza:
```text
T_P0B_PROXIMITY_SPEED_GATING_PREVENTS_TUNNELING
Identifies Earth as gated body
Expected: earth
Received: mars
```

---

## 2. Diagnóstico da Causa Raiz: Por que Marte foi Identificado?

No P0.5.9, existia uma única variável `gatedBodyId` compartilhada por dois subsistemas distintos dentro do mesmo loop de obstáculos:
1. **Subsistema A — Throttle Limiter (Pré-Thrust)**:
   - A nave estava a $50.000\text{ km}$ da Terra com vetor de empuxo voltado para o centro da Terra ($\tau_{inward} = 1.0$).
   - O throttle limiter calculou $v_{allowed} \approx 24.8 \times 10^6\text{ m/s}$ ($0.083c$).
   - Atribuiu `authorizedWarpSpeed = 24.8e6` e `gatedBodyId = 'earth'`.
2. **Subsistema B — Desaceleração Preditiva de Cruzeiro (Pós-Thrust)**:
   - O loop continuava a iterar sobre todos os corpos celestes do sistema solar (inclusive Marte, Júpiter, etc.).
   - Embora a nave estivesse em repouso em relação à Terra (`relVel = [0, 0, 0]`), a velocidade inercial baricêntrica do jogador incluía o movimento orbital terrestre ($\approx 29.8\text{ km/s}$ em $+X$).
   - Para Marte, que possui coordenadas e velocidades orbitais distintas a centenas de milhões de quilômetros de distância, a projeção radial $v_{closing} = -(\vec{r} \cdot \vec{v}_{rel}) / \|\vec{r}\|$ resultava em um valor positivo pequeno decorrente do arrasto inercial do sistema solar.
   - O loop avaliava Marte:
     - Distância a Marte: $\approx 150.000.000\text{ km}$.
     - Cap de velocidade para Marte: $v_{cap} = 256c$.
     - Condição avaliada: `if (inwardClosing > 0 && cap < proximityCapMps)`.
     - Como `proximityCapMps` foi inicializado com $+\infty$, $256c < +\infty$ avaliou como verdadeiro!
     - Consequentemente, o código executava:
       ```ts
       proximityCapMps = cap; // 256c
       gatedBodyId = obstacle.bodyId; // 'mars'! Sobrescreveu 'earth'
       ```
3. **Resolução de Telemetria no P0.5.9**:
   - Nenhuma desaceleração era aplicada por Marte (pois a velocidade da nave era $\approx 0.00115c \ll 256c$).
   - Porém, a variável única `gatedBodyId` retinha o valor `'mars'`, atribuído incidentalmente pelo loop de cruzeiro de um planeta distante!
   - Ao exportar `f.controller.getTelemetry()`, a telemetria reportava que o corpo limitador era Marte, mesmo com o motor de dobra tendo sido limitado estritamente pela Terra.

---

## 3. Arquitetura da Solução no P0.5.10

Para eliminar qualquer contaminação entre restrições ativas e potenciais, o P0.5.10 adota três intervenções arquiteturais:

### 3.1 Separação Rígida de Variáveis de Estado
Foram desacoplados os canais de telemetria e controle:
- **Canal de Throttle (Pré-Thrust)**:
  - `throttleGatedActive`: booleano indicando se o comando de empuxo foi estrangulado.
  - `throttleGatedBodyId`: identificador do corpo que impôs a restrição de aceleração.
- **Canal de Desaceleração Cinemática (Pós-Thrust)**:
  - `decelGatingActive`: booleano indicando se o teto de cruzeiro é inferior à velocidade máxima livre.
  - `decelGatedBodyId`: identificador do corpo celeste com o teto de aproximação mais restritivo.
  - `decelerationApplied`: booleano estrito indicando se manobra de frenagem foi de fato executada no frame.

### 3.2 Correção da Velocidade Relativa Específica de Cada Obstáculo
No cálculo de `inwardClosing`, o vetor de aproximação deve ser medido estritamente em relação ao vetor de velocidade orbital do obstáculo específico:
```ts
const obstacleVel = obstacle.velocityMps ?? (obstacle.bodyId === context.bodyId ? bodyVel : [0, 0, 0]);
const vRelObs = [velocityMps[0] - obstacleVel[0], velocityMps[1] - obstacleVel[1], velocityMps[2] - obstacleVel[2]];
const inwardClosing = distCenter > 0
  ? -(offset[0] * vRelObs[0] + offset[1] * vRelObs[1] + offset[2] * vRelObs[2]) / distCenter
  : 0;
```

### 3.3 Cascata Determinística de Resolução de Telemetria
Ao final do ciclo de controle de voo, a telemetria resolve deterministicamente qual subsistema exerceu autoridade de fato sobre a trajetória:
```ts
let proximityGatingActive = false;
let gatedBodyId: string | undefined;

if (decelerationApplied && decelGatedBodyId) {
  // 1. Autoridade Máxima: Frenagem ativa aplicada no frame
  proximityGatingActive = true;
  gatedBodyId = decelGatedBodyId;
} else if (throttleGatedActive && throttleGatedBodyId) {
  // 2. Autoridade Fly-By-Wire: Empuxo comandado foi estrangulado pelo envelope
  proximityGatingActive = true;
  gatedBodyId = throttleGatedBodyId;
} else if (decelGatingActive && decelGatedBodyId && relSpeed > 0) {
  // 3. Cruzeiro Bounded: Velocidade livre está delimitada pelo envelope
  proximityGatingActive = true;
  gatedBodyId = decelGatedBodyId;
}
```

Essa hierarquia garante que:
- Quando o jogador acelera em direção à Terra, a Terra comanda o throttle limiter $\to$ `gatedBodyId = 'earth'`.
- Nenhuma influência de planetas distantes sem frenagem ativa pode sobrescrever o atuador primário.
- A ordem em que os corpos aparecem na lista de obstáculos é irrelevante para o resultado.

---

## 4. Auditoria Bibliográfica e Retificação de Fontes

Durante a auditoria deste patch, foi identificado e corrigido um erro de citação bibliográfica presente na documentação técnica:

### 4.1 Retificação do NASA SP-8007
- **Citação Anterior Incorreta**: *"NASA SP-8007: Space Vehicle Design Criteria — Acceleration and Speed Control Systems in Planetary Proximity Envelopes"*.
- **Fato Histórico / Técnico**: O documento oficial da NASA catalogado como **NASA SP-8007** (publicado em 1965, revisado em 1968) intitula-se *Buckling of Thin-Walled Circular Cylinders*, pertencente à série de critérios de projeto estrutural de veículos espaciais.
- **Ação**: A citação foi formalmente expurgada de [34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md](34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md) e substituída pelas publicações normativas e acadêmicas autênticas da área de controle e guiamento espacial.

### 4.2 Referências Técnicas Autênticas e Verificadas
1. **Stevens, B. L., Lewis, F. L., & Johnson, E. N. (2015)**. *Aircraft Control and Simulation: Dynamics, Controls Design, and Autonomous Systems* (3rd ed.). John Wiley & Sons.
   - Referência clássica de engenharia de controle sobre leis de proteção de envelope de voo (*flight envelope protection*), limitação de autoridade de comando (*command limiting*) e arquitetura fly-by-wire.
2. **Battin, R. H. (1999)**. *An Introduction to the Mathematics and Methods of Astrodynamics*. AIAA Education Series, Reston, VA.
   - Obra de referência em mecânica celeste aplicada, aproximação orbital relativa (*relative motion guidance*) e vetores de fechamento radial.
3. **NASA SP-8015 (1968)**. *Guidance and Navigation for Entry Vehicles*. NASA Space Vehicle Design Criteria, National Aeronautics and Space Administration.
   - Critério de engenharia aeroespacial sobre corredores seguros de velocidade de aproximação em envelopes planetários.

---

## 5. Novos Testes Unitários de Invariância

Para blindar o sistema contra regressões e provar matematicamente a independência de catálogo, foi adicionado o teste:
`T_P0510_GATED_BODY_IDENTIFICATION_INDEPENDENT_OF_OBSTACLE_ORDER` em `tests/free-cosmic-flight.test.ts`.

O teste valida:
1. **Ambiente Completo do Sistema Solar**: Com Sol, Mercúrio, Vênus, Terra, Marte, Júpiter, etc., ativos e orbitando, a aproximação da Terra identifica com precisão `gatedBodyId === 'earth'` e velocidade limitada abaixo de $16c$.
2. **Invariância de Permutação de Envelopes**: Executa o controlador com listas permutadas `[Earth, Mars]` vs `[Mars, Earth]`. Em ambos os casos, a telemetria resolve identicamente para `'earth'`, provando que a ordenação interna da lista de exclusão não afeta a autoridade de gating.

---

## 6. Resumo das Alterações por Arquivo

1. [src/world/travel/CosmicFlight.ts](file:///c:/Projetos/Dr-Manaus/src/world/travel/CosmicFlight.ts):
   - Separação de `throttleGatedBodyId` e `decelGatedBodyId`.
   - Cálculo de $v_{rel}$ relativo ao corpo de referência de cada obstáculo.
   - Cascata determinística de resolução de telemetria por ordem de autoridade dinâmica.
2. [tests/free-cosmic-flight.test.ts](file:///c:/Projetos/Dr-Manaus/tests/free-cosmic-flight.test.ts):
   - Adicionado teste `T_P0510_GATED_BODY_IDENTIFICATION_INDEPENDENT_OF_OBSTACLE_ORDER`.
3. [docs/world/34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md](file:///c:/Projetos/Dr-Manaus/docs/world/34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md):
   - Retificação das citações bibliográficas (expurgação do SP-8007 espúrio e inserção de Stevens et al., Battin e NASA SP-8015).
4. [docs/world/35-status-P0.5.9-PROXIMITY-THROTTLE-GATING.md](file:///c:/Projetos/Dr-Manaus/docs/world/35-status-P0.5.9-PROXIMITY-THROTTLE-GATING.md):
   - Registro oficial do resultado da auditoria do CI (Run 41119879842) e transição para o P0.5.10.
5. [docs/world/36-status-P0.5.10-GATED-BODY-SELECTION-AND-SOURCE-AUDIT.md](file:///c:/Projetos/Dr-Manaus/docs/world/36-status-P0.5.10-GATED-BODY-SELECTION-AND-SOURCE-AUDIT.md):
   - Este documento canônico do Patch P0.5.10.
6. [docs/world/15-status.md](file:///c:/Projetos/Dr-Manaus/docs/world/15-status.md):
   - Atualização do log cronológico e estado das metas do P0.5.
