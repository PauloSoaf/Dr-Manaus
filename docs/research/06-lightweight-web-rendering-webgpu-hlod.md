# 06. Renderização Leve na Web: WebGPU, HLOD e Culling

## 1. Contexto no Dr-Manaus
O maior obstáculo de jogos 3D ambiciosos executados no navegador é o consumo de CPU na thread principal do JavaScript: coleta de lixo (*garbage collection pauses*), custos de emissão de comandos (*draw call overhead*) e sincronização síncrona de buffers. O Dr-Manaus adota a arquitetura **WebGPU pura com Three.js TSL**, exigindo uma estratégia de renderização ultra-leve:
- Loop de jogo com **zero alocação de objetos por quadro** (reutilização de instâncias scratch prealocadas).
- **Frustum Culling** e **Occlusion Culling** acelerados por BVH (Bounding Volume Hierarchy).
- **Hierarchical Level of Detail (HLOD)** que funde milhares de instâncias em blocos de baixa densidade poligonal conforme a câmera se afasta.

---

## 2. Repositórios GitHub de Referência
1. **[agargaro/instanced-mesh](https://github.com/agargaro/instanced-mesh)**
   - *Descrição:* `InstancedMesh2`, uma extensão de ponta para Three.js que adiciona suporte nativo a frustum culling individual por instância, ordenação de profundidade (*depth sorting*), suporte a múltiplos níveis de detalhe (LOD) e raycasting acelerado por BVH.
   - *Aplicabilidade no Dr-Manaus:* Fundamental para vegetação alienígena, postes de iluminação e detritos urbanos espalhados pelas ruas de Manaus.
2. **[gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)**
   - *Descrição:* Bounding Volume Hierarchy rápido para Three.js. Acelera raycasting em mais de 100x e permite consultas de interseção volumétrica em geometrias com centenas de milhares de triângulos em sub-milissegundos.
   - *Aplicabilidade no Dr-Manaus:* Usado para detecção precisa de mira de poderes (laser, teletransporte, scanner de espécies) sem iterar por arrays lineares de colisores.
3. **[pmndrs/detect-gpu](https://github.com/pmndrs/detect-gpu)**
   - *Descrição:* Biblioteca de detecção e classificação de hardware GPU para WebGL e WebGPU, determinando automaticamente o tier de performance da máquina do usuário.
   - *Aplicabilidade no Dr-Manaus:* Ajuste dinâmico automático do perfil de qualidade gráfica (`QualityManager.ts`) entre 30 FPS econômico e 60+ FPS cinematográfico.

---

## 3. Jogos de Referência de Otimização e Culling
1. **[The Legend of Zelda: Tears of the Kingdom / Breath of the Wild](https://www.nintendo.com/games/detail/the-legend-of-zelda-tears-of-the-kingdom-switch/) (Nintendo)**
   - *Referência Técnica:* Exemplo lendário de como extrair um mundo aberto massivo com física interativa em hardware com restrições extremas (Nintendo Switch, 4GB RAM e GPU de 393 GFLOPs). Destaque para o sistema de *impostors* 2D em distâncias médias e transição dinâmica de malhas combinadas.
2. **[Doom Eternal](https://bethesda.net/en/game/doom) (id Software)**
   - *Referência Técnica:* Arquitetura de motor id Tech 7 baseada em submissão assíncrona de jobs na GPU, eliminação agressiva de alocações de memória dinâmica durante o gameplay e taxas sustentadas de mais de 144 FPS.
3. **[Horizon Forbidden West](https://www.playstation.com/en-us/games/horizon-forbidden-west/) (Guerrilla Games)**
   - *Referência Técnica:* Oclusão por hardware baseada em buffer de profundidade hierárquico (Hi-Z buffer), onde terrenos, montanhas e estruturas descartam toda a geometria oculta antes de qualquer passagem de sombreamento.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Google Chrome WebGPU Performance Best Practices](https://developer.chrome.com/docs/capabilities/web-apis/gpu-performance)**
   - Guia oficial do time do Chromium com as melhores práticas de desempenho para WebGPU: agrupamento de comandos em `GPUCommandEncoder`, redução de trocas de `GPURenderPipeline`, utilização de `uniform buffer objects` unificados e uso de instancing em massa.
2. **[Three.js WebGPURenderer Architecture Guide](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)**
   - Documentação da arquitetura de backend do Three.js WebGPU, explicando como a árvore de nós TSL compila de forma transpilada para WGSL nativo sem sobretaxas de overhead do driver.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Regra de Heap Zero no Game Loop:** Nenhum `new Vector3()`, `new Matrix4()` ou closure de callback anônimo pode ser instanciado dentro do método `update(dt)`. Todas as variáveis transitórias devem residir em instâncias scratch compartilhadas na classe.
- **Occlusion Culling por Setores:** Segmentar a cidade de Manaus em quadrículas de 256m com teste de frustum na CPU e teste de oclusão dos edifícios altos do Centro para descartar antecipadamente as quadras traseiras.
