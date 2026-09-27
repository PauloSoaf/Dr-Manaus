# Prompt específico para a Terra

Conserte a Terra antes de continuar galáxias.

## Bugs relatados

- oceano visualmente parece terra/floresta;
- usuário quer terra verde;
- Manaus deve aparecer urbanizada;
- polos/gelo brancos;
- existe altitude intermediária com chão preto;
- atmosfera local -> espaço não é contínua.

## Arquivos iniciais

```text
src/world/planet/EarthLandMask.ts
src/world/planet/EarthGlobe.ts
src/world/planet/EarthElevation.ts
src/world/providers/EarthProvider.ts
src/rendering/Atmosphere.ts
src/rendering/SpaceLayer.ts
src/game/Game.ts
src/world/geodata/terrain.ts
src/world/ForestBackdrop.ts
```

## Task E1

Criar `EarthSurfaceClass`.

Default:

```text
land green
ocean blue
ice white
Manaus urban
```

Remover arid latitude heuristic do modo simples.

## Task E2

Ocean TSL:

- Fresnel;
- Sun glint;
- deep blue;
- coast lighter;
- no geometry waves globally.

## Task E3

Criar EarthTransitionController.

Não esconder flat terrain enquanto next coverage não estiver ready.

## Task E4

Criar ManausRegionalProxy para altitude intermediária.

## Task E5

Resolver SurfaceTileFrame parcial.

Buildings, roads e colliders não podem divergir.

## Task E6

Atmosphere continuous blend.

```text
blue -> dark blue -> navy -> vacuum
```

## Tests

Altitude sweep + screenshots.

Não prossiga para galaxy subsystem antes da subida Terra -> órbita estar visualmente limpa.
