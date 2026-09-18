import { generateChunk } from '../chunks/BuildingGenerator';
import type { ChunkPayload, WorkerRequest, WorkerResponse } from '../chunks/Chunk';

interface Job { id: number; cx: number; cz: number; resolve: (payload: ChunkPayload) => void }
interface Slot { worker: Worker; job?: Job }

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
          const job = slot.job; slot.job = undefined; job.resolve(data.payload); this.dispatch();
        };
        worker.onerror = () => {
          worker.terminate(); this.slots = this.slots.filter(item => item !== slot);
          if (slot.job) this.fallback(slot.job); slot.job = undefined; this.dispatch();
        };
        this.slots.push(slot);
      } catch { break; }
    }
  }
  generate(cx: number, cz: number): Promise<ChunkPayload> {
    return new Promise(resolve => { this.queue.push({ id: ++this.sequence, cx, cz, resolve }); this.dispatch(); });
  }
  private dispatch(): void {
    if (this.stopped) return;
    if (!this.slots.length) { for (const job of this.queue.splice(0)) this.fallback(job); return; }
    for (const slot of this.slots) {
      if (slot.job || !this.queue.length) continue;
      const job = this.queue.shift()!; slot.job = job;
      const message: WorkerRequest = { type: 'generate', id: job.id, cx: job.cx, cz: job.cz };
      slot.worker.postMessage(message);
    }
  }
  private fallback(job: Job): void {
    // A CSP/worker failure remains playable; yielding still bounds each individual generation task.
    setTimeout(() => { if (!this.stopped) job.resolve(generateChunk(job.cx, job.cz)); }, 0);
  }
  dispose(): void { this.stopped = true; for (const slot of this.slots) slot.worker.terminate(); this.slots.length = 0; this.queue.length = 0; }
}
