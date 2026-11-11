# DR-MANAUS | Final Acceptance Matrix

Matriz consolidada de critérios de aceite abrangendo todos os domínios do jogo, desde Manaus até as escalas cósmicas.

| Domínio | Especificação | Requisito Principal | Evidência Automatizada | Homologação Visual / Manual | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Manaus / Terrestre** | `05-MANAUS-FULL-WGS84-UNIFICATION.md` | Coordenadas reais WGS84, frame ECEF/ENU centrado em Manaus, Arena da Amazônia e rios | Suíte de regressão permanente | Verificação de malha e LOD de ruas a 60 FPS | `IMPLEMENTED_PENDING_ACCEPTANCE` |
| **Física & Voo** | `06-ZERO-G-AND-GRAVITY-DOMAINS.md` | Transição de gravidade terrestre para zero-g orbital, voo supersônico e hypersonic | Testes de física orbital | Resposta de controles e aceleração | `IMPLEMENTED_PENDING_ACCEPTANCE` |
| **Destruição D1** | `D1.1-FINAL-HARDENING.md` | Cratera volumétrica com retenção de até 3 regiões, sem vazamento de memória | Testes D1.1 e benchmark de volume | Deformação contínua da malha local | `CI_VERIFIED` |
| **Destruição D2-D5** | `06-PLANET-VOLUME-NEXT-PHASES.md` | Túneis, penetração profunda, ruptura de integridade planetária | A definir pós-universo | A definir pós-universo | `DEFERRED` |
| **Sistema Solar** | `07-SOLAR-SYSTEM-COMPLETE.md` | 8 planetas maiores, órbitas Keplerianas analíticas, iluminação física solar | Suíte SolarSystem e épocas | Alinhamento planetário e sombras | `CI_VERIFIED` |
| **Superfície Canônica** | `08-PLANET-SURFACES-AND-LANDING.md` | Relevo ETOPO5 da Terra, LRO LOLA da Lua, Olympus Mons de Marte | Testes de altimetria e colisão | Fidelidade geográfica e pouso | `CI_VERIFIED` |
| **Superfície Procedural** | `U4.5.4` / `U4.5.4.1` | Terrenos fractais determinísticos, biomas áridos, glaciais, vulcânicos, oceânicos (mar plano 0m) | Suíte U4.5.4 (8 testes) | Inspeção de relevo e transição orbital | `CI_VERIFIED` |
| **Atlas Cósmico** | `U4.5` a `U4.5.3.1` | Catálogo de galáxias e corpos, persistência SaveManager, busca tolerante a acentos | Suíte de integração Atlas | Painel lateral e cartões UI | `CI_VERIFIED` |
| **Hypercruise** | `U3-UNIVERSAL-HYPERCRUISE.md` | Voo interestelar contínuo em escala de segundos sem teletransporte brusco | Testes de aceleração e desaceleração | Efeito de túnel e estrelas de passagem | `CI_VERIFIED` |
| **Galáxias Procedurais**| `U4` | Geração sob demanda de galáxias espirais, elípticas e irregulares | Testes de morfologia e catálogo | Renderização de braços galácticos | `CI_VERIFIED` |
| **Buracos Negros BH0** | `11-BLACK-HOLES.md` | Raio de Schwarzschild, horizonte de Kerr, ISCO, anel de fótons, sombra óptica | `tests/black-hole-astrophysics-bh0.test.ts` (7/7 pass) | Sombra escura e distorção óptica | `CI_VERIFIED` |
| **Buracos Negros BH1** | `11-BLACK-HOLES.md` | Atração gravitacional, perda de fuga após cruzar horizonte de eventos | `tests/black-hole-gravity-bh1.test.ts` (14/14 pass) | Trajetória curvada em aproximação | `CI_VERIFIED` |
| **Buracos Negros BH2** | `11-BLACK-HOLES.md` | Rede de trânsito dimensional persistente por `universeSeed + traversalCounter` | `tests/black-hole-transit-bh2.test.ts` (13/13 pass) | Travessia e emergência segura | `CI_VERIFIED` |
| **Mapa Universal U5** | `U5` | Visualização interativa e clicável em múltiplas escalas (sistema -> galáxia -> teia), URI `drm:v1://` e breadcrumbs | `tests/universal-map-multiscale-u5.test.ts` (7/7 pass) | Seleção e zoom sem saltos | `CI_VERIFIED` |
| **Horizonte Cósmico U6**| `13-OBSERVABLE-UNIVERSE-HORIZON.md`| Limite observável relativístico, estruturas em filamentos, Teia Cósmica e Grande Atrator | `tests/cosmological-structure-u6.test.ts` (7/7 pass) | Teia cósmica em grande escala | `CI_VERIFIED` |
| **Teleporte Infinito U7**| `05-INFINITE-TELEPORT.md` | Teleporte universal sem limites arbitrários ($\pm 100\text{ km}$ e $2500\text{ m}$ removidos), interseção analítica fechada (WGS84, Lua, Marte), mira angular e handoff atômico | `tests/universal-teleport-service.test.ts` (14/14 pass) | Tecla `E`, mira e transição atômica | `CI_VERIFIED` |

