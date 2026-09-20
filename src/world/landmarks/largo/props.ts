import { BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, SphereGeometry } from 'three/webgpu';
import { GeometryBatch } from '../GeometryBatch';
import { clearance, isPaved, zoneAt, type LargoZone } from './plaza';
import { LARGO_VENUES } from './venues';

/**
 * The furniture of the square, placed by ZONE rather than scattered.
 *
 * Everything is sized in metres against a standing person: a chair seat at 0.45 m, a table top at
 * 0.75, a parasol at 2.6, a stall at 2.9, a lamp standard at 4.2. Nothing here is sized by how it
 * looks from a distance, which is how props end up reading as toys next to a real building.
 */
const SEAT = .45, TABLE = .75, PARASOL = 2.6, STALL = 2.9, LAMP = 4.2;

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ b, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 8) / 16777216;
}

interface Placement { x: number; z: number; angle: number; zone: LargoZone }

/**
 * Candidate positions on a jittered grid, filtered by what the ground actually is. The monument's
 * own zone is left empty, and anything within a couple of metres of an edge is dropped so the
 * square keeps its circulation.
 */
function placements(spacing: number, zones: readonly LargoZone[], margin: number, seed: number): Placement[] {
  const found: Placement[] = [];
  for (let z = -140; z <= 140; z += spacing) for (let x = -140; x <= 140; x += spacing) {
    const jx = x + (hash(x * 73856093 + seed, z) - .5) * spacing * .7;
    const jz = z + (hash(z * 19349663 + seed, x) - .5) * spacing * .7;
    if (!isPaved(jx, jz)) continue;
    const zone = zoneAt(jx, jz);
    if (!zones.includes(zone)) continue;
    if (clearance(jx, jz, margin + 2) < margin) continue;
    found.push({ x: jx, z: jz, angle: hash(seed, x * 31 + z) * Math.PI * 2, zone });
  }
  return found;
}

function instanced(root: Group, name: string, geometry: BoxGeometry | CylinderGeometry | SphereGeometry,
  material: MeshStandardMaterial, items: readonly { x: number; y: number; z: number; angle: number; scale?: number }[]): void {
  if (!items.length) return;
  const mesh = new InstancedMesh(geometry, material, items.length);
  mesh.name = name;
  const matrix = new Matrix4();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    matrix.makeRotationY(item.angle);
    if (item.scale && item.scale !== 1) matrix.scale({ x: item.scale, y: item.scale, z: item.scale } as never);
    matrix.setPosition(item.x, item.y, item.z);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
}

/**
 * Café seating, vendor stalls, lamps, bins, benches and planters. Repeats go through
 * InstancedMesh so the whole square costs a handful of draws rather than one per chair.
 */
export function createLargoProps(): Group {
  const root = new Group();
  root.name = 'largo-props';

  const wood = new MeshStandardMaterial({ color: '#8a6b47', roughness: .9 });
  const metal = new MeshStandardMaterial({ color: '#3a3d3c', roughness: .6, metalness: .35 });
  const cloth = new MeshStandardMaterial({ color: '#c8503f', roughness: .95 });
  const glow = new MeshStandardMaterial({ color: '#ffe4b0', emissive: '#ffb75e', emissiveIntensity: .6, roughness: .5 });
  const leaf = new MeshStandardMaterial({ color: '#3d6b39', roughness: 1 });
  const bark = new MeshStandardMaterial({ color: '#4a3a2c', roughness: 1 });
  const stone = new MeshStandardMaterial({ color: '#8d8478', roughness: 1 });

  // Tables and chairs belong to the venues that serve the square, never to its middle.
  const seating = placements(4.2, ['seating'], 2.2, 11);
  instanced(root, 'largo-tables', new CylinderGeometry(.42, .38, .06, 10), wood,
    seating.map(p => ({ x: p.x, y: TABLE, z: p.z, angle: p.angle })));
  instanced(root, 'largo-table-legs', new CylinderGeometry(.05, .06, TABLE, 6), metal,
    seating.map(p => ({ x: p.x, y: TABLE * .5, z: p.z, angle: p.angle })));
  const chairs: { x: number; y: number; z: number; angle: number }[] = [];
  for (const p of seating) for (let n = 0; n < 4; n++) {
    const angle = p.angle + n * Math.PI / 2;
    const x = p.x + Math.cos(angle) * .78, z = p.z + Math.sin(angle) * .78;
    if (isPaved(x, z)) chairs.push({ x, y: SEAT, z, angle: angle + Math.PI });
  }
  instanced(root, 'largo-chairs', new BoxGeometry(.44, .05, .44), wood, chairs);
  instanced(root, 'largo-chair-backs', new BoxGeometry(.44, .48, .05), wood,
    chairs.map(c => ({ x: c.x + Math.cos(c.angle) * .2, y: SEAT + .26, z: c.z + Math.sin(c.angle) * .2, angle: c.angle })));

  // A parasol over every other table.
  const parasols = seating.filter((_, i) => i % 2 === 0);
  instanced(root, 'largo-parasol-poles', new CylinderGeometry(.04, .05, PARASOL, 6), metal,
    parasols.map(p => ({ x: p.x, y: PARASOL * .5, z: p.z, angle: p.angle })));
  instanced(root, 'largo-parasols', new CylinderGeometry(1.5, .1, .5, 8), cloth,
    parasols.map(p => ({ x: p.x, y: PARASOL - .1, z: p.z, angle: p.angle })));

  // Vendor stalls: tacacá, pipoca, churros, along the edges where the real ones stand.
  const vendors = placements(6.5, ['vendor'], 2.6, 23);
  instanced(root, 'largo-stall-bodies', new BoxGeometry(2.1, 1.1, 1.5), wood,
    vendors.map(p => ({ x: p.x, y: .55, z: p.z, angle: p.angle })));
  instanced(root, 'largo-stall-roofs', new BoxGeometry(2.6, .12, 2), cloth,
    vendors.map(p => ({ x: p.x, y: STALL - .2, z: p.z, angle: p.angle })));
  instanced(root, 'largo-stall-posts', new CylinderGeometry(.05, .05, STALL, 5), metal,
    vendors.flatMap(p => [-1, 1].map(side => ({
      x: p.x + Math.cos(p.angle) * side, y: STALL * .5, z: p.z + Math.sin(p.angle) * side, angle: p.angle,
    })).filter(post => isPaved(post.x, post.z))));

  // Lamp standards, bins and benches down the walkways.
  const walk = placements(13, ['walkway', 'entrance'], 3.2, 37);
  instanced(root, 'largo-lamp-posts', new CylinderGeometry(.08, .12, LAMP, 8), metal,
    walk.map(p => ({ x: p.x, y: LAMP * .5, z: p.z, angle: p.angle })));
  instanced(root, 'largo-lamp-heads', new SphereGeometry(.24, 8, 6), glow,
    walk.map(p => ({ x: p.x, y: LAMP + .1, z: p.z, angle: p.angle })));
  // Benches and bins stand BESIDE the lamp they share a spot with, so their offset position has
  // to be checked again — offsetting from a valid point is not itself a valid point.
  const beside = (from: Placement[], dx: number, dz: number) => from
    .map(p => ({ ...p, x: p.x + dx, z: p.z + dz }))
    .filter(p => isPaved(p.x, p.z) && clearance(p.x, p.z, 3) >= 2.4);
  const benches = beside(walk.filter((_, i) => i % 2 === 1), 2.4, 0);
  instanced(root, 'largo-benches', new BoxGeometry(1.8, .08, .5), wood,
    benches.map(p => ({ x: p.x, y: SEAT, z: p.z, angle: p.angle })));
  instanced(root, 'largo-bench-legs', new BoxGeometry(.12, SEAT, .44), stone,
    benches.flatMap(p => [-.7, .7]
      .map(o => ({ x: p.x + Math.cos(p.angle) * o, y: SEAT * .5, z: p.z + Math.sin(p.angle) * o, angle: p.angle }))
      .filter(leg => isPaved(leg.x, leg.z))));
  instanced(root, 'largo-bins', new CylinderGeometry(.28, .24, .85, 8), metal,
    beside(walk.filter((_, i) => i % 3 === 0), -2.1, 0).map(p => ({ x: p.x, y: .43, z: p.z, angle: p.angle })));

  // Trees along the edges, where the real square has them, never in the middle.
  const trees = placements(11, ['trees', 'walkway'], 4.5, 53)
    .filter(p => Math.hypot(p.x, p.z) > 26 && clearance(p.x, p.z, 9) > 5);
  instanced(root, 'largo-trunks', new CylinderGeometry(.22, .34, 4.4, 7), bark,
    trees.map(p => ({ x: p.x, y: 2.2, z: p.z, angle: p.angle })));
  instanced(root, 'largo-canopies', new SphereGeometry(2.7, 9, 6), leaf,
    trees.map(p => ({ x: p.x, y: 5.9, z: p.z, angle: p.angle, scale: .82 + hash(p.x | 0, p.z | 0) * .5 })));
  instanced(root, 'largo-planters', new CylinderGeometry(.95, .85, .55, 9), stone,
    trees.map(p => ({ x: p.x, y: .27, z: p.z, angle: p.angle })));

  return root;
}

/** Counts for the debug panel and for the tests that keep this within budget. */
export function propCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  const group = createLargoProps();
  for (const child of group.children) if (child instanceof InstancedMesh) counts[child.name] = child.count;
  return counts;
}

/** Stall awnings and signs for the venues that are stalls rather than buildings. */
export function createVendorSigns(): Group {
  const b = new GeometryBatch();
  for (const item of LARGO_VENUES) {
    if (item.kind !== 'stall') continue;
    b.box('white', item.x, 1.4, item.z, 2.4, 2.8, 2, 0);
    b.box('red', item.x, 3, item.z, 3, .3, 2.6, 0);
    b.box('gold', item.x, 2.55, item.z + 1.05, 2.2, .5, .12, 0);
  }
  return b.build('Largo — barracas');
}
