import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardNodeMaterial } from 'three/webgpu';
import { cameraPosition, float, mix, positionWorld, smoothstep, vec3 } from 'three/tsl';
import largo from './largo.json';

/**
 * The Largo de São Sebastião, taken from the ground that is actually free.
 *
 * The square is not authored as a rectangle. `extract-largo.mjs` walks a 2 m grid around the
 * monument and keeps every cell that is neither inside a real building footprint nor within a
 * carriageway, so the paving ends exactly where the real buildings and streets begin.
 */
const SPAN = largo.span, CELL = largo.cell, REACH = largo.reach;

function decode(text: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const globals = globalThis as { Buffer?: { from(input: string, encoding: string): Uint8Array } };
  return globals.Buffer ? Uint8Array.from(globals.Buffer.from(text, 'base64')) : new Uint8Array(0);
}

const OPEN = decode(largo.open);

/** True where the square is paved and walkable: the test every prop has to pass. */
export function isPaved(x: number, z: number): boolean {
  const ix = Math.floor(x / CELL) + SPAN / 2, iz = Math.floor(z / CELL) + SPAN / 2;
  if (ix < 0 || iz < 0 || ix >= SPAN || iz >= SPAN) return false;
  return OPEN[iz * SPAN + ix] === 1;
}

/** Metres of clear paving around a point, sampled outward; used to keep furniture off the edges. */
export function clearance(x: number, z: number, limit = 12): number {
  for (let radius = CELL; radius <= limit; radius += CELL) {
    for (let a = 0; a < 8; a++) {
      const angle = a / 8 * Math.PI * 2;
      if (!isPaved(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius)) return radius;
    }
  }
  return limit;
}

/**
 * The 1899 calçada portuguesa: white calcite and black basalt laid in the wave the square is
 * known for. Drawn as a shader over one merged surface rather than as stones — a real setting of
 * this pattern is tens of thousands of pieces, and none of them need to be geometry.
 */
function pavingMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: .86, metalness: 0 });
  const p = positionWorld;
  // Two crossed sine sets give the interlocking crest-and-trough band, not a plain stripe.
  const wave = p.x.mul(.36).add(p.z.mul(.11).sin().mul(2.6)).sin();
  const band = smoothstep(float(-.12), float(.12), wave);
  // A second, finer wave breaks the edge so the bands read as set stones rather than paint.
  const grain = p.x.mul(3.1).sin().mul(p.z.mul(2.7).sin()).mul(.06);
  const calcite = vec3(.82, .79, .72), basalt = vec3(.13, .13, .14);
  const stone = mix(calcite, basalt, band.add(grain).clamp(0, 1));
  // The pattern is only legible close up; further out it settles to the average tone of the square.
  const far = smoothstep(float(70), float(240), cameraPosition.distance(p));
  material.colorNode = mix(stone, vec3(.46, .44, .41), far);
  material.roughnessNode = mix(float(.78), float(.95), far);
  material.name = 'largo-calcada';
  return material;
}

/** Greedy run-length merge along X: 8 200 open cells collapse to a few hundred quads. */
function pavementGeometry(): BufferGeometry {
  const position: number[] = [], normal: number[] = [];
  for (let iz = 0; iz < SPAN; iz++) {
    let run = -1;
    for (let ix = 0; ix <= SPAN; ix++) {
      const open = ix < SPAN && OPEN[iz * SPAN + ix] === 1;
      if (open && run < 0) run = ix;
      if (open || run < 0) continue;
      const x0 = (run - SPAN / 2) * CELL, x1 = (ix - SPAN / 2) * CELL;
      const z0 = (iz - SPAN / 2) * CELL, z1 = z0 + CELL;
      for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]] as const) {
        position.push(px, .05, pz); normal.push(0, 1, 0);
      }
      run = -1;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createLargoPavement(): Mesh {
  const mesh = new Mesh(pavementGeometry(), pavingMaterial());
  mesh.name = 'largo-pavement';
  mesh.receiveShadow = true;
  return mesh;
}

export type LargoZone = 'monument' | 'walkway' | 'trees' | 'seating' | 'vendor' | 'entrance';

export interface ZoneRule { zone: LargoZone; radius: number; x: number; z: number }

/**
 * Semantic zones, so furniture is placed by meaning rather than scattered. The ground around the
 * monument stays clear, seating belongs to the venues that own it, and stalls line the edges.
 */
export const LARGO_ZONES: readonly ZoneRule[] = [
  { zone: 'monument', x: 0, z: 0, radius: 16 },
  ...largo.venues.filter(v => v.kind === 'restaurant' || v.kind === 'cafe' || v.kind === 'bar')
    .map(v => ({ zone: 'seating' as const, x: v.x, z: v.z, radius: 11 })),
  ...largo.venues.filter(v => v.kind === 'stall').map(v => ({ zone: 'vendor' as const, x: v.x, z: v.z, radius: 7 })),
  ...largo.venues.filter(v => v.kind === 'hotel' || v.kind === 'culture')
    .map(v => ({ zone: 'entrance' as const, x: v.x, z: v.z, radius: 8 })),
];

/** The zone a point belongs to, nearest rule wins; everything unclaimed is open walkway. */
export function zoneAt(x: number, z: number): LargoZone {
  let best: LargoZone = 'walkway', bestDistance = Infinity;
  for (const rule of LARGO_ZONES) {
    const distance = Math.hypot(rule.x - x, rule.z - z);
    if (distance < rule.radius && distance < bestDistance) { bestDistance = distance; best = rule.zone; }
  }
  return best;
}

export const LARGO_REACH = REACH;
