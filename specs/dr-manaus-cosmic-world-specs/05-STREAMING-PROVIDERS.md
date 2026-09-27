# Streaming e providers

## Problema atual

Há dois mundos paralelos:

```text
streaming legado de Manaus
+
GlobalStreamingScheduler
```

`ManausProvider` existe, mas não governa Manaus.

## Objetivo

Um scheduler global precisa controlar o orçamento global sem exigir uma reescrita imediata do sistema da cidade.

## Migração segura

### Fase 1 adapter

`ManausProvider` pode começar como adapter de demanda.

Ele não deve fingir que carrega tiles se quem carrega é `RealCityLayer`.

Criar uma interface intermediária:

```ts
interface ManagedSubsystem {
  plan(context): ManagedDemand[]
  advance(budget): void
  stats(): ManagedStats
}
```

O scheduler pode conceder budget ao subsistema.

### Fase 2 ownership real

Mover gradualmente:

```text
real city shell tiles
real city near cells
procedural chunks
HLOD
landmarks
```

para demandas explícitas.

## ManausProvider mínimo válido

Ele deve:

```text
covers()
  responder corretamente à região

plan()
  produzir demandas reais

load()
  carregar ou solicitar carga real

activate()
  produzir conteúdo real

deactivate()
  retirar conteúdo

dispose()
  cancelar e liberar recursos
```

Nenhum método crítico pode ser:

```text
return []
throw "not fully wired"
{}
```

## Priority model

Exemplo:

```text
authored landmark        500
Manaus real detail       400
Manaus real shell        350
Manaus HLOD              300
Manaus procedural        250
Earth DEM                150
Earth base globe         100
```

Valores são ilustrativos.

O importante é a propriedade por canal:

```text
terrain
roads
buildings
landmarks
water
vegetation
actors
```

## Speed-aware streaming

### Local

priorizar:

- collision
- road
- buildings ahead
- destination

### Mega

reduzir:

- windows
- balconies
- NPCs
- traffic
- small props

aumentar:

- lead distance
- shell/HLOD

### Interplanetary

não carregar buildings por onde o jogador cruza a dezenas de km/s.

### Teleport

o destino recebe prioridade `gameplayCritical`.

## Eviction

Todo provider não finito precisa de política.

```text
activate
-> touch cache
-> no longer demanded
-> cooldown/hysteresis
-> deactivate
-> dispose GPU
-> optional disk cache
```

## UniverseRenderer

Não pode ser um segundo streaming runtime.

Transformar star sectors em demanda do scheduler.

Nunca:

```text
load 3x3x3
keep forever
frustumCulled = false
```

sem orçamento e eviction.
