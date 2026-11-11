# DR-MANAUS | Patch BH0 — Modelo Astrofísico e Relativístico de Buracos Negros

## 1. Visão Geral

- **Patch:** BH0
- **Título:** Modelo Astrofísico e Relativístico de Buracos Negros (Sagittarius A*, M31 SMBH e Remanescentes Estelares)
- **Baseline Auditado:** `c48fc64b456cf489d038050bdfca09f1c9dc6d56` (Patch U4.5.4.1 hotfix, typecheck PASS).
- **Branch de Trabalho:** `feat/universe-map`
- **Repositório:** [https://github.com/PauloSoaf/Dr-Manaus](https://github.com/PauloSoaf/Dr-Manaus)

---

## 2. Diagnóstico e Objetivos

Anteriormente, o sistema renderizava buracos negros apenas através de um provedor gráfico visual simplificado (`BlackHoleProvider`), que desenhava uma esfera preta e um toro com base em fórmulas inline e valores estáticos. Faltavam:
1. Contrato astrofísico formal e canônico com métrica de Schwarzschild ($r_s = 2GM/c^2$) e horizonte de eventos de Kerr ($r_+$).
2. Cálculo analítico da esfera de fótons ($r_{\text{ph}}$), órbita circular estável mais interna (ISCO $r_{\text{isco}}$) e ampliação da sombra óptica aparente por lente gravitacional ($R_{\text{shadow}} \approx 2.598 r_s$).
3. Perfis canônicos precisos de Sagittarius A* ($4.297 \times 10^6 M_\odot$, spin $a_* = 0.90$) e Andromeda M31* ($1.4 \times 10^8 M_\odot$).
4. Geração determinística de buracos negros estelares procedurais raros em setores cósmicos sem `Math.random()`.
5. Apresentação precisa e dedicada no cartão do Catálogo Universal e no Atlas Cósmico, com classificação taxonômica autêntica e indicação explícita de pouso impossível na singularidade.

---

## 3. Entregas Arquiteturais do Patch BH0

### P0 — Módulo Astrofísico Relativístico ([`BlackHoleDescriptor.ts`](file:///c:/Projetos/Dr-Manaus/src/world/celestial/BlackHoleDescriptor.ts))
- **Constantes Físicas Autorizadas:** $G = 6.67430 \times 10^{-11}\text{ m}^3\text{kg}^{-1}\text{s}^{-2}$, $c = 299792458\text{ m/s}$, $M_\odot = 1.98847 \times 10^{30}\text{ kg}$.
- **Formulação Relativística:**
  - `schwarzschildRadiusM(massKg)`: $r_s = \frac{2GM}{c^2}$ ($2.953\text{ km}$ por $M_\odot$).
  - `kerrHorizonRadiusM(massKg, spin01)`: $r_+ = \frac{GM}{c^2}(1 + \sqrt{1 - a_*^2})$ (com limite de Thorne $a_* \le 0.998$).
  - `photonSphereRadiusM(massKg, spin01)`: $r_{\text{ph}} = 2 \frac{GM}{c^2}(1 + \cos(\frac{2}{3}\arccos(-a_*)))$ ($1.5 r_s$ para Schwarzschild).
  - `iscoRadiusM(massKg, spin01)`: Formulação analítica de Bardeen, Press & Teukolsky (1972) ($3 r_s$ para Schwarzschild).
  - `blackHoleShadowRadiusM(massKg, spin01)`: Sombra gravitacional aparente $R_{\text{shadow}} = \frac{\sqrt{27}}{2} r_s (1 - 0.12 a_*^2)$.
  - `eddingtonLuminosityW(massKg)`: Limite de Eddington $L_{\text{edd}} \approx 1.26 \times 10^{31} \times (M/M_\odot)\text{ W}$.
- **Perfis Canônicos:**
  - `SAGITTARIUS_A_STAR`: $4.297 \times 10^6 M_\odot$, $r_s \approx 1.269 \times 10^{10}\text{ m}$ (~0.0848 AU), $R_{\text{shadow}} \approx 3.0 \times 10^{10}\text{ m}$, spin $a_* = 0.90$, disco de acreção em $T = 1.2 \times 10^6\text{ K}$.
  - `M31_CENTRAL_BLACK_HOLE`: $1.4 \times 10^8 M_\odot$, $r_s \approx 4.13 \times 10^{11}\text{ m}$ (~2.76 AU), spin $a_* = 0.80$, disco de acreção em $T = 2.5 \times 10^6\text{ K}$.
- **Gerador Procedural:**
  - `generateStellarBlackHole(galaxyId, sector)`: Remanescentes estelares de $5 M_\odot$ a $35 M_\odot$ em ~1.25% dos setores cósmicos, com sementes inteiras estáveis sem `Math.random()`.

### P1 — Renderização Relativística e Escala ([`BlackHoleProvider.ts`](file:///c:/Projetos/Dr-Manaus/src/world/providers/BlackHoleProvider.ts))
- Suporte a `BlackHoleDescriptor | BlackHoleDefinition`.
- Raio da malha da esfera negra agora dimensionado pela sombra óptica aparente ampliada por lente gravitacional (`shadowR`).
- Disco de acreção acoplado aos limites do ISCO e raio relativístico com material emissivo de alta intensidade.
- Método `dispose()` adicionado para liberação controlada de recursos Three.js.

### P1 — Catálogo e Interface do Usuário ([`UniversalTargetCatalog.ts`](file:///c:/Projetos/Dr-Manaus/src/world/travel/UniversalTargetCatalog.ts) e [`UniversalMapPanel.ts`](file:///c:/Projetos/Dr-Manaus/src/ui/map/UniversalMapPanel.ts))
- Resolução e decodificação de chaves universais de buracos negros (`universe/:galaxyId/:x,:y,:z/black-hole/:objectId`).
- Cartão lateral com seção dedicada `ASTROFÍSICA & HORIZONTE DE EVENTOS` exibindo massa solar, spin Kerr, raios de Schwarzschild, Kerr e sombra lenteada, e indicação clara de `✗ Pouso impossível (singularidade relativística)`.
- Selo visual `● Singularidade` no Atlas Cósmico.

### P2 — Suíte de Testes Automatizada ([`black-hole-astrophysics-bh0.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/black-hole-astrophysics-bh0.test.ts))
- 8 testes cobrindo todas as fórmulas físicas, perfis canônicos, gerador determinístico, taxonomia, catálogo, provedor gráfico e renderização HTML da interface.

---

## 4. Matriz de Cobertura de Testes

| Teste | Objetivo | Status |
| :--- | :--- | :---: |
| `T_BH0_01` | Fórmulas relativísticas de Schwarzschild, Kerr, ISCO, esfera de fótons e sombra | APROVADO |
| `T_BH0_02` | Perfil canônico de Sagittarius A* (massa, $r_s$, sombra, spin e acreção) | APROVADO |
| `T_BH0_03` | Perfil canônico de M31* (Andrômeda SMBH) e busca no registro | APROVADO |
| `T_BH0_04` | Gerador procedural determinístico de buracos negros estelares ($5$ a $35 M_\odot$) | APROVADO |
| `T_BH0_05` | Resolução de chaves universais e busca no `UniversalTargetCatalog` | APROVADO |
| `T_BH0_06` | Validação estrita de taxonomia canônica vs procedural em `isCanonicalTarget` | APROVADO |
| `T_BH0_07` | Escala e ciclo de vida do `BlackHoleProvider` (esfera de sombra, disco, dispose) | APROVADO |
| `T_BH0_08` | Renderização do cartão de alvo com seção astrofísica e modo de pouso impossível | APROVADO |
