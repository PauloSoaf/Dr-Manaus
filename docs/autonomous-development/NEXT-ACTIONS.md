# DR-MANAUS | Next Actions & Backlog Queue

## Próxima sessão de FOUNDATION-01

1. Coletar o retorno da validação em jogo do `F01-HOTFIX-002` (branch `fix/f01-global-terrain-streaming`, relatório na própria branch). Se aprovado, integrar em `feat/universe-map` com `git merge --ff-only`, depois de confirmar que nenhuma outra sessão alterou os mesmos sistemas. Se houver defeito, corrigir na branch.
2. Coletar o retorno dos roteiros de [solo, teleporte e água](foundation/FOUNDATION-01.md#roteiro-manual-de-solo-teleporte-e-água) e de [condução](foundation/FOUNDATION-01.md#roteiro-manual-de-condução). Para salto na condução, reproduzir com `?motionTrace=1`.
3. Medir quadro, GPU, memória e ciclo de vida em viagem longa no equipamento do usuário. Reavaliar o contrato após suspensão da aba.
4. Tratar a reancoragem do ENU em voo longo (F01-08) e a escolha entre registrar Thalassa no sistema ativo ou retirá-la do catálogo (F01-07). Manter FOUNDATION-02 em espera.

Fila anterior preservada abaixo.

## 1. Fila Priorizada de Execução Autônoma

1. **[EM PUBLICAÇÃO] `COSMIC-ATLAS-DISCOVERY-01`**
   - Integração do Catálogo Universal e Atlas Cósmico para Titãs Planetários e Nebulosas JWST, com Aprimoramento de Renderização Volumétrica de Clima.
   - Status: Implementado e validado localmente (`1.809/1.809` testes gerais, `639/639` regressões, build limpo em 1.91s). Publicando commit na branch `feat/universe-map`.

2. **[VERIFICAÇÃO DE CI] Monitorar GitHub Actions para `COSMIC-ATLAS-DISCOVERY-01`**
   - Confirmar aprovação 100% verde dos workflows no GitHub Actions.

3. **[PRÓXIMO CHECKPOINT] Otimização Contínua de Streaming e Imersão Cósmica**
   - Refinamento de transição orbital suave e novas rotas cósmicas no Atlas Cósmico.
