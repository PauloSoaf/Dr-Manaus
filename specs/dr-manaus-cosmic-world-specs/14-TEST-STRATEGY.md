# Estratégia de testes

## Regra

A mega sprint só pode avançar em camadas.

Cada etapa deve deixar a `main` jogável.

## Testes existentes

Continuar executando:

```text
npm test
npm run build
npm run test:browser
npm run profile
```

Não remover testes atuais para facilitar a migração.

## Novos testes de coordenadas

Arquivo sugerido:

```text
tests/reference-frames.test.ts
```

Casos:

### Equador

```text
lat 0
lon 0
h 0

ECEF:
X = 6378137
Y = 0
Z = 0
```

### Polo

Validar raio polar WGS84.

### Round trip

```text
geodetic
-> ECEF
-> geodetic
```

Meta:

```text
lat/lon erro < 1e-8 graus
height erro < centímetros
```

ajustável conforme algoritmo escolhido.

### ENU

Anchor deve mapear para aproximadamente:

```text
0,0,0
```

Movimento leste/norte/up deve preservar orientação.

## Floating origin

Testar:

```text
posição lógica igual antes/depois
distância relativa igual
velocidade igual
camera direction igual
collider query igual
```

## Manaus regression

Manter e ampliar testes atuais.

Validar:

```text
GEO_ORIGIN
teatro
largo
arena
ponte
Ponta Negra
airfield
landmask
road heights
ghost buildings
tile limits
colliders
```

## Planet tiles

Arquivo:

```text
tests/planet-tiles.test.ts
```

Casos:

```text
6 faces cobrem o planeta
tiles irmãos compartilham borda
sem cracks acima da tolerância
parent cobre filhos
SSE refina corretamente
hysteresis funciona
```

## Surface continuity

Teste numérico:

```text
Manaus local point
-> geodetic
-> ECEF
-> planet render
-> local frame
```

precisa retornar ao mesmo ponto dentro da tolerância.

## Streaming

Adicionar testes para:

```text
abort de tile antigo
prioridade por SSE
prefetch por velocidade
budget global
pinned tile
cache LRU
fallback pai
provider ownership
```

## Provider ownership

Casos obrigatórios:

```text
Manaus real suprime global city
Manaus local water suprime ocean onde necessário
authored landmark suprime building genérico
tile real suprime procedural building
```

## Sistema Solar

Testes:

```text
Earth radius
Moon radius
planet order
ephemeris interpolation
body handoff continuity
angular size sanity
```

Não validar contra valores hardcoded espalhados. Carregar manifest de astronomia.

## Universo procedural

Testes:

```text
mesmo seed -> mesmo setor
outro setor -> conteúdo diferente
ordem de geração não altera resultado
unload/reload não altera sistema
BigInt address serializa/deserializa
```

## Persistência

Testar:

```text
destruir prédio
evict tile
reload tile
continua destruído

criar cratera
sair da Terra
voltar
cratera persiste

reconstruct
evict
reload
objeto continua reconstruído
```

## Browser E2E

Criar checkpoints visuais:

```text
Largo
100 m
1 km
10 km
100 km
órbita
Lua
```

Screenshots não precisam ser pixel-perfect em shaders temporais.

Comparar:

```text
presença
silhueta
ausência de buracos
ausência de duplicate world
```

## Stress

Rota atual:

```text
Arena -> Ponta Negra -> Ponte -> Centro
```

Manter.

Adicionar:

```text
Largo -> órbita -> Lua -> órbita -> Largo
```

## Fail fast

CI deve falhar se:

```text
WGS84 roundtrip quebra
Manaus muda origem
tile planetário gera NaN
frame transform gera Infinity
provider duplica ownership
streaming excede hard count
save perde mutation
```
