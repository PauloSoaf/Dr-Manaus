# DR-MANAUS | Patch BH1 — Dinâmica Gravitacional Relativística e Captura de Horizonte

## 1. Visão Geral

- **Patch:** BH1
- **Título:** Dinâmica Gravitacional Relativística, Curvatura de Trajetória e Captura de Horizonte de Buracos Negros
- **Baseline Auditado:** `998871d87e07b22a00908eb8a37e5d95e26b2b54` (Patch BH0, typecheck PASS).
- **Branch de Trabalho:** `feat/universe-map`
- **Repositório:** [https://github.com/PauloSoaf/Dr-Manaus](https://github.com/PauloSoaf/Dr-Manaus)

---

## 2. Diagnóstico e Objetivos

No milestone BH0, foram estabelecidos os descritores relativísticos estáticos (raios de Schwarzschild, Kerr, ISCO, esfera de fótons e sombras óticas). O milestone BH1 introduz a física dinâmica de atração gravitacional, curvatura de trajetória, arrasto de referencial por spin e transição de estado de captura ao cruzar o horizonte de eventos:

1. **Aceleração Relativística Efetiva:**
   - Convergência assintótica com gravidade Newtoniana ($GM/r^2$) no campo distante ($r \gg r_s$).
   - Aceleração de Paczyński-Wiita ($a_{\text{PW}} = \frac{GM}{(r - r_s)^2}$) que reproduz a Órbita Circular Estável Mais Interna (ISCO) em $3 r_s$ e modela a barreira potencial relativística sem exigir a resolução de tensores completos de Einstein por frame.
2. **Arrasto de Referencial de Kerr (Efeito Lense-Thirring):**
   - Rotação do espaço-tempo em torno de buracos negros girantes ($a_* > 0$), induzindo velocidade azimutal de arrasto proporcional a $a_* / r^2$.
3. **Zonas de Proximidade e Telemetria:**
   - `'distant'` ($r > 100 r_s$): Gravidade de fundo desprezível.
   - `'influence'` ($10 r_s < r \le 100 r_s$): Início da curvatura de trajetória perceptível e aviso de telemetria.
   - `'strong-field'` ($r_{\text{isco}} < r \le 10 r_s$): Atração severa e distorção óptica por lente gravitacional crescente.
   - `'isco-zone'` ($r_+ < r \le r_{\text{isco}}$): Órbitas instáveis; requer empuxo máximo para não espiralar em direção ao horizonte.
   - `'captured'` ($r \le r_+$): Cruzamento do horizonte de eventos de Kerr. Todas as geodésicas convergem para a singularidade; voo convencional bloqueado.
4. **Dilatação Temporal Relativística e Velocidade de Escape:**
   - Fator de dilatação $\sqrt{1 - r_s / r}$, anulando-se no horizonte de eventos.
   - Velocidade de escape $v_{\text{esc}} = c \sqrt{r_s / r}$, atingindo exatamente $c$ em $r = r_s$.
5. **Avaliação de Escape de Emergência:**
   - Fora do horizonte, o jogador pode romper a atração caso possua empuxo superior à aceleração gravitacional local.
   - Dentro do horizonte ($r \le r_+$), o escape convencional é estritamente impossível pelas leis da relatividade geral.

---

## 3. Arquivos Modificados e Criados

1. [`src/world/celestial/BlackHoleGravity.ts`](file:///c:/Projetos/Dr-Manaus/src/world/celestial/BlackHoleGravity.ts) (**Novo Arquivo**)
   - Métodos analíticos: `paczynskiWiitaAccelerationMps2`, `newtonianAccelerationMps2`, `blackHoleEscapeVelocityMps`, `gravitationalTimeDilation`, `lenseThirringVelocityMps`.
   - Avaliação de telemetria e zonas: `evaluateBlackHoleProximity`.
   - Integração dinâmica de trajetória: `applyBlackHoleDynamics`.
   - Lógica de manobra de escape: `evaluateEmergencyEscape`.

2. [`tests/black-hole-gravity-bh1.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/black-hole-gravity-bh1.test.ts) (**Novo Arquivo**)
   - 7 testes automatizados cobrindo assíntotas de Paczyński-Wiita vs Newton, dilatação temporal, zonas de proximidade, arrasto de referencial de Kerr, curvatura dinâmica de trajetória, irreversibilidade da captura de horizonte e regras de empuxo de escape.

3. [`docs/world/15-status.md`](file:///c:/Projetos/Dr-Manaus/docs/world/15-status.md) (Modificado)
   - Atualizado com o registro detalhado do checkpoint BH1.

4. [`docs/world/49-status-BH1-BLACK-HOLE-GRAVITY-CAPTURE.md`](file:///c:/Projetos/Dr-Manaus/docs/world/49-status-BH1-BLACK-HOLE-GRAVITY-CAPTURE.md) (**Novo Arquivo**)
   - Relatório técnico completo do marco BH1.

---

## 4. Matriz de Cobertura de Testes

| Teste | Objetivo | Status |
| :--- | :--- | :---: |
| `T_BH1_01` | Assíntotas de Paczyński-Wiita ($GM/(r-r_s)^2$) vs Newton ($GM/r^2$) e proporção exata de $2.25\times$ no ISCO | APROVADO |
| `T_BH1_02` | Dilatação temporal gravitacional $\sqrt{1 - r_s/r}$ e velocidade de escape $c \sqrt{r_s/r}$ | APROVADO |
| `T_BH1_03` | Transição contínua das 5 zonas de proximidade e gradiente de intensidade de lente gravitacional | APROVADO |
| `T_BH1_04` | Arrasto inercial de referencial Lense-Thirring por spin de Kerr | APROVADO |
| `T_BH1_05` | Curvatura de trajetória dinâmica em aproximação lateral com limitação subluminal | APROVADO |
| `T_BH1_06` | Irreversibilidade da captura ao cruzar o horizonte de eventos de Kerr ($r \le r_+$) | APROVADO |
| `T_BH1_07` | Regras físicas de manobra de escape de emergência (empuxo suficiente fora vs impossibilidade dentro) | APROVADO |
