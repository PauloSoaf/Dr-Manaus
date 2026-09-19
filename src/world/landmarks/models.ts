import { CylinderGeometry, Group, Shape, ShapeGeometry, TorusGeometry, Vector3 } from 'three/webgpu';
import { GeometryBatch, palm, tree } from './GeometryBatch';
import { wavePlazaGeometry } from './theatre';
// The Arena has a bespoke model of its own; this module keeps re-exporting it for callers.
import { createArena } from './arena';
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

export function createPonta(): Group {
  const b = new GeometryBatch();
  b.box('sand', -170, -.14, 0, 700, .28, 1800, -.45);
  b.box('cream', 128, .18, 0, 46, .36, 1660, -.45);
  b.box('red', 158, .23, -8, 9, .18, 1630, -.45);
  b.box('dark', 205, .12, -5, 30, .16, 1600, -.45);

  for (let i = -11; i <= 11; i++) {
    const z = i * 68;
    const x = 126 - z * .48;
    palm(b, x, z, 13 + (Math.abs(i) % 4), i * .37);
    lamp(b, x - 12, z);
    if (i % 2 === 0) bench(b, x + 12, z + 10, -.45);
  }

  const facades = ['salmon', 'cream', 'stone', 'white'] as const;
  for (let row = 0; row < 2; row++) for (let i = -10; i <= 10; i++) {
    if (row === 1 && i % 2 !== 0) continue;
    const z = i * 72 + row * 24;
    const coastX = 255 - z * .48;
    const x = coastX + row * 118;
    const h = 48 + ((i * i + row * 17 + 31) % 7) * 10;
    const w = 30 + ((i + 15) % 4) * 6;
    const d = 34 + ((i * 3 + 19) % 4) * 7;
    b.box(facades[(i + row + 24) % facades.length], x, h / 2, z, w, h, d, -.45);
    b.box('glass', x - Math.sin(.45) * (d * .51), h * .66, z + Math.cos(.45) * (d * .51), w * .68, h * .23, .2, -.45);
    b.box('dark', x, h + 1, z, w * .32, 2, d * .32, -.45);
  }

  for (let step = 0; step < 11; step++) {
    b.add(new TorusGeometry(22 + step * 4.2, 1.35, 4, 36, Math.PI).rotateX(Math.PI / 2), 'stone', -20, 1.2 + step * .68, -210);
  }
  b.box('cream', -20, 2.2, -110, 28, 4.4, 26);
  return b.build('Ponta Negra — expanded beachfront district');
}

export function createBridge(): Group {
  const b = new GeometryBatch();
  const length = 3595, deck = 55;
  b.box('stone', 0, deck - 2, 0, length, 4, 28);
  b.box('dark', 0, deck + .12, 0, length, .22, 24);
  for (const z of [-13, 13]) { b.box('white', 0, deck + 1.2, z, length, 1.1, .7); b.box('light', 0, deck + 1.7, z, length, .1, .16); }
  for (let x = -1760; x <= 1760; x += 120) {
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
  const group = b.build('Ponte Rio Negro — 3.595 km cable-stayed bridge'); group.rotation.y = .35;
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
