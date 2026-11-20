# DR-MANAUS | VIVO-04: Fauna Alienígena, Taxonomia Morfológica e Spawn Seguro

## 1. Objetivo
Implementar o gerenciador de fauna e criaturas alienígenas (`AlienFaunaManager`), permitindo o surgimento determinístico de animais terrestres e aéreos em corpos com vida animal (`lifeTier === 'fauna'` ou `'civilized'`), com IA econômica a 5-10 Hz, grounding em terreno real e integração direta com o sistema de combate do Dr-Manaus (`Target`).

## 2. Princípios e Taxonomia
1. **Taxonomia Morfológica**:
   - `amphibious-crawlers`: rastejadores de baixo perfil, caminhar rastejante, carapaças adaptadas a pântanos e costas.
   - `chitinous-quadrupeds`: quadrúpedes quitinosos com placas dorsais, patas articuladas, comportamento de pastoreio/defesa.
   - `avian-gliders`: planadores aéreos que sobrevoam o relevo entre 10m e 35m de altitude com asas membranosas.
   - `serpentine-burrowers`: criaturas segmentadas vermiformes que serpenteiam por colinas.
   - `bipedal-predators`: bípedes caçadores velozes com postura inclinada para frente.

2. **IA e FSM Econômica (5 - 10 Hz)**:
   - A atualização de IA executa a $\sim 8\text{ Hz}$ (`aiTickAccumulator >= 0.125s`), mantendo a física de interpolação e orientação visual a 60 FPS com custo de CPU ínfimo.
   - Estados:
     - `grazing` / `idle`: parado ou virando suavemente.
     - `patrolling`: caminhando em direção a waypoints determinísticos na superfície.
     - `fleeing`: disparando em fuga na direção oposta ao jogador quando assustado (aproximação $< 25\text{ m}$ ou dano sofrido).
     - `knocked`: lançado por força de ataque ou explosão (`velocity += force`), retornando ao solo e se recuperando.
     - `defeated`: sem vida, colapso e sumiço.

3. **Grounding e Normal Surface Alignment**:
   - Para criaturas terrestres, o pé é alinhado à superfície usando `surface.heightAt` e a normal do terreno.
   - Para planadores aéreos, a altitude flutua suavemente em torno de um envelope aerodinâmico acima do relevo.

4. **Integração com Combate (`Target`)**:
   - Cada criatura viva é registrada como `Target` com `kind: 'creature'`, `radius: 1.5m` a `3.0m`, `position`, `velocity` e `active: true`.
   - Pode ser travada por mira assistida, atingida por socos/chutes, lasers e ondas de choque.

