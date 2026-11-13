# DR-MANAUS | Universo Vivo — VIVO-15: Ruínas Ancestrais, Colossos Cósmicos e Anomalias

## 1. Visão Geral
Esta especificação consolida a geração procedural determinística, o combate e a persistência de estruturas arqueológicas monumentais (`CosmicAnomaliesAndRuinsManager`), titãs mecânicos autômatos (`ColossusEntity`) e anomalias cósmicas em planetas exploráveis do DR-MANAUS.

Em planetas onde a biosfera atinge `civilizationStage === 'ancient-ruins-guardians'` ou civilizações avançadas/monolíticas, o mundo abriga relíquias monumentais pré-colapso e sentinelas colossais ativos que protegem sítios sagrados.

## 2. Princípios de Engenharia
- **Zero Assets Proprietários:** Geometrias dos colossos e monólitos modeladas proceduralmente em baixo custo poligonal via WebGPU (`BoxGeometry`, `CylinderGeometry`, `OctahedronGeometry`, `TorusGeometry`).
- **Combate de Chefes Multifásico:**
  - **Fase 1 (100% - 50% HP):** Movimentação metódica, pisões sísmicos com colisão radial e runas luminosas azuis.
  - **Fase 2 (< 50% HP):** Modo de sobrecarga (Enrage), runas vermelhas intensas, aumento de velocidade ($1.6\times$), disparos de projéteis e barreira defletora.
- **Integração Plena com `PowerSystem`:** Colossos e relíquias atuam como alvos válidos de mira assistida (`targets`), recebendo dano de socos, chutes, projéteis, lasers e crateras sísmicas.
- **Persistência Transacional:** Vitórias sobre colossos e descobertas de relíquias são gravadas de forma atômica no `SaveManager` (`discoveredRuins`, `defeatedColossi`).

## 3. Tipos de Estruturas Ancestrais (`AncientStructureType`)
1. `ancient-sanctuary`: Complexo piramidal com monólito central e pilares perimétricos ressonantes.
2. `hyper-relic`: Estrutura toroidal levitante com núcleo de pulso gravitacional.
3. `guardian-spire`: Agulha megalítica de monitoramento orbital com emissores de partículas.

## 4. Tipos e Fases de Colossos (`ColossusType`)
1. `ancient-automaton`: Titã bípede colossal de 20 metros de envergadura, massa colossal e alta resistência mecânica ($1.200\text{ HP}$).
2. `void-sentinel`: Guardião levitante com escudo de fragmentos orbitais ($800\text{ HP}$).

