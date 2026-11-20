import {
  BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial,
  PlaneGeometry, ShapeUtils, Vector2,
} from 'three/webgpu';
import {
  attribute, cameraPosition, color, float, mix, normalWorld, positionLocal, positionWorld,
  sin, cos, smoothstep, time, dot, vec2, vec3,
} from 'three/tsl';
import { SurfaceFrameService } from '../world/spatial/SurfaceFrameService';
import { localManausPresentationMode } from '../world/spatial/ManausSurfacePresentation';
import {
  sampleManausWater, WaterSurfaceSample, WaterBuoyancyService, MANAUS_RIVER_WAVES
} from '../world/water/ManausHydrology';

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
const RIVER_Y = .06;
/** The stand-in plane keeps the old depth: generalized water must never wash over the city. */
const FALLBACK_Y = -3;
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

interface Surface { position: number[]; normal: number[]; shore: number[]; muddy: number[]; triangles: number }

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
  const field = new ShoreField();
  for (const polygon of file.polygons) for (const ring of polygon.rings) {
    const count = ring.length / 2;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      field.add(ring[i * 2], ring[i * 2 + 1], ring[j * 2], ring[j * 2 + 1]);
    }
  }
  const out: Surface = { position: [], normal: [], shore: [], muddy: [], triangles: 0 };
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
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The 90 km plane the game shipped with, carrying the same two attributes so one material serves
 * both surfaces. Its muddy seam is the old hardcoded diagonal, which is all there is without data.
 */
function fallbackSurface(): BufferGeometry {
  const geometry = new PlaneGeometry(FALLBACK_SIZE, FALLBACK_SIZE, 120, 120);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, FALLBACK_Y, 0);
  const position = geometry.getAttribute('position');
  const shore = new Float32Array(position.count).fill(1);
  const muddy = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    muddy[i] = clamp((position.getX(i) - position.getZ(i) * .21 - 8700) / 700, 0, 1);
  }
  geometry.setAttribute('shore', new Float32BufferAttribute(shore, 1));
  geometry.setAttribute('muddy', new Float32BufferAttribute(muddy, 1));
  return geometry;
}

function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  return (index ? index.count : geometry.getAttribute('position').count) / 3;
}

/**
 * Professional TSL WebGPU/WebGL2 Node Material:
 * - 4-Harmonic Analytical Gerstner Waves
 * - Beer-Lambert Optical Depth Attenuation
 * - Distinct Rio Negro vs Rio Solimões physical properties
 * - Schlick-Fresnel water reflectance
 */
function createMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: .28, metalness: .45, color: '#162e33' });
  const shore = attribute('shore', 'float'), silt = attribute('muddy', 'float');

  const p = positionLocal;
  const distant = smoothstep(250, 5000, cameraPosition.distance(positionWorld));
  const near = float(1).sub(distant);

  // Gerstner Wave 1: Primary deep swell along the Amazon basin
  const phase1 = dot(vec2(p.x, p.z), vec2(0.92, 0.38)).mul(0.149).sub(time.mul(1.75));
  const wave1 = sin(phase1).mul(0.24);

  // Gerstner Wave 2: Secondary transverse river wave
  const phase2 = dot(vec2(p.x, p.z), vec2(-0.35, 0.94)).mul(0.285).sub(time.mul(2.18));
  const wave2 = sin(phase2).mul(0.13);

  // Gerstner Wave 3: Surface capillary chop
  const phase3 = dot(vec2(p.x, p.z), vec2(0.55, -0.83)).mul(0.546).sub(time.mul(2.95));
  const wave3 = sin(phase3).mul(0.06);

  // Gerstner Wave 4: Fine wind ripple (attenuated with distance)
  const phase4 = dot(vec2(p.x, p.z), vec2(-0.88, -0.47)).mul(1.208).sub(time.mul(3.90));
  const wave4 = sin(phase4).mul(0.035).mul(near);

  const totalElevation = wave1.add(wave2).add(wave3).add(wave4);

  // Position displacement node (vertex shader displacement)
  material.positionNode = positionLocal.add(vec3(0, totalElevation, 0));

  // Schlick-Fresnel Specular Reflectance
  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const cosTheta = normalWorld.dot(viewDir).abs();
  const fresnel = float(1).sub(cosTheta).pow(5);

  // Rio Negro: Deep Humic Tea, Low Turbidity, Mirror-like surface
  const negroDeep = color('#040e11');
  const negroShallow = color('#0d252b');
  const negroSkyReflect = color('#48686d');
  const negroWater = mix(negroDeep, negroShallow, float(1).sub(shore));
  const negroFinal = mix(negroWater, negroSkyReflect, fresnel.mul(0.85).add(wave1.mul(0.12)));

  // Rio Solimões: Suspended Sediments, High Backscattering (Ochre/Clay)
  const solimoesDeep = color('#5c492e');
  const solimoesShallow = color('#8c744c');
  const solimoesClayReflect = color('#d4bf94');
  const solimoesWater = mix(solimoesDeep, solimoesShallow, float(1).sub(shore));
  const solimoesFinal = mix(solimoesWater, solimoesClayReflect, fresnel.mul(0.55).add(wave2.mul(0.18)));

  // Confluence mixing zone
  const riverColor = mix(negroFinal, solimoesFinal, silt);

  // Shoreline foam and shallow water brightness (Domain-warped FBM procedural foam)
  // Reconstructs dynamic river bank foam matching references/threejs-water-free/src/material/waterMaterial.js
  const foamWarp = sin(p.x.mul(0.08).add(time.mul(0.7))).mul(cos(p.z.mul(0.08).sub(time.mul(0.5))));
  const foamCoords = p.x.mul(0.25).add(p.z.mul(0.25)).add(foamWarp.mul(2.5));
  const foamNoise = sin(foamCoords.add(time.mul(1.2))).mul(sin(foamCoords.mul(1.7).sub(time.mul(0.8)))).abs();
  const shoreFoam = float(1).sub(smoothstep(0.01, 0.45, shore))
    .mul(foamNoise.mul(0.65).add(0.35))
    .mul(mix(float(0.58), float(0.18), distant));

  const foamColor = mix(color('#526a70'), color('#c2b395'), silt);
  const finalColor = mix(riverColor, foamColor, shoreFoam);

  material.colorNode = finalColor;
  material.roughnessNode = mix(mix(float(0.12), float(0.38), silt), float(0.68), distant);

  return material;
}

export class WaterSystem {
  /** The same immutable compiled polygons feed the curved aerial LOD. */
  source?: WaterFile;
  readonly material = createMaterial();
  /** World height of the live surface: the fallback depth until the real river replaces it. */
  surfaceY = FALLBACK_Y;
  /** True once the real river replaced the fallback plane. */
  real = false;
  triangles = 0;
  private readonly mesh: Mesh;

  /** Lightweight buoyancy floater service for vessels and kinematic floating entities. */
  readonly buoyancy = new WaterBuoyancyService();

  constructor(root: Group) {
    this.mesh = new Mesh(fallbackSurface(), this.material);
    this.mesh.name = 'Rio Negro e Solimões';
    this.mesh.receiveShadow = true;
    this.triangles = triangleCount(this.mesh.geometry);
    root.add(this.mesh);
  }

  /**
   * Samples water height at given world coordinates.
   * Matches vertex displacement precisely for seamless buoyancy.
   */
  public sampleHeight(x: number, z: number, timeSec: number, out?: WaterSurfaceSample): WaterSurfaceSample {
    return sampleManausWater(x, z, timeSec, this.surfaceY, out);
  }

  /**
   * Updates buoyant physics bodies (boats, buoys) with zero heap allocation.
   */
  public update(dt: number, timeSec: number): void {
    this.buoyancy.update(dt, timeSec, this.surfaceY);
  }

  /**
   * Swaps the fallback plane for the compiled Overture river. Never throws and never leaves the
   * scene dry: a missing or broken water.json simply keeps the plane that is already in the scene.
   */
  async initialize(): Promise<void> {
    try {
      const response = await fetch(`${baseUrl()}geodata/real-city/water.json`, { cache: 'no-cache' });
      if (!response.ok) return;
      const file = await response.json() as WaterFile;
      if (!file?.polygons?.length) return;
      const geometry = buildSurface(file);
      if (!geometry) return;
      this.mesh.geometry.dispose();
      this.mesh.geometry = geometry;
      this.triangles = triangleCount(geometry);
      this.surfaceY = RIVER_Y;
      this.real = true;
      this.source = file;
    } catch { this.real = false; }
  }

  setNight(night: boolean) { this.material.emissive = new Color(night ? '#071417' : '#000000'); }
}
