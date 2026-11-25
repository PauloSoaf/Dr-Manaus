import { generateChunk } from '../world/chunks/BuildingGenerator';
import type { WorkerRequest, WorkerResponse } from '../world/chunks/Chunk';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer: Transferable[]): void;
};
scope.onmessage = ({ data }) => {
  if (data.type !== 'generate') return;
  const payload = generateChunk(data.cx, data.cz, data.context, data.seed);
  scope.postMessage({
    type: 'generated',
    id: data.id,
    payload,
    generationVersion: payload.generationVersion ?? data.context?.generationVersion,
    regionId: payload.regionId ?? data.context?.regionId,
  }, [payload.buildings.buffer, payload.trees.buffer]);
};
