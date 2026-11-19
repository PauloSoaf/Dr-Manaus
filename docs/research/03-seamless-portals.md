# 03. Portais Sem Emenda e Geometria Não-Euclidiana

## 1. Contexto no Dr-Manaus
Dr-Manaus lida com anomalias cósmicas, ruínas ancestrais e fendas no contínuo espaço-tempo deixadas por Leviatãs Astrais. A capacidade de criar ou encontrar portais tridimensionais estáveis — onde o jogador consegue enxergar o destino através de uma abertura elíptica no ar e atravessá-la sem qualquer corte, interrupção ou tela de carregamento — adiciona uma camada de jogabilidade cósmica comparável aos artefatos de civilizações antigas espalhadas pelos planetas.

---

## 2. Repositórios GitHub de Referência
1. **[bryce-evans/webgl-portals](https://github.com/bryce-evans/webgl-portals)**
   - *Descrição:* Framework construído sobre Three.js para renderização de portais em tempo real, utilizando máscaras de stencil buffer, câmeras acopladas por transformações matriciais relativas e planos oblíquos de corte (*oblique near-plane clipping*).
   - *Aplicabilidade no Dr-Manaus:* Base para desenhar portais que conectam o solo de Manaus (ex: interior do Teatro Amazonas) a templos alienígenas em luas distantes de Saturno.
2. **[HackerPoet/NonEuclidean](https://github.com/HackerPoet/NonEuclidean)**
   - *Descrição:* O repositório de código aberto mais consagrado do mundo para motores de portais não-euclidianos em C++ / OpenGL. Implementa recursão matemática de câmeras, corte exato de frustum pelo polígono do portal e conservação contínua de quantidade de movimento angular.
   - *Aplicabilidade no Dr-Manaus:* Conversão direta dos algoritmos de matriz de corte oblíquo para a classe de câmeras de Three.js / WebGPU do jogo.

---

## 3. Jogos de Referência de Mundo Aberto e Ação
1. **[Portal 2](https://store.steampowered.com/app/620/Portal_2/) (Valve)**
   - *Referência Técnica:* A referência máxima em portais contínuos: física inercial preservada através do portal ($F = ma$ conservando velocidade e rotação), renderização recursiva de espelhos e stencil masking com planos de corte para evitar oclusão de geometria intermediária.
2. **[Splitgate](https://www.splitgate.com/) (1047 Games)**
   - *Referência Técnica:* Aplicação de portais de combate em escala competitiva de alta velocidade. Otimização de render-targets com resolução dinâmica (*dynamic resolution scaling*) na visão interna do portal quando a câmera do jogador está distante.
3. **[Manifold Garden](https://manifoldgarden.com/) (William Chyr Studio)**
   - *Referência Técnica:* Espaços infinitos interligados e repetição não-euclidiana com iluminação em células cúbicas e transições de gravidade instantâneas ao atravessar superfícies.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Three.js Stencil Buffer & Viewport Scissor Documentation](https://threejs.org/docs/#api/en/materials/Material.stencilWrite)**
   - Guia do Three.js sobre manipulação das operações de teste de estêncil (`stencilFunc`, `stencilRef`, `stencilMask`, `stencilFail`, `stencilZFail`, `stencilZPass`), essenciais para isolar a renderização da cena remota estritamente no formato geométrico do anel do portal sem renderizar o restante da tela duas vezes.
2. **[W3C WebGPU Stencil Operations Specification](https://www.w3.org/TR/webgpu/#stencil-state)**
   - Especificação sobre pipeline de estêncil em WebGPU (`GPUStencilFaceState`), regulando como primitivas de geometria gravam bits na máscara para descarte imediato de fragmentos na GPU.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Câmera Virtual Acoplada:** Calcular a matriz de visão da câmera secundária como:
  $$M_{\text{cam,dest}} = M_{\text{cam,orig}} \times M_{\text{portal,orig}}^{-1} \times M_{\text{portal,dest}}$$
- **Plano de Corte Próximo Oblíquo:** Reconfigurar a matriz de projeção da câmera de destino para que o seu plano próximo (*near plane*) coincida exatamente com o plano do portal de saída, evitando que paredes ou objetos atrás do portal apareçam na visão interna.
- **Transição Física Inercial:** Ao detectar que o capsule do jogador cruza o plano da elipse, transformar simultaneamente a posição e o vetor de velocidade (`player.velocity`) para o novo referencial sem desaceleração.
