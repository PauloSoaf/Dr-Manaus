# Universal Map & Coordinate Model (Phase B & C)

O Universal Map provê uma navegação unificada do macro para o micro. 
Os usuários nunca devem visualizar elementos fora da hierarquia lógica real em que se encontram (e.g. tentar visualizar Manaus enquanto estiverem no Sistema Solar, sem estarem sob a influência direta do campo planetário).

## Mapeamento por Níveis

As classes envolvidas em renderizar as escalas interplanetárias e cosmológicas residem em `src/ui/map/MapRenderers.ts`.

- **`CosmologyMapRenderer`**: Mostra estruturas da teia cósmica. Escala macro, grupos locais de galáxias.
- **`GalaxyMapRenderer`**: Renderização em espiral (focada inicialmente na Via Láctea), localizando o jogador usando um offset 3D de setores baseado num indexador `BigInt`.
- **`SystemMapRenderer`**: Mostra os planetas e corpos celestes num raio logarítmico simulando um sistema em 2D. Conecta-se às métricas físicas do sistema para apresentar dados verossímeis.
- **`PlanetMapRenderer`**: Um globo 3D wireframe renderizado via `CanvasRenderingContext2D` mostrando os paralelos, lat e lon e altitude atual do jogador.
- **`SurfaceMapRenderer`**: Interface de mapa local interativo (como em `CityMap.ts`) para lidar com ruas e pontos de referência locais.

A orquestração visual está embutida na classe `UniversalMapPanel` (`src/ui/map/UniversalMapPanel.ts`), que escolhe qual desses cinco escopos mostrar usando dados físicos injetados vindos de `UniverseLocation`.

## Modelo de Coordenadas e Compartilhamento de Endereços

A URI oficial do teleporte no Dr-Manaus (Phase C) é do formato:
`drm:v1://?kind=<target_kind>&<params...>`

Ele usa as instâncias de `TeleportTarget` (veja `src/world/spatial/UniverseLocation.ts`).

O serviço `UniverseCoordinates` lida com parse e serialização de endpoints lógicos:
- **`surface`**: Parâmetros `body`, `lat`, `lon`, `alt`.
- **`orbit`**: Parâmetros `body`, `alt`.
- **`system`**: Parâmetros `sys`, `x`, `y`, `z`.
- **`sector`**: Parâmetros `gal`, `sx`, `sy`, `sz` (BigInt), `ox`, `oy`, `oz`.
- **`cosmo`**: Parâmetros `z` (redshift), `d`, `ra`, `dec`.
- **`catalog`**: Objeto nomeado.

Não é recomendado interpolar ou prever colisões sem antes consultar o `UniversalTeleportService`.
