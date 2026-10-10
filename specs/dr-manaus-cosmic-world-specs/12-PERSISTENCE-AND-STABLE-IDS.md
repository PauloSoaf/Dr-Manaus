# Persistência e IDs estáveis

## Problema

Streaming implica que objetos somem da memória.

Destruição e progresso não podem sumir junto.

## Princípio

Base world é imutável.

Save contém deltas.

```text
base dataset
+
procedural seed
+
player mutations
=
current world
```

## WorldObjectId

Formato lógico:

```text
<provider>/<region>/<type>/<source-id>
```

Exemplos:

```text
earth/manaus/real/building/<stable-id>
earth/manaus/landmark/teatro
earth/manaus/road/<road-id>
earth/tile/<face>/<level>/<x>/<y>/terrain
solar/moon/tile/<...>
galaxy/milky-way/sector/<...>/star/<...>
```

## Source IDs

Quando disponível, preferir identificador estável da fonte.

Exemplos:

```text
Overture GERS ID
OSM ID + source/version
authored ID
procedural deterministic ID
```

## Save schema

```ts
interface WorldSave {
  schemaVersion: number;
  worldSeed: string;
  generatorVersion: string;

  destroyed: Record<string, DestroyedState>;
  terrainMutations: TerrainMutation[];
  discoveries: string[];
  playerSpatialState: SerializedSpatialPose;
}
```

## Mutações por tile

Não manter um map global gigantesco em RAM.

Indexar:

```text
body
provider
tile
```

Carregar mutações junto com o tile.

## Compatibilidade com IDs atuais

Durante a migração:

```text
real:<id>
hlod:<id>
landmark:<id>
```

devem ser convertidos quando carregados.

Não quebrar saves sem migration.

## Procedural generator version

Um seed só é suficiente se o algoritmo continuar igual.

Salvar:

```text
generatorVersion
```

Se a geração mudar:

```text
migrar
ou
manter legacy generator
ou
invalidar somente regiões nunca visitadas
```

## Estado de cidade

Edifício destruído precisa continuar destruído depois de:

```text
evict
reload
saída do planeta
retorno
mudança de LOD
```

## Crateras

Salvar parâmetros, não a malha resultante.

Exemplo:

```json
{
  "tile": "earth/...",
  "u": 0.43,
  "v": 0.18,
  "radiusM": 120,
  "depthM": 19,
  "seed": 88192
}
```

Ao recarregar:

```text
base terrain
+
crater operations
```

## Cache não é save

IndexedDB de tiles pode ser apagado.

O save de mutações não pode depender de o tile continuar no cache.

## Descobertas

Landmarks atuais podem continuar com IDs simples durante compatibilidade.

Longo prazo:

```text
earth/manaus/landmark/teatro
solar/moon
solar/mars
...
```
