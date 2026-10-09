# Universal Map & Coordinate Model (U3 transit route, 2026-10-09)

## U3 — Shared target and transit route (2026-10-09)

The production Galaxy/Cosmos catalogue exposes Sol, nearby/MW systems, a 50 kly MW route,
and two Andromeda systems without QA arrival. Select a target, close M and press P from safe
SYSTEM space. Same-system body targets retain CosmicFlight; remote bodies use hypercruise,
atomic system handoff and the existing final approach. Landing remains an explicit F action.

During transit the location card says EM TRÂNSITO, the map shows a schematic source–destination
route with an interpolated progress marker, and HUD distinguishes the immutable trip destination
from the current selected target. The source address is retained metadata, not the player marker.
X brakes into stopped transit; P resumes, or select the original source system to return.
Galaxy/cluster/BH catalogue selection still never moves the player by itself. BH and cosmological
travel remain unavailable. [U3 report](29-status-U3-UNIVERSAL-HYPERCRUISE.md).


## U2 — Current galaxy hierarchy (2026-10-09)

The Galaxy view, breadcrumb, scale, catalogue markers and current-location HUD follow the active
address. From Andromeda, the system map shows only the generated system, M31 is current and MW /
Sgr A* are external. Selecting them changes the shared target only. Distances use logical galaxy
origins, sector offsets and catalogue separation; marker placement remains schematic.
Explicit DEV or `?u2test=1` reveals `ENTER ANDROMEDA · U2 TEST` and the return control.
Historical U2: normal P refused intergalactic travel. [U2 report/manual gate](28-status-U2-GALAXY-RUNTIME-ANDROMEDA.md).



O Universal Map provê uma navegação unificada do macro para o micro. 
Os usuários nunca devem visualizar elementos fora da hierarquia lógica real em que se encontram (e.g. tentar visualizar Manaus enquanto estiverem no Sistema Solar, sem estarem sob a influência direta do campo planetário).

## Autoridade única do alvo — U0/U1

O mapa seleciona descritores por chave canônica através de `Game.selectNavigationTarget`, que
armazena `NavigationTargetState.current`. O cartão recebe a resolução usada pelo HUD; o mapa
não guarda um segundo destino. Fechar/reabrir, mudar LOD, descarregar providers ou fazer rebase
não invalidam a identidade. `UniverseRuntime.address` continua sendo a localização do jogador:
selecionar não altera pose, endereço ou sistema ativo.

Sistema: os 19 corpos usam `UniverseAddress` Solar e o adaptador existente de piloto automático.
Galáxia: Via Láctea, Sgr A*, Andromeda e M31 SMBH são selecionáveis por botão/marcador. Cosmos:
galáxias, Local Group, Virgo, Norma/Great Attractor, Shapley e Observable Horizon usam os
descritores existentes. As áreas clicáveis são esquemáticas; as distâncias vêm do catálogo,
das efemérides e da matemática de setores, nunca do canvas. O HUD mostra 2.50 Mly para Andromeda,
26.00 kly para o centro galáctico/Sgr A*. U3 habilita P para destinos de sistemas/galáxias conhecidos em espaço seguro; buracos negros permanecem indisponíveis. Selecionar um alvo nunca inicia a viagem sozinho.

O cartão/F3 expõem tipo, chave, endereço, materialização e capacidade. Os eixos BigInt mantêm
identidades distintas acima de 2⁵³; a serialização versionada usa inteiros em strings decimais.
Navegação e a URI explícita de translocação abaixo continuam sendo operações distintas.
Em telas pequenas, a barra lateral rola e o canvas/seletores permanecem dentro da viewport.

Contrato completo, provas automatizadas e gate manual:
[26-status-U0-UNIVERSAL-NAVIGATION-TARGET.md](26-status-U0-UNIVERSAL-NAVIGATION-TARGET.md).
U1 acrescenta o sistema procedural ativo à mesma autoridade: os botões e canvas do nível
Sistema mostram a estrela, planetas e luas reais, com nomes/albedo/órbitas gerados. Tab/P/Warp
funcionam intra-sistema; U3 acrescenta Hypercruise para alvos remotos suportados. Controles
U1 TEST explícitos permitem preparar/materializar a fixture e retornar ao Solar; só aparecem em
dev ou com opt-in de preview `?u1test=1`. No checkpoint histórico U1 não existia transporte interestelar por P; U3 fornece esse caminho em produção.
Pouso rochoso/lunar usa ENU e terreno sintético; gigantes não têm piso. F3 mostra o sistema ativo.
[27-status-U1-PLAYABLE-PROCEDURAL-SYSTEMS.md](27-status-U1-PLAYABLE-PROCEDURAL-SYSTEMS.md).
Gate histórico U1 aceito. U2/U3 implementados; BH0 e busca UX/U5 permanecem futuros. STOP no gate manual U3.

## Mapeamento por Níveis

As classes envolvidas em renderizar as escalas interplanetárias e cosmológicas residem em `src/ui/map/MapRenderers.ts`.

- **`CosmologyMapRenderer`**: Fundo esquemático por PRNG determinístico (LCG), com marcadores clicáveis dos descritores cosmológicos existentes; o fundo não é autoridade de posição.
- **`GalaxyMapRenderer`**: Renderização em espiral da galáxia (Via Láctea). Localiza o setor do jogador preservando inteiramente a precisão dos inteiros `BigInt` via escalonamento de ponto fixo `(sector * scaleFactor) / GALAXY_SECTOR_RADIUS`.
- **`SystemMapRenderer`**: Consome corpos/posições vivas de `activeSystem` através do HUD, sem criar outra simulação ou efeméride. Raio logarítmico/raiz quadrada organiza planetas internos e externos; foco de luas e seleção compartilham o alvo universal.
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
