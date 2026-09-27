# feat(universe-map): mundo planetário WGS84, streaming e viagem interplanetária

## Resumo

Esta MR amplia o mundo de Manaus com uma arquitetura espacial capaz de representar a Terra, corpos celestes e setores procedurais. Adiciona um globo WGS84 visível, relevo terrestre real, streaming por providers, origem flutuante tridimensional, persistência versionada e um domínio de viagem separado da simulação urbana.

A projeção legada de Manaus é preservada para manter edifícios, vias e landmarks nas posições existentes. As funcionalidades em implantação são controladas por feature flags.

## Escopo da comparação

- Branch: `feat/universe-map`.
- Base adotada: `origin/main`, conforme referência local em `d2e0342` (merge do PR #2).
- Último commit incluído: `f5afb4d`.
- Total: **25 commits**, **136 arquivos alterados**, **19.983 inserções** e **69 remoções**.
- Intervalo: `origin/main..HEAD`; estatísticas do diff: `origin/main...HEAD`.
- A branch `main` local está mais antiga que `origin/main`; usá-la incluiria trabalho anterior de outras branches.
- Alterações locais ainda sem commit não fazem parte desta descrição. Nenhum fetch foi executado para atualizar as referências remotas.

## Mudanças implementadas

### Coordenadas e integração com Manaus

- Núcleo espacial independente do renderer, com conversões geodéticas WGS84, ECEF e ENU, unidades e poses espaciais.
- Árvore de referenciais com composição de posição e rotação, endereçamento de setores com `bigint` e geração determinística.
- `ManausFrameAdapter` mantém a projeção existente e explicita sua diferença em relação ao plano tangente WGS84.
- Origem flutuante com rebase nos três eixos, preservando posições lógicas e evitando coordenadas astronômicas nos buffers de renderização.
- `SurfaceTileFrame` fornece a estrutura de migração dos tiles para referenciais locais sobre o elipsoide; a curvatura de Manaus permanece desativada na configuração entregue.

### Providers, streaming e runtime

- `ProviderRegistry` define ownership por canal e prioridade de fidelidade.
- `GlobalStreamingScheduler` organiza demandas, carregamento, ativação e descarte com budgets, cache, cancelamento e proteção contra respostas obsoletas.
- Priorização considera erro visual, campo de visão, tempo até contato e relevância para gameplay.
- `UniverseRuntime` integra referenciais, providers, scheduler e modelo celeste ao jogo, com telemetria no painel F3.
- Correções evitam que carregamento consuma todo o orçamento antes da ativação e reduzem recálculos do quadtree.
- `StarSectorProvider` coloca setores estelares no ciclo de streaming, com liberação de geometria e endereço cósmico como referência.
- No streaming urbano, duas passagens compartilham o mesmo orçamento e reservam tempo para os shells, impedindo que a geração contínua de fachadas bloqueie a representação da cidade a média distância.

### Terra e renderização

- Cube-sphere WGS84 com quadtree, endereçamento de tiles e refinamento por erro projetado na tela.
- `EarthProvider` e `EarthGlobe` exibem o planeta com costas reais do Natural Earth e iluminação pela direção solar.
- Relevo real proveniente do ETOPO5/NOAA, preparado offline e amostrado de forma consistente entre tiles.
- Correções de orientação dos tiles, winding, normais, fog e ativação tornam o globo visível e corretamente iluminado.
- Renderização consolidada em uma câmera com depth buffer logarítmico após a revisão da abordagem inicial de múltiplos passes.
- Material de atmosfera planetária introduzido, com integração ainda controlada por flag.
- A transição visual para o globo mantém o gate de aproximadamente 15 km enquanto Manaus continua plana.

### Sistema Solar, geração procedural e viagem

- Modelo de corpos celestes e Sistema Solar com efemérides offline baseadas em elementos orbitais aproximados.
- Setores estelares e sistemas procedurais determinísticos, com runtime separado do Sistema Solar.
- Elementos orbitais dos planetas gerados são persistidos no próprio modelo e reutilizados pelo runtime.
- Tier interplanetário de 800.000 km/h e `TravelDomain` separado da física urbana.
- Entrada em viagem condicionada à solicitação explícita, altitude, velocidade e distância de colisores relevantes.
- Durante a viagem, a simulação suspende consultas urbanas de colisão, terreno, atores e tráfego; o estado espacial usa float64 e um envelope de altitude protege contra atravessar corpos.
- Retorno ao domínio local ao soltar a solicitação, reduzir velocidade ou se aproximar da superfície; teleporte para landmark reinicia o domínio.
- Telemetria informa o domínio e os motivos de recusa de transição.

### Persistência e documentação

- `WorldMutationStore` com versões de schema e gerador, endereços por setor/sistema/corpo e validação de registros.
- Persistência assíncrona em IndexedDB, fallback para localStorage, escritas agrupadas e flush ao ocultar ou sair da página.
- Migração de saves antigos, preservação de descobertas, tratamento de quota e hidratação das alterações de terreno.
- Documentação de arquitetura, contratos, critérios de aceitação, roadmap e matriz de bugs em `docs/world/` e `specs/dr-manaus-cosmic-world-specs/`.
- Remoção do probe temporário de altitude e revisão de estados documentados que não correspondiam à implementação.

## Configuração e limitações

- Ativas em `src/core/config.ts`: `spatialCore` e `earthGlobe`.
- Desativadas: `planetStreaming`, `planetTerrain`, `curvedManaus`, `newAtmosphere`, `solarSystem` e `galaxyTravel`. Esses nomes não substituem a análise dos caminhos já usados pelo globo; a existência de uma implementação não significa que toda a fase correspondente esteja habilitada.
- Manaus ainda utiliza seu streaming próprio. O provider provisório foi removido; a integração da cidade ao orçamento global permanece pendente no estado commitado.
- A migração completa da cidade para a superfície curva, atmosfera volumétrica e oceano global não devem ser considerados concluídos.
- O limite de altitude continua configurado em 500.000 km com o globo habilitado; esta MR não equivale à remoção definitiva do teto nem à entrega de pouso completo em todos os corpos.
- Há trechos históricos desatualizados nos documentos de status: por exemplo, a falha do smoke test e a ausência de `TravelDomain` foram tratadas por commits posteriores. Esta descrição considera o histórico até `f5afb4d`.

## Validação

As evidências abaixo são registros dos commits e da documentação, não execuções realizadas para criar este arquivo:

- O commit `eb6d3e2` registra **280 testes** após a separação do domínio de viagem.
- O commit `f5afb4d` registra o smoke test de navegador passando após a correção de starvation dos shells: 15 tiles, aproximadamente 46 mil triângulos de fachada e 169 mil de shell, com Monumento em `(0, 0)` e Teatro em `(-83, -6)`.
- A documentação registra builds e testes aprovados em etapas anteriores; esses resultados não constituem uma nova validação do HEAD ou das alterações locais atuais.
- A cobertura adicionada contempla WGS84, referenciais, rebase 3D, tiles e globo, streaming, Sistema Solar, sistemas procedurais, setores estelares, persistência e domínio de viagem.

Comandos disponíveis para validar a implementação em uma revisão futura:

```sh
npm test
npm run build
npm run test:browser
```

## Todos os commits incluídos

Em ordem cronológica, com os títulos originais:
- `3b8f671` — feat(spatial): add the WGS84 spatial core and anchor Manaus to it
- `8e3b047` — feat(world): add the provider registry and the global streaming scheduler
- `fb449eb` — feat(planet): add the WGS84 cube-sphere quadtree and planet bodies
- `4d6b599` — feat(celestial): add the solar system, offline ephemerides and star sectors
- `165b331` — feat(world): wire the universe runtime into the game behind feature flags
- `d3db3a4` — docs(world): describe the planetary architecture and state what is not built
- `70a7fa7` — feat(planet): draw the WGS84 globe with real coastlines and solar lighting
- `b2f2be3` — docs(world): document the planetary architecture against the spec package
- `f62d911` — fix(planet): put the globe on the screen
- `7a30c33` — feat(flight): add the interplanetary tier, and let the planet shade itself
- `00d25cc` — feat(planet): add planet-aware atmosphere material
- `d79f4e9` — feat: complete cosmic universe phase 5 to 13 specs
- `76286ee` — [Sprint H0] Resolve critical regressions: P0-03 (Curvature), P0-05 (Sector Travel), P0-06 (SolarSystem Mutated)
- `2f06e3c` — feat(universe): implement WGS84 SurfaceTileFrame migration for Manaus tiles
- `3140989` — fix(universe): finish Sprint H0 and undo the regressions it left
- `76d75c1` — fix(world): rebase the render origin on all three axes
- `03baf02` — refactor(galaxy): make star sectors a provider instead of a renderer
- `07cea86` — chore: drop the temporary altitude probe
- `9d62ef7` — fix(celestial): give generated planets orbits that survive being generated
- `b29aa7f` — feat(planet): give the Earth its real relief
- `5db5042` — docs(specs): repair the bug matrix entries
- `f3bf2bf` — feat(persistence): close the world mutation contract
- `1a4c90a` — docs(specs): make the status factual again
- `eb6d3e2` — feat(travel): separate the interplanetary domain from the local one
- `f5afb4d` — fix(realcity): stop facade work from starving the shell tier
- `64d606b` — feat(streaming): let the city spend the global budget instead of its own
