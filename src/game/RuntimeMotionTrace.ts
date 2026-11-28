import type { Vector3 } from 'three/webgpu';
import type { PlayerPhysicsStep } from '../player/PlayerController';

interface MotionSample {
  frameId: number;
  timeMs: number;
  dt: number;
  domain: string;
  bodyId: string;
  referenceFrame: string;
  state: string;
  events: readonly string[];
  physicsSteps: readonly PlayerPhysicsStep[];
  positionBefore: number[];
  velocityBefore: number[];
  positionAfter: number[];
  velocityAfter: number[];
  terrainContact: number[] | null;
  origin: number[];
  originRevision: number;
  visualPosition: number[];
  cameraPosition: number[];
}

/** Opt-in capture, bounded to the most recent frames. No logging in the game loop. */
export class RuntimeMotionTrace {
  private readonly samples: MotionSample[] = [];
  private frameId = 0;
  private originRevision = 0;
  private events: string[] = [];
  private physicsSteps: PlayerPhysicsStep[] = [];
  private frameStart = { positionBefore: [0, 0, 0], velocityBefore: [0, 0, 0] };

  mark(event: string): void { this.events.push(event); }
  recordPhysicsStep(step: PlayerPhysicsStep): void { this.physicsSteps.push(step); }

  begin(position: Vector3, velocity: Vector3): void {
    this.frameStart = { positionBefore: position.toArray(), velocityBefore: velocity.toArray() };
  }

  end(sample: Omit<MotionSample, 'frameId' | 'events' | 'physicsSteps' | 'originRevision' | 'positionBefore' | 'velocityBefore'>): void {
    const previous = this.samples[(this.frameId - 1) % 240];
    if (previous && (sample.referenceFrame !== previous.referenceFrame || sample.origin.some((v, i) => v !== previous.origin[i]))) {
      this.originRevision++;
    }
    this.samples[this.frameId % 240] = {
      ...sample, ...this.frameStart, frameId: ++this.frameId, events: this.events,
      physicsSteps: this.physicsSteps, originRevision: this.originRevision,
    };
    this.events = [];
    this.physicsSteps = [];
  }

  snapshot(): readonly MotionSample[] {
    const start = this.frameId % 240;
    return this.samples.slice(start).concat(this.samples.slice(0, start));
  }
}
