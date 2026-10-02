# Iteration 85 Status Report

## Resumo Executivo
Com a estabilização da arquitetura `CelestialPresentationController` (concluída na iteração 84) e a conclusão das tarefas de estabilização estrutural do universo, iniciaremos agora o desenvolvimento focado na renderização óptica dos corpos celestes (**Task 010 - Sol visual**).

## Objetivo da Iteração (Task 010)
Atualmente, existe um problema visual grave: "estrelas somem olhando para baixo, Terra invisível, Lua invisível de longe. Tudo isso é a mesma lacuna — não existe representação de corpo distante em tamanho angular real."

Para corrigir isso, vamos focar em:
1. Atualizar e implementar corretamente a camada `CelestialBodyVisualLayer` (e suas classes dependentes como `SunVisual` e `PlanetVisual`).
2. Mapear as distâncias interplanetárias reais para o tamanho angular aparente ("angular size") na câmera, permitindo que a Lua, a Terra e o Sol continuem visíveis independentemente da distância, escapando das limitações do far clipping plane do renderer.
3. Garantir que a renderização obedeça aos preceitos da Task 010 do `specs/Promptatual.md` (renderizar o Sol por angular size e distância relativa).

## Próximos Passos
1. Inspecionar `src/rendering/celestial/CelestialBodyVisualLayer.ts` e `src/rendering/celestial/types.ts`.
2. Avaliar a lógica atual em `SunVisual` e `PlanetVisual`.
3. Implementar o shader ou a malha escalonada por tamanho angular garantindo que os corpos estejam contidos em uma distância renderizável (provavelmente através de "skybox distance" com tamanho aparente fixo ou atenuado).
