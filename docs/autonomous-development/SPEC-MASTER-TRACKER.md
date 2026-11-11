# DR-MANAUS | Master Specification Tracker

Este documento consolida, reconcilia e rastreia o status de todos os requisitos do projeto DR-MANAUS derivados de `specs/`, `docs/`, `src/` e `tests/`.

---

## 1. Glossário de Status

- `TODO`: Requisito mapeado, dependências aguardando ou em fila de prioridade.
- `IN_PROGRESS`: Em especificação ativa ou implementação no sprint corrente.
- `IMPLEMENTED`: Código de produção desenvolvido e testado localmente.
- `CI_VERIFIED`: Validado pelo pipeline oficial do GitHub Actions com cobertura integral de testes.
- `IMPLEMENTED_PENDING_ACCEPTANCE`: Implementação em produção validada por testes de unidade/integração, aguardando inspeção visual humana no navegador.
- `ACCEPTED`: Homologado formalmente com validação de gameplay e visual.
- `BLOCKED`: Impedido por dependência externa ou limitação de infraestrutura.
- `SUPERSEDED`: Requisito histórico substituído por especificação posterior mais avançada.
- `DEFERRED`: Requisito explicitamente adiado para fases posteriores (ex: destruição avançada D2–D5).

---

## 2. Matriz Consolidada de Especificações

### Módulo A — Estabilidade, Coordenadas e Persistência
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `STAB-01` | `03-COORDINATES-AND-REFERENCE-FRAMES.md` | Coordenadas astronômicas hierárquicas em BigInt e Floating Origin 3D | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/universe.test.ts` |
| `STAB-02` | `09-PERSISTENCE.md` | Persistência determinística com SaveManager | P1 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `STAB-03` | `U4.5.4` | Persistência atômica em lote (`SaveManager.batch`), eliminando write-amplification | P0 | `CI_VERIFIED` | `d41fc2d` | `tests/procedural-surfaces-and-atlas-opt-u454.test.ts` |
| `STAB-04` | `U4.5.4.1` | Hotfix de consistência geométrica e autoridade NOAA ETOPO5 de relevo | P0 | `CI_VERIFIED` | `c48fc64` | `tests/procedural-surfaces-and-atlas-opt-u454.test.ts` |

---

### Módulo B — Manaus e Superfície Terrestre
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `MAN-01` | `05-MANAUS-FULL-WGS84-UNIFICATION.md` | Frame ECEF/ENU centrado em Manaus (-3.119028, -60.021731) | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/manaus.test.ts` |
| `MAN-02` | `04-MANAUS-WGS84-MIGRATION.md` | Georreferenciamento de ruas, Arena da Amazônia e bacia hidrográfica | P1 | `CI_VERIFIED` | `baseline` | `tests/regression/manaus.test.ts` |
| `MAN-03` | `07-EARTH-TERRAIN-DEM.md` | Relevo global ETOPO5 do NOAA (5 arc-minute) downsampleado a 5.742m max | P0 | `CI_VERIFIED` | `baseline` | `tests/procedural-surfaces-and-atlas-opt-u454.test.ts` |
| `MAN-04` | `CLAUDE_NO_RUSH_EARTH_VISUAL_HARDENING` | Renderizador vetorial de rios continentais e bacia amazônica sem artefatos | P1 | `CI_VERIFIED` | `22e765d` | `tests/earth-orbital-rivers.test.ts` |

---

### Módulo C — Personagem, Voo e Poderes
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `HERO-01` | `06-ZERO-G-AND-GRAVITY-DOMAINS.md` | Transição física entre gravidade terrestre e gravidade zero espacial | P1 | `CI_VERIFIED` | `baseline` | `tests/regression/solar.test.ts` |
| `HERO-02` | `06-HIGH-SPEED-TRAVEL.md` | Voo supersônico, hipersônico e controle de atitude orbital | P1 | `CI_VERIFIED` | `baseline` | `tests/space-controls.test.ts` |
| `HERO-03` | `06-COSMIC-FLIGHT-GEARS.md` | Escala cósmica de engrenagens de warp (convencional, interestelar, intergaláctico até $1.5\times 10^{12}c$) | P0 | `CI_VERIFIED` | `57d058c` | `tests/free-cosmic-flight.test.ts` |
| `HERO-04` | `06-POWERS-AND-GAMEPLAY.md` | Sistema de habilidades do herói, teleporte local e telemetria de voo | P1 | `CI_VERIFIED` | `baseline` | `tests/player-asset.test.ts` |

---

### Módulo D — Planetas, Mundos Procedurais e Superfícies
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `PLAN-01` | `07-SOLAR-SYSTEM-COMPLETE.md` | 8 planetas do Sistema Solar com órbitas Keplerianas autênticas | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/solar.test.ts` |
| `PLAN-02` | `08-PLANET-SURFACES-AND-LANDING.md` | Superfícies canônicas da Lua (LRO LOLA) e Marte (Olympus Mons) | P0 | `CI_VERIFIED` | `baseline` | `tests/moon-landing-hardening.test.ts` |
| `PLAN-03` | `U4.5.3` | Taxonomia de corpos (`WorldClassification`), equilíbrio térmico e gravidade superficial | P0 | `CI_VERIFIED` | `356b98e` | `tests/stellar-planetary-diversity-u453.test.ts` |
| `PLAN-04` | `U4.5.4` | Terrenos fractais determinísticos para mundos sólidos procedurais (biomas) | P0 | `CI_VERIFIED` | `d41fc2d` | `tests/procedural-surfaces-and-atlas-opt-u454.test.ts` |
| `PLAN-05` | `U4.5.4` | Hidrosfera coerente: mundos oceânicos com mar plano a 0m e continentes elevados | P0 | `CI_VERIFIED` | `d41fc2d` | `tests/procedural-surfaces-and-atlas-opt-u454.test.ts` |
| `PLAN-06` | `21-status-SUN-APPROACH-P0.md` | Aproximação à fotosfera solar, radiação e pouso em atmosfera estelar | P0 | `CI_VERIFIED` | `baseline` | `tests/sun-approach.test.ts` |

---

### Módulo E — Navegação Cósmica, Atlas e Hypercruise
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `NAV-01` | `U0-UNIVERSAL-NAVIGATION-TARGET.md` | Descritor imutável de alvo de navegação universal (`UniversalNavigationTarget`) | P0 | `CI_VERIFIED` | `baseline` | `tests/universal-navigation-target.test.ts` |
| `NAV-02` | `U2-GALAXY-RUNTIME-ANDROMEDA.md` | Sessões de galáxia para Via Láctea e Andrômeda no Grupo Local | P0 | `CI_VERIFIED` | `baseline` | `tests/galaxy-runtime.test.ts` |
| `NAV-03` | `U3-UNIVERSAL-HYPERCRUISE.md` | Hypercruise interestelar contínuo com aceleração/desaceleração assistida | P0 | `CI_VERIFIED` | `baseline` | `tests/universal-hypercruise.test.ts` |
| `NAV-04` | `U4-PROCEDURAL-GALAXIES.md` | Geração procedural sob demanda de galáxias espirais, elípticas e irregulares | P0 | `CI_VERIFIED` | `baseline` | `tests/procedural-galaxy-generator.test.ts` |
| `NAV-05` | `U4.5.2` / `U4.5.3.1` | Atlas Cósmico interativo, busca sem acentos, taxonomia canônica e pouso em fotosfera | P0 | `CI_VERIFIED` | `d9e777f` | `tests/atlas-procedural-integration-u4531.test.ts` |
| `NAV-06` | `ISSUE-02` | Otimização de escala e cache do Atlas Cósmico com busca $O(N)$ em mapa indexado | P1 | `CI_VERIFIED` | `063190f` | `tests/atlas-scale-opt-issue02.test.ts` |

---

### Módulo F — Buracos Negros, Gravidade Relativística e Trânsito
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `BH-01` | `11-BLACK-HOLES.md` | **BH0:** Descritor `BlackHoleDescriptor`, raio de Schwarzschild $r_s$, horizonte Kerr $r_+$, ISCO e anel de fótons | P0 | `CI_VERIFIED` | `998871d` | `tests/black-hole-astrophysics-bh0.test.ts` |
| `BH-02` | `11-BLACK-HOLES.md` | **BH0:** Integração de Sagittarius A*, M31 SMBH e buracos negros estelares no Catálogo Universal | P0 | `CI_VERIFIED` | `998871d` | `tests/black-hole-astrophysics-bh0.test.ts` |
| `BH-03` | `11-BLACK-HOLES.md` | **BH1:** Módulo de gravidade relativística Paczyński-Wiita, arrasto Lense-Thirring e escape de emergência | P0 | `CI_VERIFIED` | `95de474` | `tests/black-hole-gravity-bh1.test.ts` |
| `BH-04` | `55-status-BH-RUNTIME.md` | **BH1.1:** Integração da gravidade relativística e captura de horizonte no loop principal (`BlackHoleRuntime`) | P0 | `CI_VERIFIED` | `7dc0f57` | `tests/black-hole-runtime-integration.test.ts` |
| `BH-05` | `55-status-BH-RUNTIME.md` | **BH1.2:** Telemetria HUD em voo cósmico (zona de proximidade, raio $r_s$, dilatação temporal $\tau$) | P1 | `CI_VERIFIED` | `fdad6f7` | `tests/hud-presentation.test.ts` |
| `BH-06` | `55-status-BH-RUNTIME.md` | **BH1.3:** Buracos negros estelares procedurais ativos no runtime de atração e captura espacial | P0 | `CI_VERIFIED` | `2b677af` | `tests/black-hole-runtime-integration.test.ts` |
| `BH-07` | `11-BLACK-HOLES.md` | **BH2:** Módulo da rede de trânsito dimensional e roteamento quântico determinístico | P0 | `CI_VERIFIED` | `e28668c` | `tests/black-hole-transit-bh2.test.ts` |
| `BH-08` | `55-status-BH-RUNTIME.md` | **BH2.1:** Trânsito com persistência transacional (`reserve`/`commit`/`abort`) e handoff seguro fora do horizonte | P0 | `CI_VERIFIED` | `7dc0f57` | `tests/black-hole-runtime-integration.test.ts` |
| `BH-09` | `55-status-BH-RUNTIME.md` | **BH2.2:** Apresentação 3D do túnel de minhoca (`WormholeTunnelPresentation`) com ribs, streaks e abertura | P1 | `CI_VERIFIED` | `HEAD` | `tests/wormhole-tunnel-presentation.test.ts` |
| `BH-10` | `ISSUE-01` | Orientação relativística do anel de fótons orientada ao observador no `BlackHoleProvider` | P1 | `CI_VERIFIED` | `2e06284` | `tests/black-hole-astrophysics-bh0.test.ts` |

---

### Módulo G — Escala Cosmológica e Teia Cósmica
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `COSMO-01` | `UNIVERSE-MAP-COMPLETION-EPIC.md` | **U5:** Mapa Universal Interativo multiescala, breadcrumbs canônicos e modelo de coordenadas `drm:v1://` | P0 | `CI_VERIFIED` | `abffab1` | `tests/universal-map-multiscale-u5.test.ts` |
| `COSMO-02` | `13-OBSERVABLE-UNIVERSE-HORIZON.md`| **U6:** Horizonte cosmológico centrado no observador, sem paredes físicas ou centro absoluto, e filamentos da Teia Cósmica | P1 | `CI_VERIFIED` | `09a13f3` | `tests/cosmological-structure-u6.test.ts` |

---

### Módulo H — Teleporte Universal Infinito e Handoff Seguro
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `TEL-01` | `05-INFINITE-TELEPORT.md` | **U7:** Resolução hierárquica em 4 níveis (colisor local, WGS84/Lua/Marte analítico, mira celeste angular, coordenadas/URI) | P0 | `CI_VERIFIED` | `8845b4d` | `tests/universal-teleport-service.test.ts` |
| `TEL-02` | `05-INFINITE-TELEPORT.md` | Handoff transacional atômico e reciclagem dinâmica de referenciais de superfície | P0 | `CI_VERIFIED` | `8845b4d` | `tests/universal-teleport-service.test.ts` |

---

### Módulo I — Detecção Contínua de Colisão (CCD) e Segurança Celestial
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `CCD-01` | `02-PATCH-CELESTIAL-CCD-P0.md` | Swept-sphere continuous collision detection contra corpos astronômicos em alta velocidade | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `CCD-02` | `35-status-P0.5.9-PROXIMITY-THROTTLE-GATING.md` | Proximity speed gating e limitação fly-by-wire de empuxo warp | P0 | `CI_VERIFIED` | `baseline` | `tests/space-controls.test.ts` |
| `CCD-03` | `17-status-CELESTIAL-IMPACT-POLICY.md` | Políticas de impacto celeste (graze, atmospheric drag, catastrophic impact, landing-capture) | P0 | `CI_VERIFIED` | `baseline` | `tests/celestial-impact-policy.test.ts` |
| `CCD-04` | `36-status-P0.5.10.md` | Envelopes de exclusão dinâmicos e prevenção de tunneling quântico em corpos celestes | P0 | `CI_VERIFIED` | `baseline` | `tests/celestial-impact-events.test.ts` |

---

### Módulo J — Destruição e Física Volumétrica
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `DEST-01` | `18-status-VOLUME-COLLISION-D0.md` | D0 Provedor de terreno volumétrico com Marching Cubes e dual-contouring | P1 | `CI_VERIFIED` | `baseline` | `tests/planet-volume-collision.test.ts` |
| `DEST-02` | `24-status-D1.1-FINAL-HARDENING.md` | D1.1 Cratera de impacto local em Manaus com malhas de cicatriz e debris pool | P1 | `CI_VERIFIED` | `c92249b` | `tests/destructible-world.test.ts` |
| `DEST-03` | `23-status-D1.2-HIGH-RES-IMPACT-CORE.md` | D1.2 High-resolution impact core e preservação de integridade de malha | P1 | `CI_VERIFIED` | `baseline` | `tests/rocky-impact-game.test.ts` |
| `DEST-04` | `06-PLANET-VOLUME-NEXT-PHASES.md` | D2 Escavação profunda e túneis contínuos em relevo volumétrico | P2 | `DEFERRED` | — | Aguardando conclusão de cosmos |
| `DEST-05` | `06-PLANET-VOLUME-NEXT-PHASES.md` | D3 Fratura geomecânica em grande escala e desabamento estrutural | P3 | `DEFERRED` | — | Aguardando D2 |
| `DEST-06` | `06-PLANET-VOLUME-NEXT-PHASES.md` | D4 Destruição planetária parcial e ejeção de escombros em órbita | P3 | `DEFERRED` | — | Aguardando D3 |
| `DEST-07` | `06-PLANET-VOLUME-NEXT-PHASES.md` | D5 Ruptura de corpos menores e dispersão orbital de asteroides | P3 | `DEFERRED` | — | Aguardando D4 |

---

### Módulo K — Streaming Global e Orçamento de Recursos
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `STRM-01` | `07-streaming.md` | Global Streaming Scheduler com priorização dinâmica por velocidade (`budgetForSpeed`) | P0 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `STRM-02` | `07-streaming.md` | Previsão de demanda direcional com PrefetchPredictor | P1 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `STRM-03` | `12-STREAMING-PERFORMANCE-CACHE.md` | Bounded cache enforcement e evição de tiles distantes | P1 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `STRM-04` | `06-DESTINATION-PREPARATION-HANDOFF.md` | Preparação transacional assíncrona de recursos antes de saltos (`prepareDemands`) | P0 | `CI_VERIFIED` | `8845b4d` | `tests/universal-teleport-service.test.ts` |

---

### Módulo L — Renderização Atmosférica e Transição Órbita-Superfície
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `REND-01` | `08-render-domains.md` | Rayleigh e Mie scattering com atenuação atmosférica realista | P1 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
| `REND-02` | `ISSUE-04` | Transição contínua Manaus-órbita com `orbitLift` e `uAtmosphereOpacity` cúbica Hermite | P1 | `CI_VERIFIED` | `57d058c` | `tests/terrestrial-orbital-transition-issue04.test.ts` |
| `REND-03` | `25-status-MANAUS-AERIAL-PRESENTATION-P0.md` | Apresentação aérea de Manaus com blending de textura orbital | P1 | `CI_VERIFIED` | `baseline` | `tests/regression/manaus.test.ts` |
| `REND-04` | `SpeedVFX.ts` | Vinheta óptica de velocidade supersônica com separação cromática periférica | P2 | `CI_VERIFIED` | `baseline` | `tests/regression/` |

---

### Módulo M — Tráfego Urbano, Iluminação e Clima
| ID | Fonte Documental | Descrição | Prioridade | Status | SHA de Implementação | Evidência de Teste |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `CITY-01` | `05-manaus-migration.md` | Grafo viário de Manaus e navegação autônoma de veículos terrestres | P2 | `CI_VERIFIED` | `baseline` | `tests/regression/manaus.test.ts` |
| `CITY-02` | `08-SUN-RENDERING-AND-LIGHTING.md` | Ciclo dia/noite e iluminação dinâmica com elevação solar precisa | P1 | `CI_VERIFIED` | `baseline` | `tests/regression/solar.test.ts` |
| `CITY-03` | `WeatherSystem.ts` | Sistema de clima dinâmico e cobertura de chuva equatorial | P2 | `CI_VERIFIED` | `baseline` | `tests/regression/` |
