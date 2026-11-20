# DR-MANAUS | Patch U4.5.3.1 — Integração Real dos Mundos Procedurais ao Atlas, Taxonomia Canônica e Precisão de Pouso

## 1. Visão Geral

- **Patch:** U4.5.3.1
- **Título:** Integração Real dos Mundos Procedurais ao Atlas, Taxonomia Canônica e Precisão de Pouso
- **Baseline Auditado:** `356b98eb3041b21bba488751c37d1fbbb621d9c1` (GitHub Actions Runs `42543820898` e `42543814817`, 100% aprovado, 1.573/1.573 testes, 638/638 regressões permanentes).
- **Branch de Trabalho:** `feat/universe-map`
- **Repositório:** [https://github.com/PauloSoaf/Dr-Manaus](https://github.com/PauloSoaf/Dr-Manaus)

---

## 2. Objetivos e Entregas

### P0 — Registro Real de Mundos Procedurais no Atlas
- **Diagnóstico:** Anteriormente, `CosmicAtlasModel.recordDiscovery()` registrava apenas galáxias e sistemas estelares inteiros. Corpos procedurais individuais (planetas e estrelas de sistemas procedurais) não entravam no mapa interno de alvos do Atlas (`targetMap`), impossibilitando a persistência de favoritos de corpos procedurais ou sua listagem direta em consultas após chegada no sistema.
- **Solução Arquitetural:**
  1. Introduzido o mapa `discoveredBodies = new Map<string, UniversalTargetDescriptor>()` no `CosmicAtlasModel`.
  2. Em `recordDiscovery()`, ao identificar um sistema estelar procedural (`kind === 'system'`), o Atlas consulta deterministicamente os corpos filhos do sistema através de `catalog.proceduralDescriptor()` e `catalog.proceduralTarget()`, populando automaticamente os descritores no catálogo do Atlas.
  3. Em `recordArrival()`, a chegada física em qualquer sistema procedural registra o sistema e todos os seus corpos no Atlas, marcando como visitado (`isVisited === true`) exclusivamente o corpo em que o jogador ancorou (mantendo os corpos irmãos como descobertos, mas `visited === false`).
  4. Adicionada resolução de chaves universais e identificadores procedurais em `UniversalTargetCatalog.find(query)`: strings no formato `universe/:galaxyId/:x,:y,:z/system/:systemId[/(body|star)/:bodyId]` e IDs diretos de corpos/estrelas agora são decodificados e convertidos deterministicamente no respectivo `UniversalNavigationTarget`.
  5. Adicionado suporte a `discoveredTargets?: string[]` em `SaveManager` (`SaveData`), persistindo e restaurando descobertas procedurais e favoritos sem quebra de compatibilidade.

### P1 — Classificação Canônica Correta
- **Diagnóstico:** O cartão de navegação e o Atlas utilizavam `isCanonicalGalaxyId(t.galaxyId)` para determinar a canonicidade do alvo. Como sistemas procedurais da Via Láctea compartilham `galaxyId === 'milky_way'`, planetas procedurais gerados eram incorretamente rotulados como "Canônica".
- **Solução Arquitetural:**
  1. Implementada a função exportada `isCanonicalTarget(desc: UniversalTargetDescriptor): boolean`.
  2. Distinção estrita da taxonomia:
     - **Galáxias:** Canônicas apenas se pertencerem ao catálogo canônico do Grupo Local (`milky_way`, `andromeda`).
     - **Sistemas:** Canônico exclusivamente se `objectId === 'sol' && galaxyId === 'milky_way'`.
     - **Corpos Celestes:** Canônicos exclusivamente se pertencerem ao Sistema Solar (`systemId === 'sol'` e presentes em `SOLAR_BODY_PROFILES` ou `objectId === 'sun'`). Corpos procedurais na Via Láctea recebem `isCanonical === false`.
     - **Buracos Negros & Âncoras:** `sgra` (Sagittarius A*), Norma Cluster e Horizonte Observável mantêm classificação canônica.
  3. No cartão lateral (`UniversalMapPanel`), a classificação agora reflete a identidade real:
     - Galáxias: `'Galáxia Canônica'` vs `'Galáxia Procedural'`.
     - Sistemas: `'Sistema Catalogado'` vs `'Sistema Procedural'`.
     - Corpos: `'Corpo Canônico (Sistema Solar)'` vs `'Corpo Procedural Sintético'`.

### P1 — Pousabilidade e Condições de Superfície Autênticas
- **Diagnóstico:** No U4.5.3, o Sol apresentava o texto `"✓ Pouso permitido (sólido)"` porque `canLand` era `true`, desconsiderando o `landingMode === 'photosphere'` implementado na arquitetura física. Além disso, estrelas procedurais genéricas precisavam de indicação clara de impossibilidade de pouso.
- **Solução Arquitetural:**
  1. No cartão `#universal-target-card`, o rótulo de pouso avalia `landingMode` e a classe do corpo (`bodyClass`):
     - `landingMode === 'photosphere'` (Sol): `<span style="color:#fde047;font-weight:600;">✓ Entrada permitida na fotosfera</span>`.
     - `canLand && landingMode === 'surface'` (Mundos sólidos / telúricos / luas): `<span style="color:#4ade80;font-weight:600;">✓ Pouso permitido (superfície sólida)</span>`.
     - Gigantes gasosos e gelados: `<span style="color:#f87171;font-weight:600;">✗ Pouso impossível (gigante fluido)</span>`.
     - Estrelas procedurais: `<span style="color:#f87171;font-weight:600;">✗ Sem pouso (fotosfera inóspita)</span>`.
  2. Distinção de rótulo de temperatura entre corpos observados e estimativas teóricas:
     - Corpos solares canônicos: `Temperatura Média (observada)`.
     - Mundos procedurais sintéticos: `Temperatura de Equilíbrio (estimada)`.
  3. No Atlas Cósmico (`renderAtlasView`), os badges de cartão exibem `'✓ Fotosfera'` para o Sol, `'✓ Pousável'` para mundos sólidos e `'Apenas observável'` para gigantes e estrelas inóspitas.

### P1 — Precisão dos Dados Astrofísicos
- Corrigida a descrição de mundos oceânicos em `SystemGenerator.ts`: removida a alegação sem suporte de "atmosfera respirável", substituída por `"Mundo temperado com hidrosfera líquida e atmosfera rica em voláteis (composição não confirmada)."`.
- Suporte a consultas com e sem acentos no Atlas Cósmico (ex: `"oceânico"` e `"oceanico"`, `"vulcânico"` e `"vulcanico"`) via normalização NFD Unicode.

### P2 — Registro da Experiência Visual Real (Limites Atuais da Superfície)
- **Documentação de Engenharia Gráfica:**
  - Em espaço orbital / visualização externa, mundos procedurais contam com variações completas de albedo físico espectral, névoas Rayleigh/Mie (`haze`), halos ópticos, faixas atmosféricas e anéis planetários analíticos.
  - Conforme estabelecido em `src/world/planet/BodySurfaceFactory.ts`, corpos procedurais telúricos e planetas como Mercúrio e Vênus utilizam a casca elipsoidal `synthetic-base`: `heightAt: () => 0`, normais esféricas radiais e albedo uniforme da superfície.
  - O pipeline de relevo procedural volumétrico (`PlanetVolumeField` com altura e hidrosfera por ruído multiescala) permanece como escopo futuro de aproximação de terreno detalhado, sem falsas promessas no código atual.

---

## 3. Arquivos Modificados e Criados

1. [src/core/SaveManager.ts](file:///c:/Projetos/Dr-Manaus/src/core/SaveManager.ts) (Modificado)
   - Adicionado `discoveredTargets?: string[]` em `SaveData` e `defaults()`.
   - Adicionados métodos `isDiscoveredTarget(key)` e `discoverTarget(key)`.
2. [src/world/travel/UniversalTargetCatalog.ts](file:///c:/Projetos/Dr-Manaus/src/world/travel/UniversalTargetCatalog.ts) (Modificado)
   - Decodificação de chaves de alvos procedurais universais (`universe/.../system/.../body/...`) em `find(query)`.
   - Resolução determinística por identificadores de corpos procedurais (`milky_way/17,-2,4/0_planet_0`, etc.).
3. [src/world/exploration/CosmicAtlasModel.ts](file:///c:/Projetos/Dr-Manaus/src/world/exploration/CosmicAtlasModel.ts) (Modificado)
   - Exportada a função `isCanonicalTarget(desc: UniversalTargetDescriptor): boolean`.
   - Adicionado mapa `discoveredBodies` e campo `landingMode?: 'none' | 'surface' | 'photosphere'` em `CosmicAtlasEntry`.
   - Propagação de corpos procedurais em `recordDiscovery()` e `recordArrival()`.
   - Busca no Atlas com normalização diacrítica (insensível a acentuação).
   - Exportação e importação de estado estendidas com `identifiedSystems` e `discoveredBodies`.
4. [src/world/celestial/SystemGenerator.ts](file:///c:/Projetos/Dr-Manaus/src/world/celestial/SystemGenerator.ts) (Modificado)
   - Correção textual do perfil ambiental oceânico para atmosfera rica em voláteis (não confirmada).
5. [src/ui/map/UniversalMapPanel.ts](file:///c:/Projetos/Dr-Manaus/src/ui/map/UniversalMapPanel.ts) (Modificado)
   - Classificação taxonômica precisa por tipo (`Galáxia Canônica/Procedural`, `Sistema Catalogado/Procedural`, `Corpo Canônico/Procedural`).
   - Avaliação rigorosa de `landingMode` (`fotosfera`, `superfície sólida`, `gigante fluido`, `fotosfera inóspita`).
   - Distinção entre `Temperatura Média (observada)` e `Temperatura de Equilíbrio (estimada)`.
   - Badges do Atlas atualizados com `'✓ Fotosfera'`.
6. [tests/atlas-procedural-integration-u4531.test.ts](file:///c:/Projetos/Dr-Manaus/tests/atlas-procedural-integration-u4531.test.ts) (Novo)
   - Suíte de 6 testes completos validando parsing de chaves universais procedurais, taxonomia canônica, propagação de descobertas na chegada, persistência de favoritos de corpos procedurais no SaveManager, consultas acentuadas e renderização de cartão de navegação.
7. [docs/world/15-status.md](file:///c:/Projetos/Dr-Manaus/docs/world/15-status.md) (Modificado)
8. [docs/world/45-status-U4.5.3.1-ATLAS-PROCEDURAL-INTEGRATION.md](file:///c:/Projetos/Dr-Manaus/docs/world/45-status-U4.5.3.1-ATLAS-PROCEDURAL-INTEGRATION.md) (Novo)

---

## 4. Roteiro de Homologação Manual

1. Iniciar o jogo na porta 9999 (`http://localhost:9999`).
2. Abrir o Mapa Universal com a tecla `M` e entrar no modo `Atlas`.
3. Selecionar o **Sol**:
   - Verificar no cartão `#universal-target-card`:
     - Classificação: `Corpo Canônico (Sistema Solar)`.
     - Temperatura: `Temperatura Média (observada) 5772 K (5499°C)`.
     - Pouso: `✓ Entrada permitida na fotosfera`.
   - No grid do Atlas, verificar badge: `✓ Fotosfera`.
4. Selecionar a **Terra**:
   - Verificar: `✓ Pouso permitido (superfície sólida)`.
5. Selecionar **Júpiter**:
   - Verificar: `✗ Pouso impossível (gigante fluido)`.
6. No campo de busca do Atlas, pesquisar por `"oceânico"` e depois por `"oceanico"`:
   - Validar que em ambas as grafias os mundos oceânicos são localizados.
7. Chegar a um sistema estelar procedural na Via Láctea:
   - Verificar no cartão lateral que o sistema é classificado como `Sistema Procedural` (e não como "Canônica").
   - Verificar que os planetas são classificados como `Corpo Procedural Sintético`.
   - Adicionar um planeta procedural aos favoritos (`★ FAVORITAR`).
   - Recarregar a página (F5) e reabrir o Atlas:
     - Filtrar por `★ Favoritos`: validar que o planeta procedural favorito continua presente com todos os seus atributos intactos.
