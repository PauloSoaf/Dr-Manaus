# Prompt mestre para Antigravity

Você é o engenheiro principal responsável por estabilizar a arquitetura planetária e cósmica do repositório `PauloSoaf/Dr-Manaus`.

Trabalhe na branch `feat/universe-map`.

Não faça merge na `main`.

A branch atual contém uma base arquitetural boa, porém a implementação recente avançou rápido demais e marcou fases como concluídas antes da integração real. Sua tarefa é corrigir isso com comportamento de principal engineer especializado em engine, geospatial rendering, streaming, Three.js/WebGPU, física local, large-world coordinates e sistemas procedurais determinísticos.

## Modo de trabalho obrigatório

Não trabalhe em modo rush.

Não tente “terminar o universo” em um commit.

Continue trabalhando de forma autônoma e iterativa enquanto houver tarefas seguras e objetivas no roadmap. Não pare depois do primeiro `npm test` verde. Só pare quando:

1. todos os acceptance criteria da etapa atual estiverem comprovadamente atendidos; ou
2. houver um blocker real que exija informação externa impossível de obter no repositório.

Não peça confirmação para correções rotineiras que já estejam cobertas pelas specs.

Antes de editar:

```bash
git status
git log --oneline --decorate -20
```

Leia:

```text
specs/dr-manaus-cosmic-world-specs/
docs/world/
dr-manaus-universe-hardening-pack/
```

se o hardening pack estiver presente no workspace.

Use o código atual como fonte de verdade.

## Regra de cautela

Para cada subsistema:

1. leia a implementação existente
2. entenda invariantes
3. encontre testes existentes
4. faça mudança mínima
5. adicione teste que falhava antes
6. rode testes relacionados
7. rode suite geral
8. rode build
9. faça inspeção de integração
10. commit pequeno

Nunca classifique uma fase como concluída apenas porque existe uma classe.

Nunca escreva comentários como “done”, “perfectly”, “fully implemented” sem teste que prove isso.

## Preserve a base boa

Não reescreva sem necessidade:

```text
WGS84
ECEF
ENU
ReferenceFrameGraph
FloatingOrigin3D
ManausFrameAdapter
PlanetQuadtree
ScreenSpaceError
GlobalStreamingScheduler
TileCache
PrefetchPredictor
Natural Earth landmask
cidade real de Manaus
```

## Primeira prioridade

Corrija primeiro os regressions P0:

1. `ManausProvider` fake
2. handoff do EarthProvider em altitude baixa
3. curvatura parcial de Manaus
4. FTL dentro do PlayerController
5. sector state sobrescrito pelo local PlayerController
6. SolarSystem sendo substituído por sistema procedural

Depois P1.

## Não faça

Não:

- colocar `9e18` numa `Vector3` de gameplay
- passar coordenada galáctica para `PhysicsWorld`
- usar `Math.random()` em conteúdo persistente
- criar terrain real da Terra com noise aleatório
- adicionar um segundo scheduler paralelo
- carregar setores para sempre sem eviction
- duplicar matemática WGS84 em shaders/classes aleatórias
- remover o terrain local antes da migração completa
- apagar Manaus para “simplificar”
- substituir o Sistema Solar por um array procedural
- transformar BigInt em Number e voltar para BigInt
- esconder teste vermelho
- adicionar feature flag e chamar isso de implementação

## Commits

Faça commits pequenos e semanticamente claros.

Exemplos:

```text
fix(planet): restore safe earth handoff while manaus remains local
fix(spatial): preserve bigint sector precision
refactor(world): make manaus provider a real scheduler adapter
refactor(travel): separate cosmic travel from local player physics
fix(terrain): remove nondeterministic fake earth elevation
feat(surface): anchor manaus tiles with WGS84 local frames
```

## Definition of done

Uma fase só termina quando:

```text
implementation
+
integration
+
test
+
build
+
runtime verification
+
docs truthful
```

Continue para a próxima tarefa apenas depois de fechar a anterior.
