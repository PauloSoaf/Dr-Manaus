import { CylinderGeometry, Group, Vector3 } from 'three/webgpu';
import { GeometryBatch } from '../GeometryBatch';

export interface LandmarkBox { x: number; y: number; z: number; width: number; height: number; depth: number }

/**
 * Monumento à Abertura dos Portos do Rio Amazonas à Navegação Estrangeira, 1900.
 *
 * This is world zero. The Overture place record puts it at (0, -3), and the square was laid out
 * around it. The real thing is a stepped stone base carrying a pedestal with relief panels, a
 * fluted column of roughly six metres, and a crowning figure; the four corners carry sculptural
 * groups for the continents, which are suggested here rather than modelled.
 */
const STEPS = 4, STEP_RISE = .32, STEP_RUN = .9;
const BASE_SPAN = 9.2;
const PEDESTAL = 3.4, COLUMN = 6.2;

export function createMonument(): Group {
  const b = new GeometryBatch();
  const baseTop = STEPS * STEP_RISE;

  // Stepped plinth: an octagonal footprint read as a chamfered square, as the real base is.
  for (let step = 0; step < STEPS; step++) {
    const span = BASE_SPAN - step * STEP_RUN;
    b.box('stone', 0, STEP_RISE * (step + .5), 0, span, STEP_RISE, span);
    b.box('stone', 0, STEP_RISE * (step + .5), 0, span * .72, STEP_RISE, span * 1.06, Math.PI / 4);
  }

  // Pedestal with recessed relief panels and a moulded cap.
  const pedestalSpan = 3.5;
  b.box('cream', 0, baseTop + PEDESTAL * .5, 0, pedestalSpan, PEDESTAL, pedestalSpan);
  for (const [dx, dz, angle] of [[1, 0, 0], [-1, 0, 0], [0, 1, Math.PI / 2], [0, -1, Math.PI / 2]] as const) {
    const inset = pedestalSpan * .5 + .04;
    b.box('stone', dx * inset, baseTop + PEDESTAL * .52, dz * inset, .08, PEDESTAL * .58, pedestalSpan * .62, angle);
    // A bronze plaque on each face, which is what catches the light from the square.
    b.box('gold', dx * (inset + .05), baseTop + PEDESTAL * .5, dz * (inset + .05), .05, PEDESTAL * .3, pedestalSpan * .4, angle);
  }
  b.box('cream', 0, baseTop + PEDESTAL + .16, 0, pedestalSpan * 1.22, .32, pedestalSpan * 1.22);
  b.box('stone', 0, baseTop + PEDESTAL - .12, 0, pedestalSpan * 1.12, .24, pedestalSpan * 1.12);

  // Corner groups: the four continents, suggested as plinth-and-mass rather than carved figures.
  const cornerTop = baseTop + .3;
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const x = dx * 3.1, z = dz * 3.1;
    b.box('stone', x, cornerTop + .55, z, 1.3, 1.1, 1.3);
    b.box('cream', x, cornerTop + 1.5, z, .85, .8, .7);
    b.sphere('cream', x, cornerTop + 2.15, z, .34, 1, 1.1, 1);
  }

  // Fluted column on a torus base, with a simple capital.
  const columnBase = baseTop + PEDESTAL + .32;
  b.cylinder('cream', 0, columnBase + .22, 0, .78, .9, .44, 16);
  b.cylinder('cream', 0, columnBase + COLUMN * .5 + .4, 0, .58, .68, COLUMN, 18);
  for (let flute = 0; flute < 16; flute++) {
    const angle = flute / 16 * Math.PI * 2, radius = .63;
    b.box('stone', Math.cos(angle) * radius, columnBase + COLUMN * .5 + .4, Math.sin(angle) * radius,
      .07, COLUMN * .94, .07, angle);
  }
  const capital = columnBase + COLUMN + .4;
  b.cylinder('cream', 0, capital + .18, 0, .84, .66, .36, 16);
  b.box('cream', 0, capital + .46, 0, 1.85, .22, 1.85);

  // The crowning figure: a plain standing mass with an outstretched arm, not a portrait.
  const figure = capital + .57;
  b.box('gold', 0, figure + .9, 0, .5, 1.8, .34);
  b.sphere('gold', 0, figure + 2.02, 0, .26, 1, 1.15, 1);
  b.add(new CylinderGeometry(.07, .07, 1.5, 6).rotateZ(-.9), 'gold', .5, figure + 1.6, 0);
  b.box('gold', 0, figure + 1.1, .3, .7, .05, .6, .3);

  // Lamp standards at the base, which is how the square lights the monument at night.
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const x = dx * 5.4, z = dz * 5.4;
    b.box('stone', x, .3, z, .8, .6, .8);
    b.cylinder('steel', x, 1.9, z, .09, .12, 2.6, 8);
    b.sphere('light', x, 3.35, z, .26, 1, 1.1, 1);
  }
  return b.build('Monumento à Abertura dos Portos');
}

/** Distant monument: the mass, the column and the figure, nothing else. */
export function createMonumentSilhouette(): Group {
  const b = new GeometryBatch();
  const baseTop = STEPS * STEP_RISE;
  b.box('stone', 0, baseTop * .5, 0, BASE_SPAN, baseTop, BASE_SPAN);
  b.box('cream', 0, baseTop + PEDESTAL * .5, 0, 3.5, PEDESTAL, 3.5);
  b.cylinder('cream', 0, baseTop + PEDESTAL + COLUMN * .5, 0, .58, .74, COLUMN, 10);
  b.box('gold', 0, baseTop + PEDESTAL + COLUMN + 1.1, 0, .5, 1.9, .34);
  return b.build('Monumento distante');
}

/** Solid to the player: the base is climbable, the column and figure are not passable. */
export const MONUMENT_COLLIDERS: readonly LandmarkBox[] = (() => {
  const boxes: LandmarkBox[] = [];
  for (let step = 0; step < STEPS; step++) {
    const span = BASE_SPAN - step * STEP_RUN, top = STEP_RISE * (step + 1);
    boxes.push({ x: 0, y: top * .5, z: 0, width: span, height: top, depth: span });
  }
  const baseTop = STEPS * STEP_RISE;
  boxes.push({ x: 0, y: baseTop + PEDESTAL * .5, z: 0, width: 3.6, height: PEDESTAL, depth: 3.6 });
  boxes.push({ x: 0, y: baseTop + PEDESTAL + COLUMN * .5, z: 0, width: 1.5, height: COLUMN, depth: 1.5 });
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    boxes.push({ x: dx * 3.1, y: baseTop + 1.1, z: dz * 3.1, width: 1.4, height: 2.6, depth: 1.4 });
  }
  return boxes;
})();

/** Total height, so the camera and the LOD bands know how tall the centrepiece is. */
export const MONUMENT_HEIGHT = STEPS * STEP_RISE + PEDESTAL + COLUMN + 3;

export const MONUMENT_ANCHOR = new Vector3(0, 0, -3);
