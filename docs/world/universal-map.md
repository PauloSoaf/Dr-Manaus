# Universal Map & Coordinate Model (Phase B & C Hardened)

O Universal Map provê uma navegação unificada do macro para o micro. 
Os usuários nunca devem visualizar elementos fora da hierarquia lógica real em que se encontram (e.g. tentar visualizar Manaus enquanto estiverem no Sistema Solar, sem estarem sob a influência direta do campo planetário).

## Mapeamento por Níveis

As classes envolvidas em renderizar as escalas interplanetárias e cosmológicas residem em `src/ui/map/MapRenderers.ts`.

- **`CosmologyMapRenderer`**: Mostra estruturas da teia cósmica e superaglomerados. Utiliza distribuição pseudo-aleatória determinística por PRNG com semente (LCG).
- **`GalaxyMapRenderer`**: Renderização em espiral da galáxia (Via Láctea). Localiza o setor do jogador preservando inteiramente a precisão dos inteiros `BigInt` via escalonamento de ponto fixo `(sector * scaleFactor) / GALAXY_SECTOR_RADIUS`.
- **`SystemMapRenderer`**: Conectado diretamente aos parâmetros IAU de `SOLAR_SYSTEM_BODIES` e às posições orbitais físicas em tempo real de `OfflineEphemeris`. Raio logarítmico/raiz quadrada mapeia planetas internos e externos com fidelidade geométrica.
- **`PlanetMapRenderer`**: Um globo 3D wireframe renderizado via `CanvasRenderingContext2D` mostrando paralelos, meridianos, latitude, longitude e altitude física do jogador, com cálculo euclidiano correto da visibilidade do marcador no disco visível do planeta.
- **`SurfaceMapRenderer`**: Interface de mapa local interativo (como em `CityMap.ts`) para lidar com ruas e pontos de referência locais.

A orquestração visual está embutida na classe `UniversalMapPanel` (`src/ui/map/UniversalMapPanel.ts`), que suporta os cinco escopos tanto por detecção contextual automática de domínio quanto por navegação interativa em breadcrumbs (`setLevel`).

## Modelo de Coordenadas e Compartilhamento de Endereços

A URI oficial do teleporte no Dr-Manaus (Phase C) é do formato:
`drm:v1://?kind=<target_kind>&<params...>`

Ele usa as instâncias de `TeleportTarget` (veja `src/world/spatial/UniverseLocation.ts`).

O serviço `UniverseCoordinates` lida com validação estrita, parse e serialização de endpoints lógicos:
- **`surface`**: Parâmetros `body`, `lat` (restringido a `[-90, 90]`), `lon` (restringido a `[-360, 360]`), `alt`, com preservação opcional de contexto `gal` e `sys`.
- **`orbit`**: Parâmetros `body`, `alt` (restringido a `>= 0`), com contexto `gal` e `sys`.
- **`system`**: Parâmetros `sys`, `x`, `y`, `z` (valores finitos obrigatórios), com contexto `gal`.
- **`sector`**: Parâmetros `gal`, `sx`, `sy`, `sz` (BigInt exato), `ox`, `oy`, `oz` (offsets finitos).
- **`cosmo`**: Célula `cx`, `cy`, `cz` (BigInt), offset `mx`, `my`, `mz` em Mpc, época e parâmetros observacionais opcionais (`z` redshift, `d` comóvel, `ra`, `dec`).
- **`catalog`**: Objeto nomeado.

Todas as entradas malformadas, não-finitas ou contendo `NaN` são estritamente rejeitadas (retornando `null`).

