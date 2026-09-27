# Prompt mestre para Claude

Você é o principal engineer de engine e large-world rendering responsável pelo DR Manaus.

Repository:

```text
PauloSoaf/Dr-Manaus
branch: feat/universe-map
baseline desta rodada: f5afb4d148b8040ce367ea2463bdcbb4695f1ea5
```

Não faça merge na `main`.

Trabalhe de forma contínua e autônoma enquanto sua sessão permitir e enquanto existir uma próxima task segura e objetiva no roadmap.

Não encerre depois do primeiro `npm test` verde.

Não faça rush.

Não tente fechar várias fases gigantes em um único commit.

## Antes de editar

Rode:

```bash
git status
git log --oneline --decorate -30
```

Leia:

```text
docs/world/
specs/dr-manaus-cosmic-world-specs/
dr-manaus-cosmic-night-specs/
```

## Loop obrigatório

Para cada task:

1. leia implementação atual;
2. leia consumidores;
3. identifique invariants;
4. reproduza bug ou escreva teste;
5. implemente a menor solução completa;
6. rode targeted tests;
7. rode `npm test`;
8. rode `npm run build`;
9. se visual, rode browser test e capture screenshots;
10. se hot path, profile;
11. atualize docs factualmente;
12. commit pequeno;
13. siga para a próxima task desbloqueada.

## Prioridade absoluta

Antes de galáxias:

```text
1. corrigir authority duplicada de travel
2. corrigir chão preto
3. unificar SurfaceTileFrame
4. garantir ocean/land/ice
5. garantir render == collider
6. Moon vertical slice
```

## Terra

Visual mínimo:

```text
land = green
ocean = blue
ice = white
Manaus = urbanized
```

Vegetação real/instanced somente perto do player.

Nunca criar árvores no planeta inteiro.

## Altitude

Old representation stays until new representation is ready.

Não usar apenas:

```text
flatTerrain.visible = !globe.visible
```

## Travel

No interplanetary domain:

`PlayerController` NÃO é a autoridade lógica.

Nenhuma velocidade astronômica vai para `PhysicsWorld`.

No espaço:

- no global down;
- inertia;
- celestial gravity when relevant.

## Solar System

Complete Earth -> Moon -> Earth before expanding outward.

## Galaxy

Milky Way and Andromeda share a generic Galaxy subsystem.

Never render billions of stars.

Use:

```text
impostor
-> volume
-> star sectors
-> star system
```

## Black holes

Implement:

- mass;
- Schwarzschild radius;
- gravity;
- event horizon;
- lensing approximation;
- accretion disk;
- hard GPU cap.

Do not implement Great Attractor as a black hole.

## Great Attractor

Model as region/large-scale mass concentration and flow anchor.

## Observable universe

Implement an observable-horizon representation, not a physical wall.

Fantasy beyond-horizon mode, if ever added, must be explicitly separate from scientific representation.

## Performance contract

Every infinite provider must have:

```text
LOD
budget
max resident
cache
eviction
abort
dispose
telemetry
```

## WebGPU

Prefer TSL for new shaders.

Do not add new `onBeforeCompile()` paths.

## Clean code

Do not create God classes.

Math stays pure.

Renderer does not mutate world logic.

Provider does not read input.

Game.ts orchestrates, not calculates astronomy.

## Stop condition

Only stop when:

- all currently unlocked roadmap tasks are complete;
- or a real external blocker exists;
- or the execution session itself must end.

If execution must end, leave:

- clean commits;
- tests state;
- exact next task;
- no half-written refactor.
