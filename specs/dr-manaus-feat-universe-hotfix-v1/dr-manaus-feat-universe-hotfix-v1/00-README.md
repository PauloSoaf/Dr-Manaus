# DR Manaus - Hotfix feat/universe-map v1

Base obrigatória:

```text
branch: feat/universe-map
HEAD auditado: 14c726803cf9028137f845e73a948d63f8cbc2f9
data do HEAD: 2026-09-28T08:39:07Z
```

Este patch foi produzido após auditoria do código atual da `feat/universe-map`. Não usar a `main` como base.

## Bugs reportados

1. Ao entrar em velocidade interplanetária ainda próximo da Terra e tentar sair do planeta, o jogador passa a "teletransportar", perde o controle e o jogo fica praticamente injogável.
2. Existe um segundo chão verde por baixo do chão normal. Esse chão fantasma aparece dentro das crateras e buracos e acaba escondendo a deformação do terreno.

## Diagnóstico principal

Os dois relatos correspondem a regressões reais encontradas no código atual.

No voo interplanetário há mais de uma fonte de autoridade para posição, altitude, velocidade e frame. O principal erro é a altitude da Terra no frame baricêntrico ser obtida por um caminho que ainda interpreta coordenadas como se fossem coordenadas locais de Manaus. Isso pode fazer o `TravelDomain` alternar repetidamente entre `local` e `interplanetary`.

No terreno, `src/world/geodata/terrain.ts` passou a curvar o terreno de Manaus incondicionalmente, mesmo com:

```ts
FEATURES.curvedManaus === false
```

Ao mesmo tempo, o sistema de crateras ainda usa a representação plana e aplica o mask apenas numa faixa estreita de Y. Isso permite que superfícies verdes inferiores escapem do mask e apareçam dentro das crateras.

## Objetivo

Corrigir os bugs sem reescrever a arquitetura e sem prejudicar o estado atual de Manaus.

Prioridades:

```text
P0-1 eliminar ping-pong entre local e interplanetary
P0-2 tornar altitude e velocidade dependentes do frame correto
P0-3 estabilizar personagem/câmera em floating-origin rebases
P0-4 remover o chão verde fantasma das crateras
P0-5 impedir simulação/streaming local desnecessário enquanto estiver no espaço
P1   endurecer EarthProvider e provider rendering contra frames gigantes
```

## Ordem de execução

1. `01-AUDIT-CURRENT-HEAD.md`
2. `02-HOTFIX-INTERPLANETARY.md`
3. `03-HOTFIX-GHOST-GROUND.md`
4. `04-RELATED-REGRESSIONS.md`
5. `05-TESTS-AND-ACCEPTANCE.md`
6. `06-MASTER-PROMPT.md`

Não ligar `FEATURES.curvedManaus` como parte deste hotfix. Primeiro estabilizar o mundo atual.
