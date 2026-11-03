# Relatório Técnico U4.2.2 — Resolução do CI (TS2339), Alinhamento Geométrico Coplanar e Cache GPU com Contagem de Referências

**Status**: Implementado e Submetido ao CI (U4.2.2)  
**Data**: 02 de Novembro de 2026  
**Autor**: Antigravity Assistant & Dr-Manaus Core Team  
**Branch**: `feat/universe-map`  
**HEAD Auditado (U4.2.1)**: `7d828974e3ff24e433911ebf34a9ed593c29dca4` (GitHub Actions Run [41562999118](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/41562999118))  
**Resultado Oficial do CI U4.2.1**:
- Typecheck: **FAILURE** (`TS2339: Property 'hubbleType' does not exist on type 'ProceduralGalaxyDescriptor'`)
- Portão Permanente de Regressões (638): SKIPPED
- Testes Unitários Gerais (1.491): SKIPPED
- Build Vite de Produção: SKIPPED

---

## 1. Diagnóstico do CI e Auditoria da Implementação U4.2

### 1.1 Causa Raiz do Erro de Compilação TypeScript (TS2322)
No arquivo `src/world/galaxy/GalaxyMorphologyRenderer.ts`, linha 208:
```ts
this.lod2CoreMaterial.colorNode = coreColor;
```
O objeto `coreColor` era uma instância de `THREE.Color` (`new Color('#fff0d0')`).
Na Three.js WebGPU (r186), as propriedades de nós de sombreamento (`colorNode`, `opacityNode`) esperam expressões nodais do Three Shading Language (TSL). A atribuição direta de `THREE.Color` causa incompatibilidade de tipos `TS2322`.

**Correção**: Importada a função TSL `color(...)` de `'three/tsl'` e encapsulada a expressão nodal:
```ts
this.lod2CoreMaterial.colorNode = color(this.coreColor);
```
Todas as atribuições e misturas de cores em materiais nodais (`lod0Material`, `lod1DiscMaterial`, `lod2CoreMaterial`) foram unificadas utilizando nós TSL válidos, eliminando a necessidade de qualquer cast forçado (`as any` ou `@ts-ignore`).

---

### 1.2 Auditoria de Arquitetura de Materiais e Atributos GPU
A auditoria identificou que, no U4.2, o `GalaxyPointCloudProvider` gerava atributos customizados de geometria (`size` e `dust`), porém `GalaxyMorphologyRenderer` utilizava `PointsMaterial` básico, deixando os atributos desconectados do pipeline gráfico.

Além disso, a especificação nativa do WebGPU impõe que primitivas de pontos (`Points`) possuam tamanho fixo de 1 pixel em implementações nativas.
**Solução Técnica Adotada (TSL PointsNodeMaterial)**:
1. `PointsMaterial` foi substituído por `PointsNodeMaterial`, derivado de `SpriteNodeMaterial` na Three.js WebGPU:
   - `sizeNode = attribute('size', 'float').mul(...)`
   - `colorNode = attribute('color', 'vec3').mul(attribute('dust', 'float')).mul(attribute('size', 'float').mul(0.6).add(0.4))`
   - `opacityNode = attribute('dust', 'float').mul(uAlpha).saturate()`
2. **Compatibilidade Dual de Backends**:
   - No backend **WebGL 2**: `sizeNode` comanda fisicamente a variação contínua do diâmetro dos pontos na tela ($0.8\text{ px}$ a $2.5\text{ px}$).
   - No backend **WebGPU**: a luminosidade aparente e o fluxo radiante da estrela são modulados pelo atributo `size`, garantindo que supergigantes azuis (O/B) se destaquem visualmente em relação a anãs frias, enquanto o atributo `dust` aplica extinção e avermelhamento estelar realista ao longo das faixas equatoriais de poeira.
   - Ambas as propriedades são computadas nativamente na GPU com 1 único draw call por galáxia, preservando estritamente os orçamentos de desempenho.

---

### 1.3 Materialização Progressiva e Alocação Sob Demanda (Lazy LOD)
No U4.2 original, buffers de até 160.000 partículas eram gerados imediatamente no construtor de `GalaxyMorphologyRenderer`, independentemente da distância da galáxia.
**Implementação Progressiva (U4.2.1)**:
- **LOD 0**: Alocado imediatamente no construtor. Consiste apenas em um quad minimalista de 2 triângulos com shader impostor radial TSL.
- **LOD 1**: Materializado sob demanda via `ensureLod1()` somente quando a galáxia cruza o limiar de aproximação ($D_{\text{px}} \ge 16\text{ px}$).
- **LOD 2**: Materializado sob demanda via `ensureLod2()` somente quando a galáxia cruza o limiar de alta resolução ($D_{\text{px}} \ge 280\text{ px}$).
- Se uma galáxia distante for descartada ou o observador nunca se aproximar dela, **zero buffers de partículas de alta densidade são alocados**.
- Adicionado flag `_disposed` que protege contra operações e vazamentos pós-descarte.

---

### 1.4 Propagação de Presets Gráficos em Tempo de Execução
No U4.2, `GalaxyMaterializer` não recebia nem repassava o preset de qualidade (`Low`, `Medium`, `High`, `Ultra`).
**Integração Implementada**:
- `GalaxyMaterializer` agora recebe o preset do `RendererManager` na inicialização (`this.rendering.preset`) e repassa para cada `GalaxyProvider` instanciado.
- Adicionado método `setQuality(preset: QualityPreset)` em `GalaxyMaterializer`, `GalaxyProvider` e `GalaxyMorphologyRenderer`.
- Quando o jogador altera a qualidade no menu de pausa / HUD (`Game.applySettings`), o preset é repassado instantaneamente, atualizando os buffers residentes e a contagem de partículas ativas.

---

### 1.5 Correção do Cálculo de Projeção LOD e Envelope
- Removido o FOV fixo de 60° e `window.innerHeight`.
- `GalaxyProvider` agora aceita `GalaxyCameraContext` com FOV vertical efetivo (padrão de 58°, alinhado à `PerspectiveCamera` de `RendererManager`) e altura útil da viewport de renderização.
- Tratado o caso em que o observador se encontra no interior ou interceptando o envelope da galáxia ($D \le R_{\text{gal}}$): a projeção seleciona deterministicamente a resolução máxima (LOD 2), eliminando singularidades numéricas.

---

### 1.6 Blindagem da Identidade do Cache e Limite de Memória (LRU)
A chave de cache anterior (`${id}_${preset}_${count}`) podia colidir entre descritores de sementes diferentes com mesmo ID.
**Chave Semântica Canônica Implementada**:
```ts
buildPointCloudCacheKey(descriptor, preset, budget)
// Formato: v{GALAXY_GENERATOR_VERSION}|{id}|{seedHex}|{family}|{hubbleType}|{preset}|{budget}|arms:{...}|bar:{...}
```
Além disso, `GalaxyPointCloudProvider` agora implementa desalocação controlada com política LRU e capacidade máxima (`MAX_POINT_CLOUD_CACHE_SIZE = 16`). Quando a capacidade é atingida, a geometria mais antiga é descartada via `.dispose()` e removida do mapa, impedindo crescimento ilimitado de memória GPU.

---

## 2. Resumo dos Arquivos Modificados no Patch U4.2.1

| Arquivo | Modificações Principais |
|---|---|
| `src/world/galaxy/GalaxyMorphologyRenderer.ts` | Correção TS2322 com `color(...)`; substituição por `PointsNodeMaterial`; conexão de atributos `size` e `dust`; alocação preguiçosa (lazy) de LOD1/LOD2; método `setQuality`. |
| `src/world/galaxy/GalaxyPointCloudProvider.ts` | Função `buildPointCloudCacheKey` com versão `GALAXY_GENERATOR_VERSION = 2`, semente BigInt e parâmetros morfológicos; cache limitado com política LRU de 16 entradas e descarte GPU. |
| `src/world/providers/GalaxyProvider.ts` | Suporte a `GalaxyCameraContext` com FOV e viewport reais; tratamento de observador interno ao envelope ($D \le R_{\text{gal}}$); método `setQuality`. |
| `src/world/galaxy/GalaxyMaterializer.ts` | Injeção de `QualityPreset` no construtor; método `setQuality(preset)`; repasse de FOV da câmera no `update`. |
| `src/game/Game.ts` | Passagem de `this.rendering.preset` no `new GalaxyMaterializer`; chamada `galaxyMaterializer.setQuality` no `applySettings`; passagem de `this.rendering.camera` no loop de frame. |
| `tests/galaxy-morphology-renderer.test.ts` | 5 novos testes de contrato Cobrindo materiais TSL, atributos GPU, materialização lazy, troca de qualidade, resistência a colisão e projeção de FOV (13 testes no total). |
| `docs/world/15-status.md` | Atualização do status operacional e registro do checkpoint U4.2.1. |
| `docs/world/39-status-U4.2-GPU-GALAXY-RENDERING.md` | Relatório técnico completo de diagnóstico, resolução e auditoria. |

---

## 2. Hardening e Correções do Patch U4.2.2

### 2.1 Causa Raiz do Erro de Compilação TS2339
No commit `7d82897`, `buildPointCloudCacheKey` em `src/world/galaxy/GalaxyPointCloudProvider.ts`:
```ts
return `v${GALAXY_GENERATOR_VERSION}|...|${descriptor.hubbleType}|...`;
```
A interface `ProceduralGalaxyDescriptor` define o campo canônico como `morphology: HubbleMorphology` (e não `hubbleType`).
A referência foi corrigida para `descriptor.morphology`, alinhando a chave semântica do cache com o contrato estático do gerador procedural.

### 2.2 Alinhamento Geométrico Coplanar entre Todos os Níveis de LOD
- No Three.js, `PlaneGeometry(2, 2)` é construída no plano X-Y com vetor normal ao longo de +Z.
- Por outro lado, `GalaxyPointCloudProvider` distribui os pontos no plano de coordenadas X-Z, utilizando o eixo Y como vetor normal polar perpendicular ao disco.
- No U4.2/U4.2.1, essa discrepância causava uma rotação aparente de 90° ao cruzar a transição entre LOD 1 (disco quad) e LOD 2 (nuvem de partículas).
- **Correção**: Aplicada a transformação `.rotateX(-Math.PI / 2)` em `lod0Geometry` e `lod1DiscGeometry`. Agora, LOD 0, LOD 1 e LOD 2 compartilham estritamente o mesmo plano equatorial X-Z com vetor normal canônico ao longo de +Y.

### 2.3 Pré-Aquecimento Preditivo de LOD 2 (Anti-Stuttering)
- Para evitar interrupções de frame ao cruzar o limiar de alta resolução ($D_{\text{px}} \ge 280\text{ px}$), foi implementado o gatilho preditivo de pré-aquecimento:
  ```ts
  if (current === 1 && projectedPx >= lodThreshold12 * 0.6 && !this._lod2Materialized && !this._lod2Preheated) {
    this.preheatLod2();
  }
  ```
- O buffer de partículas é gerado e indexado no cache em segundo plano durante a aproximação em LOD 1, tornando a transição para LOD 2 uma operação $O(1)$ sem stuttering de CPU/GPU.

### 2.4 Cache GPU Seguro com Contagem de Referências (Ref Counting)
- Adicionados métodos `retain(geom)` e `release(geom)` em `GalaxyPointCloudProvider`.
- A política de evicção LRU garante que geometrias ativas vinculadas a nós de cena (`refCount > 0`) jamais sejam destruídas prematuramente via `.dispose()` ao atingir o limite de 16 buffers, eliminando riscos de ponteiros GPU pendentes (use-after-free).

### 2.5 Propagação de Viewport Real
- Em `Game.ts` e `GalaxyMaterializer.ts`, a projeção angular do LOD agora utiliza a altura real do elemento canvas renderizado (`this.rendering.renderer.domElement.clientHeight || window.innerHeight`), sincronizada com o FOV vertical efetivo da `PerspectiveCamera`.

---

## 3. Cobertura da Suíte de Testes (15 Testes de Contrato)

Arquivo: [tests/galaxy-morphology-renderer.test.ts](file:///c:/Projetos/Dr-Manaus/tests/galaxy-morphology-renderer.test.ts)

- `T_U42_01_POINT_CLOUD_DETERMINISM`: Determinismo estrito bit-a-bit e divergência sob variação de semente.
- `T_U42_02_MORPHOLOGY_DEPENDENT_DISTRIBUTION`: Parâmetros morfológicos da sequência de Hubble (azul em espirais, âmbar/vermelho em elípticas).
- `T_U42_03_PARTICLE_BUDGETS_AND_PRESETS`: Tetos de Low (10k), Medium (40k), High (100k) e Ultra (160k).
- `T_U42_04_LOD_TRANSITIONS_AND_15_PERCENT_HYSTERESIS`: Transições 0/1/2 e histerese direcional de 15%.
- `T_U42_05_BUFFER_CACHING_AND_REUSE`: Reutilização sem GC e regeneração pós-descarte.
- `T_U42_06_CANONICAL_ENTITIES_PRESERVATION`: Via Láctea e Andrômeda preservam atributos canônicos.
- `T_U42_07_GALAXY_PROVIDER_LIFECYCLE_AND_PROXY_BOUNDS`: Proxy delimitador em 20 km Float32.
- `T_U42_08_NO_FLOAT32_COSMIC_POSITION_LEAK`: Coordenadas unitárias normalizadas em $[-1.5, 1.5]$.
- `T_U421_01_CACHE_IDENTITY_COLLISION_RESISTANCE_AND_LRU`: Diferenciação estrita de chaves por semente, versão e parâmetros; limite LRU de 3 entradas descartando o mais antigo.
- `T_U421_02_TSL_POINTS_NODE_MATERIAL_AND_GPU_ATTRIBUTES`: Comprova `PointsNodeMaterial`, `sizeNode`, `colorNode`, `opacityNode` e atributos de buffer `size` e `dust`.
- `T_U421_03_PROGRESSIVE_LAZY_LOD_MATERIALIZATION`: Comprova que instanciar a galáxia em LOD0 não aloca LOD1 nem LOD2; alocação ocorre somente na entrada de cada nível.
- `T_U421_04_QUALITY_PRESET_DYNAMIC_SWITCHING`: Atualização dinâmica de partículas entre Low, Medium, High e Ultra em tempo real.
- `T_U421_05_CAMERA_FOV_AND_ENVELOPE_PROJECTION`: Variação de FOV (30° vs 90°) alterando a seleção de LOD e observador interno ao envelope forçando LOD2.
- `T_U422_01_COPLANAR_XZ_ORIENTATION_AND_PREDICTIVE_PREHEATING`: Quads de LOD0 e LOD1 coplanares no plano equatorial X-Z com normal +Y; pré-aquecimento preditivo em LOD1 ao cruzar 60% do limiar de transição.
- `T_U422_02_REFERENCE_COUNTED_CACHE_AND_SAFE_EVICTION`: Contagem de referências ativa preserva integridade de geometrias em cena mesmo sob evicção do cache LRU.

---

## 4. Limitações e Riscos

1. **Validação Visual no Navegador**:
   - A compilação TSL para WGSL/GLSL e a renderização dos nós foram verificadas contra a especificação e tipos de Three.js r186. Contudo, artefatos visuais de fill-rate ou blendings aditivos exigem confirmação visual do operador humano no navegador.
2. **Backend WebGPU Puro vs WebGL 2**:
   - Conforme documentado pela Three.js, primitivas `Points` no backend WebGPU têm tamanho rasterizado de 1 pixel. A diferenciação estelar nesse backend opera por modulação de brilho e extinção de poeira; no backend WebGL 2, o diâmetro dos pontos também varia fisicamente via `sizeNode`.
3. **Bloqueio de Fases Subsequentes**:
   - **U4.3** (mapa e gameplay galáctico) e **BH0–BH2** (buracos negros supermassivos) permanecem rigorosamente bloqueados até que o CI oficial do GitHub Actions retorne verde no commit U4.2.2.
