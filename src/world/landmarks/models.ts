import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, TorusGeometry, Vector3 } from 'three/webgpu';
import { GeometryBatch, palm, tree, type PaletteKey } from './GeometryBatch';
import { BRIDGE } from '../geodata/geodata';
import { wavePlazaGeometry } from './theatre';
// The Arena has a bespoke model of its own; this module keeps re-exporting it for callers.
import { createArena, type LandmarkBox } from './arena';
export { createArena };

function bench(b: GeometryBatch, x: number, z: number, angle = 0): void {
  b.box('bark', x, .7, z, 3.6, .24, .75, angle);
  b.box('bark', x, 1.15, z - .4, 3.6, .7, .15, angle);
  for (const dx of [-1.2, 1.2]) b.box('dark', x + dx, .32, z, .2, .65, .6);
}
function lamp(b: GeometryBatch, x: number, z: number): void {
  b.cylinder('dark', x, 2.7, z, .08, .19, 5.4, 7);
  b.sphere('light', x, 5.6, z, .46);
  b.cylinder('dark', x, 6.15, z, 0, .55, .55, 6);
}
function windowRows(b: GeometryBatch, width: number, front: number, y: number, spacing = 5): void {
  for (let x = -width / 2 + spacing / 2; x < width / 2; x += spacing) {
    b.box('cream', x, y, front, 2.5, 4.6, .4);
    b.box('glass', x, y, front + .24, 1.9, 4, .1);
    b.box('cream', x, y, front + .31, .13, 4.1, .12);
    b.box('cream', x, y, front + .31, 2, .13, .12);
  }
}

export function createLargo(): Group {
  const b = new GeometryBatch();
  b.box('cream', 0, -.1, 0, 132, .4, 124);
  b.add(wavePlazaGeometry(126, 118), 'dark');
  for (const x of [-57, 57]) for (const z of [-44, -15, 14, 43]) {
    b.cylinder('stone', x, .25, z, 3, 3, .5, 12);
    palm(b, x, z, 12 + (z % 3), z / 4);
    lamp(b, x + (x > 0 ? -7 : 7), z);
  }
  for (const x of [-36, 36]) for (const z of [-38, 32]) bench(b, x, z);
  // Monumento à Abertura dos Portos: stepped pedestal, figures and winged summit.
  b.cylinder('stone', 0, .4, 6, 7.2, 8, .8, 8);
  b.cylinder('cream', 0, 1.25, 6, 5.8, 6.6, .9, 8);
  b.box('cream', 0, 4.7, 6, 4.2, 6.4, 4.2);
  b.box('stone', 0, 8.1, 6, 5.1, .6, 5.1);
  b.cylinder('dark', 0, 9.8, 6, .65, 1.1, 3, 8);
  b.sphere('dark', 0, 11.6, 6, .65);
  b.beam('dark', new Vector3(0, 10.8, 6), new Vector3(2.5, 12.4, 6), .3);
  b.beam('dark', new Vector3(0, 10.8, 6), new Vector3(-2.2, 12, 6), .3);
  for (const x of [-4.8, 4.8]) b.sphere('dark', x, 2.2, 6, 1.2, 1, .7, 1.6);
  // Igreja de São Sebastião, a second authored silhouette adjoining the square.
  b.box('cream', 66, 8, -23, 26, 16, 43);
  b.box('white', 66, 8.5, -.9, 27.5, 17, 1.5);
  b.box('red', 66, 16.5, -24, 27, 1.3, 43);
  b.box('glass', 66, 4.5, .1, 4.5, 8, .4);
  b.add(new TorusGeometry(2.6, .45, 6, 20), 'gold', 66, 12, .2);
  b.sphere('glass', 66, 12, .25, 2.1, 1, 1, .05);
  for (const x of [55, 77]) {
    b.box('white', x, 11, -2, 6, 22, 7);
    b.box('glass', x, 18, 1.65, 2, 4, .2);
    b.cylinder('cream', x, 24.5, -2, 0, 4.1, 6, 4);
    b.box('gold', x, 28.4, -2, .28, 3, .28);
    b.box('gold', x, 28.8, -2, 1.6, .25, .25);
  }
  return b.build('Largo de São Sebastião and church');
}

export function createMarket(): Group {
  const b = new GeometryBatch();
  b.box('stone', 0, .4, 0, 100, .8, 72);
  for (const x of [-29, 0, 29]) {
    const width = x === 0 ? 32 : 23, h = x === 0 ? 12 : 9;
    b.box('cream', x, h / 2, 0, width, h, 57);
    b.add(new CylinderGeometry(width / 2, width / 2, 59, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), 'red', x, h, 0);
    for (let z = -25; z <= 25; z += 5) {
      b.box('green', x - width / 2, h / 2, z, .35, h, .35);
      b.box('green', x + width / 2, h / 2, z, .35, h, .35);
    }
    for (let dx = -width / 2 + 3; dx < width / 2; dx += 4) {
      b.box('glass', x + dx, h / 2, 28.8, 2.8, h - 2, .2);
      b.box('green', x + dx + 1.8, h / 2, 29, .24, h + 1, .45);
    }
    b.box('green', x, h, 29, width, .6, .6);
  }
  for (const x of [-46, 46]) for (const z of [-29, 29]) palm(b, x, z, 12);
  for (let x = -40; x <= 40; x += 8) { b.box('gold', x, 1.7, 38, 5, .2, 3); b.box('salmon', x, .8, 38, 4.5, 1.6, 2.5); }
  return b.build('Mercado Adolpho Lisboa — iron pavilions');
}

function ferry(b: GeometryBatch, x: number, z: number, scale = 1): void {
  b.box('blue', x, -.25, z, 11 * scale, 3 * scale, 44 * scale);
  b.box('white', x, 2.1 * scale, z - 2 * scale, 10 * scale, 2 * scale, 35 * scale);
  b.box('white', x, 4.6 * scale, z - 3 * scale, 9 * scale, 2 * scale, 31 * scale);
  b.box('red', x, 6 * scale, z - 3 * scale, 10 * scale, .6 * scale, 32 * scale);
  for (const side of [-1, 1]) for (let dz = -14; dz <= 10; dz += 3) b.box('glass', x + side * 5.03 * scale, 2.7 * scale, z + dz * scale, .13, 1.1 * scale, 1.6 * scale);
  b.cylinder('dark', x, 8.4 * scale, z - 6 * scale, .6 * scale, .7 * scale, 4 * scale, 6);
}

export function createPort(): Group {
  const b = new GeometryBatch();
  b.box('stone', 0, 1.5, 30, 178, 3, 105);
  b.box('cream', 0, 6, -14, 115, 10, 30);
  b.box('red', 0, 11.5, -14, 119, 1.5, 34);
  windowRows(b, 105, 1.3, 6);
  for (const x of [-48, 48]) {
    b.box('steel', x, 1, 216, 15, 2, 365);
    b.box('bark', x, -.1, 420, 98, 2, 22);
    for (let z = 55; z < 420; z += 60) b.cylinder('dark', x, -1.5, z, 1, 1.4, 7, 6);
    ferry(b, x - 22, 454, 1.15); ferry(b, x + 21, 456, .9);
    b.box('gold', x, 18, 30, 2, 35, 2);
    b.beam('gold', new Vector3(x, 35, 30), new Vector3(x + 28, 35, 30), .8);
    b.beam('dark', new Vector3(x + 26, 35, 30), new Vector3(x + 26, 13, 30), .08);
  }
  for (let x = -65; x <= 65; x += 22) b.box(x % 3 ? 'red' : 'blue', x, 3.5, 52, 17, 5.5, 7);
  return b.build('Porto de Manaus — floating wharves and regional boats');
}

export function createClock(): Group {
  const b = new GeometryBatch();
  b.cylinder('stone', 0, .3, 0, 7, 8, .6, 12);
  b.cylinder('cream', 0, 1.5, 0, 3, 4, 2, 4);
  b.cylinder('cream', 0, 7.5, 0, 1.1, 1.6, 11, 8);
  b.box('cream', 0, 13.8, 0, 4.7, 3.4, 4.7);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    b.add(new CylinderGeometry(1.4, 1.4, .16, 24).rotateX(Math.PI / 2), 'white', Math.sin(angle) * 2.44, 14, Math.cos(angle) * 2.44, 0, angle);
    b.box('dark', Math.sin(angle) * 2.57, 14.35, Math.cos(angle) * 2.57, .12, 1.05, .12);
    b.box('dark', Math.sin(angle) * 2.58 + Math.cos(angle) * .35, 14, Math.cos(angle) * 2.58 - Math.sin(angle) * .35, .8, .12, .12, angle);
  }
  b.cylinder('green', 0, 16.4, 0, .1, 3.5, 2.3, 4);
  b.sphere('gold', 0, 18, 0, .35);
  for (const x of [-12, 12]) palm(b, x, 0, 11);
  return b.build('Relógio Municipal — four clock faces');
}

export function createPalace(): Group {
  const b = new GeometryBatch();
  b.box('leaf', 0, .1, 0, 130, .2, 100);
  b.box('sand', 0, .2, 22, 90, .2, 65);
  b.box('gold', 0, 7, -9, 65, 14, 35);
  b.box('cream', 0, 1.3, -9, 68, 2, 37);
  b.box('cream', 0, 8, -9, 67, .6, 37);
  b.box('cream', 0, 14.3, -9, 68, .9, 38);
  b.box('red', 0, 15.3, -9, 64, 1.4, 34);
  for (const x of [-27, 0, 27]) { b.box('gold', x, 8.4, 6, 13, 16, 13); b.box('cream', x, 16.7, 6, 15, 1, 15); }
  windowRows(b, 60, 9, 4.7, 7); windowRows(b, 60, 9, 11.5, 7);
  for (let step = 0; step < 8; step++) b.box('cream', 0, step * .2 + .2, 23 - step, 17, .3, 9);
  b.box('cream', 0, 18.2, 6, 15, 2, 15);
  for (const x of [-46, 46]) for (const z of [-25, 10, 40]) palm(b, x, z, 13);
  return b.build('Palácio Rio Negro — golden facade and garden');
}

// The orla was surveyed off the compiled Rio Negro water polygons: the waterline runs at .51 rad
// through the landmark, so a box's local x is the inland axis and its local z runs down the beach.
const ORLA = .51, ORLA_SIN = Math.sin(ORLA), ORLA_COS = Math.cos(ORLA);
// The promenade is centred a little north of the landmark, over the one stretch where the compiled
// blocks leave the shore clear; the real city carries the beachfront beyond it.
const ORLA_MID = -205, ORLA_REACH = 330;
/** Shore-local placement: `along` runs down the beach, `inland` away from the water. */
function shore(x: number, z: number, along: number, inland: number): [number, number] {
  return [x + ORLA_SIN * along + ORLA_COS * inland, z + ORLA_COS * along - ORLA_SIN * inland];
}
/** A strip of the orla, laid along the shore and measured across it. */
function strip(b: GeometryBatch, tone: PaletteKey, inland: number, y: number, width: number, height: number, length: number): void {
  const [x, z] = shore(0, 0, ORLA_MID, inland);
  b.box(tone, x, y, z, width, height, length, ORLA);
}

/** The calçadão's Portuguese wave, as four long ribbons so a kilometre of paving stays cheap. */
function wavePavement(b: GeometryBatch, inland: number): void {
  const vertices: number[] = [];
  for (const lane of [-17, -6, 6, 17]) {
    for (let a = -ORLA_REACH; a < ORLA_REACH; a += 16) {
      const i0 = inland + lane + Math.sin(a * .021) * 5, i1 = inland + lane + Math.sin((a + 16) * .021) * 5;
      const [ax, az] = shore(0, 0, ORLA_MID + a, i0 - 1.6), [bx, bz] = shore(0, 0, ORLA_MID + a, i0 + 1.6);
      const [cx, cz] = shore(0, 0, ORLA_MID + a + 16, i1 + 1.6), [dx, dz] = shore(0, 0, ORLA_MID + a + 16, i1 - 1.6);
      vertices.push(ax, .42, az, bx, .42, bz, cx, .42, cz, ax, .42, az, cx, .42, cz, dx, .42, dz);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  b.add(geometry, 'dark');
}

// The compiled river mask puts the dry beach between along -400 and +325; everything the orla
// stands on lives inside that, and only the pier is allowed past it.
const KIOSK_ALONG = [-370, -275, -180, -85, 10, 105, 200, 290] as const;
const KIOSK_INLAND = 88;

/** A quiosque: masonry body, service window, tiled roof and the shade sail over its tables. */
function kiosk(b: GeometryBatch, along: number, tone: PaletteKey): void {
  const [x, z] = shore(0, 0, along, KIOSK_INLAND);
  b.box(tone, x, 1.7, z, 9, 3.4, 8, ORLA);
  b.box('red', x, 3.65, z, 10.6, .5, 9.6, ORLA);
  const [gx, gz] = shore(x, z, 0, -4.7);
  b.box('glass', gx, 2.1, gz, .3, 1.5, 5, ORLA);
  const [cx, cz] = shore(x, z, 0, -10.5);
  b.box('gold', cx, 3.05, cz, 12, .26, 9.4, ORLA);
  for (const sa of [-4, 4]) for (const si of [-5, 5]) {
    const [px, pz] = shore(cx, cz, sa, si);
    b.cylinder('steel', px, 1.5, pz, .09, .09, 3, 6);
  }
}

/** Beach umbrellas: the rented shade that covers the sand in front of the quiosques. */
function umbrella(b: GeometryBatch, along: number, inland: number, tone: PaletteKey): void {
  const [x, z] = shore(0, 0, along, inland);
  b.cylinder('bark', x, 1.35, z, .08, .1, 2.7, 6);
  b.cylinder(tone, x, 3, z, 0, 2.9, .8, 8);
}

/** A sand court: lines, two posts and a net, for volleyball and futevôlei alike. */
function court(b: GeometryBatch, along: number, inland: number): void {
  const [cx, cz] = shore(0, 0, along, inland);
  for (const si of [-4.2, 4.2]) {
    const [x, z] = shore(cx, cz, 0, si);
    b.box('white', x, .08, z, .3, .12, 16.6, ORLA);
  }
  for (const sa of [-8.3, 8.3]) {
    const [x, z] = shore(cx, cz, sa, 0);
    b.box('white', x, .08, z, 8.7, .12, .3, ORLA);
  }
  for (const si of [-4.6, 4.6]) {
    const [x, z] = shore(cx, cz, 0, si);
    b.cylinder('steel', x, 1.3, z, .08, .1, 2.6, 6);
  }
  b.box('white', cx, 1.95, cz, 9.2, 1, .08, ORLA);
}

const PIER_ALONG = -300, PIER_LENGTH = 190;

/** The pier walks out over the Rio Negro, where no compiled footprint can ever stand. */
function pier(b: GeometryBatch): void {
  const [dx, dz] = shore(0, 0, PIER_ALONG, 20 - PIER_LENGTH / 2);
  b.box('bark', dx, 1.5, dz, PIER_LENGTH, .55, 12, ORLA);
  for (let d = 16; d < PIER_LENGTH; d += 14) {
    for (const sa of [-4.8, 4.8]) {
      const [px, pz] = shore(0, 0, PIER_ALONG + sa, 20 - d);
      b.cylinder('bark', px, -1.4, pz, .42, .55, 7, 6);
    }
    for (const sa of [-5.6, 5.6]) {
      const [px, pz] = shore(0, 0, PIER_ALONG + sa, 20 - d);
      b.box('steel', px, 2.4, pz, .12, 1.3, .12, ORLA);
    }
  }
  for (const sa of [-5.6, 5.6]) {
    const [rx, rz] = shore(0, 0, PIER_ALONG + sa, 20 - PIER_LENGTH / 2);
    b.box('white', rx, 3.02, rz, PIER_LENGTH, .12, .16, ORLA);
    b.box('white', rx, 2.4, rz, PIER_LENGTH, .1, .12, ORLA);
  }
  // A roofed head where the boats tie up and the view back at the beach opens out.
  const [hx, hz] = shore(0, 0, PIER_ALONG, 20 - PIER_LENGTH - 9);
  b.box('bark', hx, 1.5, hz, 20, .55, 22, ORLA);
  for (const sa of [-9, 9]) for (const si of [-8, 8]) {
    const [px, pz] = shore(hx, hz, sa, si);
    b.cylinder('steel', px, 3.4, pz, .16, .18, 3.4, 6);
  }
  b.box('red', hx, 5.4, hz, 22, .5, 24, ORLA);
}

const BOWL_ALONG = 0, BOWL_INLAND = 190, STAGE_INLAND = BOWL_INLAND - 46;

export function createPonta(): Group {
  const b = new GeometryBatch();
  const span = ORLA_REACH * 2;
  // Sand, wet sand and the sea wall: the beach is the one thing Overture will never map.
  // The waterline sits about 80 m seaward of the promenade, and the real river surface now renders
  // at y = 0.06, so the sand has to be narrower than the old 330 m apron and sit above the water
  // rather than 20 cm under it. The submerged stone shelf that used to run 250 m offshore is gone.
  strip(b, 'sand', -34, .12, 112, .3, 720);
  for (let step = 0; step < 3; step++) strip(b, 'stone', 8 + step * 3.3, .06 + step * .23, 3.5, .34 + step * .46, span + 40);

  // Calçadão, ciclovia and the wave paving the orla is known for, with its seaward railing.
  strip(b, 'cream', 45, .2, 56, .4, span + 20);
  strip(b, 'red', 66, .26, 8, .2, span);
  wavePavement(b, 36);
  strip(b, 'white', 16, 1.08, .16, .12, span);
  strip(b, 'white', 16, .74, .12, .1, span);
  for (let a = -ORLA_REACH; a <= ORLA_REACH; a += 22) {
    const [x, z] = shore(0, 0, ORLA_MID + a, 16);
    b.box('steel', x, .56, z, .14, 1.12, .14, ORLA);
  }

  // Palms, lamps and benches down the full length of the promenade.
  for (let i = -10; i <= 10; i++) {
    const a = ORLA_MID + i * 33;
    const [px, pz] = shore(0, 0, a, 52);
    palm(b, px, pz, 13 + (Math.abs(i) % 4), i * .37);
    if (i % 2 === 0) { const [lx, lz] = shore(0, 0, a + 20, 30); lamp(b, lx, lz); }
    if (i % 3 !== 0) { const [bx, bz] = shore(0, 0, a + 14, 26); bench(b, bx, bz, ORLA); }
  }

  // Quiosques, umbrellas and sand courts.
  const tones: readonly PaletteKey[] = ['white', 'cream', 'salmon', 'blue'];
  const shades: readonly PaletteKey[] = ['red', 'gold', 'blue', 'green'];
  for (const [n, a] of KIOSK_ALONG.entries()) kiosk(b, a, tones[n % tones.length]);
  for (let n = 0; n < 20; n++) umbrella(b, -355 + n * 33, -12 - (n % 3) * 16, shades[n % shades.length]);
  for (const a of [-320, -140, 60]) court(b, a, -25);
  pier(b);

  // Praça and anfiteatro: a paved plaza, the stepped bowl and the covered stage it faces.
  const [ax, az] = shore(0, 0, BOWL_ALONG, BOWL_INLAND);
  b.box('stone', ax, .18, az, 165, .36, 370, ORLA);
  for (let step = 0; step < 11; step++) {
    b.add(new TorusGeometry(22 + step * 4.2, 1.35, 4, 36, Math.PI).rotateX(Math.PI / 2), 'stone', ax, 1.2 + step * .68, az, 0, ORLA + Math.PI / 2);
  }
  const [sx, sz] = shore(0, 0, BOWL_ALONG, STAGE_INLAND);
  b.box('stone', sx, 1.1, sz, 24, 2.2, 34, ORLA);
  b.box('dark', sx, 2.3, sz, 22, .2, 32, ORLA);
  const [wx, wz] = shore(sx, sz, 0, 11);
  b.box('cream', wx, 4.5, wz, 1.2, 9, 34, ORLA);
  for (const sa of [-16, 16]) for (const si of [-10, 10]) {
    const [px, pz] = shore(sx, sz, sa, si);
    b.cylinder('steel', px, 5, pz, .24, .3, 10, 6);
  }
  b.box('dark', sx, 10.4, sz, 26, .8, 36, ORLA);
  for (const sa of [-11, 11]) { const [px, pz] = shore(sx, sz, sa, -9); b.box('dark', px, 4, pz, 1.4, 5, 1.8, ORLA); }
  for (const sa of [-150, 150]) for (const si of [20, 62]) {
    const [tx, tz] = shore(ax, az, sa, si);
    tree(b, tx, tz, 15 + ((sa + si) & 3), sa * .01);
  }
  for (const sa of [-160, -60, 60, 160]) { const [lx, lz] = shore(ax, az, sa, -26); lamp(b, lx, lz); }
  return b.build('Ponta Negra — orla, calçadão, anfiteatro and pier');
}

/** Solid parts of the orla; everything else is sand, paving and planting a player flies through. */
function pontaColliders(): LandmarkBox[] {
  const out: LandmarkBox[] = [];
  // The seating bowl rises inland of its centre, so the box covers the stepped half only.
  const [bx, bz] = shore(0, 0, BOWL_ALONG, BOWL_INLAND + 32);
  out.push({ x: bx, y: 4.2, z: bz, width: 70, height: 8.4, depth: 132 });
  const [sx, sz] = shore(0, 0, BOWL_ALONG, STAGE_INLAND);
  out.push({ x: sx, y: 1.1, z: sz, width: 24, height: 2.2, depth: 34 });
  out.push({ x: sx, y: 10.4, z: sz, width: 26, height: .8, depth: 36 });
  for (const a of KIOSK_ALONG) {
    const [x, z] = shore(0, 0, a, KIOSK_INLAND);
    out.push({ x, y: 1.9, z, width: 10.6, height: 3.8, depth: 9.6 });
  }
  const [dx, dz] = shore(0, 0, PIER_ALONG, 20 - PIER_LENGTH / 2);
  out.push({ x: dx, y: 1.5, z: dz, width: PIER_LENGTH, height: .55, depth: 12 });
  const [hx, hz] = shore(0, 0, PIER_ALONG, 20 - PIER_LENGTH - 9);
  out.push({ x: hx, y: 1.5, z: hz, width: 20, height: .55, depth: 22 });
  out.push({ x: hx, y: 5.4, z: hz, width: 22, height: .5, depth: 24 });
  return out;
}

export const PONTA_COLLIDERS: readonly LandmarkBox[] = pontaColliders();

export function createBridge(): Group {
  const b = new GeometryBatch();
  // The crossing is laid out along local x and then turned onto the surveyed alignment, so the
  // deck, the piers and the collision boxes all read the same constant.
  const { angle, halfLength: half, deck } = BRIDGE;
  const length = half * 2;
  b.box('stone', 0, deck - 2, 0, length, 4, 28);
  b.box('dark', 0, deck + .12, 0, length, .22, 24);
  for (const z of [-13, 13]) { b.box('white', 0, deck + 1.2, z, length, 1.1, .7); b.box('light', 0, deck + 1.7, z, length, .1, .16); }
  for (let x = -half + 32; x < half; x += 120) {
    if (Math.abs(x) < 240) continue;
    b.box('cream', x, deck / 2 - 2, 0, 8, deck + 1, 19);
    b.box('cream', x, deck - 5, 0, 13, 4, 26);
  }
  for (const z of [-10.5, 10.5]) {
    b.beam('cream', new Vector3(-24, -3, z), new Vector3(-8, 155, z), 3.4, 6);
    b.beam('cream', new Vector3(24, -3, z), new Vector3(8, 155, z), 3.4, 6);
    b.beam('cream', new Vector3(-8, 155, z), new Vector3(0, 185, z), 3, 6);
    b.beam('cream', new Vector3(8, 155, z), new Vector3(0, 185, z), 3, 6);
    for (let i = 1; i <= 16; i++) for (const side of [-1, 1]) b.beam('white', new Vector3(0, 88 + i * 5.4, z), new Vector3(side * (25 + i * 16), deck + 1, z), .28, 4);
  }
  b.box('cream', 0, 81, 0, 30, 4, 24);
  b.box('cream', 0, 154, 0, 20, 4, 24);
  b.box('light', 0, 185, 0, 1.7, 2, 24);
  const group = b.build('Ponte Rio Negro — 3.595 km cable-stayed bridge'); group.rotation.y = angle;
  return group;
}

export function createIranduba(): Group {
  const b = new GeometryBatch();
  b.box('leaf', 0, .04, 0, 960, .08, 760);
  b.box('dark', 0, .14, 0, 28, .18, 720);
  b.box('dark', 0, .15, 0, 720, .18, 26);
  const facades = ['cream', 'salmon', 'stone', 'blue'] as const;
  for (let row = -3; row <= 3; row++) for (let col = -4; col <= 4; col++) {
    if (Math.abs(col) < 1 || Math.abs(row) < 1) continue;
    const x = col * 76 + (row % 2) * 11;
    const z = row * 72 + (col % 2) * 8;
    const h = 6 + ((row * row + col * col) % 4) * 2.4;
    const w = 34 + ((row + col + 20) % 3) * 7;
    const d = 27 + ((row - col + 20) % 3) * 6;
    b.box(facades[(row * 7 + col * 11 + 99) % facades.length], x, h / 2, z, w, h, d);
    if ((row + col) % 3 === 0) b.box('glass', x, h * .63, z + d * .505, w * .58, h * .2, .18);
  }
  for (let i = 0; i < 24; i++) {
    const angle = i * 2.399, radius = 270 + (i % 5) * 34;
    tree(b, Math.cos(angle) * radius, Math.sin(angle) * radius, 13 + i % 7, angle);
  }
  for (const x of [-330, 330]) for (const z of [-235, 235]) palm(b, x, z, 12 + ((x + z) & 3));
  for (const x of [-4.5, 4.5]) for (const z of [-4.5, 4.5]) b.cylinder('steel', x, 9, z, .24, .34, 18, 7);
  b.cylinder('white', 0, 18, 0, 5.6, 4.4, 6.5, 18);
  b.cylinder('blue', 0, 21.5, 0, 1.1, 1.1, 1, 12);
  return b.build('Iranduba · Cacau Pirêra — generalized opposite-bank settlement');
}

export function createMeeting(): Group {
  const b = new GeometryBatch();
  ferry(b, 0, 0, 1.4);
  b.box('white', 0, 8.8, -4, 10, .4, 27);
  b.box('gold', -70, -.5, 80, 8, 2, 17);
  b.box('blue', -70, 1.5, 80, 6, 2, 10);
  return b.build('Encontro das Águas — river observation boat');
}

export function createMusa(): Group {
  const b = new GeometryBatch();
  for (let i = 0; i < 65; i++) {
    const angle = i * 2.399, r = 40 + Math.sqrt(i / 65) * 220;
    tree(b, Math.cos(angle) * r, Math.sin(angle) * r, 24 + (i * 7 % 17), angle);
  }
  for (const x of [-4.6, 4.6]) for (const z of [-4.6, 4.6]) b.cylinder('steel', x, 22.5, z, .24, .4, 45, 7);
  for (let level = 0; level <= 9; level++) {
    const y = level * 4.5;
    if (level % 3 === 0 || level === 9) {
      b.box('bark', 0, y, 0, 12, .35, 12);
      for (const z of [-6, 6]) b.box('steel', 0, y + 1.1, z, 12, .09, .09);
      for (const x of [-6, 6]) b.box('steel', x, y + 1.1, 0, .09, .09, 12);
    }
    if (level < 9) for (const z of [-4.6, 4.6]) b.beam('steel', new Vector3(-4.6, y, z), new Vector3(4.6, y + 4.5, z), .12);
    for (let step = 0; step < 9 && level < 9; step++) b.box('stone', (level % 2 ? -1 : 1) * (step - 4) * .95, y + step * .5, 0, 1.05, .12, 2.3);
  }
  b.box('bark', 0, 44.7, 0, 14, .6, 14);
  for (const z of [-7, 7]) b.box('steel', 0, 45.8, z, 14, .1, .1);
  return b.build('MUSA — canopy observation tower');
}

export function createBosque(): Group {
  const b = new GeometryBatch();
  b.box('leaf', 0, .08, 0, 350, .16, 350);
  b.box('sand', 0, .2, 0, 8, .2, 310);
  b.box('sand', 0, .2, 0, 310, .2, 8);
  for (let i = 0; i < 75; i++) {
    const angle = i * 2.399, r = 25 + Math.sqrt(i / 75) * 140;
    tree(b, Math.cos(angle) * r, Math.sin(angle) * r, 14 + (i * 11 % 17), angle);
  }
  b.cylinder('stone', 45, .4, 32, 23, 25, .8, 28);
  b.cylinder('glass', 45, .85, 32, 21, 21, .1, 28);
  b.sphere('stone', 45, 1.1, 31, 3.5, 1, .5, 1.9);
  b.box('cream', -44, 3, -40, 24, 6, 18);
  b.cylinder('red', -44, 8, -40, 0, 18, 5, 4);
  b.box('bark', 0, 1.5, 0, 9, 3, 9);
  for (const x of [-12, 12]) bench(b, x, 9);
  return b.build('Bosque da Ciência — rainforest trails and manatee pool');
}

export const LANDMARK_BUILDERS: Record<string, () => Group> = {
  largo: createLargo, mercado: createMarket, porto: createPort, relogio: createClock, palacio: createPalace,
  arena: createArena, ponta: createPonta, ponte: createBridge, iranduba: createIranduba, encontro: createMeeting, musa: createMusa, bosque: createBosque,
};
