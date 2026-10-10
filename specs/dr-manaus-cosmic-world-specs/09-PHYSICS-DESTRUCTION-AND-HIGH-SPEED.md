# Física, destruição e alta velocidade

## Objetivo

Manter o gameplay atual de supervelocidade e destruição sem tentar simular fisicamente o Sistema Solar inteiro.

## Física local

A física continua em metros locais.

Isso é importante para preservar:

```text
sweep contínuo
colisão com prédio
raycast
parkour
cratera
shockwave
debris
trânsito
```

## Não fazer física em ECEF

Um prédio não precisa ter collider com coordenadas:

```text
X = milhões de metros
Y = milhões de metros
Z = milhões de metros
```

O collider é projetado para o active local frame.

## Gravity model

Fases:

### Fase local

Manter gravidade de gameplay atual.

### Fase planetária

Adicionar vetor para o centro do corpo somente quando isso for desejável ao gameplay.

### Fase orbital opcional

Uma sprint futura pode implementar:

```text
mu / r²
velocidade orbital
trajetórias
```

Isso não é requisito para que os tamanhos e distâncias sejam reais.

## Viagem cósmica

Para atravessar Sistema Solar e galáxia em tempo humano, o jogo necessariamente usa viagem ficcional.

Separar:

```text
realScale
travelPhysics
```

A geometria lógica continua em distâncias reais.

O modo de viagem pode usar:

```text
aceleração exponencial
FTL
time compression
```

sem fingir que isso é física real.

## Speed domains

Manter os modos atuais no chão e em Manaus.

Adicionar posteriormente:

```text
planetary cruise
interplanetary
interstellar
intergalactic
```

A UI pode continuar exigindo ativação explícita para os modos extremos, preservando a ideia atual de mega mode.

## Colisão em alta velocidade

Nunca tentar carregar colisores por todo o corredor.

Política:

```text
perto do solo e em velocidade compatível
  collision sweep completo

mega speed dentro de cidade
  sweep contínuo em janela crítica
  conteúdo fora da janela sem física

altitude alta
  desativar colisores urbanos

interplanetário
  colisão apenas com corpos celestes / volumes macro
```

## Time to collision

Streaming e física devem compartilhar uma noção de:

```text
timeToContact
```

Se o jogador aponta para a Terra a velocidade enorme:

```text
Earth collision proxy precisa existir antes do terrain detalhado
```

O proxy macro pode ser elipsoide analítico.

## Colisão planetária analítica

Antes do terrain:

```text
ray / swept sphere vs WGS84 ellipsoid
```

Ao se aproximar:

```text
ellipsoid
->
terrain coarse
->
terrain tile
->
building collision
```

## Destruição em planeta curvo

Uma cratera não deve ser gravada em `x/z` global de Manaus.

Novo endereço:

```ts
interface TerrainMutation {
  bodyId: string;
  tile: PlanetTileAddress;
  localUv: [number, number];
  radiusM: number;
  depthM: number;
  seed: number;
}
```

Manaus pode continuar usando o sistema atual e converter seus eventos para esse modelo ao salvar.

## Destruição de edifícios

IDs precisam ser estáveis entre unload/reload.

A regra atual de não ressuscitar edifícios destruídos deve sobreviver a:

```text
troca de tile
troca de LOD
saída de Manaus
ida à Lua
retorno a Manaus
reload do save
```

## Debris

Debris é efêmero.

Não salvar cada pedaço.

Salvar somente:

```text
estado do edifício
cratera
scar persistente se necessário
```

## Reconstruct

O poder de reconstrução precisa operar por provider.

```ts
world.mutations.restore({
  frame,
  position,
  radiusM
});
```

O runtime descobre quais providers possuem mutações na região.

## Teste de velocidade

Manter `profile-flight.mjs` e incluir:

```text
100
500
2.000
5.000
10.000
50.000 m/s
```

Os valores acima de 10.000 m/s servem para validar scheduler e referência planetária, não densidade urbana máxima.

## Invariantes

- impacto horizontal em meio-fio não gera cratera absurda
- rebase não altera colisão
- troca de reference frame não altera energia de impacto local
- prédio destruído não reaparece em HLOD
- crateras sobrevivem a unload/reload quando persistência estiver ativa
- atores desligam antes de se tornarem custo invisível
