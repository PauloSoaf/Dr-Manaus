# DR-MANAUS | Active Patch Specification

## Milestone Concluído: BH0 — Buracos Negros: Descritor e Modelo Astrofísico Relativístico

### Resumo da Entrega BH0
1. `src/world/celestial/BlackHoleDescriptor.ts`:
   - Fórmulas relativísticas: Schwarzschild ($r_s = 2GM/c^2$), horizonte de Kerr ($r_+$), esfera de fótons ($r_{\text{ph}}$), ISCO ($r_{\text{isco}}$) e sombra aparente ($R_{\text{shadow}} \approx 2.598 r_s$).
   - Perfis canônicos para Sagittarius A* e M31*.
   - Gerador determinístico de buracos negros estelares procedurais sem `Math.random()`.
2. `src/world/providers/BlackHoleProvider.ts`:
   - Renderização da sombra e disco de acreção escalonados relativísticamente com descarte limpo.
3. `src/world/travel/UniversalTargetCatalog.ts` e `src/ui/map/UniversalMapPanel.ts`:
   - Resolução de chaves universais e apresentação dedicada com cartão astrofísico e selo `● Singularidade`.
4. `tests/black-hole-astrophysics-bh0.test.ts`:
   - 8 testes cobrindo todas as fórmulas, perfis, integridade e UI.

---

## Próximo Milestone em Planejamento: BH1 — Gravidade Relativística e Captura de Horizonte

### 1. Objetivos do BH1
- Atração gravitacional relativística com aceleração efetiva $g(r) = \frac{GM}{r^2 (1 - r_s/r)}$ para distâncias $r > r_s$.
- Arrasto inercial de referencial (frame dragging) decorrente do spin do buraco negro no regime de Kerr próximo à ergoesfera.
- Estado de captura: ao atingir o horizonte de eventos $r \le r_+$, o controle de voo convencional é desativado (captura gravitacional) com efeito de distorção cósmica antes de transição para túnel de dobra (milestone BH2).
