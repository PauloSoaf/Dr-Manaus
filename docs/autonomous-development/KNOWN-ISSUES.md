# DR-MANAUS | Known Issues & Technical Debt Tracker

## FOUNDATION-01

`F01-HOTFIX-001` (câmera, cobertura do terreno e poderes) foi validado em jogo pelo usuário na porta 9997 e integrado por fast-forward na sessão CODEX-003. [Relatório e roteiro](agent-reports/2026/2026-11-27-2131-f01-hotfix-001.md).

| ID | Pendência | Severidade | Estado |
| --- | --- | --- | --- |
| F01-01 | A condução agora tem uma autoridade, diagnóstico e teste de integração headless. Falta validar ao vivo a câmera nas transições e as exceções de handoff com rebase. | Gate | VISUAL_VALIDATION_PENDING |
| F01-02 | Costura do oceano, sobreposição transitória, ausência de saltos visíveis e crescimento de memória exigem homologação. | Gate | VISUAL_VALIDATION_PENDING |
| F01-03 | Rebase em voo e natação, rampas/escadas e aba suspensa ganharam cenário integrado (`foundation-continuity.test.ts`). Falta o cenário de trânsito universal. | Gate | Parcial |
| F01-04 | As alterações de tráfego pendentes foram revisadas, corrigidas e commitadas em `59a18b5`. CT-08 aprovados na suíte completa. | Local | Encerrado |
| F01-05 | Chão invisível e plano de chunks em y=0 fora de Manaus; sem leito no oceano; ondas fora da física; teleportes sem gravidade; Marte e Lua em posição errada; volta a Manaus com o relevo de origem. | P0 | Corrigido (`d75419c` a `439c7e1`), VISUAL_VALIDATION_PENDING |
| F01-06 | Fora de Manaus e abaixo de 8 km não há terreno distante além dos chunks próximos (o "quadrado verde"). | P0 | Corrigido no F01-HOTFIX-002 (`66d584c` a `30e25bf`), VISUAL_VALIDATION_PENDING |
| F01-07 | Thalassa está no catálogo, mas não no sistema solar ativo. O teleporte falha com aviso, como já falhava antes desta sessão. | P2 | Aberto |
| F01-08 | Sem reancoragem do ENU em voos longos. Terreno e água acompanham a curvatura, mas a vertical da gravidade permanece a do ponto de pouso. | P2 | Aberto |
| F01-09 | Marcas de queimado são relativas a y=0 e não aparecem em terreno elevado fora de Manaus. | P3 | Aberto |
| F01-10 | A escavação volumétrica usa a superfície desenhada e pode divergir do solo jogável em faixas costeiras. | P3 | Aberto |
| F01-11 | Testes de tempo de parede (CT-17-03, CT-08-01, FEATURE 18/CT-06-03 e FEATURE 20/RNF-20-03) já falharam sob carga paralela nesta máquina e passam isolados. Em 2026-11-28, CT-06-03 falhou em 2 de 5 execuções completas e passou nas isoladas. Nenhum limite foi alterado. | P2 | Aberto |
| F01-12 | Horizonte e copas sem texturas, normal maps, triplanar nem impostores. A forma geográfica é grosseira (ETOPO5 ~78 km por amostra, máscara de ~39 km). | P2 | Aberto |
| F01-13 | Uma âncora nova (teleporte) reconstrói o horizonte na mesma chamada, o que pode causar um engasgo pontual. As copas voltam um tile por quadro (~41 quadros). | P3 | Aberto |
| F01-14 | FPS, GPU, upload e memória do horizonte, das copas e do streaming não foram medidos no equipamento do usuário. Não há baseline anterior com a mesma instrumentação. | Gate | NOT_MEASURED |
| F01-15 | Cada tile de planeta recebe um material próprio da máscara de volume. No WebGPU, isso pode custar CPU no primeiro desenho de cada tile. É uma hipótese vinda da leitura do código e precisa de perfil no navegador. | P2 | NOT_MEASURED |
| F01-16 | Ao sair do alcance do globo físico, a troca de volta para o disco distante acontece num quadro. | P3 | Aberto |

Este documento rastreia problemas não bloqueantes, pendências de homologação e dívidas técnicas mapeadas para tratamento posterior.

| ID | Subsistema | Severidade | Descrição | Impacto / Mitigação | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `ISSUE-01` | Gráficos / GPU | P2 | Lente gravitacional e anel de fótons relativístico para buracos negros | Implementado `RingGeometry` relativístico em `BlackHoleProvider` contornando a sombra de Kerr/Schwarzschild com orientação voltada para o observador | `CONCLUIDO` |
| `ISSUE-02` | Atlas Cósmico | P3 | Na visualização do Atlas com milhares de sistemas descobertos, a lista de rolagem DOM pode se tornar longa | Implementado cache consolidado de `targetMap` com invalidação determinística, cache de metadados procedurais (`bodyMetadataCache`) eliminando regenerações no loop de busca, estatísticas unificadas em passagem única $O(N)$ em `query()` e paginação atômica (+24 itens) | `CONCLUIDO` |
| `ISSUE-03` | Homologação Visual | P2 | Testes automatizados cobrem apenas altimetria, matemática e DOM; inspeção visual de transição de voo rasante em planetas procedurais requer validação manual no navegador | `scripts/universo-vivo-browser-validation.mjs` executado em Chromium real: 6/6 critérios aprovados, 60,0 FPS, sem erros de página/console | `CONCLUIDO` |
| `ISSUE-04` | Manaus / Terrestre | P2 | Transição contínua entre modelo WGS84 ECEF de Manaus e o globo orbital em altitudes intermediárias (50 km a 200 km) | Implementado `orbitLift` no decaimento e alcance do nevoeiro atmosférico (`Atmosphere.ts`), elevando o plano de neblina para além de 20.000 km em órbitas espaciais e impedindo truncamento da Terra orbital, acompanhado de transição suave em Hermite cúbico da casca atmosférica WGS84 (`EarthGlobe.ts`, `uAtmosphereOpacity`) entre 15 km e 50 km | `CONCLUIDO` |

