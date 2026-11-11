# DR-MANAUS | CI History & Verification Log

Este documento rastreia os runs oficiais de validação do GitHub Actions no repositório `PauloSoaf/Dr-Manaus` na branch `feat/universe-map`.

| Run ID | Commit SHA | Milestone | Testes Gerais | Regressões Permanentes | Status | Causa Raiz / Observações |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `42541489643` | `375584e` | U4.5.2.3 | 1.563 / 1.563 | 638 / 638 | APROVADO | Fixture do Atlas Cósmico estabilizado com `ResolvedUniversalTarget` autêntico |
| `42543820898` | `356b98e` | U4.5.3 | 1.573 / 1.573 | 638 / 638 | APROVADO | Diversidade estelar e planetária procedural, classes O-M, gravidade superficial |
| `42558085566` | `d9e777f` | U4.5.3.1 | 1.579 / 1.579 | 638 / 638 | APROVADO | Integração real de mundos procedurais ao Atlas, pouso em fotosfera, taxonomia canônica |
| `42940721868` | `d41fc2d` | U4.5.4 | 1.585 / 1.587 | 638 / 638 | FALHA | Falhas em `T_U454_07` (elipsoide direcional vs esfera) e `T_U454_08` (cota NOAA ETOPO5 5742m vs asserção >8000m) |
| *Pendente* | `c48fc64` | U4.5.4.1 | 1.587 / 1.587 (proj.) | 638 / 638 | EM EXECUÇÃO | Hotfix U4.5.4.1: asserções alinhadas ao elipsoide direcional e autoridade NOAA ETOPO5 |
