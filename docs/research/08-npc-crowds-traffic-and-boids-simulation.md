# 08. Simulação de Multidões de NPCs, Trânsito e Boids

## 1. Contexto no Dr-Manaus
Uma metrópole como Manaus abriga mais de 2 milhões de habitantes, com circulação intensa de pedestres no Centro Histórico, turistas no Largo de São Sebastião e fluxo contínuo de carros e ônibus nas principais vias (como Constantino Nery e Djalma Batista). Em mundos alienígenas, o mesmo motor governa colônias extraterrestres com trabalhadores, sentinelas e drones de patrulha. A simulação precisa manter centenas de agentes ativos a 60 FPS no navegador, integrando:
- Direção de veículos restrita estritamente aos segmentos de asfalto reais do grafo viário (`RoadGraph`).
- Pedestres com inteligência coletiva baseada em regras de Boids (separação, alinhamento, coesão, evasão).
- Reações orgânicas a eventos dramáticos: pânico e fuga diante de voos hipersônicos, pousos de super-herói ou frenagens bruscas com buzinas.

---

## 2. Repositórios GitHub de Referência
1. **[ercang/boids-js](https://github.com/ercang/boids-js)**
   - *Descrição:* Simulação 3D de bandos e multidões (Boids) em Three.js acelerada com particionamento espacial em grade (*spatial grid bucketing*) e processamento em Web Workers para não travar a UI.
   - *Aplicabilidade no Dr-Manaus:* Algoritmo de particionamento espacial para agrupar pedestres e fauna alienígena em células de 32m, reduzindo a busca de vizinhos de $O(N^2)$ para $O(N)$.
2. **[crowdedjs/examples](https://github.com/crowdedjs/examples)**
   - *Descrição:* Motor de simulação de multidões em navegador com suporte a Recast/Detour compilado em WebAssembly, pathfinding de navmesh e desvio local de colisão (RVO2 - Reciprocal Velocity Obstacles).
   - *Aplicabilidade no Dr-Manaus:* Navegação inteligente de civis ao redor de prédios desmoronados e crateras de impacto.
3. **[recastnavigation/recastnavigation](https://github.com/recastnavigation/recastnavigation)**
   - *Descrição:* O kit de ferramentas de geração de malhas de navegação (navmesh) e pathfinding mais adotado na indústria de jogos (usado pela Unreal Engine, Unity e motores proprietários).
   - *Aplicabilidade no Dr-Manaus:* Geração de malhas navegáveis para as calçadas de Manaus a partir dos polígonos de ruas do Overture Maps.

---

## 3. Jogos de Referência de Multidões e Tráfego
1. **[Hitman: World of Assassination](https://www.ioi.dk/hitman-world-of-assassination/) (IO Interactive)**
   - *Referência Técnica:* Motor Glacier com o mais avançado sistema de multidões densas da indústria: milhares de NPCs com instanciamento dinâmico de esqueletos, inteligência distribuída de pânico em cascata e transição contínua entre personagens genéricos de fundo e alvos interativos.
2. **[Grand Theft Auto V](https://www.rockstargames.com/gta-v) (Rockstar Games)**
   - *Referência Técnica:* IA veicular de referência mundial: veículos seguem nós de tráfego com lógica de troca de faixas, semáforos, frenagem com buzinas ao encontrar obstáculos e comportamento de desvio evasivo caso o jogador aponte armas ou bloqueie a pista.
3. **[Watch Dogs 2](https://www.ubisoft.com/en-gb/game/watch-dogs-2) (Ubisoft)**
   - *Referência Técnica:* Simulação de cidadãos com rotinas diárias completas, conversas situacionais, interações dinâmicas entre si (brigas, fotos, ligações para a polícia) e reações sonoras ricas ao ambiente urbano.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[RVO2 Library - Reciprocal Collision Avoidance for Multi-Agent Navigation](https://gamma.cs.unc.edu/RVO2/)**
   - Especificação matemática da Universidade da Carolina do Norte para evasão recíproca de colisões entre múltiplos agentes sem oscilações em corredores estreitos.
2. **[Three.js InstancedMesh Dynamic Matrix Updates](https://threejs.org/docs/#api/en/objects/InstancedMesh)**
   - Documentação de atualização contínua de matrizes de instâncias (`setMatrixAt` e `instanceMatrix.needsUpdate`), fundamental para mover carros e pedestres com custo de apenas duas chamadas de desenho (*draw calls*) para toda a cidade.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Pool Fixo com InstancedMesh:** Manter um pool fixo de 256 carros e 64 pedestres alocados uma única vez na inicialização da cidade, com ciclo de vida em anel ao redor da câmera (spawnam à frente e são reciclados silenciosamente atrás da visão).
- **IA de Frenagem e Buzina Reativa:** Veículos monitoram o cone frontal da pista; ao detectar o Dr-Manaus pousado ou pedestres atravessando, desaceleram com inclinação de suspensão e disparam a buzina procedural através do sintetizador Web Audio.
