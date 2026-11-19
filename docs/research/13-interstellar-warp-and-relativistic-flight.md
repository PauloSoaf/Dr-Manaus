# 13. Voo Interestelar, Dobra Espacial e Escalas Relativísticas

## 1. Contexto no Dr-Manaus
Viajar entre a Terra e Saturno ($1,4 \times 10^9\text{ km}$) ou saltar para o sistema Alpha Centauri ($4,37\text{ anos-luz}$) a velocidades convencionais de avião ou foguete levaria anos. O Dr-Manaus emprega uma métrica de dobra espaciotemporal inspirada na física de Alcubierre e nos saltos de hiperpropulsão:
- **Nível Convencional:** De $1c$ a $256c$ (para cruzar o Sistema Solar em segundos/minutos).
- **Nível Interestelar:** De $1.000c$ a $1.000.000c$ (para navegar entre estrelas próximas).
- **Nível Intergaláctico:** Até $100.000.000.000c$ (para viagens entre galáxias como a Via Láctea e Andrômeda).
O desafio computacional reside em manter a câmera e os shaders estáveis, evitando anomalias de precisão numérica e garantindo freios de emergência automáticos ao se aproximar da fotosfera solar ou horizontes de eventos.

---

## 2. Repositórios GitHub de Referência
1. **[CesiumGS/cesium](https://github.com/CesiumGS/cesium)**
   - *Descrição:* Implementa sistemas de coordenadas universais (ECEF, ECI e ICRF) para corpos celestes em escala astronômica com interpolação de matrizes ephemeris.
   - *Aplicabilidade no Dr-Manaus:* Base para sincronizar a posição orbital de planetas e satélites ao longo de épocas globais (`globalEpochSeconds`).
2. **[spite/THREE.ShaderUtils](https://github.com/spite/THREE.ShaderUtils)**
   - *Descrição:* Coleção de efeitos de aberração óptica, estiramento relativístico de estrelas (*relativistic star streaks*) e distorção de túnel de luz.
   - *Aplicabilidade no Dr-Manaus:* Efeito visual de estiramento de estrelas e túnel de fenda espaciotemporal ativado durante o aumento do `warpStep`.

---

## 3. Jogos de Referência de Voo Espacial e Dobra
1. **[Elite Dangerous](https://www.elitedangerous.com/) (Frontier Developments)**
   - *Referência Técnica:* Sistema de *Supercruise* / *Frame Shift Drive (FSD)*: aceleração contínua proporcional à distância dos poços gravitacionais locais, com freio automático em proximidade de planetas e salto dramático de hiperespaço (*witchspace tunnel*) entre sistemas solares.
2. **[Star Wars: Squadrons](https://www.ea.com/games/starwars/squadrons) (Motive Studio / EA)**
   - *Referência Técnica:* Efeito clássico de estiramento de linhas de luz estelar no salto de hipertúnel, com desaceleração inercial abrupta ao sair do hiperespaço na órbita de frotas inimigas.
3. **[EVE Online](https://www.eveonline.com/) (CCP Games)**
   - *Referência Técnica:* Voo de dobra em escala galáctica: alinhamento de vetor direcional antes do gatilho de dobra, aceleração progressiva em Unidades Astronômicas por segundo e saída estável em estações espaciais.
4. **[No Man's Sky](https://www.nomanssky.com/) (Hello Games)**
   - *Referência Técnica:* Motor de pulso estelar (*Pulse Engine*) interplanetário com mira magnética em corpos celestes e temporizador de tempo estimado de chegada (ETA).

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Alcubierre Warp Drive Metric Original Theoretical Paper (1994)](https://arxiv.org/abs/gr-qc/0009013)**
   - O artigo fundamental de Miguel Alcubierre sobre a contração do espaço-tempo à frente de uma nave e expansão atrás, permitindo velocidade aparente superior à da luz sem violar a relatividade restrita local.
2. **[NASA JPL HORIZONS System Documentation](https://ssd.jpl.nasa.gov/horizons/)**
   - Banco de dados e formulações de efemérides planetárias do Laboratório de Propulsão a Jato da NASA para cálculo de órbitas keplerianas exatas.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Tabelas Exponenciais de Dobra:** Matrizes `WARP_STEPS_C` e `COSMIC_WARP_STEPS_C` no `Game.ts` mapeadas para roda do mouse ou botões de controle, permitindo aceleração e desaceleração tátil com avisos de proximidade.
- **Freio Automático de Proximidade:** Ao adentrar a esfera de influência gravitacional de qualquer corpo celestial, o motor engata freio forçado (`proximityGatingActive`), reduzindo a velocidade a níveis seguros de aproximação sub-luz.
