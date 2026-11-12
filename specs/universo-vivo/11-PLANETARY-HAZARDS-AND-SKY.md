# DR-MANAUS | Universo Vivo — VIVO-11: Céu, Clima, Perigos Ambientais e Áudio Planetário

## 1. Visão Geral
Esta especificação define o subsistema unificado de atmosfera dinâmica, abóbada celeste adaptativa, perigos ambientais hostis (`PlanetaryHazardService`), renderização de intempéries volumétricas alienígenas (`PlanetaryHazardRenderer`) e acústica ambiental multi-meio (`AudioManager`).

No Dr-Manaus, corpos celestes não são apenas esferas com texturas estáticas: cada planeta possui sua própria física de propagação luminosa (Rayleigh/Mie), composição química atmosférica, perfil de intempéries e perigos cósmicos determinísticos baseados em sua classificação, temperatura, bioma e biosfera (`PlanetaryBiosphereProfile`).

## 2. Princípios de Engenharia
- **Determinismo Estrito:** Nenhum valor estocástico em runtime (`Math.random`). Todos os perfis de céu, cor de névoa, intensidade de perigo e partículas derivam da semente do corpo e do estado físico do jogador.
- **Zero Alocação no Game Loop:** Paletas de atmosfera, buffers de intempéries e cálculos acústicos reutilizam objetos mutáveis (`Vector3`, `Color`, `Float32Array`) pré-alocados.
- **Transição Contínua:** Transições suaves via `lerp` entre atmosferas planetárias e o vácuo espacial ao cruzar a altitude de Kármán.
- **Eficiência e Áudio WebGPU/WebAudio:** Partículas de intempéries renderizadas via draw call única de linhas GPU (`LineSegments`), e perfis de áudio sintetizados proceduralmente sem requisição de assets proprietários.

## 3. Tipos de Perigos Planetários (`PlanetaryHazardType`)
1. `none`: Ambiente benigno ou protegido por escudo/habitat (Terra ou mundos de alta habitabilidade).
2. `radiation-storm`: Fluxo de radiação cósmica/estelar ionizante letal (mundos sem magnetosfera protetora, anãs brancas, pulsares). Alerta HUD, estática e drenagem gradual de escudo.
3. `acidic-downpour`: Precipitação corrosiva de ácido sulfúrico ou hidrocarbonetos voláteis (`dense-greenhouse`, `ammonia-solvent`). Corrosão de blindagem e áudio de efervescência.
4. `cryogenic-blizzard`: Nevasca violenta em temperaturas criogênicas ($< 160\text{ K}$). Visibilidade reduzida, acúmulo de gelo e uivos de vendaval.
5. `toxic-spores`: Névoa densa de esporos biológicos alienígenas (`fungal-canopy`, `bioluminescent-wetlands`). Alerta de biofiltro e névoa bioluminescente.
6. `thermal-scorch`: Radiação infravermelha extrema ($> 380\text{ K}$ ou proximidade coronal). Distorção térmica e alerta de sobreaquecimento.
7. `vacuum-exposure`: Vácuo absoluto em mundos sem atmosfera (`vacuum-sealed-suit`). Silêncio acústico total e ausência de espalhamento óptico.

## 4. Paleta de Céu e Atmosfera Planetária (`PlanetaryAtmospherePalette`)
Para qualquer corpo celeste com atmosfera:
- `hasSkyDome`: Booleano indicando presença de gás dispersor.
- `top`, `horizon`, `zenith`, `glow`: Cores normalizadas da abóbada celeste.
- `sunColor`: Tintura do disco solar filtrado pelo meio atmosférico.
- `fogColor`, `fogNear`, `fogFar`: Parâmetros de atenuação óptica do ar.
- `skyDensity`: Coeficiente de espalhamento ($0.0$ a $1.0$).

## 5. Acústica Multi-Meio no `AudioManager`
Ampliação dos meios suportados por `AudioEnvironment.medium`:
- `'earth-atmosphere'`: Padrão terrestre (densidade $1.2\text{ kg/m}^3$, corte em 280-2400 Hz).
- `'alien-dense'`: Atmosfera espessa (Vênus, gigantes gasosos; amortecimento agudo, graves amplificados, corte em 180-1200 Hz).
- `'alien-thin'`: Atmosfera rarefeita (Marte, Titânia; atenuação acentuada de amplitude, agudos sussurrados).
- `'alien-toxic'`: Ambientes turbulentos ricos em amônia e metano; silvos dissonantes.
- `'cryogenic-winds'`: Ventos subsônicos gelados com ressonância uivante.
- `'airless-surface'` / `'vacuum'`: Silêncio atmosférico rigoroso ($0.0$ ganho).

