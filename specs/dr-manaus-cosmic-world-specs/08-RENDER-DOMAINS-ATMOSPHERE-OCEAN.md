# Domínios de renderização, atmosfera e oceano

## Por que não usar uma única escala GPU

Mesmo com logarithmic depth, uma cena contendo:

```text
um parafuso a 20 cm
Terra com 12.756 km
Sol a 149,7 milhões km
Netuno a bilhões de km
uma estrela a anos-luz
```

não é uma boa arquitetura de precisão.

O renderer deve trabalhar em domínios.

## Domínio local

Responsável por:

```text
jogador
Manaus
edifícios
ruas
vegetação
física
destruição
NPCs
veículos
terrain próximo
água local
```

Unidade:

```text
1 unidade = 1 metro
```

Coordenadas ficam pequenas via floating origin.

## Domínio planetário

Responsável por:

```text
globo
continentes
oceanos
atmosfera
nuvens globais
terrain distante
Lua próxima quando aplicável
```

Esse domínio pode usar uma escala de renderização própria.

A câmera é derivada da mesma pose lógica.

## Domínio celestial

Responsável por:

```text
Sol distante
Lua distante
planetas distantes
estrelas
Via Láctea
galáxias
```

Corpos distantes devem preservar:

```text
direção aparente
tamanho angular
fase
iluminação
ocultação relevante
```

Eles não precisam usar metros crus na GPU.

## Composição

Ordem conceitual:

```text
celestial background
planetary body
atmospheric scattering
local world
transparent local effects
UI
```

Se forem utilizadas cenas/câmeras distintas, a composição precisa definir claramente limpeza de depth e ordem.

## Handoff de corpo

Um planeta distante começa como representação celestial.

Quando a distância cai abaixo do limiar:

```text
celestial sphere/impostor
       |
       v
planet low LOD
       |
       v
planet quadtree
       |
       v
terrain local
```

Usar crossfade ou coexistência curta com pesos complementares.

Nunca trocar de uma esfera para terreno em um único frame.

## Three.js

O projeto usa `WebGPURenderer`.

Manter WebGPU como caminho principal e WebGL 2 como fallback.

Three.js r186 suporta opções de:

```text
logarithmicDepthBuffer
reversedDepthBuffer
```

A sprint deve criar um benchmark antes de mudar o modo de depth global.

Decisão inicial:

```text
não aumentar far plane para escala astronômica
não habilitar log depth e reversed depth sem validação
resolver escala primeiro por reference frames e render domains
```

Depois disso, comparar:

```text
WebGPU + reversed depth
versus
configuração atual com log depth
```

## Atmosfera

O `Atmosphere` atual usa sky sphere e transição visual por altitude.

A nova atmosfera deve conhecer:

```text
raio do planeta
altura da camada atmosférica
direção real do Sol
densidade aproximada
altitude da câmera
```

Primeira versão recomendada:

```text
Rayleigh + Mie aproximados
shader TSL
8 a 16 samples conforme qualidade
```

Fallback low:

```text
lookup simplificado
```

## Altitudes

Remover a interpretação atual de:

```text
karman = 26 km
```

Adotar 100 km como referência convencional da Linha de Kármán para UI e regras de gameplay.

A atmosfera visual pode decair continuamente. Ela não precisa desligar exatamente aos 100 km.

## Remover maxAltitude

O clamp atual:

```text
SPACE.maxAltitude = 140000
```

deve desaparecer como limite global.

Pode existir apenas como limite temporário durante feature flags antes de o próximo domínio estar pronto.

## Nuvens

Nuvens locais atuais continuam úteis perto de Manaus.

Longo prazo:

```text
local cloud volume / sprites
global cloud shell
```

A troca depende de altitude.

Não instanciar nuvens locais por todo o planeta.

## Oceano

Camadas:

```text
EarthOcean
  água global no nível do mar

ManausHydrology
  Rio Negro
  Solimões
  Encontro das Águas
  orlas e máscaras locais
```

O provider local vence onde houver cobertura.

## Sol

O `SpaceLayer` atual posiciona o disco a 120 km da câmera.

Isso deve ser substituído por direção e tamanho angular derivados da posição lógica real do Sol.

Mesmo quando renderizado em uma distância normalizada, seu ângulo deve ser coerente.

## Estrelas

O starfield procedural atual pode continuar como fallback visual.

Depois:

```text
catálogo Gaia próximo/brilhante
+
fundo procedural
```

O fundo nunca precisa materializar bilhões de meshes.

## Sombras

Sombras locais continuam com uma luz direcional.

A direção dessa luz passa a vir da posição relativa Sol -> Terra -> jogador.

Não é necessário colocar um PointLight a 1 UA na cena local.
