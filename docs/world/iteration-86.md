# Iteration 86 Status Report

## Resumo Executivo
Nesta iteração, finalizamos com sucesso a **Task 010 - Sol visual** descrita no `specs/Promptatual.md` e corrigimos o problema onde estrelas e planetas sumiam baseados no _far clipping plane_ da câmera.

## O que foi Feito (Task 010 concluída)
1. **Dinâmica do Proxy Baseada no Far Plane:**
   - O proxy de geometria celestial (`celestialProxyGeometry` em `math.ts`) deixou de usar uma distância "hardcoded" de 5.000.000m e passou a ancorar os proxies dos astros dinamicamente em uma fração segura do `camera.far` (90% do far clipping plane).
   - Isso garante que a Lua, a Terra e o Sol fiquem fixados dentro do plano visual mas ao mesmo tempo fiquem atrás de objetos em primeiro plano sem serem podados na renderização distante.
2. **SpaceLayer e Campo Estelar:**
   - O campo estelar (`SpaceLayer.ts`) foi ajustado para também se distanciar até 95% do plano distante e teve o sistema de fade de "limb" desativado para quando existem mundos físicos cobrindo a tela, impedindo as estrelas de escurecerem indevidamente.
3. **Controlador de Apresentação Celestial Atualizado:**
   - O `CelestialPresentationController` agora recebe `cameraFarM` em seu método `prepare` e delega as decisões de proxy distance com precisão cirúrgica sem distorcer cálculos de angular size e opacity originais.
4. **Regressões e Cobertura de Testes Resolvidos:**
   - Testes estruturais (`T_PROXY1`, `T_PROXY2` em `space-visual-p0.test.ts`) testam o pipeline visual diretamente e foram consertados e o sistema passou com zero falhas.
   - Foram mantidos rigorosos requisitos no repositório de manter clean tree e assegurou-se de que a build de typescript passe sem falhas.

## Próximos Passos
1. Conforme a fila de roadmap do pacote `Promptatual.md` (`10-PLANETS-AND-MOONS-ROADMAP.md` e posteriores), avançaremos para implementar `Streaming budget controls` (Tasks 011-015), onde garantiremos estabilidade performática e carregamento otimizado de LOD em transições contínuas Terra-Espaço.
2. Adicionar validações globais e generalização de luas e planetas com persistência.
