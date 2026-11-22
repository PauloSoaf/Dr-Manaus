/**
 * Reads a Kenney Car Kit GLB into plain triangle soups (body shell with every non-wheel node baked
 * in, plus the four wheels with their pivots).
 */
import { Logger, NodeIO } from '@gltf-transform/core';
import { emptySoup, transformSoup, appendSoup } from './vehicle-geometry.mjs';

export const WHEEL_NODES = ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right'];

function primitiveSoup(prim) {
  const pos = prim.getAttribute('POSITION'), nrm = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0');
  const idx = prim.getIndices();
  const count = idx ? idx.getCount() : pos.getCount();
  const soup = emptySoup();
  const tmp = [0, 0, 0], tmp2 = [0, 0];
  for (let i = 0; i < count; i++) {
    const vi = idx ? idx.getScalar(i) : i;
    pos.getElement(vi, tmp); soup.pos.push(tmp[0], tmp[1], tmp[2]);
    nrm.getElement(vi, tmp); soup.nrm.push(tmp[0], tmp[1], tmp[2]);
    uv.getElement(vi, tmp2); soup.uv.push(tmp2[0], tmp2[1]);
  }
  return soup;
}

export async function readKenneyVehicle(file) {
  const io = new NodeIO();
  io.setLogger(new Logger(Logger.Verbosity.ERROR));
  const doc = await io.read(file);
  const nodes = doc.getRoot().listNodes();
  const body = emptySoup();
  const wheels = {};
  const extras = [];
  for (const node of nodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const name = node.getName();
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const local = primitiveSoup(prim);
      if (WHEEL_NODES.includes(name)) {
        const t = node.getWorldTranslation();
        wheels[name] = { pivot: [t[0], t[1], t[2]], soup: local };
      } else {
        appendSoup(body, transformSoup(local, world));
        extras.push(name);
      }
    }
  }
  for (const w of WHEEL_NODES) if (!wheels[w]) throw new Error(`${file}: missing ${w}`);
  return { body, wheels, nodes: extras };
}
