# Prompt mestre para aplicar o hotfix

Você está trabalhando no repositório DR Manaus.

Base obrigatória:

```text
branch: feat/universe-map
HEAD esperado no início: 14c726803cf9028137f845e73a948d63f8cbc2f9
```

Antes de editar, confirme o HEAD. Se a branch avançou, faça rebase mental da análise e verifique se os bugs abaixo ainda existem. Não aplique cegamente snippets antigos.

## Objetivo

Corrigir regressões críticas da implementação planetária/interplanetária sem desmontar Manaus.

Bugs reproduzidos pelo usuário:

1. Ao entrar em velocidade interplanetária ainda associado à Terra e tentar sair do planeta, o personagem começa a teletransportar, perde controle e o jogo fica injogável.
2. Existe um chão verde fantasma sob o chão normal que aparece dentro de crateras e buracos e esconde a deformação.

## Regras

- Não usar `main` como base.
- Não ligar `FEATURES.curvedManaus`.
- Não remover testes para fazer o build passar.
- Não mascarar o problema com clamps aleatórios, teleports periódicos ou um backdrop dezenas de metros mais baixo.
- Não devolver o player ao domínio local simplesmente porque o thrust foi solto.
- Não interpretar posição baricêntrica como coordenada local de Manaus.
- Não enviar coordenadas astronômicas absolutas diretamente para Mesh.position em Float32.
- Preservar tudo que já funciona em Manaus.

## P0-1 Corrigir altitude/frame em UniverseRuntime

Audite:

```text
UniverseRuntime.telemetry
UniverseRuntime.spatialContext
UniverseRuntime.playerEcef
UniverseRuntime.playerGeodetic
```

Crie uma única resolução de corpo/altitude compartilhada.

Quando o player estiver em `solar-system/barycentric`, altitude deve ser calculada relativamente ao corpo dominante.

`legacyLocalToGeodetic` e `legacyLocalToEcef` só podem receber coordenadas de `MANAUS_FRAME_ID`.

Adicione teste que coloca o player 100 km acima da Terra em barycentric e obtém aproximadamente 100 km de altitude.

## P0-2 Corrigir TravelDomain

`requested` é intenção de iniciar travel, não condição para continuar existindo nele.

Depois de entrar:

```text
sem thrust = coasting
```

Use histerese de altitude:

```text
entrada ~9 km
retorno ~7 km
```

e só retorne quando a velocidade relativa ao corpo for compatível com a física local.

Não fazer handoff em espaço profundo.

Adicione testes de não-oscilação.

## P0-3 Corrigir InterplanetaryController

Controle velocidade relativa ao corpo.

```text
relative = playerVelocity - bodyVelocity
```

Thrust/brake/clamp trabalham em `relative`.

Depois:

```text
playerVelocity = bodyVelocity + relative
```

Remova o envelope hardcoded `+14000`.

Use margin configurável.

Limite a velocidade interplanetária por uma fonte de verdade.

## P0-4 Estabilizar proxy visual/câmera

Não copiar `FloatingOrigin3D.toRenderLocal()` para `PlayerController.position` a cada rebase.

O personagem renderizado deve permanecer estável perto da câmera.

Floating origin move o mundo relativo ao observador, não o observador aos saltos.

Adicione teste com vários rebases consecutivos.

## P0-5 Input de travel

Em `Game`, não usar `player.speedMode` congelado como intenção.

Derive do estado armado e input real.

Thrust deve seguir `cameraForward/right/up`.

B sem direção deve continuar acelerando para frente.

## P0-6 Pausar subsistemas locais

Com `travelDomain.localPhysicsActive === false`:

```text
não atualizar streamer local
não atualizar HLOD de Manaus
não atualizar traffic/population/Largo/forest/destruction
não rodar discovery local
```

Mantenha apenas o necessário para render/retorno.

## P0-7 Corrigir chão fantasma

`terrain.ts` deve obedecer `FEATURES.curvedManaus`.

Com a flag false, tudo continua 100% no espaço legado plano.

Marque meshes de terreno explicitamente com `userData.terrainSurface`.

Crie modo de mask:

```text
sheet
band
```

`terrain-backdrop` e `ground-cover` são `sheet` e devem ser recortados pela cratera independentemente do Y.

Sidewalks/boxes podem continuar usando a proteção vertical `band`.

Não resolver apenas movendo o backdrop para baixo.

## P1 Hardening

Audite `EarthProvider` e `MoonProvider` para garantir:

```text
frame atual -> body-fixed diretamente
logical position -> subtract active render origin
só então -> Float32 Mesh.position
```

O patch P0 pode ser entregue antes, mas documente qualquer problema ainda aberto.

## Testes

Implemente todos os cenários de `05-TESTS-AND-ACCEPTANCE.md`.

Rodar:

```bash
npm test
npm run build
npm run test:browser
```

Depois fazer smoke manual:

```text
Manaus -> 9 km -> interplanetary -> 1.000 km -> coasting -> thrust -> reentrada
```

e:

```text
crateras em pelo menos três tipos de superfície
```

## Saída esperada

Entregar:

1. resumo do root cause;
2. lista de arquivos alterados;
3. testes adicionados;
4. resultado de test/build/browser;
5. observações visuais do smoke;
6. bugs P1 que ficaram para o próximo patch;
7. commit(s) pequenos e temáticos, sem mega commit.
