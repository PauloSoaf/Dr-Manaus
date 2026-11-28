/**
 * Continuous distant terrain and sea around the player on the Earth outside Manaus.
 *
 * Concentric rings in two nested levels, after geometry clipmaps (Asirvatham and Hoppe, GPU Gems 2,
 * ch. 2): the near level follows the player closely, the far level is rebuilt rarely, and every ring
 * keeps the same angular segments, so a level has no T-junctions. Each vertex samples the same
 * radial ground the collision provider solves (`earthSolidGroundAt`) and places it on the ellipsoid,
 * so relief and curvature agree with physics. Water triangles exist only where the ground is under
 * the sea. Levels are rebuilt into scratch buffers under a frame budget and published whole, the
 * REPLACE contract: the previous surface stays until its successor is complete, and a new frame
 * anchor rebuilds immediately, so no frame ever shows an empty world.
 */
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { createUniversalLiquidMaterial } from '../water/UniversalLiquidSystem';
import { chartToFixed, earthSurfaceChart, fixedToChart, localSeaLevelY, type LocalSurfaceChart } from '../planet/LocalSurface';
import { directionToGeodetic } from '../planet/CubeSphere';
import { EARTH, polarRadiusM } from '../planet/PlanetBody';
import { EARTH_WET_TOLERANCE_M, earthSolidGroundAt } from '../planet/EarthElevation';
import { earthGroundColor } from '../planet/EarthGroundPalette';
import type { Vec3 } from '../spatial/units';

export const EARTH_HORIZON = {
  segments: 128,
  /** Water inside this radius is drawn only until resident chunks cover it with their own. */
  capRadiusM: 384,
  /** Frame budget for incremental rebuilds. */
  buildBudgetMs: 1.5,
  /**
   * `recentreM` starts an incremental rebuild; past `immediateM` the level rebuilds in one call.
   * No hole can open while near and far drift together stay under the ring overlap:
   * immediateM(near) + immediateM(far) < near outer radius − far inner radius (6.8 km).
   */
  near: {
    recentreM: 256,
    immediateM: 1_500,
    radii: [0, 64, 128, 200, 288, 384, 480, 600, 760, 960, 1200, 1500, 1900, 2400, 3000, 3800, 4800, 6100, 7800, 10000, 12800],
  },
  far: {
    recentreM: 4_096,
    immediateM: 5_200,
    radii: [6000, 7800, 10000, 12800, 16500, 21500, 28000, 36500, 48000, 63000, 83000, 108000, 140000, 182000, 235000, 262000],
  },
} as const;

const MEAN_RADIUS_M = 6_371_000;
const ramp = (from: number, to: number, value: number) => Math.max(0, Math.min(1, (value - from) / (to - from)));

/** How far below the true surface each level is drawn, so finer representations always win. */
const SINK = {
  nearLand: (r: number) => 1.5 * (1 - ramp(700, 2500, r)),
  nearWater: (r: number) => .15 * (1 - ramp(700, 2500, r)),
  farLand: (r: number) => 4 * (1 - ramp(14_000, 20_000, r)),
  farWater: (r: number) => .6 * (1 - ramp(14_000, 20_000, r)),
};

interface LevelSpec {
  readonly name: string;
  readonly radii: readonly number[];
  readonly recentreM: number;
  readonly immediateM: number;
  readonly landSink: (radius: number) => number;
  readonly waterSink: (radius: number) => number;
  readonly capRadiusM?: number;
}

/** Scratch results of one level build, published in one step. */
interface Build {
  readonly chart: LocalSurfaceChart;
  readonly focusX: number;
  readonly focusZ: number;
  readonly origin: Vector3;
  readonly direction: Vec3;
  readonly east: Vec3;
  readonly south: Vec3;
  cursor: number;
  ms: number;
}

class HorizonLevel {
  readonly land: Mesh<BufferGeometry, MeshStandardMaterial>;
  readonly water: Mesh<BufferGeometry>;
  readonly cap?: Mesh<BufferGeometry>;
  /** Surface-frame point the published geometry is centred on. */
  centre: { x: number; z: number } | null = null;
  build: Build | null = null;
  publishes = 0;
  lastBuildMs = 0;

  private readonly rings: number;
  private readonly vertices: number;
  private readonly positions: Float32Array;
  private readonly colours: Float32Array;
  private readonly waterPositions: Float32Array;
  private readonly wet: Uint8Array;

  constructor(readonly spec: LevelSpec, landMaterial: MeshStandardMaterial, waterMaterial: ReturnType<typeof createUniversalLiquidMaterial>) {
    const segments = EARTH_HORIZON.segments;
    this.rings = spec.radii.length;
    this.vertices = this.rings * segments;
    this.positions = new Float32Array(this.vertices * 3);
    this.colours = new Float32Array(this.vertices * 3);
    this.waterPositions = new Float32Array(this.vertices * 3);
    this.wet = new Uint8Array(this.vertices);
    // Capacity for every triangle; each publish only changes the draw range.
    const indexCapacity = (this.rings - 1) * segments * 6;
    const geometry = (attributes: ReadonlyArray<readonly [string, number]>) => {
      const value = new BufferGeometry();
      for (const [name, size] of attributes) value.setAttribute(name, new BufferAttribute(new Float32Array(this.vertices * size), size));
      value.setIndex(new BufferAttribute(new Uint32Array(indexCapacity), 1));
      value.setDrawRange(0, 0);
      return value;
    };
    this.land = new Mesh(geometry([['position', 3], ['normal', 3], ['color', 3]]), landMaterial);
    this.land.name = `earth-horizon-${spec.name}-land`;
    const waterGeometry = () => {
      const value = geometry([['position', 3], ['normal', 3], ['uv', 2], ['shore', 1]]);
      (value.getAttribute('shore').array as Float32Array).fill(1);
      const normals = value.getAttribute('normal').array as Float32Array;
      for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
      return value;
    };
    this.water = new Mesh(waterGeometry(), waterMaterial);
    this.water.name = `earth-horizon-${spec.name}-water`;
    if (spec.capRadiusM !== undefined) {
      this.cap = new Mesh(waterGeometry(), waterMaterial);
      this.cap.name = `earth-horizon-${spec.name}-water-cap`;
    }
    for (const mesh of [this.land, this.water, this.cap]) if (mesh) { mesh.frustumCulled = false; mesh.receiveShadow = false; }
  }

  reset(): void {
    this.centre = null;
    this.build = null;
    for (const mesh of [this.land, this.water, this.cap]) mesh?.geometry.setDrawRange(0, 0);
  }

  drift(x: number, z: number): number {
    return this.centre ? Math.hypot(x - this.centre.x, z - this.centre.z) : Infinity;
  }

  start(chart: LocalSurfaceChart, x: number, z: number): void {
    const seaY = localSeaLevelY(chart, EARTH, x, z);
    const origin = new Vector3(x, Number.isFinite(seaY) ? seaY : 0, z);
    const fixed = chartToFixed(chart, origin.x, origin.y, origin.z);
    const length = Math.hypot(fixed[0], fixed[1], fixed[2]) || 1;
    const direction: Vec3 = [fixed[0] / length, fixed[1] / length, fixed[2] / length];
    // Local east and south at the centre, matching the surface frame's +X and +Z.
    let east: Vec3 = [-direction[1], direction[0], 0];
    const eastLength = Math.hypot(east[0], east[1]);
    east = eastLength > 1e-9 ? [east[0] / eastLength, east[1] / eastLength, 0] : [chart.east[0], chart.east[1], chart.east[2]];
    const south: Vec3 = [
      -(direction[1] * east[2] - direction[2] * east[1]),
      -(direction[2] * east[0] - direction[0] * east[2]),
      -(direction[0] * east[1] - direction[1] * east[0]),
    ];
    this.build = { chart, focusX: x, focusZ: z, origin, direction, east, south, cursor: 0, ms: 0 };
  }

  /** Samples vertices until the deadline; returns true once the whole level is published. */
  advance(deadline: number): boolean {
    const build = this.build;
    if (!build) return true;
    const started = performance.now();
    const segments = EARTH_HORIZON.segments;
    const local: Vec3 = [0, 0, 0], fixed: Vec3 = [0, 0, 0], direction: Vec3 = [0, 0, 0];
    const a2 = EARTH.semiMajorAxisM ** 2, b2 = polarRadiusM(EARTH) ** 2;
    while (build.cursor < this.vertices) {
      const ring = Math.floor(build.cursor / segments), segment = build.cursor % segments;
      const radius = this.spec.radii[ring];
      const theta = segment / segments * Math.PI * 2, delta = radius / MEAN_RADIUS_M;
      const cos = Math.cos(delta), sin = Math.sin(delta), c = Math.cos(theta), s = Math.sin(theta);
      for (let i = 0; i < 3; i++) direction[i] = cos * build.direction[i] + sin * (c * build.east[i] + s * build.south[i]);
      const { latRad, lonRad } = directionToGeodetic(direction);
      const height = earthSolidGroundAt(latRad, lonRad);
      const ellipsoid = 1 / Math.sqrt((direction[0] ** 2 + direction[1] ** 2) / a2 + direction[2] ** 2 / b2);
      const isWet = height < -EARTH_WET_TOLERANCE_M;
      this.wet[build.cursor] = isWet ? 1 : 0;
      const place = (target: Float32Array, above: number) => {
        for (let i = 0; i < 3; i++) fixed[i] = direction[i] * (ellipsoid + above);
        fixedToChart(build.chart, fixed, local);
        target[build.cursor * 3] = local[0] - build.origin.x;
        target[build.cursor * 3 + 1] = local[1] - build.origin.y;
        target[build.cursor * 3 + 2] = local[2] - build.origin.z;
      };
      place(this.positions, height - this.spec.landSink(radius));
      place(this.waterPositions, -this.spec.waterSink(radius));
      const spacing = ring + 1 < this.rings ? this.spec.radii[ring + 1] - radius : radius - this.spec.radii[ring - 1];
      earthGroundColor(latRad, lonRad, height, this.colours, build.cursor * 3, undefined, 220 / Math.max(1, spacing));
      build.cursor++;
      if ((build.cursor & 63) === 0 && performance.now() > deadline) break;
    }
    build.ms += performance.now() - started;
    if (build.cursor < this.vertices) return false;
    this.publish(build);
    return true;
  }

  private publish(build: Build): void {
    const segments = EARTH_HORIZON.segments;
    const landIndex = this.land.geometry.index!.array as Uint32Array;
    const waterIndex = this.water.geometry.index!.array as Uint32Array;
    const capIndex = this.cap?.geometry.index!.array as Uint32Array | undefined;
    let land = 0, water = 0, cap = 0;
    for (let ring = 0; ring < this.rings - 1; ring++) {
      const inner = ring * segments, outer = inner + segments;
      const capRing = this.cap && this.spec.radii[ring + 1] <= this.spec.capRadiusM!;
      for (let segment = 0; segment < segments; segment++) {
        const next = (segment + 1) % segments;
        // Counter-clockwise from above, as in the ocean clipmap.
        for (const [a, b, c] of [[inner + segment, inner + next, outer + segment], [inner + next, outer + next, outer + segment]]) {
          const wet = this.wet[a] + this.wet[b] + this.wet[c];
          if (wet < 3) { landIndex[land++] = a; landIndex[land++] = b; landIndex[land++] = c; }
          if (wet > 0) {
            if (capRing) { capIndex![cap++] = a; capIndex![cap++] = b; capIndex![cap++] = c; }
            else { waterIndex[water++] = a; waterIndex[water++] = b; waterIndex[water++] = c; }
          }
        }
      }
    }
    const geometry = this.land.geometry;
    (geometry.getAttribute('position').array as Float32Array).set(this.positions);
    (geometry.getAttribute('color').array as Float32Array).set(this.colours);
    this.gridNormals(geometry.getAttribute('normal').array as Float32Array);
    geometry.setDrawRange(0, land);
    for (const [mesh, count] of [[this.water, water], [this.cap, cap]] as const) {
      if (!mesh) continue;
      (mesh.geometry.getAttribute('position').array as Float32Array).set(this.waterPositions);
      const uv = mesh.geometry.getAttribute('uv').array as Float32Array;
      for (let v = 0; v < this.vertices; v++) { uv[v * 2] = this.waterPositions[v * 3] / 262_000 * .5 + .5; uv[v * 2 + 1] = this.waterPositions[v * 3 + 2] / 262_000 * .5 + .5; }
      mesh.geometry.setDrawRange(0, count);
    }
    for (const mesh of [this.land, this.water, this.cap]) {
      if (!mesh) continue;
      for (const attribute of Object.values(mesh.geometry.attributes)) attribute.needsUpdate = true;
      mesh.geometry.index!.needsUpdate = true;
      mesh.position.copy(build.origin);
    }
    this.centre = { x: build.focusX, z: build.focusZ };
    this.lastBuildMs = build.ms;
    this.publishes++;
    this.build = null;
  }

  /** Vertex normals from the ring grid, so unused index capacity never contributes. */
  private gridNormals(target: Float32Array): void {
    const segments = EARTH_HORIZON.segments, p = this.positions;
    for (let ring = 0; ring < this.rings; ring++) {
      const below = Math.max(0, ring - 1) * segments, above = Math.min(this.rings - 1, ring + 1) * segments;
      for (let segment = 0; segment < segments; segment++) {
        const v = ring * segments + segment;
        const left = ring * segments + (segment + segments - 1) % segments, right = ring * segments + (segment + 1) % segments;
        const rx = p[(above + segment) * 3] - p[(below + segment) * 3], ry = p[(above + segment) * 3 + 1] - p[(below + segment) * 3 + 1], rz = p[(above + segment) * 3 + 2] - p[(below + segment) * 3 + 2];
        const ax = p[right * 3] - p[left * 3], ay = p[right * 3 + 1] - p[left * 3 + 1], az = p[right * 3 + 2] - p[left * 3 + 2];
        // angular × radial points up for this winding.
        let nx = ay * rz - az * ry, ny = az * rx - ax * rz, nz = ax * ry - ay * rx;
        const length = Math.hypot(nx, ny, nz);
        if (length < 1e-9) { nx = 0; ny = 1; nz = 0; } else { nx /= length; ny /= length; nz /= length; }
        target[v * 3] = nx; target[v * 3 + 1] = ny; target[v * 3 + 2] = nz;
      }
    }
  }

  dispose(): void {
    for (const mesh of [this.land, this.water, this.cap]) mesh?.geometry.dispose();
  }
}

export class EarthHorizonPresentation {
  readonly group = new Group();
  private readonly landMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide });
  private readonly waterMaterial = createUniversalLiquidMaterial('terrestrial-ocean');
  private readonly levels: readonly HorizonLevel[];
  private chart: LocalSurfaceChart | null = null;
  private immediateBuilds = 0;

  constructor() {
    this.group.name = 'Earth Horizon (nested ring terrain and sea)';
    this.group.visible = false;
    this.waterMaterial.side = DoubleSide;
    const far = new HorizonLevel({ ...EARTH_HORIZON.far, name: 'far', landSink: SINK.farLand, waterSink: SINK.farWater }, this.landMaterial, this.waterMaterial);
    const near = new HorizonLevel({ ...EARTH_HORIZON.near, name: 'near', landSink: SINK.nearLand, waterSink: SINK.nearWater, capRadiusM: EARTH_HORIZON.capRadiusM }, this.landMaterial, this.waterMaterial);
    // Coarse first: it covers everything while the fine level refines.
    this.levels = [far, near];
    for (const level of this.levels) for (const mesh of [level.land, level.water, level.cap]) if (mesh) this.group.add(mesh);
  }

  /**
   * Keeps the horizon centred on `focus` (surface-frame metres) for the frame anchored at `anchor`.
   * `covered(x, z, r)` reports whether resident chunks draw the water inside the disk.
   */
  update(focus: { x: number; z: number }, anchor: { latDeg: number; lonDeg: number },
    covered: (x: number, z: number, radiusM: number) => boolean, budgetMs: number = EARTH_HORIZON.buildBudgetMs): void {
    if (!Number.isFinite(focus.x + focus.z + anchor.latDeg + anchor.lonDeg)) return;
    if (!this.chart || this.chart.latDeg !== anchor.latDeg || this.chart.lonDeg !== anchor.lonDeg) {
      this.chart = earthSurfaceChart(anchor.latDeg, anchor.lonDeg);
      for (const level of this.levels) level.reset();
    }
    // A level that is missing or left behind (a new frame or a jump) is rebuilt now.
    for (const level of this.levels) {
      if (level.drift(focus.x, focus.z) <= level.spec.immediateM) continue;
      level.start(this.chart, focus.x, focus.z);
      level.advance(Infinity);
      this.immediateBuilds++;
    }
    const deadline = performance.now() + budgetMs;
    for (const level of this.levels) {
      if (!level.build && level.drift(focus.x, focus.z) > level.spec.recentreM) level.start(this.chart, focus.x, focus.z);
      if (level.build && !level.advance(deadline)) break;
    }
    for (const level of this.levels) {
      if (level.cap && level.centre) level.cap.visible = !covered(level.centre.x, level.centre.z, level.spec.capRadiusM!);
    }
  }

  /** Same handoff contract as the flat city terrain: opaque while it owns the ground. */
  setOpacity(opacity: number): void {
    const value = Math.max(0, Math.min(1, opacity));
    this.group.visible = value > .01;
    const transparent = value < .99;
    for (const material of [this.landMaterial, this.waterMaterial]) {
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      material.depthWrite = !transparent;
      material.opacity = transparent ? value : 1;
    }
  }

  hide(): void { this.group.visible = false; }

  get stats() {
    return {
      visible: this.group.visible,
      immediateBuilds: this.immediateBuilds,
      levels: this.levels.map(level => ({
        name: level.spec.name, publishes: level.publishes, lastBuildMs: level.lastBuildMs,
        pending: level.build !== null, centre: level.centre,
      })),
    };
  }

  dispose(): void {
    for (const level of this.levels) level.dispose();
    this.landMaterial.dispose();
    this.waterMaterial.dispose();
    this.group.removeFromParent();
  }
}
