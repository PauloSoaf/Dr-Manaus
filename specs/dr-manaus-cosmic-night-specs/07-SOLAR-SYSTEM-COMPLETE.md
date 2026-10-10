# Sistema Solar navegável

## Reusar

Já existem:

```text
CelestialBody
SolarSystem
OfflineEphemeris
CelestialSystemRuntime
```

Agora precisam virar mundo navegável.

## Major bodies

```text
Sun
Mercury
Venus
Earth
Moon
Mars
Jupiter
Saturn
Uranus
Neptune
```

Depois:

- Phobos/Deimos;
- Galilean moons;
- Titan;
- selected major moons;
- dwarf planets optional.

## Representation tiers

### Tiny angular size

Point/billboard.

### Disc

Low sphere/impostor:

- phase;
- albedo;
- atmosphere/rings.

### Approach

Planet quadtree/provider.

### Surface

Local surface domain with terrain and collision.

## PlanetVisualProfile

```ts
interface PlanetVisualProfile {
  bodyId: string
  surfaceType: 'rocky' | 'ice' | 'gas' | 'star'
  atmosphere: AtmosphereProfile
  rings?: RingProfile
  terrain: TerrainProfile
}
```

## Moon vertical slice

Primeiro acceptance:

```text
Manaus
-> Earth orbit
-> Moon approach
-> Moon surface
-> takeoff
-> Earth
-> Manaus
```

Sem reload.

## Mars

Segundo pousável.

## Gas giants

Não criar chão convencional.

Representar:

- atmosphere;
- cloud layers;
- deep hazard boundary;
- fictional interior only if explicitly designed.

## Saturn rings

Poucos annular meshes/batches com transparency texture/procedural mask.

Não simular bilhões de partículas.

## Sun

- photosphere shader;
- corona;
- hazard volume;
- gravity source;
- no normal terrain.

## Lighting

Active star is the celestial light source.

Não reutilizar a luz local de Golden Hour de Manaus para planetas.

## Cleanup

Remover `SolarSystem.setSystemBodies()` antigo quando não houver consumidor.

Solar System deve continuar estável ao visitar outro sistema.
