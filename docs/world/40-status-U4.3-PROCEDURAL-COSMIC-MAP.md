# DR-MANAUS | Checkpoint U4.3.2 — Finalização Visual e Integridade do Mapa Cósmico

**Data:** 03 de novembro de 2026  
**Repositório:** PauloSoaf/Dr-Manaus  
**Branch:** `feat/universe-map`  
**Baseline auditado (U4.3.1):** `5c806af6abe95d84d5d1cf8a44a58173adbf33f3`  
**CI Oficial U4.3.1:** GitHub Actions Run `41585363753` (SUCCESS: Typecheck, 638/638 regressões permanentes, 1.515/1.515 testes gerais, Build Vite)  
**Patch Atual:** U4.3.2  

---

## 1. Estado Oficial e Contexto da Auditoria U4.3.1

O patch U4.3.1 foi completamente validado e aprovado no pipeline oficial do GitHub Actions:
- **Typecheck:** Aprovado
- **Regressões Permanentes:** 638/638 aprovadas
- **Testes Gerais:** 1.515/1.515 aprovados
- **Build de Produção Vite:** Aprovado

A auditoria pós-aprovação do U4.3.1 identificou três problemas de apresentação e integridade arquitetural essenciais para a preparação do trânsito U4.4:
1. **P1 — Amostragem distante assimétrica em `ProceduralGalaxyDiscovery.discoverVisibleRegion()`:**
   - O algoritmo utilizava anéis quadrados com incremento `stride` (ex.: para `zoomMpc = 120`, `spanCells = 36`, `stride = 9`). Quando `r = 10`, a iteração percorria `-10, -1, 8`, não atingindo o limite positivo `+10`.
   - O filtro que selecionava pontos com coordenada absoluta igual ao raio concentrava as amostras nas bordas negativas, enviesando a distribuição galáctica para o quadrante superior-esquerdo.
2. **P1 — Extensão da grade limitada a 16 células em `CosmologyMapRenderer`:**
   - A grade usava `spanCells = Math.min(16, ...)`. Em zoom de 120 Mpc em telas panorâmicas (aspect ratio 16:9), o viewport abrange ~30 células horizontalmente em cada direção, fazendo a grade terminar no meio do canvas.
3. **P1 — Ambiguidade de referencial no vetor de posição em `UniversalTargetResolver`:**
   - O resolvedor preenchia `logicalPosition.positionM` com a posição absoluta a partir da origem cosmológica (`cosmologicalPositionM(targetAddress)`), mas rotulava o frame como `'cosmological-relative'`.
   - Se o planejador de voo do U4.4 utilizasse esse vetor, navegaria em direção ao centro cosmológico em vez de em direção ao alvo relativo ao observador.
   - Além disso, para alvos em células com separação superior a 1024 células (~2 Gpc), a conversão de distância relativa em Float64 perde precisão no vetor direcional, exigindo salvaguarda explícita (`positionM = undefined`).
4. **Robustez e Performance:**
   - Possibilidade de `URIError` não tratado em `decodeURIComponent` para identificadores ou buscas malformadas.
   - Descoberta síncrona repetitiva no método `draw()` do mapa a cada quadro (60 FPS) mesmo sem alteração de zoom ou centro.

---

## 2. Correções Implementadas no Patch U4.3.2

### 2.1 Amostragem Quadrante-Simétrica Determinística (`ProceduralGalaxyDiscovery.ts`)
- O método `discoverVisibleRegion(centerCell, zoomMpc, maxGalaxies)` foi reformulado com particionamento rotacional concêntrico de 90°:
  - **Célula Central:** Continua sendo a prioridade número 1, garantindo que o observador sempre veja a sua galáxia e vizinhança imediata.
  - **Pontos Axiais:** Para cada anel concêntrico $r \in [1, \text{spanCells}]$, os quatro pontos sobre os eixos cardeais são avaliados em ordem simétrica ($(+r, 0), (0, +r), (-r, 0), (0, -r)$).
  - **Vértices (Cantos):** Os quatro cantos do anel quadrado são avaliados conjuntamente ($(+r, +r), (-r, +r), (-r, -r), (+r, -r)$).
  - **Amostras Intermediárias com Rotação 90°:** O perímetro restante é amostrado com passo `stride` simétrico, gerando 4-tuplas rotacionadas ($(+k, +r), (-k, +r), (-k, -r), (+k, -r)$).
- **Garantias Matemáticas:**
  - Balanço estrito entre os 4 quadrantes (diferença máxima de $\pm 1$ amostra ao atingir `maxGalaxies`).
  - Total determinismo e independência da ordem de exploração.
  - Alcance total da borda do campo visual em zoom 16, 32, 64 e 120 Mpc.
  - Densidade que decresce suavemente com a distância, sem áreas vazias assimétricas.

### 2.2 Grade Dinâmica por Viewport e Decimação Inteligente (`MapRenderers.ts`)
- `CosmologyMapRenderer.draw()` calcula a extensão da grade diretamente a partir das dimensões reais do canvas:
  - `spanCellsX = Math.ceil(halfWidth / cellPixels) + 1` (limitado a 48 células para segurança).
  - `spanCellsY = Math.ceil(halfHeight / cellPixels) + 1` (limitado a 48 células para segurança).
- **Decimação de Linhas e Rótulos:**
  - `lineStepX` / `lineStepY`: Quando as células ficam menores que 24 pixels (zoom afastado), as linhas da grade são desenhadas a cada 2 ou 4 células para evitar poluição visual.
  - `tagStepX` / `tagStepY`: As legendas numéricas BigInt utilizam orçamento independente, espaçadas a cada $\ge 64$ pixels, mantendo legibilidade sem colisão de textos.
- **Cache de Descoberta Visual:**
  - Armazena a chave da visão atual (`cachedVisibleKey = "${centerCell.x},${centerCell.y},${zoomMpc}"`).
  - Evita chamadas síncronas a `discoverVisibleRegion` a cada frame renderizado quando o mapa está estático.
- **Pan O(1):**
  - O método `pan(dx, dy)` realiza o rebase de células via divisão inteira direta ($O(1)$) em vez de acumulações sucessivas.

### 2.3 Integridade Vetorial para U4.4 (`UniversalTargetResolver.ts`)
- **Vetor Relativo Genuíno:**
  - `positionM` em `logicalPosition` recebe `sepVec` (o vetor de separação métrica real do observador até o alvo), preservando o referencial `'cosmological-relative'`.
  - Para observadores na Via Láctea, Andrômeda, Triângulo ou em qualquer célula procedural, o vetor aponta na direção correta para o planejador de navegação intergaláctica do U4.4.
- **Domínio Seguro de Conversão Float64:**
  - Para separações superiores a 1024 células cosmologicas (~2 Gpc, onde coordenadas métricas Float64 começam a perder precisão sub-quilométrica), `positionM` é configurado como `undefined`, enquanto `distanceM` fornece a ordem de grandeza da distância.
  - Isso impede formalmente que o algoritmo de rota e atitude do U4.4 tente calcular vetores de aceleração a partir de dados com precisão degradada.
- **Fronteira com U4.4 Preservada:**
  - Alvos procedurais continuam com `travelCapability: 'cosmological-future'` e bloqueio de engajamento de voo até a implementação do runtime de trânsito contínuo.

### 2.4 Blindagem contra Entradas Malformadas (`UniversalTargetCatalog.ts` e `ProceduralGalaxyDiscovery.ts`)
- Chamadas a `decodeURIComponent` foram envolvidas em blocos `try ... catch` com fallback gracioso.
- Buscas ou URLs contendo sequências percentuais inválidas (ex.: `galaxy/%E0%A4%A` malformado ou `galaxy/%99%`) não lançam exceções não tratadas, retornando `undefined` ou `null` com segurança.

---

## 3. Contratos de Precisão e Invariantes Numéricas

| Subsistema | Invariante | Garantia Matemática U4.3.2 |
| :--- | :--- | :--- |
| **Descoberta Visual** | Simetria nos 4 Quadrantes | Amostragem em 4-tuplas com rotação de 90° ($Q_1, Q_2, Q_3, Q_4$). Dispersão máxima $\le 1$ galáxia entre quadrantes. |
| **Grade Cosmológica** | Cobertura Total do Viewport | `spanCellsX` e `spanCellsY` derivados da largura e altura do canvas. Cobre 100% da área visível em 120 Mpc. |
| **Grade Cosmológica** | Prevenção de Estagnação BigInt | Linhas e rótulos iteram em inteiros relativos pequenos centrados em zero, somados a `BigInt` apenas para formatação do texto. |
| **Resolução de Posição** | Vetor de Direção Relativo | `positionM = sepVec` em `'cosmological-relative'`. Direção exata do observador para o alvo. |
| **Resolução de Posição** | Domínio Seguro Float64 | Separações $> 1024$ células retornam `positionM = undefined`, prevenindo vetores corrompidos por perda de precisão. |
| **Resolução de Alvos** | Blindagem URI | Exceções de decodificação percentual capturadas com fallback sem crash. |

---

## 4. Testes Automatizados (`tests/procedural-galaxy-map.test.ts`)

A suíte foi expandida de 9 para 11 blocos de testes unitários:

1. `T_U43_01` a `T_U43_09`:
   - Mantidos integralmente, cobrindo determinismo, BigInt extremo, cache LRU, limites de região, catálogo, viagens futuras, buscas, renderizadores e contratos de streaming.
2. `T_U43_10_QUADRANT_SYMMETRIC_DISTANT_DISCOVERY`:
   - Valida a simetria de distribuição galáctica nos 4 quadrantes para zoom de 16, 32, 64 e 120 Mpc.
   - Comprova que todos os 4 quadrantes recebem amostras proporcionais.
   - Assegura que a célula central sempre receba prioridade.
   - Verifica que galáxias distantes na borda externa do campo (alcance $> 25$ células em 120 Mpc) sejam descobertas.
3. `T_U43_11_COSMOLOGICAL_TARGET_POSITION_AND_OBSERVER_FRAMES`:
   - Valida que `logicalPosition.positionM` é o vetor relativo observador $\rightarrow$ alvo (ex.: alvo com $\Delta x > 0$ possui `positionM.x > 0`).
   - Valida resolução precisa com observador em Andrômeda e em células cósmicas procedurais distantes.
   - Valida que para separações $> 1024$ células, `positionM` é `undefined` de forma segura, com `distanceM` finito.
   - Valida resistência a identificadores malformados com sequências hexadecimais inválidas em `decodeURIComponent`.

---

## 5. Arquivos Alterados no Patch U4.3.2

| Arquivo | Estado | Mudanças no U4.3.2 |
| :--- | :--- | :--- |
| `src/world/galaxy/ProceduralGalaxyDiscovery.ts` | Modificado | Amostragem quad-simétrica concêntrica em `discoverVisibleRegion`; blindagem de URI em `parseGalaxyId`. |
| `src/ui/map/MapRenderers.ts` | Modificado | Extensão da grade baseada em viewport real (`spanCellsX`, `spanCellsY`); decimação de linhas e rótulos; cache de descoberta visual; pan $O(1)$. |
| `src/world/travel/UniversalTargetResolver.ts` | Modificado | Vetor relativo `sepVec` em `positionM`; salvaguarda para separações $> 1024$ células; suporte a observador em Andrômeda/Triângulo/células distantes. |
| `src/world/travel/UniversalTargetCatalog.ts` | Modificado | Blindagem de `decodeURIComponent` em `find()`. |
| `tests/procedural-galaxy-map.test.ts` | Modificado | Adicionados testes `T_U43_10` (simetria espacial) e `T_U43_11` (vetores relativos e frames de observador). |
| `docs/world/15-status.md` | Modificado | Atualização do status consolidado com U4.3.2 como checkpoint atual. |
| `docs/world/40-status-U4.3-PROCEDURAL-COSMIC-MAP.md` | Modificado | Relatório técnico completo de auditoria e resolução do patch U4.3.2. |

---

## 6. Roteiro de Validação Visual (Operador Humano)

Para verificar as melhorias no ambiente local (com servidor de desenvolvimento ativo na porta `9999`):
1. **Abrir a Aplicação:** Acesse `http://localhost:9999/` no navegador.
2. **Abrir o Mapa Universal:** Pressione a tecla `M` para abrir o painel do mapa universal.
3. **Acessar a Aba Cosmos:** Clique na aba **"Cosmos"** na barra superior do mapa.
4. **Verificar Extensão da Grade em Zoom Máximo:**
   - Use a roda do mouse para afastar o zoom até o limite máximo (120 Mpc).
   - Observe que as linhas da grade e os rótulos de coordenadas agora se estendem por todo o viewport (esquerda, direita, topo e rodapé), sem cortes prematuros nas margens.
5. **Verificar Simetria e Distribuição nos 4 Quadrantes:**
   - Com o zoom em 120 Mpc e 64 Mpc, observe a distribuição dos marcadores de galáxias procedurais.
   - Verifique que existem galáxias distribuídas uniformemente pelos quatro quadrantes (superior-esquerdo, superior-direito, inferior-esquerdo e inferior-direito), com a célula central destacada.
6. **Arrastar o Mapa (Panning):**
   - Clique e arraste o mapa em todas as direções (esquerda, direita, cima, baixo).
   - Verifique a suavidade da transição de coordenadas de células no centro e nos eixos.
7. **Seleção de Galáxia Procedural:**
   - Clique diretamente sobre qualquer galáxia procedural distante.
   - Verifique que o cartão lateral exibe: nome gerado (ex.: *Cosmic Discovery DM-PG-...*), morfologia de Hubble (ex.: *Spiral Sa*, *Elliptical E3*), coordenadas cosmológicas de célula e distância estimada.
8. **Travamento no HUD e Bloqueio de Viagem:**
   - Feche o mapa (`M`).
   - Verifique no HUD que o alvo procedural permanece selecionado com sua distância correta.
   - Pressione a tecla de viagem intergaláctica ou engate de hipercruzeiro: confirme que a viagem permanece bloqueada com o aviso de U4.4 (*"Navegação intergaláctica procedural disponível em U4.4"*).
9. **Manutenção do Grupo Local:**
   - Abra o mapa novamente (`M`), selecione Andrômeda e confirme que a navegação e seleção canônica permanecem 100% operacionais.

---

## 7. Fronteira e Bloqueios Rigorosos

- **U4.3.2 (Concluído neste patch):** Mapa cosmológico estético, distribuição galáctica simétrica multiescala, grade responsiva em todo o viewport, integridade vetorial de alvo e robustez contra entradas inválidas.
- **U4.4 (Próxima fase - bloqueada):** O trânsito de hipercruzeiro intergaláctico contínuo e a materialização progressiva de galáxias procedurais em GPU só devem ser iniciados após a aprovação formal do U4.3.2 no CI.
- **BH0–BH2:** Buracos negros relativísticos e horizontes permanecem estritamente bloqueados.
