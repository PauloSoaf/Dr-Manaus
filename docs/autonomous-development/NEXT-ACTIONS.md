# DR-MANAUS | Next Actions — Sequência de Execução Retomável

Este plano define a sequência de engenharia estrita para conduzir o desenvolvimento autônomo sem necessidade de novos prompts.

---

### Passo 1: Validação do Hotfix U4.5.4.1 (Concluído)
- Commit: `c48fc64b456cf489d038050bdfca09f1c9dc6d56`
- Status: Publicado na branch `feat/universe-map`.

### Passo 2: Inicialização do Milestone BH0 (Buracos Negros — Modelo Astrofísico e Descritor)
1. Criar `src/world/celestial/BlackHoleDescriptor.ts`:
   - Constantes físicas $G = 6.67430 \times 10^{-11}\text{ m}^3\text{kg}^{-1}\text{s}^{-2}$, $c = 299792458\text{ m/s}$, $M_\odot = 1.98847 \times 10^{30}\text{ kg}$.
   - Funções analíticas: `schwarzschildRadiusM(massKg)`, `kerrHorizonRadiusM(massKg, spin01)`, `photonSphereRadiusM(massKg, spin01)`, `iscoRadiusM(massKg, spin01)`, `blackHoleShadowRadiusM(massKg)`.
   - Perfis canônicos para Sagittarius A* ($M = 4.297 \times 10^6 M_\odot$, spin $\approx 0.9$) e M31* ($M \approx 1.4 \times 10^8 M_\odot$).
   - Suporte a geração determinística de buracos negros estelares raros a partir de sementes de setores cósmicos.
2. Integrar `BlackHoleDescriptor` em `UniversalTargetCatalog.ts` e `UniversalNavigationTarget.ts`:
   - Suporte nativo à busca e navegação para buracos negros centrais e estelares, com `landingMode: 'none'` e apresentação precisa no Atlas Cósmico.
3. Atualizar `BlackHoleProvider.ts`:
   - Conectar aos descritores relativísticos reais e sombras ópticas ampliadas.
4. Desenvolver suíte `tests/black-hole-astrophysics-bh0.test.ts`.
5. Validar via `npm run typecheck`, documentar em `docs/world/` e publicar.

### Passo 3: Milestone BH1 (Dinâmica Gravitacional e Captura de Horizonte)
- Atração newtoniana $\propto 1/r^2$ a distâncias médias e curvatura/arrasto relativístico próximo ao ISCO.
- Efeito de horizonte de eventos e estado de captura (perda de controle de voo convencional se ultrapassar o horizonte, requerendo poderes especiais para escape).

### Passo 4: Milestone BH2 (Rede Determinística de Travessia Cósmica)
- Trânsito de dobra e túnel dimensional através de buracos negros centrais: `universeSeed + sourceBlackHoleId + traversalCounter` mapeando deterministicamente para saídas persistentes no cosmos.

### Passo 5: Milestone U5 (Mapa Universal Interativo em Múltiplas Escalas)
- Navegação aninhada de Manaus ao Sistema Solar, Setor Estelar, Galáxia, Grupo Local, Superaglomerado e Teia Cósmica.

### Passo 6: Milestone U6 (Estrutura Cósmica e Horizonte Observável)
- Expansão cosmológica e horizonte do universo observável relativo ao observador.

