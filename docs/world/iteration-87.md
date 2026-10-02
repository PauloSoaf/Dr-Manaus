# Iteration 87 Status Report

## Resumo Executivo
Com a conclusão da renderização e estabilização de todos os "proxies celestiais" dinâmicos contra o `camera.far` (Task 010 finalizada na iteração anterior), o Sistema Solar agora exibe o Sol, a Terra e a Lua nas proporções corretas, sem artefatos visuais ou desaparecimentos repentinos.
Nesta iteração (87), começaremos a trabalhar na **Task 011 - Planetas** e **Task 012 - Luas**, descritas no `specs/Promptatual.md`. 

## Objetivo da Iteração (Tasks 011 e 012)
1. **Task 011 (Planetas):** Generalizar o `provider` e o corpo visual. Atualmente, o `EarthProvider` e o `MoonProvider` possuem lógicas fortemente acopladas às suas respectivas instâncias. O objetivo é criar uma estrutura planetária genérica que possa ser instanciada por configuração (por exemplo, instanciar Marte dinamicamente a partir de parâmetros no sistema procedimental).
2. **Task 012 (Luas):** Adicionar satélites parametrizados por dados e fases. Utilizar a estrutura generalizada criada na Task 011 para mapear órbitas e mecânicas visuais de múltiplas luas, com suporte aos domínios já estabilizados (superfície, planetário, celeste).

## Estado da Arquitetura
* A regra central de "coordenadas entregues ao renderer devem permanecer pequenas" está integralmente respeitada.
* Nenhum corpo celestial entrega números em ordem astronômica (1 AU) para os vértices WebGL. O `CelestialPresentationController` lida com as matemáticas angulares perfeitamente.
* A árvore Git continua limpa e todos os 393 testes permanecem passando. Nenhuma regressão afeta as transições locais.

## Próximos Passos Imediatos
1. Avaliar as diferenças e o código compartilhado entre `EarthProvider`, `RockyPlanetProvider` (usado para Marte e Lua) em `src/world/providers/`.
2. Criar ou refatorar a infraestrutura em `ProceduralSystemRuntime` para instanciar mundos dinamicamente sem definições hardcoded de providers separados para cada planeta e lua.
3. Desenhar a solução visual de satélites e adicionar cobertura de testes para a Task 011.
