# Horizonte do universo observável

## Conceito

O universo observável tem aproximadamente 92 bilhões de anos-luz de diâmetro no modelo cosmológico corrente.

Isso não é uma esfera com parede sólida.

A região observável depende do observador, e o universo total pode ser muito maior ou infinito.

## CosmologyDomain

Unidades:

```text
Mpc / Gpc
```

State:

```ts
interface CosmologicalAddress {
  cell: BigInt3
  localMpc: Vec3
  epoch: number
}
```

## LOD

Nearby:

```text
individual galaxy
```

Hundreds Mpc:

```text
groups / clusters
```

Gpc:

```text
cosmic web
```

Near horizon:

```text
redshift/dimming
background representation
```

## Last scattering / CMB

A camada visual mais distante pode ser um CMB-like backdrop.

Não é terrain.

## Gameplay

### Scientific mode

O horizonte é representado como limite observável, não uma parede alcançável normal.

### Fantasy mode

Opcionalmente, pode existir:

```text
Beyond Observable Universe
```

como domínio explicitamente ficcional.

Separar claramente da parte científica.

## Storage

A escala de 92 bilhões de ly não aumenta o install proporcionalmente.

Procedural cosmology cells são geradas apenas ao redor do current address.

## Hierarquia

```text
Cosmology cell
-> galaxy group
-> galaxy
-> sector
-> system
-> body
-> surface tile
-> local frame
```

## Acceptance

Afastar de Earth até horizon representation sem qualquer scene `Vector3` receber valores em Gpc.
