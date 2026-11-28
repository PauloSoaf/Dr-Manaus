# Protocolo de colaboração

O ponto de entrada é o [AGENTS.md](../../AGENTS.md). Codex, Claude, Gemini e demais agentes devem abri-lo explicitamente. Arquivos específicos de uma ferramenta, quando necessários, apontam para esse protocolo central.

1. Leia o contexto obrigatório, confira `git status --short`, branch, HEAD, histórico e `git fetch origin`. Registre uma sessão única com agente, modelo conhecido ou `UNKNOWN`, ambiente, timestamp em America/Manaus, objetivo e checkpoint.
2. Identifique concorrência por arquivo. Preserve alterações do usuário e de outros agentes. Use caminhos explícitos ou worktree isolada quando necessário. Evite reset destrutivo, clean, stash indiscriminado e force push.
3. Audite contratos existentes, reproduza a falha e implemente uma correção incremental. Teste os caminhos reais e reaudite. Registre alternativas e consequências das decisões arquiteturais.
4. Rode os gates do checkpoint e revise o diff. Para FOUNDATION-01 execute tipagem, regressão, testes unitários e build. Registre testes de navegador omitidos pela política vigente e a homologação manual separadamente.
5. Identifique commits com trailers `Agent:`, `Model:`, `Session:` e `Checkpoint:`, sem alterar a identidade Git. Confira o remoto, publique na branch autorizada e consulte o CI pelo SHA de implementação.
6. Encerre o relatório, acrescente o resultado ao histórico e atualize registro, estado, problemas e próximas ações. Registre também sessões incompletas e falhas. Preserve entradas históricas. Se o handoff estiver em commit posterior, identifique o SHA de implementação e a referência do commit documental sem autorreferência.

Cada relatório individual registra identificação, contexto recebido, objetivo, arquivos, referências, causas, decisões, alterações, testes, desempenho, reauditoria, homologação, Git, CI e próxima ação. Use `PENDING` ou `NOT_VERIFIED` quando couber. Commits sem atribuição comprovada ficam como `LEGACY_UNATTRIBUTED`.
