# 10. Relevo Urbano, Topografia Real e Integração de Vias e Viadutos

## 1. Contexto no Dr-Manaus
Manaus não é uma planície uniforme: a cidade é entrecortada por igarapés profundos (Igarapé do Quarenta, Igarapé do Franco, Igarapé da Cachoeira Grande), platôs residenciais e grandes obras de engenharia rodoviária suspensa, com destaque para a monumental **Ponte Jornalista Phelippe Daou (Ponte Rio Negro)**, cujo vão estaiado central atinge 55 metros de altura sobre a lâmina d'água ao longo de 3,5 quilômetros. O desafio arquitetural consiste em:
- Garantir que as pistas de asfalto ordinárias acompanhem rigorosamente as elevações do terreno.
- Permitir que pontes e viadutos se destaquem do leito fluvial e mantenham declives suaves e transitáveis para carros e super-heróis.
- Eliminar descontinuidades onde prédios afundem ou flutuem no relevo.

---

## 2. Repositórios GitHub de Referência
1. **[felixpalmer/procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js)**
   - *Descrição:* Motor de mapeamento 3D para navegador construído em WebGL focado em terreno com relevo contínuo, integração de satélite de alta precisão e streaming de curvas de nível.
   - *Aplicabilidade no Dr-Manaus:* Técnicas de amostragem bicúbica de mapas de elevação de Manaus para eliminar degraus e facetas poligonais no asfalto.
2. **[heremaps/harp.gl](https://github.com/heremaps/harp.gl)**
   - *Descrição:* Renderizador geoespacial 3D em Three.js de grau industrial da HERE Technologies, projetado especificamente para renderizar redes viárias multinível, viadutos entrelaçados e pontes estaiadas com elevação independente do relevo.
   - *Aplicabilidade no Dr-Manaus:* Arquitetura para tratar a Ponte Rio Negro e viadutos do Corredor do Mindu com amostradores de deck dedicados (`setDeckHeight`).
3. **[visgl/deck.gl](https://github.com/visgl/deck.gl)**
   - *Descrição:* Framework de alta performance para visualização de camadas geoespaciais em WebGPU/WebGL, com suporte nativo a extrusão de vias em arcos catenários tridimensionais.
   - *Aplicabilidade no Dr-Manaus:* Geração procedural dos cabos de aço e pilares da Ponte Rio Negro.

---

## 3. Jogos de Referência de Topografia e Pontes
1. **[Death Stranding](https://www.kojimaproductions.jp/en/death-stranding)** (Kojima Productions)
   - *Referência Técnica:* A maior obra sobre topografia acidentada nos videogames: cálculo preciso de inclinação de terreno no centro de massa do personagem, derrapagens em pedregulhos, travessia de desfiladeiros por pontes construídas e deformação de leitos de rios.
2. **[Microsoft Flight Simulator](https://www.flightsimulator.com/) (Asobo Studio / Xbox Game Studios)**
   - *Referência Técnica:* Representação digital do globo com elevação DEM (Digital Elevation Model) combinada a fotogrametria de cidades reais, onde rios amazônicos e pontes são integrados com precisão métrica de satélite.
3. **[Just Cause 4](https://square-enix-games.com/games/just-cause-4) (Avalanche Studios)**
   - *Referência Técnica:* Mundo aberto com montanhas tropicais, rios caudalosos e grandes pontes rodoviárias suspensas que podem ser destruídas fisicamente enquanto o jogador plana de wingsuit por baixo dos vãos.
4. **[Grand Theft Auto IV](https://www.rockstargames.com/games/IV) (Rockstar Games)**
   - *Referência Técnica:* Primeira grande integração de pontes suspensas urbanas (Bridges of Liberty City) com simulação de tráfego multinível em diferentes altitudes físicas em relação à água.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Overture Maps Transportation Schema - Grade & Level Properties](https://docs.overturemaps.org/schema/reference/transportation/segment/)**
   - Especificação sobre os atributos `level`, `class`, `surface` e `bridge` do Overture Maps, definindo como o grafo viário distingue vias de superfície versus viadutos e pontes elevadas sobre corpos hídricos.
2. **[Mapbox Elevation-RGB Specification](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/)**
   - Protocolo universal para codificação de elevação do relevo em canais de cor RGB ($Height = -10000 + (R \times 256^2 + G \times 256 + B) \times 0.1$), permitindo decodificação rápida na GPU.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Amostrador de Deck Dedicado:** No arquivo `TrafficSystem.ts`, a função `setDeckHeight` já é parametrizada para receber uma curva analítica para a Ponte Rio Negro ($y = 50 + \text{arco parabólico}$). O asfalto e os carros sobem suavemente a 50m de altitude sobre o rio, enquanto as vias residenciais continuam ancoradas no relevo a nível de praia.
- **Encaixe Automático de Edifícios:** Para terrenos inclinados (como as encostas dos igarapés), os prédios estendem sua fundação para baixo do piso (`sub-grade baseline offset`), impedindo que quinas fiquem flutuando no ar.
