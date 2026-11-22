import {
  BackSide, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial,
  PlaneGeometry, ShapeUtils, SphereGeometry, Vector2, IcosahedronGeometry, TorusGeometry,
  MeshBasicMaterial, InstancedMesh, Object3D, Vector3,
} from 'three/webgpu';
import {
  attribute, cameraPosition, color, float, mix, positionLocal, positionWorld,
  sin, cos, smoothstep, time, dot, uniform, vec2, vec3,
} from 'three/tsl';
import { SurfaceFrameService } from '../world/spatial/SurfaceFrameService';
import { localManausPresentationMode } from '../world/spatial/ManausSurfacePresentation';
import {
  sampleManausWater, WaterSurfaceSample, WaterBuoyancyService, MANAUS_RIVER_WAVES
} from '../world/water/ManausHydrology';
import { manausBathymetry } from '../world/water/ManausBathymetry';

const surfaceService = new SurfaceFrameService('earth');

/** The compiled river polygons, as `scripts/geodata/compile-real-city.mjs` writes them. */
export interface WaterPolygon {
  class: string;
  name: string | null;
  /** Overture names only the waterway centrelines, so the compiler derives the Solimões flag. */
  muddy: boolean;
  /** Flat `x,z` pairs in world metres; ring 0 is the bank and the rest are islands. */
  rings: number[][];
}
export interface WaterFile {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  solimoes: number[];
  polygons: WaterPolygon[];
}
/**
 * The real river is painted just over the generalized land plate instead of under it: the polygons
 * are the true bank, so wherever the two disagree the river has to win. Roads start at y = .22, and
 * the surface is dead flat, so nothing here can ever reach a riverside avenue.
 */
const RIVER_Y = .12;
/** The stand-in plane sits safely above the -3.5m subterranean backdrop so fallback water is never occluded. */
const FALLBACK_Y = -0.2;
/** Width of the lighter band along the bank, and the cell that indexes the bank segments. */
const SHORE_BAND = 140, SHORE_CELL = 150;
/** Triangle size target: fine enough to carry the band at the bank, coarse in open water. */
const EDGE_NEAR = 56, EDGE_FAR = 260;
/** A hard ceiling so a malformed ring can never subdivide the browser into a stall. */
const MAX_TRIANGLES = 260000;
const FALLBACK_SIZE = 90000;

function baseUrl(): string {
  try {
    const url = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
    return typeof url === 'string' ? url : '/';
  } catch { return '/'; }
}

function clamp(value: number, min: number, max: number): number { return value < min ? min : value > max ? max : value; }

/**
 * Every mesh vertex needs its distance to the nearest bank, and the banks are ~60k segments, so a
 * uniform grid at the band width turns each query into a 3x3 cell scan instead of a full sweep.
 */
class ShoreField {
  private readonly cells = new Map<number, number[]>();
  private readonly segments: number[] = [];
  add(ax: number, az: number, bx: number, bz: number): void {
    const index = this.segments.length;
    this.segments.push(ax, az, bx, bz);
    const fromX = Math.floor(Math.min(ax, bx) / SHORE_CELL), toX = Math.floor(Math.max(ax, bx) / SHORE_CELL);
    const fromZ = Math.floor(Math.min(az, bz) / SHORE_CELL), toZ = Math.floor(Math.max(az, bz) / SHORE_CELL);
    for (let cx = fromX; cx <= toX; cx++) for (let cz = fromZ; cz <= toZ; cz++) {
      const key = (cx + 512) * 4096 + (cz + 512);
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(index); else this.cells.set(key, [index]);
    }
  }
  /** Distance to the nearest bank, saturating at `SHORE_BAND` where the band no longer matters. */
  distance(x: number, z: number): number {
    const cx = Math.floor(x / SHORE_CELL), cz = Math.floor(z / SHORE_CELL);
    let best = SHORE_BAND * SHORE_BAND;
    for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const bucket = this.cells.get((ix + 512) * 4096 + (iz + 512));
      if (!bucket) continue;
      for (const index of bucket) {
        const ax = this.segments[index], az = this.segments[index + 1];
        const dx = this.segments[index + 2] - ax, dz = this.segments[index + 3] - az;
        const span = dx * dx + dz * dz;
        const t = span > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / span, 0, 1) : 0;
        const ox = ax + dx * t - x, oz = az + dz * t - z;
        const d = ox * ox + oz * oz;
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  }
}

interface Surface { position: number[]; normal: number[]; shore: number[]; muddy: number[]; depth: number[]; triangles: number }

/**
 * Longest-edge bisection down to a target that follows the distance to the bank. The surface is
 * dead flat, so the T-junctions this leaves cannot open a crack: they only soften the band's
 * interpolation, which is invisible, and in exchange the open river costs almost no triangles.
 */
function subdivide(out: Surface, field: ShoreField, stack: number[], silt: number): void {
  while (stack.length) {
    const d2 = stack.pop() ?? 0, z2 = stack.pop() ?? 0, x2 = stack.pop() ?? 0;
    const d1 = stack.pop() ?? 0, z1 = stack.pop() ?? 0, x1 = stack.pop() ?? 0;
    const d0 = stack.pop() ?? 0, z0 = stack.pop() ?? 0, x0 = stack.pop() ?? 0;
    const ab = (x1 - x0) ** 2 + (z1 - z0) ** 2;
    const bc = (x2 - x1) ** 2 + (z2 - z1) ** 2;
    const ca = (x0 - x2) ** 2 + (z0 - z2) ** 2;
    // Rotate the corners so the longest edge is always the first one; the split is then a single case.
    let ax = x0, az = z0, da = d0, bx = x1, bz = z1, db = d1, cx = x2, cz = z2, dc = d2, longest = ab;
    if (bc > longest) { longest = bc; ax = x1; az = z1; da = d1; bx = x2; bz = z2; db = d2; cx = x0; cz = z0; dc = d0; }
    if (ca > longest) { longest = ca; ax = x2; az = z2; da = d2; bx = x0; bz = z0; db = d0; cx = x1; cz = z1; dc = d1; }
    // Below the finest target no shore distance can force a split, so the bank slivers earcut
    // leaves behind skip the query entirely; that is most of the triangles in the whole river.
    if (longest > EDGE_NEAR * EDGE_NEAR && out.triangles < MAX_TRIANGLES) {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const dm = field.distance(mx, mz);
      const target = EDGE_NEAR + (EDGE_FAR - EDGE_NEAR) * Math.min(1, dm / SHORE_BAND);
      if (longest > target * target) {
        stack.push(ax, az, da, mx, mz, dm, cx, cz, dc);
        stack.push(mx, mz, dm, bx, bz, db, cx, cz, dc);
        continue;
      }
    }
    // Earcut keeps the source ring's winding, which is not ours to trust, so face the sky explicitly.
    if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) < 0) {
      const sx = bx, sz = bz, sd = db;
      bx = cx; bz = cz; db = dc; cx = sx; cz = sz; dc = sd;
    }
    if (localManausPresentationMode() === 'curved') {
      const pa = surfaceService.legacyPointToRenderLocal(ax, RIVER_Y, az);
      const pb = surfaceService.legacyPointToRenderLocal(bx, RIVER_Y, bz);
      const pc = surfaceService.legacyPointToRenderLocal(cx, RIVER_Y, cz);
      const na = surfaceService.legacyDirectionToRenderLocal(0, 1, 0, ax, RIVER_Y, az).normalize();
      const nb = surfaceService.legacyDirectionToRenderLocal(0, 1, 0, bx, RIVER_Y, bz).normalize();
      const nc = surfaceService.legacyDirectionToRenderLocal(0, 1, 0, cx, RIVER_Y, cz).normalize();
      out.position.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, pc.x, pc.y, pc.z);
      out.normal.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
    } else {
      out.position.push(ax, RIVER_Y, az, bx, RIVER_Y, bz, cx, RIVER_Y, cz);
      out.normal.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
    out.shore.push(da / SHORE_BAND, db / SHORE_BAND, dc / SHORE_BAND);
    out.muddy.push(silt, silt, silt);
    const depthA = Math.max(0.25 + da * 0.16, RIVER_Y - manausBathymetry.sampleRiverbedHeight(ax, az));
    const depthB = Math.max(0.25 + db * 0.16, RIVER_Y - manausBathymetry.sampleRiverbedHeight(bx, bz));
    const depthC = Math.max(0.25 + dc * 0.16, RIVER_Y - manausBathymetry.sampleRiverbedHeight(cx, cz));
    out.depth.push(depthA, depthB, depthC);
    out.triangles++;
  }
}

/** triangulateShape calls `equals` on its input, so the ring really has to be Vector2 instances. */
function toPoints(ring: number[]): Vector2[] {
  const points: Vector2[] = [];
  for (let i = 0; i < ring.length; i += 2) points.push(new Vector2(ring[i], ring[i + 1]));
  return points;
}

function buildSurface(file: WaterFile): BufferGeometry | null {
  manausBathymetry.registerWaterFile(file);
  const field = new ShoreField();
  for (const polygon of file.polygons) for (const ring of polygon.rings) {
    const count = ring.length / 2;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      field.add(ring[i * 2], ring[i * 2 + 1], ring[j * 2], ring[j * 2 + 1]);
    }
  }
  const out: Surface = { position: [], normal: [], shore: [], muddy: [], depth: [], triangles: 0 };
  const stack: number[] = [];
  for (const polygon of file.polygons) {
    if (!polygon.rings.length) continue;
    const contour = toPoints(polygon.rings[0]);
    const holes = polygon.rings.slice(1).map(toPoints);
    if (contour.length < 3) continue;
    // triangulateShape trims duplicate end points in place, so the index base is read back after it.
    const faces = ShapeUtils.triangulateShape(contour, holes);
    const points = holes.length ? contour.concat(...holes) : contour;
    const silt = polygon.muddy ? 1 : 0;
    for (const face of faces) {
      const a = points[face[0]], b = points[face[1]], c = points[face[2]];
      if (!a || !b || !c) continue;
      stack.push(a.x, a.y, 0, b.x, b.y, 0, c.x, c.y, 0);
      subdivide(out, field, stack, silt);
    }
  }
  if (!out.triangles) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(out.position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(out.normal, 3));
  geometry.setAttribute('shore', new Float32BufferAttribute(out.shore, 1));
  geometry.setAttribute('muddy', new Float32BufferAttribute(out.muddy, 1));
  geometry.setAttribute('depth', new Float32BufferAttribute(out.depth, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The 90 km plane the game shipped with, carrying the same attributes so one material serves
 * both surfaces.
 */
function fallbackSurface(): BufferGeometry {
  const geometry = new PlaneGeometry(FALLBACK_SIZE, FALLBACK_SIZE, 120, 120);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, FALLBACK_Y, 0);
  const position = geometry.getAttribute('position');
  const shore = new Float32Array(position.count).fill(1);
  const muddy = new Float32Array(position.count);
  const depth = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const vx = position.getX(i), vz = position.getZ(i);
    muddy[i] = clamp((vx - vz * .21 - 8700) / 700, 0, 1);
    const bedY = manausBathymetry.sampleRiverbedHeight(vx, vz);
    depth[i] = Math.max(0.12, RIVER_Y - bedY);
  }
  geometry.setAttribute('shore', new Float32BufferAttribute(shore, 1));
  geometry.setAttribute('muddy', new Float32BufferAttribute(muddy, 1));
  geometry.setAttribute('depth', new Float32BufferAttribute(depth, 1));
  return geometry;
}

function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  return (index ? index.count : geometry.getAttribute('position').count) / 3;
}

/**
 * Authentic Amazonian River TSL WebGPU/WebGL2 Material:
 * - Fed by true geometric riverbed depth attribute (`depth`) from ManausBathymetry
 * - 5-octave analytical per-pixel travelling wave normals (`material.normalNode`) so every pixel
 *   dynamically ripples, flows, and shimmers with moving Fresnel & solar wave highlights
 * - DoubleSide + underwater Snell's window ceiling when viewed from inside the water volume
 * - True Rio Negro "Água Preta" Beer-Lambert optical absorption & Solimões sediment scattering
 */
function createMaterial(
  uTurbidityScale: ReturnType<typeof uniform<'float'>>,
  uUnderwaterView: ReturnType<typeof uniform<'float'>>,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    roughness: .14,
    metalness: .16,
    color: '#06131c',
    side: DoubleSide,
    transparent: true,
  });
  const shore = attribute('shore', 'float');
  const silt = attribute('muddy', 'float');
  const geomDepth = attribute('depth', 'float');

  const p = positionLocal;
  const wp = positionWorld;
  const distToCam = cameraPosition.distance(wp);
  const distant = smoothstep(350, 5500, distToCam);
  const near = float(1).sub(distant);
  const microDetail = float(1).sub(smoothstep(45, 320, distToCam));

  // Shoreline wave attenuation: waves smoothly dampen near the bank so they never clip Y = 0
  const waveDamp = smoothstep(0.008, 0.18, shore);

  // 5-Octave Travelling River Waves (vertex displacement + analytical per-pixel fragment derivatives)
  const k1 = vec2(0.195, 0.135); // Primary downstream swell
  const phase1 = dot(vec2(p.x, p.z), k1).sub(time.mul(1.15));
  const wave1 = sin(phase1).mul(0.065);
  const c1 = cos(phase1).mul(0.22);

  const k2 = vec2(0.32, -0.26); // Cross-current diagonal wave
  const phase2 = dot(vec2(p.x, p.z), k2).sub(time.mul(1.65));
  const wave2 = sin(phase2).mul(0.042);
  const c2 = cos(phase2).mul(0.18);

  const k3 = vec2(-0.54, 0.68); // Medium fairway chop
  const phase3 = dot(vec2(p.x, p.z), k3).sub(time.mul(2.35));
  const wave3 = sin(phase3).mul(0.024);
  const c3 = cos(phase3).mul(0.15).mul(near);

  const k4 = vec2(1.45, 0.92); // Capillary surface ripples
  const phase4 = dot(vec2(p.x, p.z), k4).sub(time.mul(3.40));
  const wave4 = sin(phase4).mul(0.011).mul(near);
  const c4 = cos(phase4).mul(0.11).mul(near);

  const k5 = vec2(-2.65, 2.15); // Fine close-range liquid micro-shimmer
  const phase5 = dot(vec2(p.x, p.z), k5).add(time.mul(4.60));
  const c5 = cos(phase5).mul(0.075).mul(microDetail);

  const totalElevation = wave1.add(wave2).add(wave3).add(wave4);
  material.positionNode = positionLocal.add(vec3(0, totalElevation.mul(waveDamp), 0));

  // Per-pixel analytical wave slope derivatives (dH/dx, dH/dz) for living liquid normals
  const normalAmp = mix(float(0.35), float(1.0), waveDamp);
  const dHx = c1.mul(0.82).add(c2.mul(0.77)).add(c3.mul(-0.62)).add(c4.mul(0.84)).add(c5.mul(-0.78)).mul(normalAmp);
  const dHz = c1.mul(0.57).add(c2.mul(-0.63)).add(c3.mul(0.78)).add(c4.mul(0.54)).add(c5.mul(0.63)).mul(normalAmp);
  const waveNormal = vec3(dHx.negate(), float(1.0), dHz.negate()).normalize();
  material.normalNode = waveNormal;

  // Dynamic Schlick-Fresnel & Wave Crest Factor driven by animated per-pixel waveNormal
  const viewDir = cameraPosition.sub(wp).normalize();
  const cosTheta = waveNormal.dot(viewDir).abs();
  const fresnel = float(1).sub(cosTheta).pow(3.5);
  const waveCrest = smoothstep(-0.08, 0.16, dHx.add(dHz));

  // Travelling current streaks & sub-surface caustic ripple pattern
  const flowU = p.x.mul(0.11).add(p.z.mul(0.08)).sub(time.mul(0.95));
  const flowV = p.x.mul(-0.07).add(p.z.mul(0.13)).add(time.mul(0.72));
  const causticA = sin(flowU.add(sin(flowV).mul(1.6))).mul(cos(flowV.mul(1.4).sub(time.mul(1.1))));
  const causticPattern = smoothstep(0.15, 0.92, causticA.abs()).mul(near);

  // Physical Beer-Lambert Optical Depth Attenuation driven by real geometric riverbed depth:
  const depthM = geomDepth.mul(uTurbidityScale);
  const shallowFactor = float(1).sub(smoothstep(0.25, 3.8, depthM));

  // Rio Negro: Deep glossy dark-teal / obsidian-sapphire blackwater with warm amber tea only at shallow bank
  const negroDeep = color('#040d14'); // Deep dark aquatic abyss
  const negroMid = color('#0a1f2e'); // Mid-water blue-black body
  const negroCrest = color('#15374a'); // Dynamic wave crest highlight
  const negroShallowTea = color('#242218'); // Subtle humic tea tint right at the shallow <2m margin
  const negroSkyReflect = color('#487396'); // Animated sky reflection on wave facets

  const negroBody = mix(
    mix(negroDeep, negroMid, smoothstep(0.0, 0.7, waveCrest)),
    negroCrest,
    waveCrest.mul(0.55).add(causticPattern.mul(0.28)),
  );
  const negroDepthColored = mix(negroBody, negroShallowTea, shallowFactor.mul(0.55));
  const negroFinal = mix(negroDepthColored, negroSkyReflect, fresnel.mul(0.72));

  // Rio Solimões: Flowing alluvial Amazon current with high-contrast moving wave facets
  const solimoesTrough = color('#453624');
  const solimoesBody = color('#634f37');
  const solimoesCrest = color('#856d4e');
  const solimoesReflect = color('#b29e80');
  const solimoesWaves = mix(
    mix(solimoesTrough, solimoesBody, waveCrest),
    solimoesCrest,
    causticPattern.mul(0.45).add(waveCrest.mul(0.35)),
  );
  const solimoesFinal = mix(solimoesWaves, solimoesReflect, fresnel.mul(0.52));

  // Confluence mixing zone (Encontro das Águas)
  const surfaceRiverColor = mix(negroFinal, solimoesFinal, silt);

  // Shoreline organic foam & animated bank ripples
  const foamWarp = sin(p.x.mul(0.14).add(time.mul(1.1))).mul(cos(p.z.mul(0.14).sub(time.mul(0.85))));
  const foamCoords = p.x.mul(0.32).add(p.z.mul(0.32)).add(foamWarp.mul(2.2));
  const foamNoise = sin(foamCoords.add(time.mul(1.8))).mul(sin(foamCoords.mul(1.7).sub(time.mul(1.3)))).abs();
  const shoreFoam = float(1).sub(smoothstep(0.005, 0.22, shore))
    .mul(foamNoise.mul(0.70).add(0.30))
    .mul(mix(float(0.52), float(0.15), distant));

  const foamColor = mix(color('#3b5263'), color('#b8a88a'), silt);
  const topViewColor = mix(surfaceRiverColor, foamColor, shoreFoam);

  // Underwater Snell's window ceiling when looking up from inside the water volume
  const underwaterCeiling = mix(
    color('#0d3142'),
    color('#387e9c'),
    cosTheta.mul(0.65).add(causticPattern.mul(0.35)),
  );
  const finalColor = mix(topViewColor, underwaterCeiling, uUnderwaterView);

  material.colorNode = finalColor;
  // Translucent only at very shallow bank edges (0.2m..2.4m) or when looking up from underwater;
  // deep water stays rich and liquid (0.94..0.98) so the riverbed never turns the river into a flat brown sheet
  const topOpacity = mix(float(0.64), float(0.97), smoothstep(0.20, 2.4, depthM));
  material.opacityNode = mix(topOpacity, float(0.78), uUnderwaterView);
  material.roughnessNode = mix(mix(float(0.09), float(0.26), silt), float(0.48), distant);

  return material;
}

interface SplashDroplet {
  position: Vector3;
  velocity: Vector3;
  scale: number;
  life: number;
  duration: number;
}

interface SurfaceRipple {
  position: Vector3;
  radius: number;
  maxRadius: number;
  life: number;
  duration: number;
}

interface UnderwaterMote {
  offset: Vector3;
  speedY: number;
  phase: number;
  scale: number;
}

/**
 * Dedicated high-performance water impact & volumetric underwater medium engine:
 * - Vertical water spray & droplet bursts on water impacts
 * - Subtle concentric surface ripple rings (strictly hidden when camera is near/below water level)
 * - 3D Volumetric Underwater Optical Dome + 96 suspended aquatic sediment/bubble motes when submerged
 */
export class WaterVFX {
  private readonly group = new Group();
  private readonly dummy = new Object3D();
  private readonly color = new Color();

  private readonly droplets: SplashDroplet[] = Array.from({ length: 128 }, () => ({
    position: new Vector3(),
    velocity: new Vector3(),
    scale: 0.15,
    life: 0,
    duration: 1.0,
  }));
  private dropletCursor = 0;

  private readonly ripples: SurfaceRipple[] = Array.from({ length: 32 }, () => ({
    position: new Vector3(),
    radius: 0.25,
    maxRadius: 1.65,
    life: 0,
    duration: 1.4,
  }));
  private rippleCursor = 0;

  private readonly motes: UnderwaterMote[] = Array.from({ length: 96 }, (_, i) => ({
    offset: new Vector3(
      ((i * 73) % 100 - 50) * 0.24,
      ((i * 41) % 100 - 50) * 0.12,
      ((i * 89) % 100 - 50) * 0.24,
    ),
    speedY: 0.18 + (i % 7) * 0.06,
    phase: i * 0.77,
    scale: 0.025 + (i % 5) * 0.012,
  }));

  private readonly dropletMesh: InstancedMesh;
  private readonly rippleMesh: InstancedMesh;
  private readonly underwaterDome: Mesh;
  private readonly underwaterDomeMat: MeshBasicMaterial;
  private readonly underwaterMotesMesh: InstancedMesh;
  private readonly underwaterMotesMat: MeshBasicMaterial;

  constructor(parent: Group) {
    this.group.name = 'water-impact-vfx';
    parent.add(this.group);

    const dropGeo = new IcosahedronGeometry(0.11, 1);
    const dropMat = new MeshBasicMaterial({
      color: 0xc8e6f5,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.dropletMesh = new InstancedMesh(dropGeo, dropMat, 128);
    this.dropletMesh.frustumCulled = false;

    const ringGeo = new TorusGeometry(1, 0.016, 4, 36);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new MeshBasicMaterial({
      color: 0x5c859e,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    this.rippleMesh = new InstancedMesh(ringGeo, ringMat, 32);
    this.rippleMesh.frustumCulled = false;

    // 3D Volumetric Underwater Optical Medium Dome surrounding the camera when submerged
    const domeGeo = new SphereGeometry(1.6, 20, 16);
    this.underwaterDomeMat = new MeshBasicMaterial({
      color: 0x092634,
      side: BackSide,
      transparent: true,
      opacity: 0.52,
      depthTest: false,
      depthWrite: false,
    });
    this.underwaterDomeMat.fog = false;
    this.underwaterDome = new Mesh(domeGeo, this.underwaterDomeMat);
    this.underwaterDome.name = 'underwater-volumetric-medium';
    this.underwaterDome.renderOrder = 998;
    this.underwaterDome.frustumCulled = false;
    this.underwaterDome.visible = false;

    // 3D Suspended Underwater Aquatic Motes / Micro-Bubbles
    const moteGeo = new IcosahedronGeometry(1.0, 0);
    this.underwaterMotesMat = new MeshBasicMaterial({
      color: 0x62a8c4,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    this.underwaterMotesMesh = new InstancedMesh(moteGeo, this.underwaterMotesMat, 96);
    this.underwaterMotesMesh.name = 'underwater-suspended-motes';
    this.underwaterMotesMesh.frustumCulled = false;
    this.underwaterMotesMesh.visible = false;

    this.group.add(this.dropletMesh);
    this.group.add(this.rippleMesh);
    this.group.add(this.underwaterDome);
    this.group.add(this.underwaterMotesMesh);

    this.dummy.position.set(0, -99999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < 128; i++) this.dropletMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = 0; i < 32; i++) this.rippleMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = 0; i < 96; i++) this.underwaterMotesMesh.setMatrixAt(i, this.dummy.matrix);
    this.dropletMesh.instanceMatrix.needsUpdate = true;
    this.rippleMesh.instanceMatrix.needsUpdate = true;
    this.underwaterMotesMesh.instanceMatrix.needsUpdate = true;
  }

  createSplash(x: number, z: number, waterY: number = RIVER_Y, intensity = 1.0, upwardSpeed = 7.0): void {
    const count = Math.min(32, Math.max(10, Math.floor(14 * intensity)));
    for (let i = 0; i < count; i++) {
      const d = this.droplets[this.dropletCursor++ % 128];
      const angle = Math.random() * Math.PI * 2;
      const spread = 0.5 + Math.random() * 1.8 * Math.min(1.8, intensity);
      d.position.set(x + (Math.random() - 0.5) * 0.4, waterY + 0.06, z + (Math.random() - 0.5) * 0.4);
      d.velocity.set(
        Math.cos(angle) * spread,
        upwardSpeed * (0.55 + Math.random() * 0.75),
        Math.sin(angle) * spread
      );
      d.scale = (0.10 + Math.random() * 0.16) * Math.min(2.0, intensity);
      d.life = d.duration = 0.65 + Math.random() * 0.5;
    }
    this.createRipple(x, z, waterY, 0.35, Math.min(1.8, 1.15 * intensity), 1.35);
  }

  createRipple(x: number, z: number, waterY: number = RIVER_Y, startRadius = 0.3, maxRadius = 1.6, duration = 1.35): void {
    const r = this.ripples[this.rippleCursor++ % 32];
    r.position.set(x, waterY + 0.01, z);
    r.radius = Math.min(0.6, startRadius);
    r.maxRadius = Math.min(1.85, maxRadius);
    r.life = r.duration = duration;
  }

  update(dt: number, waterY: number = RIVER_Y): void {
    let updatedDroplets = false;
    for (let i = 0; i < 128; i++) {
      const d = this.droplets[i];
      if (d.life > 0) {
        d.life = Math.max(0, d.life - dt);
        d.velocity.y -= 18.0 * dt;
        d.position.addScaledVector(d.velocity, dt);

        if (d.position.y < waterY && d.velocity.y < 0) {
          d.life = 0;
        }

        if (d.life > 0) {
          this.dummy.position.copy(d.position);
          const currentScale = d.scale * (d.life / d.duration);
          this.dummy.scale.setScalar(currentScale);
        } else {
          this.dummy.position.set(0, -99999, 0);
          this.dummy.scale.setScalar(0);
        }
        this.dummy.updateMatrix();
        this.dropletMesh.setMatrixAt(i, this.dummy.matrix);
        updatedDroplets = true;
      }
    }
    if (updatedDroplets) this.dropletMesh.instanceMatrix.needsUpdate = true;

    let updatedRipples = false;
    for (let i = 0; i < 32; i++) {
      const r = this.ripples[i];
      if (r.life > 0) {
        r.life = Math.max(0, r.life - dt);
        const progress = 1.0 - (r.life / r.duration);
        const currentRadius = r.radius + (r.maxRadius - r.radius) * Math.sqrt(progress);

        this.dummy.position.copy(r.position);
        this.dummy.scale.set(currentRadius, 1, currentRadius);
        this.dummy.updateMatrix();
        this.rippleMesh.setMatrixAt(i, this.dummy.matrix);

        const fade = (r.life / r.duration);
        this.color.setRGB(0.32 * fade, 0.48 * fade, 0.58 * fade);
        this.rippleMesh.setColorAt(i, this.color);

        updatedRipples = true;
      } else {
        this.dummy.position.set(0, -99999, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.rippleMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }
    if (updatedRipples) {
      this.rippleMesh.instanceMatrix.needsUpdate = true;
      if (this.rippleMesh.instanceColor) this.rippleMesh.instanceColor.needsUpdate = true;
    }
  }

  updateUnderwaterMedium(
    underwater: boolean,
    camX: number,
    camY: number,
    camZ: number,
    waterY: number,
    riverType: 'rio-negro' | 'solimoes' | 'confluence' | 'land',
    clearDebugMode: boolean,
    timeSec: number,
  ): void {
    // Strictly hide surface ripple rings whenever camera is near or below water level so they never project into the sky
    this.rippleMesh.visible = !underwater && camY >= waterY + 0.65;

    this.underwaterDome.visible = underwater;
    this.underwaterMotesMesh.visible = underwater;
    if (!underwater) return;

    this.underwaterDome.position.set(camX, camY, camZ);
    const submergeDepth = Math.max(0, waterY - camY);
    const depthFactor = Math.min(1, submergeDepth / 18.0);

    if (clearDebugMode) {
      this.underwaterDomeMat.color.setHex(0x164458);
      this.underwaterDomeMat.opacity = 0.22;
      this.underwaterMotesMat.color.setHex(0x88d4f2);
    } else if (riverType === 'solimoes') {
      this.underwaterDomeMat.color.setRGB(
        0.26 * (1 - depthFactor * 0.55),
        0.20 * (1 - depthFactor * 0.55),
        0.12 * (1 - depthFactor * 0.55),
      );
      this.underwaterDomeMat.opacity = 0.48 + depthFactor * 0.22;
      this.underwaterMotesMat.color.setHex(0xb89c72);
    } else {
      // Authentic Rio Negro aquatic teal-amber medium with depth extinction
      this.underwaterDomeMat.color.setRGB(
        0.04 * (1 - depthFactor * 0.65),
        0.16 * (1 - depthFactor * 0.55),
        0.22 * (1 - depthFactor * 0.50),
      );
      this.underwaterDomeMat.opacity = 0.44 + depthFactor * 0.24;
      this.underwaterMotesMat.color.setHex(0x52a4c4);
    }

    // Animate 96 suspended 3D aquatic motes/bubbles around the submerged camera
    const bedY = manausBathymetry.sampleRiverbedHeight(camX, camZ);
    for (let i = 0; i < 96; i++) {
      const m = this.motes[i];
      const wx = camX + m.offset.x + Math.sin(timeSec * 0.8 + m.phase) * 0.65;
      const wz = camZ + m.offset.z + Math.cos(timeSec * 0.7 + m.phase) * 0.65;
      const cycleY = ((m.offset.y + timeSec * m.speedY + 6.0) % 8.0) - 4.0;
      const wy = clamp(camY + cycleY, bedY + 0.15, waterY - 0.12);
      this.dummy.position.set(wx, wy, wz);
      this.dummy.scale.setScalar(m.scale);
      this.dummy.updateMatrix();
      this.underwaterMotesMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.underwaterMotesMesh.instanceMatrix.needsUpdate = true;
  }

  setCameraUnderwater(underwater: boolean): void {
    this.rippleMesh.visible = !underwater;
    this.underwaterDome.visible = underwater;
    this.underwaterMotesMesh.visible = underwater;
  }

  dispose(): void {
    this.dropletMesh.geometry.dispose();
    (this.dropletMesh.material as MeshBasicMaterial).dispose();
    this.rippleMesh.geometry.dispose();
    (this.rippleMesh.material as MeshBasicMaterial).dispose();
    this.underwaterDome.geometry.dispose();
    this.underwaterDomeMat.dispose();
    this.underwaterMotesMesh.geometry.dispose();
    this.underwaterMotesMat.dispose();
    this.group.removeFromParent();
  }
}

export class WaterSystem {
  source?: WaterFile;
  readonly uTurbidityScale = uniform(1.0);
  readonly uUnderwaterView = uniform(0.0);
  readonly material = createMaterial(this.uTurbidityScale, this.uUnderwaterView);
  surfaceY = FALLBACK_Y;
  real = false;
  triangles = 0;
  polygonCount = 0;
  averageDepthM = 24.5;
  loadError: string | null = null;
  clearDebugMode = false;
  cameraUnderwater = false;
  private readonly mesh: Mesh;

  readonly buoyancy = new WaterBuoyancyService();
  readonly vfx: WaterVFX;

  get telemetry(): {
    real: boolean;
    polygonCount: number;
    triangles: number;
    fallbackActive: boolean;
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null;
    averageDepthM: number;
    surfaceY: number;
    clearDebugMode: boolean;
    cameraUnderwater: boolean;
    lastError: string | null;
  } {
    return {
      real: this.real,
      polygonCount: this.polygonCount,
      triangles: this.triangles,
      fallbackActive: !this.real,
      bounds: this.source?.bounds ?? null,
      averageDepthM: this.averageDepthM,
      surfaceY: this.surfaceY,
      clearDebugMode: this.clearDebugMode,
      cameraUnderwater: this.cameraUnderwater,
      lastError: this.loadError,
    };
  }

  constructor(root: Group) {
    this.mesh = new Mesh(fallbackSurface(), this.material);
    this.mesh.name = 'Rio Negro e Solimões';
    this.mesh.receiveShadow = true;
    this.triangles = triangleCount(this.mesh.geometry);
    root.add(this.mesh);
    this.vfx = new WaterVFX(root);
    manausBathymetry.setBaseSurfaceY(RIVER_Y);
  }

  public setClearDebugMode(enabled: boolean): void {
    this.clearDebugMode = enabled;
    this.uTurbidityScale.value = enabled ? 0.08 : 1.0;
  }

  public setCameraUnderwater(
    underwater: boolean,
    camX = 0,
    camY = 0,
    camZ = 0,
    riverType: 'rio-negro' | 'solimoes' | 'confluence' | 'land' = 'rio-negro',
    timeSec = 0,
  ): void {
    this.cameraUnderwater = underwater;
    this.uUnderwaterView.value = underwater ? 1.0 : 0.0;
    this.vfx.updateUnderwaterMedium(
      underwater,
      camX,
      camY,
      camZ,
      this.surfaceY,
      riverType,
      this.clearDebugMode,
      timeSec,
    );
  }

  public createSplash(x: number, z: number, intensity = 1.0, upwardSpeed = 7.0): void {
    this.vfx.createSplash(x, z, this.surfaceY, intensity, upwardSpeed);
  }

  public createRipple(x: number, z: number, startRadius = 0.3, maxRadius = 1.6, duration = 1.35): void {
    this.vfx.createRipple(x, z, this.surfaceY, startRadius, maxRadius, duration);
  }

  public sampleHeight(x: number, z: number, timeSec: number, out?: WaterSurfaceSample): WaterSurfaceSample {
    const shoreDist = Math.max(0, manausBathymetry.sampleSignedShoreDistance(x, z));
    return sampleManausWater(x, z, timeSec, this.surfaceY, out, shoreDist);
  }

  public sampleDepth(x: number, z: number, timeSec: number): number {
    return manausBathymetry.sampleWaterDepth(x, z, timeSec);
  }

  public update(dt: number, timeSec: number): void {
    this.buoyancy.update(dt, timeSec, this.surfaceY);
    this.vfx.update(dt, this.surfaceY);
  }

  async initialize(): Promise<void> {
    try {
      const response = await fetch(`${baseUrl()}geodata/real-city/water.json`, { cache: 'no-cache' });
      if (!response.ok) {
        this.loadError = `HTTP ${response.status} loading water.json`;
        console.warn(`[WaterSystem] ${this.loadError} - fallback plane active`);
        return;
      }
      const file = (await response.json()) as WaterFile;
      if (!file?.polygons?.length) {
        this.loadError = 'Empty polygons in water.json';
        console.warn(`[WaterSystem] ${this.loadError} - fallback plane active`);
        return;
      }
      const geometry = buildSurface(file);
      if (!geometry) {
        this.loadError = 'Triangulation failed for water polygons';
        console.warn(`[WaterSystem] ${this.loadError} - fallback plane active`);
        return;
      }
      this.mesh.geometry.dispose();
      this.mesh.geometry = geometry;
      this.triangles = triangleCount(geometry);
      this.polygonCount = file.polygons.length;
      this.surfaceY = RIVER_Y;
      this.real = true;
      this.source = file;
      this.loadError = null;
      manausBathymetry.setBaseSurfaceY(this.surfaceY);
    } catch (err) {
      this.real = false;
      this.loadError = err instanceof Error ? err.message : String(err);
      console.warn(`[WaterSystem] Load exception: ${this.loadError} - fallback plane active`);
    }
  }

  setNight(night: boolean) { this.material.emissive = new Color(night ? '#03080d' : '#000000'); }
}
