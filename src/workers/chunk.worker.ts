import { generateChunk } from '../world/chunks/BuildingGenerator';
import type { WorkerRequest, WorkerResponse } from '../world/chunks/Chunk';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer: Transferable[]): void;
};
scope.onmessage = ({ data }) => {
  if (data.type !== 'generate') return;
  const payload = generateChunk(data.cx, data.cz);
  scope.postMessage({ type: 'generated', id: data.id, payload }, [payload.buildings.buffer, payload.trees.buffer]);
};
