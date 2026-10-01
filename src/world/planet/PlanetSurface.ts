import type { Vec3 } from '../spatial/units';

export interface PlanetSurfaceGenerator {
  readonly radiusM: number;
  heightAt(direction: Vec3): number;
  normalEnu(direction: Vec3, out: Vec3): void;
  colourAt(direction: Vec3, out: [number, number, number]): void;
}
