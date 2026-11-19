# 16. Chefes Colossais, Titãs Planetários e IK Multi-Ponto

## 1. Contexto no Dr-Manaus
O jogo introduz o **Leviatã Astral**: uma entidade cósmica viva de escala planetária (raio de 120 km e envergadura de 240 km), orbitando além de Saturno a $1,65 \times 10^{12}\text{ m}$ do Sol. O desafio técnico consiste em:
- Renderizar uma criatura do tamanho de um planeta sem estourar o limite de buffer de profundidade e sem descontinuidades entre visualização distante (proxy angular) e combate próximo.
- Gerenciar inteligência artificial ofensiva em escala cósmica: telegrafia de ataques, disparo de feixes de vácuo (*Void Beam*) e erupção estelar em Fase 2 (*Supernova Flare*).
- Dano direcional: blindagem dorsal impenetrável contra acertos no núcleo vulnerável frontal com multiplicador crítico.

---

## 2. Repositórios GitHub de Referência
1. **[jsantell/THREE.IK](https://github.com/jsantell/THREE.IK)**
   - *Descrição:* Cinemática inversa para esqueleto de múltiplos membros e cadeias ósseas articuladas no Three.js.
   - *Aplicabilidade no Dr-Manaus:* Animação orgânica ondulatória das placas dorsais e apêndices do Leviatã Astral em gravidade zero.
2. **[gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)**
   - *Descrição:* BVH espacial com aceleração de consultas de raio e caixas delimitadoras orientadas (OBB).
   - *Aplicabilidade no Dr-Manaus:* Determinação exata do ponto de colisão entre os raios de 2.500 km do Dr-Manaus e os pontos de blindagem versus núcleo do titã.
3. **[dgreenheck/threejs-procedural-planets](https://github.com/dgreenheck/threejs-procedural-planets)**
   - *Descrição:* Geração de geometrias esféricas massivas com deslocamento procedural de malha.
   - *Aplicabilidade no Dr-Manaus:* Construção da silhueta biomineral do núcleo incandescente do chefe cósmico.

---

## 3. Jogos de Referência de Batalhas Colossais
1. **[Shadow of the Colossus](https://www.playstation.com/en-us/games/shadow-of-the-colossus/) (Team Ico / Bluepoint Games)**
   - *Referência Técnica:* A referência eterna em chefes gigantescos: pontos fracos luminosos que precisam ser alvejados de ângulos específicos, reação do monstro a dor física com sacudidas inerciais e câmera dinâmica que enquadra a disparidade de escala épica.
2. **[God of War III](https://www.playstation.com/en-us/games/god-of-war-iii-remastered/) (Santa Monica Studio)**
   - *Referência Técnica:* A luta contra o titã Cronos: o próprio chefe é um cenário de combate completo, com múltiplos pontos de apoio e escala proporcionalmente assustadora sem perda de fluidez.
3. **[Final Fantasy XVI](https://br.finalfantasyxvi.com/) (Square Enix)**
   - *Referência Técnica:* Batalhas entre Eikons (Bahamut no espaço / Titan Lost): combate cósmico em alta velocidade com barras de vida de chefe na tela, ataques em fases e tempestades de partículas em escala planetária.
4. **[Monster Hunter: World](https://www.monsterhunter.com/world/) (Capcom)**
   - *Referência Técnica:* Sistema de zonas corporais de dano (*hitboxes* de partes moles versus carapaça blindada com ricochete de armas), telegrafia clara de ataques devastadores e quebra física de chifres e placas.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Formula Matemática de Diâmetro Angular Aparente](https://en.wikipedia.org/wiki/Angular_diameter)**
   - Equação trigonométrica do diâmetro angular $\theta = 2 \arcsin(R / d)$, fundamental para que o proxy do Leviatã mantenha o tamanho visual perfeitamente contínuo com a malha 3D real no ponto de transição a 5.000 km sem nenhum salto de pixel.
2. **[Three.js Skeleton & SkinnedMesh Documentation](https://threejs.org/docs/#api/en/objects/SkinnedMesh)**
   - Guia de esqueletos com dezenas de juntas em Three.js, abordando limites de uniform buffer de ossos na GPU para WebGPU.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Barra de Vida Cósmica no HUD:** Implementada no `HUD.ts`, apresentando nome do titã, barra de escudo com gradiente ciano e barra de vida com alerta pulsante de núcleo exposto quando o escudo atinge 0%.
- **Persistência de Fases em SaveManager:** A vida, fase e estado de derrota do Leviatã são salvos com segurança via `SaveManager.saveTitanRecord()`, de modo que recarregar o jogo ou saltar entre galáxias preserva o progresso da batalha.
