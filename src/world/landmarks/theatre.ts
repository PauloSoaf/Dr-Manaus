import { BufferGeometry, Float32BufferAttribute, Group, Shape, ShapeGeometry, SphereGeometry, TorusGeometry } from 'three/webgpu';
import { GeometryBatch, palm } from './GeometryBatch';

function pediment(batch: GeometryBatch, x: number, y: number, z: number, width: number, height: number): void {
  const shape = new Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, height); shape.closePath();
  batch.add(new ShapeGeometry(shape), 'cream', x, y, z);
}
function arch(batch: GeometryBatch, x: number, y: number, z: number, width: number, height: number, side = 0): void {
  const r = width / 2;
  const shape = new Shape(); shape.moveTo(-r, 0); shape.lineTo(r, 0); shape.lineTo(r, height - r); shape.absarc(0, height - r, r, 0, Math.PI, false); shape.lineTo(-r, 0);
  batch.add(new ShapeGeometry(shape), 'dark', x, y, z, 0, side);
  const dx = Math.cos(side) * (r + .2), dz = -Math.sin(side) * (r + .2);
  batch.box('cream', x - dx, y + (height - r) / 2, z - dz, .35, height - r, .35, side);
  batch.box('cream', x + dx, y + (height - r) / 2, z + dz, .35, height - r, .35, side);
  batch.add(new TorusGeometry(r + .2, .2, 5, 14, Math.PI), 'cream', x, y + height - r, z, 0, side);
  batch.box('gold', x, y + (height - r) / 2, z + .08, .09, height - r, .12, side);
}

/** Authored architectural silhouette: rustication, arcades, cornices and tiled hemispherical cupola. */
export function createTheatre(): Group {
  const b = new GeometryBatch();
  b.box('stone', 0, .3, 0, 66, .6, 79);
  for (let step = 0; step < 6; step++) b.box('cream', 0, .35 + step * .22, 39 - step * 1.25, 30 - step * .6, .25, 8);
  b.box('salmon', 0, 11.5, -1, 55, 22, 65);
  b.box('salmon', 0, 12, -34, 33, 23, 18);
  b.box('stone', 0, 1.2, -1, 57, 1.4, 67);
  // Layered stone belts and tall pilasters keep the facade legible at distance.
  for (const y of [2.1, 9.5, 10.2, 20, 21.3, 22.2]) b.box('cream', 0, y, -1, 57.2, y === 21.3 ? .8 : .35, 67.2);
  for (let x = -25; x <= 25; x += 5) {
    b.box('cream', x, 11.1, 31.85, .65, 18.5, .6);
    b.box('cream', x, 2.8, 32.05, 1.05, .6, .85);
    b.box('cream', x, 19.8, 32.05, 1.1, .5, .85);
  }
  for (let i = -4; i <= 4; i++) {
    const x = i * 5.05;
    arch(b, x, 2.4, 32.01, 2.8, 5.7);
    arch(b, x, 11.1, 32.02, 2.7, 6.5);
    b.box('cream', x, 10.8, 32.6, 3.5, .4, 1.4);
    for (let j = -2; j <= 2; j++) b.cylinder('cream', x + j * .56, 11.9, 33, .1, .13, 1.5, 6);
    b.box('cream', x, 12.8, 33, 3.5, .18, .35);
    b.box('light', x, 18.7, 32.08, 2.2, .28, .15);
  }
  for (const side of [-1, 1]) for (let i = -5; i <= 5; i++) {
    const z = i * 5.3 - 1;
    arch(b, side * 27.54, 3, z, 2.6, 5.2, side * Math.PI / 2);
    arch(b, side * 27.56, 11.2, z, 2.8, 6.4, side * Math.PI / 2);
    b.box('cream', side * 27.8, 11, z + 2.4, .65, 19, .55);
  }
  // The central portico and triangular pediment face the historic square / river.
  b.box('cream', 0, 2, 34.3, 20, .7, 8);
  for (const x of [-8, -3.3, 3.3, 8]) {
    b.cylinder('white', x, 10.5, 35, .55, .72, 16, 14);
    b.box('cream', x, 2.9, 35, 1.5, .8, 1.5);
    b.box('cream', x, 18.5, 35, 1.6, .6, 1.6);
  }
  b.box('cream', 0, 19.2, 34.8, 20.5, 1.2, 4.8);
  pediment(b, 0, 19.8, 37.25, 23, 5);
  pediment(b, 0, 20.5, 37.31, 16, 3);
  b.sphere('gold', 0, 21.8, 37.55, .72, 1, 1, .2);
  // Roof banks and balustrade.
  b.box('red', 0, 22.65, -2, 53, .8, 62);
  for (const x of [-27, 27]) for (let z = -31; z <= 30; z += 2.5) b.cylinder('cream', x, 23.3, z, .15, .18, 1.6, 6);
  for (const x of [-27, 27]) b.box('cream', x, 24.2, -1, .6, .35, 66);
  for (const z of [-33, 31]) {
    for (let x = -26; x <= 26; x += 2.5) b.cylinder('cream', x, 23.3, z, .15, .18, 1.6, 6);
    b.box('cream', 0, 24.2, z, 56, .35, .6);
  }
  b.cylinder('cream', 0, 24, -3, 13.2, 13.5, 2.1, 56);
  b.cylinder('gold', 0, 25.1, -3, 12.7, 12.7, .35, 56);
  // Mosaic tiles are geometry batches in four shared materials, with no per-tile objects.
  const rows = 10, columns = 64, radius = 12.6;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const geo = new SphereGeometry(radius, 1, 1, col / columns * Math.PI * 2, Math.PI * 2 / columns * .97, row / rows * Math.PI / 2, Math.PI / 2 / rows * .96);
    const diamond = Math.abs((col % 16) - 8) / 8 + Math.abs(row - 5) / 5;
    const material = diamond < .7 ? 'gold' : diamond < 1 ? 'blue' : (row + Math.floor(col / 8)) % 2 ? 'green' : 'gold';
    b.add(geo, material, 0, 25.4, -3);
  }
  b.cylinder('gold', 0, 38.15, -3, 1.3, 1.8, .7, 16);
  // Spawn uses the cap at y 38.5; a broad enough rest point for the character.
  b.cylinder('cream', 0, 38.35, 0, 1.5, 1.5, .3, 20);
  for (const x of [-45, 45]) for (const z of [-28, 8, 44]) palm(b, x, z, 12.5 + (z % 3), x / 10);
  return b.build('Teatro Amazonas — architectural model');
}

export function createTheatreSilhouette(): Group {
  const b = new GeometryBatch(); b.box('salmon', 0, 11, 0, 55, 22, 68);
  b.box('cream', 0, 22, 0, 57, 1.4, 70);
  b.add(new SphereGeometry(12.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'gold', 0, 25.4, -3);
  return b.build('Teatro distant silhouette');
}

export function wavePlazaGeometry(width: number, depth: number): BufferGeometry {
  const vertices: number[] = [];
  for (let stripe = -15; stripe <= 15; stripe++) {
    for (let i = 0; i < 36; i++) {
      const x1 = -width / 2 + i / 36 * width, x2 = -width / 2 + (i + 1) / 36 * width;
      const z1 = stripe * 5 + Math.sin(x1 * .12) * 2, z2 = stripe * 5 + Math.sin(x2 * .12) * 2;
      if (Math.abs(z1) > depth / 2 - 3 || Math.abs(z2) > depth / 2 - 3) continue;
      vertices.push(x1, .13, z1, x2, .13, z2 + 1.5, x2, .13, z2, x1, .13, z1, x1, .13, z1 + 1.5, x2, .13, z2 + 1.5);
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
  return geometry;
}
