# Galáxia e universo observável

## Objetivo

Permitir uma experiência do tipo:

```text
Sistema Solar
-> vizinhança estelar
-> Via Láctea
-> Grupo Local
-> outras galáxias
-> regiões cosmológicas distantes
```

sem armazenar cada estrela e planeta.

## Não confundir representação com catálogo

Gaia DR3 possui aproximadamente:

```text
1.811.709.771 fontes
```

e mais de 1,46 bilhão com astrometria completa.

Isso não significa que o jogo deve baixar esse catálogo.

## Catálogo em camadas

Criar arquivos pequenos derivados offline.

Exemplo:

```text
named-stars.json
  estrelas relevantes ao gameplay

bright-stars.bin
  estrelas visíveis importantes

nearby-stars.bin
  vizinhança solar detalhada

galactic-guide.bin
  amostra para distribuição da Via Láctea
```

## Setores determinísticos

Todo o restante nasce por setor.

```ts
interface StarSectorAddress {
  galaxyId: string;
  x: bigint;
  y: bigint;
  z: bigint;
  level: number;
}
```

Seed:

```text
hash(
  universeSeed,
  galaxyId,
  sector x/y/z
)
```

O mesmo setor sempre produz o mesmo conteúdo.

## Via Láctea

Modelo procedural:

```text
disco fino
disco espesso
bojo
halo
braços espirais aproximados
poeira
clusters
```

Estrelas reais conhecidas podem substituir objetos procedurais próximos.

Regra:

```text
real catalog
>
procedural candidate
```

## Sistemas estelares

Não gerar todos.

Quando um setor é materializado:

```text
star record
  |
  v
system seed
```

Quando o jogador se aproxima:

```text
planet count
planet types
orbits
moons
surface seeds
```

Só então esses dados precisam existir.

## Persistência

Um sistema procedural não precisa ser salvo integralmente.

Salvar:

```text
universeSeed
generatorVersion
mutations
discoveries
```

## Galáxias

Representação em níveis:

```text
muito longe
  sprite / analytic profile

longe
  point cloud / volume

dentro da galáxia
  sector density field
  stars próximas

perto de estrela
  star system
```

## Universo observável

Uma referência histórica da NASA/WMAP usa aproximadamente 45,6 bilhões de anos-luz como raio do volume observável no modelo educacional citado.

Esse valor não deve ser tratado como uma parede física simples.

O universo real envolve:

```text
expansão cosmológica
distância comóvel
lookback time
redshift
horizonte observável
```

Para gameplay, definir explicitamente:

```text
ObservableUniverseRepresentation
```

Ele é um volume lógico e visual inspirado em cosmologia, não uma simulação relativística completa.

## Hierarquia

```text
Universe
|
+-- CosmicCell
    |
    +-- GalaxyGroup
        |
        +-- Galaxy
            |
            +-- StarSector
                |
                +-- StarSystem
                    |
                    +-- CelestialBody
```

Cada nível trabalha em unidades convenientes.

Exemplo:

```text
CosmicCell     Mpc
Galaxy         kpc
StarSector     pc
StarSystem     AU
Planet         km / m
Local          m
```

Nunca converter tudo para metros e guardar em um único vetor.

## Viagem

A escala geométrica pode ser real.

O tempo de viagem não precisa ser.

Criar um modo fictício de aceleração cósmica.

Requisitos:

```text
ativação explícita
aceleração suave
FOV/VFX próprios
streaming preditivo
não gerar detalhe de planetas atravessados em milissegundos
reduzir colisão a macrocorpos
```

## Background cosmológico

No limite distante, usar:

```text
CMB-like backdrop
galaxy density field
procedural large scale structure visual
```

Se mapas WMAP ou outras imagens forem usados, verificar licença e créditos do asset específico.

## Não prometer um digital twin do universo

A especificação deve ser transparente:

```text
Terra
  geograficamente ancorada e com dados reais

Sistema Solar
  corpos e órbitas reais ou derivados de efemérides

estrelas próximas
  catálogo real parcial

Via Láctea distante
  híbrido real + procedural

universo distante
  procedural e estilizado
```

Esse híbrido é o que permite escala gigantesca com armazenamento finito.
