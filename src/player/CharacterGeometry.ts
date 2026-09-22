import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, TorusGeometry, Uint16BufferAttribute } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Metres, feet at zero. The same two draws are shared by the hero and his echoes.
export const HUMAN_RIG = { height: 2.07, shoulderX: .275, shoulderY: 1.64, elbowY: 1.33, wristY: 1.035, hipX: .112, hipY: 1.035, kneeY: .545 } as const;
type Ring = [y: number, width: number, depth: number, x?: number, z?: number];
type Weight = (y: number) => [number, number, number];
const rigid = (bone: number): Weight => () => [bone, bone, 0];
const joint = (upper: number, lower: number, height: number, band: number): Weight => y => {
  const t = Math.max(0, Math.min(1, (height + band - y) / (2 * band)));
  return [upper, lower, t * t * (3 - 2 * t)];
};

/** Contoured anatomy, tapering limbs and articulated hands; no separate ball-shaped joints. */
export function createCharacterGeometry(): { skin: BufferGeometry; accents: BufferGeometry } {
  const pieces: BufferGeometry[] = [];
  const weighted = (geometry: BufferGeometry, weights: Weight) => {
    const p = geometry.getAttribute('position'), indices = new Uint16Array(p.count * 4), values = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const [a, b, blend] = weights(p.getY(i));
      indices[i * 4] = a; indices[i * 4 + 1] = b; values[i * 4] = 1 - blend; values[i * 4 + 1] = blend;
    }
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(values, 4));
    geometry.deleteAttribute('uv');
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    if (plain !== geometry) geometry.dispose();
    pieces.push(plain);
  };
  // Interpolating the cross-sections gives the ribcage, calf, jaw and deltoid a smooth contour.
  const loft = (rings: Ring[], weights: Weight, segments = 20, face = false) => {
    const rows: number[][] = [];
    const sample = (r: Ring, k: number) => r[k] ?? 0;
    for (let i = 0; i < rings.length - 1; i++) for (let step = 0; step < 3; step++) {
      const t = step / 3, row: number[] = [];
      for (let k = 0; k < 5; k++) {
        const a = sample(rings[Math.max(0, i - 1)], k), b = sample(rings[i], k), c = sample(rings[i + 1], k), d = sample(rings[Math.min(rings.length - 1, i + 2)], k);
        row[k] = k === 0 ? b + (c - b) * t : .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
      }
      rows.push(row);
    }
    rows.push(Array.from({length:5}, (_,k)=>sample(rings[rings.length-1],k)));
    const positions: number[] = [], indices: number[] = [];
    for (const row of rows) for (let s = 0; s < segments; s++) {
      const angle = s / segments * Math.PI * 2, y = row[0];
      let z = (row[4] ?? 0) + Math.sin(angle) * Math.max(.0005, row[2]);
      // Front faces -Z: a nose bridge and lips define a human profile.
      if (face && Math.sin(angle) < 0) {
        const centre = Math.pow(Math.max(0, -Math.sin(angle)), 28);
        z -= centre * (.034 * Math.exp(-(((y - 1.922) / .029) ** 2)) + .008 * Math.exp(-(((y - 1.872) / .012) ** 2)));
      }
      positions.push((row[3] ?? 0) + Math.cos(angle) * Math.max(.0005, row[1]), y, z);
    }
    for (let r = 0; r < rows.length - 1; r++) for (let s = 0; s < segments; s++) {
      const a = r * segments + s, b = r * segments + (s + 1) % segments, c = a + segments, d = b + segments;
      indices.push(a, c, b, b, c, d);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); weighted(geometry, weights);
  };
  loft([
    [.93, .075, .067], [.97, .15, .103], [1.045, .184, .127, 0, .008], [1.12, .177, .12],
    [1.23, .153, .103], [1.32, .17, .119], [1.43, .222, .14, 0, -.007], [1.52, .245, .142, 0, -.006],
    [1.61, .25, .12], [1.665, .226, .092], [1.70, .148, .081], [1.74, .073, .064],
    [1.80, .064, .061], [1.835, .054, .055], [1.844, .002, .002],
  ], rigid(0), 28);
  loft([
    [1.789, .012, .018, 0, -.035], [1.817, .047, .063, 0, -.022], [1.845, .069, .075, 0, -.008],
    [1.88, .083, .084], [1.925, .092, .09], [1.965, .091, .094, 0, .002],
    [2.015, .089, .091, 0, .005], [2.051, .062, .067, 0, .005], [2.069, .002, .002, 0, .003],
  ], rigid(0), 32, true);
  for (const [side, arm, forearm, hand, thigh, shin] of [[-1, 1, 5, 9, 3, 7], [1, 2, 6, 10, 4, 8]]) {
    const x = (n: number) => side * n;
    weighted(new IcosahedronGeometry(1, 2).scale(.013, .028, .019).translate(x(.094), 1.914, .001), rigid(0));
    const armWeights: Weight = y => y < 1.09 ? joint(forearm, hand, HUMAN_RIG.wristY, .035)(y) : joint(arm, forearm, HUMAN_RIG.elbowY, .055)(y);
    loft([
      [1.005, .032, .03, x(.315), -.02], [1.055, .033, .034, x(.315), -.016],
      [1.15, .048, .047, x(.313), -.009], [1.23, .062, .057, x(.308), -.008],
      [1.32, .048, .052, x(.305), -.007], [1.37, .061, .065, x(.302)],
      [1.46, .077, .077, x(.295)], [1.56, .083, .081, x(.283)],
      [1.615, .079, .073, x(.265)], [1.65, .055, .041, x(.233)], [1.669, .002, .002, x(.20)],
    ], armWeights);
    loft([[.923, .032, .019, x(.321), -.021], [.95, .041, .024, x(.32), -.023], [1.01, .036, .023, x(.317), -.021], [1.047, .025, .025, x(.315), -.018]], rigid(hand), 16);
    // Four distinct fingers and a splayed thumb, batched into the same skin draw.
    for (let f = 0; f < 4; f++) {
      const fx = x(.292 + f * .019), tip = .849 + [.014, 0, .008, .025][f];
      loft([[tip, .002, .003, fx, -.028], [tip + .012, .008, .008, fx, -.031], [.912, .009, .009, fx, -.027], [.95, .01, .01, fx, -.022]], rigid(hand), 8);
    }
    loft([[.924, .002, .003, x(.264), -.048], [.934, .01, .01, x(.262), -.047], [.97, .013, .013, x(.272), -.036], [1.009, .016, .014, x(.295), -.024]], rigid(hand), 10);
    loft([
      [.105, .037, .044, x(.112), .018], [.18, .043, .048, x(.112), .015], [.28, .06, .067, x(.114), .024],
      [.365, .072, .074, x(.115), .024], [.46, .058, .057, x(.112), -.002], [.535, .061, .065, x(.112), -.016],
      [.60, .073, .076, x(.115), -.009], [.72, .093, .094, x(.116)], [.85, .101, .108, x(.111), .006],
      [.96, .1, .105, x(.102), .011], [1.04, .077, .079, x(.099), .007], [1.082, .008, .008, x(.097)],
    ], joint(thigh, shin, HUMAN_RIG.kneeY, .065), 22);
    loft([[.015, .032, .076, x(.112), -.071], [.028, .051, .136, x(.112), -.059], [.061, .052, .134, x(.112), -.06], [.093, .047, .102, x(.112), -.027], [.132, .039, .06, x(.112), .008], [.166, .025, .034, x(.112), .016]], rigid(shin), 20);
  }
  const skin = mergeGeometries(pieces)!; pieces.forEach(g => g.dispose()); skin.computeBoundingBox(); skin.computeBoundingSphere();
  const ornaments: BufferGeometry[] = [];
  const tint = (geometry: BufferGeometry, color: Color) => {
    const colors = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i);
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); geometry.deleteAttribute('uv');
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    if (plain !== geometry) geometry.dispose(); ornaments.push(plain);
  };
  for (const side of [-1, 1]) tint(new IcosahedronGeometry(1, 1).scale(.021, .005, .006).translate(side * .04, 1.947, -.084), new Color().setRGB(2.3, 3.5, 3.8));
  tint(new TorusGeometry(.031, .0025, 4, 20, Math.PI * 1.5).rotateZ(.5).translate(0, 1.51, -.149), new Color('#bda674'));
  const accents = mergeGeometries(ornaments)!; ornaments.forEach(g => g.dispose());
  return { skin, accents };
}
