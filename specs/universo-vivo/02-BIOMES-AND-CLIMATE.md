# DR-MANAUS | VIVO-02: Clima e Biomas Determinísticos por Tile e Habitat

## 1. Objetivo
Definir o serviço canônico e autoritativo de clima e biomas planetários (`PlanetaryBiomeService`), permitindo que cada ponto da superfície de qualquer planeta (Terra, Lua, Marte, Titã ou corpos procedurais em qualquer galáxia) receba classificação climática contínua (temperatura local, umidade) e biome específica, incluindo propriedades visuais (paleta de cores, densidade de vegetação, arquétipo de flora).

## 2. Modelagem Física e Determinística
1. **Temperatura Local $T(\phi, h)$**:
   $$T(\phi, h) = T_{\text{base}} - \Delta T_{\text{pole}} \cdot \sin^2(\phi) - \Gamma \cdot \max(0, h) + \delta T_{\text{noise}}(\phi, \lambda)$$
   - $\phi$: latitude em radianos ($-\pi/2 \dots \pi/2$).
   - $h$: altitude relativa ao datum de superfície ou nível do mar.
   - $\Gamma$: gradiente térmico vertical adiabático (Earth $\approx 0.0065\text{ K/m}$, modulado por gravidade e pressão atmosférica).
   - $\delta T_{\text{noise}}$: perturbação determinística contínua por ruído trigonométrico derivado de `climateSeed`.

2. **Umidade / Precipitação $M(\phi, h)$**:
   - Influenciada por células atmosféricas (máximo equatorial $\phi=0$, cinturão seco subtropical $\phi \approx \pm 30^\circ$, tempestades temperadas $\phi \approx \pm 50^\circ$, secura polar).
   - Hidrosfera: planetas secos ($M \to 0$); mundos oceânicos ou com oceanos ativos têm umidade elevada próximo a corpos d'água ($h \le 0$).

3. **Taxonomia de Biomas**:
   - Classificação multi-dimensional baseada em:
     1. `lifeTier` do planeta (`sterile`, `microbial`, `vegetative`, `fauna`, `civilized`).
     2. `biochemistry` (`carbon`, `silicon`, `ammonia`, `methane-solvent`, `prebiotic-none`).
     3. Elevação relativa ao nível do mar (oceânico vs continental).
     4. Espaço $(T, M)$ (temperatura vs umidade).

4. **Biomas Suportados**:
   - **Aquáticos / Marinhos**:
     - `deep-abyss`, `oceanic-shelf`, `coastal-waters`, `methane-sea`, `ammonia-basin`
   - **Estéreis / Vácuo / Alta Radiação**:
     - `barren-rock`, `cratered-highlands`, `basalt-plains`, `vacuum-dust`, `extreme-cryo-ice`
   - **Hostis / Vulcanismo / Silício**:
     - `magma-fields`, `sulfuric-wastes`, `scorched-crags`, `crystal-desert`
   - **Criogênicos / Solventes Exóticos**:
     - `tholin-plateaus`, `cryo-dunes`, `nitrogen-plains`, `ammonia-tundra`
   - **Vegetativos / Vivos (Carbono & Análogos)**:
     - `alien-rainforest`, `fungal-canopy`, `bioluminescent-wetlands`, `temperate-woodland`, `savanna-steppe`, `alien-taiga`, `subpolar-lichen`, `glacial-cap`

5. **Visual e Dados para Renderização**:
   - Cada amostra de bioma retorna:
     - `biomeId`: string identificadora única.
     - `displayName`: nome human-readable em português / sci-fi.
     - `temperatureC`: temperatura local em Celsius.
     - `moisture`: índice $0.0 \dots 1.0$.
     - `vegetationDensity`: fator $0.0 \dots 1.0$ (dita instancing de flora em VIVO-03).
     - `floraArchetype`: arquétipo de modelos a instanciar.
     - `colorPalette`: `{ surface: number, rock: number, foliage: number, liquid: number }`.
