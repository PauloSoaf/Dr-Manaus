# Riscos e guardrails

## Risco 1: reescrever Manaus

Sintoma:

```text
arquitetura nova funciona no espaço
cidade perde qualidade
```

Mitigação:

```text
ManausProvider como adapter
regression tests
screenshots baseline
PRs pequenas
```

## Risco 2: acreditar que logarithmic depth resolve tudo

Não resolve.

Ele melhora depth precision, mas não corrige:

```text
transform precision
physics precision
float32 vertex buffers
astronomical coordinates
streaming
```

Mitigação:

```text
reference frames
floating origin
render domains
```

## Risco 3: colocar ECEF diretamente nos vertices

ECEF da Terra está na ordem de milhões de metros.

Pode funcionar para proxy, mas é ruim como base de detalhe de centímetros.

Mitigação:

```text
tile-local vertex coordinates
tile transform relativo à câmera
```

## Risco 4: aumentar camera far indefinidamente

Mitigação:

```text
multi-domain rendering
celestial angular representation
```

## Risco 5: DEM levantar prédios duas vezes

Copernicus é DSM.

Mitigação:

```text
filtro urbano
terrain calibration
separação terrain/building
```

## Risco 6: crack entre tiles

Mitigação:

```text
shared edge sampling
skirts quando necessário
matching parent/child edges
morphing de LOD
```

## Risco 7: planet popping

Mitigação:

```text
parent visible until child ready
crossfade
SSE hysteresis
```

## Risco 8: prefetch impossível em FTL

Não tentar carregar cidade durante trânsito interestelar.

Mitigação:

```text
LOD dependente de speed domain
macro body proxies
handoff somente quando desacelera ou se aproxima
```

## Risco 9: cache sem limite

Mitigação:

```text
LRU por bytes
soft/hard memory limit
IndexedDB quota handling
```

## Risco 10: APIs externas instáveis

Mitigação:

```text
offline compiler
versioned source manifests
checked-in or hosted compiled assets
```

## Risco 11: licença de geodata

Mitigação:

```text
attribution manifest
source version
license per theme
data pipeline audit
```

## Risco 12: GLO-30 acesso

Em 2026 o acesso ao view service GLO-30 foi restringido a categorias autorizadas/registro CCM em fluxos específicos.

Mitigação:

```text
GLO-90 baseline
GLO-30 optional enhancement
```

## Risco 13: universo procedural inconsistente após update

Mitigação:

```text
generatorVersion
stable hash
save mutations
```

## Risco 14: `Game.ts` virar monolito

Mitigação:

```text
UniverseRuntime
ProviderRegistry
RenderDomainComposer
```

## Risco 15: duas fontes de posição

Não deixar:

```text
player.position
spatialPosition
ECEF
```

divergirem.

Durante migração, declarar explicitamente qual é fonte de verdade em cada fase.

Meta final:

```text
SpatialRuntime é fonte de verdade global
PlayerController trabalha em frame local
```

## Risco 16: transformar a mega task em um merge impossível

Mitigação:

```text
feature flags
commits por camada
tests antes da troca de ownership
compatibility adapters
```

## Guardrail de produto

A experiência de Manaus vem antes da quantidade de universo.

Se houver conflito entre:

```text
uma Terra inteira medíocre
e
Manaus boa + Terra estrutural
```

preservar Manaus e evoluir a camada planetária incrementalmente.
