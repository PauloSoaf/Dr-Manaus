# DR-MANAUS | Pesquisa Arquitetural e Catálogo de Referências Tecnológicas

Este dossiê reúne a pesquisa arquitetural e tecnológica completa para a evolução técnica do **Dr-Manaus**, cobrindo desde a renderização gráfica de fluidos e metrópoles até escalas cósmicas relativísticas, sistemas de combate, persistência e inteligência de multidões na Web.

A documentação é dividida em **20 documentos de pesquisa (.md)** individuais, cada um contendo no mínimo:
- **2 links diretos para repositórios GitHub abertos** com código de referência.
- **2 a 4 jogos de referência de mundo aberto consagrados** na indústria.
- **2 documentações oficiais de bibliotecas ou especificações técnicas (W3C, Khronos, OGC, IEEE, NASA)**.
- **Estratégia prática de engenharia adaptada diretamente para o Dr-Manaus (Three.js WebGPU / TSL / Web Audio)**.

---

## Índice dos 20 Documentos de Pesquisa (.md)

| Nº | Documento | Tema Principal | Repositórios GitHub Chave | Jogos de Referência |
| :--- | :--- | :--- | :--- | :--- |
| **01** | [01. Renderização de Água](01-water-rendering.md) | Água realista, funcional e leve (Rio Negro/Solimões) | `threejs-water-free`, `beautiful-water` | *Sea of Thieves*, *Subnautica*, *Assassin's Creed IV* |
| **02** | [02. Teletransporte Instantâneo](02-teleportation-systems.md) | Salto sem hitch local, orbital e interestelar | `cesium`, `three-stdlib` | *Ratchet & Clank: Rift Apart*, *Dishonored 2*, *Infamous: Second Son* |
| **03** | [03. Portais Sem Emenda](03-seamless-portals.md) | Portais tridimensionais e geometria não-euclidiana | `webgl-portals`, `NonEuclidean` | *Portal 2*, *Splitgate*, *Manifold Garden* |
| **04** | [04. Planetas e Transição Atmosférica](04-planetary-rendering-and-transitions.md) | Escala 1:1, Cube-Sphere CDLOD e reentrada contínua | `lagrange`, `OpenWorlds`, `threejs-procedural-planets` | *No Man's Sky*, *Star Citizen*, *Outer Wilds*, *Elite Dangerous* |
| **05** | [05. Cidades Abertas e Densas](05-open-world-cities-and-procedural-generation.md) | Metrópole viva, Overture Maps e Interior Mapping | `city-tour`, `Procedural-City-Generator`, `infinitown` | *Marvel's Spider-Man*, *The Matrix Awakens*, *Cyberpunk 2077*, *GTA V* |
| **06** | [06. Renderização Leve na Web](06-lightweight-web-rendering-webgpu-hlod.md) | WebGPU, TSL, HLOD, Culling e Heap Zero | `instanced-mesh`, `three-mesh-bvh`, `detect-gpu` | *The Legend of Zelda: Tears of the Kingdom*, *Doom Eternal*, *Horizon Forbidden West* |
| **07** | [07. Animações e Cinemática Inversa](07-character-animation-ik-and-blend-trees.md) | Bone Masking, Two-Bone IK, Voo Acrobático | `THREE.IK`, `Leg-IK_In_ThreeJS_With_Rapier`, `CCDIKSolver` | *Uncharted 4*, *Batman: Arkham Knight*, *Shadow of the Colossus* |
| **08** | [08. Multidões e Tráfego Urbano](08-npc-crowds-traffic-and-boids-simulation.md) | Boids, IA de trânsito, frenagem reativa e buzinas | `boids-js`, `crowdedjs`, `recastnavigation` | *Hitman: World of Assassination*, *GTA V*, *Watch Dogs 2* |
| **09** | [09. Combate Fluido e Hitstop](09-fluid-combat-soft-targeting-and-hitstop.md) | Soft-targeting, hitstop, feedback de impacto | `three-mesh-bvh`, `camera-controls` | *Batman: Arkham City*, *God of War*, *Devil May Cry 5*, *Spider-Man* |
| **10** | [10. Relevo Urbano e Pontes](10-urban-elevation-and-topographic-relief.md) | Topografia real, igarapés e Ponte Rio Negro | `procedural-gl-js`, `harp.gl`, `deck.gl` | *Death Stranding*, *Microsoft Flight Simulator*, *Just Cause 4*, *GTA IV* |
| **11** | [11. Destruição e Slicing](11-procedural-destruction-and-mesh-slicing.md) | Voronoi 3D, CSG, fatiamento de malhas e escombros | `three-pinata`, `three-bvh-csg`, `THREE-CSGMesh` | *Teardown*, *Control*, *Red Faction: Guerrilla*, *Crackdown 3* |
| **12** | [12. Áudio Espacial e Síntese](12-procedural-spatial-audio-and-sound-synthesis.md) | Web Audio DSP, ruído marrom/rosa, dobra e vácuo | `Tone.js`, `WAAX`, `howler.js` | *Elite Dangerous*, *Returnal*, *Hellblade: Senua's Sacrifice* |
| **13** | [13. Voo Interestelar e Dobra](13-interstellar-warp-and-relativistic-flight.md) | Métrica de Alcubierre, Warp Steps e túneis cósmicos | `cesium`, `THREE.ShaderUtils` | *Elite Dangerous*, *Star Wars: Squadrons*, *EVE Online*, *No Man's Sky* |
| **14** | [14. Céus e Nebulosas JWST](14-volumetric-skies-atmospheres-and-jwst-nebulae.md) | Spikes hexagonais do Webb, Pilares da Criação | `lagrange`, `three.js/SkyNode` | *SpaceEngine*, *Destiny 2*, *Star Citizen* |
| **15** | [15. Clima Tropical e Ciclo Dia/Noite](15-dynamic-weather-rain-and-day-night-cycle.md) | Chuva torrencial amazônica, poças e asfalto molhado | `webgpu_particles`, `beautiful-water` | *Ghost of Tsushima*, *Red Dead Redemption 2*, *Batman: Arkham Knight* |
| **16** | [16. Chefes Colossais e Titãs](16-colossal-titans-planetary-bosses-and-multi-ik.md) | Leviatã Astral de 240km, pontos fracos e IA de fases | `THREE.IK`, `three-mesh-bvh`, `threejs-procedural-planets` | *Shadow of the Colossus*, *God of War III*, *Final Fantasy XVI*, *Monster Hunter* |
| **17** | [17. Streaming de Dados GIS](17-geospatial-data-streaming-overture-and-gis.md) | Overture Maps, PMTiles, DuckDB e GeoParquet | `PMTiles`, `duckdb-wasm`, `loaders.gl` | *Microsoft Flight Simulator*, *Google Earth VR*, *The Division* |
| **18** | [18. HUD Diegético Ultra-Leve](18-diegetic-low-overhead-web-hud-and-ui.md) | Telemetria sem layout thrashing, DOM leve | `stats.js`, `leva` | *Dead Space*, *The Division*, *Cyberpunk 2077*, *Metroid Prime* |
| **19** | [19. Arquitetura ECS e Workers](19-data-oriented-ecs-and-web-worker-concurrency.md) | Data-Oriented Design, SharedArrayBuffer e física | `bitECS`, `rapier.js`, `ecsy` | *Overwatch*, *Vampire Survivors*, *Ashes of the Singularity* |
| **20** | [20. Persistência de Estado Cósmico](20-persistent-cosmic-state-and-binary-serialization.md) | IndexedDB transacional, deltas e Protobuf | `idb`, `lz-string`, `protobuf.js` | *Skyrim / Fallout 4*, *No Man's Sky*, *Elden Ring* |

---

## Catálogo de Mais de 50 Jogos de Mundo Aberto Citados

Abaixo está o índice temático de todos os títulos de mundo aberto, simuladores e jogos de ação analisados na pesquisa:

1. **[Sea of Thieves](https://www.seaofthieves.com/)** — *Física de fluidos, ondas FFT, refração e empuxo de corpos flutuantes.*
2. **[Subnautica](https://unknownworlds.com/subnautica/)** — *Absorção volumétrica ótica de profundidade e transição contínua ar-água.*
3. **[Subnautica: Below Zero](https://unknownworlds.com/subnautica-below-zero/)** — *Interação de água criogênica com leitos congelados.*
4. **[Assassin's Creed IV: Black Flag](https://www.ubisoft.com/en-gb/game/assassins-creed/black-flag)** — *Água oceânica em larga escala com malhas CDLOD adaptativas.*
5. **[Assassin's Creed: Unity](https://www.ubisoft.com/en-gb/game/assassins-creed/unity)** — *Arquitetura urbana histórica densa em escala 1:1.*
6. **[Assassin's Creed Valhalla](https://www.ubisoft.com/en-gb/game/assassins-creed/valhalla)** — *Renderização volumétrica de clima, rios nórdicos e névoa.*
7. **[Ratchet & Clank: Rift Apart](https://insomniac.games/game/ratchet-clank-rift-apart/)** — *Transição instantânea entre planetas e dimensões sem loading.*
8. **[Dishonored 2](https://bethesda.net/en/game/dishonored-2)** — *Mecânica Blink de teletransporte instantâneo e predição parabólica.*
9. **[Infamous: Second Son](https://www.suckerpunch.com/category/games/infamous-second-son/)** — *Saltos espaciais e partículas atreladas ao vetor de velocidade.*
10. **[Portal 2](https://store.steampowered.com/app/620/Portal_2/)** — *Portais contínuos com preservação inercial e corte de frustum oblíquo.*
11. **[Splitgate](https://www.splitgate.com/)** — *Portais rápidos com resolução dinâmica para combate em primeira pessoa.*
12. **[Manifold Garden](https://manifoldgarden.com/)** — *Geometria não-euclidiana infinita e transição de gravidade.*
13. **[Antichamber](https://store.steampowered.com/app/219890/Antichamber/)** — *Espaços impossíveis conectados por máscaras de estêncil.*
14. **[No Man's Sky](https://www.nomanssky.com/)** — *Geração planetária procedural, reentrada atmosférica contínua e persistência delta.*
15. **[Star Citizen](https://robertsspaceindustries.com/star-citizen)** — *Planetas escala 1:1, cidades globais e dispersão atmosférica volumétrica.*
16. **[Outer Wilds](https://www.mobiusdigitalgames.com/outer-wilds.html)** — *Física orbital e planetária newtoniana compactada em tempo real.*
17. **[Elite Dangerous](https://www.elitedangerous.com/)** — *Simulação da Via Láctea, FSD supercruise e design de som de espaçonaves.*
18. **[SpaceEngine](https://spaceengine.org/)** — *Simulador astronômico procedural do universo com raymarching de nebulosas.*
19. **[EVE Online](https://www.eveonline.com/)** — *Navegação de dobra espacial em escala galáctica e tráfego de frotas.*
20. **[Star Wars: Squadrons](https://www.ea.com/games/starwars/squadrons)** — *Estiramento estelar relativístico e saltos de hiperespaço.*
21. **[Marvel's Spider-Man](https://insomniac.games/game/marvels-spider-man-remastered/)** — *Navegação veloz em metrópole, interior mapping em janelas e combate fluido.*
22. **[Marvel's Spider-Man 2](https://insomniac.games/game/marvels-spider-man-2/)** — *Carregamento instantâneo por SSD, voo de asas e câmera de ação.*
23. **[The Matrix Awakens: An Unreal Engine 5 Experience](https://www.unrealengine.com/en-US/the-matrix-awakens)** — *Cidade procedural massiva, Nanite HLOD e tráfego autônomo.*
24. **[Cyberpunk 2077](https://www.cyberpunk.net/)** — *Verticalidade metropolitana, tráfego multinível e interface diegética.*
25. **[Grand Theft Auto V](https://www.rockstargames.com/gta-v)** — *IA de trânsito em grafo viário, streaming radial de chunks e multidões.*
26. **[Grand Theft Auto IV](https://www.rockstargames.com/games/IV)** — *Pontes suspensas urbanas conectadas ao relevo e simulação de física Euphoria.*
27. **[Watch Dogs 2](https://www.ubisoft.com/en-gb/game/watch-dogs-2)** — *Rotinas de pedestres, interações interpessoais e reações a emergências.*
28. **[Hitman: World of Assassination](https://www.ioi.dk/hitman-world-of-assassination/)** — *Simulação de multidões densas e pânico em cadeia no motor Glacier.*
29. **[The Legend of Zelda: Tears of the Kingdom](https://www.nintendo.com/games/detail/the-legend-of-zelda-tears-of-the-kingdom-switch/)** — *Mundo aberto vertical sem transição (céu, solo e profundezas) com otimização extrema.*
30. **[The Legend of Zelda: Breath of the Wild](https://www.nintendo.com/games/detail/the-legend-of-zelda-breath-of-the-wild-switch/)** — *Química de mundo aberto, física de terreno e culling agressivo.*
31. **[Doom Eternal](https://bethesda.net/en/game/doom)** — *Arquitetura de renderização zero-allocation a mais de 144 FPS.*
32. **[Horizon Forbidden West](https://www.playstation.com/en-us/games/horizon-forbidden-west/)** — *Hi-Z occlusion culling e vegetação densa procedural.*
33. **[Horizon Zero Dawn](https://www.playstation.com/en-us/games/horizon-zero-dawn/)** — *Comportamento de rebanho e predação de máquinas autônomas.*
34. **[Uncharted 4: A Thief's End](https://www.playstation.com/en-us/games/uncharted-4-a-thiefs-end/)** — *Locomoção adaptativa com IK de dois ossos e transição de animações.*
35. **[Batman: Arkham Knight](https://www.rockstargames.com/games/batman-arkham-knight)** — *Freeflow combat, transição voo-solo e superfícies molhadas de chuva.*
36. **[Batman: Arkham City](https://www.rockstargames.com/games/batman-arkham-city)** — *Magnetismo suave de golpes e câmera de ação.*
37. **[God of War (2018)](https://www.playstation.com/en-us/games/god-of-war/)** — *Hitstop visceral, retorno cinemático do machado e plano-sequência sem cortes.*
38. **[God of War Ragnarök](https://www.playstation.com/en-us/games/god-of-war-ragnarok/)** — *Transições dimensionais por fendas místicas e deformação de tela.*
39. **[God of War III](https://www.playstation.com/en-us/games/god-of-war-iii-remastered/)** — *Batalha contra o titã Cronos: o chefe como cenário de combate vivo.*
40. **[Devil May Cry 5](https://www.devilmaycry5.com/)** — *Responsividade de 60 Hz, input buffering e cancelamento de golpes.*
41. **[Shadow of the Colossus](https://www.playstation.com/en-us/games/shadow-of-the-colossus/)** — *Batalhas contra criaturas gigantescas com pontos fracos específicos e IK de escalada.*
42. **[Final Fantasy XVI](https://br.finalfantasyxvi.com/)** — *Combates cósmicos e planetários entre Eikons em escala titânica.*
43. **[Monster Hunter: World](https://www.monsterhunter.com/world/)** — *Dano anatômico direcional e ricochete em carapaças blindadas.*
44. **[Death Stranding](https://www.kojimaproductions.jp/en/death-stranding)** — *Cálculo rigoroso de equilíbrio em terrenos acidentados e pontes elevadas.*
45. **[Microsoft Flight Simulator](https://www.flightsimulator.com/)** — *Streaming em escala global de dados de satélite e elevação DEM de cidades reais.*
46. **[Google Earth VR](https://arvr.google.com/earth/)** — *Navegação contínua de órbita até ruas históricas com LOD piramidal.*
47. **[Tom Clancy's The Division / The Division 2](https://www.ubisoft.com/en-gb/game/the-division/the-division-2)** — *Escala 1:1 de metrópole real e HUD diegético de realidade aumentada.*
48. **[Just Cause 4](https://square-enix-games.com/games/just-cause-4)** — *Pontes suspensas destrutíveis e física climática com tornados e vento.*
49. **[Teardown](https://teardowngame.com/)** — *Destruição 100% dinâmica baseada em física de voxels na GPU.*
50. **[Control](https://www.remedygames.com/games/control)** — *Física de escombros e telecinese com quebra procedural de concreto.*
51. **[Red Faction: Guerrilla](https://store.steampowered.com/app/20500/Red_Faction_Guerrilla_ReMarsTered/)** — *Simulação de integridade mecânica e colapso gravitacional de prédios.*
52. **[Crackdown 3](https://www.xbox.com/en-US/games/crackdown-3)** — *Destruição massiva de arranha-céus por armas e superpoderes.*
53. **[Returnal](https://housemarque.com/games/returnal)** — *Áudio espacial 3D binaural para localização imediata de perigos.*
54. **[Hellblade: Senua's Sacrifice](https://www.hellblade.com/)** — *Síntese acústica binaural e imersão psicoacústica 3D.*
55. **[Destiny 2](https://www.bungie.net/7/en/Destiny)** — *Skyboxes de ficção científica com planetas gigantes e nebulosas ativas.*
56. **[Ghost of Tsushima](https://www.playstation.com/en-us/games/ghost-of-tsushima/)** — *Vento direcional, partículas atmosféricas e tempestades dinâmicas.*
57. **[Red Dead Redemption 2](https://www.rockstargames.com/reddeadredemption2)** — *Simulação meteorológica profunda, formação de nuvens e umidade progressiva.*
58. **[Dead Space / Dead Space Remake](https://www.ea.com/games/dead-space)** — *Interface 100% diegética sem barras 2D flutuantes.*
59. **[Metroid Prime](https://www.nintendo.com/store/products/metroid-prime-remastered-switch/)** — *Visor diegético e escaneamento taxonômico de espécies e tecnologia.*
60. **[Overwatch / Overwatch 2](https://overwatch.blizzard.com/)** — *Arquitetura ECS em dados contíguos para simulação determinística.*
61. **[Vampire Survivors](https://poncle.games/)** — *Densidade massiva de entidades com renderização instanciada plana.*
62. **[Ashes of the Singularity](https://www.ashesofthesingularity.com/)** — *Multithreading de dezenas de milhares de unidades independentes.*
63. **[The Elder Scrolls V: Skyrim / Fallout 4](https://bethesda.net/)** — *Persistência de deltas de mundo aberto com IDs de referência estáveis.*
64. **[Elden Ring](https://en.bandainamcoent.eu/elden-ring/elden-ring)** — *Transações atômicas de salvamento em background em mundo aberto.*
