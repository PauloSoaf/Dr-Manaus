# Persistência

## Problema atual

`WorldMutationStore` é um protótipo útil, mas não resolve a fase inteira.

## Storage

Para web:

```text
IndexedDB
```

deve ser a store principal de mutations volumosas.

`localStorage` pode guardar apenas pequenas preferências ou metadata.

## Schema

Exemplo:

```ts
interface WorldSaveHeader {
  schemaVersion: number
  generatorVersion: number
  worldSeed: string
  createdAt: number
  updatedAt: number
}

interface WorldMutation {
  id: string
  address: UniverseAddress
  bodyId?: string
  tileId?: string
  objectId?: string
  type:
    | 'terrain-crater'
    | 'building-destroyed'
    | 'building-restored'
    | 'discovery'
  payload: unknown
  updatedAt: number
}
```

## Stable IDs

### Building

Derivar de:

```text
provider
source feature ID
tile
```

Não de array index transitório.

### Terrain mutation

Derivar de:

```text
bodyId
surface tile
mutation UUID
```

## Carregamento

Não carregar todas as crateras do planeta.

```text
active tile
-> load mutations for tile
-> apply
-> tile unload
-> release runtime data
```

## Versioning

Mudança no generator não pode destruir save silenciosamente.

Guardar:

```text
schemaVersion
generatorVersion
```

e migrar explicitamente.

## Quota

Persistência precisa:

- medir tamanho
- compactar
- limitar history
- tratar quota exceeded
- não bloquear main thread
- evitar JSON gigante síncrono a cada crater

## Requisitos

Destruir um prédio em Manaus:

```text
salvar
-> sair da Terra
-> entrar em outro sistema
-> retornar
-> prédio continua destruído
```

Reconstrução precisa remover/alterar a mutation correspondente.
