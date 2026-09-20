import { Group, TorusGeometry } from 'three/webgpu';
import { GeometryBatch } from '../GeometryBatch';
import largo from './largo.json';

export interface LandmarkBox { x: number; y: number; z: number; width: number; height: number; depth: number }

/**
 * Igreja de São Sebastião, on its own compiled footprint at the south end of the Largo.
 *
 * The real church is eclectic — neoclassical with medievalist detail — with a portico of four
 * Tuscan columns, three round arches, an oculus above them, and a SINGLE bell tower, which is
 * the detail that makes it recognisable: it was built with one because the second was never
 * finished. The footprint in the data is cross-shaped, so nave, transept and apse follow it.
 */
const PLOT = largo.igreja;

const NAVE_HEIGHT = 13.5, TOWER_HEIGHT = 27, PORTICO_DEPTH = 4.2;

/** Local-space builder; the caller places it at the footprint centroid. */
export function createIgreja(): Group {
  const b = new GeometryBatch();
  if (!PLOT?.box) return b.build('Igreja de São Sebastião');
  const { w, d, angle } = PLOT.box;
  // The facade faces the square, which lies north of the church.
  const facing = angle + (Math.abs(Math.sin(angle)) > .5 ? 0 : Math.PI / 2);
  const nx = Math.sin(facing), nz = Math.cos(facing);
  const ex = Math.cos(facing), ez = -Math.sin(facing);
  const naveWidth = Math.min(w, d), naveLength = Math.max(w, d);
  const at = (along: number, out: number): [number, number] => [ex * along + nx * out, ez * along + nz * out];

  // Nave, transept and apse: the cross the footprint actually describes.
  b.box('cream', 0, NAVE_HEIGHT * .5, 0, naveWidth, NAVE_HEIGHT, naveLength, facing);
  b.box('cream', 0, NAVE_HEIGHT * .46, 0, naveWidth * 1.75, NAVE_HEIGHT * .82, naveWidth * .95, facing);
  const [apseX, apseZ] = at(0, -naveLength * .5);
  b.box('cream', apseX, NAVE_HEIGHT * .42, apseZ, naveWidth * .72, NAVE_HEIGHT * .78, naveWidth * .62, facing);

  // Pitched roofs over both arms, and a lower one over the apse.
  b.box('red', 0, NAVE_HEIGHT + .55, 0, naveWidth + 1.2, 1.1, naveLength + .8, facing);
  b.box('red', 0, NAVE_HEIGHT * .82 + .5, 0, naveWidth * 1.85, 1, naveWidth * 1.05, facing);

  // Portico: four Tuscan columns carrying an entablature, with three round arches behind.
  const [porchX, porchZ] = at(0, naveLength * .5 + PORTICO_DEPTH * .5);
  b.box('stone', porchX, .5, porchZ, naveWidth + 1.4, 1, PORTICO_DEPTH, facing);
  for (let column = 0; column < 4; column++) {
    const along = (column - 1.5) * (naveWidth * .27);
    const [cx, cz] = at(along, naveLength * .5 + PORTICO_DEPTH * .72);
    b.cylinder('white', cx, 5.1, cz, .42, .5, 8.2, 12);
    b.box('white', cx, 1.15, cz, 1.1, .5, 1.1, facing);
    b.box('white', cx, 9.4, cz, 1.2, .45, 1.2, facing);
  }
  const [entX, entZ] = at(0, naveLength * .5 + PORTICO_DEPTH * .6);
  b.box('white', entX, 10, entZ, naveWidth + 1.6, .9, PORTICO_DEPTH * .8, facing);
  b.box('cream', entX, 10.9, entZ, naveWidth + 1.9, .5, PORTICO_DEPTH * .9, facing);

  for (let arch = -1; arch <= 1; arch++) {
    const [ax, az] = at(arch * naveWidth * .3, naveLength * .5 + .08);
    b.box('dark', ax, 2.9, az, naveWidth * .22, 5.8, .3, facing);
    b.add(new TorusGeometry(naveWidth * .11, .22, 5, 12, Math.PI).rotateY(-facing), 'white', ax, 5.8, az);
  }
  // The oculus above the arches, and the pediment over it.
  const [ocX, ocZ] = at(0, naveLength * .5 + .1);
  b.add(new TorusGeometry(1.25, .24, 6, 16).rotateY(-facing), 'white', ocX, 12.4, ocZ);
  b.box('dark', ocX, 12.4, ocZ, 2.2, 2.2, .2, facing);
  b.box('cream', ocX, 15.1, ocZ, naveWidth * .7, 2.6, .5, facing);

  // The single bell tower, on one side only — the church was never given its pair.
  const [towerX, towerZ] = at(naveWidth * .72, naveLength * .42);
  b.box('cream', towerX, TOWER_HEIGHT * .5, towerZ, 5.4, TOWER_HEIGHT, 5.4, facing);
  for (const y of [8.5, 16, TOWER_HEIGHT - 5.5]) b.box('white', towerX, y, towerZ, 5.9, .5, 5.9, facing);
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    b.box('dark', towerX + sx * 2.75, TOWER_HEIGHT - 3, towerZ + sz * 2.75, sx ? .2 : 2.4, 4, sz ? .2 : 2.4, facing);
  }
  b.box('white', towerX, TOWER_HEIGHT + .4, towerZ, 6.2, .8, 6.2, facing);
  b.cylinder('red', towerX, TOWER_HEIGHT + 3.2, towerZ, .1, 3.4, 5, 4);
  b.cylinder('gold', towerX, TOWER_HEIGHT + 6.2, towerZ, .05, .07, 1.6, 6);
  b.box('gold', towerX, TOWER_HEIGHT + 6.6, towerZ, .7, .08, .08, facing);

  // Tall side windows down the nave.
  for (const side of [-1, 1]) for (let bay = -2; bay <= 2; bay++) {
    const [wx, wz] = at(side * (naveWidth * .5 + .06), bay * naveLength * .16);
    b.box('dark', wx, 7.2, wz, .2, 4.4, 1.5, facing);
    b.box('white', wx, 9.6, wz, .26, .3, 1.9, facing);
  }
  return b.build('Igreja de São Sebastião');
}

/** Distant church: nave, roof and the one tower. */
export function createIgrejaSilhouette(): Group {
  const b = new GeometryBatch();
  if (!PLOT?.box) return b.build('Igreja distante');
  const { w, d, angle } = PLOT.box;
  const facing = angle + (Math.abs(Math.sin(angle)) > .5 ? 0 : Math.PI / 2);
  const naveWidth = Math.min(w, d), naveLength = Math.max(w, d);
  b.box('cream', 0, NAVE_HEIGHT * .5, 0, naveWidth, NAVE_HEIGHT, naveLength, facing);
  b.box('red', 0, NAVE_HEIGHT + .6, 0, naveWidth + 1.2, 1.2, naveLength + .8, facing);
  const ex = Math.cos(facing), ez = -Math.sin(facing);
  b.box('cream', ex * naveWidth * .72 + Math.sin(facing) * naveLength * .42, TOWER_HEIGHT * .5,
    ez * naveWidth * .72 + Math.cos(facing) * naveLength * .42, 5.4, TOWER_HEIGHT, 5.4, facing);
  return b.build('Igreja distante');
}

/** Where the church stands, from the compiled footprint rather than from an address. */
export const IGREJA_ANCHOR = PLOT ? { x: PLOT.x, z: PLOT.z } : { x: 0, z: 0 };

export const IGREJA_COLLIDERS: readonly LandmarkBox[] = (() => {
  if (!PLOT?.box) return [];
  const { w, d, angle } = PLOT.box;
  const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
  const naveWidth = Math.min(w, d), naveLength = Math.max(w, d);
  const facing = angle + (Math.abs(Math.sin(angle)) > .5 ? 0 : Math.PI / 2);
  const ex = Math.cos(facing), ez = -Math.sin(facing);
  return [
    { x: 0, y: NAVE_HEIGHT * .5, z: 0, width: naveWidth * cos + naveLength * sin, height: NAVE_HEIGHT, depth: naveWidth * sin + naveLength * cos },
    { x: 0, y: NAVE_HEIGHT * .42, z: 0, width: naveWidth * 1.8, height: NAVE_HEIGHT * .82, depth: naveWidth * 1.1 },
    {
      x: ex * naveWidth * .72 + Math.sin(facing) * naveLength * .42, y: TOWER_HEIGHT * .5,
      z: ez * naveWidth * .72 + Math.cos(facing) * naveLength * .42,
      width: 5.6, height: TOWER_HEIGHT, depth: 5.6,
    },
  ];
})();
