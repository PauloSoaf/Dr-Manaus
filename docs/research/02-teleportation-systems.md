# 02. Sistemas de Teletransporte Instantâneo e Zero-Stutter

## 1. Contexto no Dr-Manaus
O super-herói Dr-Manaus possui a habilidade de dobrar o espaço através de teletransporte instantâneo (`KeyE`), operando em múltiplos domínios:
- **Local (Micro):** Deslocamento tático de combate em Manaus (5 m a 200 m) através de telhados e avenidas.
- **Planetário (Meso):** Salto instantâneo entre o solo em Manaus e o topo da órbita terrestre / Kármán line (100 km+).
- **Interplanetário/Interestelar (Macro):** Salto cósmico entre planetas do Sistema Solar e estrelas exóticas em Alpha Centauri e Trappist-1.
O principal gargalo é evitar quedas de FPS (*frametime spikes*) causadas por carregamento síncrono de geometrias, compilação de shaders (*shader compilation stutter*) e alocações na GPU durante a realocação do ponto de vista.

---

## 2. Repositórios GitHub de Referência
1. **[CesiumGS/cesium](https://github.com/CesiumGS/cesium)**
   - *Descrição:* Plataforma geoespacial 3D aberta que gerencia streaming massivo e saltos instantâneos de câmera em escala planetária (`Camera.flyTo` e `setView`).
   - *Aplicabilidade no Dr-Manaus:* Algoritmos de determinação de octree e priorização de quadtree com cache LRU multinível para que o destino do teletransporte pré-carregue suas instâncias antes de autorizar a mudança do vetor de posição.
2. **[pmndrs/three-stdlib](https://github.com/pmndrs/three-stdlib)**
   - *Descrição:* Coleção de utilitários mantidos pela comunidade para Three.js, contendo implementações avançadas de `CameraControls` com dampening assintótico, prewarm de materiais e transições ortogonais instantâneas sem desmontagem de buffers.
   - *Aplicabilidade no Dr-Manaus:* Padrão de pré-aquecimento e vinculação imediata de matrizes de projeção.

---

## 3. Jogos de Referência de Mundo Aberto
1. **[Ratchet & Clank: Rift Apart](https://insomniac.games/game/ratchet-clank-rift-apart/) (Insomniac Games)**
   - *Referência Técnica:* Transição instantânea entre dimensões e planetas sem telas de carregamento. Utiliza renderização concorrente do destino em um render-target secundário e descompressão por streaming direto da memória para alternar o mundo em 1 quadro.
2. **[Dishonored 2](https://bethesda.net/en/game/dishonored-2) (Arkane Studios)**
   - *Referência Técnica:* Habilidade "Blink" / "Far Reach": teletransporte direcional imediato com raycast de colisão em arco preditivo, interpolação de FoV suave com efeito de aberração cromática temporal e realocação instantânea de física sem tunelamento (*CCD - Continuous Collision Detection*).
3. **[Infamous: Second Son](https://www.suckerpunch.com/category/games/infamous-second-son/) (Sucker Punch Productions)**
   - *Referência Técnica:* Deslocamento baseado em fumaça/néon através de dutos de ventilação verticais e saltos espaciais em Seattle com partículas acopladas ao vetor de velocidade e posicionamento seguro nos vértices de colisão.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[MDN Web Docs - Transferable Objects in Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)**
   - Especificação sobre transferência de `ArrayBuffer` com custo de cópia zero ($O(1)$) entre Web Workers de terreno/cidade e a thread principal, permitindo preparar lotes de colisão no destino antes do gatilho do teletransporte.
2. **[WebGPU Pipeline Caching & Precompilation Guide](https://gpuweb.github.io/gpuweb/#gpupipelinelayout)**
   - Especificação dos layouts de pipeline e compilação antecipada de nós TSL (`renderer.compileAsync`), garantindo que nenhum novo material ou efeito visual associado à área de destino cause engasgo de compilação durante o salto.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Sistema de Pre-Warming em Dois Estágios:** Durante o acionamento da mira de teletransporte (quando o jogador aponta o retículo com `KeyE`), o `StreamerManager` e o `RenderSpaceService` já começam a alocar os nós da malha do destino em background.
- **Realocação Segura de Floating Origin:** Atualizar o `renderOriginVec` simultaneamente com o `player.position` preservando as matrizes de visão relativas, garantindo precisão numérica de 64 bits sem que as malhas sofram jitter de ponto flutuante.
