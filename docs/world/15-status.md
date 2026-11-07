# Planetary architecture — implementation status

## Current checkpoint — U4.4.9 Recuperação das Regressões U2/U3 e Reutilização Correta de Sessões (2026-11-07)

Baseline auditado do U4.4.8 no commit `60eff2731fb61d82f4dbcd5ca7841283c41477b9` passou no TypeScript, mas reprovou no gate permanente de regressões (GitHub Actions Run `42394939637`: 627/638 aprovadas, 11 falhas em transições U2/U3 por `Conflito de provider: "galaxy/star-sectors" já registrado por outra instância`). O patch U4.4.9 restaura a equivalência de identidade das sessões canônicas, preserva a segurança contra colisões e restabelece as 11 regressões:
1. `GalaxyDefinition.ts` e `GalaxyRuntime.ts`:
   - Implementada a função `isCanonicalGalaxyId(id)` para distinguir galáxias canônicas (`milky_way`, `andromeda`, etc.) de galáxias procedurais.
   - `GalaxyRuntime` mantém `universeSeed = undefined` para galáxias canônicas e preserva suas instâncias singleton em `clearGalaxyRuntimes()`.
   - Implementada `sameGalaxyIdentity(runtime, id, universeSeed)`: retorna `true` para a mesma entidade canônica independentemente da `universeSeed` informada na chamada, e compara a semente universal efetiva para galáxias procedurais.
2. `GalaxyMaterializer.ts` e `StarSectorProvider.ts`:
   - `GalaxyMaterializer.prepare()` reutiliza a sessão ativa somente quando `old?.ready && sameGalaxyIdentity(old.galaxy, id, universeSeed)`, impedindo a criação duplicada de `StarSectorProvider` para `milky_way` e `andromeda` quando `ProceduralSystemMaterializer.prepare()` repassa `DEFAULT_UNIVERSE_SEED`, e bloqueando o reuso de sessões descartadas (`!old.ready`).
   - O handle de sessão reutilizada valida `old.ready` e `this.current === old` em `install()` e `activate()`.
   - Mantida intacta a proteção contra colisão de provedores não autorizados em `GalaxyMaterializer.install()`.
3. `UniversalTravelPlan.ts` e `GalaxyCoordinates.ts`:
   - `sameSystem()`, `travelAnchor()`, `createTravelPlan()` e `addressSeparationM()` respeitam `isCanonicalGalaxyId`: galáxias canônicas nunca são artificialmente diferenciadas por sementes, enquanto galáxias procedurais exigem correspondência estrita de `universeSeed` (sem atalhos por `undefined` parcial).
4. `tests/procedural-travel.test.ts`:
   - `T_U44_25`: contrato completo de reutilização de sessões (Via Láctea com seed explícita, Andrômeda sob outra seed, procedural Seed A $\rightarrow$ Seed A, procedural Seed A $\rightarrow$ Seed B, rejeição de sessão descartada e bloqueio de colisão de provider não autorizado).
   - `T_U44_26`: regressão de Hypercruise (Terra $\rightarrow$ Andrômeda, Via Láctea $\rightarrow$ sistema procedural $\rightarrow$ Sol, 5 ciclos completos sem vazamento de providers/frames/roots, rollback de ativação com retry e invariância de `sameSystem`).
Evidence: [41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md](41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md).

## Previous checkpoint — U4.4.8 Correção dos 3 Testes e Integridade Transacional (2026-11-07)

Baseline auditado do U4.4.7 no commit `13452196b3cef9c82688e3091a5121a88b29ced8` ultrapassou com sucesso a compilação TypeScript e a suíte de 638 regressões permanentes, reprovando em 3 testes específicos do U4.4 (GitHub Actions Run `42392441997`: 1.538/1.541 aprovados). O patch U4.4.8 corrige os três testes respeitando a integridade dos contratos de runtime, blinda o registro de provedores e fecha a diferenciação de sementes nos planos de viagem:
1. `tests/procedural-travel.test.ts`:
   - `T_U44_17`: adicionados os imports faltantes `registerProceduralGalaxyDefinition`, `GalaxyRuntime` e `type GalaxyDefinition`, sanando o `ReferenceError`.
   - `T_U44_23`: o alvo galáctico de destino sob Seed B agora é resolvido via `GalaxyEntryResolver.resolve()` antes da preparação em `ProceduralSystemMaterializer.prepare()`, fornecendo o `systemId` exigido pelo contrato do materializador.
   - `T_U44_24`: inicialização da galáxia de origem sob Seed A através do fluxo real de materialização (`ProceduralSystemMaterializer.install()`), garantindo o alinhamento de `universe.address.galaxyId` antes da ativação e planejamento de rota.
2. `GalaxyMaterializer.ts`:
   - Guarda estrita em `install()`: se já existir um provedor registrado com o mesmo ID mas for uma instância diferente (`existing !== sectors`), lança erro explícito de conflito de provider em vez de ignorar silenciosamente.
3. `UniversalTravelPlan.ts` e `UniversalTravelController.ts`:
   - `TravelAnchor` agora inclui `universeSeed?: bigint`.
   - `sameSystem()` agora avalia opcionalmente `seedA` e `seedB`, tratando galáxias com mesmo ID mas sob sementes distintas como domínios intergalácticos e prevenindo atalhos incorretos de `same-system`.
   - Avaliação de domínio (`interstellar` vs `intergalactic`) em `createTravelPlan()` agora exige correspondência da `universeSeed`.
Evidence: [41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md](41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md).

## Previous checkpoint — U4.4.7 Desbloqueio do CI e Segurança Transacional dos Providers (2026-11-07)

Baseline auditado do U4.4.6 no commit `491d6a429d09e33f9bc4785e8d4b4adbf803a470` reprovou no CI oficial (GitHub Actions Run `42054100700`: 6 erros TS2448/TS2454 em `ProceduralSystemMaterializer.ts` pelo uso da variável `u` antes de sua declaração em `returnToSolar()`). O patch U4.4.7 corrige a compilação, elimina o risco de colisão de provedores em trocas multissemente e fecha os contratos de rota:
1. `ProceduralSystemMaterializer.ts`:
   - Corrigida a ordem de inicialização em `returnToSolar()`: declaração de `const u = this.universe` realizada antes de qualquer referência a `u`, sanando integralmente os erros TS2448/TS2454.
2. `StarSectorProvider.ts` e `GalaxyMaterializer.ts`:
   - Função `starSectorProviderId(galaxyId, universeSeed)` implementada para qualificar o ID de provedores procedurais com a semente universal (`galaxy/star-sectors/${galaxyId}/${universeSeed.toString(16)}`), mantendo IDs canônicos para a Via Láctea (`galaxy/star-sectors`) e Andrômeda (`galaxy/star-sectors/andromeda`).
   - Elimina qualquer colisão em `ProviderRegistry.register()` durante trocas de galáxias com mesma chave nominal e sementes diferentes, viabilizando o commit em duas fases e o rollback atômico com preservação do provedor original.
   - `GalaxyMaterializer.install()` valida com segurança a presença do provedor antes do registro.
3. `GalaxyCoordinates.ts` e `UniversalTravelPlan.ts`:
   - `addressSeparationM()` expandido com suporte a `AddressSeparationOptions` (`{ originSeed, destinationSeed }`), permitindo que a métrica de rota, coordenadas cosmológicas e offsets locais de origem e destino sejam avaliados sob suas respectivas autoridades de semente.
4. `tests/procedural-travel.test.ts`:
   - `T_U44_22`: instrumentado com validação de distância no proxy esférico de 20 km, normalização estrita de quaternion e teste de independência absoluta contra mutações de catálogo em segundo plano.
   - `T_U44_23`: reforçado com checkpoints de instrumentação em cada fase (`prepare`, `install`, `activation`, `rollback`), comprovação de que a falha simulada ocorre especificamente na ativação sem bloqueio por colisão de IDs, verificação de preservação do provedor e cena original pós-rollback, e validação de troca bem-sucedida com aposentadoria controlada do provedor anterior.
   - `T_U44_24`: teste determinístico de cálculo de distância e duração de viagem entre universos procedurais com sementes distintas.
Evidence: [41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md](41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md).

## Previous checkpoint — U4.4.6 Correção do CI e Fechamento do Contrato Multissemente (2026-11-05)

Baseline auditado do U4.4.5 no commit `9d52c851dad6c482eb4cc63bf7379f95a69ee3d2` reprovou no CI oficial (GitHub Actions Run `41692307028`: dois erros TS2300 em `UniverseRuntime.ts` por import duplicado de `ProceduralSystemRuntime`). O patch U4.4.6 corrigiu o bloqueio de compilação e fechou os contratos de propagação de semente e integridade espacial.
1. `UniverseRuntime.ts`:
   - Remoção do import duplicado de `ProceduralSystemRuntime`, sanando os erros TS2300.
   - O getter `location.cosmological` agora consulta prioritariamente a morfologia cosmológica da galáxia ativa (`this.activeGalaxy.definition.proceduralMorphology?.cosmologicalAddress`) ou repassa `this.activeGalaxy.universeSeed` a `galaxyCosmologicalAddress()`, blindando as coordenadas cosmológicas contra poluição por consultas de catálogo de fundo.
2. `GalaxyProvider.ts` e `GalaxyMaterializer.ts`:
   - `GalaxyProviderOptions` e método `update()` agora recebem e preservam o contexto `universeSeed`.
   - `GalaxyMaterializer.prepare()` instancia `GalaxyProvider` com `universeSeed` contextual da galáxia ativa, e `GalaxyMaterializer.update()` repassa `session.galaxy.universeSeed` para cálculo consistente de posição do observador, delta intergaláctico e orientação de galáxias externas.
3. `ProceduralSystemMaterializer.ts`:
   - Captura estrita da semente de origem (`originSeed = u.activeGalaxy.universeSeed ?? ...`) no snapshot pré-commit de `install()`, `prepareTravel()` e `returnToSolar()`.
   - Rollback transacional repassa deterministicamente a semente original do snapshot a `u.restoreSystem()`, garantindo que falhas parciais durante a materialização não restaurem a sessão com a semente do destino.
4. `UniversalTravelPlan.ts`:
   - `travelAnchor()` aceita `universeSeed?: bigint` e contextualiza `observerGlobalPositionM()`.
   - `createTravelPlan()` vincula a `originSeed` da galáxia ativa ao anchor de origem e a `uSeed` do catálogo de destino ao anchor de chegada, mantendo a coerência da rota.
5. `tests/procedural-travel.test.ts`:
   - `T_U44_21`: valida estabilidade de `UniverseRuntime.location` e morfologia da galáxia ativa após consultas de fundo a catálogos com sementes estrangeiras, além do retorno seguro ao Sol.
   - `T_U44_22`: valida a correta orientação e posicionamento visual em `GalaxyProvider` sob diferentes sementes universais.
   - `T_U44_23`: valida rollback de emergência mantendo com exatidão a semente universal da galáxia de origem e seu sistema estelar.
Evidence: [41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md](41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md).

## Previous checkpoint — U4.4.5 Correção do CI e da Identidade Multissemente (2026-11-03)

Baseline auditado do U4.4.4 no commit `6beec63c57675eccb0fa270862354885b97a3671` reprovou no CI oficial (GitHub Actions Run `41679047476`: erro TS2322 em `GalaxyEntryResolver.ts`). O patch U4.4.5 corrigiu o narrowing estrito de tipos, eliminou a confusão conceitual entre `universeSeed` e `galaxySeed` e alinhou materialização, runtimes e setores estelares.
1. `GalaxyEntryResolver.ts`:
   - Correção do erro TS2322 via narrowing defensivo estrito distinguindo explicitamente os 3 estados do cache de entrada: ausente (`undefined`), falha determinística (`null`) e sucesso (`ProceduralTargetDescriptor`).
2. `GalaxyCoordinates.ts`, `GalaxyRuntime.ts` e `GalaxyDefinition.ts`:
   - Separação formal e imutável entre a semente universal (`universeSeed`) e a semente derivada da galáxia (`galaxySeed = descriptor.seed`).
   - `GalaxyDefinition` e `GalaxyRuntime` preservam a propriedade `universeSeed`.
   - Caches de definições e runtimes indexados consistentemente por `(universeSeed, id)`, eliminando perda de cache e regeneração desnecessária.
   - `GalaxyRuntime.generateSector()` repassa deterministicamente a semente universal correta para `generateStarSector`, e não a semente derivada.
3. `StarSectorProvider.ts`, `GalaxyMaterializer.ts`, `ProceduralSystemMaterializer.ts` e `UniverseRuntime.ts`:
   - Propagação de `universeSeed` por todo o pipeline de streaming, materialização e commit de sistemas: a sessão preparada preserva sua semente e morfologia mesmo se consultas de fundo a catálogos com outras sementes ocorrerem durante o voo.
4. `tests/procedural-travel.test.ts`:
   - `T_U44_17`: reformulado com fixture determinística estrita (sem depender de aleatoriedade na população das primeiras galáxias descobertas), verificando busca inicial, cache negativo e 100 queries subsequentes com 0 gerações estelares.
   - `T_U44_18`: reforçado com asserções de reuso exato de instâncias em cache quente sob a mesma `universeSeed` e isolamento morfológico por setor.
   - `T_U44_20`: reforçado com verificação de integridade da população estelar e retenção exata da `universeSeed` na chegada.
Evidence: [41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md](41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md).

## Previous checkpoint — U4.4.4 Hardening de Performance e Integridade da Viagem (2026-11-03)

Baseline auditado do U4.4.3 no commit `cc07b1c04b97d665c353b8c8d58513986494d6ca` aprovado integralmente no CI oficial (GitHub Actions Run 41662450492: Typecheck SUCCESS, 638/638 regressões permanentes, 1.533/1.533 testes gerais, build Vite em 1,28s). O patch U4.4.4 implementou o desacoplamento de busca de setores no loop de HUD/renderização e cache negativo.

## Previous checkpoint — U4.4.3 Desbloqueio do CI e Integridade de Seeds (2026-11-03)

Baseline auditado do U4.4.2 no commit `d08159e33d528252622d3f7347987c66de2bd044` reprovou no CI oficial (GitHub Actions Run 41659664895) com erro TS2304 em `UniversalTargetCatalog.ts` (`Cannot find name 'LOCAL_GROUP_CATALOG'`). O patch U4.4.3 corrigiu a compilação e foi aprovado integralmente no GitHub Actions Run 41662450492 (1.533/1.533 testes).
1. `UniversalTargetCatalog.ts`:
   - Restaurado o import de `LOCAL_GROUP_CATALOG` de `../celestial/GalaxyDefinition`, eliminando o bloqueio de compilação TS2304.
   - Sincronização automática de semente: método `syncSeed()` ativa deterministicamente a semente da descoberta em `find()`, `resolve()`, `proceduralDescriptor()` e `proceduralTarget()`.
2. `GalaxyCoordinates.ts`, `GalaxyRuntime.ts` e `GalaxyEntryResolver.ts`:
   - Padrão de observador desacoplado `onProceduralUniverseSeedChanged`: alterações de semente ativam invalidação síncrona de `proceduralGalaxyDefinitions`, `clearGalaxyRuntimes()` e `clearGalaxyEntryCache()`.
   - Elimina qualquer risco de reaproveitamento incorreto de morfologias entre sementes distintas (Seed A $\rightarrow$ Seed B $\rightarrow$ Seed A), preservando as galáxias canônicas da Via Láctea e Andrômeda.
3. `GalaxyEntryResolver.ts` e `UniversalTargetResolver.ts`:
   - Cache delimitado $O(1)$ de resoluções de entrada em `resolvedEntryCache` com limpeza automática em mudança de semente.
   - `UniversalTargetResolver` agora valida a existência real de sistema de entrada via `hasProceduralGalaxyEntry(t.galaxyId, this.catalog)` antes de marcar `capability = 'intergalactic'`, evitando indicar hypercruise disponível para alvos que falhariam no planejamento de rota.
4. `tests/procedural-travel.test.ts`:
   - `T_U44_03`: asserção calibrada para respeitar formalmente o teto de 2.000 estrelas por setor (`Math.min(2000, ...)`).
   - `T_U44_15`: validação mista em região de galáxias procedurais, comprovando que sistemas resolvidos cumprem todos os requisitos de planetas rochosos pousáveis e galáxias sem entrada produzem erro controlado.
   - `T_U44_16`: teste exaustivo de ciclo Seed A $\rightarrow$ Seed B $\rightarrow$ Seed A com duas instâncias de catálogo, comprovando invalidação e regeneração fiel de parâmetros e integridade das galáxias canônicas.
Evidence: [41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md](41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md).

## Previous checkpoint — U4.4.2 Correção do CI e Integridade da Viagem Procedural (2026-11-03)

Baseline auditado do U4.4.1 no commit `e46d10d29ae6789ba7c7e7d47d19d30e935d3352` reprovou no CI oficial (GitHub Actions Run 41653156652) com dois erros TS2305 em `GalaxyCoordinates.ts`. O patch U4.4.2 corrige a raiz do bloqueio de compilação e implementa o reforço dos contratos de densidade estelar, coordenadas cosmológicas ativas, métrica de separação e segurança de entrada procedural:
1. `GalaxyCoordinates.ts`:
   - Correção dos imports de `parseGalaxyId` e `DEFAULT_UNIVERSE_SEED` provenientes de `./ProceduralGalaxyDiscovery`.
   - Sincronização explícita de autoridade de semente (`setProceduralUniverseSeed`, `getProceduralUniverseSeed`, `clearProceduralGalaxyDefinitions`) eliminando discrepâncias morfológicas entre catálogo e coordenadas.
   - Cálculo métrico de separação intergaláctica `addressSeparationM(a, ao, b, bo)` estendido para considerar os deslocamentos locais tridimensionais no sistema de saída e sistema de chegada (`localA` e `localB`), respeitando setor, offset submétrico e orientação intrínseca de ambas as galáxias ($\vec{r}_{total} = \vec{r}_{sep} + \vec{r}_{localB} - \vec{r}_{localA}$).
2. `StarSector.ts`:
   - Eliminação da duplicação de escala de densidade estelar em `generateStarSector`: `evaluateProceduralDensity` já incorpora intrinsecamente `descriptor.densityScale`. O gerador agora aplica unicamente o modificador opcional por setor (`options.densityScale`), preservando a normalização física de `STARS_PER_SECTOR_BASE`.
3. `UniverseRuntime.ts`:
   - `location.cosmological` atualizado para utilizar a autoridade `galaxyCosmologicalAddress(this.activeGalaxy.id)`: Andrômeda passa a reportar com fidelidade suas coordenadas cosmológicas reais (`localMpc: [0, 0.767, 0]`), preservando a Via Láctea (`[0, 0, 0]`), Triângulo e galáxias procedurais ativas.
4. `GalaxyEntryResolver.ts`:
   - Resolução determinística ampliada para 13 setores estratégicos (eixos cardeais a ~20% do raio galáctico, diagonais simétricas e núcleo central).
   - Reforço do contrato de exploração segura: rejeição estrita de estrelas sem planetas (`planetCount <= 0`) e garantia de corpos sólidos com superfície passível de pouso (`canLand`), lançando erro controlado se nenhum sistema satisfizer os requisitos em vez de fabricar destinos fictícios.
5. `UniversalTargetCatalog.ts` e `ProceduralGalaxyDiscovery.ts`:
   - Implementado método `getGalaxyDefinition` em `ProceduralGalaxyDiscovery` e registro imediato de definições descobertas em `registerProceduralGalaxyDefinition`, unificando a autoridade de dados do catálogo e das coordenadas.
6. `tests/procedural-travel.test.ts`:
   - Tipagem estrita completa das fixtures sem uso de `any`.
   - Suíte expandida para 16 testes abrangendo asserções de telemetria cosmológica em Andrômeda, validação unitária de ausência de dupla escala de densidade, sensibilidade métrica a offsets locais e validação de chegada segura em galáxias espirais, barradas, elípticas e irregulares com sementes customizadas.
Evidence: [41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md](41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md).

## Previous checkpoint — U4.4.1 Viagem Real para Galáxias Procedurais (2026-11-03)

Baseline auditado do U4.3.2 no commit `b842cc8020779e90eac51366289766db63bb4e51` aprovado integralmente no GitHub Actions Run 41641242398 (Typecheck SUCCESS, 638/638 regressões permanentes, 1.517/1.517 testes gerais, build Vite aprovado em 1.13s). O patch U4.4.1 estabelece a primeira rota vertical completa de viagem intergaláctica para galáxias procedurais com retorno seguro ao Sol:
1. `GalaxyCoordinates.ts` e `GalaxyRuntime.ts`:
   - Registro dinâmico de `GalaxyDefinition` e `GalaxyRuntime` para galáxias procedurais a partir do gerador procedural (`ProceduralGalaxyGenerator`), com preservação formal das identidades canônicas da Via Láctea e Andrômeda.
   - Cache delimitado LRU de definições e runtimes, garantindo determimismo e ausência de vazamento de memória sob exploração massiva.
   - Cálculo de separação intergaláctica cosmológica em `addressSeparationM(a, ao, b, bo)` utilizando `cosmologicalSeparationVectorM`. Delimitação segura: distâncias superiores a 1024 células cósmicas (~2 Gpc) retornam `undefined` impedindo planejamento de voo com coordenadas imprecisas.
2. `StarSector.ts`:
   - Integração de morfologia procedural em `generateStarSector()`: densidade de estrelas agora avalia `evaluateProceduralDensity(galDef.proceduralMorphology, galacticCentrePosM) * densityScale` quando a galáxia possui morfologia gerada (bulbo, barra, disco e braços espirais), em vez de recorrer ao perfil da Via Láctea.
3. `GalaxyEntryResolver.ts`:
   - Implementada resolução determinística de sistema de entrada `proceduralGalaxyEntryDescriptor(galaxyId, catalog)`: busca ordenada em raio de 20% do disco galáctico por sistemas com estrelas de sequência principal e planetas rochosos passíveis de pouso.
   - Resolução em `GalaxyEntryResolver.resolve()` convertendo alvos galácticos procedurais em alvos estelares de entrada.
4. `UniversalTargetCatalog.ts` e `UniversalTargetResolver.ts`:
   - `proceduralDescriptor` estendido para gerar e resolver sistemas em qualquer galáxia procedural conhecida.
   - Alvos galácticos procedurais alcançáveis ($\le 1024$ células) promovidos de `'cosmological-future'` para a capacidade de viagem real `'intergalactic'`.
5. `UniverseRuntime.ts`:
   - `location.cosmological` atualizado para reportar o endereço cosmológico real da galáxia ativa do jogador.
6. `ProceduralSystemMaterializer.ts` e `GalaxyMaterializer.ts`:
   - Handoff transacional e ciclo completo de materialização/instalação/descarte sem duplicidade de provedores nem vazamentos durante viagens repetidas.
   - Retorno seguro ao Sistema Solar via `prepareSolarReturn()`.
7. `tests/procedural-travel.test.ts`:
   - Nova suíte com 14 testes cobrindo registro dinâmico, morfologia estelar, destino de entrada, plano de rota, transações atômicas, segurança de chegada, retorno ao Sol, cancelamento/retomada, rollback em falhas, limites BigInt e integridade de HUD.
Evidence: [41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md](41-status-U4.4-PROCEDURAL-GALAXY-TRAVEL.md).

## Previous checkpoint — U4.3.2 Finalização Visual e Integridade do Mapa Cósmico (2026-11-03)

Baseline auditado do U4.3.1 no commit `5c806af6abe95d84d5d1cf8a44a58173adbf33f3` aprovado integralmente no GitHub Actions Run 41585363753 (Typecheck SUCCESS, 638/638 regressões permanentes, 1.515/1.515 testes gerais, build Vite aprovado). O patch U4.3.2 finaliza o mapa cósmico com integridade espacial, simetria e robustez vetorial para a fase U4.4:
1. `ProceduralGalaxyDiscovery.ts`:
   - Amostragem 4-quadrantes simétrica em `discoverVisibleRegion()`: reformulada com anéis concêntricos subdivididos em níveis ordenados (axial, cantos e intermediários) com simetria rotacional de 90°, eliminando o truncamento de bordas positivas (+x, +y) e garantindo distribuição homogênea em escalas de 16 a 120 Mpc.
   - Proteção estrita contra erros de decodificação de URI em `parseGalaxyId()`.
2. `MapRenderers.ts` (`CosmologyMapRenderer`):
   - Extensão da grade cosmológica calculada dinamicamente a partir das dimensões reais da viewport (`spanCellsX` e `spanCellsY`), cobrindo o canvas até as bordas mesmo em zoom máximo de 120 Mpc.
   - Orçamento e decimação independente: linhas e rótulos decimados sob zoom distante (`stepX`, `stepY`) para preservar legibilidade sem poluição visual.
   - Cache de resultados de descoberta por chave de visualização (`centerCell` + `zoomMpc`), eliminando chamadas repetitivas de descoberta em quadros ociosos, e cálculo $O(1)$ de deslocamento de células em pan.
3. `UniversalTargetResolver.ts`:
   - Alinhamento de referencial vetorial: `logicalPosition.positionM` no frame `cosmological-relative` agora expressa estritamente o vetor relativo de separação do observador até o alvo (`sepVec`), em vez da posição absoluta cosmológica em relação à origem (0,0,0).
   - Suporte a observadores em referenciais locais do Grupo Local (Via Láctea `[0,0,0]`, Andrômeda `[0, 0.767, 0]` Mpc, Triângulo `[0, 0.84, 0]` Mpc) e coordenadas cosmológicas arbitrárias.
   - Para distâncias superiores ao domínio seguro Float64 (> 1024 células / ~2 Gpc), `positionM` retorna explicitamente `undefined` enquanto `distanceM` fornece a aproximação em ordem de magnitude, impedindo que o planejador de viagem do U4.4 tente vetorizações incorretas.
4. `UniversalTargetCatalog.ts`:
   - Proteção de `decodeURIComponent` em `find(query)` contra entradas malformadas.
5. `tests/procedural-galaxy-map.test.ts`:
   - Adicionados testes `T_U43_10` (simetria espacial dos 4 quadrantes em 16, 32, 64 e 120 Mpc) e `T_U43_11` (integridade de posição relativa, observadores em múltiplos referenciais e proteção contra entradas malformadas).
Evidence: [40-status-U4.3-PROCEDURAL-COSMIC-MAP.md](40-status-U4.3-PROCEDURAL-COSMIC-MAP.md).

## Previous checkpoint — U4.3.1 Correção de CI e Integração Funcional do Mapa Cosmológico (2026-11-03)

Baseline auditado do U4.3 no commit `0dc9c0070ece4bb9548dd6807dca7647ab31a21f` reprovou no GitHub Actions Run 41580919276 com três erros TS2339 (`Property 'cosmological' does not exist on type 'StreamingContext'`). Sanado no commit `5c806af6abe95d84d5d1cf8a44a58173adbf33f3` com aprovação integral no Run 41585363753 (638/638 regressões, 1.515/1.515 testes gerais, build Vite aprovado).
Evidence: [40-status-U4.3-PROCEDURAL-COSMIC-MAP.md](40-status-U4.3-PROCEDURAL-COSMIC-MAP.md).

## Previous checkpoint — U4.2.3 Estabilização do CI e Validação Morfológica (2026-11-03)

Baseline at `4d6823424e3e2a79d1d9b1ff435392691d7c950c` (U4.2.2). Resolução das falhas estatísticas e de cache:
1. `T_U42_02_MORPHOLOGY_DEPENDENT_DISTRIBUTION`: asserção corrigida para refletir a concentração planar no disco galáctico (>= 90% em |Y| <= 0.25, RMS vertical < 0.15) permitindo a presença física do halo esferoidal externo.
2. `T_U421_01_CACHE_IDENTITY_COLLISION_RESISTANCE_AND_LRU`: distinção entre a Via Láctea canônica na célula (0,0,0) (semente fixa imutável 0x4d494c4b59574159n) e células procedurais, comprovando diferenciação por semente, parâmetros morfológicos e evicção LRU.
Aprovado integralmente no GitHub Actions Run 41577361396: Typecheck SUCCESS; 638/638 regressões permanentes; 1.506/1.506 testes gerais; build de produção Vite SUCCESS. Publicado no commit `9fab30fcd114170d4ac3754cadc13dbab9166730`.
Evidence: [39-status-U4.2-GPU-GALAXY-RENDERING.md](39-status-U4.2-GPU-GALAXY-RENDERING.md).

## Previous checkpoint — U4.2.1 Correção do CI, Hardening de Materiais TSL e Alocação Sob Demanda de Galáxias (2026-11-02)

Baseline at `b2f52dd44a32662759902e3aee5255a7b6174156` (U4.2, CI falhou em TS2322). Implementadas as correções de integridade arquitetural e de tipos para renderização visual GPU:
1. Resolução definitiva do TS2322 em `GalaxyMorphologyRenderer.ts` encapsulando cores com TSL `color(...)` em nós nodais.
2. Adoção de `PointsNodeMaterial` com conexão efetiva dos atributos de buffer `size` e `dust` via nós de sombreamento GPU (`sizeNode`, `colorNode`, `opacityNode`), suportando variações contínuas de diâmetro e luminosidade estelar com extinção de poeira equatorial em um único draw call.
3. Alocação progressiva sob demanda (lazy LOD): LOD0 (impostor mínimo) construído inicialmente, com LOD1 e LOD2 gerados estritamente na transição de aproximação, impedindo alocação antecipada de buffers de partículas.
4. Propagação bidirecional de presets de qualidade (`Low`, `Medium`, `High`, `Ultra`) a partir de `RendererManager` e `Game.applySettings` através de `GalaxyMaterializer` e `GalaxyProvider`.
5. Projeção angular LOD recalculada com FOV vertical efetivo da câmera (padrão 58°) e dimensões reais da viewport, com tratamento de observador interno ao envelope forçando LOD2.
6. Blindagem de identidade de cache com `buildPointCloudCacheKey` incorporando versão do gerador `v2`, semente BigInt e parâmetros morfológicos, e política de capacidade máxima LRU (16 entradas) com descarte GPU.
5 novos testes de contrato (totalizando 13 testes em `tests/galaxy-morphology-renderer.test.ts`). U4.2.1 pronto para validação em pipeline (não registrado como aprovado antes do CI). U4.3 (mapa/gameplay) e BH0-BH2 permanecem bloqueados.
Evidence: [39-status-U4.2-GPU-GALAXY-RENDERING.md](39-status-U4.2-GPU-GALAXY-RENDERING.md).

## Previous checkpoint — U4.2 Renderização Visual GPU de Galáxias Procedurais e Arquitetura Multi-Escala TSL (2026-11-02)

Commit `b2f52dd44a32662759902e3aee5255a7b6174156`. Implementou componentes de GPU e 3 níveis de detalhe multi-escala, mas reprovado no GitHub Actions Run 41395945582 devido a erro de compilação TS2322 em `GalaxyMorphologyRenderer.ts:208` (`colorNode = coreColor`). Substituído e sanado pelo patch U4.2.1.
Evidence: [39-status-U4.2-GPU-GALAXY-RENDERING.md](39-status-U4.2-GPU-GALAXY-RENDERING.md).

## Previous checkpoint — U4.1.2 Correção do Contrato Matemático de Separação Cosmológica (2026-11-02)

Baseline at `5b889b0681581876e6f17787d13376a1006f745f` (U4.1.1). Corrigida a asserção matemática em `T_U411_01_COSMOLOGICAL_CELL_SPATIAL_IDENTITY`:
1. Diagnóstico do CI: falha única na asserção de `T_U411_01` (exigia `deltaX > 30 Mpc` para células separadas por 20 Mpc nominais).
2. Correção analítica: comparação direta de `defB.positionM[0] - defA.positionM[0]` contra `Number(cellB.x - cellA.x) * COSMOLOGICAL_CELL_SIZE_M + (galB.localCellMpc[0] - galA.localCellMpc[0]) * MPC_M` com tolerância relativa Float64 $< 10^{-14}$.
3. Cobertura estendida: sinal de separação, células negativas, igualdade de offsets locais em células distintas, compatibilidade vetorial e preservação de BigInt.
Oficialmente aprovado no GitHub Actions Run 41393301279: Typecheck SUCCESS; regressões permanentes 638/638 PASS; testes gerais 1.491/1.491 PASS; produção build Vite SUCCESS. Publicado no commit `bc530a7e3115f7bad715cb63f821fd47862dd633`.
Evidence: [38-status-U4.1-PROCEDURAL-GALAXY-GENERATOR.md](38-status-U4.1-PROCEDURAL-GALAXY-GENERATOR.md).

## Previous checkpoint — U4.1.1 Hardening de Coordenadas, Identidade e Integração Galáctica (2026-11-02)

Baseline at `d1def8c4e06eceb8e0a0ab8ddd0f706d46fb717d` (U4.1). Hardening pós-aprovação do gerador procedural de galáxias:
1. Identidade espacial correta entre células cosmológicas no adaptador legado via `cosmologicalPositionM()`, limiar explícito de domínio Float64 (`COSMOLOGICAL_FLOAT_DOMAIN_MAX_CELLS = 1024n`) e recusa explícita sem posições falsas (`tryToGalaxyDefinition()`).
2. Eliminação de aliasing por truncamento de $2^{64}$ em `hashCosmologicalCell()` através de codificação canônica bijetiva de BigInt (sinal + comprimento LEB128 + magnitude) com finalizador SplitMix64 (`GALAXY_GENERATOR_VERSION = 2`).
3. Preservação de morfologia específica no runtime consumidor: adicionado `'procedural'` a `GalaxyDensityProfile` e campo `proceduralMorphology` a `GalaxyDefinition`, integrando `GalaxyRuntime.densityAtLocal()` à fonte única `evaluateProceduralDensity()`.
4. Auditoria de alegações de desempenho (vazão sob demanda sem alegações não instrumentadas de memória) e designação procedural estrita (`DM-PG ...`).
GitHub Actions Run 41390693792: Typecheck SUCCESS; regressões permanentes 638/638 PASS; testes gerais 1.490/1.491 PASS (1 falha de expectativa matemática no teste novo T_U411_01); Vite build SKIPPED. Publicado no commit `5b889b0681581876e6f17787d13376a1006f745f`.
Evidence: [38-status-U4.1-PROCEDURAL-GALAXY-GENERATOR.md](38-status-U4.1-PROCEDURAL-GALAXY-GENERATOR.md).

## Previous checkpoint — U4.1 Deterministic Procedural Galaxy Generator (2026-11-02)

Baseline at `22ba21ead896e1049999e94b43922f5d7c59767f` (P0.5.11). Implemented `ProceduralGalaxyGenerator.ts` providing deterministic mathematical generation of galactic descriptors across cosmological cell grids (`BigInt3`, 2.0 Mpc cells) using 64-bit integer FNV-1a hashing and 64-bit xorshift PRNG without `Math.random` or global state. Models complete Hubble sequence morphology (E0-E7, S0, Sa-Sc, SBa-SBc, Irr) with 3D analytic stellar density functions: soft-core Hernquist-inspired bulge (strictly non-singular at r=0), triaxial central bar, double exponential thin/thick disk, logarithmic spiral arms with envelope maximum (strictly M_arms >= 0.25 > 0), and diffuse stellar halo. Preserves canonical Local Group entities (`milky_way`, `andromeda`, `triangulum`, `lmc`, `smc`).
Officially verified in GitHub Actions Run 41388592245: Typecheck SUCCESS; permanent regression gate 638/638 PASS; general unit tests 1,486/1,486 PASS; Vite production build SUCCESS. Published at commit `d1def8c4e06eceb8e0a0ab8ddd0f706d46fb717d`.
Evidence: [38-status-U4.1-PROCEDURAL-GALAXY-GENERATOR.md](38-status-U4.1-PROCEDURAL-GALAXY-GENERATOR.md).

## Previous checkpoint — P0.5.11 Interstellar Cruise Restoration & Flight Phase Semantics (2026-11-01)

Baseline at `97d96a1606cd6e08cf3521acd48f1b53a53c2062` (P0.5.10). Resolved the flight phase regression in `T_P0B_SOLAR_SYSTEM_TO_INTERSTELLAR_SPACE_WASD` (where interstellar cruise at 1,000c was misclassified as `braking`) by separating the steady-state cruise speed governor from proximity-induced deceleration. In steady-state warp cruise, net acceleration is zero and flight phase remains `cosmic-cruise`; proximity deceleration is only applied and flagged when an obstacle envelope actively bounds velocity. Added comprehensive unit test covering the six distinct flight regimes (`T_P0511_INTERSTELLAR_CRUISE_PHASE_AND_SPEED_GOVERNOR_SEMANTICS`). Audited technical references, clearly distinguishing real-world control principles from gameplay FTL mechanics.
Officially verified in GitHub Actions Run 41385860673: Typecheck SUCCESS; permanent regression gate 638/638 PASS; general unit tests 1,476/1,476 PASS; Vite production build SUCCESS. Published at commit `22ba21ead896e1049999e94b43922f5d7c59767f`.
Evidence: [37-status-P0.5.11-CRUISE-PHASE-AND-BRAKING-SEMANTICS.md](37-status-P0.5.11-CRUISE-PHASE-AND-BRAKING-SEMANTICS.md) and [36-status-P0.5.10-GATED-BODY-SELECTION-AND-SOURCE-AUDIT.md](36-status-P0.5.10-GATED-BODY-SELECTION-AND-SOURCE-AUDIT.md).

## Previous checkpoint — P0.5.10 Gated Body Selection & Aerospace Reference Audit (2026-10-30)

Baseline at `42e21bdf813d1b65c0615f78107ecb1ee2bd9542` (P0.5.9). Resolved the single telemetry attribution divergence in `T_P0B_PROXIMITY_SPEED_GATING_PREVENTS_TUNNELING` (where Mars was reported instead of Earth) by separating structural state channels (`throttleGatedBodyId` vs `decelGatedBodyId`), calculating obstacle-relative radial velocities, and establishing a deterministic telemetry priority hierarchy. Added unit tests for multi-body catalogue order invariance (`T_P0510_GATED_BODY_IDENTIFICATION_INDEPENDENT_OF_OBSTACLE_ORDER`). Audited and corrected technical literature citations (expunged spurious SP-8007; cited Stevens et al. 2015, Battin 1999, and NASA SP-8015).
All 638/638 permanent regression gate tests preserved.
Evidence: [36-status-P0.5.10-GATED-BODY-SELECTION-AND-SOURCE-AUDIT.md](36-status-P0.5.10-GATED-BODY-SELECTION-AND-SOURCE-AUDIT.md), [35-status-P0.5.9-PROXIMITY-THROTTLE-GATING.md](35-status-P0.5.9-PROXIMITY-THROTTLE-GATING.md), and [34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md](34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md).

## Previous checkpoint — P0.5.9 Proximity Throttle Gating & Full Suite Restoration (2026-10-30)

Baseline at `08d14d2c5de1ca43c143d004469f07566ff3dbe1` (P0.5.8). Resolved the excessive speed tunneling failure by implementing fly-by-wire throttle limiter authority before applying commanded warp acceleration near celestial envelopes. All 638/638 permanent regression gate tests preserved.
Evidence: [35-status-P0.5.9-PROXIMITY-THROTTLE-GATING.md](35-status-P0.5.9-PROXIMITY-THROTTLE-GATING.md).

## Previous checkpoint — P0.2 Fidelity Hardening & Robustness Hotfix (2026-10-21)

Baseline at `4c05785df32eade281a2bd4f1a4361ef33fcc299`. Resolved all 5 fidelity and robustness issues, including audit hotfix:
multi-segment continental and globe river rendering without spurious connections (`EarthRiverLayer.getRiverLines`),
spherical geodetic SLERP interpolation with orbital LOD contrast tiers (`EarthContinentalRiverRenderer.ts`),
resilient WebGL initialization with DOM canvas replacement fallback preventing browser context clashes (`PlanetMap3DRenderer.ts`),
photosphere spherical clearance and terminal landing envelope clamp (`BodyNavigation.ts`, `Game.ts`),
and autonomous end-to-end solar landing, surface locomotion and takeoff test cycle without shortcuts driven purely by player controllers (`sun-approach.test.ts`).
Permanent regression gate at 635/635 PASS; full unit test suite at 1,424/1,424 PASS; impact-fidelity 24/24 PASS; build clean.
Evidence: [32-status-P0.2-FIDELITY-HARDENING.md](32-status-P0.2-FIDELITY-HARDENING.md).
STOP after P0.2; U4/BH0 remain strictly blocked pending manual gameplay evaluation.

## Previous checkpoint — P0.1 Final Hardening: Geographic Fidelity & 3D Earth Presentation (2026-10-15)

P0 baseline at `68af476eb02380a86abeb43c9d314dd6d2162757`. Resolved all 8 fidelity and hardening issues:
reproducible offline Natural Earth river geodata pipeline (`build-earth-rivers.mjs`), body-fixed continental
Amazon river renderer on orbital EarthGlobe (`EarthContinentalRiverRenderer.ts`), genuine Three.js WebGL/WebGPU
spherical 3D Earth map (`PlanetMap3DRenderer.ts`), canonical geodetic Manaus anchor alignment, unified solar
photosphere landing criteria (`isLandableBody()`), enhanced Manaus orbital LOD with spherical occlusion, and
stable procedural flight pose bone transforms.
Permanent regression gate at 629/629 PASS; full unit test suite at 1,417/1,417 PASS; impact-fidelity 24/24 PASS; build clean.
Evidence: [31-status-P0.1-FINAL-HARDENING.md](31-status-P0.1-FINAL-HARDENING.md).
STOP after P0.1; U4/BH0 remain separate work pending manual operator acceptance.

## Previous checkpoint — P0 Planetary Presentation + Earth Map + Flight Polish (2026-10-15)

U3 accepted at `225e99507856e4508c558bc94e56c0b07d0d5d1c`. Implemented: solar elevation and day/night transitions,
occlusion testing and space ambient floor, lunar earthshine (phase floor 0.14), singularity-free 3D flight orientation,
procedural aerodynamic flight pose blending, solar photosphere landing (tangent plane ENU heightfield), offline 3D Earth globe
with Natural Earth rivers and geodetic markers, Manaus Tier C far orbital presentation with continuous cross-fade and local mesh culling,
and 18 F3 diagnostic metrics. Permanent regression gate maintained at 610/610 PASS; full repository suite at 1,390/1,390 PASS.
Evidence: [30-status-P0-PLANETARY-POLISH.md](30-status-P0-PLANETARY-POLISH.md). STOP after P0; U4/BH0 remain separate work.

## Previous checkpoint — U3 Universal Hypercruise (2026-10-09)

U2 accepted at `64eb0210fda8a111af6cd1cf3d8743f59c362ba8`. Implemented: permanent regression
gate, immutable travel plans, anchored/transit authority, interstellar/intergalactic production P,
X braking/coast/resume/source return, one destination prefetch, arrival hold and atomic handoff,
safe Solar space return, remote body multi-leg approach, bounded presentation/map/HUD/F3.
D1 remains frozen. [U3 evidence/manual gate](29-status-U3-UNIVERSAL-HYPERCRUISE.md).
[Mandatory future regression gate](REGRESSION-GATE.md). STOP after U3 manual validation;
U4/BH0/U5/U6 remain separate work.


## Previous checkpoint — U2 Galaxy Runtime / Andromeda (2026-10-09)

U1 accepted at `9909091f7bfb14b40c031752df29550deddd1651`. U2 now supplies one galaxy-local
coordinate authority, active GalaxyRuntime, prepared galaxy/system installation with rollback,
Andromeda disc fixture, context-correct star sectors, external MW/M31 presentation, distances,
map/HUD/F3 and explicit QA arrival/return. Normal P cannot travel between galaxies. D1 frozen.
Evidence and manual gate: [28-status-U2-GALAXY-RUNTIME-ANDROMEDA.md](28-status-U2-GALAXY-RUNTIME-ANDROMEDA.md).
Historical U2 gate accepted by the U3 request. Current stop is U3; U4/BH0 remain future work.



## Previous checkpoint — U1 playable procedural systems (2026-10-09)

The latest request accepts U0 at `c651abb77c8142244064a1aa4d50504bdfdb9f63` and authorizes U1.
Implemented: canonical GeneratedStar-consistent systems, explicit profiles, moving body frames,
prepared atomic materialization, active-system visuals/providers/map/HUD/F3 and intra-system
Tab/P/Warp/CCD/rocky and moon landing. The Milky Way fixture has 34 bodies: 9 planets and 24 moons.
Explicit U1 TEST arrival/return only; normal P cannot cross systems. Generated D1 stays disabled.
Full 1,211/1,211, focused 237/237, typecheck/build/diff and space/local/Manaus browsers PASS,
zero browser errors. Detailed evidence, budgets and limits:
[27-status-U1-PLAYABLE-PROCEDURAL-SYSTEMS.md](27-status-U1-PLAYABLE-PROCEDURAL-SYSTEMS.md).
Historical U1 gate accepted by the latest U2 request.

## Previous checkpoint — U0 universal navigation target (2026-10-09)

Implemented on `9f7ac3e7a6a78d2944f32438ccdec9c1ebff8fef`: one immutable target state,
logical catalog/resolver, exact BigInt keys/wire format, strict Solar travel/label adapter and
shared map/HUD/F3. All 19 Solar bodies, procedural star/system/planet identities, MW, Andromeda
(2.50 Mly), Sgr A*, Andromeda's M31 SMBH, existing anchors/horizon. Selection does not move
player/change address or system; future travel stays gated. **1,163/1,163 unit, 137/137 focused,
typecheck/build/diff PASS; full-space and local browsers PASS, zero errors**. Actual F3 and
desktop/mobile viewport map flows validated. Evidence and limitations:
[26-status-U0-UNIVERSAL-NAVIGATION-TARGET.md](26-status-U0-UNIVERSAL-NAVIGATION-TARGET.md).
U0 accepted by the latest U1 request; its historical stop is superseded by the current checkpoint above.

## Previous checkpoint — Manaus aerial presentation P0 (2026-10-08)

Hotfix on `5b176f4`: curved Earth-fixed river/city/major-road presentation is prepared before
the flat local root retires at the unchanged 15 km handoff. Regional water/mask coverage
expands; full tree crowns reject real water. One ground authority, no aerial simulation,
unchanged `curvedManaus=false`. Full unit 1,108/1,108; measured budgets, data provenance,
browser results and manual gate: [25-status-MANAUS-AERIAL-PRESENTATION-P0.md](25-status-MANAUS-AERIAL-PRESENTATION-P0.md).
The subsequent U0 request supersedes this historical checkpoint stop; D1 remains frozen.
Focused 109/109, types/build/diff and all three native Intel Arc/D3D11 browsers PASS,
including continuous Manaus ascent to 200 km, full space regressions and local Earth reentry;
zero browser errors. Exact final delivery SHA/CI are reported with the final response.

## D1.1-FINAL (2026-10-08)

D1.2 accepted; final D1 hardening is implemented: deterministic whole-region multi-crater
residency/128 m retention, live solar direction/shared intact light response and vertex albedo,
volume frustum culling, per-tile masks and prepared collider/coverage/render/mask publication.
Two HIGH impacts ~500 m apart stay physical/visible/masked; eviction preserves edits and save/load
now preserves demand metadata. Byte-pressure eviction retries after priority/window changes,
without repeated work under stable demand. Typecheck/build/diff PASS; 28 new tests, focused 373, full 1,080;
fidelity 24/24 unchanged; volume/full and short real Game space/local browsers PASS. Controlled large Moon
atomic publication 2.532→0.046 ms; added albedo/preparation cost is documented, not hidden.
Details/limits/manual gate: [24-status-D1.1-FINAL-HARDENING.md](24-status-D1.1-FINAL-HARDENING.md).
**Destruction frozen at D1; D2–D5 deferred. Next after manual gate: U0 universal target/address.**
New branch priority: [Universe Map completion epic](../../specs/UNIVERSE-MAP-COMPLETION-EPIC.md).
This current decision supersedes historical checkpoint stops/priorities below; no U0 implementation
was included in that historical D1.1 delivery. Current U0 work is recorded above.
Document/commit/push remain authorized; final exact-SHA CI is reported after delivery.

## D1.2 — high-resolution impact core — 2026-10-08

The user authorized the fidelity prerequisite on `9e02dbed21a91cdea5db7c50c12c89a8673af7a6`.
Production small/medium impacts use explicit `impact-high` 256 m / 33³ / 8 m keys; defaults
remain 17³ / 16 m. Whole HIGH windows never shrink and publish mesh/collider/mask together;
insufficient budgets keep old authority and expose `high-res-budget`. Shared exterior samples
make ordinary high-resolution boundary normals agree. No 4 m profile was needed.
The unchanged fidelity tolerance now passes all six canonical cases and 24 grid-phase fixtures,
maximum radius error 7.248 m and depth error 0.2134 m. Typecheck/build/diff PASS; focused
410/410, full 1,052/1,052, volume and short real Game space browsers PASS, zero errors, benchmarks PASS.
Architecture, memory/cost measurements, source identity, fidelity and manual gate:
[23-status-D1.2-HIGH-RES-IMPACT-CORE.md](23-status-D1.2-HIGH-RES-IMPACT-CORE.md).
Sun/Manaus/C4 unchanged. **Stop for manual acceptance. Do not automatically resume D1.1 or D2.**

## D1.1 — failed fidelity stop gate — 2026-10-07

The new attachment authorizes hardening on solar delivery `644e2def54fe39213f1be6b4053749b8ecc305c0`,
preserving all Sun changes. Its explicit STOP condition was reached in an early quantitative
measurement: radius error up to 13.075 m exceeds the declared 8 m tolerance in five of six
Moon/Mars/Earth small-crater fixtures. Depth passes in these canonical fixtures. Mesh/collider
agreement and an independent analytic CSG/relief contour confirm coarse extraction smearing.
`npm run check:impact-fidelity` deliberately returns failure; measurement tests passing are
not accuracy acceptance. **D1.1 remains incomplete; D1.2 HIGH-RES IMPACT CORE is required
before D2.** Multi-region residency, volume solar lighting, culling, per-tile masking and commit
optimization remain pending. No production renderer/physics/destruction/Sun authority changed.
Reproduction, tolerances, footprint, benchmark baseline and validation:
[22-status-D1.1-FIDELITY-GATE.md](22-status-D1.1-FIDELITY-GATE.md).

## SUN-APPROACH-P0 — 2026-10-07

Current user-authorized checkpoint on delivered D1 HEAD `b1ab6a8`: remove the solar 2R wall,
retain real radii, separate photosphere CCD epsilon (100 km) from autopilot observation margin
(20,871 km), and add bounded analytic photosphere/corona presentation, quality modes and F3.
Solar contacts still use C4; no landing/rocky volume/stellar destruction. Existing D1 is preserved.
Contract, evidence and manual gate: [21-status-SUN-APPROACH-P0.md](21-status-SUN-APPROACH-P0.md).
Typecheck/build/diff PASS; focused 189/189, full 1,000/1,000. Space/local browsers and fresh solar
Game PASS with zero errors. Implementation CI `95de682` PASS; final exact-SHA CI is checked after push.
**Stop for manual solar acceptance; no D2 or automatic D1 expansion.**

## LOCAL-IMPACT-DESTRUCTION-D1 — 2026-10-07

Current checkpoint, explicitly authorized on `02df01c542c7e9917f01534c1fbf78244381ce49`:
eligible rocky C4 MINOR/MAJOR contacts create one sparse sphere edit. Production residency,
MC presentation, D0 collision and intact visual/heightfield suppression publish as one coherent
transaction. Moon/Mars have physical crater floors; controlled Earth excludes authored Manaus.
SAFE/GRAZE/CATASTROPHIC and gas/star/proxy bodies remain without D1 edits; local P0 is retained.
Contract, cap sign correction, memory limits, evidence, benchmark and manual gate:
[20-status-LOCAL-IMPACT-DESTRUCTION-D1.md](20-status-LOCAL-IMPACT-DESTRUCTION-D1.md).
Typecheck/build/diff PASS; focused 407/407; full 964/964 (78 new D1 cases).
All four required browsers PASS with zero errors; fresh-Game crater acceptance and all three
benchmarks PASS. Exact code/test HEAD `61f8094` CI PASS; delivery HEAD is checked after push.
This authorization supersedes historical stops before D1. **Stop for human acceptance before D2.**

## IMPACT-DESTRUCTION-P0 — local Manaus — 2026-10-06

Previous checkpoint, explicitly authorized on `267caf5d0a8c6ce435e16270c165965bec7c2445`:
contact-normal footprint, larger bounded craters, separate core/blast/impulse/reaction zones,
resident entity queries, complete multipart furniture, NPC states, car impulse and reconstruction.
Heavy structures retain 16 collapses/frame; cheap entities retire on their own bounded 1,024/frame path.
Canonical curve, routing, budgets, tests, benchmark and manual gate:
[19-status-IMPACT-DESTRUCTION-P0.md](19-status-IMPACT-DESTRUCTION-P0.md).
Typecheck/build PASS; focused 145/145; full 886/886, including 55 new impact cases.
Browser local/Manaus/space PASS, zero browser errors; implementation and fixture CI PASS.
The final documentation HEAD is checked after push and reported at delivery.
STOP for manual acceptance before D1.
C4 and D0 remain isolated; celestial events do not create volume edits.

## D0 — PLANET VOLUME COLLISION — 2026-10-06

Previous checkpoint: D0 only, explicitly authorized on `4db33426104c9e93d27cbe53a3a3349311e011a8`.
Collision shares Phase 3 mesh arrays; deterministic incremental BVHs run under the existing
scheduler. The bounded cache retains old collision until a valid completed replacement or
ready EMPTY/SOLID retirement is published at the frame boundary. Local ENU capsule sweeps
handle faces/edges/vertices continuously; floors ground, walls/ceilings block, inward speed
is removed without bounce. Only collision LOD 0 participates. Ordinary gameplay stays intact.

Canonical authority, budgets, lifecycle, limits, results and manual checklist:
[18-status-VOLUME-COLLISION-D0.md](18-status-VOLUME-COLLISION-D0.md).
Core typecheck PASS; focused 321/321; full 831/831; build PASS. Production volume browser
PASS: nine original mesh fixtures plus real player/collision/rebuild on Earth, Moon and Mars,
zero console/page errors. Spatial/local browsers and benchmark PASS; implementation CI PASS
on `424c54c`. Full individual results and performance tables are in the canonical status.
Open `/?volumeLab=1&volumeCollision=1` for the isolated floor/wall/ceiling laboratory.
The latest local IMPACT-DESTRUCTION-P0 authorization supersedes this historical D0 stop.
D1 and planetary gameplay destruction remain unauthorized.

## C4 — CELESTIAL IMPACT POLICY — 2026-10-05

Previous checkpoint: event/policy only, based on accepted `9083c8e53936ed71a45b7a6da75acc3d2965ff2d`.
CCD now supplies pre-response velocities/normal/envelope; a pure body-relative policy classifies
SAFE_CAPTURE, GRAZE, MINOR, MAJOR or CATASTROPHIC. Direct ≥1c can be catastrophic; same-body
active autopilot or F landing intent stays safe; lock alone remains manual. Physical episode
latches with release hysteresis prevent duplicate events. Game drains a transient queue into
lastCelestialImpact and F3. All 19 bodies retain intact CCD and existing capabilities.

Canonical schema, thresholds, all-body matrix, lifetime, limits and individual validation:
[`17-status-CELESTIAL-IMPACT-POLICY.md`](17-status-CELESTIAL-IMPACT-POLICY.md).
37 new tests; typecheck PASS, focused 286/286, full 777/777, build PASS, space browser PASS,
local browser PASS (both zero errors), diff check PASS. GitHub Actions PASS on the exact
implementation/browser checkpoint `29220e2`; its check-run link is in the canonical status.
The latest explicit D0 request supersedes C4's historical stop. C4 still creates no destruction, volume edits or VFX.

## PLANET-FLIGHT-LANDING-1.1 — 2026-10-04

Current checkpoint: stabilization only, based on `42a930a8fb5eaa9d4c0f00b3ef198046a495e7bc`.
Space Shift again owns cosmic boost, animation and reverse target cycling; space B only steps
Warp. Local B and explicit V/repress tiers are preserved. Capture now reaches hold within
5 cm and the HUD clears the captured/waiting phase after local handoff. Dedicated input,
capture and streaming regressions include all 42 required names and 51 new tests.
The baseline's missing F3 references were also caught by typecheck and corrected.
Scratch patches, an intermediate failure dump and a machine-specific workspace were removed.
Deleted iteration records have no live Markdown links requiring restoration.

Canonical controls, evidence, individual validation results and manual checklist:
[`16-status-PLANET-FLIGHT-LANDING-1.md`](16-status-PLANET-FLIGHT-LANDING-1.md).
Final-tree validation: typecheck PASS, focused **248/248**, full **740/740**, build PASS,
browser space PASS, browser local PASS (both zero console/page errors), diff check PASS.
The space smoke verifies actual F cancellation/capture/hold/readiness and terrain contact
for Moon and Mars, local tiers/departure and cosmic controls; both landed HUDs say CHEGADA.
The historical 689/689 claim is superseded by this fresh run; it is not proof for this tree.
Historical 1.1 stop gate: the latest user attachment accepts progression to C4 above.

## NAV-LOCK-1 — 2026-10-03

Initial HEAD: **`386c531a450ab6770b9da454267081f0501989b9`**, branch `feat/universe-map`.
The user manually accepted C0 (slow Moon landing, no high-speed tunnelling, correct celestial
interception) and authorized the combined target lock, autopilot capture and map lock checkpoint.
The original C0 stop gate below is historical; the current stop gate is NAV-LOCK-1 manual acceptance.

**Authority:** `Game.navigation: NavigationTargetState` stores one identity-only NavigationLock
with body ID, source, lock time and mode. `Game.navigationTarget` remains a derived compatibility
accessor. Every consumer resolves live `positionOf/stateOf`; no camera, HUD, map or autopilot
owns another target. Map feedback derives from Game's returned ID, and map selection never writes
pose/velocity. Map focus, overview, close, proxy/globe swaps and offscreen motion retain the lock.

**Controls/selection:** Tab cycles forward, Shift+Tab backward, P toggles autopilot, Backspace
clears the lock in interplanetary space. R reconstruction and Escape panel controls retain their
existing meaning. Tab selection never engages autopilot. The cone is **15°** in barycentric space;
finite presentable bodies in front compete by angular offset, apparent angular size and a weak
logarithmic distance penalty. Fully hidden discs are rejected; partial overlaps remain candidates.
Stable geometric ordering reaches every candidate, including three overlapping bodies. No candidate
means “Nenhum alvo”. No mesh raycast or loaded-globe requirement.

**Flight:** the existing CosmicCruiseController owns a target-free AutopilotCapture command state:
idle, align, acceleration, cruise, braking, capture, approach, arrived. It uses target-relative
orbital velocity and bounded acceleration; large direction errors brake before reorientation,
with a 1 rad/s direction bound and no camera rotation. One engagement capability bounds both
acceleration and deceleration. **Stopping distance = v²/(2a)**. Effective commanded speed is bounded
by the selected warp, `sqrt(2 a remainingGap × .35)` and `remainingGap / 1.5`; this automatically
reduces speed without changing physical scale or rescaling incoming velocity instantaneously.
Positions advance only through integration and the unchanged CCD motion clamp.

**Arrival:** capture first at body radius + the existing `bodyArrivalPolicy` margin. Landable
bodies then descend relative to measured relief: wait above the 7 km gate when terrain is missing,
approach toward 5.6 km when covered, fall from the shared 2000 m/s approach tier to **96 m/s** near
handoff. TravelDomain still independently enforces readiness, inward <=120 m/s, total <=8000 m/s.
Its existing local ENU handoff finishes the command and retains the target. Actual ground descent
uses existing character physics; orbital capture itself does not claim ground contact.
Stars/giants and the nine currently nonlandable SOLAR-12 moons remain outside policy standoff
and match target orbital velocity, with no terrain floor. Cancel/target loss retains momentum.
All 19 celestial envelopes remain swept after autopilot planning, including failed extreme arrivals.

**UI/debug:** localized name, live center distance, relative/closing speed, positive-closing-only
ETA, lock/command state and phase; one render-safe DOM marker or offscreen edge arrow. Map/card
display “TRAVADO”. F3 includes source, alignment, stopping distance, arrival radius, effective cap
and C0 contact body/fraction. Marker scratch is reused; target definitions use a reusable index;
acquisition allocates on key edges, and the new arithmetic autopilot planner uses scalar scratch.

**Validation:** typecheck, **186/186 focused tests**, **668/668 full tests**, production build and
`git diff --check` passed. **34 new deterministic tests** are in `tests/navigation-lock.test.ts`
and `tests/autopilot-capture.test.ts`, covering all **29 required named cases**,
30/60/120 Hz, moving-target arrival, manual coast, failed-plan CCD,
occlusion/cycling, bounded marker, actual map callback/HUD authority and readiness waiting.
The extended space browser smoke uses the existing Chromium and explicit far/near fixtures,
then production Game.tick for Moon Tab/P arrival, Mars map/P handoff, Jupiter standoff and
keyboard cancellation. **`npm run test:browser:space` passed with zero console/page errors**.
Observed Moon and Mars local handoffs had terrain coverage and about **96 m/s** relative speed;
Jupiter arrived roughly **3 m outside** its exclusion/standoff radius with zero target-relative
speed. The traces include align/acceleration/braking/capture/approach and arrived phases, plus
real first-local-step contact checks. This is not a claimed hours-long real-time journey.
The build retains its existing bundle-size warning. Implementation commit: **`198ccc5`**;
the following validation commit records this browser flow and the current prompt/status.

**Requires user manual validation:** look at Moon, Tab, P, confirm acceleration/braking and safe
arrival; repeat Mars. Map-select Jupiter then P and confirm outside standoff; repeat Titan.
Cancel P during flight and confirm momentum remains. C0 is already manually accepted;
NAV-LOCK-1 manual acceptance is pending. **Stop here; no catastrophic impact/destruction.**

Detailed audited contracts, scoring weights, braking math and capture policy:
[`03-TARGET-LOCK-AUTOPILOT-AND-MAP.md`](../../specs/dr-manaus-universe-roadmap/03-TARGET-LOCK-AUTOPILOT-AND-MAP.md).

## CELESTIAL-CCD-P0 / C0 — 2026-10-03

Historical checkpoint, now manually accepted by the user at `386c531`.

Initial HEAD: `9c6d5b24b8b55e7fe836899d034057747872436e`, branch `feat/universe-map`.
The new user ZIP was extracted into `specs/dr-manaus-universe-roadmap`: **20 Markdown files,
4,497 lines**, read in full. The supplied manifest's 19-file count excludes the manifest itself.
The package and then-current attachment authorized **C0 only**, with documentation, commit and push.
That gate was subsequently satisfied by user manual acceptance; NAV-LOCK-1 is now authorized above.

**Confirmed defects:** before the patch, both newly introduced regressions failed: a diagonal
step could cross a relief ridge while its sampled endpoints remained above ground, and the
10,000 m/s return gate admitted an unsafe descent into local character physics. Existing vertical
endpoint floor correction already worked; this patch adds first trajectory contact and safe handoff
rather than claiming the Moon provider was missing. The user's visual reproduction was subsequently
manually accepted before NAV-LOCK-1.

**Implemented:** generic five-point foot terrain sweep; exact vertical crossing; 16 bounded
diagonal brackets followed by 12 binary refinements; motion clamping and inward-normal velocity
projection with tangential velocity retained. Without nearby boxes, planetary terrain uses one
whole-segment sweep; urban box sliding, cavity-wall raycasts and supported walking retain their
existing path. Contact fraction/height/normal are inspectable through PlayerController/PhysicsWorld.
The algorithm is for existing intact smooth heightfields, not arbitrary sub-sample features,
overhangs or Marching Cubes triangle collision.

**Landing contract:** readiness must explicitly be `true`, relief clearance at most **7,000 m**,
relative inward speed at most **120 m/s**, total relative speed at most **8,000 m/s**. The limits
come from the current normal/mega character tiers and are covered at their boundaries. The
**2,000 m/s** super tier separately supplies approach telemetry/future capture planning; it is not
a new autopilot. Body-relative radial/tangent components use the actual surface gradient, without
the visual slope exaggeration. A fast orbit is distinguished from a direct dive. Unsafe arrivals
remain interplanetary; a missing readiness result cannot silently enable local physics.

All **19** active bodies have finite live logical envelopes/velocities and positive radii. Broad
Earth/Moon/Mars envelopes include existing conservative relief bounds. The existing sphere sweep,
earliest-hit selection and inward-velocity response are preserved. The normalized equivalent
quadratic avoids large-term cancellation; tangency does not count as entry. Motion is swept relative
to the moving contacted body, and the unused frame time carries its orbital translation. Response
subtracts that body's velocity, not an unrelated dominant body's. A measured terminal envelope is
used only after the post-thrust speed is within the local ceiling; cosmic acceleration cannot shrink
the broad envelope by reusing a previously slow speed. Sun/gas/ice giants and non-landable moons
receive broad safe-stop contact without local ground. `CelestialContact` is a pure diagnostic
result; no destructive impact policy or event dispatcher was added.

F3 exposes travel/physics domains, target, relative/radial/tangent speeds, clearance and thresholds,
terrain body/height, local Y/state and last celestial contact/fraction. `surfaceReturnTrace` captures
returned → barycentric → body local ENU → PlanetTerrainProvider binding → first PlayerController
step. No per-frame console logging was introduced. Volume phases 1–3, lab, ephemerides, map layout,
galaxy generation and powers remain unchanged.

**Automatically verified:**

| Check | Result |
| --- | --- |
| Mandatory P0 regression file | 39/39 tests; all requested named cases present |
| All 19 celestial bodies | Full crossing at bounded dt plus grazing crossings at 120/60/30 FPS; both endpoints outside |
| Moon local terrain | 120/60/30 FPS at 120, 8,000, 10,000 and 260,000 m/s; no below-terrain endpoint |
| Mars local terrain | 120/60/30 FPS; swept contact without Manaus colliders |
| Contact response | Inward component removed, tangential component retained; Grounded and walking regressions pass |
| Gas/ice giants / Sun | Broad interception, no ground handoff |
| Focused physics/travel/Moon/Solar-12/runtime/player/Manaus suite | 200/200 |
| `npm run typecheck` / `npm test` / `npm run build` / `git diff --check` | Pass; 634/634 full tests; inherited bundle-size warning only |
| `npm run test:browser:space` | Pass; zero console/page errors; map, cosmic view, proxies, real Moon return/walk/jump/takeoff, volume opt-in/release |

Browser P0 fixtures explicitly reject a 10 km/s lunar return, record the actual Game.tick handoff
and first local step, then run the real PlayerController at 30 FPS with a 10 km/s downward velocity
whose old endpoint is underground. Swept contact leaves it Grounded on terrain with no inward
normal velocity. These are controlled near-arrival fixtures, not a claimed manual Earth–Moon trip.
One repeated browser run exposed a pre-existing test race: ephemeris-driven map card replacement
detached the overview button during Playwright's stability wait. The test now dispatches the actual
DOM button click synchronously, retains the focus/scale assertions and passes; map implementation
was not modified. The unrelated legacy `npm run test:browser` was not run in this checkpoint.

**Measured movement CPU, median / p95 ms** (same Moon ENU, dt=1/30, 30 warmups + 120 samples,
baseline PhysicsWorld loaded from the initial HEAD versus the final implementation):

| Scenario | Baseline | CCD |
| --- | ---: | ---: |
| Diagonal 10 km/s contact | 1.957 / 3.268 | 0.516 / 1.045 |
| Diagonal 8 km/s without contact | 0.211 / 0.435 | 0.396 / 0.843 |
| Supported ground walk | 0.038 / 0.091 | 0.071 / 0.231 |

These are movement-query timings on this workstation, not total frame/GPU/FPS guarantees.
No renderer resources, streaming jobs, dependencies or volume residency were added. Logs,
benchmark fixtures/JSON and browser screenshots stay in ignored `artifacts/`.

**Manual validation required:** repeat the original slow Moon approach and walk; fast and
absurd-speed Moon approach; fast Mars approach; free-flight crossing attempts against Jupiter
and Sun. Inspect control feel, stopping distance and F3 contact telemetry. **The C0 acceptance gate
was satisfied by the user; the next authorized checkpoint is NAV-LOCK-1 above.**

Architecture details: [`planetary-handoff-and-volume-phase1.md`](planetary-handoff-and-volume-phase1.md).
Requirements: [`02-PATCH-CELESTIAL-CCD-P0.md`](../../specs/dr-manaus-universe-roadmap/02-PATCH-CELESTIAL-CCD-P0.md).

## PLANET-VOLUME-3 / Phase 3 — 2026-10-02

Initial HEAD: `a752f7ceb24811ece5c0ceafdc275fd217d7b272`, `feat/universe-map`.
The latest request accepts Phase 2 **by static inspection** and directs Marching Cubes next.
Manual gameplay acceptance is still pending. Implementation checkpoints were documented and
pushed: `4804016` (pure indexed extraction/table/tests), `c5a8845` (bounded mesh runtime and
isolated visual inspector/tests/browser). This integration commit records benchmarks, final
validation, a deterministic scheduler-test correction and the updated authoritative prompt.

**Implemented:** real iso=0 geometry from ready MIXED scalar chunks; chunk-local Float32
positions/normals, Uint32 indices, separate body-fixed Float64 origin/key/revision; canonical edge
reuse, exact-zero welding, degenerate removal and inward cut-wall/outward solid-surface normals.
The classic 256-case table is MIT-licensed three.js r186 data with its complete notice retained.
The pure mesher has no renderer, DOM, field/BVH query or gameplay dependencies. EMPTY/SOLID grids
yield zero geometry. Ambiguous cell-face occurrences are observable; MC33 certification,
cross-chunk ghost-gradient normals and different-LOD transitions are not claimed.

`setDebugMeshing(true)` independently opts in after demand. One existing `planet/volume` scheduler
grant serves both stages, nearest-first, with one live job total and at most one scalar plus one
mesh completion per frame. Batches adapt by measured EWMA cost: 1–128 samples / 1–64 mesher units,
targeting up to 0.35 ms or half the remaining grant. Deadline enforcement remains cooperative.
Default gameplay allocates zero resident grids/meshes/jobs. Existing shell visuals, single-surface
physics, powers, flight, ephemerides and navigation remain unchanged.

Mesh cache: **8 payloads / 8 MiB** actual typed-array caps. Worst-case capacity admission prevents
small-budget eviction/remeshing loops. Source identity/revision must match the current ready scalar
chunk; edits immediately hide stale meshes, and changed/evicted chunks, body changes, lost demand
and disable dispose derived residency. Unrelated edits preserve valid old source revisions.
N=17 theoretical output limit: **578,688 bytes/chunk**; count cap therefore bounds retained default
output to **4,629,504 bytes (4.415 MiB)**. A mesher job has a **2 MiB live-array cap**, including
scratch and compact-copy peak; the N=17 worst-case bound is **1,295,036 bytes**. Larger mixed-grid
configurations exceeding it are rejected/skipped without scratch allocation. Counters describe
typed arrays, not total JS heap or GPU driver memory. Persistence remains logical schema-1 edits.

**Visual entry: `/?volumeLab=1`.** The lazy inspector uses real UniverseRuntime/surface factories,
global streaming and extraction, showing one nearest L0 chunk for Earth/Moon/Mars. Controls:
Intacto/Esfera/Cápsula, orbit/zoom, external/internal camera, wireframe and chunk bounds. `Game`
is not instantiated on this route; no PlanetGlobe ownership or terrain collision is replaced.
Geometry/controls/helper/renderer/cache resources are disposed on replacement/exit. This is actual
extracted geometry in a diagnostic view, not planet destruction gameplay. Screenshots of the
crater and internal tunnel were inspected; the internal view looks along the tunnel opening.

**Measured pure meshing, median / p95 ms**, 5 warmups / 21 repetitions on this workstation:

| Case | Earth | Moon | Mars |
| --- | --- | --- | --- |
| Intact | 1.567 / 2.061 | 0.989 / 2.046 | 1.444 / 1.832 |
| Sphere cut | 1.442 / 1.956 | 1.408 / 1.817 | 1.432 / 2.224 |
| Capsule cut | 1.602 / 2.501 | 1.411 / 1.852 | 1.728 / 2.044 |

Meshes in these cases: 289–588 vertices, 512–1,092 triangles, **13,080–27,120 bytes**;
observed working arrays before final compact copies: 180,668–229,388 bytes. All nine cases have
zero ambiguous faces. `npm run benchmark:volume` separates sampling and meshing, reports geometry
counts/bytes and through-Earth allocation, and writes stdout only. No wall-time thresholds gate CI.
The one-capsule through-Earth fixture still starts at **1 edit / 1 BVH node / 0 chunks**; each
entry/centre/exit stage retains 32 scalar chunks (628,864 bytes) plus at most 8 mesh payloads
(94,992 / 85,632 / 94,992 bytes). Previous distant data is retired; no diameter-sized grid is made.

**Automatically verified:** **594/594 full tests**, **274/274 focused regressions**, typecheck,
production build and diff check passed. Twenty-three additional deterministic cases cover lookup
cases, interpolation, winding/normals, welding/degenerates, closed-sphere manifold/Euler topology,
cut spheres/capsules, shared faces, stale/invalid grids, resumability/source revision, memory
limits, source invalidation, opt-in, scheduling, LRU/bytes, movement/body retirement and adapter
locality/disposal. The existing scheduler-volume test now injects the same simulated clock into
the ledger and runtime; its prior mixed real/fake clocks could starve the test under CPU load.
Both complete and focused suites passed after that correction. Lunar NASA SHA-256 is unchanged:
`1696df0382263ac9aabc183d0f15e506099d982a66e9ad994852371e6910f628`.

**`npm run test:browser:volume` passed** against the production build with the already installed
Chromium: all nine real body/scenario renders, finite local attributes, count/byte budgets,
changed cut topology, internal/wireframe/mobile controls and zero arrays/canvas after disposal.
**`npm run test:browser:space` passed** on the same build: SOLAR-12 map/focus/all nine targets,
bounded Europa/Titan/Triton approaches, exclusive lunar globe, actual Game return/ground contact,
keyboard walking/jump/takeoff, and optional scalar-demand release. Both captured zero page/console
errors. No browser dependencies or CI publishing were added; ignored validation artifacts remain
outside commits. The existing bundle-size advisory remains informational.

**`npm run test:browser` was rerun and reproduced the baseline failure** at
`scripts/browser-test.mjs:263`: the stale `game.origin` argument is undefined in
`TerrainDestruction.update`, causing `Vector3.copy` to read undefined `x`. This legacy suite is
explicitly not passing; it was not bypassed or changed in this extraction checkpoint. The two
production smoke suites above passed independently.

**REQUIRES USER MANUAL VALIDATION:** open `/?volumeLab=1`, inspect intact/sphere/capsule on each
body, orbit/zoom and toggle internal/wireframe views; confirm actual cavity/tunnel walls and
bounded queues/memory; return to normal Manaus, fly/travel/open the System map, inspect major moons,
return to Earth's Moon and walk/jump/take off with zero default volume mesh residency. Automated
near-arrival fixtures do not establish a complete manual trip.

Contract, case-by-case geometry/memory table and ordered roadmap:
[planetary-handoff-and-volume-phase1.md](planetary-handoff-and-volume-phase1.md);
API/usage/source attribution: [volume README](../../src/world/planet/volume/README.md).
Stop at Phase 3. No Transvoxel, world coverage handoff, volume colliders, planet-power wiring or
through-body gameplay. External untracked iteration documents remain untouched.

## Historical PLANET-VOLUME-2 / Phase 2 — 2026-10-02

Initial HEAD: `2f5d8200f6003e8d9a1fb205d154192792c6b00e`, `feat/universe-map`.
The latest request accepts SOLAR-12 and authorizes sparse resident volume chunks. Implementation
commits: `0b2cfc2` (keys/sampling/field contract/tests/docs), `b098af1` (bounded cache, demand,
invalidation, scheduler runtime, telemetry/tests/docs). This integration checkpoint adds the
deterministic benchmark, production-browser assertions and authoritative status/prompt updates.
Each checkpoint is documented, committed and pushed as persistently requested by the user.

**Implemented:** immutable body-fixed Cartesian keys; one dyadic lattice with L0–L3 edges
256/512/1,024/2,048 m, 17³ samples and 16³ cells, spacing 16/32/64/128 m; pure resumable sampling;
whole-grid EMPTY/SOLID/MIXED classification; source revision and conservative one-query CSG
candidates; LRU with both chunk/byte limits; local distance/LOD demand; add/remove invalidation;
one optional current-body manager in the existing global scheduler; F3 metrics.

Resident grids hold 4,913 Float32 distances and **19,652 bytes each**. Material identity is constant
metadata; material-array bytes are zero. Limits are **64 chunks and 2 MiB** of resident arrays;
with the default grid the chunk limit wins at 1,257,728 bytes (**1.199 MiB**). One pending job holds
58,956 typed-array bytes including the output and temporary Float64 bases; it is separately
reported and released on completion/cancellation. JS/Map/edit-log heap is not claimed as measured.

Normal demand selects at most 32 dyadic leaves within 1,024 m and a conservative ±256 m radial
band, visiting at most 1,024 nodes; it is clipped to cache capacity, nearest-first, own L0 first
on ties. Refinement follows distance to parent AABBs, not globe screen-space error. Retention
uses a 1,536 m margin plus LRU; large moves/body changes retire old samples. Edits only mark
intersecting resident conservative query regions stale and allocate no chunks. Numerical influence
outside cut AABBs is preserved; unrelated ready chunks retain their prior source revision.
Pending jobs restart on owning-body revision changes.

Demand is an explicit debug opt-in, disabled by default. Earth/Moon/Mars share one pipeline;
Mercury/Venus retain profile compatibility. Sun, gas/ice giants and nine non-landable moons are
disabled. Default/inactive bodies consume zero resident/pending arrays. Near-surface mode requires
intact-terrain clearance within 2,048 m; interior sampling has a separate explicit diagnostic flag.
The existing scheduler grants remaining frame milliseconds; generation yields between 128-sample
batches and completes at most one chunk per frame. The deadline is cooperative, not a preemptive
wall-clock guarantee. No second scheduler, private timers or parallel generation fan-out exists.

**Through-Earth allocation:** 1 subtract-capsule → 1 edit/1 BVH node → **0 chunks/0 bytes before
demand**. The measured entry/centre/exit fixture holds 32 chunks and 628,864 bytes (**0.600 MiB**)
at each stage and discards the previous distant stage. Entry/exit: L0 24, L1 4, L2 4; centre: L0 32.
No planet-wide chunk enumeration occurs, including when the capsule spans the entire diameter.

`npm run benchmark:volume` uses deterministic samples, 5 warmups and 21 repetitions. Measured
CPU times below are **median / p95 milliseconds**, observed on this workstation, not CI thresholds:

| Scenario | Earth | Moon | Mars |
| --- | --- | --- | --- |
| Intact surface (MIXED), 0 candidates | 1.655 / 2.346 | 4.160 / 5.591 | 3.185 / 4.226 |
| Intact interior (SOLID), 0 candidates | 1.299 / 2.044 | 3.774 / 5.448 | 2.927 / 4.158 |
| Outside (EMPTY), 0 candidates | 1.358 / 1.883 | 3.870 / 5.000 | 2.124 / 3.408 |
| One sphere, 1 candidate | 1.644 / 3.204 | 4.059 / 6.037 | 2.648 / 4.060 |
| Sixteen spheres, 16 candidates | 7.678 / 9.183 | 13.224 / 17.562 | 7.883 / 9.949 |

**Automatically verified:** **40 new cases** cover all 32 named checkpoint invariants and
additional halo, job, budget, retention and inactive-allocation regressions. **571/571 full tests**,
**221/221 focused volume/streaming/Earth/Moon/Mars/render/Solar/Cruise/Warp regressions**, typecheck,
production build and diff check pass. Every grid value matches the Phase 1 field at Float32
precision; same-LOD faces match exactly; rebases preserve real cached arrays and keys.
The lunar NASA payload SHA-256 remains unchanged:
`1696df0382263ac9aabc183d0f15e506099d982a66e9ad994852371e6910f628`.

**`npm run test:browser:space` passed** using the existing Chromium against the production build:
SOLAR-12 map/focus/all nine targets and unchanged providers, bounded Europa/Titan/Triton approaches,
exclusive lunar globe, actual Game lunar return/ground/walk/jump/takeoff, zero inactive volume
arrays, explicit lunar demand and release on disable. The first resident lunar chunk reported
19,652 bytes, 31 pending, 1 completion in the frame, 1.700 ms generation out of 3.100 ms granted.
Captured page/console errors: zero. No browser tooling was installed; existing ignored smoke
artifacts are not committed. The benchmark writes stdout only, with no generated report files.

**`npm run test:browser` was rerun and failed at the same baseline defect** in
`scripts/browser-test.mjs:263`: its stale `game.origin` argument is undefined when passed to
`TerrainDestruction.update`, producing `Vector3.copy`'s undefined `x` error. This legacy suite
is not claimed as passing, replaced, bypassed or repaired in this volume-only checkpoint.
The production space/planetary smoke above remains passing.

**REQUIRES USER MANUAL VALIDATION:** Manaus loading, ordinary Earth flight/travel, Moon loading
and landing/walk/jump, System map and visible major moons, no new stutter with inactive demand;
inspect F3 at zero resident chunks, activate debug demand near Earth/Moon/Mars, move several chunk
widths and confirm bounded memory/retirement, then disable and confirm zero arrays. Check demand
edges for repeated generation. API steps are in
[the volume README](../../src/world/planet/volume/README.md).

Contract, measured allocation and ordered roadmap:
[planetary-handoff-and-volume-phase1.md](planetary-handoff-and-volume-phase1.md).
Stop at Phase 2: no volume meshes, Marching Cubes/Transvoxel, cave collision, power wiring,
through-body gameplay or changed planetary visuals. Existing shell rendering and single-surface
terrain collision remain authoritative. External untracked iteration documents are untouched.

## SOLAR-12 / Task 012 — 2026-10-02

Baseline: `e0d4e8a460981232678eb067718fddb47fa2b522`, `feat/universe-map`.
The user accepted the previous checkpoint's manual tests and authorized this major-moon set.
Catalog: 19 bodies, adding Io/Europa/Ganymede/Callisto → Jupiter, Titan/Enceladus → Saturn,
Titania/Oberon → Uranus, Triton → Neptune. Earth's Moon remains landable.

The existing SolarSystem remains the hierarchy/state authority. Satellite mean Kepler elements
are catalog-owned and evaluated parent-relative offline; recursive resolution adds both parent
position and velocity. Physical synchronous orientation is independent of the observer. Triton's
157.3° inclination retains retrograde motion. Sources, reference-plane conversion, frozen-ellipse
accuracy limits and preservation of the original lunar ellipse are documented in
[10-solar-system.md](10-solar-system.md).

New moons have shared icy/volcanic/atmospheric profiles, phase light from the live Sun and a
bounded pixel floor. Titan's warm haze uses its existing quad. Selected labels win collisions.
All new moons are solid, non-landable proxies with no terrain/volume provider. The registry
still contains four rocky provider shells (Mercury, Venus, Earth's Moon, Mars), with Earth
specialized separately. The celestial layer grows from 13 to 22 meshes: exactly nine extra quads.
No astronomical positions are written to render objects. Dominant gravity and Warp sweeps stay
generic, as do target selection, live target resolution and arrival clearances.

Map overview shows Sun/planets, with an explicit selected satellite if needed. **Focar luas**
shows the parent and its children in live relative positions, mean orbital paths, names, km
scale, selection and a parent breadcrumb. **Sistema Solar** returns to overview. Focus uses
the orbital reference plane, including Uranus; no second map ephemeris is instantiated.

Validation: **531/531 full unit tests**, **160/160 focused tests**, typecheck and production
build passed. Forty additional test cases cover catalog completeness, parents, physical values,
hierarchical positions/velocities, motion, Triton, synchronous orientation, capabilities/provider
count, generic navigation/Cruise, all nine Warp exclusions, Ganymede/Titan dominant gravity,
render finiteness/bounds/phases, Titan haze, label collision and five parent-map focuses.
Existing Moon/Manaus regressions pass. The lunar NASA payload SHA-256 is unchanged:
`1696df0382263ac9aabc183d0f15e506099d982a66e9ad994852371e6910f628`.

**`npm run test:browser:space` passed against the final production build** using the existing
Playwright/Chromium: all four new planetary focuses, all nine canvas target selections with
immediate highlighting and unchanged player pose, overview return, unchanged four-provider
registry, bounded rendered approaches to Europa/Titan/Triton, and the complete automated
Earth Moon streaming return, ground contact, keyboard walking/jump/takeoff regression.
Captured page/console errors: zero. Screenshots and JSON remain ignored validation artifacts.
**`npm run test:browser` was also run and failed at its existing stale `game.origin` reference**
in `scripts/browser-test.mjs:263` (`TerrainDestruction.update` receives undefined). This older
suite's arming/origin assumptions were already recorded at the baseline; it is not claimed
as passing and was not replaced or bypassed. No browser dependency was installed.

**REQUIRES USER MANUAL VALIDATION for SOLAR-12:** start in Manaus, leave Earth, open M;
focus Jupiter and select/travel toward Europa; inspect parent scale/direction and visual stability;
focus Saturn and inspect Titan's orange haze and Enceladus; focus Uranus for Titania/Oberon;
focus Neptune, approach Triton and inspect high-speed exclusion/jitter; return to Earth's Moon,
land, walk/jump and take off. Automated near-arrival fixtures do not replace this complete trip.

Stop here. Task 013, destruction volume Phase 2, dwarf planets and new moon surfaces are not
part of this checkpoint. Existing untracked iteration documents are not included in the commits.

## Historical SPACE-HARDENING-1 — 2026-10-02 (user manual acceptance received)

Implemented from baseline `f8f451250e564958ffad20d26b72df3fe4c9e6de` on
`feat/universe-map`, including the user's P0 walkable Moon and P1 universal-map additions.
This checkpoint stops feature expansion: Task 012, volume Phase 2 and additional moons remain
outside its scope. Historical entries below describe earlier checkpoints.

- Space camera orientation is quaternion-owned, with continuous pole crossing. Mouse input is
  consumed before thrust; W, the central camera ray, strafing and vertical movement share the
  same camera basis. Ground pitch limits and camera collision remain active locally.
- Environmental audio receives medium and atmospheric density explicitly. Earth wind fades
  continuously with density; vacuum and airless terrain have zero environmental gain. The
  independent effects bus remains available.
- Earth has a 3.5 px point core and 8 px optical extent, then an offline Natural Earth geographic
  proxy aligned to the actual body-fixed frame. Physical radii and logical coordinates are unchanged.
- Moon uses bundled NASA LRO/LOLA elevation and LROC/LOLA appearance. A complete six-face
  fallback covers missing/retired cuts; its conservative DEM envelope stays under refined terrain
  between vertices. Coarse lunar faces use 65×65 samples, local tiles 17×17. Fog and duplicated
  vertex-colour multiplication are disabled. One physical globe replaces the proxy exclusively.
- Landing readiness reserves the 100 m footprint, including neighbouring tiles at boundaries,
  before other branches spend the tile budget. Airless gates measure actual terrain clearance.
  The existing TravelDomain → UniverseRuntime handoff → Game physics binding enters
  `moon/local-enu`; the player falls under the selected body's gravity, becomes `Grounded`,
  walks, jumps and takes off. City debris and fictitious crater notices no longer accompany
  airless landings; a bounded stylized impact and its audio remain.
- The desktop map occupies 94 vw × 88 vh, with a 320 px sidebar and explicit grid areas.
  Its universal canvas follows display dimensions with DPR capped at 2. The System view uses
  live ecliptic XY positions, names, target selection, finite zoom and AU scale text. Interplanetary
  entry defaults to System; a Moon surface never displays the Manaus city map.

Validation: **491/491 unit tests passed** (52 added), **110/110 focused tests passed**,
`npm run typecheck`, `npm run build` and `git diff --check` passed. The build retains the existing
bundle-size advisory. **`npm run test:browser:space` passed** using installed Playwright/Chromium
and the production build: desktop layout/backing size, automatic System view, space quaternion
input, one orbital Moon, streamed Game return, grounded Moon, keyboard walking, jumping and
takeoff; zero captured page/console errors. No browser tooling was installed.

Browser setup uses explicit near-arrival fixtures; it does not establish a complete manual
Earth–Moon–Earth trip. Existing `test:browser` is the older city/ascent suite, whose stale origin
and arming assumptions were recorded in the preceding checkpoint; it is not reported as passing
here. User manual validation remains required for the full 35-case travel/control/phase matrix,
Earth point-to-globe visual quality, lunar limb/seams from multiple landing sites and DPR/resizing
on other hardware. The bundled DEM resolves roughly 15 km at the equator, not centimetre terrain.

Source, reproducible ingestion and size are in [06-geodata-pipeline.md](06-geodata-pipeline.md).
The root causes, changed-file inventory and current runtime contract are in
[10-solar-system.md](10-solar-system.md#space-hardening-1-runtime-contract).

Tracks `dr-manaus-cosmic-world-specs` against the code, phase by phase. Written so that anyone
picking this up knows what is finished, what is half-finished, and what has not been started —
including the things that do not work.

Baseline: `d2e03428b1d9ba90fdc7b2a5112c280e6686fead` (PR #2 merged into `main`).
Branch: `feat/universe-map`.

Current implementation checkpoint: **CELESTIAL-LEGIBILITY-1**, continuing from `4529b9d` after
**SOLAR-11 / Task 011** (`47dd452`). Physical scale and travel remain unchanged; optical point floors,
solar halos, brighter phased Moon shading and bounded/contextual DOM labels improve readability.
Saturn's existing rings fade in between 6 and 9 physical pixels.
The Sun, Moon and all eight planets now share generic celestial presentation and live navigation.
Mercury/Venus/Moon/Mars use a body-keyed rocky-provider registry; Earth retains its specialized
Manaus/WGS84 flow. Stars and giants have exclusion envelopes and cannot land. See
[10-solar-system.md](10-solar-system.md) for capabilities, synthetic-terrain provenance, arrival
policy, render bounds, tests and required manual validation. Task 012 and volume Phase 2 are pending.

This is the progress tracker. The subject documents are listed in [README.md](README.md); the
acceptance criteria are checked one by one in [17-acceptance.md](17-acceptance.md).

## Phase status

| # | Phase | State | Where |
| --- | --- | --- | --- |
| 0 | Freeze baseline | **done** | [`../geodata.md`](../geodata.md) corrected; invariants pinned in tests |
| 1 | Spatial core | **done** | `src/world/spatial/` — [03](03-coordinates-and-frames.md) |
| 2 | Manaus compatibility adapter | **done** | `ManausFrameAdapter` — [05](05-manaus-migration.md) |
| 3 | Global streaming scheduler | **done** (not yet driving Manaus) | `src/world/streaming/` — [07](07-streaming.md) |
| 4 | Earth WGS84 low LOD | **done** — drawn, streamed, lit | `src/world/planet/` — [04](04-earth-and-planet-surface.md) |
| 5 | Global terrain (DEM) | **done** — ETOPO5, real relief | `EarthElevation.ts` — [06](06-geodata-pipeline.md) |
| 6 | Curve Manaus onto the ellipsoid | **partial** — `SurfaceTileFrame` exists; `FEATURES.curvedManaus` is off | `SurfaceTileFrame.ts` |
| 7 | Atmosphere and render domains | **partial** — domains done, atmosphere not | `src/rendering/domains/` — [08](08-render-domains.md) |
| 8 | Remove the 140 km ceiling | **done** — 500 000 km, still a ceiling | `SPACE.maxAltitude` |
| 9 | Solar system | **implemented** — logical model, ten visuals, generic providers/navigation; manual validation pending | `src/world/celestial/` — [10](10-solar-system.md) |
| 10 | Galaxy layer | **partial** — streamed provider, behind its flag | `StarSectorProvider.ts` — [11](11-galaxy-and-universe.md) |
| 11 | Universe sectors | **partial** — addressing and seeds only | `UniverseAddress.ts` — [11](11-galaxy-and-universe.md) |
| 12 | Persistence hardening | **done** — versioned, addressed, IndexedDB | `WorldMutationStore.ts` |
| 13 | Hardening | **verified** | Visual, architectural, ephemeris and coordinates hardening (`tests/earth-transition.test.ts`, `tests/universe-coordinates.test.ts`, `tests/universe-navigation.test.ts`) |

Everything is gated by `FEATURES` in `src/core/config.ts`. `spatialCore`, `earthGlobe` and
`solarSystem` are on. Earth retains the current coverage-aware local/planetary handoff; generic
planet providers share the same global scheduler and do not replace the Manaus implementation.

## What is verified

SOLAR-11 validation on 2026-10-02: 427/427 unit tests, typecheck and production build pass.
The existing browser smoke fails in destruction setup because it still passes removed `game.origin`
to the terrain updater; that stale API is present in the initial HEAD. No browser E2E pass or new
visual approval is claimed. The full planet travel/ring/return matrix requires user manual validation.
Earlier observations at 400 m, 12 km and approximately 236.3 km describe historical Earth checks.

Specific invariants under test:

- WGS84 constants are the defining ones; the ECEF inverse round-trips to sub-millimetre from the
  surface to geostationary altitude.
- The Manaus projection is reproduced bit for bit, and the coordinates the shipped game produced
  before the migration are frozen in the test — if the projection moves, the city moves.
- A rebase never changes a logical position, a distance between objects, or the origin's rotation.
- A tile's four children exactly tile their parent; the poles are ordinary tiles.
- Planet tile vertices land on the ellipsoid *through the full scene transform*, and the residual
  is float32 storage of the offsets — precision scales with the tile, not with the globe.
- The planets sit at their real J2000 distances in the right order; the Moon and the Sun both come
  out about half a degree across.
- Star sectors regenerate identically from the same seed.
- Heavy activations stay capped at two per frame while light ones get their own larger allowance.

## Phase 4 — the globe

Working. From about 15 km the flat backdrop stands down and the WGS84 ellipsoid takes over: a
cube-sphere quadtree refined by screen-space error, streamed through the global scheduler, coloured
from Natural Earth coastlines and lit from the real solar direction. From a few thousand kilometres
up it is a round planet with South America where South America is.

### The five bugs between "all the code exists" and "the planet is on the screen"

Recorded because every one of them presented as something else, and because the first diagnosis was
wrong in a way worth remembering.

1. **Nothing was ever activated.** The scheduler planned, fetched and cached ninety-six tiles and
   put zero of them in the world. `update` fetched before it activated, so planning and loading
   spent the 4 ms frame budget and activation was asked for permission it could never get. The
   stage order is now plan, rank, track, **activate**, fetch, retire, and a frame that is already
   over budget still places one tile. See [07-streaming.md](07-streaming.md).
2. **Planning cost more than the whole streaming budget.** A quadtree selection at orbital altitude
   measured **2.34 ms**, re-derived sixty times a second for a camera that had not moved. It is now
   memoised against camera movement, quality and a replan interval: **0.01 ms**.
3. **The fog was cleared by nulling `scene.fog`.** A material compiled with fog keeps a node that
   reads `scene.fog.color`, so the first fogged draw threw and every object after it in that pass
   was lost — a pass that reported its draw calls and produced no pixels. Fog is now off on the
   globe's own material.
4. **Two render passes do not composite.** The whole two-camera design could not work: in
   `WebGPURenderer` the second `render()` to the screen replaces the first. Replaced by one camera
   and the logarithmic depth buffer, which is what that buffer is for. See
   [08-render-domains.md](08-render-domains.md).
5. **Half the planet was black in full sunlight.** Three of the six cube-face parameterisations
   mirror, so one fixed index order winds outward on half the globe and inward on the other half.
   `DoubleSide` hid that and then lied about the lighting: a back face is shaded with its normal
   flipped, so tiles facing the Sun were shaded as though the Sun were beneath them. The winding is
   now measured per tile from the geometry, and the material is `FrontSide`.

Two more, found earlier and already described in [04](04-earth-and-planet-surface.md): tiles placed
without their rotation, and breadth-first quadtree descent.

### The measurement that mattered

The first conclusion — "the far pass draws and produces no pixels" — came from reading the canvas
back with `drawImage`, which returns black for a WebGL canvas without `preserveDrawingBuffer`
whatever is on it. The whole frame measured black, including frames that plainly were not. Every
later measurement used a composited screenshot instead.

### Shading

The globe shades itself. `MeshBasicNodeMaterial` takes no part in the light list, and the surface is
lit explicitly against a sun uniform in TSL: a lambert term with a terminator softened across a few
degrees, a small night floor for airglow, and a Rayleigh-blue halo that rises with the viewing
angle so the limb is blue and the centre of the disc is not.

That is not a stylistic choice. There is one camera and therefore one light list, and the scene's
lights belong to a city at golden hour — one sun near the horizon and a bright hemisphere fill.
Applied to a planet they wash the day side out and lift the night side off the black, and the
terminator disappears with them. A planet is lit by one star and shades itself.

The stars stayed after all. They had been stood down on the theory that the star sphere carried the
sky gradient; reading the shader showed it does not — the stars are additive points and the
gradient is the shell's. They are back above 15 km, and the shader already fades them below the limb.

### What is still visibly missing

- **No atmosphere as a volume.** The limb is a shading term on the surface, not scattering: there
  is no glow beyond the edge of the globe and no sky seen from inside.
- **No terrain.** Every tile sits at height zero: an ellipsoid, not a landscape.
- The tile under the city is a hole of about 60 km while `coveredByCity` is level-based; harmless
  from orbit, and closed by phase 6.

## Phase 7 — render domains

Done, and not the way it was designed. See [08-render-domains.md](08-render-domains.md) for one
camera, a logarithmic depth buffer, and why two passes were abandoned.

Not done: a planet-aware atmosphere and a global ocean. `Atmosphere.sky` is still a 44 km dome
drawn around the player, and it now stands down above 15 km rather than being replaced.

## Phase 8 — the ceiling

`SPACE.maxAltitude` was 140 km because a flat world has no outside. With the planetary domain it is
500 000 km — past the Moon — while the globe flag is on, and 140 km otherwise.
It is still a ceiling rather than nothing: the phase that removes it entirely is the one that
hands the player into another body's frame.

## Data and licences

| Asset | Source | Licence | Retrieved |
| --- | --- | --- | --- |
| `src/world/geodata/earth-landmask.json` | Natural Earth 1:110m land | Public domain | 2026-09-25 |
| Solar system ephemerides | JPL approximate elements (Standish), embedded as constants | Public domain (US Gov) | n/a — no download |

Neither is fetched at runtime. The Natural Earth download happens only when the build script is
run by hand. Full provenance and the rules that constrain it are in
[06-geodata-pipeline.md](06-geodata-pipeline.md).

## A correction to this document

An earlier revision of this file recorded phase 6 as done, `ManausProvider` as created and
registered, and the Earth handoff gate as removed. None of those were true when written, and the
first two were reversed in the very next commit:

- `ManausProvider` was a stub whose `load` rejected and whose `activate` threw. It was deleted, not
  finished, which is the resolution P0-01 asks for when a provider is not ready.
- `FEATURES.curvedManaus` is **off**. `SurfaceTileFrame` exists and the tile transform is written,
  but the city is not curved in the shipped configuration.
- The 15 km gate and `coveredByCity()` were removed and then restored, because removing them is
  what P0-02 exists to prevent: the city is a flat plane, the globe is an ellipsoid, and they are
  31 m apart at 20 km from the anchor.

The rule that failed here is the one at the top of this folder: a status is a measurement, not an
intention. If a flag is off, the phase is not done.

## Next step

1. **Sprint H2 — `ManausProvider`.** The city still streams through its own `WorldStreamer`, so
   the two budgets are independent and neither knows what the other is spending. This is the piece
   that makes the global scheduler mean something.
2. **Sprint H5 — the travel domain.** P0-04 is half closed: local physics no longer sees FTL
   speeds, but there is no separate domain to put them in, and so no body handoff and no landing
   on the Moon. The altitude ceiling comes out after that works, not before.
3. **Phase 6 — curving Manaus.** `SurfaceTileFrame` is written; turning `curvedManaus` on is what
   closes the 60 km hole under the city and lets the 15 km gate go. Both are gated on it, and both
   are wired to the flag rather than to a constant, so the day it flips they follow.
4. An atmosphere as a volume rather than a shading term on the surface, and an ocean.

## Hotfix v1 — Interplanetary Flight & Terrain Hardening (`feat/universe-map`)

Status: **verified** (T1–T11 unit/integration tests passing; 318 test suite passing; production build clean).

`FEATURES.curvedManaus` remains **`false`**, preserving the legacy flat world baseline without regressions.

### Root causes identified & resolved

1. **Interplanetary flight ping-pong & teleporting:**
   - In orbital / interplanetary space, when Earth was the dominant celestial body, `UniverseRuntime.telemetry` and `spatialContext()` interpreted barycentric coordinates as local Manaus tangent-plane coordinates, passing them to `legacyLocalToGeodetic` / `legacyLocalToEcef`. This produced bogus altitude spikes (millions of metres) and triggered rapid flip-flopping between `interplanetary` and `local` travel domains (`interplanetary → local → interplanetary`), manifesting visually as violent uncontrollable teleportation.
   - Thrust, braking, and velocity clamping in `InterplanetaryController` operated on the absolute barycentric velocity (~30 km/s Earth orbital velocity), causing braking to fling the player backward relative to Earth at orbital speed.
   - Releasing the thrust key (`B`) immediately cleared `requested` and handed the player back to local coordinates, causing instantaneous snapback from deep space.
   - `Game.ts` wrote `floatingOrigin.toRenderLocal()` directly to the player visual proxy on every frame, causing visual and camera jumps during origin rebases.
   - Local systems (`streamer`, `hlod`, `largo`, `discovery`, `population`, `traffic`) continued executing heavy tasks during interplanetary travel.

2. **Ghost ground inside craters:**
   - Although `FEATURES.curvedManaus` was disabled (`false`), `src/world/geodata/terrain.ts` was unconditionally bending `ground-cover`, `terrain-backdrop`, shores, and roads using `surfaceService.legacyPointToRenderLocal()`.
   - `TerrainDestruction.ts` applied crater depth masking only within a narrow vertical band `surfaceMinY <= y <= surfaceMaxY`. The curved backdrop mesh dipped below this band and escaped the cutout node, causing the lower green polygon to render inside crater excavations.

### Changes implemented

- **Frame-aware geodesics (`UniverseRuntime.ts`, `EarthProvider.ts`):** `playerEcef()` and `playerGeodetic()` check `this.telemetry.frame`. Barycentric positions near Earth are transformed to `EARTH_FIXED_FRAME_ID` first, then mapped to WGS84 without ever touching the Manaus tangent plane.
- **Unified dominant body resolution (`UniverseRuntime.ts`):** `resolveBodyContext()` computes altitude against the actual dominant body across both telemetry and spatial context uniformly.
- **Relative flight dynamics (`InterplanetaryController.ts`, `Game.ts`):** Flight controls, thrust, braking, and speed clamping operate strictly on relative velocity `v_rel = v - v_body`. Maximum relative speed is clamped to 222,222 m/s. Dynamic speed metrics for VFX, camera shake, and HUD are derived from relative speed.
- **Coasting on thrust release (`TravelDomain.ts`):** Releasing `B` leaves the player in interplanetary coasting when `altitudeM > returnAltitudeM` (7,000 m).
- **Hysteresis & reentry safety gate (`TravelDomain.ts`):** Transition back to `local` domain requires BOTH low altitude (`altitudeM <= 7,000 m`) and safe relative speed (`speedMps <= 10,000 m/s`).
- **Visual stability & subsystem pause (`Game.ts`):** Floating origin rebasing is active only in `local` mode. In `interplanetary` mode, local streamer, HLOD, largo, discovery, NPC population, and traffic are paused.
- **Flat terrain integrity (`terrain.ts`):** Curvature application across all terrain meshes and road ribbons is strictly gated on `FEATURES.curvedManaus === true`.
- **Sheet crater masking (`TerrainDestruction.ts`):** Terrain sheets (`backdrop`, `ground-cover`, meshes with `userData.terrainSurface === 'sheet'`) use full vertical masking (`crater-sheet`) without the vertical Y band restriction.

### Acceptance test verification (T1–T11)

- **T1:** Barycentric altitude near Earth in orbit (~100 km) evaluates to ~100 km, never ~6,378 km or Manaus-distorted.
- **T2:** 600-frame continuous ascent tracks moving Earth's barycentric trajectory without altitude oscillation.
- **T3:** Releasing `B` at 50,000 m maintains `interplanetary` travel domain and coasts at current velocity.
- **T4:** Reentry gate rejects handoff when altitude is low but speed is excessive (> 10 km/s).
- **T5:** Altitude hysteresis prevents domain flip-flop between 7 km and 9 km.
- **T6:** Braking at orbital speeds slows relative velocity to zero without fighting Earth orbital motion.
- **T7:** Relative velocity is clamped to <= 222,222 m/s.
- **T8:** Floating origin rebase does not shift the player visual model in space.
- **T9:** Flat terrain meshes (`ground-cover`, `backdrop`, `roads`) remain at authored flat elevations when `FEATURES.curvedManaus` is `false`.
- **T10:** `terrain-backdrop` and `ground-cover` receive `'sheet'` crater masking across full vertical depth.
- **T11:** Crater physics depth and visual bowl depth agree within grid tolerance.

## Hotfix P0 — Visual Proxy, 3-Root Scene Separation & Camera-Relative Earth (`feat/universe-map`)

Status: **verified** (326 unit tests passing; typecheck passing; build clean; browser E2E passing full authentic ascent to 1,000 km, nadir orbit and atmospheric reentry).

Baseline HEAD: `2609e4d30901720f9b18e05939f717e590dc7140`

### Root causes identified & resolved

1. **Character visual freeze and HUD 0 km/h at ~9.8 km (Screenshot 2):**
   - Handoff at 9 km disabled `PlayerController.update()` and set `player.velocity.set(0, 0, 0)`.
   - Character animation was previously invoked only inside local `PlayerController.update()`, freezing the 3D model in its last frame.
   - HUD speed readout read `player.velocity.length()` directly, dropping to 0 km/h despite traveling at logical interplanetary speed (~222 km/s / 800,000 km/h).
   - `CameraController` continued running raycast and ground clamping against Manaus terrain colliders while in travel mode.

2. **Black voids, star leakage, and local world fragments at 20–60 km (Screenshot 1):**
   - Single `worldRoot` combined local city, player, and planetary globes. Hiding the world hid the actor; keeping the world drew Manaus floating in deep space.
   - `EarthTransitionController` computed `regionalWeight` in the 20–60 km range, but no regional renderer existed, zeroing `localWeight` and leaving an unrendered void.
   - Without camera-relative rendering, barycentric Earth positions delivered coordinates on the order of 1 AU (~$1.49 \times 10^{11}$ m) into Three.js `Object3D.position`, causing extreme Float32 jitter or clipping outside the far plane.
   - Star layer lacked depth testing against the planet, and Earth materials lacked explicit `depthWrite`, causing stars to shine through the dark side of Earth.

3. **Interplanetary thrust direction mismatch:**
   - Camera look direction was taken in local Manaus ENU axes ($[0, 1, 0]$ = local Up) and added directly to barycentric ecliptic velocity in `InterplanetaryController`.
   - Up from Manaus did not match Up in ecliptic barycentric coordinates, pointing thrust into the planet and triggering the envelope floor clamp.

### Implemented architecture & changes

1. **Three-root scene separation (`Game.ts`):**
   - `localRoot`: Contains city, roads, terrain, water, landmarks, streamer, HLOD, destruction. Completely hidden (`visible = false`) during space flight, preventing floating urban fragments.
   - `actorRoot`: Dedicated group for player and visual proxies. Always visible. Positioned at `(0, 0, 0)` during space travel.
   - `planetRoot`: Dedicated group for camera-relative celestial globes (Earth and Moon).
   - `worldRoot`: Retained as alias to `localRoot` for compatibility.

2. **Visual proxy animation in space (`Game.ts`):**
   - While `localPhysicsActive === false`, `player.character.animate(...)` runs each frame with logical simulation speed, `flying = true`, `boosting = true`, and pose `'interplanetary'`, keeping full cosmic skin, particle trails, and flight pose alive without re-enabling `PhysicsWorld`.

3. **Camera-relative rendering (`RenderSpaceService.ts`, `EarthProvider.ts`, `MoonProvider.ts`):**
   - Implemented `RenderSpaceService` using double-precision math.
   - Translates celestial coordinates relative to the player's reference frame before passing to Three.js `position`.
   - Maximum render coordinate at 1,100 km orbit is strictly bounded to $5.36 \times 10^6$ m, well below the 20,000,000 m Float32 precision limit (NEVER 1 AU).

4. **HUD logical display speed (`HUD.ts`, `Game.ts`):**
   - `HUDState` accepts `speedMps` and `altitudeM`.
   - Displays logical relative speed and true cosmic altitude during spaceflight.

5. **Star occlusion & depth integrity (`EarthGlobe.ts`, `SpaceLayer.ts`):**
   - Earth tile and fallback materials explicitly enforce `depthWrite: true` and `depthTest: true`.
   - Space layer stars enforce `depthTest: true`, occluding all stars behind the globe.

6. **Continuous representation across 20–60 km (`EarthTransitionController.ts`):**
   - Eliminated the phantom regional renderer gap. Crossfades smoothly between local world and Earth planetary view.

7. **Thrust direction transformation (`Game.ts`):**
   - Direction vectors from the camera are transformed via `universe.frames.convertDirection(MANAUS_FRAME_ID, 'solar-system/barycentric', ...)` before reaching `InterplanetaryController`.

8. **Earth Globe & Manaus Alignment & Visual Hardening (`UniverseRuntime.ts`, `EarthProvider.ts`, `EarthGlobe.ts`, `SpaceLayer.ts`, `Game.ts`):**
   - **Suppressed legacy saw-tooth shell (`SpaceLayer.ts`)**: The legacy 48-segment colored sky wedge dome (`this.shell`) and fake sun disc (`this.disc`) are suppressed when `FEATURES.earthGlobe` is active.
   - **Aligned atmosphere mesh pole axis (`EarthGlobe.ts`)**: Rotated `SphereGeometry` via `atmoGeo.rotateX(Math.PI / 2)` to align Three.js Y-up pole with ECEF Z-up polar axis. Guarded inner haze so it is only visible above 20,000 m.
   - **Continuous terrain under Manaus (`EarthProvider.ts`)**: At altitude >= 20,000 m, `coveredByCity` is bypassed so the Earth globe generates continuous high-altitude terrain under Manaus, eliminating the black void hole under the city.
   - **Synchronized local city visibility (`Game.ts`)**: Synchronized `localRoot.visible = localGround` with `flatTerrain.visible = localGround`, ensuring water ribbons and landmarks stand down together with ground backdrop instead of floating in empty vacuum.
   - **Full E2E verification**: `npm test` (326/326 tests pass), `npm run build` (clean 0 errors).

9. **Deterministic Manaus ↔ Earth Integration & 4-Root Architecture (`Game.ts`, `EarthProvider.ts`, `UniverseRuntime.ts`, `PlayerController.ts`, `EarthTransitionController.ts`):**
   - **4-Root Scene Hierarchy (`Game.ts`)**:
     - `celestialRoot`: Contains stars (`SpaceLayer`), star sectors (`StarSectorProvider`), galaxies (`GalaxyProvider`), black holes (`BlackHoleProvider`), cosmic web (`LargeScaleStructureProvider`). Rendered at the deepest background layer.
     - `planetaryRoot`: Contains camera-relative celestial bodies (`EarthProvider` / `EarthGlobe`, `MoonProvider` / `MoonGlobe`).
     - `localWorldRoot` (aliased as `localRoot` and `worldRoot`): Contains terrain, real city, HLOD, roads, airport, Largo, landmarks, forest, local destruction. Hidden cleanly in deep space without affecting player or planets.
     - `actorRoot`: Contains player character model and visual proxies. Always active and visible.
   - **Mathematical Manaus-Earth Lock (`ManausFrameAdapter.ts`, `tests/manaus-earth-integration.test.ts`)**:
     - Verified `MANAUS_ANCHOR` (lat -3.130333°, lon -60.022528°) $\to$ ECEF $\to$ Manaus local round trip error is $< 10^{-6}$ m ($< 1$ mm).
     - Verified landmark heights (Largo, Teatro Amazonas, Arena da Amazônia, Aeroporto, Ponta Negra) sit on the WGS84 ellipsoid matching local terrain heights with 0 km offset.
     - In local world coordinates, Manaus surface [0, 0, 0] sits at Three.js scene position $[-Game.origin.x, -Game.origin.y, -Game.origin.z]$, while Earth center is placed at $[-Game.origin.x, -6378073 - Game.origin.y, -Game.origin.z]$, placing the top of the globe precisely at the city's ground level.
   - **Camera-Relative Barycentric Space Flight (`UniverseRuntime.ts`, `EarthProvider.ts`)**:
     - In interplanetary space (`updateSystemPose`), `renderSpace.origin` is centered on the observer (`playerPose`), calculating `earthSystemPosition - playerSystemPosition`.
     - Completely eliminated dead/dangerous `toSceneMetres`. Coordinates passed into Three.js remain strictly bounded ($< 20,000,000$ m) and never receive astronomical numbers (~$1.5 \times 10^{11}$ m).
   - **Zero-Gap Transition Continuity (`EarthTransitionController.ts`, `Game.ts`)**:
     - Added `effectiveLocalWeight = localWeight + regionalWeight` and `keepLocalFallback = !targetCoverageReady || effectiveLocalWeight > 0.01`.
     - Guaranteed that `localReady || planetReady` is true at every altitude from 0 to 1,000,000 m.
   - **Interplanetary Proxy & Local Simulation Suspension (`PlayerController.ts`, `Game.ts`)**:
     - Added `PlayerController.updateTravelVisual(...)` keeping character model at `(0, 0, 0)` in `actorRoot`, animating in flight pose with `speedMode = 'interplanetary'` and display speed reflecting `currentGameplaySpeedMps()`.
     - Urban physics, colliders, real city, streamer, HLOD, and traffic are completely suspended when `localPhysicsActive === false`.
   - **Deterministic Test Suite (`tests/manaus-earth-integration.test.ts`)**:
     - 7 deterministic integration tests covering anchor round-trip, coordinate budget, relative displacement, altitude continuity, landmark elevation, space proxy stability, and reentry determinism.
     - Full test suite passes: 333/333 tests ok. Build compiles 100% clean. Zero Antigravity browser automation used.
   - **Celestial Visual Pipeline Hardening & Handoff State Machine**:
     - Handled Earth visual proxy representation from interplanetary distances (`EarthVisual.ts`) integrated into `CelestialBodyVisualLayer.ts`.
     - Enforced safe rendering domains via `CelestialPresentationController.ts`, turning off full globe streaming when distant.
     - Corrected `MoonVisual` world-space billboard orientation using `cameraPos` and enabled `uOpacity` blending for smooth crossfades.
     - Hardened `MoonProvider` readiness checks to accurately query `globe.has(key)` rather than relying on abstract tile counts.
     - Added test `T_STREAMING_SPLIT` to strictly prove `updateStreaming()` execution does not duplicate world time `timeS` advancement.
     - Full test suite passes: 340/340 tests ok.




## Hotfix v2 — Mars & Coordinate Authority (eat/universe-map)

Status: **verified** (tests passing, build clean).

### Changes implemented

- **Resolved Coordinate Authority (Task 005):** Eliminated Game.origin duplicate authority over scene positioning. The Game.ts origin is now strictly synced from UniverseRuntime.renderSpace.currentOrigin.position, dropping any direct reads from FloatingOrigin3D in space. This prevents jitter and visual instability during coordinate rebases.
- **Culled Ghost City in Space (Task 006):** In interplanetary travel mode, the local city streamer is fully suspended and localRoot.visible = local; forces the high-detail city meshes to disappear. This prevents floating urban garbage and z-fighting in the orbital view.
- **Planetary Models (Mars):** Completed Mars implementation (MarsProvider, MarsGlobe, MarsSurface) using identical pipeline architecture as Moon, wired into CelestialPresentationController.ts.

## Phases 0–1 — exclusive planetary handoff and sparse volume foundation

Status: the surface handoff and mathematical volume foundation are implemented. This does not yet
include volume chunks, extracted meshes, cave/tunnel collision, or destruction gameplay.

- The Earth transition now has one explicit ground owner plus a shared `local`, `planetary`, or
  `orbital` presentation domain. Detailed near-surface coverage must be ready before the flat local
  ground retires; the coarse fallback alone remains valid for orbital LOD.
- The HUD suppresses Manaus landmarks, local coordinates, mission UI, and the city minimap outside
  the local domain. Celestial and rocky-body transforms use the active `travel/view` render frame.
- The Earth coarse fallback sits 4 m below refined tiles, shares their surface palette and opacity,
  and keeps partial coverage closed without coplanar depth fighting. Atmosphere/limb gains are
  reduced so they do not disguise a surface seam.
- `PlanetVolumeField` derives the intact solid from the existing Earth, Moon, and Mars surface
  generators. Sparse body-fixed `subtract-sphere` and `subtract-capsule` edits compose through CSG
  difference and are indexed by a lazy AABB BVH.
- Versioned per-body JSON stores only the edit history. Generated grids, meshes, and colliders are
  future discardable caches. A through-Earth tunnel is one capsule edit, not a chain of craters or
  a planet-sized allocation.

Architecture, invariants, focused test metrics, limitations, and the Phase 2–10 roadmap are in
[planetary-handoff-and-volume-phase1.md](planetary-handoff-and-volume-phase1.md).

## Checkpoint MANAUS-SURFACE-AUTHORITY-P0 — one local frame for the whole city

Status: **implemented and automated**; the visual acceptance pass in Part T of the checkpoint still
requires manual validation in the running game.

### Root cause

`FEATURES.curvedManaus` is `false`, and the local terrain honoured it: `ground-cover` and
`terrain-backdrop` stayed in the flat legacy projection. The `SurfaceTileFrame` migration
(`2f06e3c`) had meanwhile routed three other local systems through WGS84 tangent frames
*unconditionally*:

| System | File | Behaviour before |
| --- | --- | --- |
| Real streets and lane paint | `src/world/realcity/roads.ts` | every vertex and normal through `legacyPointToRenderLocal` in `toGeometry()` |
| Real building tiles and skyline | `src/world/realcity/RealCityLayer.ts` | tile groups and skyline instances placed by `createSurfaceTileFrame(...).getSceneMatrix()` |
| Procedural chunks | `src/world/chunks/ChunkMeshes.ts` | same tile frame for facades, sidewalks and trees |

Colliders, terrain destruction and local physics stayed flat throughout, so the city had two
spatial authorities at once. The two diverge as the square of the distance from the Manaus anchor,
`d² / 2R`:

| Distance from anchor | Curved surface drop below the flat sheet |
| --- | --- |
| 5 km | ~2 m |
| 10 km | ~8 m |
| 15 km | ~18 m |
| 20 km | ~31 m |
| 25 km | ~49 m |

That is the regression in the screenshots: near the centre the city looked right, and the further
out the player flew the deeper the streets and building bases sank under an unmoved green sheet,
until only roofs showed. A building's visual base and its collider could sit tens of metres apart,
so the mismatch was never only cosmetic.

### Correction

- `src/world/spatial/ManausSurfacePresentation.ts` is now the single authority:
  `localManausPresentationMode()` plus `manausTileSceneMatrix()`, which returns a pure translation
  when flat and the WGS84 tile matrix when curved. `MANAUS_GROUND_COVER_Y` holds the one ground
  height the sheet and the asphalt offsets are measured against.
- Roads, real building tiles, the skyline and the procedural chunks go through that authority. Their
  authored flat coordinates — `ROAD_HEIGHT`, `ROAD_MARKING_LIFT`, footprints, tile origins — are
  untouched.
- Water, scars, landmarks, HLOD proxies and traffic were already gated on the flag; they now read
  the same authority rather than the flag directly, so there is one decision to change.
- `ground-cover` moved from `0.02` to `0` so every road class clears it by at least 2 cm. At the old
  value, a service street at `0.022` had 2 mm of separation, which is inside depth precision.
- `ChunkMeshes.restore()` rebuilt its instance from `group.position`, which is zero now that the
  group carries an explicit matrix. It uses the tile origin, so a restored building returns to where
  it was away from the anchor as well as at it.
- `TerrainDestruction` classifies each ground leaf explicitly (`sheet`, `road`, `plaza`, `band`)
  instead of masking whatever a district subtree contained; walls, roofs, lamps and canopies no
  longer enter crater batches. The airport's kerb road moved into the pavement batch and its
  structures out of it, because a batch is masked as a whole.
- `TerrainDestruction.rebuild()` now publishes the bowl's own bounds. Three.js computes a bounding
  sphere once and never again, and this geometry is a fixed buffer rewritten in place: recentering
  moves the written window and a growing span changes the grid step. A downward ray through the
  middle of a 640 m crater found no triangle after an 850 m recenter while physics still reported
  the floor 180 m down. Rendering had survived on `frustumCulled = false`.

### Verification

`tests/manaus-surface-authority.test.ts`, `tests/manaus-procedural-surface.test.ts` and
`tests/manaus-crater-coverage.test.ts` cover the flat frame, the collider/visual agreement, the
surface height order, the dormancy of `SurfaceTileFrame` while the flag is false, the still-working
curved path, and crater mask/bowl/collision coverage. `T_FLAT_MANAUS_ONE_SURFACE_AUTHORITY` is the
structural guard: any file outside `src/world/spatial/` that reaches for a curvature conversion must
also consult the authority, so the next partial migration fails in CI rather than in a screenshot.

`npm run test:browser:manaus` samples the shipped builders at 0, 5, 10, 15 and 20 km: ground, road,
arterial, marking, building base and collider base all report their authored heights with zero sag,
and tile matrices are pure translations.

Known gap: `tsconfig.json` includes only `src`, so `npm run typecheck` does not typecheck `tests`.
A test in this checkpoint called `RoadNetwork.update(Vector3, 0)` against a `(x, z, speed)`
signature and failed at runtime instead of compile time. Including `tests` currently surfaces 314
pre-existing errors, mostly a missing `node` entry in `compilerOptions.types`.

---

## Checkpoint P0.2: Fidelity Hardening, River Segments, WebGL Robustness & Sun E2E

- **Baseline**: `22e765d5b86d92c5a9acd9d434348cfe7c11b10f`, `feat/universe-map`.
- **Rios Continentais Independentes**: Corrigida omissão de afluentes secundários em `EarthContinentalRiverRenderer` e `PlanetMap3DRenderer`. Extração de todos os segmentos independentes com `EarthRiverLayer.getRiverLines` e renderização de linhas sem conexões artificiais entre bacias.
- **Interpolação Geodésica por SLERP**: Substituída interpolação linear ingênua por SLERP geodésico na esfera unitária, prevenindo que rios cortem por dentro do planeta.
- **Robustez de WebGL & Fallback 2D**: `PlanetMap3DRenderer` agora só ativa `mode = 'gpu-3d'` se a criação do `WebGLRenderer` for bem-sucedida. Falhas ou indisponibilidade de contexto ativam automaticamente `mode = '2d-fallback'` com render 2D completo (globo, continentes, rios e marcadores de Manaus/jogador).
- **Cobertura de Testes do Mapa 3D**: Expandido `tests/earth-map-3d.test.ts` com testes de fallback sem WebGL, fallback em exceção do construtor, rios multisegmentados, redimensionamento de canvas e orientação canônica de Manaus.
- **Pouso Solar End-to-End**: Criado teste de integração `T_SUN_FULL_E2E_LANDING_AND_TAKEOFF_CYCLE` em `tests/sun-approach.test.ts` cobrindo o ciclo completo: acionamento real de `KeyF` -> ativação da intenção -> aproximação -> handoff para fotosfera (`sun/local-enu`, gravidade 9.8 m/s², distrito FOTOSFERA) -> caminhada local na superfície -> decolagem vertical com retorno a voo interplanetário.
- **Gates**: `npm run typecheck` (0 erros), `npm run test:regression` (635/635 pass), `npm run check:impact-fidelity` (24/24 pass), `npm test` (1.424/1.424 pass), `npm run build` (sucesso).
- **Bloqueio**: U4 e BH0–BH2 continuam estritamente bloqueados.

---

## Checkpoint P0.5.8: CCD Physical Collision Restoration & Flight Assistance Decoupling

- **Baseline**: `22296770dcc266b8668c5f7da6751f1b179a6803`, `feat/universe-map`.
- **Causa Raiz Corrigida**: Removido clamp prematuro pré-CCD (`newSpeed = Math.min(newSpeed, proximitySpeedCapMps(0))`) em `CosmicFlight.ts` que truncava o raio de sweep de colisão contínua para 20 km/s antes da detecção física, suprimindo o contato no Sol e nos planetas e degradando a energia de impactos catastróficos.
- **Desacoplamento de Voo Cósmico**: Gating de velocidade por proximidade restrito estritamente a voos cósmicos superluminais (`isCosmic || currentRelSpeed > 256 * LIGHT_SPEED_MPS`), permitindo testes e voos manuais com velocidades físicas completas.
- **Detecção Contínua Pura (CCD)**: Restabelecido o cálculo do vetor de trajetória real para `sweepSegmentSphere`, garantindo emissão correta de `CelestialContact` com velocidade pré-impacto real, absorção inelástica sem ricochete na fotosfera, ausência de tunelamento e acionamento de `emergencyStopActive = true` com razão `'ccd-contact'`.
- **Documentação de Engenharia**: Elaborado documento [docs/world/34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md](file:///c:/Projetos/Dr-Manaus/docs/world/34-status-P0.5.8-CCD-PHYSICS-RESTORATION.md) com análise detalhada, fluxo de dados, fórmulas matemáticas e matriz de testes.

---

## Checkpoint U4.2.2: Resolução do CI (TS2339), Alinhamento Geométrico Coplanar e Cache GPU com Contagem de Referências

- **Baseline**: `7d828974e3ff24e433911ebf34a9ed593c29dca4`, `feat/universe-map`.
- **Causa Raiz TypeScript Corrigida**: Substituída a referência inválida `descriptor.hubbleType` por `descriptor.morphology` em `GalaxyPointCloudProvider.buildPointCloudCacheKey`, satisfazendo estritamente a tipagem estática de `ProceduralGalaxyDescriptor`.
- **Alinhamento Coplanar dos LODs**: Rotação de -90° em torno de X (`rotateX(-Math.PI / 2)`) em `lod0Geometry` e `lod1DiscGeometry`. Agora LOD 0 (impostor quad), LOD 1 (disco intermediário) e LOD 2 (nuvem de partículas) compartilham estritamente o mesmo plano equatorial galáctico X-Z com vetor normal ao longo de +Y, eliminando rotações aparentes de 90° e popping visual nas fronteiras de histerese.
- **Pré-Aquecimento Preditivo de LOD 2**: Implementado gatilho anti-stuttering síncrono em `GalaxyMorphologyRenderer.update` ao atingir 60% do limiar de transição em LOD 1 (`projectedPx >= lodThreshold12 * 0.6`). O buffer GPU de partículas é construído e alocado no cache antes da transição efetiva, tornando a entrada em LOD 2 uma operação $O(1)$.
- **Cache LRU Seguro com Contagem de Referências**: Adicionado gerenciamento de ciclo de vida com `retain`/`release` em `GalaxyPointCloudProvider`. Geometrias ativas em cena (`refCount > 0`) jamais sofrem descarte (`.dispose()`) ao ocorrer evicção da tabela LRU.
- **Propagação de Viewport Real**: `Game.ts` e `GalaxyMaterializer.ts` propagam a altura real do canvas (`renderer.domElement.clientHeight || window.innerHeight`) e o FOV vertical efetivo da `PerspectiveCamera`.
- **Correção de Fixtures e Cobertura de Testes**: Corrigida a fixture `nearbySatellite` com todos os campos obrigatórios de `GalaxyDefinition`; adicionados testes `T_U422_01_COPLANAR_XZ_ORIENTATION_AND_PREDICTIVE_PREHEATING` e `T_U422_02_REFERENCE_COUNTED_CACHE_AND_SAFE_EVICTION` em `tests/galaxy-morphology-renderer.test.ts` (15 testes no total).
- **Servidor Dev na Porta 9999**: Configurado `vite.config.ts` e `package.json` para escutar na porta 9999 via `0.0.0.0:9999`, liberando a porta 5173 para uso simultâneo conforme solicitação explícita do operador.
- **Bloqueio**: U4.3 e BH0–BH2 continuam estritamente bloqueados até validação oficial do CI no GitHub Actions.

---

## Checkpoint U4.2.3: Ajuste de Contratos Estatísticos Morfológicos, Invariância Canônica e Validação do Cache GPU

- **Baseline**: `4d6823424e3e2a79d1d9b1ff435392691d7c950c`, `feat/universe-map`.
- **Causa Raiz 1 (Morfologia Espiral - T_U42_02)**: O teste anterior exigia `mwMaxAbsY < 0.5` absoluto para todas as 5.000 partículas. Porém, o gerador procedural modela legitimamente o halo esferoidal estelar ($z = r_{\text{halo}} \cos(\theta) \times 0.82$, atingindo até $1.025$ para estrelas externas do halo, ~1.8% do total). O contrato foi corrigido com métricas estatísticas rigorosas: concentração planar do disco ($\ge 90\%$ com $|Y| \le 0.25$), espessura RMS vertical do disco ($RMS < 0.15$), fração de estrelas externas do halo ($< 5\%$) e contraste claro contra galáxias elípticas ($RMS_{\text{ell}} > 1.5 \times RMS_{\text{mw}}$, dominância de populações avermelhadas $R > B$ em $> 85\%$).
- **Causa Raiz 2 (Invariância Canônica vs Procedural - T_U421_01)**: O teste anterior supunha que fornecer sementes universais distintas para `cell (0, 0, 0)` no índice 0 produziria descritores com sementes diferentes. Por contrato do U4.1, a célula `(0, 0, 0)` no índice 0 é a Via Láctea canônica com seed estática (`0x4d494c4b59574159n`). O teste foi reformulado para validar: (1) invariância de chave da Via Láctea canônica perante diferentes sementes universais; (2) unicidade e diferenciação de chaves em células procedurais com sementes distintas; (3) diferenciação por dimensões visuais (`diameterLy`) e presets de qualidade; (4) reutilização $O(1)$ de buffers e limite de evicção LRU em 3 entradas.
- **Modelo de Pré-Aquecimento LOD2**: Documentado com precisão que `preheatLod2()` opera sincronamente no frame loop ao atingir 60% da transição de LOD1, antecipando a alocação para tornar a transição $O(1)$. Streaming assíncrono em worker permanece planejado para uma passagem futura de performance.
- **Porta 9999**: Preservada a configuração em `package.json` e `vite.config.ts`, atendendo à solicitação explícita do operador devido à ocupação prévia da porta 5173 por outra aplicação de desenvolvimento.
- **Bloqueio**: U4.3 e BH0–BH2 continuam estritamente bloqueados até validação oficial do CI no GitHub Actions.


