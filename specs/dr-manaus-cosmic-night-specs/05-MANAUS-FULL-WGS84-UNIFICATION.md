# Unificar Manaus inteira no WGS84

## Problema

`SurfaceTileFrame` existe e já é aplicado em buildings/chunks, mas outros subsistemas continuam flat.

## Criar SurfaceFrameService

Facade única:

```ts
interface SurfaceFrameService {
  frameForTile(bodyId, tileKey, anchorX, anchorZ): SurfaceTileFrame
  legacyPointToRenderLocal(...)
  legacyDirectionToRenderLocal(...)
  legacyColliderToRenderLocal(...)
}
```

Cache por tile.

## Migrar juntos

### Geometry

- RealCity buildings
- procedural chunks
- HLOD
- skyline
- roads
- lane markings
- ground cover
- vegetation
- Largo
- landmarks
- airport
- bridge
- water

### Gameplay

- colliders
- traffic
- road graph projection
- destruction
- crater queries
- teleport destinations
- mission targets
- landmark discovery
- raycasts

## Road segmentation

Estrada longa não usa um único ENU frame.

Segmentar por tile ou distance threshold.

## Colliders

Source remains geographic/legacy.

Active collider is transformed into current render-local/physics-local frame.

## Traffic

Road graph permanece source data.

Vehicle render transforms are derived.

Não sobrescrever source graph com posições curvas.

## Feature flag consistency

Enquanto `curvedManaus=false`:

ou tudo local permanece flat,

ou a feature deve ser completada e ativada.

Não aceitar metade curvada escondida atrás de flag off.

## Clean up

Depois que `curvedManaus=true` estiver verificado:

- remover hacks legacy de render;
- manter compatibility adapters apenas na ingestão;
- tirar duplicações de transform.

## Acceptance

Em tiles distantes do anchor:

```text
building base
road
vehicle wheel
ground
collider
```

devem coincidir dentro da tolerância local.
