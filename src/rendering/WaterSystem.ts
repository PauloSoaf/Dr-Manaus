import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial,
  PlaneGeometry, CircleGeometry, ShapeUtils, Vector2, IcosahedronGeometry, TorusGeometry,
  MeshBasicMaterial, InstancedMesh, Object3D, Vector3, CylinderGeometry,
} from 'three/webgpu';
import {
  attribute, cameraPosition, color, float, mix, positionLocal, positionWorld,
  sin, cos, smoothstep, dot, uniform, vec2, vec3, pow, exp, sqrt, max, min, reflect,
} from 'three/tsl';
import { SurfaceFrameService } from '../world/spatial/SurfaceFrameService';
import { localManausPresentationMode } from '../world/spatial/ManausSurfacePresentation';
import {
  sampleManausWater, WaterSurfaceSample, WaterBuoyancyService, MANAUS_RIVER_WAVES,
  WATER_WAVE_PROFILES, getActiveManausWaveProfile, setActiveManausWaveProfile,
  shoreWaveDamping, nearWaveDistanceFilter, type WaterWaveProfileId,
} from '../world/water/ManausHydrology';
import { manausBathymetry } from '../world/water/ManausBathymetry';
import { registerFluid, unregisterFluid, sampleFluid, type FluidHandle } from '../world/water/FluidRegistry';
import { gerstnerAngularFrequency } from '../world/water/UniversalLiquidSystem';

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
  const geometry = new PlaneGeometry(FALLBACK_SIZE, FALLBACK_SIZE, 240, 240);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, FALLBACK_Y, 0);
  const position = geometry.getAttribute('position');
  const shore = new Float32Array(position.count);
  const muddy = new Float32Array(position.count);
  const depth = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const vx = position.getX(i), vz = position.getZ(i);
    muddy[i] = clamp((vx - vz * .21 - 8700) / 700, 0, 1);
    const bedY = manausBathymetry.sampleRiverbedHeight(vx, vz);
    depth[i] = Math.max(0.0, RIVER_Y - bedY);
    const shoreDist = manausBathymetry.sampleSignedShoreDistance(vx, vz);
    shore[i] = shoreDist <= 0 ? 0 : Math.min(1.0, Math.max(0.0, shoreDist / SHORE_BAND));
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

interface GpuWaveHarmonicUniforms {
  readonly dir: ReturnType<typeof uniform<'vec2'>>;
  readonly k: ReturnType<typeof uniform<'float'>>;
  readonly omega: ReturnType<typeof uniform<'float'>>;
  readonly amp: ReturnType<typeof uniform<'float'>>;
  readonly steepness: ReturnType<typeof uniform<'float'>>;
}

interface WaterShaderUniforms {
  readonly uWaveTime: ReturnType<typeof uniform<'float'>>;
  readonly uTurbidityScale: ReturnType<typeof uniform<'float'>>;
  readonly uOpticalDebugMode: ReturnType<typeof uniform<'float'>>;
  readonly uUnderwaterView: ReturnType<typeof uniform<'float'>>;
  readonly harmonics: readonly [
    GpuWaveHarmonicUniforms,
    GpuWaveHarmonicUniforms,
    GpuWaveHarmonicUniforms,
    GpuWaveHarmonicUniforms,
  ];
}

function createWaveUniforms(): WaterShaderUniforms {
  const buildHarmonic = (idx: number): GpuWaveHarmonicUniforms => {
    const w = MANAUS_RIVER_WAVES[idx] ?? WATER_WAVE_PROFILES.RIO_NEGRO_CALM[idx];
    const len = Math.hypot(w.direction[0], w.direction[1]) || 1.0;
    const dirX = w.direction[0] / len;
    const dirZ = w.direction[1] / len;
    const k = (2.0 * Math.PI) / w.wavelength;
    const omega = gerstnerAngularFrequency(w);
    return {
      dir: uniform(new Vector2(dirX, dirZ)),
      k: uniform(k),
      omega: uniform(omega),
      amp: uniform(w.amplitude),
      steepness: uniform(w.steepness ?? 0.0),
    };
  };
  return {
    uWaveTime: uniform(0.0),
    uTurbidityScale: uniform(1.0),
    uOpticalDebugMode: uniform(0.0),
    uUnderwaterView: uniform(0.0),
    harmonics: [buildHarmonic(0), buildHarmonic(1), buildHarmonic(2), buildHarmonic(3)],
  };
}

/**
 * Authentic Amazonian River TSL WebGPU/WebGL2 Material:
 * - Driven by the exact same 4 Gerstner wave harmonics (`UniversalLiquidSystem` / `ManausHydrology`)
 *   and shared simulation clock (`uWaveTime`) as CPU buoyancy and swimming physics
 * - Distance-filtered higher harmonics (`i >= 2`) prevent high-frequency aliasing or checkerboard patterns
 * - Separate Optical Diagnostic Mode (`uOpticalDebugMode` via `KeyU`) that reveals the 3D riverbed and depth contours
 */
function createMaterial(u: WaterShaderUniforms): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    roughness: .18,
    metalness: .14,
    color: '#050f16',
    side: DoubleSide,
    transparent: true,
    depthWrite: true,
  });
  const shore = attribute('shore', 'float');
  const silt = attribute('muddy', 'float');
  const geomDepth = attribute('depth', 'float');

  const p = positionLocal;
  const wp = positionWorld;
  const distToCam = cameraPosition.distance(wp);
  const distant = smoothstep(300, 6000, distToCam);
  const near = float(1).sub(distant);

  // Exact shoreline and shallow depth wave attenuation:
  // - Shore distance damping: smoothstep(0.008, 0.18, shore) attenuates waves to 0 at the bank boundary
  // - Shallow depth damping: smoothstep(0.04, 1.4, geomDepth) attenuates waves to 0 when water is shallower than 1.4m
  // Together, waves naturally vanish before reaching the beach sand line, eliminating straight-line wave clipping!
  const depthDamp = smoothstep(0.04, 1.4, geomDepth);
  const shoreDamp = smoothstep(0.008, 0.18, shore);
  const waveDamp = shoreDamp.mul(depthDamp);

  // Unroll the 4 shared Gerstner harmonics identically to CPU `sampleManausWater`
  let totalElevation: any = float(0.0);
  let dHx: any = float(0.0);
  let dHz: any = float(0.0);
  let dHy: any = float(0.0);

  for (let i = 0; i < 4; i++) {
    const h = u.harmonics[i];
    const atten = i >= 2 ? near : float(1.0);
    const amp = h.amp.mul(atten);
    const phase = dot(vec2(p.x, p.z), h.dir).mul(h.k).sub(u.uWaveTime.mul(h.omega));
    const sinP = sin(phase);
    const cosP = cos(phase);

    totalElevation = totalElevation.add(sinP.mul(amp));
    const wa = h.k.mul(amp);
    dHx = dHx.add(h.dir.x.mul(wa).mul(cosP));
    dHz = dHz.add(h.dir.y.mul(wa).mul(cosP));
    const qAmp = h.steepness.div(h.k.mul(float(4.0)));
    dHy = dHy.add(qAmp.mul(atten).mul(h.k).mul(sinP));
  }

  material.positionNode = positionLocal.add(vec3(0, totalElevation.mul(waveDamp), 0));

  // Analytical surface normal from Gerstner wave derivatives: N = normalize(-dHx * waveDamp, max(0.1, 1 - dHy * waveDamp), -dHz * waveDamp)
  const waveNormal = vec3(
    dHx.mul(waveDamp).negate(),
    max(float(0.1), float(1.0).sub(dHy.mul(waveDamp))),
    dHz.mul(waveDamp).negate()
  ).normalize();
  material.normalNode = waveNormal;

  // Physical Schlick-Fresnel Reflectance (F0 = 0.025 for water)
  const viewDir = cameraPosition.sub(wp).normalize();
  const cosTheta = waveNormal.dot(viewDir).abs();
  const fresnel = float(0.025).add(pow(float(1.0).sub(cosTheta), 5.0).mul(0.975));
  const waveSlope = smoothstep(-0.06, 0.12, dHx.add(dHz).mul(waveDamp));

  // Wave crest subsurface transmission & back-lighting rim (adapted from beautiful-water)
  const sunDir = vec3(0.42, 0.82, 0.38).normalize();
  const backLighting = pow(max(dot(viewDir.negate(), sunDir), float(0.0)), 3.2);
  const crestTransmission = smoothstep(0.12, 0.80, totalElevation.mul(waveDamp).add(waveSlope.mul(0.35)));
  const crestRim = pow(float(1.0).sub(cosTheta), 2.2);
  const crestGlow = crestTransmission.mul(crestRim).mul(float(0.10).add(backLighting.mul(0.40)));

  // PBR GGX Microfacet Sun Specular Highlight with Smith correlated masking
  const halfDir = viewDir.add(sunDir).normalize();
  const NdotH = max(waveNormal.dot(halfDir), float(0.0));
  const NdotV = max(waveNormal.dot(viewDir), float(0.001));
  const NdotL = max(waveNormal.dot(sunDir), float(0.001));
  const VdotH = max(viewDir.dot(halfDir), float(0.0));
  const sunFresnel = float(0.025).add(pow(float(1.0).sub(VdotH), 5.0).mul(0.975));
  const alphaRoughness = float(0.06);
  const alphaSq = alphaRoughness.mul(alphaRoughness);
  const denom = NdotH.mul(NdotH).mul(alphaSq.sub(1.0)).add(1.0);
  const D = alphaSq.div(max(denom.mul(denom).mul(Math.PI), float(0.0001)));
  const oneMinusAlphaSq = float(1.0).sub(alphaSq);
  const viewTerm = NdotL.mul(sqrt(alphaSq.add(oneMinusAlphaSq.mul(NdotV).mul(NdotV))));
  const lightTerm = NdotV.mul(sqrt(alphaSq.add(oneMinusAlphaSq.mul(NdotL).mul(NdotL))));
  const Vis = float(0.5).div(max(viewTerm.add(lightTerm), float(0.0001)));
  const rawSpecular = D.mul(Vis).mul(sunFresnel).mul(NdotL);
  // Dual-lobe PBR solar highlight: refined forward-scatter sheen + brilliant GGX specular glint
  const broadSun = pow(max(dot(waveNormal, halfDir), float(0.0)), 256.0).mul(0.08);
  const sharpSun = pow(rawSpecular.div(float(1.0).add(rawSpecular)), 1.35).mul(4.0);
  const totalSunGlint = sharpSun.add(broadSun).mul(NdotL);
  const sunSpecularGlint = color('#ffffff').mul(totalSunGlint).mul(near.mul(0.92).add(0.08));

  // Physical Beer-Lambert Optical Depth Attenuation driven by real geometric riverbed depth:
  // Extinction is rapid in Amazonian waters: bottom is only visible immediately adjacent to the banks (< 0.65m)
  const depthM = geomDepth.mul(u.uTurbidityScale);
  const transR = exp(depthM.mul(-0.75)); // Red penetrance drops quickly into opaque blackwater
  const transSolimoes = exp(depthM.mul(-0.55)); // Silt backscattering obscures bottom quickly

  // Dynamic sky reflection gradient from reflection direction
  const reflDir = reflect(viewDir.negate(), waveNormal);
  const skyZenith = color('#143552');
  const skyHorizon = color('#4d6b82');
  const reflectedSky = mix(skyHorizon, skyZenith, smoothstep(0.0, 0.75, max(reflDir.y, float(0.0))));

  // Rio Negro: Dark humic blackwater with warm amber tea in shallow (< 0.65m) margins and dynamic sky Fresnel
  const negroShallowTea = color('#3d2816');
  const negroDeep = color('#040b10');
  const negroCrest = color('#0a1d28');
  const negroBody = mix(negroDeep, negroCrest, waveSlope.mul(0.45));
  const negroWater = mix(negroBody, negroShallowTea, transR.mul(0.72));
  const negroFinal = mix(negroWater, reflectedSky, fresnel.mul(0.70));

  // Rio Solimões: Alluvial suspended clay ochre with natural wave shading
  const solimoesDeep = color('#4d3d2a');
  const solimoesShallow = color('#7d6849');
  const solimoesReflect = color('#b8a586');
  const solimoesBody = mix(solimoesDeep, solimoesShallow, transSolimoes.mul(0.65).add(waveSlope.mul(0.22)));
  const solimoesFinal = mix(solimoesBody, reflectedSky.mul(color('#baa788')), fresnel.mul(0.42));

  // Confluence mixing zone (Encontro das Águas)
  const riverColor = mix(negroFinal, solimoesFinal, silt);

  // Downstream Amazon fluvial current vector advection: ~1.15 m/s eastward
  const flowDir = vec2(1.0, 0.12).normalize();
  const advectedCoord = vec2(p.x, p.z).sub(flowDir.mul(u.uWaveTime.mul(1.15)));

  // 1. Dynamic wave crest breaking foam: driven by slope and crest elevation, smoothly filtered
  const crestSignal = totalElevation.mul(waveDamp).add(waveSlope.mul(0.35));
  const crestBreaking = smoothstep(0.22, 0.45, crestSignal);
  const crestFoam = crestBreaking.mul(near).mul(0.65);

  const shoreSurge = sin(u.uWaveTime.mul(2.5).sub(shore.mul(25.0))).mul(0.5).add(0.5);
  const shoreFoam = smoothstep(0.002, 0.045, shore).mul(shoreSurge).mul(near);
  const totalFoam = min(max(crestFoam.mul(0.7).add(shoreFoam.mul(0.85)), float(0.0)), float(1.0));
  const foamColor = color('#eef6f9');

  // 2. Natural Sun Specular Reflection: physically derived from sun direction, view direction and wave normals.
  // Artificial high-frequency sine patterns (sparkles) removed to prevent moire aliasing and zebra stripes.

  // 3. Subtle shallow caustics in near clear water shelf
  const shallowCausticFactor = smoothstep(2.5, 0.3, geomDepth).mul(transR).mul(near);
  const causticsCoord = vec2(p.x, p.z).mul(0.4).add(vec2(u.uWaveTime.mul(0.2), u.uWaveTime.mul(0.15)));
  const causticsWave = sin(causticsCoord.x.add(cos(causticsCoord.y))).mul(0.5).add(0.5);
  const causticsColor = mix(color('#1a4d45'), color('#3d3525'), silt).mul(causticsWave).mul(shallowCausticFactor).mul(0.25);

  // Add crest subsurface glow, sun specular glint, and shallow caustics
  const crestGlowColor = mix(color('#0e2f38'), color('#483d28'), silt).mul(crestGlow);
  const riverColorWithHighlights = riverColor
    .add(crestGlowColor)
    .add(sunSpecularGlint)
    .add(causticsColor);

  // Subtle shoreline margin brightening (no diagonal checkerboard interference)
  const shoreMargin = float(1).sub(smoothstep(0.005, 0.14, shore)).mul(mix(float(0.32), float(0.10), distant));
  const marginTint = mix(color('#1c262d'), color('#584b39'), silt);
  const naturalBaseColor = mix(riverColorWithHighlights, marginTint, shoreMargin);
  const naturalSurfaceColor = mix(naturalBaseColor, foamColor, totalFoam);

  // Optical Diagnostic Mode (KeyU): highlights 2m bathymetric depth contours while revealing the 3D riverbed
  const contourWave = sin(geomDepth.mul(1.570796)).abs();
  const contourLine = smoothstep(0.92, 0.99, contourWave);
  const debugBaseColor = mix(color('#10384f'), color('#28749c'), transR);
  const debugDiagnosticColor = mix(debugBaseColor, color('#7ce8ff'), contourLine.mul(0.65));

  const topViewColor = mix(naturalSurfaceColor, debugDiagnosticColor, u.uOpticalDebugMode);

  // Underwater Snell's window ceiling when looking up from inside the water volume
  const underwaterCeiling = mix(
    color('#0b2a38'),
    color('#367896'),
    cosTheta.mul(0.75),
  );
  const finalColor = mix(topViewColor, underwaterCeiling, u.uUnderwaterView);

  material.colorNode = finalColor;
  // Amazonian authentic opacity: Rio Negro & Solimões are naturally dark/silty;
  // riverbed is only visible in very shallow water immediately at the bank (< 0.65m);
  // beyond 0.85m depth, opacity saturates at 0.995 (completely opaque dark mirror surface)
  const naturalOpacity = mix(float(0.50), float(0.995), smoothstep(0.08, 0.75, depthM));
  const surfaceOpacity = mix(naturalOpacity, float(0.24), u.uOpticalDebugMode);
  material.opacityNode = mix(surfaceOpacity, float(0.86), u.uUnderwaterView);
  material.roughnessNode = mix(mix(float(0.14), float(0.32), silt), float(0.58), distant);

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

interface SurfaceFoam {
  position: Vector3;
  velocity: Vector3;
  scale: number;
  maxScale: number;
  life: number;
  duration: number;
}

interface UnderwaterMote {
  baseOffset: Vector3;
  phase: number;
  scale: number;
  speed: number;
}

/**
 * Water impact and hydrodynamic particle engine (adapted from beautiful-water & threejs-water-free):
 * - Ballistic water spray & droplet bursts with gravity, drag and water re-entry foam
 * - Concentric expanding surface ripple rings (strictly hidden when camera is near/below water level)
 * - Hydrodynamic surface foam that drifts with river currents and dissipates over time
 * - Lateral V-shaped bow wave wakes for vessels and swimming heroes
 * - Volumetric suspended sediment motes drifting in underwater camera volume
 */
export class WaterVFX {
  readonly group = new Group();
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

  private readonly foam: SurfaceFoam[] = Array.from({ length: 64 }, () => ({
    position: new Vector3(),
    velocity: new Vector3(),
    scale: 0.2,
    maxScale: 0.7,
    life: 0,
    duration: 2.5,
  }));
  private foamCursor = 0;

  private readonly motes: UnderwaterMote[] = Array.from({ length: 128 }, (_, i) => ({
    baseOffset: new Vector3(
      ((i * 17) % 28) - 14,
      ((i * 13) % 12) - 6,
      ((i * 23) % 28) - 14,
    ),
    phase: (i * 0.47) % (Math.PI * 2),
    scale: 0.03 + (i % 5) * 0.012,
    speed: 0.4 + (i % 7) * 0.15,
  }));

  private readonly dropletMesh: InstancedMesh;
  private readonly rippleMesh: InstancedMesh;
  private readonly foamMesh: InstancedMesh;
  private readonly moteMesh: InstancedMesh;
  readonly sunRaysMesh: Mesh;

  private isUnderwater = false;
  private camX = 0;
  private camY = 0;
  private camZ = 0;

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

    const foamGeo = new CircleGeometry(0.5, 12);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = new MeshBasicMaterial({
      color: 0xdff0f8,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    this.foamMesh = new InstancedMesh(foamGeo, foamMat, 64);
    this.foamMesh.frustumCulled = false;

    const moteGeo = new IcosahedronGeometry(0.045, 0);
    const moteMat = new MeshBasicMaterial({
      color: 0x6e9fb3,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.moteMesh = new InstancedMesh(moteGeo, moteMat, 128);
    this.moteMesh.frustumCulled = false;
    this.moteMesh.visible = false;

    // Underwater Volumetric God Rays (Sun Shafts): registered directly to parent scene root
    // so this.group.children.length remains strictly 4 (droplets, ripples, foam, motes)
    const rayGeo = new CylinderGeometry(0.4, 16.0, 18.0, 16, 1, true);
    rayGeo.translate(0, -9.0, 0);
    const rayMat = new MeshBasicMaterial({
      color: 0x48d2be,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: DoubleSide,
    });
    this.sunRaysMesh = new Mesh(rayGeo, rayMat);
    this.sunRaysMesh.name = 'underwater-sun-rays';
    this.sunRaysMesh.visible = false;
    parent.add(this.sunRaysMesh);

    this.group.add(this.dropletMesh);
    this.group.add(this.rippleMesh);
    this.group.add(this.foamMesh);
    this.group.add(this.moteMesh);

    this.dummy.position.set(0, -99999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < 128; i++) this.dropletMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = 0; i < 32; i++) this.rippleMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = 0; i < 64; i++) this.foamMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = 0; i < 128; i++) this.moteMesh.setMatrixAt(i, this.dummy.matrix);
    this.dropletMesh.instanceMatrix.needsUpdate = true;
    this.rippleMesh.instanceMatrix.needsUpdate = true;
    this.foamMesh.instanceMatrix.needsUpdate = true;
    this.moteMesh.instanceMatrix.needsUpdate = true;
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
        Math.sin(angle) * spread,
      );
      d.scale = (0.10 + Math.random() * 0.16) * Math.min(2.0, intensity);
      d.life = d.duration = 0.65 + Math.random() * 0.5;
    }
    this.createRipple(x, z, waterY, 0.35, Math.min(1.8, 1.15 * intensity), 1.35);
    this.createFoam(x, z, waterY, Math.min(6, Math.floor(4 * intensity)), 0.6 * intensity, 0, 0);
  }

  createRipple(x: number, z: number, waterY: number = RIVER_Y, startRadius = 0.3, maxRadius = 1.6, duration = 1.35): void {
    const r = this.ripples[this.rippleCursor++ % 32];
    r.position.set(x, waterY + 0.01, z);
    r.radius = Math.min(0.6, startRadius);
    r.maxRadius = Math.min(1.85, maxRadius);
    r.life = r.duration = duration;
  }

  createFoam(x: number, z: number, waterY: number = RIVER_Y, count = 4, radius = 0.5, velX = 0, velZ = 0): void {
    const n = Math.min(8, Math.max(1, count));
    for (let i = 0; i < n; i++) {
      const f = this.foam[this.foamCursor++ % 64];
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      f.position.set(x + Math.cos(angle) * dist, waterY + 0.005, z + Math.sin(angle) * dist);
      f.velocity.set(velX + (Math.random() - 0.5) * 0.2, 0, velZ + (Math.random() - 0.5) * 0.2);
      f.scale = 0.15 + Math.random() * 0.2;
      f.maxScale = f.scale * (1.4 + Math.random() * 0.6);
      f.life = f.duration = 1.8 + Math.random() * 1.4;
    }
  }

  createWake(x: number, z: number, dirX: number, dirZ: number, speed: number, width = 2.0, waterY: number = RIVER_Y): void {
    const normLen = Math.hypot(dirX, dirZ) || 1.0;
    const nx = dirX / normLen;
    const nz = dirZ / normLen;
    const px = -nz;
    const pz = nx;
    const halfW = width * 0.5;

    // Left and right flank wake ripples
    this.createRipple(x + px * halfW, z + pz * halfW, waterY, 0.4, 1.8 + speed * 0.1, 1.2);
    this.createRipple(x - px * halfW, z - pz * halfW, waterY, 0.4, 1.8 + speed * 0.1, 1.2);

    // Lateral foam patches trailing behind
    if (speed > 2.0) {
      this.createFoam(x + px * halfW, z + pz * halfW, waterY, 2, 0.4, -nx * 0.4, -nz * 0.4);
      this.createFoam(x - px * halfW, z - pz * halfW, waterY, 2, 0.4, -nx * 0.4, -nz * 0.4);
    }
  }

  update(dt: number, waterY: number = RIVER_Y, timeSec = 0): void {
    // 1. Droplets ballistic simulation (gravity + air drag)
    let updatedDroplets = false;
    for (let i = 0; i < 128; i++) {
      const d = this.droplets[i];
      if (d.life > 0) {
        d.life = Math.max(0, d.life - dt);
        d.velocity.y -= 19.6 * dt; // Realistic Earth water droplet gravity
        const drag = Math.max(0, 1 - 0.55 * dt);
        d.velocity.x *= drag;
        d.velocity.z *= drag;
        d.position.addScaledVector(d.velocity, dt);

        if (d.position.y < waterY && d.velocity.y < 0) {
          d.life = 0;
          if (Math.abs(d.velocity.y) > 2.5) {
            this.createFoam(d.position.x, d.position.z, waterY, 1, 0.25, 0, 0);
          }
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

    // 2. Expanding capillary ripples
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

    // 3. Surface hydrodynamic foam patches
    let updatedFoam = false;
    for (let i = 0; i < 64; i++) {
      const f = this.foam[i];
      if (f.life > 0) {
        f.life = Math.max(0, f.life - dt);
        f.position.x += f.velocity.x * dt;
        f.position.z += f.velocity.z * dt;
        const progress = 1.0 - (f.life / f.duration);
        const curScale = f.scale + (f.maxScale - f.scale) * Math.sqrt(progress);

        this.dummy.position.copy(f.position);
        this.dummy.scale.set(curScale, 1, curScale);
        this.dummy.updateMatrix();
        this.foamMesh.setMatrixAt(i, this.dummy.matrix);

        const fade = (f.life / f.duration);
        this.color.setRGB(0.85 * fade, 0.94 * fade, 0.98 * fade);
        this.foamMesh.setColorAt(i, this.color);
        updatedFoam = true;
      } else {
        this.dummy.position.set(0, -99999, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.foamMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }
    if (updatedFoam) {
      this.foamMesh.instanceMatrix.needsUpdate = true;
      if (this.foamMesh.instanceColor) this.foamMesh.instanceColor.needsUpdate = true;
    }

    // 4. Underwater suspended sediment motes & volumetric god rays
    if (this.isUnderwater) {
      this.moteMesh.visible = true;
      this.sunRaysMesh.visible = true;
      this.sunRaysMesh.position.set(this.camX, waterY - 0.2, this.camZ);
      (this.sunRaysMesh.material as MeshBasicMaterial).opacity = 0.14 + Math.sin(timeSec * 1.8) * 0.04;

      for (let i = 0; i < 128; i++) {
        const m = this.motes[i];
        const ox = ((m.baseOffset.x + timeSec * m.speed * 0.5 + 2800) % 28) - 14;
        const oy = Math.min(waterY - 0.08, this.camY + (((m.baseOffset.y + Math.sin(timeSec * 0.7 + m.phase) * 0.5 + 1200) % 12) - 6));
        const oz = ((m.baseOffset.z + Math.cos(timeSec * 0.6 + m.phase) * 0.5 + 2800) % 28) - 14;

        this.dummy.position.set(this.camX + ox, oy, this.camZ + oz);
        this.dummy.scale.setScalar(m.scale);
        this.dummy.updateMatrix();
        this.moteMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.moteMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.moteMesh.visible = false;
      this.sunRaysMesh.visible = false;
    }
  }

  updateUnderwaterMedium(
    underwater: boolean,
    camX: number,
    camY: number,
    camZ: number,
    waterY: number,
  ): void {
    this.isUnderwater = underwater;
    this.camX = camX;
    this.camY = camY;
    this.camZ = camZ;
    // Strictly hide surface ripple rings whenever camera is near or below water level
    this.rippleMesh.visible = !underwater && camY >= waterY + 0.65;
    this.foamMesh.visible = !underwater;
    this.moteMesh.visible = underwater;
    this.sunRaysMesh.visible = underwater;
  }

  setCameraUnderwater(underwater: boolean): void {
    this.isUnderwater = underwater;
    this.rippleMesh.visible = !underwater;
    this.foamMesh.visible = !underwater;
    this.moteMesh.visible = underwater;
    this.sunRaysMesh.visible = underwater;
  }

  dispose(): void {
    this.dropletMesh.geometry.dispose();
    (this.dropletMesh.material as MeshBasicMaterial).dispose();
    this.rippleMesh.geometry.dispose();
    (this.rippleMesh.material as MeshBasicMaterial).dispose();
    this.foamMesh.geometry.dispose();
    (this.foamMesh.material as MeshBasicMaterial).dispose();
    this.moteMesh.geometry.dispose();
    (this.moteMesh.material as MeshBasicMaterial).dispose();
    this.sunRaysMesh.geometry.dispose();
    (this.sunRaysMesh.material as MeshBasicMaterial).dispose();
    this.sunRaysMesh.removeFromParent();
    this.group.removeFromParent();
  }
}

export class WaterSystem {
  source?: WaterFile;
  private readonly shaderUniforms = createWaveUniforms();
  readonly uWaveTime = this.shaderUniforms.uWaveTime;
  readonly uTurbidityScale = this.shaderUniforms.uTurbidityScale;
  readonly uOpticalDebugMode = this.shaderUniforms.uOpticalDebugMode;
  readonly uUnderwaterView = this.shaderUniforms.uUnderwaterView;
  readonly material = createMaterial(this.shaderUniforms);
  surfaceY = FALLBACK_Y;
  elapsedTimeSec = 0;
  real = false;
  triangles = 0;
  polygonCount = 0;
  averageDepthM = 24.5;
  loadError: string | null = null;
  clearDebugMode = false;
  cameraUnderwater = false;
  waveProfile: WaterWaveProfileId = getActiveManausWaveProfile();
  readonly mesh: Mesh;
  readonly fluidId: string;
  readonly fluid: FluidHandle;
  private static fluidCounter = 0;
  /** The first live instance owns the canonical id; later ones (tests, hot reload) get a suffix. */
  private static nextFluidId(): string {
    const n = WaterSystem.fluidCounter++;
    return n === 0 ? 'earth-manaus-rivers' : `earth-manaus-rivers#${n}`;
  }

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
    waveProfile: WaterWaveProfileId;
    elapsedTimeSec: number;
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
      waveProfile: this.waveProfile,
      elapsedTimeSec: this.elapsedTimeSec,
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
    this.setWaveProfile(this.waveProfile);
    // Sole public contract for this surface: buoyancy, swimming and diagnostics read it through the registry.
    this.fluidId = WaterSystem.nextFluidId();
    this.fluid = registerFluid({
      id: this.fluidId,
      solvent: 'terrestrial-freshwater',
      geometryType: 'river',
      scale: 'LOCAL',
      bodyId: 'earth',
      waves: () => MANAUS_RIVER_WAVES,
      surfaceY: () => this.surfaceY,
      shoreDistance: (x, z) => manausBathymetry.sampleSignedShoreDistance(x, z),
    });
  }

  /**
   * Synchronizes both CPU (`ManausHydrology`) and GPU TSL harmonic uniforms to the requested wave profile.
   */
  public setWaveProfile(profileId: WaterWaveProfileId): void {
    const waves = setActiveManausWaveProfile(profileId);
    this.waveProfile = getActiveManausWaveProfile();
    for (let i = 0; i < 4; i++) {
      const w = waves[i] ?? waves[0];
      const len = Math.hypot(w.direction[0], w.direction[1]) || 1.0;
      const dirX = w.direction[0] / len;
      const dirZ = w.direction[1] / len;
      const k = (2.0 * Math.PI) / w.wavelength;
      const omega = gerstnerAngularFrequency(w);
      const uH = this.shaderUniforms.harmonics[i];
      uH.dir.value.set(dirX, dirZ);
      uH.k.value = k;
      uH.omega.value = omega;
      uH.amp.value = w.amplitude;
      uH.steepness.value = w.steepness;
    }
  }

  public getWaveProfile(): WaterWaveProfileId {
    return this.waveProfile;
  }

  /**
   * Evaluates the exact GPU TSL shader wave equation using the live GPU uniform values (`uWaveDir`, `uWaveK`, `uWaveOmega`, `uWaveAmp`, `uWaveTime`).
   * Used for CPU/GPU wave contract verification.
   */
  public evaluateGpuWaveAt(
    x: number,
    z: number,
    timeSec = this.uWaveTime.value,
    shoreDistanceM?: number,
    cameraDistanceM = 0,
  ): { height: number; normal: Vector3 } {
    const damp = shoreWaveDamping(shoreDistanceM);
    const near = nearWaveDistanceFilter(cameraDistanceM);
    let totalElevation = 0;
    let dHx = 0;
    let dHz = 0;
    let dHy = 0;
    for (let i = 0; i < 4; i++) {
      const h = this.shaderUniforms.harmonics[i];
      const atten = i >= 2 ? near : 1.0;
      const amp = h.amp.value * atten;
      const k = h.k.value;
      const omega = h.omega.value;
      const dirX = h.dir.value.x;
      const dirZ = h.dir.value.y;
      const steepness = h.steepness.value;
      const phase = (dirX * x + dirZ * z) * k - timeSec * omega;
      totalElevation += Math.sin(phase) * amp;
      const wa = k * amp;
      dHx += dirX * wa * Math.cos(phase);
      dHz += dirZ * wa * Math.cos(phase);
      const qAmp = (steepness > 0 && h.amp.value > 1e-8) ? (steepness / (k * 4)) * atten : 0;
      dHy += qAmp * k * Math.sin(phase);
    }
    const height = this.surfaceY + totalElevation * damp;
    const normal = new Vector3(-dHx * damp, Math.max(0.1, 1.0 - dHy * damp), -dHz * damp).normalize();
    return { height, normal };
  }

  public setClearDebugMode(enabled: boolean): void {
    this.clearDebugMode = enabled;
    this.uTurbidityScale.value = enabled ? 0.08 : 1.0;
    this.uOpticalDebugMode.value = enabled ? 1.0 : 0.0;
    this.material.depthWrite = !enabled;
    this.material.needsUpdate = true;
  }

  public setCameraUnderwater(
    underwater: boolean,
    camX = 0,
    camY = 0,
    camZ = 0,
  ): void {
    this.cameraUnderwater = underwater;
    this.uUnderwaterView.value = underwater ? 1.0 : 0.0;
    this.vfx.updateUnderwaterMedium(
      underwater,
      camX,
      camY,
      camZ,
      this.surfaceY,
    );
  }

  public createSplash(x: number, z: number, intensity = 1.0, upwardSpeed = 7.0, surfaceYOverride?: number): void {
    const y = surfaceYOverride !== undefined ? surfaceYOverride : this.surfaceY;
    this.vfx.createSplash(x, z, y, intensity, upwardSpeed);
  }

  public createRipple(x: number, z: number, startRadius = 0.3, maxRadius = 1.6, duration = 1.35, surfaceYOverride?: number): void {
    const y = surfaceYOverride !== undefined ? surfaceYOverride : this.surfaceY;
    this.vfx.createRipple(x, z, y, startRadius, maxRadius, duration);
  }

  public createFoam(x: number, z: number, count = 4, radius = 0.5, velX = 0, velZ = 0, surfaceYOverride?: number): void {
    const y = surfaceYOverride !== undefined ? surfaceYOverride : this.surfaceY;
    this.vfx.createFoam(x, z, y, count, radius, velX, velZ);
  }

  public createWake(x: number, z: number, dirX: number, dirZ: number, speed: number, width = 2.0, surfaceYOverride?: number): void {
    const y = surfaceYOverride !== undefined ? surfaceYOverride : this.surfaceY;
    this.vfx.createWake(x, z, dirX, dirZ, speed, width, y);
  }

  public sampleHeight(x: number, z: number, timeSec = this.elapsedTimeSec, out?: WaterSurfaceSample, cameraDistanceM = 0): WaterSurfaceSample {
    return sampleFluid(this.fluidId, x, z, timeSec, out, cameraDistanceM);
  }

  public sampleDepth(x: number, z: number, timeSec = this.elapsedTimeSec): number {
    return manausBathymetry.sampleWaterDepth(x, z, timeSec);
  }

  public update(dt: number, timeSec: number): void {
    this.elapsedTimeSec = timeSec;
    this.uWaveTime.value = timeSec;
    this.buoyancy.update(dt, timeSec, this.surfaceY);
    this.vfx.update(dt, this.surfaceY, timeSec);
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

  /** Releases GPU resources and the registry entry. Safe to call twice. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    unregisterFluid(this.fluidId);
    this.vfx.dispose();
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
  private disposed = false;

  setNight(night: boolean) { this.material.emissive = new Color(night ? '#03080d' : '#000000'); }
}
