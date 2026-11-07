# Relatório Técnico U4.1 / U4.1.1 / U4.1.2 — Gerador Procedural Determinístico de Galáxias e Hardening Arquitetural

**Status**: U4.1.2 Implementado e Pronto para Validação no CI  
**Data**: 02 de Novembro de 2026  
**Autor**: Antigravity Assistant & Dr-Manaus Core Team  
**Branch**: `feat/universe-map`  
**Baseline U4.1 Aprovado em CI**: `d1def8c4e06eceb8e0a0ab8ddd0f706d46fb717d` (GitHub Actions Run [41388592245](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/41388592245))  
**Resultados Oficiais do U4.1**: Typecheck SUCCESS; 638/638 regressões permanentes PASS; 1.486/1.486 testes gerais PASS; build Vite de produção SUCCESS.  
**Auditoria do U4.1.1 no CI**: `5b889b0681581876e6f17787d13376a1006f745f` (GitHub Actions Run [41390693792](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/41390693792))  
- Typecheck: SUCCESS  
- Regressões permanentes: 638/638 PASS  
- Suíte geral de testes: 1.490/1.491 PASS (1 falha no teste novo `T_U411_01`)  
- Build de produção: SKIPPED (bloqueado pela falha unitária)  
**Escopo U4.1.2**: Correção pontual da expectativa matemática de separação cosmológica no teste `T_U411_01_COSMOLOGICAL_CELL_SPATIAL_IDENTITY` sem qualquer alteração no código de produção.

---

## 1. Problemas Identificados na Revisão do U4.1 e Soluções Implementadas

| Prioridade | Componente | Problema Identificado no U4.1 | Solução Implementada no U4.1.1 |
|---|---|---|---|
| **P0** | `toGalaxyDefinition()` | O adaptador calculava `positionM` usando apenas `localCellMpc`, ignorando `cell`. Galáxias de células diferentes poderiam receber posições idênticas. | Implementado `cosmologicalPositionM()` e `cosmologicalSeparationVectorM()`. O domínio Float64 absoluto é explicitamente limitado a $\|cell\| \le 1024$ (`COSMOLOGICAL_FLOAT_DOMAIN_MAX_CELLS`). Células fora do domínio são rejeitadas com erro explícito (`tryToGalaxyDefinition`), nunca retornando posições silenciosamente erradas. |
| **P0** | `hashCosmologicalCell()` | O algoritmo misturava apenas 8 bytes de cada BigInt, causando aliasing previsível para coordenadas com diferença de múltiplos de $2^{64}$. | Implementada codificação canônica bijetiva de BigInt (byte de sinal + comprimento LEB128 + magnitude em little-endian) com finalizador SplitMix64. `GALAXY_GENERATOR_VERSION = 2`. |
| **P1** | `GalaxyRuntime.densityAtLocal()` | O adaptador mapeava galáxias procedurais para perfis legados, fazendo o runtime cair na densidade da Via Láctea e perder a morfologia gerada. | Adicionado `'procedural'` ao `GalaxyDensityProfile` e campo `proceduralMorphology` ao `GalaxyDefinition`. `GalaxyRuntime.densityAtLocal()` delega diretamente para `evaluateProceduralDensity()` quando a morfologia está presente. |
| **P1** | Nomes de Galáxias Sintéticas | Galáxias procedurais recebiam prefixos de catálogos reais (`NGC`, `IC`, `UGC`), parecendo objetos oficiais. | Galáxias procedurais agora recebem designação procedural explícita `DM-PG <hex>` (Dr-Manaus Procedural Galaxy), reservando nomes de catálogos para o catálogo do Grupo Local. |
| **P1** | Desempenho e Memória | O teste `T_U41_09` afirmava "zero alocação de heap" medindo apenas tempo de CPU via `performance.now()`. | Teste renomeado e calibrado como teste de vazão/tempo de resposta sob demanda. Alegações não instrumentadas de alocação de memória foram expurgadas. |
| **Matemática** | Bulbo e Descontinuidades | O perfil do bulbo era chamado de "Hernquist / de Vaucouleurs", embora seja uma aproximação com núcleo suave. A barra e o disco tinham truncamentos bruscos em $5\sigma$ e $|u| > 15$. | Terminologia corrigida para "perfil inspirado em Hernquist com núcleo suave". Truncamentos bruscos substituídos por funções estritamente contínuas assintóticas ($\exp$ e fórmula analítica de $\operatorname{sech}^2$). |

---

## 2. Contrato de Coordenadas Cosmológicas (U4.1.1)

A autoridade espacial canônica de uma galáxia é definida pela tupla:
$$\mathbf{A}_{\text{cosmic}} = (\mathbf{C}_{\text{cell}} \in \mathbb{Z}^3, \mathbf{r}_{\text{local}} \in [-1, 1]^3 \text{ Mpc})$$

### 2.1 Domínio Limitado para Float64 Absoluto
Como números Float64 possuem 53 bits de mantissa, distâncias superiores a $1024 \times 2.0\text{ Mpc} \approx 2\text{ Gpc}$ ($\approx 6.3 \times 10^{25}\text{ m}$) sofrem espaçamento de ULP $> 1.4 \times 10^{10}\text{ m}$. Para garantir integridade espacial:
1. `isCellInFloatDomain(cell)`: Retorna `true` se e somente se $|C_x|, |C_y|, |C_z| \le 1024$.
2. `cosmologicalPositionM(address)`:
   - Se dentro do domínio: Retorna vetor `Vec3` em metros:
     $$\mathbf{P}_{\text{metres}} = \mathbf{C}_{\text{cell}} \cdot D_{\text{cell}} + \mathbf{r}_{\text{local}} \cdot D_{\text{Mpc}}$$
   - Se fora do domínio: Retorna `undefined`. A API **nunca** retorna coordenadas silenciosamente imprecisas.
3. `tryToGalaxyDefinition(descriptor)`: Retorna `{ ok: true, definition }` para células válidas, ou `{ ok: false, reason: 'cell-outside-float-domain' }`.
4. `toGalaxyDefinition(descriptor)`: Lança `RangeError` explícito se chamado para galáxia além do domínio Float64.
5. `cosmologicalSeparationVectorM(from, to)`: Subtrai $\Delta \mathbf{C} = \mathbf{C}_{\text{to}} - \mathbf{C}_{\text{from}}$ em `BigInt` antes da conversão, permitindo navegação local exata entre quaisquer galáxias próximas mesmo se ambas estiverem a distâncias astronômicas arbitrárias ($> 2^{64}$).

### 2.2 Preservação Exata do Catálogo do Grupo Local
Para as galáxias canônicas do Grupo Local (`milky_way`, `andromeda`), o adaptador retorna **o próprio objeto imutável de `LOCAL_GROUP_CATALOG`**, preservando bit-a-bit as coordenadas, rotações e buracos negros originais sem qualquer reconstrução por arredondamento em Mpc.

---

## 3. Função de Hash Canônica e Eliminação de Aliasing (Versão 2)

O algoritmo de hash anterior realizava um truncamento implícito em 8 bytes (`v >>= 8n` em loop fixo de 8 iterações), tratando $0n$ e $2^{64}n$ como entradas equivalentes.

No U4.1.1, a função `hashCosmologicalCell` implementa:
1. **Magic Tag de Domínio:** Prefixo ASCII `DMGX` (`[0x44, 0x4d, 0x47, 0x58]`), garantindo que hashes galácticos nunca coincidam com hashes de setores estelares.
2. **Versionamento Explícito:** Byte `GALAXY_GENERATOR_VERSION = 2`.
3. **Propósito da Semente:** Separação entre semente de galáxia (`HASH_PURPOSE_GALAXY = 0`) e contagem populacional de célula (`HASH_PURPOSE_CELL_POPULATION = 1`).
4. **Codificação Bijetiva de BigInt:**
   $$\text{Encode}(x) = [\text{sinal (0 ou 1)}] \parallel [\text{comprimento LEB128}] \parallel [\text{magnitude em little-endian}]$$
   O comprimento explícito garante que a codificação seja livre de prefixos (prefix-free), tornando impossível que $0n$ e $2^{64}n$ gerem a mesma sequência de bytes.
5. **Validação de Domínio de Índice:** O índice local `galaxyIndex` deve ser um inteiro válido em $[0, 65535]$ (`GALAXY_INDEX_MAX`). Índices inválidos geram `RangeError` imediato.
6. **Finalizador SplitMix64:** Aplica duas etapas de multiplicação e xorshift para avalanche completo dos bits inferiores antes de inicializar o gerador xorshift64.

---

## 4. Preservação de Morfologia no Runtime (`GalaxyRuntime.ts`)

Para eliminar o falso anúncio de compatibilidade onde o runtime revertia galáxias procedurais para o perfil da Via Láctea:
1. `GalaxyDensityProfile` foi estendido com a variante canônica `'procedural'`.
2. A interface `GalaxyDefinition` recebeu o campo opcional `proceduralMorphology?: ProceduralGalaxyDescriptor`.
3. `GalaxyRuntime.densityAtLocal(positionM)` verifica primeiramente:
   ```typescript
   densityAtLocal(positionM: Vec3): number {
     if (this.definition.proceduralMorphology) {
       return evaluateProceduralDensity(this.definition.proceduralMorphology, positionM);
     }
     return (this.definition.densityProfile === 'andromeda' ? andromedaDensity : milkyWayDensity)(positionM)
       * (this.definition.densityScale ?? 1);
   }
   ```
4. A função `evaluateProceduralDensity` atua como **fonte única de verdade matemática**, garantindo que tanto chamadas diretas quanto consultas através do runtime avaliem exatamente os mesmos braços espirais, bulbo, barra e halo da morfologia da galáxia gerada.

---

## 5. Auditoria Matemática e Rigor Físico

1. **Bulbo Central Suavizado:**
   $$\rho_{\text{bulge}}(m) = \frac{\rho_{b0}}{\left(1 + \frac{\sqrt{m^2 + r_{\text{core}}^2}}{r_b}\right)^4}$$
   Documentado formalmente como perfil procedural inspirado na assíntota $r^{-4}$ de Hernquist (1990), com núcleo finito $r_{\text{core}}$ para evitar a cúspide singular $1/r$ da formulação original.
2. **Barra Central:**
   Eliminado o corte descontínuo em $m_{\text{bar}}^2 > 25 \implies 0$. A função decai naturalmente de forma suave via $\exp(-m_{\text{bar}}^2)$, garantindo diferenciabilidade em todo o domínio.
3. **Disco Estelar:**
   Eliminada a descontinuidade para $|u| > 15 \implies 0$. Utiliza a identidade analítica contínua:
   $$\operatorname{sech}^2(u) = \frac{4 e^{-2|u|}}{(1 + e^{-2|u|})^2}$$
   que nunca estoura o expoente de ponto flutuante e decai continuamente até zero.
4. **Braços Espirais:**
   Mantido o envelope máximo multiplicativo $M_{\text{arms}} \ge 0.25 > 0$ com periodicidade estrita $2\pi$.

---

## 6. Cobertura de Testes Unitários de Contrato (15 Testes)

A suíte [tests/procedural-galaxy-generator.test.ts](file:///c:/Projetos/Dr-Manaus/tests/procedural-galaxy-generator.test.ts) foi ampliada para 15 testes formais:

- `T_U41_01_DETERMINISM_IDENTICAL_SEED_AND_COORDINATES`: Determinismo estrito de descritores e densidades.
- `T_U41_02_SEED_AND_COORDINATE_DIVERGENCE`: Sensibilidade a variações de semente, célula e índice.
- `T_U41_03_INVARIANCE_TO_CALL_ORDER_AND_CAMERA`: Independência de ordem de chamada e ausência de efeitos colaterais.
- `T_U41_04_EXACT_BIGINT_SCALING_BEYOND_2_POW_53`: Preservação exata em coordenadas $> 2^{53}$ e negativas.
- `T_U41_05_DENSITY_NON_NEGATIVITY_AND_FINITENESS`: Densidade $\ge 0$ e finita sem singularidade em $r = 0$.
- `T_U41_06_SPIRAL_ARM_MODULATION_INVARIANTS`: Piso mínimo $M_{\text{arms}} \ge 0.25$, periodicidade $2\pi$ e alinhamento de crista.
- `T_U41_07_HUBBLE_MORPHOLOGY_FAMILY_COVERAGE`: Geração de todas as 5 famílias morfológicas.
- `T_U41_08_PRESERVATION_OF_CANONICAL_ENTITIES`: Grupo Local preserva referências exatas de `LOCAL_GROUP_CATALOG`.
- `T_U41_09_ON_DEMAND_GENERATION_THROUGHPUT`: Vazão de geração sob demanda sem retenção de cache.
- `T_U41_10_ADAPTER_TO_GALAXY_DEFINITION_COMPATIBILITY`: Conformidade do adaptador com perfil `'procedural'`.
- `T_U411_01_COSMOLOGICAL_CELL_SPATIAL_IDENTITY`: Separação espacial analítica exata entre células cosmológicas (Float64 rel $< 10^{-14}$), sinal, células negativas, delta exato de grade e compatibilidade vetorial.
- `T_U411_02_HASH_NO_2_POW_64_ALIASING_AND_CANONICAL_VECTORS`: Comprova que coordenadas separadas por $2^{64}$ geram hashes distintos.
- `T_U411_03_GALAXY_INDEX_DOMAIN_VALIDATION`: Lança `RangeError` para índices negativos, fracionários ou superiores a 65535.
- `T_U411_04_BOUNDED_FLOAT_DOMAIN_AND_EXPLICIT_REFUSAL`: Rejeita células fora do domínio Float64 sem emitir posições erradas; valida vetores relativos.
- `T_U411_05_GALAXY_RUNTIME_PRESERVES_PROCEDURAL_MORPHOLOGY`: `GalaxyRuntime.densityAtLocal` avalia a morfologia específica da galáxia procedural.

---

## 7. Patch U4.1.2 — Diagnóstico e Correção Matemática de `T_U411_01`

### 7.1 Diagnóstico do CI (Run 41390693792)
O commit `5b889b0681581876e6f17787d13376a1006f745f` passou por Typecheck e pelo portão permanente (638/638 PASS), além de 1.490 testes unitários gerais. A única falha ocorreu na asserção de linha 424 de `tests/procedural-galaxy-generator.test.ts`:
```
Distance between cells must reflect cosmological cell grid separation
Expected: true
Received: false
```

### 7.2 Causa Raiz Matemática
No teste `T_U411_01`, as células avaliadas foram:
- $\text{cell}_A = (10, 0, 0)$
- $\text{cell}_B = (20, 0, 0)$

Com tamanho de célula $D_{\text{cell}} = 2.0\text{ Mpc}$, a separação nominal entre as origens das células é:
$$\Delta X_{\text{cell}} = (20 - 10) \times 2.0\text{ Mpc} = 20.0\text{ Mpc}$$

Os offsets locais gerados $\mathbf{r}_{\text{local}} \in [-0.9, +0.9]\text{ Mpc}$ modulam essa distância em no máximo $\pm 1.8\text{ Mpc}$, resultando em uma separação real estritamente contida no intervalo $[18.2, 21.8]\text{ Mpc}$.

Entretanto, a asserção no teste exigia:
```typescript
deltaXMetres > 15 * COSMOLOGICAL_CELL_SIZE_MPC * (1_000_000 * 3.08e16)
```
Como $15 \times 2.0\text{ Mpc} = 30.0\text{ Mpc}$, o teste exigia uma distância superior a $\approx 30\text{ Mpc}$ para objetos separados por apenas $20\text{ Mpc}$, tornando a falha matematicamente inevitável. O código de produção em `ProceduralGalaxyGenerator.ts` e `GalaxyRuntime.ts` calculava a posição perfeitamente correta e não necessitou de alterações.

### 7.3 Correção Analítica e Tolerância Float64
A asserção heurística incorreta foi substituída pela comparação direta com a expressão analítica exata:
$$\Delta X_{\text{expected}} = (C_{B,x} - C_{A,x}) \cdot D_{\text{cell}} + (r_{B,\text{local},x} - r_{A,\text{local},x}) \cdot D_{\text{Mpc}}$$

A comparação com a posição calculada pelo adaptador $\Delta X_{\text{actual}} = P_{B,x} - P_{A,x}$ emprega tolerância relativa estrita:
$$\frac{|\Delta X_{\text{actual}} - \Delta X_{\text{expected}}|}{|\Delta X_{\text{expected}}|} < 10^{-14}$$

### 7.4 Casos de Borda Adicionais Cobertos em `T_U411_01`
Para assegurar a robustez completa do contrato de coordenadas, o teste foi expandido com:
1. **Sinal da separação**: Verificação de que $\Delta X > 0$ quando $C_{B,x} > C_{A,x}$.
2. **Células negativas**: Validação para células em coordenadas negativas ($C_x = -15n$ e $C_x = -5n$), confirmando o mesmo $\Delta X = 20\text{ Mpc}$ nominal.
3. **Igualdade de offsets locais**: Verificação de que duas galáxias sintéticas com idênticos offsets locais produzem exatamente $\Delta X = 10 \times D_{\text{cell}}$ com tolerância $< 10^{-15}$.
4. **Compatibilidade com `cosmologicalSeparationVectorM()`**: Verificação de que a subtração em BigInt produz resultado idêntico à subtração de posições Float64 no domínio suportado.
5. **Preservação de endereço BigInt**: Confirmação de que `cosmologicalAddress.cell` preserva o valor exato `BigInt` sem perda de tipo ou magnitude.

---

## 8. Próximos Passos (Transição para U4.2)

1. Validação automatizada completa no GitHub Actions para o commit U4.1.2 (1.491/1.491 testes esperados + Build Vite).
2. Após confirmação remota de sucesso no pipeline, início imediato do **U4.2 — Shaders de Morfologia Galáctica e Sistema de Partículas GPU** (`GalaxyPointCloudProvider.ts`, shaders GLSL dedicados, buffers instanciados e níveis LOD0–LOD2).

