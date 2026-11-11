# DR-MANAUS | Known Issues & Technical Debt Tracker

Este documento rastreia problemas não bloqueantes, pendências de homologação e dívidas técnicas mapeadas para tratamento posterior.

| ID | Subsistema | Severidade | Descrição | Impacto / Mitigação | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `ISSUE-01` | Gráficos / GPU | P2 | Lente gravitacional e anel de fótons relativístico para buracos negros | Implementado `RingGeometry` relativístico em `BlackHoleProvider` contornando a sombra de Kerr/Schwarzschild com orientação voltada para o observador | `CONCLUIDO` |
| `ISSUE-02` | Atlas Cósmico | P3 | Na visualização do Atlas com milhares de sistemas descobertos, a lista de rolagem DOM pode se tornar longa | Implementado cache consolidado de `targetMap` com invalidação determinística, cache de metadados procedurais (`bodyMetadataCache`) eliminando regenerações no loop de busca, estatísticas unificadas em passagem única $O(N)$ em `query()` e paginação atômica (+24 itens) | `CONCLUIDO` |
| `ISSUE-03` | Homologação Visual | P2 | Testes automatizados cobrem apenas altimetria, matemática e DOM; inspeção visual de transição de voo rasante em planetas procedurais requer validação manual no navegador | Registrado em matriz de aceite como pendência de inspeção visual humana | `HOMOLOGACAO_PENDENTE` |
| `ISSUE-04` | Manaus / Terrestre | P2 | Transição contínua entre modelo WGS84 ECEF de Manaus e o globo orbital em altitudes intermediárias (50 km a 200 km) | Módulo `RealCityLayer` e `ManausFrameAdapter` operam estavelmente, mas necessitam de polimento estético de atmosfera volumétrica em transições extremas | `BACKLOG` |

