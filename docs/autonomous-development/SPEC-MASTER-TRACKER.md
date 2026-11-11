# DR-MANAUS | Master Specification Tracker

Este documento consolida, reconcilia e rastreia o status de todos os requisitos do projeto DR-MANAUS derivados de `specs/`, `docs/`, `src/` e `tests/`.

---

## 1. Glossário de Status

- `TODO`: Requisito mapeado, dependências aguardando ou em fila de prioridade.
- `IN_PROGRESS`: Em especificação ativa ou implementação no sprint corrente.
- `IMPLEMENTED`: Código de produção desenvolvido e testado localmente.
- `CI_VERIFIED`: Validado pelo pipeline oficial do GitHub Actions com cobertura de testes.
- `IMPLEMENTED_PENDING_ACCEPTANCE`: Implementação em produção validada por testes de unidade/integração, pendente de homologação visual humana no navegador.
- `ACCEPTED`: Homologado formalmente com validação de gameplay e visual.
- `BLOCKED`: Impedido por dependência externa ou limitação de infraestrutura.
- `SUPERSEDED`: Requisito histórico substituído por especificação posterior mais avançada.
- `DEFERRED`: Requisito explicitamente adiado para fases posteriores (ex: destruição avançada D2–D5).

---

## 2. Matriz Consolidada de Especificações

### Módulo A — Estabilidade, Coordenadas e Persistência
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `STAB-01` | `03-COORDINATES-AND-REFERENCE-FRAMES.md` | Coordenadas astronômicas hierárquicas em BigInt e Floating Origin 3D | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `STAB-02` | `09-PERSISTENCE.md` | Persistência determinística com SaveManager | P1 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `STAB-03` | `U4.5.4` | Persistência atômica em lote (`SaveManager.batch`), eliminando write-amplification | P0 | `CI_VERIFIED` | `d41fc2d` | `tests/procedural-surfaces-and-atlas-opt-u454.test.ts` |
| `STAB-04` | `U4.5.4.1` | Hotfix de consistência geométrica e autoridade NOAA ETOPO5 de relevo | P0 | `CI_VERIFIED` | `c48fc64` | `tests/procedural-surfaces-and-atlas-opt-u454.test.ts` |

---

### Módulo B — Manaus e Superfície Terrestre
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `MAN-01` | `05-MANAUS-FULL-WGS84-UNIFICATION.md` | Frame ECEF/ENU centrado em Manaus (-3.119028, -60.021731) | P0 | `IMPLEMENTED_PENDING_ACCEPTANCE` | `baseline` | `tests/regression/` |
| `MAN-02` | `04-MANAUS-WGS84-MIGRATION.md` | Georreferenciamento de ruas, Arena da Amazônia e bacia hidrográfica | P1 | `IMPLEMENTED_PENDING_ACCEPTANCE` | `baseline` | `tests/regression/` |
| `MAN-03` | `07-EARTH-TERRAIN-DEM.md` | Relevo global ETOPO5 do NOAA (5 arc-minute) downsampleado a 5.742m max | P0 | `CI_VERIFIED` | `baseline` | `tests/procedural-surfaces-and-atlas-opt-u454.test.ts` |

---

### Módulo C — Personagem, Voo e Poderes
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `HERO-01` | `06-ZERO-G-AND-GRAVITY-DOMAINS.md` | Transição física entre gravidade terrestre e gravidade zero espacial | P1 | `IMPLEMENTED_PENDING_ACCEPTANCE` | `baseline` | `tests/regression/` |
| `HERO-02` | `06-HIGH-SPEED-TRAVEL.md` | Voo supersônico, hipersônico e controle de atitude orbital | P1 | `IMPLEMENTED_PENDING_ACCEPTANCE` | `baseline` | `tests/regression/` |
| `HERO-03` | `D1.1-FINAL-HARDENING.md` | Impacto catastrófico e formação de cratera volumétrica local (D1.1) | P1 | `CI_VERIFIED` | `c92249b` | `tests/regression/` |
| `HERO-04` | `06-PLANET-VOLUME-NEXT-PHASES.md` | Destruição avançada, túneis e quebra planetária profunda (D2 a D5) | P3 | `DEFERRED` | — | Aguardando pós-universo |

---

### Módulo D — Planetas e Superfícies
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `PLAN-01` | `07-SOLAR-SYSTEM-COMPLETE.md` | 8 planetas do Sistema Solar com órbitas Keplerianas autênticas | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `PLAN-02` | `08-PLANET-SURFACES-AND-LANDING.md` | Superfícies canônicas da Lua (LRO LOLA) e Marte (Olympus Mons) | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `PLAN-03` | `U4.5.3` | Taxonomia de corpos (`WorldClassification`), equilíbrio térmico e gravidade superficial | P0 | `CI_VERIFIED` | `356b98e` | `tests/stellar-planetary-diversity-u453.test.ts` |
| `PLAN-04` | `U4.5.4` | Terrenos fractais determinísticos para mundos sólidos procedurais (biomas) | P0 | `CI_VERIFIED` | `d41fc2d` | `tests/procedural-surfaces-and-atlas-opt-u454.test.ts` |
| `PLAN-05` | `U4.5.4` | Hidrosfera coerente: mundos oceânicos com mar plano a 0m e continentes elevados | P0 | `CI_VERIFIED` | `d41fc2d` | `tests/procedural-surfaces-and-atlas-opt-u454.test.ts` |

---

### Módulo E — Navegação Cósmica, Atlas e Hypercruise
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `NAV-01` | `U0-UNIVERSAL-NAVIGATION-TARGET.md` | Descritor imutável de alvo de navegação universal (`UniversalNavigationTarget`) | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `NAV-02` | `U2-GALAXY-RUNTIME-ANDROMEDA.md` | Sessões de galáxia para Via Láctea e Andrômeda no Grupo Local | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `NAV-03` | `U3-UNIVERSAL-HYPERCRUISE.md` | Hypercruise interestelar contínuo em segundos com desaceleração em destino | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `NAV-04` | `U4-PROCEDURAL-GALAXIES.md` | Geração procedural sob demanda de galáxias espirais, elípticas e irregulares | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `NAV-05` | `U4.5.2` / `U4.5.3.1` | Atlas Cósmico interativo, busca sem acentos, taxonomia canônica e pouso em fotosfera | P0 | `CI_VERIFIED` | `d9e777f` | `tests/atlas-procedural-integration-u4531.test.ts` |

---

### Módulo F — Buracos Negros (Próximo Marco Crítico)
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `BH-01` | `11-BLACK-HOLES.md` | **BH0:** Descritor `BlackHoleDescriptor`, raio de Schwarzschild $r_s$, horizonte Kerr $r_+$, ISCO e anel de fótons | P0 | `IMPLEMENTED` | `HEAD` | `tests/black-hole-astrophysics-bh0.test.ts` |
| `BH-02` | `11-BLACK-HOLES.md` | **BH0:** Integração de Sagittarius A*, M31 SMBH e buracos negros estelares no Catálogo Universal | P0 | `IMPLEMENTED` | `HEAD` | `tests/black-hole-astrophysics-bh0.test.ts` |
| `BH-03` | `11-BLACK-HOLES.md` | **BH1:** Atração gravitacional relativística, curvatura de trajetória e estado de captura de horizonte | P1 | `IMPLEMENTED` | `HEAD` | `tests/black-hole-gravity-bh1.test.ts` |
| `BH-04` | `11-BLACK-HOLES.md` | **BH2:** Rede de trânsito dimensional com saídas persistentes via `universeSeed + traversalCounter` | P1 | `IMPLEMENTED` | `HEAD` | `tests/black-hole-transit-bh2.test.ts` |

---

### Módulo G — Escala Cosmológica e Teia Cósmica
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `COSMO-01` | `UNIVERSE-MAP-COMPLETION-EPIC.md` | **U5:** Mapa Universal Interativo multiescala, breadcrumbs canônicos (`UNIVERSE/LOCAL GROUP/MW/SOL/EARTH/MANAUS`) e modelo de coordenadas `drm:v1://` | P0 | `IMPLEMENTED` | `HEAD` | `tests/universal-map-multiscale-u5.test.ts` |
| `COSMO-02` | `13-OBSERVABLE-UNIVERSE-HORIZON.md`| **U6:** Horizonte cosmológico observável centrado no observador, sem paredes físicas ou centro absoluto, e filamentos da Teia Cósmica | P1 | `IMPLEMENTED` | `HEAD` | `tests/cosmological-structure-u6.test.ts` |
