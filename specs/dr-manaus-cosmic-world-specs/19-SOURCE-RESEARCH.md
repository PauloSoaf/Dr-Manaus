# Pesquisa e fontes

## Snapshot do projeto

Repositório:

https://github.com/PauloSoaf/Dr-Manaus

HEAD analisado:

https://github.com/PauloSoaf/Dr-Manaus/commit/d2e03428b1d9ba90fdc7b2a5112c280e6686fead

Arquivos principais auditados:

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/game/Game.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/core/config.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/world/geodata/geodata.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/world/streaming/WorldStreamer.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/world/streaming/GenerationPool.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/world/streaming/ChunkPriority.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/world/lod/HLODManager.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/world/realcity/RealCityLayer.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/public/geodata/real-city/manifest.json

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/rendering/RendererManager.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/rendering/Atmosphere.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/rendering/SpaceLayer.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/player/PlayerController.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/src/player/CameraController.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/tests/streaming.test.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/tests/realcity.test.ts

https://github.com/PauloSoaf/Dr-Manaus/blob/main/scripts/profile-flight.mjs

## WGS84

NGA Geomatics, WGS 84:

https://earth-info.nga.mil/?action=wgs84&dir=wgs84

Parâmetros usados:

```text
semi-major axis = 6378137.0 m
inverse flattening = 298.257223563
```

## 3D Tiles e HLOD

OGC 3D Tiles:

https://www.ogc.org/standards/3dtiles/

Especificação 1.0:

https://docs.ogc.org/cs/18-053r2/18-053r2.html

Conceitos aproveitados:

```text
hierarquia
tile tree
geometric error
Screen Space Error
refinement
streaming massivo
```

O projeto não é obrigado a implementar o formato 3D Tiles completo. A arquitetura usa os princípios.

## Three.js

WebGPURenderer:

https://threejs.org/docs/pages/WebGPURenderer.html

WebGLRenderer:

https://threejs.org/docs/pages/WebGLRenderer.html

Pontos relevantes:

```text
WebGPU com fallback WebGL 2
logarithmicDepthBuffer
reversedDepthBuffer
```

## Natural Earth

Downloads:

https://www.naturalearthdata.com/downloads/

Terms:

https://www.naturalearthdata.com/about/terms-of-use/

Escalas:

```text
1:10m
1:50m
1:110m
```

Licença:

```text
public domain
```

## Copernicus DEM

Coleção:

https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM

Documentação:

https://documentation.dataspace.copernicus.eu/Data/Others/CCM.html

Atualização de acesso GLO-30 em 2026:

https://dataspace.copernicus.eu/news/2026-8-25-copernicus-dem-30m-view-service-update

Resoluções:

```text
GLO-30  30 m
GLO-90  90 m
```

## Overture Maps

Release calendar:

https://docs.overturemaps.org/release-calendar/

Release atual na data da pesquisa:

```text
2026-09-23.0
```

Attribution and Licensing:

https://docs.overturemaps.org/attribution/

Buildings e Transportation:

```text
ODbL
```

## Solar System

NASA, planet sizes and distances:

https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/

NASA, solar system scale:

https://science.nasa.gov/learning-resources/how-big-is-the-solar-system/

JPL Horizons:

https://ssd.jpl.nasa.gov/horizons/manual.html

Na data da pesquisa, o manual estava na versão 4.98e de 2026-08-25 e descrevia DE441 para movimentos de barycenters planetários em longo prazo.

## Gaia

ESA Gaia DR3:

https://www.cosmos.esa.int/web/gaia/dr3

Valores de referência:

```text
total sources              1,811,709,771
full astrometry            1,467,744,818
```

Esses números reforçam que o runtime precisa de subsets e LOD, não do catálogo inteiro.

## Universo observável

NASA WMAP educational model:

https://map.gsfc.nasa.gov/resources/edactivity1LD.html

O modelo citado representa raio de aproximadamente:

```text
45,6 bilhões de anos-luz
```

Isso é contexto cosmológico, não uma justificativa para tratar o universo real como uma esfera euclidiana rígida.

## Megaton Rainfall

PlayStation Blog, texto do próprio desenvolvedor:

https://blog.playstation.com/archive/2015/10/28/first-person-superhero-sim-megaton-rainfall-coming-to-ps4-and-ps-vr/

Descrição pública relevante:

```text
real-sized Earth
procedurally generated cities and terrain
seamless planet-scale rendering
```

Entrevista técnica:

https://wccftech.com/megaton-rainfall-interview-real-sized-earth-save/

Pontos descritos pelo desenvolvedor:

```text
planet rendering
seamless transition outer space -> ground
large cities
instancing
many relatively simple city objects
```

Entrevista sobre procedural generation:

https://ap2hyc.com/2015/04/interview-alfonso-del-cerro-lead-developer-of-megaton-rainfall/amp/

O objetivo do DR Manaus é alcançar uma experiência de escala semelhante usando sua própria arquitetura. Não assumir detalhes internos não publicados do engine de Megaton Rainfall.
