import { CylinderGeometry, Group, Mesh } from 'three/webgpu';
import { GeometryBatch, type PaletteKey } from '../landmarks/GeometryBatch';
import { latLonToWorld } from '../geodata/geodata';

/**
 * Aeroporto Internacional Eduardo Gomes. Overture ships no aeroway geometry for Manaus, so the
 * field is rebuilt analytically from surveyed points and projected with `latLonToWorld` like
 * everything else, which keeps the projection the single source of truth for where the city is.
 * Runway 10/28 is 2700 m by 45 m on a bearing of about 100 degrees true.
 */
const RUNWAY_10 = { lat: -3.036490, lon: -60.061660 };
const RUNWAY_28 = { lat: -3.040710, lon: -60.037740 };
const TOWER = { lat: -3.041250, lon: -60.050170 };
const TERMINAL = { lat: -3.044600, lon: -60.047780 };
/** Where the access road leaves the field toward Avenida Santos Dumont and the city. */
const CITY_GATE = { lat: -3.049000, lon: -60.042000 };

const HEAD = latLonToWorld(RUNWAY_10.lat, RUNWAY_10.lon), TAIL = latLonToWorld(RUNWAY_28.lat, RUNWAY_28.lon);
const LENGTH = Math.hypot(TAIL.x - HEAD.x, TAIL.z - HEAD.z), HALF = LENGTH / 2;
const UX = (TAIL.x - HEAD.x) / LENGTH, UZ = (TAIL.z - HEAD.z) / LENGTH;
/** Box width follows the runway heading; the yaw that does that is also the yaw of every slab. */
const YAW = Math.atan2(-UZ, UX);
const MID_X = (HEAD.x + TAIL.x) / 2, MID_Z = (HEAD.z + TAIL.z) / 2;
const APRON_ACROSS = 440, TAXI_A = 190, TAXI_B = 300;
const GRASS_Y = .12, PAVE_Y = .25, MARK_Y = .56;

export interface WorldBox { x: number; y: number; z: number; width: number; height: number; depth: number }
export interface WorldDisc { x: number; z: number; radius: number }

/** Runway frame: `along` runs 10 to 28 from the midpoint, `across` is positive toward the terminal. */
function at(along: number, across: number): { x: number; z: number } {
  return { x: MID_X + UX * along - UZ * across, z: MID_Z + UZ * along + UX * across };
}

/** A rectangle of the field, sized along and across the runway and yawed onto the real heading. */
function slab(b: GeometryBatch, mat: PaletteKey, along: number, across: number, length: number, width: number, y: number, height: number): void {
  const p = at(along, across);
  b.box(mat, p.x, y, p.z, length, height, width, YAW);
}

/** Free ribbon between two world points, for connectors and the road that is not runway aligned. */
function ribbon(b: GeometryBatch, mat: PaletteKey, a: { x: number; z: number }, c: { x: number; z: number }, width: number, y: number, height: number): void {
  const dx = c.x - a.x, dz = c.z - a.z;
  b.box(mat, (a.x + c.x) / 2, y, (a.z + c.z) / 2, Math.hypot(dx, dz), height, width, Math.atan2(-dz, dx));
}

function runway(b: GeometryBatch): void {
  slab(b, 'leafLight', 0, 0, LENGTH + 400, 300, GRASS_Y, .24);
  slab(b, 'stone', 0, 0, LENGTH + 120, 75, PAVE_Y - .06, .38);
  slab(b, 'dark', 0, 0, LENGTH, 45, PAVE_Y, .5);
  for (const side of [-1, 1]) {
    slab(b, 'white', 0, side * 21.5, LENGTH - 12, .9, MARK_Y, .08);
    // Piano keys, then the aiming point and touchdown zone bars measured from each threshold.
    for (let k = 0; k < 4; k++) for (const lane of [-1, 1]) {
      slab(b, 'white', side * (HALF - 24), lane * (3.4 + k * 4.8), 30, 1.8, MARK_Y, .08);
    }
    slab(b, 'white', side * (HALF - 400), 0, 45, 22, MARK_Y, .08);
    for (const lane of [-1, 1]) for (const distance of [150, 300]) {
      slab(b, 'white', side * (HALF - distance), lane * 10.5, 22, 1.8, MARK_Y, .08);
    }
    // Approach bars reach out past the threshold and are the only part of the field that glows.
    for (let k = 1; k <= 5; k++) slab(b, 'light', side * (HALF + k * 30), 0, 3, 14, MARK_Y, .1);
  }
  for (let along = -HALF + 60; along < HALF - 60; along += 50) slab(b, 'white', along, 0, 30, .9, MARK_Y, .08);
}

function taxiways(b: GeometryBatch): void {
  slab(b, 'dark', 0, TAXI_A, LENGTH - 60, 25, PAVE_Y, .5);
  slab(b, 'gold', 0, TAXI_A, LENGTH - 80, .8, MARK_Y, .08);
  slab(b, 'dark', 326, TAXI_B, 1500, 25, PAVE_Y, .5);
  slab(b, 'gold', 326, TAXI_B, 1480, .8, MARK_Y, .08);
  for (const along of [-1100, -520, 60, 640, 1180]) {
    ribbon(b, 'dark', at(along, 26), at(along, TAXI_A), 25, PAVE_Y, .5);
    ribbon(b, 'gold', at(along, 30), at(along, TAXI_A), .8, MARK_Y, .08);
  }
  for (const along of [-200, 326, 900]) ribbon(b, 'dark', at(along, TAXI_A), at(along, TAXI_B), 25, PAVE_Y, .5);
}

function terminal(b: GeometryBatch): void {
  const p = latLonToWorld(TERMINAL.lat, TERMINAL.lon);
  b.box('cream', p.x, 7, p.z, 340, 13, 58, YAW);
  b.box('stone', p.x, 13.6, p.z, 346, 1.2, 64, YAW);
  // Shallow vault, flattened to a 9 m rise: the roof is what identifies the building from above.
  b.add(new CylinderGeometry(29, 29, 336, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, .3, 1), 'white', p.x, 14, p.z, 0, YAW);
  const face = (across: number) => ({ x: p.x - UZ * across, z: p.z + UX * across });
  const apronFace = face(-30.4), landFace = face(30.4);
  b.box('glass', apronFace.x, 7.5, apronFace.z, 320, 9, .6, YAW);
  b.box('glass', landFace.x, 6.5, landFace.z, 300, 7, .6, YAW);
  b.box('stone', landFace.x, 12.2, landFace.z, 310, .8, 14, YAW);
  for (let i = -2; i <= 2; i++) {
    const pier = { x: p.x + UX * (i * 66) - UZ * -58, z: p.z + UZ * (i * 66) + UX * -58 };
    b.box('white', pier.x, 6, pier.z, 9, 5, 58, YAW);
    b.box('steel', pier.x, 9.2, pier.z, 7, 1.4, 56, YAW);
  }
  // Kerbside road and canopy on the landside, then the stub that leaves for the city.
  const kerb = face(46), gate = latLonToWorld(CITY_GATE.lat, CITY_GATE.lon);
  b.box('dark', kerb.x, PAVE_Y, kerb.z, 330, .5, 26, YAW);
  ribbon(b, 'dark', kerb, gate, 22, PAVE_Y, .5);
  ribbon(b, 'gold', kerb, gate, .7, MARK_Y, .08);
}

function tower(b: GeometryBatch): void {
  const p = latLonToWorld(TOWER.lat, TOWER.lon);
  b.box('stone', p.x, .6, p.z, 26, 1.2, 26, YAW);
  b.cylinder('white', p.x, 17, p.z, 4.2, 6, 34, 12);
  b.cylinder('stone', p.x, 34.4, p.z, 8.5, 7, 2.4, 12);
  b.cylinder('glass', p.x, 38.2, p.z, 8.2, 8.8, 5.2, 12);
  b.cylinder('dark', p.x, 41.4, p.z, 7.6, 9, 1.6, 12);
  b.cylinder('steel', p.x, 46, p.z, .18, .3, 8, 6);
  b.sphere('light', p.x, 50.4, p.z, .7);
}

function apron(b: GeometryBatch): void {
  slab(b, 'stone', 326, APRON_ACROSS, 760, 340, PAVE_Y, .5);
  // Stand lead-in lines fan off the apron taxilane toward the terminal face.
  for (let i = -4; i <= 4; i++) {
    slab(b, 'gold', 326 + i * 74, APRON_ACROSS + 40, 1, 150, MARK_Y, .08);
    slab(b, 'gold', 326 + i * 74, APRON_ACROSS - 60, 60, 1, MARK_Y, .08);
  }
  slab(b, 'gold', 326, APRON_ACROSS - 130, 720, .9, MARK_Y, .08);
  for (let i = -3; i <= 3; i++) {
    const p = at(326 + i * 110, APRON_ACROSS - 140);
    b.cylinder('steel', p.x, 11, p.z, .35, .6, 22, 6);
    b.box('light', p.x, 22.6, p.z, 3.4, 1.2, 1.6, YAW);
  }
  for (const along of [-500, -260]) {
    const p = at(along, 520);
    b.box('steel', p.x, 7, p.z, 120, 14, 70, YAW);
    b.add(new CylinderGeometry(35, 35, 118, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, .32, 1), 'stone', p.x, 14, p.z, 0, YAW);
    b.box('dark', p.x, 5, p.z, 118, 10, .6, YAW);
  }
  for (let i = 0; i < 4; i++) {
    const p = at(700 + (i % 2) * 34, 560 + Math.floor(i / 2) * 34);
    b.cylinder('white', p.x, 6, p.z, 11, 11, 12, 12);
    b.cylinder('stone', p.x, 12.4, p.z, 11.4, 11.4, .8, 12);
  }
}

export function createAirport(): Group {
  const flat = new GeometryBatch(), built = new GeometryBatch();
  runway(flat); taxiways(flat); apron(flat);
  terminal(built); tower(built);
  const group = new Group();
  group.name = 'Aeroporto Internacional Eduardo Gomes — pista 10/28';
  // Pavement is 2.7 km of flat quad: casting shadows from it only bloats the shadow frustum.
  const ground = flat.build('airport-pavement');
  ground.traverse(object => { if (object instanceof Mesh) object.castShadow = false; });
  group.add(ground, built.build('airport-structures'));
  return group;
}

/** Inverse of `at`, so a surveyed point can be re-used as the anchor of a runway aligned block. */
function frame(point: { x: number; z: number }): { along: number; across: number } {
  const dx = point.x - MID_X, dz = point.z - MID_Z;
  return { along: dx * UX + dz * UZ, across: dz * UX - dx * UZ };
}

function colliders(): WorldBox[] {
  const out: WorldBox[] = [];
  const cos = Math.abs(Math.cos(YAW)), sin = Math.abs(Math.sin(YAW));
  // Colliders are axis aligned, so every yawed block widens to its hull on the world axes.
  const push = (along: number, across: number, y: number, length: number, width: number, height: number) => {
    const p = at(along, across);
    out.push({ x: p.x, y, z: p.z, width: length * cos + width * sin, height, depth: length * sin + width * cos });
  };
  const hall = frame(latLonToWorld(TERMINAL.lat, TERMINAL.lon));
  // Six short blocks instead of one long one: a yawed hull 340 m long would swallow the apron.
  for (let i = -2.5; i <= 2.5; i++) {
    push(hall.along + i * 57, hall.across, 7.5, 58, 58, 15);
    push(hall.along + i * 57, hall.across, 18.5, 58, 58, 9);
  }
  for (let i = -2; i <= 2; i++) push(hall.along + i * 66, hall.across - 58, 6, 9, 58, 12);
  for (const along of [-500, -260]) push(along, 520, 9, 120, 70, 18);
  const mast = latLonToWorld(TOWER.lat, TOWER.lon);
  out.push({ x: mast.x, y: 17, z: mast.z, width: 12, height: 34, depth: 12 });
  out.push({ x: mast.x, y: 38.6, z: mast.z, width: 18, height: 9, depth: 18 });
  return out;
}

function reservations(): WorldDisc[] {
  const out: WorldDisc[] = [];
  // Overlapping discs along the strip: no procedural block may land on the runway or its taxiways.
  for (let along = -HALF; along <= HALF; along += 250) out.push({ ...at(along, 0), radius: 210 });
  for (let along = -HALF + 120; along <= HALF - 120; along += 400) out.push({ ...at(along, TAXI_A), radius: 180 });
  for (let i = -2; i <= 2; i++) out.push({ ...at(326 + i * 180, APRON_ACROSS), radius: 230 });
  out.push({ ...at(-380, 520), radius: 200 });
  return out;
}

export const AIRPORT_COLLIDERS: readonly WorldBox[] = colliders();
export const AIRPORT_RESERVATIONS: readonly WorldDisc[] = reservations();
