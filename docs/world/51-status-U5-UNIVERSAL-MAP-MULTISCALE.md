# U5 — Mapa Universal Multiescala Interativo, Hierarquia Canônica e Modelo de Coordenadas Compartilháveis (2026-11-11)

## Contexto & Objetivos

Conforme estabelecido em `specs/UNIVERSE-MAP-COMPLETION-EPIC.md` (linha 57) e detalhado nas especificações de arquitetura de teleporte e mapa universal `03-UNIVERSAL-MAP-UX.md` e `04-COORDINATE-MODEL.md`:
- **Unificação de Autoridade Espacial**: O painel do Mapa Universal (`M`) consome exclusivamente o estado lógico da navegação (`UniverseRuntime.navigationState`), nunca reconstruindo posições a partir de coordenadas de renderização ou telemetria isolada da Terra.
- **Hierarquia Canônica de Breadcrumbs Sem Fabricações**: A árvore de navegação exibe os 6 níveis canônicos reais quando aplicáveis (`UNIVERSE / LOCAL GROUP / MILKY WAY / SOL / TERRA / MANAUS`), omitindo níveis inexistentes quando o observador está em espaço interestelar, em outros corpos ou em galáxias procedurais exteriores.
- **Metadados de Precisão Sólidos**: Todo alvo e coordenada exposta possui precisão formal explícita (`measured`, `approximate`, `procedural`, `gameplay-placeholder`), impedindo que vetores sintéticos ou aproximados sejam rotulados como dados observacionais reais.
- **Formato Compartilhável `drm:v1://`**: Serialização e deserialização idempotente de endereços universais com preservação exata de inteiros `BigInt` de 64 bits para setores cósmicos, sem perda de bits e sem dependência de formatação decimal localizada.
- **Busca Universal Resolvida**: Mecanismo de busca dinâmico integrado ao catálogo universal, suportando corpos solares, galáxias canônicas e procedurais, âncoras cósmicas e buracos negros, focando o nível adequado de zoom sem mutação de posição do jogador.

---

## Implementação Realizada

### 1. `src/ui/map/MapNavigationModel.ts`
- Implementação dos tipos `MapPrecision` (`measured` | `approximate` | `procedural` | `gameplay-placeholder`) e `MapScaleTier` (`surface` | `planet` | `system` | `sector` | `galaxy` | `local-group` | `cosmology` | `atlas`).
- Método `resolveHierarchy(currentLevel, focusBodyName)`: Constrói a lista hierárquica `BreadcrumbItem` canônica respeitando a presença de Grupo Local (`isLocalGroupGalaxy`), galáxia, sistema, corpo e superfície, garantindo nunca fabricar níveis irreais.
- Método `evaluateLocationPrecision(location)` e `getPrecisionForTarget(target)`: Atribui formalmente a precisão física e observacional de cada alvo e localização do jogador.
- Método `search(catalog, rawQuery, currentGalaxyId)`: Pesquisa unificada no `UniversalTargetCatalog` e em descobertas procedurais com status de disponibilidade e orientação de voo.
- Método `formatShareableUri()`: Geração direta de URIs `drm:v1://` preservando `BigInt` da localização do jogador.

### 2. `src/world/spatial/UniverseCoordinates.ts`
- Adicionados métodos utilitários:
  - `toTeleportTarget(location: UniverseLocation): TeleportTarget`
  - `formatLocation(location: UniverseLocation): string`
  - `fromTargetDescriptor(target: UniversalTargetDescriptor): TeleportTarget`
- Garantia de roundtrip perfeito para alvos geodéticos de superfície, órbitas, posições em sistemas solares, setores cósmicos com `BigInt` arbitrário e coordenadas cosmológicas em megaparsecs.

### 3. `src/ui/map/UniversalMapPanel.ts`
- Botão interativo `COPIAR URI` acoplado ao modelo de coordenadas para exportação direta de `drm:v1://...` para a área de transferência.
- Integração da hierarquia dinâmica de breadcrumbs clicáveis com títulos exibindo a precisão de cada nó.
- Rotulagem explícita de precisão (`measured`, `approximate`, `procedural`) no cartão de localização atual (`where-am-i-card`) e no cartão de alvo (`universal-target-card`).
- Coordenação de coordenadas com sufixo `(aprox)` em coordenadas interestelares/cosmológicas para evitar falsa impressão de exatidão astronômica.
- Suporte a busca no campo de coordenadas universais (ao pressionar Enter ou clicar em `TRANSLOCAR` / `BUSCAR / IR`), selecionando e focando o alvo correto na escala apropriada.

---

## Validação Automatizada

Suíte dedicada em `tests/universal-map-multiscale-u5.test.ts` (100% aprovada, 7/7 testes):

| Identificador do Teste | Descrição da Validação | Status |
| :--- | :--- | :--- |
| `T_U5_01` | Hierarquia de breadcrumbs canônica sem fabricação de níveis (Manaus, Lua, Sol, Via Láctea, Andrômeda e galáxias procedurais) | APROVADO |
| `T_U5_02` | Autoridade de localização única e avaliação estrita de precisão (`measured`, `approximate`, `procedural`) | APROVADO |
| `T_U5_03` | Roundtrip de URIs compartilháveis `drm:v1://` com preservação exata de `BigInt` em coordenadas de setor cósmico | APROVADO |
| `T_U5_04` | Busca universal de alvos por nome e identificador com metadados padronizados de navegação e precisão | APROVADO |
| `T_U5_05` | Transições de níveis de mapa (`surface`, `planet`, `system`, `galaxy`, `cosmology`, `atlas`) sem efeito colateral na física do jogador | APROVADO |
| `T_U5_06` | Renderização de metadados e badges de precisão no cartão do alvo universal | APROVADO |
| `T_U5_07` | Navegação reativa ao clicar em itens do breadcrumb | APROVADO |

Regressões permanentes e marcos recentes (`cosmic-atlas-u452`, `universe-coordinates`, `bh0`, `bh1`, `bh2`, `u5`): **49/49 testes aprovados**.
`npm run typecheck` (`tsc --noEmit`): **0 erros**.
`npm run build` (Vite 8.3.0): **Build de produção concluído com sucesso**.
