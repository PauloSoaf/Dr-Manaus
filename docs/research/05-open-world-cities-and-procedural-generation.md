# 05. Cidades Densas de Mundo Aberto e Geração Procedural

## 1. Contexto no Dr-Manaus
Manaus possui um tecido urbano real complexo: Centro Histórico com edifícios clássicos da Era da Borracha (Teatro Amazonas, Palácio da Justiça, Mercado Adolpho Lisboa), grandes artérias viárias (Av. Djalma Batista, Av. Constantino Nery), distritos industriais extensos e zonas residenciais que se estendem até a floresta amazônica. Para que a cidade pareça viva, densa e cinematográfica sem esgotar a memória do navegador, é necessário combinar dados reais de GIS (Overture Maps) com extrusão procedural, atlas de fachadas e hierarquia de níveis de detalhe (HLOD).

---

## 2. Repositórios GitHub de Referência
1. **[jstrait/city-tour](https://github.com/jstrait/city-tour)**
   - *Descrição:* Simulador urbano procedural completo em Three.js/WebGL com malha viária conectada, zoneamento de edifícios baseado em densidade a partir do centro, geração de quadras e trânsito procedural autônomo.
   - *Aplicabilidade no Dr-Manaus:* Algoritmos para preenchimento de vazios urbanos e assentamentos exoplanetários modulares onde não existem dados Overture Maps.
2. **[photonlines/Procedural-City-Generator](https://github.com/photonlines/Procedural-City-Generator)**
   - *Descrição:* Gerador de quarteirões urbanos procedurais com Three.js utilizando Perlin noise para modular a altura de arranha-céus, ruas ortogonais e fachadas atlased.
   - *Aplicabilidade no Dr-Manaus:* Otimização de atlas de texturas para janelas e concreto com apenas um conjunto de texturas PBR compartilhado por toda a cidade.
3. **[kkhanhluu/infinitown](https://github.com/kkhanhluu/infinitown)**
   - *Descrição:* Renderização infinita de cidade com streaming dinâmico de quarteirões em Three.js conforme a câmera se desloca.
   - *Aplicabilidade no Dr-Manaus:* Sistema de streaming de células e descarte automático (*cell culling*) de bairros distantes.

---

## 3. Jogos de Referência de Mundo Aberto
1. **[Marvel's Spider-Man / Spider-Man 2](https://insomniac.games/game/marvels-spider-man-remastered/) (Insomniac Games)**
   - *Referência Técnica:* A referência definitiva em navegação urbana em alta velocidade através de uma metrópole vertical densa. Destaque para o sistema de *interior mapping* (janelas com quartos tridimensionais falsos gerados por shader parallax sem geometria interna), reflexão cubemap em tempo real e transição de LOD invisível durante o balanço na teia.
2. **[The Matrix Awakens: An Unreal Engine 5 Experience](https://www.unrealengine.com/en-US/the-matrix-awakens)**
   - *Referência Técnica:* Cidade procedural de escala real construída com regras de zoneamento automatizado, malhas Nanite/HLOD e densidade massiva de veículos e pedestres sem quebras visuais.
3. **[Cyberpunk 2077](https://www.cyberpunk.net/) (CD Projekt Red)**
   - *Referência Técnica:* Verticalidade extrema em Night City com múltiplos níveis de tráfego, viadutos suspensos sobrepostos, passarelas entre prédios e iluminação volumétrica noturna de néon.
4. **[Grand Theft Auto V](https://www.rockstargames.com/gta-v) (Rockstar Games)**
   - *Referência Técnica:* Sistema de streaming de streaming chunks assíncrono em grade radial, com malhas de horizonte (*distant shell*) de baixíssimo custo poligonal que representam toda Los Santos a quilômetros de distância.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Overture Maps Foundation Schema Specification](https://docs.overturemaps.org/schema/)**
   - Especificação dos dados de edifícios (`buildings`), transporte (`transportation` / `segments`), divisão territorial e elevação do consórcio Overture Maps (Meta, Microsoft, Amazon, TomTom). Base para reconstruir Manaus com altura e perímetro reais de mais de 50.000 edificações.
2. **[Three.js BatchedMesh Documentation](https://threejs.org/docs/#api/en/objects/BatchedMesh)**
   - Documentação da classe `BatchedMesh` introduzida recentemente no Three.js, permitindo juntar geometrias diferentes em um único draw-call na GPU mantendo transforms e visibilidades independentes.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Interior Mapping Shader em TSL:** Empregar shader de mapeamento interno nas janelas dos prédios do Centro de Manaus. Cada janela exibe um cômodo 3D com móveis e lâmpadas gerado puramente no fragment shader através de cálculo de projeção de raios numa caixa cúbica normalizada, com custo geométrico nulo.
- **HLOD Combinado (Casca + Pontos de Luz):** Em distâncias superiores a 600 metros, substituir o modelo detalhado de cada prédio por uma casca geométrica simplificada (`hlod.ts`), mantendo apenas a silhueta principal e instâncias de pontos de luz noturna.
