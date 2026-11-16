# DR-MANAUS | Active Patch Execution

## 1. Identificação do Patch
- **Patch ID:** `BH-LENS-AND-LOCAL-GROUP-01`
- **Título:** Orçamento de lente gravitacional (`selectBlackHoleLodTiers`), disco de acreção com gradiente térmico radial e Doppler beaming relativístico em `BlackHoleProvider`, catálogo estendido do Grupo Local (`LOCAL_GROUP_EXTENDED_CATALOG`) e paridade de Manaus curva habilitada
- **Status:** `IMPLEMENTED`
- **Branch Alvo:** `feat/universe-map`

---

## 2. Escopo Técnico Implementado
1. **Orçamento de Lente Gravitacional e Tiers de Buraco Negro (`src/world/streaming/CosmicLodBudget.ts`)**:
   - Implementada `selectBlackHoleLodTiers(candidates, quality)` garantindo no máximo `1` buraco negro com lente completa (`full-lens`) quando dentro do limiar `distanceRs <= 60` (`lensingIntensity01 > 0`), até `4` em detalhe intermediário (`mid-detail`) e os demais como pontos (`far-point`).
2. **Disco de Acreção com Gradiente Térmico Radial e Doppler Beaming (`src/world/providers/BlackHoleProvider.ts`)**:
   - Atributo `color` por vértice no disco anular com gradiente térmico radial (borda interna ISCO incandescente até borda externa laranja profunda) e assimetria relativística Doppler (`+X` aproximando mais brilhante que `-X` afastando), além de rotação contínua em `update()`.
3. **Catálogo Estendido do Grupo Local (`src/world/celestial/GalaxyDefinition.ts`)**:
   - Exportado `LOCAL_GROUP_EXTENDED_CATALOG` contendo `Milky Way`, `Andromeda (M31)`, `Triangulum (M33)`, `Large Magellanic Cloud (LMC)`, `Small Magellanic Cloud (SMC)`, `M32` e `M110`, preservando `LOCAL_GROUP_CATALOG` intacto para compatibilidade retroativa.
4. **Paridade Completa de Manaus Curva (`tests/manaus-surface-authority.test.ts`)**:
   - Adicionado `T_CURVED_MANAUS_FULL_SUBSYSTEM_PARITY_WHEN_ENABLED` validando `FEATURES.curvedManaus = true` a 20 km do marco zero.

---

## 3. Validação Local
- **TypeScript (`npx tsc --noEmit`):** 0 erros
- **Testes Direcionados:** `tests/cosmic-long-session-acceptance.test.ts` (`3/3 pass`), `tests/manaus-surface-authority.test.ts` (`14/14 pass`)
- **Suíte Geral (`npm test`):** `1.793/1.793 pass`
- **Suíte de Regressão (`npm run test:regression`):** `638/638 pass`
- **Build de Produção (`npm run build`):** `built` sem erros
