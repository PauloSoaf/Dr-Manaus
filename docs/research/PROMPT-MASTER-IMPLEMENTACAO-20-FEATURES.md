# PLANO DE EXECUÇÃO SEQUENCIAL: IMPLEMENTAÇÃO DOS 20 SISTEMAS ARQUITETURAIS (DR-MANAUS)

> **Instruções ao Modelo de IA / Engenheiro:**
> Execute **uma única funcionalidade por vez**, de forma pausada, com foco em desenvolvimento profissional, código na massa de verdade, sem economizar linhas e sem atalhos preguiçosos.
> O branch de trabalho é estritamente `feat/universe-map`. Cada funcionalidade implementada deve manter o build verde (`npm run build`) e a integridade do TypeScript (`npx tsc --noEmit`).

---

## ESTRUTURA PADRÃO DE EXECUÇÃO POR FEATURE
Ao receber o comando para implementar um item (ex: `EXECUTAR FEATURE 01`), siga rigorosamente este roteiro:
1. **Inspeção do Repositório Clonado**: Ler o código original em `references/<repo>/...` apontado no spec.
2. **Implementação do Código Alvo**: Criar ou estender o arquivo em `src/...` com todas as equações matemáticas, shaders, classes e conexões no `Game.ts`.
3. **Validação Operacional**: Garantir que não há erros de tipagem e que o asset ou shader carrega no navegador.
4. **Entrega e Pausa**: Fazer o commit semântico, dar push na branch e solicitar autorização antes de passar para a próxima.

---

## CRONOGRAMA DE PROMPTS PASSO A PASSO (20 ETAPAS)

### FASE 1: AMBIENTE, ÁGUA E TOPOGRAFIA TERRESTRE (MANAUS)

#### PROMPT 01: Água Realista dos Rios Negro e Solimões
```text
EXECUTAR FEATURE 01: Renderização de Água Realista (Rio Negro & Solimões)
Baseie-se rigorosamente no documento docs/research/01-water-rendering.md e nos códigos clonados:
- references/beautiful-water/src/scene/webgpu-wave-nodes.js
- references/threejs-water-free/src/material/waterMaterial.js
- references/threejs-water-free/src/physics/buoyancy.js

Tarefas Mão na Massa:
1. Atualize src/world/water/Water.ts e src/world/realcity/water.ts implementando o cálculo analítico de 4 ondas trocoidais de Gerstner diretamente no vertex shader.
2. Crie a separação de cor e turbidez óptica pela Lei de Beer-Lambert: Rio Negro (águas escuras, ricas em ácidos húmicos, alta absorção) e Rio Solimões (barrento, ocre, alto espalhamento).
3. Exporte a função sampleWaterHeight(x, z, time) para que barcos e o herói flutuem em tempo real no Three.js.
4. Verifique npx tsc --noEmit e npm run build.
```

#### PROMPT 02: Topografia Urbana e Desníveis de Igarapés
```text
EXECUTAR FEATURE 02: Topografia Urbana e Relevo Fluvial de Manaus
Baseie-se rigorosamente no documento docs/research/10-urban-elevation-and-topographic-relief.md e nos códigos clonados:
- references/city-tour/src/terrain.js
- references/city-tour/src/terrain_candidate_road_network.js

Tarefas Mão na Massa:
1. Em src/world/realcity/realcity.ts, integre a malha de relevo com interpolação bilinear contínua de alturas O(1).
2. Atualize src/world/realcity/buildings.ts para gerar alicerces e muros de contenção (foundation skirts) para que nenhum prédio flutue nos declives dos igarapés.
3. Ajuste src/world/realcity/roads.ts para que as faixas de asfalto acompanhem suavemente as curvas de nível do terreno com suavização laplaciana.
4. Valide a compilação com npx tsc --noEmit e teste no build.
```

#### PROMPT 03: Streaming de Dados Geoespaciais (Overture Maps & OSM)
```text
EXECUTAR FEATURE 03: Ingestão e Tesselação de Dados Geoespaciais Overture Maps
Baseie-se no documento docs/research/17-geospatial-data-streaming-overture-and-gis.md e em:
- references/city-tour/src/meshes/road_mesh_builder.js
- references/Procedural-City-Generator/js/procedural.city.generator.js

Tarefas Mão na Massa:
1. Implemente em src/world/realcity/realcity.ts o projetor geodésico ManausGISProjector centralizado no Teatro Amazonas (WGS84 -> Metros Locais).
2. Tesselar os anéis de polígonos de edifícios reais e extrudá-los em 3D preservando os gabaritos oficiais.
3. Armazenar tiles vetoriais compactos no IndexedDB para permitir carregamento instantâneo offline.
4. Valide a compilação com npx tsc --noEmit.
```

#### PROMPT 04: Clima Dinâmico e Chuva Amazônica
```text
EXECUTAR FEATURE 04: Clima Dinâmico, Chuva Equatorial e Ciclo Dia/Noite
Baseie-se no documento docs/research/15-dynamic-weather-rain-and-day-night-cycle.md e em:
- references/beautiful-water/src/scene/sky.js
- references/instanced-mesh/src/InstancedMesh2.ts

Tarefas Mão na Massa:
1. Crie src/world/weather/WeatherSystem.ts simulando o ciclo dia/noite calculado para as coordenadas solares reais de Manaus.
2. Implemente o sistema de partículas instanciadas em GPU para 25.000 gotas de chuva que acompanham a câmera em um envelope toroidal.
3. Injete o uniform de molhamento (uWetnessFactor) no asfalto e concreto para gerar reflexos especulares e poças graduais durante a chuva.
4. Valide com npx tsc --noEmit e npm run build.
```

---

### FASE 2: VIDA URBANA, POPULAÇÃO E MOBILIDADE

#### PROMPT 05: Tráfego Urbano e Multidões por Spatial Hash Grid
```text
EXECUTAR FEATURE 05: Simulação de Tráfego e Pedestres com Grade Espacial O(N)
Baseie-se no documento docs/research/08-npc-crowds-traffic-and-boids-simulation.md e em:
- references/boids-js/common/Grid.js
- references/boids-js/common/Entity.js
- references/instanced-mesh/src/InstancedMesh2.ts

Tarefas Mão na Massa:
1. Atualize src/world/traffic/TrafficSystem.ts criando uma FastSpatialGrid2D contígua para busca de vizinhos em tempo constante.
2. Implemente regras de Reynolds (separação, alinhamento e acompanhamento de faixas viárias) para carros e barcos fluviais.
3. Em src/entities/PopulationManager.ts, adicione IA de pedestres que andam nas calçadas e dispersam em pânico se o jogador pousar com impacto supersônico.
4. Valide a estabilidade com npx tsc --noEmit.
```

#### PROMPT 06: Geração Procedural de Bairros e Assentamentos
```text
EXECUTAR FEATURE 06: Preenchimento Procedural de Bairros e Metrópoles Alienígenas
Baseie-se no documento docs/research/05-open-world-cities-and-procedural-generation.md e em:
- references/city-tour/src/generators/buildings_generator.js
- references/Procedural-City-Generator/js/procedural.city.generator.js

Tarefas Mão na Massa:
1. Em src/world/realcity/buildings.ts, implemente o algoritmo de zoneamento urbano para preencher lacunas de dados reais com quarteirões modulares.
2. Crie gerador de arquitetura extraterrestre com formas geométricas anulares e piramidais para assentamentos em outros planetas.
3. Agrupe as geometrias geradas em BatchedMesh para reduzir draw calls drásticamente.
4. Valide com npx tsc --noEmit e npm run build.
```

---

### FASE 3: HERÓI, ANIMAÇÃO E COMBATE

#### PROMPT 07: Cinemática Inversa (Two-Bone FABRIK IK) e Adaptação ao Terreno
```text
EXECUTAR FEATURE 07: Sistema de IK para Pés e Mascaramento de Tronco
Baseie-se no documento docs/research/07-character-animation-ik-and-blend-trees.md e em:
- references/THREE.IK/src/core/IKSolver.js
- references/THREE.IK/src/core/IKChain.js
- references/three-mesh-bvh/src/core/cast/raycastFirst.template.js

Tarefas Mão na Massa:
1. Em src/player/CharacterModel.ts, implemente o TwoBoneIKSolver com a lei dos cossenos e FABRIK para acomodar as solas dos pés em ladeiras e degraus de até 45 graus.
2. Em src/player/AnimationController.ts, adicione mascaramento ósseo (bone masking) na espinha dorsal para permitir mira e disparo de feixes com o tronco superior enquanto as pernas correm.
3. Desative o resolvedor automaticamente no ar para economizar processamento.
4. Valide com npx tsc --noEmit.
```

#### PROMPT 08: Combate Fluido, Soft-Targeting Polar e Hitstop
```text
EXECUTAR FEATURE 08: Combate Fluido com Soft-Targeting e Hitstop Cinético
Baseie-se no documento docs/research/09-fluid-combat-soft-targeting-and-hitstop.md e em:
- references/three-mesh-bvh/src/core/cast/raycastFirst.template.js
- references/NonEuclidean/NonEuclidean/Input.cpp

Tarefas Mão na Massa:
1. Atualize src/player/combat/CombatSystem.ts implementando o cálculo de seleção polar de alvo dentro de um cone angular cônico frontal de 60 graus.
2. Adicione gerenciador de hitstop pausando temporariamente a escala de tempo da entidade atacada e do atacante por 3 a 5 quadros (40-70ms) após impacto crítico.
3. Conecte o raycast de alta velocidade acelerado por BVH ao PowerSystem.ts.
4. Valide com npx tsc --noEmit e npm run build.
```

#### PROMPT 09: Teletransporte Tático e Salto Quântico
```text
EXECUTAR FEATURE 09: Teletransporte Tático sem Colisão e Deslocamento Quântico
Baseie-se no documento docs/research/02-teleportation-systems.md e em:
- references/NonEuclidean/NonEuclidean/Camera.cpp
- references/webgl-portals/src/PortalMesh.js

Tarefas Mão na Massa:
1. Crie src/world/spatial/TeleportSystem.ts gerenciando teletransporte tático (< 500m) com compensação de normal da superfície e offset de cápsula.
2. Adicione transição quântica interestelar com interpolação de lente gravitacional e preservação coerente de momento angular.
3. Integre com o feixe de mira do PowerSystem.ts.
4. Valide com npx tsc --noEmit.
```

#### PROMPT 10: Portais Dimensionais Sem Costura (Seamless Portals)
```text
EXECUTAR FEATURE 10: Portais Dimensionais em Tempo Real com Matriz Oblíqua
Baseie-se no documento docs/research/03-seamless-portals.md e em:
- references/webgl-portals/src/PortalRenderer.js
- references/webgl-portals/src/PortalMesh.js
- references/NonEuclidean/NonEuclidean/Portal.cpp

Tarefas Mão na Massa:
1. Crie src/world/spatial/PortalSystem.ts com emparelhamento de portais bidirecionais e renderização em RenderTarget secundário.
2. Implemente o cálculo de plano de projeção próximo oblíquo (Oblique Near-Plane Clipping) na câmera virtual.
3. Adicione detecção contínua de travessia do plano do portal pelo jogador no Game.ts com reposicionamento sem solavancos.
4. Valide com npx tsc --noEmit e npm run build.
```

---

### FASE 4: FÍSICA E DESTRUIÇÃO

#### PROMPT 11: Fatiamento de Malhas em Tempo Real (Slicing) e Fratura Voronoi
```text
EXECUTAR FEATURE 11: Destruição Procedural com Corte de Malha e Fratura Voronoi
Baseie-se no documento docs/research/11-procedural-destruction-and-mesh-slicing.md e em:
- references/three-pinata/lib/src/fracture/Slice.ts
- references/three-pinata/lib/src/triangulators/ConstrainedTriangulator.ts
- references/three-bvh-csg/src/core/Evaluator.js

Tarefas Mão na Massa:
1. Atualize src/world/destruction/DestructionSystem.ts com fatiamento planar analítico de triângulos e geração de tampas fechadas (caps) estanques.
2. Em src/world/destruction/PlanetaryRupturePresentation.ts, conecte o algoritmo de reconstrução reversa animada (startReverseReconstruction).
3. Corrija os materiais dos fragmentos para MeshStandardMaterial com emissiveIntensity funcional.
4. Valide com npx tsc --noEmit.
```

---

### FASE 5: UNIVERSO CÓSMICO E ESCALA ASTRONÔMICA

#### PROMPT 12: Renderização Planetária Cube-Sphere e Transição Orbital
```text
EXECUTAR FEATURE 12: Esferas Planetárias com Quadtree Normalizada Cube-Sphere
Baseie-se no documento docs/research/04-planetary-rendering-and-transitions.md e em:
- references/lagrange/src/core/tsl/materials/planet.tslmat.ts
- references/threejs-procedural-planets/scripts/atmosphere.js

Tarefas Mão na Massa:
1. Refatore src/world/planet/PlanetSurface.ts para utilizar malha cúbica de 6 faces esferizadas (Cube-Sphere) com quadtree adaptativa e saias (skirts) contra fendas de LOD.
2. Em src/world/spatial/RenderSpaceService.ts, garanta a estabilidade de ponto flutuante via origem de câmera flutuante relativa.
3. Conecte a gravidade esférica radial dependendo do corpo celeste ativo.
4. Valide com npx tsc --noEmit e npm run build.
```

#### PROMPT 13: Voo Relativístico e Motor de Dobra Espacial (Warp Drive)
```text
EXECUTAR FEATURE 13: Dobra Espacial com Aberração Relativística e Poço Gravitacional
Baseie-se no documento docs/research/13-interstellar-warp-and-relativistic-flight.md e em:
- references/lagrange/src/core/utils/math-utils.ts
- references/beautiful-water/src/core/gpu-frame-timer.js

Tarefas Mão na Massa:
1. Em src/world/travel/BodyNavigation.ts, implemente o controlador de velocidade relativística (de sub-sônico a 10c) com freio automático em poços gravitacionais (< 500km).
2. Expanda o campo de visão (FoV) dinamicamente de 60 a 95 graus conforme a velocidade de dobra.
3. Renderize o efeito visual de convergência frontal das estrelas no shader do céu estrelado.
4. Valide com npx tsc --noEmit.
```

#### PROMPT 14: Nebulosas Volumétricas do Telescópio James Webb (JWST)
```text
EXECUTAR FEATURE 14: Nebulosas Tridimensionais com Raymarching e Filtros JWST
Baseie-se no documento docs/research/14-volumetric-skies-atmospheres-and-jwst-nebulae.md e em:
- references/lagrange/src/core/tsl/noise/fbm3.ts
- references/lagrange/src/core/tsl/materials/atmosphere.tslmat.ts

Tarefas Mão na Massa:
1. Crie src/world/sky/CosmicNebulaeSystem.ts renderizando as 4 nebulosas JWST (Pilares da Criação, Carina, Anel do Sul e Tarântula) como caixas volumétricas navegáveis.
2. Use raymarching leve com ruído fractal 3D e amostragem de paleta de cores reais dos filtros infravermelhos NIRCam/MIRI do James Webb.
3. Permita que o jogador entre e atravesse o gás da nebulosa com espalhamento de luz em torno da câmera.
4. Valide com npx tsc --noEmit e npm run build.
```

#### PROMPT 15: O Leviatã Astral e Chefes Cósmicos em Escala Real
```text
EXECUTAR FEATURE 15: Leviatã Astral: Unificação de Coordenadas, Fases e Ataques
Baseie-se no documento docs/research/16-colossal-titans-planetary-bosses-and-multi-ik.md e em:
- references/THREE.IK/src/core/IKChain.js
- references/three-mesh-bvh/src/core/SkinnedMeshBVH.js

Tarefas Mão na Massa:
1. Em src/world/life/CosmicPlanetTitan.ts, garanta que a órbita esteja configurada a 1,65e12m (além de Saturno) e exponha coordenadas locais transformadas para alvos de combate e scanner (tecla N).
2. Implemente a fase agressiva com disparos reais de esferas de plasma em direção ao jogador e quebra progressiva de escudos por núcleo vulnerável.
3. Ajuste o proxy distante para calcular o tamanho angular físico exato sem Math.max(300, ...).
4. Valide com npx tsc --noEmit e npm run build.
```

---

### FASE 6: ÁUDIO, INTERFACE, PERFORMANCE E PERSISTÊNCIA

#### PROMPT 16: Áudio Espacial Procedural e Efeitos Hipersônicos
```text
EXECUTAR FEATURE 16: Síntese Sonora Web Audio e Áudio Espacial 3D
Baseie-se no documento docs/research/12-procedural-spatial-audio-and-sound-synthesis.md e em:
- references/beautiful-water/src/core/presentation-monitor.js
- references/bitECS/src/core/Query.ts

Tarefas Mão na Massa:
1. Implemente src/audio/HypersonicAudioSystem.ts com osciladores senoidais e serra modulados pela velocidade de voo e quebra da barreira do som (estrondo sônico).
2. Aplique filtro passa-baixa de 350 Hz no áudio mestre ao submergir nos rios Negro e Solimões.
3. Adicione reverberação de convolução para o interior do Teatro Amazonas e vibrações sub-graves emitidas pelo Leviatã Astral.
4. Valide com npx tsc --noEmit.
```

#### PROMPT 17: HUD Diegético e Interface com Zero Reflow
```text
EXECUTAR FEATURE 17: HUD Diegético Espacial com Desempenho Zero Reflow
Baseie-se no documento docs/research/18-diegetic-low-overhead-web-hud-and-ui.md e em:
- references/lagrange/src/core/utils/ui-utils.ts
- references/beautiful-water/src/ui/renderer-toggle.js

Tarefas Mão na Massa:
1. Crie src/ui/DiegeticHUD.ts com marcadores de mira 3D projetados diretamente no espaço do jogo via Three.js Sprites instanciados.
2. Integre o visor taxonômico do Scanner Cósmico de espécies acionado pela tecla N.
3. Otimize os dados 2D na tela via transform3d e escrita condicional no DOM, eliminando layout thrashing e reflow síncrono.
4. Valide com npx tsc --noEmit e npm run build.
```

#### PROMPT 18: Renderização Otimizada HLOD e Pipeline WebGPU
```text
EXECUTAR FEATURE 18: Otimização Extrema de Renderização com HLOD e Frustum GPU
Baseie-se no documento docs/research/06-lightweight-web-rendering-webgpu-hlod.md e em:
- references/instanced-mesh/src/core/feature/FrustumCulling.ts
- references/instanced-mesh/src/core/feature/LOD.ts
- references/three-mesh-bvh/src/webgpu/ClusteredBVH.js

Tarefas Mão na Massa:
1. Crie src/world/spatial/HLODSystem.ts classificando entidades da cidade e da vegetação em 4 níveis de detalhe adaptativos por distância.
2. Configure frustum culling acelerado para não iterar objetos fora da visão na CPU.
3. Aplique transições suaves com dissolução estocástica (dithered cross-fade) para eliminar o popping de geometrias.
4. Valide com npx tsc --noEmit e npm run build.
```

#### PROMPT 19: Arquitetura ECS Orientada a Dados (Structure of Arrays)
```text
EXECUTAR FEATURE 19: ECS SoA e Paralelização em Web Workers
Baseie-se no documento docs/research/19-data-oriented-ecs-and-web-worker-concurrency.md e em:
- references/bitECS/src/core/World.ts
- references/bitECS/src/core/utils/soa.ts
- references/boids-js/common/BoidsWorker.js

Tarefas Mão na Massa:
1. Crie src/core/CosmicStateStore.ts com buffers tipados Float32Array para posições, velocidades e saúde de até 50.000 entidades.
2. Desloque a integração matemática de trajetórias e colisões para um Web Worker dedicado.
3. Atualize as matrizes do InstancedMesh diretamente do buffer transferido sem alocações no heap.
4. Valide com npx tsc --noEmit e npm run build.
```

#### PROMPT 20: Persistência Cósmica Binária no IndexedDB
```text
EXECUTAR FEATURE 20: Serialização Binária Compacta e Persistência no IndexedDB
Baseie-se no documento docs/research/20-persistent-cosmic-state-and-binary-serialization.md e em:
- references/bitECS/src/serialization/SoASerializer.ts
- references/lagrange/src/dexie.config.ts

Tarefas Mão na Massa:
1. Em src/core/SaveManager.ts, migre a persistência para buffers binários comprimidos via CompressionStream no IndexedDB nativo.
2. Salve integralmente o estado do Leviatã Astral (vida, escudos, fase), corpos celestes rompidos e espécies descobertas no Atlas Cósmico.
3. Implemente salvamento automático a cada 60 segundos com suporte a exportação/importação de arquivo local .drmanaus.
4. Valide npx tsc --noEmit, execute npm run build e certifique-se de que o jogo completo funciona com fluidez cinematográfica a 60 FPS.
```
