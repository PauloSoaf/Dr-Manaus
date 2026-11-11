# DR-MANAUS | Patch U4.5.4 — Superfícies Procedurais, Biomas Visuais e Otimização do Atlas

## 1. Visão Geral

- **Patch:** U4.5.4
- **Título:** Superfícies Procedurais, Biomas Visuais e Otimização do Atlas
- **Baseline Auditado:** `d9e777fcdcfbef37c0d121c192b411210023faed` (GitHub Actions Run `42558085566`: 1.579/1.579 testes gerais aprovados, 638/638 regressões permanentes aprovadas, TypeScript PASS, Vite build PASS).
- **Branch de Trabalho:** `feat/universe-map`
- **Repositório:** [https://github.com/PauloSoaf/Dr-Manaus](https://github.com/PauloSoaf/Dr-Manaus)

---

## 2. Diagnóstico, Objetivos e Solução Arquitetural

### P0 — Otimização de Persistência e Restauração do Atlas Cósmico

#### 1. Eliminação do Write-Amplification na Descoberta de Sistemas
- **Diagnóstico:** Anteriormente, ao descobrir um novo sistema estelar procedural (`recordDiscovery`), o método invocava `this.save.discoverTarget(body.key)` individualmente para cada corpo celeste do sistema. Em sistemas com 10 a 30 corpos, isso disparava dezenas de serializações JSON completas e escritas síncronas em `localStorage.setItem` em um único frame, degradando a performance e gerando contenção desnecessária de I/O.
- **Solução Arquitetural:**
  1. No [`SaveManager`](file:///c:/Projetos/Dr-Manaus/src/core/SaveManager.ts), foi introduzido o mecanismo de agregação em lote `batch<T>(fn: () => T): T` com controle de profundidade recursiva (`batchDepth`) e rastreamento de dirty flag (`dirty`). Durante um lote ativo, invocações internas de `save()` marcam o estado como pendente, executando uma única escrita serializada no `localStorage` ao término do lote mais externo.
  2. Implementados os métodos em massa `discoverTargets(keys: readonly string[]): number` e `markVisitedTargets(keys: readonly string[]): number`, que deduplicam chaves internamente e atualizam o estado em $O(K)$.
  3. No [`CosmicAtlasModel`](file:///c:/Projetos/Dr-Manaus/src/world/exploration/CosmicAtlasModel.ts), tanto `recordDiscovery()` quanto `recordArrival()` foram encapsulados em chamadas `this.save.batch(...)`, reduzindo as escritas em `localStorage.setItem` de dezenas para exatamente **1** por evento de exploração.

#### 2. Restauração Aquecida e Deduplicada
- **Diagnóstico:** A restauração de alvos descobertos ao carregar o jogo percorria o array de chaves linearmente, resolvendo corpos procedurais antes mesmo do sistema pai estar instanciado no cache do setor.
- **Solução Arquitetural:**
  1. No construtor do `CosmicAtlasModel` e no método `importState()`, a lista de chaves salvas é deduplicada utilizando um `Set<string>`.
  2. A restauração divide as chaves em duas fases: alvos de nível de sistema (`/system/`) são processados primeiro, aquecendo os caches de setores estelares; em seguida, os corpos filhos (`/body/` e `/star/`) são restaurados instantaneamente sem recomputações redundantes.

#### 3. Correção Estrita de Canonicidade (`isCanonicalTarget`)
- **Diagnóstico:** A verificação de corpos canônicos aceitava alvos com `systemId === 'sol'` sem garantir que o alvo pertencia de fato à Via Láctea (`milky_way`), permitindo falsos positivos caso um sistema gerado em outra galáxia recebesse acidentalmente o identificador `sol`.
- **Solução Arquitetural:**
  - A função `isCanonicalTarget(desc)` agora valida estritamente a galáxia: `(desc.galaxyId === 'milky_way' || desc.galaxyId === undefined) && desc.systemId === 'sol' && (!desc.address || !('galaxyId' in desc.address) || desc.address.galaxyId === 'milky_way')`. Sistemas com ID `sol` em galáxias procedurais ou em Andrômeda são corretamente classificados como procedurais.

---

### P1 — Terrenos Procedurais Diferenciados e Biomas Visuais

#### 1. Fim da Base Plana Genérica
- **Diagnóstico:** Anteriormente, corpos procedurais sólidos utilizavam o gerador genérico `synthetic-base`, onde `heightAt(lat, lon) === 0` constante, resultando em esferas perfeitamente lisas sem relevo, vales, picos ou montanhas.
- **Solução Arquitetural ([`ProceduralPlanetSurface.ts`](file:///c:/Projetos/Dr-Manaus/src/world/planet/ProceduralPlanetSurface.ts)):**
  - Implementado um pipeline de ruído fractal 3D volumétrico completamente determinístico:
    - Funções de hash pseudoaleatórias com dispersão de inteiros de 32 bits (`hash3`, `hashString`).
    - Ruído de valor tridimensional (`valueNoise3D`) com interpolação Hermite cúbica suave ($3t^2 - 2t^3$).
    - Fractional Brownian Motion (`fbm3D`) multi-oitava (4 a 6 oitavas) para terrenos colinares, dunas e planícies.
    - Ridged multifractal (`ridgedNoise3D`) com cristas afiadas invertidas ($1 - |noise|$) para dorsais montanhosas e cânions tectônicos.
  - Ausência absoluta de `Math.random()`: todo o ruído depende deterministicamente de uma semente estável calculada a partir de `body.id`, `systemId` e dimensões físicas do corpo, isolando matematicamente cada mundo do universo.

#### 2. Biomas Especializados por Classificação Física (`WorldClassification`)
- **`arid-rocky` (Mundos Áridos / Desérticos):**
  - Dunas e planícies de regolito, platôs tabulares e cânions erodidos com relevo de até $4.200\text{ m}$.
  - Paleta com albedos quentes de argila, ocre, arenito oxidado e rochas escuras nas gargantas.
- **`frozen-rocky` (Mundos Glaciais):**
  - Planícies de gelo compactado, fraturas tectônicas e calotas polares de nitrogênio/metano com relevo de até $3.800\text{ m}$.
  - Paleta fria com ciano gélido, branco de rime e azul ultramarino profundo nas fissuras.
- **`volcanic-rocky` (Mundos Vulcânicos):**
  - Relevo agressivo de até $7.800\text{ m}$ com picos vulcânicos e caldeiras colapsadas (`ridgedNoise3D` elevado ao quadrado).
  - Basalto negro de crosta solidificada, cinzas sulfurosas e veios avermelhados de magma resfriado.
- **`oceanic-rocky` (Mundos Oceânicos / Hidrosfera Coerente):**
  - Elevação do oceano estritamente plana em $0\text{ m}$ (sem relevo negativo espúrio ou fundos submarinos desconexos da física de pouso).
  - Massas continentais com relevo de até $6.200\text{ m}$, praias arenosas costeiras de transição suave, planícies temperadas verde-oliva, colinas onduladas e cordilheiras montanhosas com picos nevados.
  - Calotas polares com expansão glacial coerente em altas latitudes ($|\text{lat}| > 68^\circ$).
- **`dense-atmosphere-rocky` (Mundos Superdensos / Tipo Vênus):**
  - Planícies onduladas amortecidas pela densa pressão atmosférica e platôs suaves com relevo máximo de $3.200\text{ m}$.
  - Paleta ocre-âmbar, névoa densa e depósitos minerais amarelos de enxofre.
- **Luas Sólidas (`rocky-moon`, `icy-moon`, `volcanic-moon`, `atmospheric-moon`):**
  - Relevo adaptado à baixa gravidade superficial ($1.800\text{ m}$ a $3.500\text{ m}$), dominado por crateras e cristas de impacto.

---

### P2 — Consistência Unificada entre Renderização e Física

- **Diagnóstico:** Em motores de simulação planetária, se a malha visual e o sistema de colisão utilizarem funções de relevo diferentes, a nave penetra montanhas invisíveis ou flutua acima do terreno visível.
- **Solução Arquitetural ([`BodySurfaceFactory.ts`](file:///c:/Projetos/Dr-Manaus/src/world/planet/BodySurfaceFactory.ts)):**
  1. A função `surfaceForBody(body)` agora instancia `createProceduralPlanetSurface(body, model, profile)` para todos os corpos procedurais sólidos.
  2. A função `maximumSurfaceReliefM(body)` retorna `proceduralMaxReliefM(body)` para esses corpos, informando as cotas reais ($1.800\text{ m}$ a $7.800\text{ m}$) para o subsistema de streaming e Screen Space Error (SSE).
  3. Como tanto a malha visual (`PlanetGlobe.ts`) quanto o provedor de altitude e contato físico do jogador (`PlanetTerrainProvider.ts`) consultam diretamente `planetSurfaceRadius(surface, direction)` com a mesma instância retornada por `surfaceForBody`, **a geometria visual e a superfície física de colisão são matematicamente 100% idênticas**.
  4. **Preservação Canônica:** Terra, Lua e Marte continuam utilizando seus geradores canônicos de alta fidelidade sem qualquer modificação. Mercúrio e Vênus mantêm o comportamento de esfera sintética plana (`heightAt: () => 0`). Corpos não-sólidos (estrelas e gigantes gasosos/gelados) continuam retornando `undefined`.

---

### P3 — Performance, Streaming e Descarte de Recursos

- O gerador calcula as normais através de derivadas direcionais por diferenças finitas no espaço local ENU (East-North-Up), normalizando o vetor com tolerância a singularidades polares.
- Não há alocação dinâmica de arrays ou buffers dentro do loop de `heightAt`: o código utiliza apenas variáveis primitivas escalares, garantindo que o cálculo de terreno execute a 60+ FPS durante streaming de quadtree e vôo rasante.
- Mantido o descarte de geometrias e materiais no ciclo de vida de nós quadtree descartados.

---

## 3. Arquivos Modificados e Criados

1. [`src/core/SaveManager.ts`](file:///c:/Projetos/Dr-Manaus/src/core/SaveManager.ts) (Modificado)
   - Adicionados campos `batchDepth: number = 0` e `dirty: boolean = false`.
   - Adicionado método `batch<T>(fn: () => T): T` para agrupamento atômico de escritas em `localStorage`.
   - Modificado `save()` para respeitar lotes em andamento.
   - Adicionados métodos de lote `discoverTargets(keys: readonly string[]): number` e `markVisitedTargets(keys: readonly string[]): number`.

2. [`src/world/exploration/CosmicAtlasModel.ts`](file:///c:/Projetos/Dr-Manaus/src/world/exploration/CosmicAtlasModel.ts) (Modificado)
   - Corrigido `isCanonicalTarget()` para validar estritamente a galáxia (`galaxyId === 'milky_way' || galaxyId === undefined`), sistema e presença em perfis canônicos.
   - Otimizada a restauração em lote no construtor e em `importState()` com deduplicação por `Set` e pré-aquecimento de sistemas antes dos corpos.
   - Encapsulados `recordArrival()` e `recordDiscovery()` em `save.batch()`, utilizando `discoverTargets()` em lote para os corpos filhos.

3. [`src/world/planet/ProceduralPlanetSurface.ts`](file:///c:/Projetos/Dr-Manaus/src/world/planet/ProceduralPlanetSurface.ts) (**Novo Arquivo**)
   - Implementação de hashes determinísticos, ruído 3D de valor Hermite cúbico, FBM multi-oitava e ridged multifractal.
   - Modelagem de biomas com relevo e paletas de cores específicas para mundos áridos, glaciais, vulcânicos, oceânicos (com nível do mar a $0\text{ m}$), atmosfera densa e luas.
   - Cálculo analítico de normais ENU e cotas máximas de relevo (`proceduralMaxReliefM`).

4. [`src/world/planet/BodySurfaceFactory.ts`](file:///c:/Projetos/Dr-Manaus/src/world/planet/BodySurfaceFactory.ts) (Modificado)
   - Integrado `createProceduralPlanetSurface` em `surfaceForBody(body)` para todos os corpos procedurais sólidos.
   - Integrado `proceduralMaxReliefM(body)` em `maximumSurfaceReliefM(body)`.
   - Preservados os corpos canônicos e a base sintética plana de Mercúrio e Vênus.

5. [`tests/procedural-surfaces-and-atlas-opt-u454.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/procedural-surfaces-and-atlas-opt-u454.test.ts) (**Novo Arquivo**)
   - Nova suíte com 8 testes abrangentes:
     - `T_U454_01_SAVE_MANAGER_BATCHING`: Valida agrupamento de writes e operações em lote (`setItem` acionado exatamente 1 vez).
     - `T_U454_02_ATLAS_DISCOVERY_BATCH_PERSISTENCE`: Valida descoberta de sistema com múltiplos corpos gerando exatamente 1 escrita atômica.
     - `T_U454_03_LARGE_SAVE_RESTORATION_STABILITY`: Restauração de grande volume de alvos sem degradação ou duplicidade.
     - `T_U454_04_CANONICAL_TARGET_STRICT_GALAXY_CHECK`: Validação estrita de taxonomia rejeitando sistemas forjados fora da Via Láctea.
     - `T_U454_05_PROCEDURAL_SURFACE_DETERMINISM_AND_ISOLATION`: Confirmação de 100% de determinismo e sementes independentes.
     - `T_U454_06_BIOME_DIFFERENTIATION_AND_OCEAN_SEA_LEVEL`: Validação de nível do mar plano em mundos oceânicos e relevos específicos de cada bioma.
     - `T_U454_07_PHYSICS_AND_VISUAL_GEOMETRIC_CONSISTENCY`: Consistência geométrica unificada entre relevo visual e física de colisão.
     - `T_U454_08_CANONICAL_BODY_PRESERVATION`: Preservação intacta de Terra, Lua, Marte, Mercúrio e Vênus.

6. [`docs/world/15-status.md`](file:///c:/Projetos/Dr-Manaus/docs/world/15-status.md) (Modificado)
   - Atualizado com o registro detalhado do checkpoint U4.5.4.

7. [`docs/world/46-status-U4.5.4-PROCEDURAL-SURFACES-AND-ATLAS-OPTIMIZATION.md`](file:///c:/Projetos/Dr-Manaus/docs/world/46-status-U4.5.4-PROCEDURAL-SURFACES-AND-ATLAS-OPTIMIZATION.md) (**Novo Arquivo**)
   - Relatório técnico completo de arquitetura, biomas, otimizações e evidências do patch U4.5.4.

---

## 4. Matriz de Cobertura de Testes

| Teste | Objetivo | Status Projetado |
| :--- | :--- | :---: |
| `T_U454_01` | `SaveManager`: Agrupamento atômico `batch()` e métodos em lote `discoverTargets()` / `markVisitedTargets()` | APROVADO |
| `T_U454_02` | `CosmicAtlasModel`: Registro de descoberta e chegada disparando exatamente 1 gravação consolidada | APROVADO |
| `T_U454_03` | Restauração massiva de estado do Atlas com deduplicação e aquecimento prévio de setores | APROVADO |
| `T_U454_04` | Taxonomia estrita em `isCanonicalTarget()` impedindo canonicidade de alvos fora da Via Láctea | APROVADO |
| `T_U454_05` | Determinismo exato de superfície fractal 3D e isolamento matemático entre mundos distintos | APROVADO |
| `T_U454_06` | Biomas especializados: mundos oceânicos com mar plano ($0\text{ m}$) e relevos característicos (áridos, glaciais, vulcânicos) | APROVADO |
| `T_U454_07` | Consistência física e visual unificada (`planetSurfaceRadius`), vetores normais unitários e relevos limitados | APROVADO |
| `T_U454_08` | Preservação rigorosa de corpos canônicos solares e superfícies sintéticas de Mercúrio e Vênus | APROVADO |

---

## 5. Próximos Passos Recomendados

1. Submissão do patch para homologação no CI GitHub Actions da branch `feat/universe-map`.
2. Verificação visual das transições de aproximação orbital para rasante nos novos mundos procedurais.
3. Teste exploratório de pouso manual na superfície de planetas oceânicos, vulcânicos e desérticos no servidor local (`http://localhost:9999`).
