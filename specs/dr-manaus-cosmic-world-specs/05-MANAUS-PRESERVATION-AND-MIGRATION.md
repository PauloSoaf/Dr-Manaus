# Preservação e migração de Manaus

## Regra principal

A nova arquitetura não deve piorar Manaus.

A cidade atual é o conteúdo de maior fidelidade do projeto.

Tudo que já funciona deve continuar funcionando depois da migração.

## Conteúdo obrigatório a preservar

```text
Largo de São Sebastião
Teatro Amazonas
Arena da Amazônia
Ponta Negra
Ponte Rio Negro
Iranduba / Cacau Pirêra
Encontro das Águas
MUSA
Bosque da Ciência
Mercado Adolpho Lisboa
Porto
Palácio Rio Negro
Relógio Municipal
Aeroporto Eduardo Gomes
vias reais compiladas
bairros
trânsito
landmask
skyline
edifícios reais
destruição
reconstrução
```

## Não fazer

Não substituir a cidade atual por:

```text
edifícios procedurais genéricos
uma textura plana
um mapa novo sem os detalhes atuais
um Cesium viewer separado
um segundo mundo desconectado
```

## ManausProvider

Criar uma fachada:

```ts
class ManausProvider implements WorldProvider {
  readonly id = 'earth/manaus';

  realCity: RealCityLayer;
  procedural: WorldStreamer;
  hlod: HLODManager;
  landmarks: LandmarkManager;
  largo: LargoDistrict;
  airport: AuthoredDestruction;
  traffic?: TrafficSystem;
}
```

Nas primeiras PRs essa classe pode apenas encapsular os sistemas atuais.

Depois, responsabilidades podem ser separadas.

## Cobertura

O manifest atual possui 645 tiles reais de 1.024 m.

Criar uma `ManausCoverageMask` derivada do manifest.

Ela será consultada por providers globais.

```text
se ManausCoverageMask cobre tile:
    não gerar cidade genérica
    não desenhar edifícios globais
    não duplicar vias
```

Essa é a evolução planetária do atual `replacesChunk()`.

## Origem geográfica

Fonte de verdade:

```text
Monumento à Abertura dos Portos
lat -3.130333
lon -60.022528
```

`GEO_ORIGIN` atual deve continuar produzindo exatamente o mesmo posicionamento local durante a fase de compatibilidade.

## Adapter

Primeira implementação:

```ts
class ManausFrameAdapter {
  fromLegacyWorld(x: number, y: number, z: number): SpatialPose;
  toLegacyWorld(pose: SpatialPose): Vector3;
}
```

Nenhuma classe atual precisa conhecer ECEF no primeiro commit.

## Transformação por tile

Passo seguinte:

```text
tile 0,0
  local mesh atual
  |
  v
tile ENU frame
  |
  v
EarthFixedFrame
```

O conteúdo dentro do tile permanece em metros locais.

A transformação do `Group` posiciona o tile na Terra.

## Landmarks authored

Cada landmark passa a ter:

```ts
interface GeoAnchor {
  lat: number;
  lon: number;
  heightM: number;
  headingRad?: number;
}
```

O `LANDMARKS` atual já contém latitude e longitude.

A posição local `x/z` passa a ser derivada, não primária.

## Largo e Teatro

O Largo deve continuar como world zero no modo de compatibilidade.

Validações obrigatórias:

```text
monumento local aproximadamente (0, 0)
teatro entre 75 e 110 m do monumento
teatro a oeste
igreja, Juma e Valer nas orientações atuais
```

Os testes atuais devem continuar passando.

## RealCityLayer

Fase 1:

```text
sem reescrita
```

Fase 2:

```text
Group raiz do tile recebe transform planetário
```

Fase 3:

```text
carregamento passa pelo scheduler global
```

Fase 4:

```text
RealCityLayer pode virar ManausRealCityProvider
```

Não fazer todas essas mudanças em uma PR.

## WorldStreamer atual

O streamer procedural continua responsável pelo filler local.

Apenas muda de nome conceitual:

```text
WorldStreamer atual
->
ManausProceduralStreamer
```

O novo `GlobalStreamingScheduler` fica acima dele.

## HLOD atual

O HLOD atual continua cobrindo a cidade onde os tiles detalhados não estão ativos.

Quando o jogador sobe muito:

```text
Manaus skyline
        |
        v
city cluster
        |
        v
planet surface texture/vector
```

Deve existir um handoff visual sem aparecer uma segunda Manaus.

## Destruição

IDs atuais como:

```text
real:<building-id>
hlod:<chunk>/building/<index>
landmark:<id>
```

devem ganhar namespace de mundo.

Exemplo:

```text
earth/manaus/real/<building-id>
earth/manaus/procedural/<chunk>/building/<index>
earth/manaus/landmark/teatro
```

Durante migração, aceitar IDs antigos no save.

## Trânsito

O trânsito continua local.

Não simular carros quando:

```text
jogador está muito rápido
jogador está em altitude orbital
Manaus não é o active local simulation region
```

Isso já é parcialmente feito pelo cutoff de atores.

## Checklist visual antes de cada merge

- spawn ainda está no Largo
- Teatro não mudou de posição
- ruas continuam no chão
- não há ghost buildings
- Arena continua no lugar
- Ponta Negra continua na margem correta
- Ponte continua conectando a outra margem
- aeroporto continua sem prédios procedurais sobre a pista
- bairros continuam identificáveis
- tráfego continua na malha real
- destruição não ressuscita ao trocar LOD
- textura e telhado próximos continuam presentes
- distância reduz detalhe, nunca remove a silhueta cedo demais
