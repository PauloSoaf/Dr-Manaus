import type { AnimationEventDef, AnimationEventName } from './types';

export type AnimationEventListener = (event: AnimationEventName, payload?: unknown) => void;

export class AnimationEvents {
  private readonly listeners = new Set<AnimationEventListener>();
  private readonly fired = new Set<string>();

  subscribe(listener: AnimationEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset(): void {
    this.fired.clear();
  }

  dispatch(event: AnimationEventName, payload?: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(event, payload);
      } catch (err) {
        console.error(`Error in AnimationEvent listener for ${event}:`, err);
      }
    }
  }

  /**
   * Evaluates event triggers between previous and current normalized times [0..1].
   * Handles loops (where current < previous).
   */
  evaluate(
    animKey: string,
    previousTime: number,
    currentTime: number,
    events: readonly AnimationEventDef[],
    looping = false
  ): void {
    if (currentTime < previousTime) {
      // Loop or restart occurred: fire remaining events in previous loop, then reset
      for (const def of events) {
        const id = `${animKey}:${def.time}:${def.event}`;
        if (!this.fired.has(id) && def.time >= previousTime && def.time <= 1.0) {
          this.fired.add(id);
          this.dispatch(def.event, def.payload);
        }
      }
      this.reset();
      // Check events from 0 up to currentTime
      for (const def of events) {
        const id = `${animKey}:${def.time}:${def.event}`;
        if (!this.fired.has(id) && def.time <= currentTime) {
          this.fired.add(id);
          this.dispatch(def.event, def.payload);
        }
      }
      return;
    }

    for (const def of events) {
      const id = `${animKey}:${def.time}:${def.event}`;
      if (!this.fired.has(id) && def.time >= previousTime && def.time <= currentTime) {
        this.fired.add(id);
        this.dispatch(def.event, def.payload);
      }
    }
  }
}
