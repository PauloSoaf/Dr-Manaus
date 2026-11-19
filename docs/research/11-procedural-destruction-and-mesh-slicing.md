# 11. Destruição Procedural, Slicing de Malhas e Escombros

## 1. Contexto no Dr-Manaus
O super-herói Dr-Manaus possui poderes devastadores e construtivos em múltiplas escalas:
- **Escala Urbana:** Socos sísmicos e feixes de laser que partem prédios, colapsam estruturas em escombros e deixam crateras fumegantes no solo.
- **Escala Planetária:** Habilidade cósmica de ruptura e fratura da crosta (`planetRupture` com $10^{28}\text{ J}$), gerando anéis de fragmentos tectônicos em órbita.
- **Restauração Temporal:** Reconstrução inversa (`startReverseReconstruction`), onde fragmentos flutuantes se reagrupam e restauram a geometria original.

---

## 2. Repositórios GitHub de Referência
1. **[dgreenheck/three-pinata](https://github.com/dgreenheck/three-pinata)**
   - *Descrição:* Biblioteca de fracionamento e corte de malhas em tempo real para Three.js com padrão de quebra de Voronoi 3D, concentração de fragmentos no ponto de impacto e mapeamento automático de materiais para faces internas de fratura.
   - *Aplicabilidade no Dr-Manaus:* Algoritmo de corte em fatias quando feixes de laser atravessam fachadas de edifícios em Manaus.
2. **[gkjohnson/three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg)**
   - *Descrição:* Biblioteca de Constructive Solid Geometry (CSG) de altíssima performance para Three.js baseada em BVH. Permite subtrair esferas de cratera e furar sólidos poligonais de forma interativa.
   - *Aplicabilidade no Dr-Manaus:* Escavação em tempo real de crateras de meteoros e impactos de alta velocidade no solo.
3. **[manthrax/THREE-CSGMesh](https://github.com/manthrax/THREE-CSGMesh)**
   - *Descrição:* Wrapper clássico de operações booleanas para geometrias Three.js com suporte a preservação de normais e cores de vértices.
   - *Aplicabilidade no Dr-Manaus:* Prototipagem rápida de marcas de destruição permanente.

---

## 3. Jogos de Referência de Destruição
1. **[Teardown](https://teardowngame.com/) (Tuxedo Labs)**
   - *Referência Técnica:* O ápice da destruição física em tempo real: mundo 100% destrutível baseado em voxels rígidos acelerados na GPU, propagação de estresse estrutural e colapso de edifícios baseado no centro de gravidade das vigas de sustentação.
2. **[Control](https://www.remedygames.com/games/control) (Remedy Entertainment)**
   - *Referência Técnica:* Física de detritos e telecinese cinematográfica: cada objeto arremessado arranca placas de concreto, vergalhões de metal e lascas de gesso das paredes que permanecem no chão com colisão dinâmica.
3. **[Red Faction: Guerrilla](https://store.steampowered.com/app/20500/Red_Faction_Guerrilla_ReMarsTered/) (Volition)**
   - *Referência Técnica:* Sistema de integridade estrutural mecânica: estruturas não caem por animação pré-feita, mas sim quando suas colunas mestras deixam de suportar a massa vertical do telhado.
4. **[Crackdown 3](https://www.xbox.com/en-US/games/crackdown-3) (Sumo Digital / Cloudgine)**
   - *Referência Técnica:* Modo multijogador com destruição em nuvem em larga escala, onde arranha-céus inteiros se partem em múltiplos pedaços sob fogo concentrado de super-heróis.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[three-bvh-csg Documentation & API Reference](https://github.com/gkjohnson/three-bvh-csg/blob/main/README.md)**
   - Manual da biblioteca demonstrando operações de `SUBTRACTION`, `INTERSECTION` e `ADDITION` aplicadas a `BufferGeometry` com geração de limites BVH para rápida detecção de colisões subsequentes.
2. **[Voronoi 3D Cell Decomposition Mathematical Paper](https://en.wikipedia.org/wiki/Voronoi_diagram)**
   - Fundamentos matemáticos dos diagramas de Voronoi e triangulação de Delaunay em três dimensões para partição estocástica de volumes rígidos.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Hierarquia de 7 Fases de Ruptura Cósmica:** Já implementada no `PlanetaryRupturePresentation.ts`, onde o planeta fratura sua crosta, expõe o núcleo de magma superaquecido, expande um anel de detritos e, mediante poder do jogador, executa a atração gravitacional reversa com arrefecimento térmico dos blocos.
- **Reciclagem de Detritos Urbanos:** Em Manaus, prédios destruídos geram blocos instanciados com vida útil limitada e colisores temporários descartáveis (`DestructionSystem.ts`), evitando sobrecarga de física acumulada.
