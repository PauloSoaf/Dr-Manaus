# 15. Clima Dinâmico Tropical, Chuva Amazônica e Ciclo Dia/Noite

## 1. Contexto no Dr-Manaus
O clima de Manaus é equatorial e amazônico, caracterizado por alta umidade, calor e tempestades tropicais vespertinas repentinas e torrenciais (os famosos "torós" de verão). Incorporar essa atmosfera no jogo exige:
- Transição fluida de um dia ensolarado de alta intensidade para tempestades com trovões, relâmpagos e chuva volumétrica densa.
- Superfícies urbanas que molham dinamicamente: redução de rugosidade (*roughness* para 0.05), escurecimento da cor albedo da madeira e concreto e formação de poças de água com reflexos no asfalto.
- Ciclo circadiano de 24 horas contínuo com acendimento automático de postes e faróis de carros ao anoitecer.

---

## 2. Repositórios GitHub de Referência
1. **[mrdoob/three.js - WebGPU Particle System](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)**
   - *Descrição:* Simulação de partículas na GPU via WebGPU compute shaders para chuva, respingos no solo (*rain splashes*) e névoa volumétrica sem sobrecarregar a CPU.
   - *Aplicabilidade no Dr-Manaus:* Renderização de milhares de gotas de chuva amazônica direcionadas pelo vetor de vento em um único draw-call.
2. **[VictorZakharov/beautiful-water](https://github.com/VictorZakharov/beautiful-water)**
   - *Descrição:* Shaders de molhamento de superfícies e ondulações de chuva sobre planos com nós TSL.
   - *Aplicabilidade no Dr-Manaus:* Efeito de poças de água e respingos dinâmicos no piso do Teatro Amazonas e na orla da Ponta Negra.

---

## 3. Jogos de Referência de Clima e Iluminação
1. **[Ghost of Tsushima](https://www.playstation.com/en-us/games/ghost-of-tsushima/) (Sucker Punch Productions)**
   - *Referência Técnica:* O ápice da direção de arte de vento, tempestades e partículas na indústria: folhas varridas pelo chão, grama que reage a rajadas direcionais e trovões com iluminação global instantânea.
2. **[Red Dead Redemption 2](https://www.rockstargames.com/reddeadredemption2) (Rockstar Games)**
   - *Referência Técnica:* A simulação meteorológica mais densa dos videogames: formação física de nuvens volumétricas, acúmulo de lama no solo proporcional à duração da chuva e condensação no ar.
3. **[Batman: Arkham Knight](https://www.rockstargames.com/games/batman-arkham-knight) (Rocksteady Studios)**
   - *Referência Técnica:* A estética definitiva de cidade molhada e chuvosa: gotas escorrendo na capa e na armadura do herói, asfalto com poças reflexivas espelhadas e névoa urbana densa.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Sebastien Lagarde - Feeding a Physically Based Shading Model (Wet Materials)](https://seblagarde.wordpress.com/2013/04/14/memo-on-fresnel-equations/)**
   - Formulação física demonstrando como a água preenche as micro-irregularidades de superfícies sólidas, multiplicando a refletividade especular e escurecendo o albedo difuso devido à refração interna repetida.
2. **[W3C WebGPU Compute Pass Specification](https://www.w3.org/TR/webgpu/#compute-passes)**
   - Especificação sobre execução de compute shaders em WebGPU (`beginComputePass`), essencial para atualizar a física das gotas de chuva em alta frequência.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Fator Dinâmico de Umidade (`wetness01`):** Modulador uniforme aplicado aos materiais PBR da cidade. Conforme chove, `wetness01` sobe de 0.0 para 1.0, reduzindo o `roughnessNode` para zero e aumentando o `specularIntensity`.
- **Efeitos de Relâmpago e Trovão:** Um relâmpago eleva a luz ambiente e direcional para intensidade 8.0 por 80 ms, seguido de um atraso de som proporcional à distância do raio, sintetizando o estrondo via oscilador sub-grave e ruído filtrado no `AudioManager.ts`.
