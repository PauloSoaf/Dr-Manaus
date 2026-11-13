# DR-MANAUS | VIVO-03: Flora Visual Alienígena por Instancing e LOD com Culling de Células

## 1. Objetivo
Implementar um sistema de renderização e distribuição de flora alienígena de altíssimo desempenho (`AlienFloraRenderer`), que povoa a superfície de planetas habitáveis e exóticos usando `THREE.InstancedMesh`, culling por células espaciais, cores derivadas do bioma e geometrias procedurais otimizadas de baixo custo computacional.

## 2. Arquitetura de Desempenho
1. **Instanciamento em Massa (`InstancedMesh`)**:
   - Agrupamento por arquétipo de flora (`canopy-broadleaf`, `alien-conifers`, `giant-spore-trees`, `bioluminescent-fungi`, `crystalline-spires`, `xenoflora-succulents`, `hydrocarbon-tendrils`).
   - Cada arquétipo possui uma geometria base procedural de baixo polígono (entre 30 e 120 triângulos) e material compartilhado com suporte a `instanceColor` e iluminação básica (`MeshLambertMaterial` ou `MeshStandardMaterial`).

2. **Culling Espacial por Células de Grid**:
   - Apenas o raio ativo ao redor do observador/jogador ($R_{\text{active}} \le 200\text{ m}$) recebe instâncias visíveis de flora.
   - Particionamento em células de $40\text{ m} \times 40\text{ m}$. Células fora do raio ativo têm suas instâncias ocultadas (escala zero ou número de instâncias culling).
   - Instâncias máximas ativas limitadas (ex: 1.024 instâncias por tipo, budget estrito para manter 60 FPS garantidos).

3. **Alinhamento e Distribuição Determinística**:
   - Cada instância é posicionada no datum da superfície planetária:
     - Orientação: vetor normal da superfície $\hat{n} = \text{normalEnu}(\vec{D})$ como eixo $+Y$.
     - Rotação azimutal determinística derivada de `floraSeed`.
     - Variação de escala de $0.7\times$ a $1.3\times$ modulada por ruído de bioma.
     - Cor individual configurada via `instancedMesh.setColorAt(i, foliageColor)`.

4. **Descarte Real / Suporte a Mundos Estéreis**:
   - Mundos estéreis (`lifeTier === 'sterile'`), corpos de vácuo sem atmosfera, ou coordenadas com `vegetationDensity == 0` (calotas glaciais, oceanos profundos) geram 0 instâncias.

