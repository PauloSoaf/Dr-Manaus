# 09. Combate Fluido, Soft Targeting, Hitstop e Camera Framing

## 1. Contexto no Dr-Manaus
O combate no Dr-Manaus deve transmitir o peso, a agilidade e o poder devastador de um ser cósmico. Golpear inimigos no chão ou disparar raios contra titãs planetários no vácuo requer:
- **Soft Targeting (Magnetismo de Ataque):** O herói não deve golpear o vazio caso o jogador erre a direção por poucos graus; a orientação do ataque deve ajustar-se suavemente para o adversário mais relevante.
- **Hitstop (Congelamento de Impacto):** Pausa microscópica de 20 ms a 70 ms no quadro de impacto crítico para transmitir peso físico visceral.
- **Camera Shake e Framing Dinâmico:** Enquadramento cinemático que se afasta durante ataques de grande porte e treme com frequências proporcionais à energia liberada no impacto.

---

## 2. Repositórios GitHub de Referência
1. **[gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)**
   - *Descrição:* Aceleração de raycasting espacial para detecção imediata de alvos dentro de cones de visão angulares com avaliação de oclusão por obstáculos intermediários.
   - *Aplicabilidade no Dr-Manaus:* Usado pelo `PowerSystem.ts` para aquisição instantânea de alvos tanto locais (1.600m) quanto em escala cósmica ($2.500\text{ km}$ para o Leviatã Astral).
2. **[yomotsu/camera-controls](https://github.com/yomotsu/camera-controls)**
   - *Descrição:* Controlador de câmera ultra-suave para Three.js com suporte a amortecimento inercial, colisões com a geometria do cenário e transições suaves de enquadramento.
   - *Aplicabilidade no Dr-Manaus:* Sistema de câmera de perseguição de combate que se adapta automaticamente quando o herói combate em terra ou decola para o voo interplanetário.

---

## 3. Jogos de Referência de Combate de Ação
1. **[Batman: Arkham City / Arkham Knight](https://www.rockstargames.com/games/batman-arkham-knight) (Rocksteady Studios)**
   - *Referência Técnica:* Criador do sistema *Freeflow Combat*: magnetismo suave que calcula trajetórias parabólicas até o inimigo prioritário, transições de câmera que enfatizam contra-ataques e desaceleração temporal no último golpe do combo.
2. **[God of War (2018) / Ragnarök](https://www.playstation.com/en-us/games/god-of-war/) (Santa Monica Studio)**
   - *Referência Técnica:* Mestre em *Hitstop* e impacto físico: cada golpe do machado Leviathan congela a animação do atacante e da vítima por 3 a 5 frames, acompanhado de estrondo sonoro sub-grave e deformação de tela via aberração cromática radial.
3. **[Devil May Cry 5](https://www.devilmaycry5.com/) (Capcom)**
   - *Referência Técnica:* Responsividade absoluta (input buffering de 60 Hz), cancelamento de animações por esquiva instantânea e feedback sonoro estridente para impactos normais versus críticos.
4. **[Marvel's Spider-Man](https://insomniac.games/game/marvels-spider-man-remastered/) (Insomniac Games)**
   - *Referência Técnica:* Combate aéreo acrobático que combina teias de longo alcance com socos em solo, utilizando *camera framing* que enquadra o herói e os inimigos em plano aberto dinâmico.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[W3C Gamepad API Specification](https://www.w3.org/TR/gamepad/)**
   - Especificação para suporte a controles de videogame (DualSense, Xbox Wireless) no navegador, com mapeamento de gatilhos analógicos e controle háptico de vibração (*rumble*) sincronizado aos golpes.
2. **[Steve Swink - Game Feel: A Game Designer's Guide to Virtual Sensation](https://www.game-feel.com/)**
   - O tratado técnico essencial sobre métricas de sensação física em jogos eletrônicos: curvas de aceleração de resposta de controle, tabelas de tempo de hitstop em milissegundos e psicologia de framing de câmera.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Hitstop não-bloqueante no Game Loop:** Em vez de congelar a thread principal (`setTimeout` ou `sleep`), armazenar `hitStopRemainingMs`. Quando maior que zero, as posições dos atores em combate permanecem estáticas e o tempo de física é desacelerado, enquanto partículas e a câmera continuam a ser renderizados suavemente.
- **Diferenciação Tática de Blindagem:** Golpes direcionados a pontos fracos expostos (ex: o núcleo estelar do Leviatã Astral) causam dano crítico triplo ($3\times$), enquanto impactos na armadura dorsal sofrem deflexão visual com faíscas e aviso sonoro de ricochete.
