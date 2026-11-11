# DR-MANAUS | Active Patch Specification

## Milestone Ativo: BH0 — Buracos Negros: Descritor e Modelo Astrofísico Relativístico

### 1. Contexto e Justificativa
Na especificação [`specs/UNIVERSE-MAP-COMPLETION-EPIC.md`](file:///c:/Projetos/Dr-Manaus/specs/UNIVERSE-MAP-COMPLETION-EPIC.md) e [`specs/dr-manaus-cosmic-night-specs/11-BLACK-HOLES.md`](file:///c:/Projetos/Dr-Manaus/specs/dr-manaus-cosmic-night-specs/11-BLACK-HOLES.md), os marcos pós-U4.5 estão definidos como **BH0**, **BH1**, **BH2**, seguidos de **U5** e **U6**.
Atualmente, `BlackHoleProvider` renderiza apenas uma esfera preta e um toro alaranjado básico em `milky_way`, sem integração como alvo navegável de primeira classe no Catálogo Universal de Alvos (`UniversalNavigationTarget`), sem cálculo do raio de Schwarzschild $r_s = \frac{2GM}{c^2}$ unificado com órbita circular estável mais interna (ISCO $r_{\text{isco}} = 3 r_s$ para Schwarzschild ou dependente de spin para Kerr), sem anel de fótons ($r_{\text{ph}} = 1.5 r_s$), e sem representação de buracos negros estelares procedurais nem de M31 (Andrômeda).

### 2. Objetivos de Engenharia para o BH0
1. **Contrato de Dados `BlackHoleDescriptor`:**
   - Massa em kg ($M$), parâmetro de rotação/spin adimensional $a_* \in [0, 1[$.
   - Raio de Schwarzschild $r_s = \frac{2GM}{c^2}$ e horizonte de eventos de Kerr $r_+ = \frac{GM}{c^2}(1 + \sqrt{1 - a_*^2})$.
   - Raio da esfera de fótons $r_{\text{photon}}$ e disco de acreção ($r_{\text{in}} \ge r_{\text{isco}}$, $r_{\text{out}}$, temperatura de pico $T_K$ e luminosidade de Eddington).
2. **Registro de Alvos no Catálogo Universal:**
   - Sagittarius A* (`sgra` em `milky_way`), SMBH de Andrômeda (`m31_smbh`) e buracos negros estelares procedurais raros integrados como alvos do tipo `UniversalNavigationTarget` com `kind: 'black_hole'` ou `kind: 'star'` especializado.
3. **Apresentação e Escala no `BlackHoleProvider`:**
   - Cálculo estrito do raio de horizonte em metros relativísticos, projetado sem colapsar a precisão flutuante na renderização em espaço de câmera relativa.
   - Sombra observável do buraco negro com ampliação gravitacional ($R_{\text{shadow}} = \sqrt{27}/2 \cdot r_s \approx 2.6 r_s$).
4. **Proteção de Travessia e Física Limítrofe:**
   - Buracos negros não devem ser tratados como planetas rochosos com casca de colisão comum; o modo de pouso deve ser explicitamente inóspito (`landingMode: 'none'`), com fronteira de captura relativística documentada para o subsequente milestone BH1.
5. **Suíte de Testes Automatizada:**
   - `tests/black-hole-astrophysics-bh0.test.ts` cobrindo formulações relativísticas exatas, geração determinística e resolução no catálogo universal.

### 3. Arquivos Envolvidos
- `src/world/celestial/BlackHoleDescriptor.ts` (Novo)
- `src/world/providers/BlackHoleProvider.ts` (Refatorado)
- `src/world/travel/UniversalNavigationTarget.ts` e `UniversalTargetCatalog.ts` (Integrado)
- `tests/black-hole-astrophysics-bh0.test.ts` (Novo)
- Documentação de status e tracker.
