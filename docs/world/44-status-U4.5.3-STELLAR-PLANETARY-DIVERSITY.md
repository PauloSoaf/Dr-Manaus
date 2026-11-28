# DR-MANAUS | Patch U4.5.3 — Diversidade Estelar e Planetária Procedural

## 1. Visão Geral

- **Patch:** U4.5.3
- **Título:** Diversidade Estelar e Planetária Procedural
- **Baseline Auditado:** `375584e30ea1f49a3bb2abcc0d7c55dbc81ef9ed` (GitHub Actions Runs `42541489643` e `42541484777`, 100% aprovado, 1.563/1.563 testes, 638/638 regressões permanentes).
- **Branch de Trabalho:** `feat/universe-map`
- **Repositório:** [https://github.com/PauloSoaf/Dr-Manaus](https://github.com/PauloSoaf/Dr-Manaus)

---

## 2. Objetivos e Entregas

### P0 — Auditoria da Geração Atual
- Analisados os fluxos de geração e renderização em:
  - `SystemGenerator.ts`
  - `StarSector.ts`
  - `ProceduralSystemRuntime.ts`
  - `CelestialBodyProfile.ts`
  - `CelestialBodyVisualLayer.ts`
  - `ProceduralSystemMaterializer.ts`
  - `PlanetVolumeSurfaceRenderer.ts`
  - `GalaxyMaterializer.ts`
- Mapeada a sequência de consumo do PRNG xorshift64 e os contratos de validação física (`canLand === hasSolidSurface`, `supportsVolumeDestruction === false` para corpos procedurais).

### P1 — Diversidade Planetária Procedural
- Evolução determinística da geração de mundos procedurais com taxonomia física e observável:
  1. **Planetas Rochosos Áridos (`arid-rocky`):** mundos desérticos com regolito oxidado, tons terrosos avermelhados/ocres (`albedo: [0.58, 0.35, 0.20]`), relevo estéril.
  2. **Planetas Congelados (`frozen-rocky`):** mundos glaciais em órbitas externas ou estrelas frias, albedo de gelo reflexivo (`[0.74, 0.82, 0.92]`), piso de fase de reflexividade criogênica (`phaseFloor: 0.12`).
  3. **Planetas Vulcânicos (`volcanic-rocky`):** corpos telúricos hiperaquecidos ($T_{eq} > 400\text{ K}$), albedo de basalto escuro e enxofre (`[0.26, 0.16, 0.12]`), névoa vulcânica óptica suave.
  4. **Planetas com Atmosfera Densa (`dense-atmosphere-rocky`):** análogos a Vênus com efeito estufa intenso, albedo de nuvens espessas (`[0.84, 0.76, 0.52]`), 8 faixas de nuvens (`bands: 8`) e névoa espessa (`haze: { radiusScale: 1.15, strength: 0.55 }`).
  5. **Planetas Oceânicos (`oceanic-rocky`):** mundos temperados na zona habitável ($230\text{ K} \le T_{eq} \le 340\text{ K}$) com hidrosfera líquida, albedo azul profundo (`[0.20, 0.46, 0.88]`), névoa de dispersão Rayleigh e brilho pontual.
  6. **Gigantes Gasosos (`gas-giant`):** gigantes jovianos com faixas turbulentas (`bands: 12-16`), saturnianos dourados e Júpiteres Quentes avermelhados em órbitas internas.
  7. **Gigantes Gelados (`ice-giant`):** mundos supercríticos uranianos (ciano suave) e netunianos (azul cobalto), com névoa suave e 4 a 6 bandas.
  8. **Luas Diversificadas:** luas rochosas crateradas (`rocky-moon`), luas de gelo brilhante (`icy-moon`), luas vulcânicas aquecidas por marés (`volcanic-moon`) e luas com atmosfera densa de hidrocarbonetos (`atmospheric-moon`).

### P2 — Estrelas Distintas por Classe Espectral
- Implementado cromatismo físico baseado na classificação Morgan–Keenan em `stellarAlbedo(temperatureK, spectralClass)`:
  - **Classe O ($> 30.000\text{ K}$):** azul elétrico profundo (`[0.60, 0.72, 1.0]`), corona expandida (`innerScale: 2.8, outerScale: 8.0`).
  - **Classe B ($10.000 - 30.000\text{ K}$):** azul-esbranquiçado de alta intensidade (`[0.75, 0.85, 1.0]`).
  - **Classe A ($7.500 - 10.000\text{ K}$):** branco celeste (`[0.92, 0.95, 1.0]`).
  - **Classe F ($6.000 - 7.500\text{ K}$):** amarelo-esbranquiçado suave (`[1.0, 0.96, 0.88]`).
  - **Classe G ($5.200 - 6.000\text{ K}$):** dourado solar (`[1.0, 0.94, 0.82]`).
  - **Classe K ($3.700 - 5.200\text{ K}$):** laranja quente (`[1.0, 0.68, 0.35]`).
  - **Classe M ($< 3.700\text{ K}$):** anã vermelha rubi profundo (`[1.0, 0.38, 0.16]`), halo compacto (`innerScale: 1.5, outerScale: 3.5`).
- Inteiramente renderizado através do shader existente `SunVisual` sem recompilação ou vazamento de recursos.

### P3 — Anéis Planetários Analíticos e Névoas Atmosféricas
- Gigantes gasosos (~42%) e gigantes gelados (~35%) agora geram anéis planetários analíticos determinísticos (`rings: { innerRadius, outerRadius, minimumDiameterPx }`).
- Reutiliza o pipeline analítico existente em `PlanetVisual`:
  - `RingGeometry` gerada apenas uma vez na instanciação.
  - Padrão procedural de faixas concêntricas via TSL (`radius.mul(90).sin()`).
  - Descarte seguro em `PlanetVisual.dispose()` e `CelestialBodyVisualLayer.dispose()`.
  - Zero alocação de malha por frame.

### P4 — Integração com o Catálogo e Atlas Cósmico
- Criada a seção `ASTROFÍSICA & SUPERFÍCIE` no cartão lateral de navegação `#universal-target-card`:
  - Classificação do mundo com etiqueta formatada em português.
  - Temperatura de equilíbrio calculada em Kelvin e Celsius ($T_{eq} \propto d^{-0.5}$).
  - Gravidade superficial calculada a partir de $g = G \cdot M / R^2$ em m/s² e g.
  - Indicador categórico de pousabilidade:
    - `✓ Pouso permitido (sólido)` para corpos rochosos e luas.
    - `✗ Pouso impossível (fluido)` para gigantes gasosos e gelados.
  - Presença de sistema de anéis (`★ Sistema de anéis presente`).
  - Descrição da atmosfera e pressão superficial aproximada (atm).
- O Atlas Cósmico (`CosmicAtlasModel`) incorpora `worldType`, `canLand`, `temperatureK` e `hasRings` nas consultas e permite busca textual por categorias (ex: "vulcânico", "oceânico", "congelado", "anéis").

### P5 — Determinismo e Segurança Absoluta
- Preservada estritamente a sequência de números pseudo-aleatórios do gerador principal:
  - Todas as chamadas originais a `nextFloat()` que determinam semi-eixo orbital, raio, massa, densidade e contagem de luas continuam ocorrendo na mesma ordem exata.
  - As variações de atributos físicos utilizam um sub-gerador puramente funcional `bodySubRandom(starSeed, bodyId)` desacoplado do fluxo principal.
  - Zero uso de `Math.random()`.
  - Nenhuma quebra de retrocompatibilidade com salvamentos existentes.

---

## 3. Arquivos Modificados e Criados

1. [src/world/celestial/CelestialBodyProfile.ts](file:///c:/Projetos/Dr-Manaus/src/world/celestial/CelestialBodyProfile.ts) (Modificado)
   - Adicionados tipos `WorldClassification` e interface `WorldEnvironment`.
   - Adicionado campo opcional `environment` em `CelestialBodyProfile`.
   - Mapeados perfis ambientais canônicos para os corpos do Sistema Solar (Sol, Mercúrio, Vênus, Terra, Lua, Marte, Júpiter, Saturno, Urano, Netuno, luas galileanas, Titã, Tritão).
2. [src/world/celestial/SystemGenerator.ts](file:///c:/Projetos/Dr-Manaus/src/world/celestial/SystemGenerator.ts) (Modificado)
   - Implementadas funções físicas puras: `calculateEquilibriumTemperatureK`, `calculateSurfaceGravityMps2`, `stellarSolarGlow`, `describeSpectralClass`.
   - `stellarAlbedo` expandido com cromatismo Morgan–Keenan de 7 classes espectrais.
   - Geração procedural determinística de mundos com cálculo de temperatura, gravidade, anéis, névoa e taxonomia ambiental.
3. [src/world/exploration/CosmicAtlasModel.ts](file:///c:/Projetos/Dr-Manaus/src/world/exploration/CosmicAtlasModel.ts) (Modificado)
   - Adicionados `worldType`, `canLand`, `temperatureK` e `hasRings` em `CosmicAtlasEntry`.
   - Suporte a busca textual por tipo de mundo no filtro do Atlas.
4. [src/ui/map/UniversalMapPanel.ts](file:///c:/Projetos/Dr-Manaus/src/ui/map/UniversalMapPanel.ts) (Modificado)
   - Renderização da seção `ASTROFÍSICA & SUPERFÍCIE` no cartão do alvo.
   - Exibição de tags de classificação, pousabilidade e anéis na visualização do Atlas.
5. [tests/stellar-planetary-diversity-u453.test.ts](file:///c:/Projetos/Dr-Manaus/tests/stellar-planetary-diversity-u453.test.ts) (Novo)
   - 10 testes cobrindo diversidade espectral estelar, taxonomia planetária, física de temperatura e gravidade, anéis, névoas, determinismo por seed, descarte GPU e integração com Atlas.
6. [docs/world/15-status.md](file:///c:/Projetos/Dr-Manaus/docs/world/15-status.md) (Modificado)
7. [docs/world/44-status-U4.5.3-STELLAR-PLANETARY-DIVERSITY.md](file:///c:/Projetos/Dr-Manaus/docs/world/44-status-U4.5.3-STELLAR-PLANETARY-DIVERSITY.md) (Novo)

---

## 4. Roteiro de Homologação Manual

1. Iniciar o jogo na porta 9999 (`http://localhost:9999`).
2. Pressionar `M` para abrir o Mapa Universal e navegar até o nível `Atlas`.
3. Digitar "oceânico", "vulcânico" ou "congelado" no campo de busca do Atlas e verificar a filtragem instantânea dos mundos descobertos.
4. Selecionar a Terra ou um planeta procedural no cartão de alvo e validar a presença da seção `ASTROFÍSICA & SUPERFÍCIE`:
   - Classificação do mundo.
   - Temperatura em Kelvin e Celsius.
   - Gravidade superficial em m/s² e g.
   - Pousabilidade (`✓ Pouso permitido` vs `✗ Pouso impossível`).
5. Selecionar Saturno ou um gigante gasoso procedural com anéis:
   - Confirmar a etiqueta `★ Sistema de anéis presente`.
   - No mapa do sistema ou no espaço 3D, conferir visualmente as faixas de anéis analíticos projetadas com iluminação física.
6. Viajar para uma estrela de classe O ou B:
   - Verificar no visor o halo expandido e o tom azul-branco radiante.
7. Viajar para uma estrela de classe M:
   - Verificar o halo compacto e o tom rubi profundo da anã vermelha.
