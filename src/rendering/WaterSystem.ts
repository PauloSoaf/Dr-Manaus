import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial,
  PlaneGeometry, ShapeUtils, Vector2, IcosahedronGeometry, TorusGeometry,
  MeshBasicMaterial, InstancedMesh, Object3D, Vector3,
} from 'three/webgpu';
import {
  attribute, cameraPosition, color, float, mix, normalWorld, positionLocal, positionWorld,
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
const EDGE_NEAR = 95, EDGE_FAR = 560;
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
    const depthA = Math.max(0.12, RIVER_Y - manausBathymetry.sampleRiverbedHeight(ax, az));
    const depthB = Math.max(0.12, RIVER_Y - manausBathymetry.sampleRiverbedHeight(bx, bz));
    const depthC = Math.max(0.12, RIVER_Y - manausBathymetry.sampleRiverbedHeight(cx, cz));
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
 * - DoubleSide + shallow water translucency so the 3D excavated riverbed is visible through shallow water
 *   and the overhead water surface remains visible when diving underwater
 * - True Rio Negro "Água Preta" Beer-Lambert optical absorption & Solimões sediment scattering
 */
function createMaterial(uTurbidityScale: ReturnType<typeof uniform<'float'>>): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    roughness: .18,
    metalness: .12,
    color: '#080605',
    side: DoubleSide,
    transparent: true,
  });
  const shore = attribute('shore', 'float');
  const silt = attribute('muddy', 'float');
  const geomDepth = attribute('depth', 'float');

  const p = positionLocal;
  const distant = smoothstep(250, 5000, cameraPosition.distance(positionWorld));
  const near = float(1).sub(distant);

  // Gerstner Wave 1: Primary gentle downstream river drift (Rio Negro / Solimões flow)
  const phase1 = dot(vec2(p.x, p.z), vec2(0.82, 0.57)).mul(0.224).sub(time.mul(0.65));
  const wave1 = sin(phase1).mul(0.035);

  // Gerstner Wave 2: Secondary gentle river fairway ripple
  const phase2 = dot(vec2(p.x, p.z), vec2(0.60, 0.80)).mul(0.448).sub(time.mul(0.85));
  const wave2 = sin(phase2).mul(0.022);

  // Gerstner Wave 3: Surface capillary river ripple
  const phase3 = dot(vec2(p.x, p.z), vec2(0.95, 0.31)).mul(0.966).sub(time.mul(1.10));
  const wave3 = sin(phase3).mul(0.014);

  // Gerstner Wave 4: Fine capillary surface tension (attenuated with distance)
  const phase4 = dot(vec2(p.x, p.z), vec2(0.45, 0.89)).mul(2.24).sub(time.mul(1.40));
  const wave4 = sin(phase4).mul(0.007).mul(near);

  const totalElevation = wave1.add(wave2).add(wave3).add(wave4);

  // Shoreline wave attenuation: waves smoothly dampen to zero within 25m of the bank (shore <= 0.01)
  // so ripples never intersect or clip through the ground elevation at Y = 0.
  const waveDamp = smoothstep(0.01, 0.25, shore);
  material.positionNode = positionLocal.add(vec3(0, totalElevation.mul(waveDamp), 0));

  // Schlick-Fresnel Specular Reflectance
  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const cosTheta = normalWorld.dot(viewDir).abs();
  const fresnel = float(1).sub(cosTheta).pow(5);

  // Physical Beer-Lambert Optical Depth Attenuation driven by real geometric riverbed depth:
  const depthM = geomDepth.mul(uTurbidityScale);

  // Red/amber wavelengths penetrate shallow blackwater, blue/green are absorbed rapidly by humic tannins:
  const transR = depthM.mul(-0.14).exp();

  // Translucent amber tea at shallow depths, graduating into obsidian abyss:
  const negroBed = color('#573619'); // Riverbed sand/gravel visible through shallow tea water
  const negroExtinct = color('#060504'); // Deep absorption abyss
  const negroTranslucent = mix(negroExtinct, negroBed, transR.mul(0.90));
  const negroWater = mix(negroTranslucent, negroExtinct, float(1).sub(transR));

  // Atmospheric sky reflection for authentic liquid sheen:
  const negroSkyReflect = color('#3c4756');
  const negroFinal = mix(negroWater, negroSkyReflect, fresnel.mul(0.70));

  // Rio Solimões: Suspended Clay Sediments (Muddy Ochre/Cafe-au-lait)
  const solimoesDeep = color('#584832'); // Muddy clay brown
  const solimoesShallow = color('#806c4e'); // Silty lighter margin
  const solimoesClayReflect = color('#b09c7a'); // Warm silty reflection
  const solimoesWater = mix(solimoesDeep, solimoesShallow, transR);
  const solimoesFinal = mix(solimoesWater, solimoesClayReflect, fresnel.mul(0.45));

  // Confluence mixing zone
  const riverColor = mix(negroFinal, solimoesFinal, silt);

  // Shoreline foam and shallow water brightness
  const foamWarp = sin(p.x.mul(0.08).add(time.mul(0.7))).mul(cos(p.z.mul(0.08).sub(time.mul(0.5))));
  const foamCoords = p.x.mul(0.25).add(p.z.mul(0.25)).add(foamWarp.mul(2.5));
  const foamNoise = sin(foamCoords.add(time.mul(1.2))).mul(sin(foamCoords.mul(1.7).sub(time.mul(0.8)))).abs();
  const shoreFoam = float(1).sub(smoothstep(0.01, 0.45, shore))
    .mul(foamNoise.mul(0.65).add(0.35))
    .mul(mix(float(0.58), float(0.18), distant));

  const foamColor = mix(color('#3a352d'), color('#b8a88a'), silt);
  const finalColor = mix(riverColor, foamColor, shoreFoam);

  material.colorNode = finalColor;
  // Physical translucency: shallow margins (0.15m..4.2m) reveal the actual 3D riverbed mesh beneath
  material.opacityNode = mix(float(0.34), float(0.96), smoothstep(0.15, 4.2, depthM));
  material.roughnessNode = mix(mix(float(0.12), float(0.38), silt), float(0.68), distant);

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

/**
 * Dedicated high-performance water impact particle engine:
 * - Vertical water spray & droplet bursts on water impacts
 * - Concentric expanding surface ripple rings along water surface
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
    radius: 0.3,
    maxRadius: 3.5,
    life: 0,
    duration: 2.0,
  }));
  private rippleCursor = 0;

  private readonly dropletMesh: InstancedMesh;
  private readonly rippleMesh: InstancedMesh;

  constructor(parent: Group) {
    this.group.name = 'water-impact-vfx';
    parent.add(this.group);

    const dropGeo = new IcosahedronGeometry(0.14, 1);
    const dropMat = new MeshBasicMaterial({
      color: 0xebf8ff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.dropletMesh = new InstancedMesh(dropGeo, dropMat, 128);
    this.dropletMesh.frustumCulled = false;

    const ringGeo = new TorusGeometry(1, 0.035, 4, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new MeshBasicMaterial({
      color: 0xdff0f8,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.rippleMesh = new InstancedMesh(ringGeo, ringMat, 32);
    this.rippleMesh.frustumCulled = false;

    this.group.add(this.dropletMesh);
    this.group.add(this.rippleMesh);

    this.dummy.position.set(0, -99999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < 128; i++) this.dropletMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = 0; i < 32; i++) this.rippleMesh.setMatrixAt(i, this.dummy.matrix);
    this.dropletMesh.instanceMatrix.needsUpdate = true;
    this.rippleMesh.instanceMatrix.needsUpdate = true;
  }

  createSplash(x: number, z: number, waterY: number = RIVER_Y, intensity = 1.0, upwardSpeed = 7.0): void {
    const count = Math.min(36, Math.max(12, Math.floor(16 * intensity)));
    for (let i = 0; i < count; i++) {
      const d = this.droplets[this.dropletCursor++ % 128];
      const angle = Math.random() * Math.PI * 2;
      const spread = 0.6 + Math.random() * 2.2 * Math.min(2.0, intensity);
      d.position.set(x + (Math.random() - 0.5) * 0.5, waterY + 0.08, z + (Math.random() - 0.5) * 0.5);
      d.velocity.set(
        Math.cos(angle) * spread,
        upwardSpeed * (0.6 + Math.random() * 0.8),
        Math.sin(angle) * spread
      );
      d.scale = (0.14 + Math.random() * 0.22) * Math.min(2.5, intensity);
      d.life = d.duration = 0.7 + Math.random() * 0.6;
    }
    this.createRipple(x, z, waterY, 1.2 * intensity, 4.5 * intensity, 1.8);
  }

  createRipple(x: number, z: number, waterY: number = RIVER_Y, startRadius = 0.4, maxRadius = 3.5, duration = 1.8): void {
    const r = this.ripples[this.rippleCursor++ % 32];
    r.position.set(x, waterY + 0.02, z);
    r.radius = startRadius;
    r.maxRadius = maxRadius;
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
        this.color.setRGB(0.87 * fade, 0.94 * fade, 0.97 * fade);
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

  setCameraUnderwater(underwater: boolean): void {
    this.rippleMesh.visible = !underwater;
  }

  dispose(): void {
    this.dropletMesh.geometry.dispose();
    (this.dropletMesh.material as MeshBasicMaterial).dispose();
    this.rippleMesh.geometry.dispose();
    (this.rippleMesh.material as MeshBasicMaterial).dispose();
    this.group.removeFromParent();
  }
}

export class WaterSystem {
  source?: WaterFile;
  readonly uTurbidityScale = uniform(1.0);
  readonly material = createMaterial(this.uTurbidityScale);
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

  public setCameraUnderwater(underwater: boolean): void {
    this.cameraUnderwater = underwater;
    this.vfx.setCameraUnderwater(underwater);
  }

  public createSplash(x: number, z: number, intensity = 1.0, upwardSpeed = 7.0): void {
    this.vfx.createSplash(x, z, this.surfaceY, intensity, upwardSpeed);
  }

  public createRipple(x: number, z: number, startRadius = 0.4, maxRadius = 3.5, duration = 1.8): void {
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

  setNight(night: boolean) { this.material.emissive = new Color(night ? '#030507' : '#000000'); }
}
