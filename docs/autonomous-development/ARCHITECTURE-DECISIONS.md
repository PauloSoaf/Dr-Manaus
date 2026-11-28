# DR-MANAUS | Architecture Decision Records (ADRs)

### ADR-FOUNDATION-001 — Subpassos locais e relógio do líquido

Aceita em 2026-11-27 por Codex, sessão `FOUNDATION-01-CODEX-001`, checkpoint FOUNDATION-01.

O passo único permite que caminhada, gravidade e flutuação dependam da duração do frame. O runtime precisa preservar o contrato de voo rápido, os eventos de input e o orçamento do streaming. Consideramos um acumulador de 60 Hz para o runtime inteiro, preservar apenas o delta variável e subdividir o movimento local. A opção local limita a integração de caminhada e natação a até quatro passos sem promover streaming ou câmera a sistemas de física fixa.

O tempo da água é compartilhado entre as amostras locais e a apresentação. O relógio de comandos de voo continua independente. O resultado reduz a diferença entre taxas de quadros e mantém o limite de trabalho por frame. O estado continua discretizado, com custo extra de colisão em frames lentos. Reavaliar com perfil de custos, contato de alta velocidade e percurso de margem. [Referência de integração](https://gafferongames.com/post/fix_your_timestep/).

### ADR-FOUNDATION-002 — Cobertura do clipmap por residência espacial

Aceita em 2026-11-27 por Codex, sessão `FOUNDATION-01-CODEX-001`, checkpoint FOUNDATION-01.

Um único chunk ativo deixava o interior do clipmap sem cobertura. A autoridade é a malha residente de cada célula oceânica que intercepta o disco, na geração ativa. O clipmap fornece a área consultada no mesmo centro usado pelo render. As alternativas de esconder por contagem global ou reconstruir todo o oceano foram descartadas por falta de evidência espacial e escopo, respectivamente.

O fallback continua disponível com tiles parciais e retorna após troca de região. O cap pode coexistir com tiles parciais até completar a cobertura. Revisar a costura e a sobreposição in-game em FOUNDATION-01, com geometria definitiva condicionada às fases de mundo e água.

Registro formal das decisões arquiteturais tomadas para garantir estabilidade, fidelidade física, desempenho e modularidade no projeto DR-MANAUS.

---

### ADR-FOUNDATION-003 — Movimento com veículo ocupado

Aceita em 2026-11-27 por Codex, sessão `FOUNDATION-01-CODEX-002`, checkpoint FOUNDATION-01.

O controle pessoal avançava física, consumia comandos e publicava uma pose ao universo antes de o veículo sobrescrevê-la. Consideramos travar apenas as teclas do personagem, anexar a posse à física de personagem e selecionar uma única fonte de movimento no tick. O último caminho separa controles pessoais dos de condução e permite que universo, câmera e streaming leiam a mesma pose.

Em Manaus, a fase local escolhe o veículo ou o personagem. Veículo ocupado publica pose, velocidade e amostra do líquido, enquanto o controle pessoal mantém somente os vitais. Portais aplicam a pose do veículo ao modelo e à orientação no mesmo passo. Desembarque preserva altitude e momento, consulta colisão dos dois lados e aguarda espaço se ambos estiverem bloqueados. Veículos locais permanecem em Manaus durante handoffs. Teleporte universal bem-sucedido encerra a ocupação, inclusive quando o destino fica na mesma região.

O diagnóstico opcional guarda 240 quadros com fontes de movimento e correções físicas por subpasso. A integração de caminhadas, natação, voo e rebase continua separada. Reavaliar quando veículos tiverem representação e colisão próprias em órbita ou outras superfícies.

### ADR-FOUNDATION-004 — Uma autoridade para o solo local da Terra fora de Manaus

Aceita em 2026-11-27 por Claude (`claude-sonnet-5-5`), sessão `FOUNDATION-01-CLAUDE-001`, checkpoint FOUNDATION-01.

- **Contexto.** Fora de Manaus, a física resolvia o relevo ETOPO5 no referencial ENU (`PlanetTerrainProvider`). Os chunks desenhavam um plano em y=0,02, e a batimetria declarava leito a −250 m.
- **Problema.** Medido com código de produção: chão invisível a 972 m em Brasília e 3.641 m em La Paz. No Atlântico a colisão era sólida no nível do mar, e o jogador alternava entre `Falling`, `Swimming` e `Grounded` sem conseguir mergulhar (WATER-P0-010).
- **Alternativas.** (a) Achatar a física no plano dos chunks: perderia relevo e curvatura e divergiria do globo. (b) Dar `solidHeightAt` ao `EarthSurfaceGenerator`: quebraria a fidelidade das crateras volumétricas e o dano orbital, que usam a superfície desenhada. (c) Separar a superfície desenhada do chão jogável.
- **Decisão.** (c). `LocalSurface.ts` contém o único solver vertical, usado por `PlanetTerrainProvider`, pelos chunks no worker, pela batimetria e pelas representações distantes. `EarthGroundSurface` define o chão jogável: relevo em terra, praia, plataforma rasa (≈2%) e leito de −250 m, contínuo pela fração bilinear da máscara de terra (igual à máscara nos centros dos pixels). `EarthSurfaceGenerator` fica intacto para globo, órbita e volume. O nível do mar é o elipsoide (`localSeaLevelY`), e água, chunks e horizonte oceânico o seguem.
- **Referências.** WGS84 e convenção radial de `planetSurfaceRadius`, já usada pelo globo (`ADR-003`).
- **Consequências.** Chunks com malha própria 9×9, cores por vértice, saias, água só nas células molhadas e limites de culling medidos da geometria. O worker continua sem Three.js (teste dedicado). Cerca de 81 resoluções verticais por chunk de terra.
- **Riscos.** Nas faixas costeiras, a escavação volumétrica (superfície desenhada) pode divergir do chão jogável. Marcas de queimado continuam relativas a y=0. A resolução da máscara (~39 km) limita o detalhe da costa.
- **Impacto.** SPEC-01 P0.10 passa a valer na colisão. HOTFIX-002 reaproveita a mesma autoridade.
- **Revisão.** Reavaliar ao curvar Manaus, ao adotar DEM de maior resolução ou ao ancorar de novo o ENU durante voos longos.

### ADR-FOUNDATION-005 — Referenciais de superfície vinculáveis e chegada no solo real

Aceita em 2026-11-27 por Claude (`claude-sonnet-5-5`), sessão `FOUNDATION-01-CLAUDE-001`, checkpoint FOUNDATION-01.

- **Contexto.** O teleporte registra `<corpo>/surface/<lat>_<lon>`, mas `bindSurfacePhysics` aceitava apenas `<corpo>/local-enu`.
- **Problema.** Teleportes fora de Manaus ficavam no domínio `space` (gravidade 0). Âncoras não terrestres usavam coordenadas Y-up: Marte chegava a 27° do pedido com a vertical inclinada 26,8°, e a Lua ia ao centro no primeiro quadro. A altitude era relativa ao elipsoide. A volta a Manaus calculava o pouso no relevo de origem (La Paz → 3.641 m acima do spawn).
- **Alternativas.** Renomear os frames de teleporte para `local-enu` (quebra contratos testados como `T_U7_09`), ou vincular qualquer frame `surface-enu` cujo pai seja o `fixed` do corpo.
- **Decisão.** Vincular qualquer frame de superfície do corpo ativo. O cache de provedores é recriado quando o frame muda. Todas as âncoras usam o elipsoide do próprio corpo, como `handoffTo`. A altitude pedida é acima do solo, ou do mar sobre água. A volta para Manaus grava o frame e religa a física antes do `safeLanding`. A mira informa em qual frame está o destino. O streaming usa a âncora do frame físico, e uma âncora nova regenera os chunks mesmo com o mesmo id regional.
- **Consequências.** `T_VIVO10_01` deixou de exigir altitude relativa ao elipsoide e passou a verificar local pedido, vertical e 2 m acima do solo.
- **Riscos.** Não há reancoragem do ENU durante voos longos. As representações seguem a curvatura, mas o referencial permanece o do pouso.
- **Revisão.** Ao implementar reancoragem ou persistir frames dinâmicos entre sessões.

### ADR-FOUNDATION-006 — Dispersão de águas profundas nas ondas Gerstner

Aceita em 2026-11-27 por Claude (`claude-sonnet-5-5`), sessão `FOUNDATION-01-CLAUDE-001`, checkpoint FOUNDATION-01.

- **Contexto.** CPU e shaders compartilhavam a fase `k·x − speed·√(g/k)·t`.
- **Problema.** `√(g/k)` é velocidade de fase em m/s, não frequência angular. Medido antes da correção: a superfície do oceano terrestre chegava a 56,6 m/s, e a das megaondas de Thalassa a 17.494 m/s. A flutuação não tinha como acompanhar.
- **Decisão.** `gerstnerAngularFrequency` (ω = speed·√(g·k)) alimenta CPU, material universal, rio de Manaus e piscina. Piscina e copo tiveram `speed` recalculado para manter o movimento anterior.
- **Referência.** NVIDIA GPU Gems, cap. 1 (φ = S·2π/L).
- **Consequências.** Períodos físicos: ~8 s na ondulação de 160 m e ~54 s nas megaondas. O visual muda em Manaus e no oceano e precisa de homologação. O commit `d75419c` pode ser revertido isoladamente, mas a flutuação volta a oscilar no mar.
- **Revisão.** Homologação visual da água (FOUNDATION-06).

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

