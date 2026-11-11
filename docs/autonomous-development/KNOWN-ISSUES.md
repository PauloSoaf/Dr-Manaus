# DR-MANAUS | Known Issues & Technical Debt Tracker

Este documento rastreia problemas não bloqueantes, pendências de homologação e dívidas técnicas mapeadas para tratamento posterior.

| ID | Subsistema | Severidade | Descrição | Impacto / Mitigação | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `ISSUE-01` | Gráficos / GPU | P2 | Falta de sombreamento por lente gravitacional (lensing) em shaders Three.js para o buraco negro central Sgr A* | O buraco negro desenha uma esfera negra e disco básico de toro; necessita implementação do milestone BH0 com TSL lensing | `PLANEJADO_BH0` |
| `ISSUE-02` | Atlas Cósmico | P3 | Na visualização do Atlas com milhares de sistemas descobertos, a lista de rolagem DOM pode se tornar longa | Paginação virtualizada ou agrupamento por constelação/setor recomendável em sprints futuros | `BACKLOG` |
| `ISSUE-03` | Homologação Visual | P2 | Testes automatizados cobrem apenas altimetria, matemática e DOM; inspeção visual de transição de voo rasante em planetas procedurais requer validação manual no navegador | Registrado em matriz de aceite como pendência de inspeção visual humana | `HOMOLOGACAO_PENDENTE` |
| `ISSUE-04` | Manaus / Terrestre | P2 | Transição contínua entre modelo WGS84 ECEF de Manaus e o globo orbital em altitudes intermediárias (50 km a 200 km) | Módulo `RealCityLayer` e `ManausFrameAdapter` operam estavelmente, mas necessitam de polimento estético de atmosfera volumétrica em transições extremas | `BACKLOG` |
