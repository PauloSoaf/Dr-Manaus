# DR-MANAUS | Known Issues & Technical Debt Tracker

## FOUNDATION-01

| ID | Pendência | Severidade | Estado |
| --- | --- | --- | --- |
| F01-01 | A condução agora tem uma autoridade, diagnóstico e teste de integração headless. Falta validar ao vivo a câmera nas transições e as exceções de handoff com rebase. | Gate | VISUAL_VALIDATION_PENDING |
| F01-02 | Costura do oceano, sobreposição transitória, ausência de saltos visíveis e crescimento de memória exigem homologação. | Gate | VISUAL_VALIDATION_PENDING |
| F01-03 | Rebase multieixos durante natação e voo, rampas/escadas, aba suspensa e trânsito universal ainda carecem de cenário integrado. | Gate | Aberto |
| F01-04 | CT-08-04 e CT-08-06 falharam com alterações locais de tráfego preexistentes, preservadas fora dos commits da sessão. | Local | Aberto na árvore compartilhada |

Este documento rastreia problemas não bloqueantes, pendências de homologação e dívidas técnicas mapeadas para tratamento posterior.

| ID | Subsistema | Severidade | Descrição | Impacto / Mitigação | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `ISSUE-01` | Gráficos / GPU | P2 | Lente gravitacional e anel de fótons relativístico para buracos negros | Implementado `RingGeometry` relativístico em `BlackHoleProvider` contornando a sombra de Kerr/Schwarzschild com orientação voltada para o observador | `CONCLUIDO` |
| `ISSUE-02` | Atlas Cósmico | P3 | Na visualização do Atlas com milhares de sistemas descobertos, a lista de rolagem DOM pode se tornar longa | Implementado cache consolidado de `targetMap` com invalidação determinística, cache de metadados procedurais (`bodyMetadataCache`) eliminando regenerações no loop de busca, estatísticas unificadas em passagem única $O(N)$ em `query()` e paginação atômica (+24 itens) | `CONCLUIDO` |
| `ISSUE-03` | Homologação Visual | P2 | Testes automatizados cobrem apenas altimetria, matemática e DOM; inspeção visual de transição de voo rasante em planetas procedurais requer validação manual no navegador | `scripts/universo-vivo-browser-validation.mjs` executado em Chromium real: 6/6 critérios aprovados, 60,0 FPS, sem erros de página/console | `CONCLUIDO` |
| `ISSUE-04` | Manaus / Terrestre | P2 | Transição contínua entre modelo WGS84 ECEF de Manaus e o globo orbital em altitudes intermediárias (50 km a 200 km) | Implementado `orbitLift` no decaimento e alcance do nevoeiro atmosférico (`Atmosphere.ts`), elevando o plano de neblina para além de 20.000 km em órbitas espaciais e impedindo truncamento da Terra orbital, acompanhado de transição suave em Hermite cúbico da casca atmosférica WGS84 (`EarthGlobe.ts`, `uAtmosphereOpacity`) entre 15 km e 50 km | `CONCLUIDO` |

