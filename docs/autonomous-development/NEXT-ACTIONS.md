# DR-MANAUS | Next Actions & Backlog Queue

## Próxima sessão de FOUNDATION-01

1. Coletar o retorno item a item dos roteiros do [F01-HOTFIX-002](agent-reports/2026/2026-11-27-2358-claude-f01-hotfix-002-report.md), de [aproximação de planetas](foundation/FOUNDATION-01.md#carregamento-de-planetas), de [solo, teleporte e água](foundation/FOUNDATION-01.md#roteiro-manual-de-solo-teleporte-e-água) e de [condução](foundation/FOUNDATION-01.md#roteiro-manual-de-condução). Para salto na condução, reproduzir com `?motionTrace=1`.
2. Com o F3 aberto no equipamento do usuário, registrar o tempo de quadro na aproximação de planetas e no voo rápido. Verificar a hipótese F01-15 (material por tile) com um perfil do navegador antes de alterar a máscara.
3. Medir GPU, memória e ciclo de vida em viagem longa. Reavaliar o contrato após suspensão da aba.
4. Tratar a reancoragem do ENU em voo longo (F01-08), a dissolução na saída do globo (F01-16) e a escolha entre registrar Thalassa no sistema ativo ou retirá-la do catálogo (F01-07). Manter FOUNDATION-02 em espera.

Fila anterior preservada abaixo.

## 1. Fila Priorizada de Execução Autônoma

1. **[EM PUBLICAÇÃO] `COSMIC-ATLAS-DISCOVERY-01`**
   - Integração do Catálogo Universal e Atlas Cósmico para Titãs Planetários e Nebulosas JWST, com Aprimoramento de Renderização Volumétrica de Clima.
   - Status: Implementado e validado localmente (`1.809/1.809` testes gerais, `639/639` regressões, build limpo em 1.91s). Publicando commit na branch `feat/universe-map`.

2. **[VERIFICAÇÃO DE CI] Monitorar GitHub Actions para `COSMIC-ATLAS-DISCOVERY-01`**
   - Confirmar aprovação 100% verde dos workflows no GitHub Actions.

3. **[PRÓXIMO CHECKPOINT] Otimização Contínua de Streaming e Imersão Cósmica**
   - Refinamento de transição orbital suave e novas rotas cósmicas no Atlas Cósmico.
