# DR-MANAUS

Jogo 3D no navegador, com Three.js, simulação local, Manaus georreferenciada e exploração planetária. Preserve os contratos de física, streaming por região e referenciais hierárquicos. O checkpoint ativo está em [CURRENT-STATE.md](docs/autonomous-development/CURRENT-STATE.md). Durante FOUNDATION-01, priorize estabilidade da engine e preserve o conteúdo existente.

Leia explicitamente, nesta ordem, antes de editar:

1. Este arquivo, o [protocolo de auditoria](docs/architecture/MASTER-SPEC-AUDIT-PROTOCOL.md) e a [matriz de rastreabilidade](docs/architecture/TRACEABILITY-MATRIX.md).
2. [Estado atual](docs/autonomous-development/CURRENT-STATE.md), [problemas conhecidos](docs/autonomous-development/KNOWN-ISSUES.md) e [próximas ações](docs/autonomous-development/NEXT-ACTIONS.md).
3. [Protocolo de agentes](docs/autonomous-development/AGENT-PROTOCOL.md), [registro](docs/autonomous-development/AGENT-REGISTRY.md), [histórico](docs/autonomous-development/AGENT-WORKLOG.md) e as SPECs e referências do checkpoint.

Registre identidade, branch, HEAD e sessão. Confira o remoto e preserve alterações de terceiros. Caracterize defeitos com código de produção, teste, revise o diff e reaudite caminhos alternativos. Registre decisões relevantes nas ADRs. Rode tipagem, regressão, testes e build. Separe evidência automatizada, CI e homologação manual. Declare apenas resultados verificados.

Use commits incrementais com trailers de identificação. Publique somente na branch autorizada, sem force push. Atualize relatório e handoff com evidências e pendências. Não avance de checkpoint com gates obrigatórios pendentes ou P0/P1 em aberto.
