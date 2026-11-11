# DR-MANAUS | CI History & Verification Log

Este documento rastreia os runs oficiais de validação do GitHub Actions no repositório `PauloSoaf/Dr-Manaus` na branch `feat/universe-map`.

| Run ID | Commit SHA | Milestone | Testes Gerais | Regressões Permanentes | Status | Causa Raiz / Observações |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `42541489643` | `375584e` | U4.5.2.3 | 1.563 / 1.563 | 638 / 638 | APROVADO | Fixture do Atlas Cósmico estabilizado com `ResolvedUniversalTarget` autêntico |
| `42543820898` | `356b98e` | U4.5.3 | 1.573 / 1.573 | 638 / 638 | APROVADO | Diversidade estelar e planetária procedural, classes O-M, gravidade superficial |
| `42558085566` | `d9e777f` | U4.5.3.1 | 1.579 / 1.579 | 638 / 638 | APROVADO | Integração real de mundos procedurais ao Atlas, pouso em fotosfera, taxonomia canônica |
| `42940721868` | `d41fc2d` | U4.5.4 | 1.585 / 1.587 | 638 / 638 | FALHA | Falhas em `T_U454_07` (elipsoide direcional vs esfera) e `T_U454_08` (cota NOAA ETOPO5 5742m vs asserção >8000m) |
| `43034411855` | `3eda1ca` | U7 + Test Fix | 1.637 / 1.637 | 638 / 638 | APROVADO | 100% verde: U5, U6, U7 e normalização unitária em T_U454_07 |
| `43034426451` | `3eda1ca` | U7 + Test Fix | 1.637 / 1.637 | 638 / 638 | APROVADO | Validação concorrente aprovada (Vite 8.3.0, TypeScript 0 erros) |
| `43036032343` | `b118829` | Cosmic Hardening | 1.637 / 1.637 | 638 / 638 | APROVADO | Desacoplamento de BlackHoleDefinition, limpeza de LargeScaleStructureProvider e matriz 100% verde |
| `43036554791` | `ac307f1` | Status Documentation | 1.637 / 1.637 | 638 / 638 | APROVADO | Validação de push: build de produção, regressões permanentes e 100% verde |
| `43036567036` | `ac307f1` | Status Documentation | 1.637 / 1.637 | 638 / 638 | APROVADO | Validação de Pull Request #4 aprovada integralmente |

