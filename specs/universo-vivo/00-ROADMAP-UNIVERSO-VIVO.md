# DR-MANAUS | Universo Vivo — Especificação Mestra e Roadmap

## 1. Visão Geral
Transformação do Dr-Manaus em um universo verdadeiramente habitado e vivo, com biosferas determinísticas, biomas por habitat, flora instanciada, fauna animada com inteligência artificial, assentamentos alienígenas modulares, combate integrado a alvos no planeta ativo, teleporte transacional interplanetário universal e poder de ruptura planetária persistente.

## 2. Princípios de Engenharia
- **Zero Custos:** 100% dos assets e ferramentas baseados em bibliotecas gratuitas (Kenney CC0, Quaternius Standard / QAL, Poly Haven CC0, ambientCG CC0).
- **Determinismo Absoluto:** Todo planeta, bioma, criatura e civilização deriva da seed do corpo e sementes de canal independentes (sem `Math.random` em runtime).
- **Desempenho Estrito:**
  - Fauna/Civilizações com IA somente na região ativa do jogador ($< 150\text{ m}$).
  - Atualização de IA econômica a 5-10 Hz (não 60 Hz).
  - Flora via `InstancedMesh` com culling por célula.
  - Zero simulação em planetas distantes; uso de proxies leves.
  - Floating origin e precisão Float64/BigInt preservadas.

## 3. Roadmap de Implementação
1. **VIVO-01:** Seeds independentes para climate/life/flora/fauna/faction, perfil de biosfera por planeta (`PlanetaryBiosphereProfile`), versionamento.
2. **VIVO-02:** Clima/biomas determinísticos por tile e habitat; mundos estéreis quando apropriado (`PlanetaryBiomeService`).
3. **VIVO-03:** Flora visual alienígena por instancing e LOD com descarte real (`AlienFloraRenderer`).
4. **VIVO-04:** Fauna, espécies morfologicamente diferentes, animações e spawn seguro (`AlienFaunaManager`).
5. **VIVO-05:** Scanner e entrada de espécie no Atlas + persistência de descoberta.
6. **VIVO-06:** Combate `PowerSystem` integrado a fauna, alvos multi-domínio e ataques com colisão coerente.
7. **VIVO-07:** IA econômica, predação, fuga, manadas e rotinas de vida.
8. **VIVO-08:** Habitantes e assentamentos alienígenas modulares com facções.
9. **VIVO-09:** Combate e interação com alienígenas, chefes e reputação.
10. **VIVO-10:** Teleporte seguro entre Terra, Lua, Marte, planetas procedurais de diferentes sistemas e galáxias, com handoff transacional, validação física e rollback.
11. **VIVO-11:** Céu, clima, perigos, iluminação/áudio particulares por mundo.
12. **VIVO-12:** Poder `planetRupture` com target real, charge, estado global e persistência.
13. **VIVO-13:** Fratura visual do planeta em dezenas de grandes blocos + centenas de detritos instanciados, núcleo e onda de choque; não apenas partículas.
14. **VIVO-14:** Pós-ruptura: física, renderização, Atlas, mapas, pouso, entidades e save reconhecendo a destruição; reconstrução explícita.
15. **VIVO-15:** Eventos, missões, primeiro contato, ruínas, colossos, biodiversidade e anomalias.
16. **VIVO-16:** Benchmarks, polimento, otimizações e fechamento de regressões.

