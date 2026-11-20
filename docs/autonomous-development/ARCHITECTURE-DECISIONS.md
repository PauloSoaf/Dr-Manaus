# DR-MANAUS | Architecture Decision Records (ADRs)

Registro formal das decisões arquiteturais tomadas para garantir estabilidade, fidelidade física, desempenho e modularidade no projeto DR-MANAUS.

---

### ADR-001: Floating Origin e Coordenadas Espaciais Hierárquicas
- **Contexto:** O universo do DR-MANAUS se estende da escala milimétrica do chão de Manaus até a escala cosmológica de bilhões de anos-luz. Padrões comuns de `Vector3` de 32 bits (IEEE 754) sofrem perda severa de precisão além de 10.000 metros da origem.
- **Decisão:**
  - Coordenadas cósmicas são particionadas hierarquicamente: `(galaxyId, sectorX, sectorY, sectorZ)` onde os setores são indexados por `bigint` (1 setor = 100 anos-luz = $9,46 \times 10^{17}\text{ m}$).
  - Na proximidade de corpos e superfícies, o sistema utiliza o padrão Floating Origin (`FloatingOrigin3D` / `RenderOrigin`), recentralizando a câmera a cada frame e renderizando posições em coordenadas locais relativas à câmera.
  - O pipeline gráfico do Three.js nunca recebe números com magnitude cosmológica direta nos vertex buffers.

---

### ADR-002: Determinismo Procedural sem `Math.random()`
- **Contexto:** Motores procedurais que utilizam `Math.random()` sofrem de assincronia e discordância de bordas entre tiles vizinhos, além de corromper órbitas e identidades dependendo da ordem de carregamento das áreas.
- **Decisão:**
  - `Math.random()` é estritamente proibido em qualquer código de geração e de produção do jogo.
  - Todas as estrelas, sistemas, órbitas, corpos, relevos, biomas e buracos negros derivam de funções hash inteiras de 32 bits determinísticas (`hash3`, `hashString`, `fbm3D`, `ridgedNoise3D`) semeadas por `universeSeed + address`.

---

### ADR-003: Unificação Matemática entre Superfície Visual e Física de Colisão
- **Contexto:** Se a malha planetária renderizada pelo quadtree usar uma aproximação e o sistema de colisão/altimetria usar outra, ocorrem defeitos como o jogador penetrar montanhas visíveis ou flutuar acima do solo.
- **Decisão:**
  - `surfaceForBody(body)` retorna uma única instância autoritativa de `PlanetSurfaceGenerator`.
  - Tanto o gerador de malha visual (`PlanetGlobe` / `buildPlanetTileMesh`) quanto o provedor de altitude/contato físico (`PlanetTerrainProvider`) avaliam a mesma função `planetSurfaceRadius(surface, direction)`.
  - Para corpos com achatamento rotacional ($f > 0$), o raio base de referência obedece ao elipsoide direcional rotacional autêntico:
    $$R_{\text{base}}(\vec{d}) = \frac{1}{\sqrt{\frac{d_x^2 + d_y^2}{a^2} + \frac{d_z^2}{b^2}}}$$

---

### ADR-004: Persistência com Agrupamento Atômico em Lote (`SaveManager.batch`)
- **Contexto:** Ao explorar ou ancorar em um novo sistema estelar, dezenas de corpos celestes são descobertos em um único frame. Invocar `localStorage.setItem` individualmente para cada corpo gera write-amplification severo e congelamentos de frame na thread principal do navegador.
- **Decisão:**
  - `SaveManager` conta com controle de pilha de lotes (`batchDepth`) e flag `dirty`.
  - Operações de descoberta múltipla (`discoverTargets`, `recordDiscovery`, `recordArrival`) são executadas dentro de `save.batch(...)`, serializando e gravando o JSON completo no `localStorage` exatamente 1 vez por evento de exploração.

---

### ADR-005: Preservação de Dados de Autoridade Canônica
- **Contexto:** A Terra, a Lua e Marte contêm levantamentos topográficos científicos reais (NOAA ETOPO5, NASA LRO/LOLA, etc.).
- **Decisão:**
  - A cota máxima da Terra no motor é `EARTH_MAX_ELEVATION_M = 5742 m` (resultado do downsampling de ETOPO5 a 5 arc-minutos para grade $512 \times 256$).
  - O código de teste e de produção nunca deve forjar ou inventar cotas arbitrárias que divirjam das fontes científicas embarcadas nos assets canônicos.

