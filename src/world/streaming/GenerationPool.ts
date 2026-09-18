import { generateChunk } from '../chunks/BuildingGenerator';
import type { ChunkPayload, WorkerRequest, WorkerResponse } from '../chunks/Chunk';

interface Job {
  id: number;
  cx: number;
  cz: number;
  resolve: (payload: ChunkPayload) => void;
  reject: (error: Error) => void;
}
interface Slot {
  worker: Worker;
  job?: Job;
  timeout?: ReturnType<typeof setTimeout>;
}

const WORKER_JOB_TIMEOUT_MS = 5000;

/** Worker output owns its transferred buffers; no copies or geometry objects cross threads. */
export class GenerationPool {
  private slots: Slot[] = [];
  private sequence = 0;
  private queue: Job[] = [];
  private stopped = false;

  constructor(size: number) {
    if (typeof Worker === 'undefined') return;
    for (let i = 0; i < size; i++) {
      try {
        const worker = new Worker(new URL('../../workers/chunk.worker.ts', import.meta.url), { type: 'module' });
        const slot: Slot = { worker };
        worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
          if (slot.job?.id !== data.id) return;
          const job = this.releaseSlot(slot);
          job?.resolve(data.payload);
          this.dispatch();
        };
        worker.onerror = () => {
          const job = this.releaseSlot(slot);
          this.removeSlot(slot);
          if (job) this.fallback(job);
          this.dispatch();
        };
        this.slots.push(slot);
      } catch {
        break;
      }
    }
  }

  generate(cx: number, cz: number): Promise<ChunkPayload> {
    if (this.stopped) return Promise.reject(new Error('Chunk generation pool is disposed.'));
    return new Promise((resolve, reject) => {
      this.queue.push({ id: ++this.sequence, cx, cz, resolve, reject });
      this.dispatch();
    });
  }

  private dispatch(): void {
    if (this.stopped) return;
    if (!this.slots.length) {
      for (const job of this.queue.splice(0)) this.fallback(job);
      return;
    }

    for (const slot of this.slots) {
      if (slot.job || !this.queue.length) continue;
      const job = this.queue.shift()!;
      slot.job = job;
      const message: WorkerRequest = { type: 'generate', id: job.id, cx: job.cx, cz: job.cz };

      slot.timeout = setTimeout(() => {
        if (this.stopped || slot.job?.id !== job.id) return;
        const stalled = this.releaseSlot(slot);
        this.removeSlot(slot);
        if (stalled) this.fallback(stalled);
        this.dispatch();
      }, WORKER_JOB_TIMEOUT_MS);

      try {
        slot.worker.postMessage(message);
      } catch {
        const failed = this.releaseSlot(slot);
        this.removeSlot(slot);
        if (failed) this.fallback(failed);
        this.dispatch();
      }
    }
  }

  private releaseSlot(slot: Slot): Job | undefined {
    if (slot.timeout) clearTimeout(slot.timeout);
    slot.timeout = undefined;
    const job = slot.job;
    slot.job = undefined;
    return job;
  }

  private removeSlot(slot: Slot): void {
    slot.worker.terminate();
    this.slots = this.slots.filter(item => item !== slot);
  }

  private fallback(job: Job): void {
    // A CSP/worker failure remains playable; yielding still bounds each individual generation task.
    setTimeout(() => {
      if (this.stopped) {
        job.reject(new Error('Chunk generation pool was disposed before the job completed.'));
        return;
      }
      try {
        job.resolve(generateChunk(job.cx, job.cz));
      } catch (error) {
        job.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }, 0);
  }

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    const error = new Error('Chunk generation pool was disposed.');

    for (const slot of this.slots) {
      const job = this.releaseSlot(slot);
      job?.reject(error);
      slot.worker.terminate();
    }
    for (const job of this.queue) job.reject(error);

    this.slots.length = 0;
    this.queue.length = 0;
  }
}
