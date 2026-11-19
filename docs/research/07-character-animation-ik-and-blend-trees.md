# 07. Animações Fluidas, Inverse Kinematics (IK) e Bone Masking

## 1. Contexto no Dr-Manaus
O super-herói Dr-Manaus realiza uma gama extraordinária de ações motoras:
- Caminhada e corrida com adaptação dos pés à inclinação de aclives e calçadas.
- Voo acrobático com inclinação dinâmica de corpo (pitch/roll/bank), alinhamento aerodinâmico suave e giros no ar (double jump flips e barrel rolls).
- Golpes de combate corpo a corpo (socos, chutes giratórios, impacto no solo / superhero landing).
- Projeção de raios energéticos a partir das mãos com direcionamento independente da cabeça e tronco para a retícula de mira enquanto corre ou voa (**Bone Masking**).

---

## 2. Repositórios GitHub de Referência
1. **[jsantell/THREE.IK](https://github.com/jsantell/THREE.IK)**
   - *Descrição:* Biblioteca de Cinemática Inversa (Inverse Kinematics) baseada no algoritmo FABRIK (Forward And Backward Reaching Inverse Kinematics) integrada com esqueletos do Three.js.
   - *Aplicabilidade no Dr-Manaus:* Permite direcionar braços e pulsos do herói exatamente para o alvo de mira cósmico sem precisar de uma animação estática pré-gravada para cada ângulo possível.
2. **[Aditya02git/Leg-IK_In_ThreeJS_With_Rapier](https://github.com/Aditya02git/Leg-IK_In_ThreeJS_With_Rapier)**
   - *Descrição:* Demonstração de IK procedural nas pernas e pés de personagens 3D em Three.js integrados ao motor de física Rapier, adaptando sola e joelhos a degraus, pedras e rampas sem deslizar os pés (*foot-sliding*).
   - *Aplicabilidade no Dr-Manaus:* Ajusta a pisada do Dr-Manaus sobre o asfalto irregular e as calçadas de pedra portuguesa do Largo de São Sebastião.
3. **[mrdoob/three.js - CCDIKSolver](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/animation/CCDIKSolver.js)**
   - *Descrição:* Solucionador nativo de IK por Descida Cíclica de Coordenadas (CCD) do Three.js, com suporte a limites angulares e articulações restritas.
   - *Aplicabilidade no Dr-Manaus:* Controle biomecânico das patas e tentáculos da fauna alienígena de mundos distantes.

---

## 3. Jogos de Referência de Animação e Locomoção
1. **[Uncharted 4: A Thief's End](https://www.playstation.com/en-us/games/uncharted-4-a-thiefs-end/) (Naughty Dog)**
   - *Referência Técnica:* Referência máxima em animação procedural combinada a animação por captura de movimento. Ajuste de pisadas com IK de dois ossos em tempo real, transferência de peso (*momentum shift*) ao mudar bruscamente de direção e transição de animações contextuais (ex: mão apoiando na parede ao passar perto).
2. **[Batman: Arkham Knight](https://www.rockstargames.com/games/batman-arkham-knight) (Rocksteady Studios)**
   - *Referência Técnica:* Transição perfeita entre voo de capa planada, mergulho vertical e golpes acrobáticos com conexão de alvo flexível (*free-flow combat*), onde cada animação ajusta dinamicamente a distância até o inimigo.
3. **[Shadow of the Colossus](https://www.playstation.com/en-us/games/shadow-of-the-colossus/) (Team Ico / Bluepoint Games)**
   - *Referência Técnica:* Ragdoll procedimental híbrido e escalada em criaturas gigantescas: o corpo do herói responde a forças inerciais e solavancos da criatura colosso enquanto mantém pegadas de mão e pé firmes via IK.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Three.js AnimationClip & AnimationMixer Documentation](https://threejs.org/docs/#api/en/animation/AnimationMixer)**
   - Documentação oficial das classes de controle de animação do Three.js, demonstrando cross-fading temporal, controle de pesos (`setEffectiveWeight`), reprodução em camadas e interpolação de matrizes ósseas.
2. **[glTF 2.0 Skinning & Skeletal Hierarchy Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins)**
   - Especificação do formato glTF para matrizes inversas de amarração (`inverseBindMatrices`), normalização de pesos de juntas (soma obrigatória de 1.0 por vértice) e hierarquia de nós de esqueleto.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Bone Masking em Duas Camadas:**
  - *Camada Inferior (Pernas / Pelve):* Executa o ciclo de locomoção (caminhada, corrida, voo) com pesos controlados pela velocidade do jogador.
  - *Camada Superior (Coluna / Ombros / Braços / Cabeça):* Sobrescrita aditiva pelo controlador de mira, rotacionando a espinha em até $\pm 65^\circ$ na direção do vetor da câmera sem interromper a corrida.
- **Two-Bone IK no Pouso de Super-Herói:** Ao atingir o solo após quedas ou slams verticais, um solucionador analítico de IK de pernas flexiona os joelhos e inclina a coluna, evitando penetração geométrica no terreno.
