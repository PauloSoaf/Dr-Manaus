# 14. Céus Volumétricos, Atmosferas e Nebulosas JWST

## 1. Contexto no Dr-Manaus
O céu do Dr-Manaus não é uma imagem estática ou uma skybox pré-renderizada:
- **Na Terra (Manaus):** Céu tropical dinâmico com espalhamento de Rayleigh azul durante o dia, pôr do sol avermelhado amazônico sobre o Rio Negro e tempestades com nuvens carregadas cumulonimbus.
- **No Espaço Profundo:** Fundo cósmico de alta fidelidade inspirado diretamente nas imagens científicas do **Telescópio Espacial James Webb (JWST)** dos instrumentos NIRCam e MIRI:
  1. Spikes de difração hexagonal de 6 pontas (resultantes da geometria dos 18 espelhos de berílio) combinados a 2 pontas horizontais dos suportes do espelho secundário (assinatura clássica de 8 pontas).
  2. **Pilares da Criação (M16 · Nebulosa da Águia):** Colunas escuras de poeira e gás hidrogênio ionizado.
  3. **Penhascos Cósmicos (NGC 3324 · Nebulosa de Carina):** Cristas alaranjadas de gás sob vento estelar ultravioleta.
  4. **Nebulosa da Tarântula (30 Doradus):** Teia gasosa filamentar ao redor do superaglomerado R136.
  5. **Campo Profundo do Webb (SMACS 0723):** Lentes gravitacionais com galáxias distorcidas em arcos luminosos de Einstein.

---

## 2. Repositórios GitHub de Referência
1. **[EepyBerry/lagrange](https://github.com/EepyBerry/lagrange)**
   - *Descrição:* Simulador procedural planetário em Three.js/WebGPU com shaders volumétricos TSL para nebulosas estelares e atmosferas planetárias em múltiplas faixas espectrais.
   - *Aplicabilidade no Dr-Manaus:* Shaders de gás ionizado com blending aditivo para as camadas externas das nebulosas catalogadas.
2. **[mrdoob/three.js - SkyNode](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/nodes/display/SkyNode.js)**
   - *Descrição:* Nó TSL oficial de atmosfera baseado no modelo de Preetham/Hosek-Wilkie para cálculo do céu diurno com turbidez e orientação do sol solar dinâmicas.
   - *Aplicabilidade no Dr-Manaus:* Céu diurno e crepúsculo de Manaus integrado ao ciclo diário de 24 horas.

---

## 3. Jogos e Simuladores de Referência
1. **[SpaceEngine](https://spaceengine.org/) (Cosmographic Software)**
   - *Referência Técnica:* O mais impressionante simulador do universo do mundo: renderização volumétrica em tempo real de nebulosas interestelares por raymarching volumétrico 3D, espalhamento estelar e discos de acreção de buracos negros relativísticos.
2. **[Destiny 2](https://www.bungie.net/7/en/Destiny)** (Bungie)
   - *Referência Técnica:* Skyboxes artísticas espaciais consideradas o ápice do design visual de ficção científica: céus cósmicos vivos com faixas de poeira, anéis planetários gigantescos e anomalias estelares que orientam o jogador pelo horizonte.
3. **[Star Citizen](https://robertsspaceindustries.com/star-citizen) (Cloud Imperium Games)**
   - *Referência Técnica:* Nuvens de gás volumétricas em escala interestelar (*Lagrange gas clouds*) por onde naves podem navegar e minerar no interior dos campos de poeira.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[NASA JWST Science Optics & Point Spread Function (PSF) Guide](https://jwst-docs.stsci.edu/jwst-observatory-hardware/jwst-optical-path)**
   - Documentação oficial do Instituto de Ciência do Telescópio Espacial detalhando a formação óptica dos spikes de difração causados pelo primário hexagonal e pelos apoios do secundário.
2. **[W3C WebGPU Additive Blending & Depth Testing Specifications](https://www.w3.org/TR/webgpu/#blend-state)**
   - Especificação sobre como configurar `blend: { color: { operation: 'add', srcFactor: 'src-alpha', dstFactor: 'one' } }` para superposição de camadas luminosas de gás interestelar sem corte de profundidade.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Geometria de Difração Hexagonal Procedural:** Construída nativamente no `JWSTCosmicPresentation.ts`, onde estrelas proeminentes geram losangos alongados a cada $60^\circ$ com fringing azul nas extremidades e ouro no centro, reproduzindo a ótica do espelho de berílio do Webb.
- **Scanner Científico Interativo:** O `CosmicSpeciesScanner.ts` reconhece a direção focal da câmera em relação a essas nebulosas, catalogando-as com taxonomia astronômica e descrições dos dados obtidos pelos satélites reais.
