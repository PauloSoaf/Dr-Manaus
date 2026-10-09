import type { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import type { Vec3 } from '../spatial/units';
import type { CelestialBody } from './CelestialBody';

/**
 * How a body should currently be treated: a point of light, a globe, or ground underfoot.
 *
 * `blend` exists only for the renderer to cross-fade with. The specification is explicit that the
 * logical position never depends on it — a body is where it is whichever way it is being drawn.
 */
export interface BodyHandoffState {
  readonly bodyId: string;
  readonly mode: 'celestial' | 'planet' | 'surface';
  readonly blend: number;
  readonly apparentAngularRadiusRad: number;
  readonly distanceToSurfaceM: number;
}

export interface CelestialSystemRuntime {
  readonly systemFrameId: string;
  readonly time: number;
  readonly bodies: readonly CelestialBody[];
  
  update(epochS: number): void;
  positionOf(bodyId: string): Vec3 | undefined;
  stateOf(bodyId: string): { positionM: Vec3, velocityMps: Vec3 } | undefined;
  dominantBody(observerM: Vec3): CelestialBody | undefined;
  handoff(bodyId: string, observerM: Vec3): BodyHandoffState | undefined;
  registerFrames(graph: ReferenceFrameGraph): void;
  speedOf(bodyId: string): number;
}
