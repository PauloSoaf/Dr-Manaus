import { BoxGeometry, Group, Vector3 } from 'three/webgpu';
import { GeometryBatch, type PaletteKey } from '../GeometryBatch';
import largo from './largo.json';

export interface LandmarkBox { x: number; y: number; z: number; width: number; height: number; depth: number }

export interface SpecialVenue {
  id: string;
  name: string;
  kind: string;
  floors: number;
  /** The Overture place record's own position. */
  x: number;
  z: number;
  /** How the place was tied to a building: by containment, or by proximity. */
  match: string;
  building: {
    x: number; z: number; width: number; depth: number; angle: number; height: number; ring: number[];
  } | null;
}

/**
 * The venues of the Largo, each on the building its own place record sits in.
 *
 * Nothing here is positioned by street address. `extract-largo.mjs` matches each Overture place to
 * a real footprint — containment first, proximity second — and bakes the oriented box, so a facade
 * gets a real width, depth and heading instead of being guessed from a number on a street.
 */
export const LARGO_VENUES: readonly SpecialVenue[] = largo.venues as SpecialVenue[];

export function venue(id: string): SpecialVenue | undefined {
  return LARGO_VENUES.find(item => item.id === id);
}

/** Human scale, in metres. Every facade element below is sized from these, never by eye. */
const FLOOR = 3.6, DOOR = 2.3, WINDOW_SILL = 1.0, WINDOW_HEIGHT = 2.1;

const PALETTE: Record<string, { wall: PaletteKey; trim: PaletteKey; roof: PaletteKey }> = {
  hotel: { wall: 'cream', trim: 'white', roof: 'red' },
  culture: { wall: 'salmon', trim: 'cream', roof: 'red' },
  restaurant: { wall: 'gold', trim: 'white', roof: 'stone' },
  cafe: { wall: 'salmon', trim: 'white', roof: 'stone' },
  bar: { wall: 'cream', trim: 'gold', roof: 'stone' },
  stall: { wall: 'white', trim: 'red', roof: 'red' },
};

/**
 * A colonial-era frontage on a real footprint: plinth, pilasters, tall shuttered windows, a
 * cornice, a parapet and a lit ground floor. The rear is a plain mass — it is never seen from
 * the square, and modelling it would be spending triangles on nothing.
 */
function frontage(b: GeometryBatch, item: SpecialVenue): void {
  const plot = item.building;
  if (!plot) return;
  const tone = PALETTE[item.kind] ?? PALETTE.culture;
  const floors = Math.max(1, item.floors);
  const height = Math.max(floors * FLOOR, Math.min(plot.height, floors * FLOOR + 3));
  // Everything is built in world metres around the monument, which is the origin.
  const w = plot.width, d = plot.depth, a = plot.angle;
  const x = plot.x, z = plot.z;

  b.box(tone.wall, x, height * .5, z, w, height, d, a);
  // Plinth and cornice read the building's age from across the square.
  b.box('stone', x, .55, z, w + .3, 1.1, d + .3, a);
  b.box(tone.trim, x, height - .35, z, w + .5, .7, d + .5, a);
  b.box(tone.roof, x, height + .35, z, w + .7, .5, d + .7, a);

  // The facade is whichever of the oriented box's FOUR sides actually points at the monument.
  // Choosing only between the two axes left half the frontages with their backs to the square.
  const span = Math.hypot(x, z) || 1;
  const tx = -x / span, tz = -z / span;
  let facing = a, bestDot = -Infinity;
  for (let quarter = 0; quarter < 4; quarter++) {
    const candidate = a + quarter * Math.PI / 2;
    const dot = Math.sin(candidate) * tx + Math.cos(candidate) * tz;
    if (dot > bestDot) { bestDot = dot; facing = candidate; }
  }
  const across = Math.abs(Math.sin(facing - a)) > .5;
  const frontWidth = across ? d : w;
  const reach = (across ? w : d) * .5;
  const nx = Math.sin(facing), nz = Math.cos(facing);
  const ex = Math.cos(facing), ez = -Math.sin(facing);
  const front = (along: number, out: number, y: number): [number, number] =>
    [x + ex * along + nx * (reach + out), z + ez * along + nz * (reach + out)];

  const bays = Math.max(2, Math.min(9, Math.round(frontWidth / 3.4)));
  const pitch = frontWidth / bays;
  for (let bay = 0; bay < bays; bay++) {
    const along = (bay + .5 - bays / 2) * pitch;
    for (let floor = 0; floor < floors; floor++) {
      const sill = floor * FLOOR + WINDOW_SILL;
      if (floor === 0) {
        // Ground floor: a shop door and a lit window, which is what makes the square feel open.
        const [dx, dz] = front(along, .06, 0);
        b.box('glass', dx, DOOR * .5, dz, pitch * .62, DOOR, .12, facing);
        b.box(tone.trim, dx, DOOR + .18, dz, pitch * .74, .3, .18, facing);
        continue;
      }
      const [wx, wz] = front(along, .05, 0);
      b.box('glass', wx, sill + WINDOW_HEIGHT * .5, wz, pitch * .44, WINDOW_HEIGHT, .1, facing);
      b.box(tone.trim, wx, sill + WINDOW_HEIGHT + .16, wz, pitch * .58, .22, .16, facing);
      // Shutters either side, and a small balcony on the first floor as the real casarões have.
      for (const side of [-1, 1]) {
        const [sx, sz] = front(along + side * pitch * .3, .09, 0);
        b.box(tone.trim, sx, sill + WINDOW_HEIGHT * .5, sz, pitch * .11, WINDOW_HEIGHT, .09, facing);
      }
      if (floor === 1) {
        const [bx, bz] = front(along, .42, 0);
        b.box('stone', bx, sill - .12, bz, pitch * .78, .14, .9, facing);
        for (let rail = 0; rail < 5; rail++) {
          const [rx, rz] = front(along + (rail - 2) * pitch * .17, .78, 0);
          b.cylinder(tone.trim, rx, sill + .3, rz, .04, .05, .85, 5);
        }
        const [hx, hz] = front(along, .78, 0);
        b.box(tone.trim, hx, sill + .76, hz, pitch * .78, .09, .1, facing);
      }
    }
    // Pilasters between the bays.
    const [px, pz] = front(along + pitch * .5, .12, 0);
    b.box(tone.trim, px, height * .5, pz, .26, height - .9, .22, facing);
  }

  // Signage over the entrance, and a warm lamp that reads at night.
  const [sx, sz] = front(0, .3, 0);
  b.box(tone.roof, sx, DOOR + .95, sz, Math.min(frontWidth * .5, 7), .75, .25, facing);
  b.box('gold', sx, DOOR + .95, sz + .02, Math.min(frontWidth * .5, 7) - .3, .45, .3, facing);
  for (const side of [-1, 1]) {
    const [lx, lz] = front(side * Math.min(frontWidth * .34, 5), .35, 0);
    b.sphere('light', lx, DOOR + .45, lz, .17, 1, 1, 1);
  }

  // Awnings over the ground floor of anywhere that serves the square.
  if (item.kind === 'restaurant' || item.kind === 'cafe' || item.kind === 'bar') {
    const [ax, az] = front(0, 1.3, 0);
    // Tilted, so `add` rather than `box`, which has no pitch argument.
    b.add(new BoxGeometry(frontWidth * .82, .16, 2.6), tone.roof, ax, DOOR + .55, az, -.16, facing);
    for (const side of [-1, 1]) {
      const [cx, cz] = front(side * frontWidth * .38, 2.4, 0);
      b.cylinder('steel', cx, DOOR * .5, cz, .05, .05, DOOR, 6);
    }
  }
}

/** Every venue frontage as one merged build, anchored on the monument at world zero. */
export function createLargoVenues(): Group {
  const b = new GeometryBatch();
  for (const item of LARGO_VENUES) {
    if (!item.building) continue;
    frontage(b, item);
  }
  return b.build('Largo de São Sebastião — casario');
}

/** Distant frontages: the masses only, which is all that survives past a couple of hundred metres. */
export function createLargoVenuesDistant(): Group {
  const b = new GeometryBatch();
  for (const item of LARGO_VENUES) {
    const plot = item.building;
    if (!plot) continue;
    const tone = PALETTE[item.kind] ?? PALETTE.culture;
    const height = Math.max(item.floors * FLOOR, Math.min(plot.height, item.floors * FLOOR + 3));
    b.box(tone.wall, plot.x, height * .5, plot.z, plot.width, height, plot.depth, plot.angle);
    b.box(tone.roof, plot.x, height + .3, plot.z, plot.width + .6, .6, plot.depth + .6, plot.angle);
  }
  return b.build('Largo — casario distante');
}

/** One box per frontage, so the player cannot walk through the buildings around the square. */
export const VENUE_COLLIDERS: readonly LandmarkBox[] = LARGO_VENUES.flatMap(item => {
  const plot = item.building;
  if (!plot) return [];
  const height = Math.max(item.floors * FLOOR, Math.min(plot.height, item.floors * FLOOR + 3));
  // Axis-aligned, so a rotated frontage takes the larger of its two extents.
  const cos = Math.abs(Math.cos(plot.angle)), sin = Math.abs(Math.sin(plot.angle));
  return [{
    x: plot.x, y: height * .5, z: plot.z,
    width: plot.width * cos + plot.depth * sin,
    height,
    depth: plot.width * sin + plot.depth * cos,
  }];
});

export const LARGO_ANCHOR = new Vector3(0, 0, 0);
