# Contratos de dados e APIs propostas

## SpatialContext

```ts
export interface SpatialContext {
  timeS: number;
  player: SpatialPose;
  frame: ActiveReferenceFrame;
  localVelocityMps: [number, number, number];
  altitudeM?: number;
  bodyId?: string;
}
```

## ActiveReferenceFrame

```ts
export interface ActiveReferenceFrame {
  id: string;
  parentId?: string;
  kind:
    | 'render-local'
    | 'surface-enu'
    | 'body-fixed'
    | 'body-inertial'
    | 'system'
    | 'galactic'
    | 'cosmic';

  logicalOrigin: SpatialPose;
}
```

## RebaseEvent

```ts
export interface RebaseEvent {
  frameId: string;
  previousOrigin: SpatialPose;
  nextOrigin: SpatialPose;
  localDeltaM: [number, number, number];
}
```

## TileKey

Evitar colisão entre tiles locais e planetários.

```ts
export type WorldTileKey =
  | {
      kind: 'manaus';
      tx: number;
      tz: number;
    }
  | {
      kind: 'planet';
      bodyId: string;
      face: number;
      level: number;
      x: number;
      y: number;
    }
  | {
      kind: 'star-sector';
      galaxyId: string;
      level: number;
      x: bigint;
      y: bigint;
      z: bigint;
    };
```

Serialização deve ser determinística.

## TilePayload

```ts
export interface TilePayload {
  key: WorldTileKey;
  version: number;

  cpuBytes: number;
  estimatedGpuBytes: number;

  geometricErrorM?: number;

  geometry?: unknown;
  imagery?: unknown;
  collision?: unknown;
  metadata?: unknown;
}
```

## StreamingContext

```ts
export interface StreamingContext {
  spatial: SpatialContext;

  camera: {
    fovRad: number;
    viewportHeightPx: number;
    forward: [number, number, number];
  };

  quality: {
    sseTargetPx: number;
    detailFactor: number;
  };

  budget: StreamingBudget;
}
```

## StreamingBudget

```ts
export interface StreamingBudget {
  mainThreadMs: number;
  maxConcurrentFetches: number;
  maxWorkerJobs: number;
  maxActivationsPerFrame: number;
  gpuUploadBytesPerFrame: number;
  gpuMemorySoftBytes: number;
  gpuMemoryHardBytes: number;
}
```

## Provider ownership

```ts
export interface CoverageClaim {
  providerId: string;
  priority: number;
  region: SpatialRegion;
  channels: Array<
    | 'terrain'
    | 'water'
    | 'roads'
    | 'buildings'
    | 'vegetation'
    | 'landmarks'
    | 'physics'
  >;
}
```

Exemplo Manaus:

```text
buildings    high priority
roads        high priority
landmarks    highest priority
terrain      local override when calibrated
water        local hydrology override
```

## MutationStore

```ts
export interface MutationStore {
  getForTile(key: WorldTileKey): readonly WorldMutation[];
  append(mutation: WorldMutation): void;
  remove(id: string): void;
  flush(): Promise<void>;
}
```

## WorldMutation

```ts
export type WorldMutation =
  | {
      type: 'destroy-object';
      id: string;
      timestamp: number;
    }
  | {
      type: 'terrain-deformation';
      bodyId: string;
      tile: WorldTileKey;
      u: number;
      v: number;
      radiusM: number;
      depthM: number;
      seed: number;
    };
```

## Celestial handoff

```ts
export interface BodyHandoffState {
  bodyId: string;
  mode: 'celestial' | 'planet' | 'surface';
  blend: number;
  apparentAngularRadiusRad: number;
  distanceToSurfaceM: number;
}
```

A renderização pode usar `blend`, mas a posição lógica nunca depende dele.
