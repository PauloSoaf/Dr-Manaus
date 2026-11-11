# DR-MANAUS | Active Patch Specification

## Milestone Concluído: BH1 — Dinâmica Gravitacional Relativística e Captura de Horizonte

### Resumo da Entrega BH1
1. `src/world/celestial/BlackHoleGravity.ts`:
   - Aceleração efetiva de Paczyński-Wiita ($GM/(r-r_s)^2$) reproduzindo ISCO em $3 r_s$ e assíntota de Newton $GM/r^2$ no campo distante.
   - Arrasto de referencial de Kerr (efeito Lense-Thirring).
   - Classificação das 5 zonas de proximidade: `'distant'`, `'influence'`, `'strong-field'`, `'isco-zone'`, `'captured'`.
   - Dilatação temporal relativística $\sqrt{1 - r_s / r}$ e velocidade de escape $c \sqrt{r_s / r}$.
   - Curvatura dinâmica de trajetória e irreversibilidade da captura de horizonte ($r \le r_+$).
2. `tests/black-hole-gravity-bh1.test.ts`:
   - 7 testes automatizados cobrindo todas as leis e transições físicas.

---

## Próximo Milestone em Planejamento: BH2 — Rede Determinística de Trânsito Cósmico e Emergência de Dobra Espacial

### 1. Objetivos do BH2
- Fictional interior wormhole / bridge transit inspirado em relatividade de dimensões superiores.
- Função analítica de mapeamento de destino:
  `resolveBlackHoleTransitExit(universeSeed, sourceBlackHoleId, traversalCounter) -> UniverseLocation / UniverseAddress`.
- Persistência no `SaveManager` do contador de travessias (`traversalCounter`) e do histórico de saídas descobertas.
- Ponto de emergência seguro e pose de saída (`SpatialPose`) posicionado fora do horizonte de eventos do buraco negro ou estrutura de destino, prevenindo recaptura imediata.
