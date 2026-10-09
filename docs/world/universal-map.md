# Universal Map & Coordinate Model (U0 target authority, 2026-10-09)

O Universal Map provê uma navegação unificada do macro para o micro. 
Os usuários nunca devem visualizar elementos fora da hierarquia lógica real em que se encontram (e.g. tentar visualizar Manaus enquanto estiverem no Sistema Solar, sem estarem sob a influência direta do campo planetário).

## Autoridade única do alvo — U0

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
26.00 kly para o centro galáctico/Sgr A* e informa viagem futura indisponível. P só executa
destinos Solar implementados; selecionar buraco negro ou galáxia não simula viagem.

O cartão/F3 expõem tipo, chave, endereço, materialização e capacidade. Os eixos BigInt mantêm
identidades distintas acima de 2⁵³; a serialização versionada usa inteiros em strings decimais.
Navegação e a URI explícita de translocação abaixo continuam sendo operações distintas.
Em telas pequenas, a barra lateral rola e o canvas/seletores permanecem dentro da viewport.

Contrato completo, provas automatizadas e gate manual:
[26-status-U0-UNIVERSAL-NAVIGATION-TARGET.md](26-status-U0-UNIVERSAL-NAVIGATION-TARGET.md).
U1/U2/U3/BH0 e busca UX/U5 permanecem futuros.

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
