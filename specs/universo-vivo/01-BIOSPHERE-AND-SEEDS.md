# VIVO-01: Perfil de Biosfera Planetária e Canais de Sementes Independentes

## Objetivo
Implementar o gerador autoritativo de biosferas (`PlanetaryBiosphereProfile` e `BiosphereGenerator`), separando o gerador determinístico em canais ortogonais de sementes (`climateSeed`, `lifeSeed`, `floraSeed`, `faunaSeed`, `factionSeed`) e estabelecendo os critérios físico-químicos de habitabilidade, complexidade da vida, bioquímica e atmosfera.

## Contratos de Dados
- `schemaVersion: 1`
- `lifeTier`: `'sterile' | 'microbial' | 'vegetative' | 'fauna' | 'civilized'`
- `biochemistry`: `'carbon-water' | 'silicon-hydrocarbon' | 'ammonia-solvent' | 'mineral-geothermal' | 'none'`
- `habitabilityScore`: $[0.0, 1.0]$
- `dominantVegetationType`: `'none' | 'fungal-spores' | 'crystalline-shrubs' | 'bioluminescent-canopy' | 'chlorophyll-broadleaf' | 'silicate-lichens'`
- `dominantFaunaType`: `'none' | 'amphibious-crawlers' | 'chitinous-quadrupeds' | 'avian-gliders' | 'serpentine-burrowers' | 'bipedal-predators'`
- `civilizationStage`: `'none' | 'tribal-clans' | 'modular-colonies' | 'advanced-industrial' | 'ancient-ruins-guardians'`
- `atmosphereBreathability`: `'breathable' | 'toxic-respirator-required' | 'corrosive-hazard' | 'vacuum-sealed-suit'`
- `radiationLevel`: `'negligible' | 'moderate' | 'lethal-cosmic'`

## Arquitetura
1. Arquivo `src/world/life/PlanetaryBiosphere.ts`:
   - Interfaces canônicas e sementes independentes.
   - Algoritmo de derivação determinístico `generatePlanetaryBiosphere(body, profile)`.
2. Extensão de `CelestialBodyProfile.ts`:
   - Campo `biosphere?: PlanetaryBiosphereProfile` adicionado a `WorldEnvironment`.
3. Injeção em `SystemGenerator.ts`:
   - Corpos celestes do SolarSystem canônicos e sistemas procedurais recebem `biosphere` resolvida.
4. Testes:
   - `tests/planetary-biosphere-profile.test.ts`.

