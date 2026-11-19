# 19. Arquitetura ECS Orientada a Dados e Concorrência em Web Workers

## 1. Contexto no Dr-Manaus
Modelos orientados a objetos tradicionais (OOP), repletos de classes com referências cruzadas e nós encadeados, fragmentam a memória RAM e provocam frequentes falhas de cache de CPU (*cache misses*), além de sobrecarregar o coletor de lixo (*garbage collector*) do JavaScript. À medida que o Dr-Manaus expande a quantidade de entidades simultâneas (carros, pedestres, naves, projéteis de plasma, fauna alienígena e asteroides), torna-se imperativo adotar:
- **Design Orientado a Dados (DOD) e ECS (Entity Component System):** Entidades como meros IDs numéricos inteiros e componentes armazenados em vetores tipados contíguos na memória (`Float32Array`, `Int32Array`).
- **Processamento Assíncrono com Web Workers:** Transferência de tarefas pesadas de física de colisão e cálculo de rotas para threads secundárias.

---

## 2. Repositórios GitHub de Referência
1. **[NateTheGreatt/bitECS](https://github.com/NateTheGreatt/bitECS)**
   - *Descrição:* O motor ECS mais rápido e eficiente em termos de memória já escrito para JavaScript/TypeScript. Utiliza arrays tipados planos e operações bitwise, permitindo processar mais de 100.000 entidades por segundo a 60 FPS com zero alocação de memória no heap.
   - *Aplicabilidade no Dr-Manaus:* Sistema ideal para orquestrar frotas de projéteis cósmicos, fragmentos de impacto e multidões urbanas sem degradar o garbage collector.
2. **[dimforge/rapier.js](https://github.com/dimforge/rapier.js)**
   - *Descrição:* Motor de física 3D completo em Rust compilado para WebAssembly, focado em performance extrema e determinismo cross-platform.
   - *Aplicabilidade no Dr-Manaus:* Simulação rígida de corpos físicos e detritos de prédios calculada dentro de um Web Worker dedicado.
3. **[ecsyjs/ecsy](https://github.com/ecsyjs/ecsy)**
   - *Descrição:* Framework ECS desenhado especificamente para jogos de navegador e Three.js, facilitando a injeção e consulta de sistemas lógicos.
   - *Aplicabilidade no Dr-Manaus:* Separação limpa entre a simulação lógica de entidades e a camada de apresentação gráfica Three.js.

---

## 3. Jogos e Motores de Referência ECS
1. **[Overwatch / Overwatch 2](https://overwatch.blizzard.com/) (Blizzard Entertainment)**
   - *Referência Técnica:* Famoso pela palestra na GDC sobre sua arquitetura ECS proprietária: o estado completo de todos os heróis, projéteis e habilidades é estruturado como vetores lineares de dados brutos para predição e reconciliação instantânea na rede a 60 Hz.
2. **[Vampire Survivors](https://poncle.games/) (poncle)**
   - *Referência Técnica:* Exemplo icônico de alta densidade no navegador/computador: dezenas de milhares de inimigos e projéteis ativos na tela sem engasgos graças a estruturas contíguas de dados e agrupamento de nós.
3. **[Ashes of the Singularity](https://www.ashesofthesingularity.com/) (Stardock Entertainment)**
   - *Referência Técnica:* Motor Nitrous pioneiro em multithreading massivo: divisão do processamento de dezenas de milhares de unidades independentes em todas as threads da CPU.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[MDN SharedArrayBuffer and Atomics Specification](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)**
   - Guia de compartilhamento de blocos de memória contígua em tempo real entre a thread principal e múltiplos Web Workers sem necessidade de serialização ou mensagens lentas (`postMessage`).
2. **[Richard Fabian - Data-Oriented Design (DOD Book)](https://www.dataorienteddesign.com/dodbook/)**
   - O tratado técnico essencial sobre arquitetura de dados contíguos na memória, alinhamento de cache de CPU (L1/L2/L3) e substituição de polimorfismo dinâmico por iterações em blocos densos.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Componentes em Vetores Tipados:** No `AlienFaunaManager` e no `TrafficSystem`, os atributos cinemáticos (posição $x,y,z$, velocidade $v_x,v_y,v_z$, rotação e vida) são mantidos em vetores unidimensionais tipados contíguos (`Float32Array`), permitindo cópias em bloco e alimentação direta dos atributos de instâncias na GPU.
- **Worker de Geometria e Relevo:** O pré-processamento de curvas de nível e triangulação de ruas é executado no worker de fundo (`chunk.worker.js`), mantendo a thread de renderização dedicada exclusivamente à animação e entrada do jogador.
