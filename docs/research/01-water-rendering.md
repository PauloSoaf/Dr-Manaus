# 01. Renderização de Água: Bonita, Funcional e Leve na WebGPU

## 1. Contexto no Dr-Manaus
Manaus é mundialmente caracterizada pela confluência fluviométrica do **Rio Negro** (águas escuras, ricas em ácidos húmicos, quase sem sedimentos) e do **Rio Solimões** (águas barrentas, densas em sedimentos argilosos), além dos oceanos globais observados na Terra e lagos de hidrocarbonetos criogênicos em exoplanetas como Titã. O desafio consiste em renderizar superfícies aquáticas cinematográficas com reflexão Fresnel, refração realista, profundidade com absorção de Beer-Lambert, espuma de costa e cristas de ondas, mantendo o consumo de GPU abaixo de 2.0 ms em navegadores via **WebGPU / Three.js Shading Language (TSL)** sem alocações no loop.

---

## 2. Repositórios GitHub de Referência
1. **[baditaflorin/threejs-water-free](https://github.com/baditaflorin/threejs-water-free)**
   - *Descrição:* Renderização de oceano baseada em física (PBR) com FFT para Three.js WebGPU utilizando TSL. Inclui espectros de ondas JONSWAP, multi-cascata, céus procedurais, empuxo físico (buoyancy) e efeitos subaquáticos com fallback WebGL2.
   - *Aplicabilidade no Dr-Manaus:* Base ideal para a transição do shader analítico atual (`Water.ts`) para computação de ondas via TSL Compute, permitindo flutuação física de destroços e barcos no Rio Negro.
2. **[Spiri0/Threejs-WebGPU-IFFT-Ocean-V2](https://github.com/Spiri0/Threejs-WebGPU-IFFT-Ocean-V2)**
   - *Descrição:* Gerador de ondas oceânicas IFFT (Inverse Fast Fourier Transform) com compute shaders de WebGPU integrados ao Three.js.
   - *Aplicabilidade no Dr-Manaus:* Permite gerar mapas de altura e vetores de dispersão de onda na GPU sem sobrecarregar a thread principal da CPU.
3. **[VictorZakharov/beautiful-water](https://github.com/VictorZakharov/beautiful-water)**
   - *Descrição:* Água rasa e costeira cinematográfica em WebGPU/TSL com espuma nas margens, reflexão planar adaptativa e atenuação de profundidade.
   - *Aplicabilidade no Dr-Manaus:* Perfeito para a praia da Ponta Negra e as margens da orla de Manaus.

---

## 3. Jogos de Referência de Mundo Aberto
1. **[Sea of Thieves](https://www.seaofthieves.com/) (Rare / Xbox Game Studios)**
   - *Referência Técnica:* Padrão ouro da indústria em simulação e renderização volumétrica de água dinâmica. Utiliza ondas de Gerstner combinadas a simulação FFT, refração subsuperficial (*subsurface scattering* translúcido) e sincronização determinística de marés entre clientes.
2. **[Subnautica](https://unknownworlds.com/subnautica/) (Unknown Worlds Entertainment)**
   - *Referência Técnica:* Transição de câmera ar-água sem engasgos (*seamless water line*), absorção volumétrica de luz exponencial com base na profundidade e névoa densa cáustica com distorção de raios crepusculares.
3. **[Assassin's Creed IV: Black Flag](https://www.ubisoft.com/en-gb/game/assassins-creed/black-flag) (Ubisoft)**
   - *Referência Técnica:* Interação leve e escalável entre terreno, navios e água costeira/oceânica usando malhas adaptativas (CDLOD) e ondas direcionais com interpolação contínua de espuma.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Three.js TSL (Three Shading Language) Documentation](https://threejs.org/docs/#api/en/nodes/Nodes)**
   - Documentação oficial do pipeline de nós e computação em WebGPU do Three.js (`MeshBasicNodeMaterial`, `colorNode`, `depthTexture`). Fundamental para implementar refração de cena por amostragem de `viewportSharedTexture` e cálculo analítico de Fresnel com zero alocação de heap.
2. **[W3C WebGPU Specification - Depth & Multi-Sampling](https://www.w3.org/TR/webgpu/#depth-stencil-state)**
   - Especificação técnica dos formatos de textura de profundidade e estados de amostragem em WebGPU (`depth32float`, `depth24plus-stencil8`), necessária para calcular a distância ótica da água através do leito do rio/oceano para aplicar a lei de absorção de Beer-Lambert.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Textura de Transição do Encontro das Águas:** Implementar blend procedural na malha da orla entre as propriedades óticas do Rio Negro ($Color = [0.04, 0.02, 0.01]$, transparência reduzida) e do Rio Solimões ($Color = [0.45, 0.38, 0.22]$, espalhamento difuso elevado).
- **TSL Viewport Depth Shader:** Utilizar nós TSL `depthPass` subtraindo a coordenada de profundidade do fragmento aquático para calcular a espessura da coluna d'água e modular automaticamente a visibilidade do leito e a geração de espuma costeira.
