/**
 * Sparse constructive-solid-geometry edits in a planet's body-fixed frame.
 *
 * JavaScript numbers are IEEE-754 Float64 values. Keeping these coordinates as plain numbers and
 * outside render objects preserves metre precision across floating-origin rebases.
 */

/** A Cartesian position in metres in the owning body's fixed frame. */
export type BodyFixedPoint = readonly [number, number, number];

/** Axis-aligned bounds in body-fixed metres. */
export interface PlanetVolumeBounds {
  readonly minBodyFixedM: BodyFixedPoint;
  readonly maxBodyFixedM: BodyFixedPoint;
}

export interface SubtractSphereEdit {
  readonly id: string;
  readonly bodyId: string;
  readonly type: 'subtract-sphere';
  readonly centerBodyFixedM: BodyFixedPoint;
  readonly radiusM: number;
  /** Serializable production demand metadata; the sphere remains the CSG authority. */
  readonly impact?: {
    readonly surfaceContactBodyFixedM: BodyFixedPoint; readonly surfaceNormalBodyFixed: BodyFixedPoint;
    readonly craterRadiusM: number; readonly craterDepthM: number;
  };
}

export interface SubtractCapsuleEdit {
  readonly id: string;
  readonly bodyId: string;
  readonly type: 'subtract-capsule';
  readonly aBodyFixedM: BodyFixedPoint;
  readonly bBodyFixedM: BodyFixedPoint;
  readonly radiusM: number;
}

/** Supported removal operations. More operations can be added with a schema migration. */
export type PlanetVolumeEdit = SubtractSphereEdit | SubtractCapsuleEdit;

const frozenPoint = (value: unknown, label: string): BodyFixedPoint => {
  if (!Array.isArray(value) || value.length !== 3 || value.some(component => !Number.isFinite(component))) {
    throw new TypeError(`${label} must contain exactly three finite body-fixed coordinates`);
  }
  return Object.freeze([value[0] as number, value[1] as number, value[2] as number]);
};

const requiredText = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
};

const positiveRadius = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError('radiusM must be a positive finite number');
  }
  return value;
};

/** Validates, clones and freezes an edit at the boundary of the volume system. */
export function parsePlanetVolumeEdit(value: unknown): PlanetVolumeEdit {
  if (!value || typeof value !== 'object') throw new TypeError('planet volume edit must be an object');
  const source = value as Record<string, unknown>;
  const id = requiredText(source.id, 'edit id');
  const bodyId = requiredText(source.bodyId, 'bodyId');
  const radiusM = positiveRadius(source.radiusM);
  if (source.type === 'subtract-sphere') {
    return Object.freeze({
      id, bodyId, type: source.type,
      centerBodyFixedM: frozenPoint(source.centerBodyFixedM, 'centerBodyFixedM'),
      radiusM,
      ...(source.impact ? { impact: parseImpactMetadata(source.impact) } : {}),
    });
  }
  if (source.type === 'subtract-capsule') {
    return Object.freeze({
      id, bodyId, type: source.type,
      aBodyFixedM: frozenPoint(source.aBodyFixedM, 'aBodyFixedM'),
      bBodyFixedM: frozenPoint(source.bBodyFixedM, 'bBodyFixedM'),
      radiusM,
    });
  }
  throw new TypeError(`unsupported planet volume edit type: ${String(source.type)}`);
}

function parseImpactMetadata(value:unknown):NonNullable<SubtractSphereEdit['impact']> {
  const source=value as Record<string,unknown>;
  return Object.freeze({surfaceContactBodyFixedM:frozenPoint(source.surfaceContactBodyFixedM,'surface contact'),
    surfaceNormalBodyFixed:frozenPoint(source.surfaceNormalBodyFixed,'surface normal'),
    craterRadiusM:positiveRadius(source.craterRadiusM),craterDepthM:positiveRadius(source.craterDepthM)});
}

/** Conservative body-fixed AABB used by the edit index. */
export function planetVolumeEditBounds(edit: PlanetVolumeEdit): PlanetVolumeBounds {
  const radius = edit.radiusM;
  if (edit.type === 'subtract-sphere') {
    const [x, y, z] = edit.centerBodyFixedM;
    return {
      minBodyFixedM: [x - radius, y - radius, z - radius],
      maxBodyFixedM: [x + radius, y + radius, z + radius],
    };
  }
  return {
    minBodyFixedM: [
      Math.min(edit.aBodyFixedM[0], edit.bBodyFixedM[0]) - radius,
      Math.min(edit.aBodyFixedM[1], edit.bBodyFixedM[1]) - radius,
      Math.min(edit.aBodyFixedM[2], edit.bBodyFixedM[2]) - radius,
    ],
    maxBodyFixedM: [
      Math.max(edit.aBodyFixedM[0], edit.bBodyFixedM[0]) + radius,
      Math.max(edit.aBodyFixedM[1], edit.bBodyFixedM[1]) + radius,
      Math.max(edit.aBodyFixedM[2], edit.bBodyFixedM[2]) + radius,
    ],
  };
}

/** Signed distance to the material removed by an edit: negative inside the cut volume. */
export function planetVolumeEditSignedDistance(edit: PlanetVolumeEdit, point: BodyFixedPoint): number {
  if (edit.type === 'subtract-sphere') {
    return Math.hypot(
      point[0] - edit.centerBodyFixedM[0],
      point[1] - edit.centerBodyFixedM[1],
      point[2] - edit.centerBodyFixedM[2],
    ) - edit.radiusM;
  }

  const ax = edit.aBodyFixedM[0], ay = edit.aBodyFixedM[1], az = edit.aBodyFixedM[2];
  const abx = edit.bBodyFixedM[0] - ax;
  const aby = edit.bBodyFixedM[1] - ay;
  const abz = edit.bBodyFixedM[2] - az;
  const lengthSquared = abx * abx + aby * aby + abz * abz;
  const projection = lengthSquared > 0
    ? ((point[0] - ax) * abx + (point[1] - ay) * aby + (point[2] - az) * abz) / lengthSquared
    : 0;
  const t = Math.max(0, Math.min(1, projection));
  return Math.hypot(
    point[0] - (ax + abx * t),
    point[1] - (ay + aby * t),
    point[2] - (az + abz * t),
  ) - edit.radiusM;
}

export function planetVolumeBoundsIntersect(a: PlanetVolumeBounds, b: PlanetVolumeBounds): boolean {
  for (let axis = 0; axis < 3; axis++) {
    if (a.maxBodyFixedM[axis] < b.minBodyFixedM[axis]
      || a.minBodyFixedM[axis] > b.maxBodyFixedM[axis]) return false;
  }
  return true;
}

export function planetVolumeBoundsContainPoint(bounds: PlanetVolumeBounds, point: BodyFixedPoint): boolean {
  for (let axis = 0; axis < 3; axis++) {
    if (point[axis] < bounds.minBodyFixedM[axis] || point[axis] > bounds.maxBodyFixedM[axis]) return false;
  }
  return true;
}
