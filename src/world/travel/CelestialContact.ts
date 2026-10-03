import type { Vec3 } from '../spatial/units';

/** Logical CCD result; response stays safe in C0. Future impact policy can consume it. */
export interface CelestialContact {
  readonly bodyId: string;
  readonly fraction: number;
  readonly contactPositionM: Vec3;
  readonly relativeSpeedMps: number;
  readonly radialSpeedMps: number;
  readonly assisted: boolean;
}
