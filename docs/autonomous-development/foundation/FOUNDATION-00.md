# FOUNDATION-00 — baseline de partida

O plano de recuperação e a auditoria externa anexados pelo usuário descrevem `8d94a865c42b536c89fd3e2b680e5b4a311136d5`. Em 27/11/2026 esse era o HEAD local e remoto de `feat/universe-map`. Consulte a [matriz de SPECs](../../architecture/TRACEABILITY-MATRIX.md) para evidências históricas. Estados `VERIFIED` são específicos aos testes de cada requisito.

O material anterior localizou acoplamento em `Game.tick`, múltiplas autoridades de posição, risco de salto na água e cobertura oceânica inferida por um único chunk. O [checkpoint 01](FOUNDATION-01.md) confirma e trata parte desse diagnóstico. Câmera, arte da água e polimento de animações têm fases próprias.

Baseline local com alterações preexistentes de tráfego: tipagem aprovada, regressões 639/639, suíte geral 2029/2031 com falhas CT-08-04 e CT-08-06. Checkout limpo em `e58af1a`, com o código do HEAD inicial e apenas a governança adicionada: 2024/2026, falhas nos checksums Natural Earth porque `core.autocrlf=true` alterou os bytes. Atributos LF corrigidos no checkpoint 01.

Lacunas herdadas: orçamento gráfico e crescimento de memória ainda requerem medições, e documentação de SPEC anterior não equivale a validação de integração no HEAD atual.
