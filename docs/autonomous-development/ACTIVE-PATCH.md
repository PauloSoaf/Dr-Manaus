# DR-MANAUS | Active Patch Tracker

- **Patch:** `VIVO-07` (IA Ecológica Avançada: Predação, Manadas Flocking, Pirâmide Trófica e Alarme Coletivo)
- **Status:** IMPLEMENTED & LOCAL VALIDATION COMPLETE (1.721/1.721 testes unitários, 638/638 regressões, typecheck 0 erros, build OK)
- **Branch:** `feat/universe-map`
- **Atualizado:** 2026-11-12T12:50:00-04:00

## Mudanças do Patch
1. `src/world/life/AlienFaunaManager.ts`:
   - Adicionado tipo `EcologicalRole = 'herbivore' | 'carnivore' | 'scavenger' | 'apex'`.
   - Implementada distribuição trófica determinística em mundos complexos ($\sim 75\%$ herbívoros, $\sim 25\%$ predadores/apex).
   - Implementado ciclo de predação autônomo: predadores escaneiam presas herbívoras ($< 35\text{ m}$), perseguem em alta velocidade ($1.5\times$), desferem mordidas em raio de combate ($< 2.8\text{ m}$) e entram em repouso após se alimentarem.
   - Implementada dinâmica de manadas (flocking tangencial) com repulsão $< 3.5\text{ m}$ para evitar sobreposição e coesão de direção ao centro de massa do grupo.
   - Implementado sistema de alarme coletivo (`alertNearbyHerd`): ataques de predadores ou do Dr-Manaus transmitem choque sísmico/acústico dispersando herbívoros em debandada (`fleeing`).
   - Introduzido gerador pseudo-aleatório estritamente determinístico `hashFauna(seed, index, tick)` para decisões e rotinas de patrulha.
   - Atualizado sombreamento de instâncias com paletas biológicas distintas: herbívoros calmos `#5f755a`, em fuga `#c48256`, predadores `#7d3a3a`, em caça `#d44030`, e predadores apex `#4a2c5a` / `#bf3060`.
2. `specs/universo-vivo/07-ECOLOGICAL-AI-AND-HERDS.md`:
   - Especificação técnica completa de IA trófica, flocking, predação e propagação de alarme.
3. `tests/alien-fauna-ecological-ai.test.ts`:
   - 5 novos testes unitários validando pirâmide trófica, perseguição e mordida predatória, propagação de alarme, repulsão de manada e determinismo exato.
