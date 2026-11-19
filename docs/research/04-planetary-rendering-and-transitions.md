# 04. Planetas em Escala Real e Transição Atmosférica Contínua

## 1. Contexto no Dr-Manaus
Dr-Manaus transita de uma representação georreferenciada da cidade de Manaus até a órbita baixa (Kármán line a 100 km), voo interplanetário entre Terra, Lua, Marte, Vênus, Mercúrio e gigantes gasosos como Júpiter e Saturno, até sistemas interestelares distantes. O problema central da renderização planetária é o abismo de escala (de metros no solo até $10^{12}$ metros no sistema solar), exigindo:
1. Mapeamento de esfera-cubo (*Normalized Cube Sphere*) com Quadtree LOD (CDLOD) para subdivisão geométrica contínua.
2. Camada atmosférica contínua modelada via equações de espalhamento de Rayleigh e Mie sem descontinuidade na linha do horizonte.
3. Transição contínua sem tela de carregamento (*seamless atmospheric re-entry*).

---

## 2. Repositórios GitHub de Referência
1. **[EepyBerry/lagrange](https://github.com/EepyBerry/lagrange)**
   - *Descrição:* Gerador procedural de planetas em Three.js/WebGPU utilizando Fractal Brownian Motion (fBm), anéis planetários, camadas de nuvens e espalhamento atmosférico procedural via TSL.
   - *Aplicabilidade no Dr-Manaus:* Arquitetura para a geração de biomassa exoplanetária e anéis de partículas em planetas secundários.
2. **[FunSoftWareTechologies/OpenWorlds](https://github.com/FunSoftWareTechologies/OpenWorlds)**
   - *Descrição:* Framework em Three.js para geração de corpos esféricos com Quadtree LOD, transições suaves entre o espaço e o solo e costura de bordas (*crack-fixing*) entre níveis de detalhe adjacentes.
   - *Aplicabilidade no Dr-Manaus:* Elimina costuras visuais e popping geométrico nas esferas planetárias de Marte e da Lua.
3. **[dgreenheck/threejs-procedural-planets](https://github.com/dgreenheck/threejs-procedural-planets)**
   - *Descrição:* Implementação em Three.js para corpos celestes procedurais gerados por Simplex Noise 3D com projeções esféricas sem distorção polar.
   - *Aplicabilidade no Dr-Manaus:* Geração determinística de relevo de mundos não catalogados.

---

## 3. Jogos de Referência de Mundo Aberto Cósmico
1. **[No Man's Sky](https://www.nomanssky.com/) (Hello Games)**
   - *Referência Técnica:* Transição clássica entre espaço aberto, queima atmosférica com chamas de reentrada, nuvens volumétricas e geração de biomas, flora e fauna procedural direto no solo.
2. **[Star Citizen](https://robertsspaceindustries.com/star-citizen) (Cloud Imperium Games)**
   - *Referência Técnica:* Maior fidelidade técnica em escala 1:1 de planetas, cidades globais inteiras (ex: ArcCorp), iluminação atmosférica fisicamente correta com dispersão volumétrica e precisão de coordenadas de 64 bits.
3. **[Outer Wilds](https://www.mobiusdigitalgames.com/outer-wilds.html) (Mobius Digital / Annapurna)**
   - *Referência Técnica:* Física newtoniana completa em escala condensada, onde pequenos planetas com gravidade própria orbitam um sol vivo, permitindo pouso e caminhada contínua com orientação de vetor normal planetário.
4. **[Elite Dangerous](https://www.elitedangerous.com/) (Frontier Developments)**
   - *Referência Técnica:* Simulação astronômica da Via Láctea em escala astronômica real com pousos planetários orbitais via aproximação de supercruise e desaceleração aerodinâmica.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Bruneton & Neyret - Precomputed Atmospheric Scattering Paper](https://ebruneton.github.io/precomputed_atmospheric_scattering/)**
   - O artigo fundamental de computação gráfica que descreve a resolução analítica e por pré-computação do espalhamento de luz solar em esferas atmosféricas com múltiplas reflexões internas, utilizado em quase todos os simuladores espaciais modernos.
2. **[W3C WebGPU Floating-Point Precision Specification](https://www.w3.org/TR/webgpu/#floating-point-evaluation)**
   - Diretrizes sobre a precisão numérica de 32 e 64 bits em shaders WGSL e técnicas de emulação de *double-precision* na GPU (vec2 float split) para evitar trepidações em distâncias astronômicas.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Transição de Referencial por Camadas:** Utilizar o `SurfaceFrameService` e o `ReferenceFrameGraph` já integrados, onde a menos de 100 km do centro de gravidade, a física local ancora-se no sistema ENU (East-North-Up) do planeta alvo.
- **Shader de Atmosfera Unificado em TSL:** Empregar o modelo de Rayleigh (espalhamento azul na Terra, avermelhado em Marte) com atenuação exponencial baseada na densidade barométrica $D(h) = e^{-h / H_0}$, onde $H_0 = 8500\text{ m}$.
