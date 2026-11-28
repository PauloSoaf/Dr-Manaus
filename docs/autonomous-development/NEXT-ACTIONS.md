# DR-MANAUS | Next Actions & Backlog Queue

## Próxima sessão de FOUNDATION-01

1. Conferir o feedback do [roteiro manual de condução](foundation/FOUNDATION-01.md#roteiro-manual-de-condução). Se houver salto, reproduzir com `?motionTrace=1` e comparar o evento de entrada/saída com qualquer rebase no mesmo quadro.
2. Exercitar `UniverseRuntime.update` e `FloatingOrigin3D` com poses do laboratório, comparando a posição lógica, a distância câmera/jogador e a fase da água antes e depois de rebases X/Y/Z. Acrescentar percurso contínuo de margem, rampa, escadas e plataforma. Reavaliar o contrato após suspensão da aba.
3. Homologar transições e costura da água manualmente, medir frame, memória e ciclo de vida em viagem repetida. Executar os gates e exigir o CI do SHA correspondente antes de aprovar. Manter FOUNDATION-02 em espera.

Fila anterior preservada abaixo.

## 1. Fila Priorizada de Execução Autônoma

1. **[EM PUBLICAÇÃO] `COSMIC-ATLAS-DISCOVERY-01`**
   - Integração do Catálogo Universal e Atlas Cósmico para Titãs Planetários e Nebulosas JWST, com Aprimoramento de Renderização Volumétrica de Clima.
   - Status: Implementado e validado localmente (`1.809/1.809` testes gerais, `639/639` regressões, build limpo em 1.91s). Publicando commit na branch `feat/universe-map`.

2. **[VERIFICAÇÃO DE CI] Monitorar GitHub Actions para `COSMIC-ATLAS-DISCOVERY-01`**
   - Confirmar aprovação 100% verde dos workflows no GitHub Actions.

3. **[PRÓXIMO CHECKPOINT] Otimização Contínua de Streaming e Imersão Cósmica**
   - Refinamento de transição orbital suave e novas rotas cósmicas no Atlas Cósmico.
