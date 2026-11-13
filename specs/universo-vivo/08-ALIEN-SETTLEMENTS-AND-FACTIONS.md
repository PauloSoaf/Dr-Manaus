# DR-MANAUS | ESPECIFICAÇÃO TÉCNICA
## VIVO-08 / VIVO-09: Assentamentos Alienígenas Modulares, Habitantes, Facções e Reputação

---

### 1. OBJETIVO E VISÃO GERAL

O subsistema VIVO-08 e VIVO-09 introduz civilizações, postos avançados e habitantes alienígenas modulares no Dr-Manaus:
1. **Assentamentos Modulares Procedurais**: Em corpos celestes com biosferas civilizadas (`lifeTier === 'civilized'` ou estágio de civilização ativo), são gerados postos avançados, colônias e ruínas antigas estruturadas com geometrias low-poly (`InstancedMesh`).
2. **Arquétipos Estruturais**:
   - `habitat-dome`: Cúpula geodésica com túnel de eclusa pressurizada.
   - `comm-tower`: Torre de telecomunicações e antenas de longo alcance.
   - `energy-pylon`: Pilares de captação e anéis de contenção de plasma.
   - `perimeter-wall`: Baluartes defensivos modulares.
   - `ancient-monolith`: Monólitos e obeliscos milenares de sentinelas ancestrais.
3. **Habitantes e Sentinelas**:
   - Papéis tróficos/sociais: `worker`, `guard`, `elder`, `sentinel`.
   - Máquina de estados: `idle`, `patrolling`, `saluting`, `defending`, `fleeing`, `knocked`.
4. **Sistema de Reputação de Facções**:
   - Armazenado e persistido no `SaveManager.data.factionReputations`.
   - Varia de $-100$ (hostilidade mortal) a $+100$ (honra/aliança).
   - Acionar ataques a estruturas ou habitantes reduz a reputação e mobiliza guardas em combate defensivo.
   - Reconstruir estruturas destruídas ou ressuscitar habitantes caídos com o poder `reconstruct` restaura a reputação da facção.

---

### 2. ARQUITETURA E FLUXO DE EXECUÇÃO

```mermaid
flowchart TD
    Player["Dr-Manaus"] -->|Aproximação < 24m| CheckRep{"Reputação da Facção?"}
    CheckRep -->|>= +15 (Friendly)| Salute["Habitantes saúdam (saluting)"]
    CheckRep -->|<= -15 ou Sentinela| Defend["Guardas entram em guarda (defending)"]
    CheckRep -->|Neutro| Observe["Observam cautelosamente (idle/patrolling)"]

    Player -->|Ataque / Dano| Combat["Dano em Estrutura / Habitante"]
    Combat -->|Penalidade| RepDown["SaveManager.modifyFactionReputation(-10 a -15)"]
    Combat -->|Alerta Tático| GuardMobilize["Mobilização de Guardas e Fuga de Trabalhadores"]

    Player -->|Poder Reconstruct| Restore["Restauração de Módulos e Habitantes"]
    Restore -->|Recompensa| RepUp["SaveManager.modifyFactionReputation(+15 a +20)"]
```

---

### 3. MECÂNICAS DE COMBATE E RECONSTRUÇÃO

- **Dano em Estruturas**: Módulos possuem entre $1.500\text{ HP}$ e $8.000\text{ HP}$. Quando a vida zera, a estrutura é marcada como `destroyed` e cessa colisão e renderização.
- **Dano em Habitantes**: Guardas e sentinelas absorvem até $450\text{ HP}$. Golpes não-letais aplicam estado `knocked` e impulso físico.
- **Reconstrução Cósmica**: A invocação do poder `reconstruct` (tecla `R`) reconstrói todas as estruturas avariadas no raio e revive habitantes, transformando sua postura em aclamação/saudação ao herói.

---

### 4. COBERTURA DE TESTES AUTOMATIZADOS

O subsistema é integralmente coberto por `tests/alien-settlement-manager.test.ts`:
- `T_VIVO08_01_INITIALIZATION_AND_POOLS`: Capacidades e alocação estática zero-garbage.
- `T_VIVO08_02_STERILE_WORLDS_SUPPRESSION`: Supressão em mundos sem civilização (ex: Lua estéril).
- `T_VIVO08_03_SETTLEMENT_SPAWN_AND_MODULAR_STRUCTURES`: Geração de cúpulas, torres e alvos.
- `T_VIVO09_01_FACTION_DISPOSITION_AND_SALUTE`: Saudação de facção amigável ao herói.
- `T_VIVO09_02_COMBAT_HIT_REPUTATION_AND_MOBILIZATION`: Dano, queda de reputação e mobilização de guardas.
- `T_VIVO09_03_RECONSTRUCTION_AND_REPUTATION_RESTORATION`: Reconstrução física e ganho de reputação diplomática.

