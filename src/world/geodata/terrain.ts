import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Shape, ShapeGeometry } from 'three/webgpu';
import { LAND_MASK } from './landmask';
import { urbanDensity } from '../chunks/BuildingGenerator';
import { LANDMARKS, OSM_ROADS, SHORELINE, isLand, riverWidth, shoreZ } from './geodata';

function polygon(points: readonly (readonly [number, number])[], material: MeshStandardMaterial, y: number): Mesh {
  const shape = new Shape();
  points.forEach(([x, z], i) => i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z));
  shape.closePath();
  const geometry = new ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material); mesh.position.y = y; mesh.receiveShadow = true; return mesh;
}

/**
 * The ground under the city, coloured from the data instead of one flat grey rectangle.
 *
 * The old version painted the whole 32 x 17 km city bounding box asphalt grey, which meant the
 * rainforest that surrounds Manaus — most of that box — had grey ground. Here each 512 m cell
 * takes its colour from how urban it actually is and whether the compiled river covers it, so
 * forest reads as forest, the dense centre reads as city, and the edges blend between them.
 */
function groundCover(): Mesh {
  const CELL = 512, REACH = 26000;
  const position: number[] = [], normal: number[] = [], color: number[] = [];
  const forest: readonly [number, number, number] = [.156, .268, .137];
  const scrub: readonly [number, number, number] = [.243, .316, .180];
  const city: readonly [number, number, number] = [.331, .336, .322];
  for (let z = -REACH; z < REACH; z += CELL) for (let x = -REACH; x < REACH; x += CELL) {
    const cx = x + CELL * .5, cz = z + CELL * .5;
    // Water is drawn by the river surface; leaving a hole here would show the backdrop through it.
    if (LAND_MASK.covers(cx, cz) && LAND_MASK.isWater(cx, cz)) continue;
    if (!isLand(cx, cz)) continue;
    const density = urbanDensity(cx, cz);
    // Two stops: forest to scrub as the city approaches, scrub to asphalt inside it.
    const t = Math.min(1, density * 1.35);
    const base = t < .5 ? forest : scrub, target = t < .5 ? scrub : city;
    const f = t < .5 ? t * 2 : (t - .5) * 2;
    // A little deterministic variation stops the canopy reading as a flat painted sheet.
    const jitter = ((Math.imul(Math.round(cx / CELL) * 73856093 ^ Math.round(cz / CELL) * 19349663, 2654435761) >>> 8) % 1000) / 1000;
    const shade = .88 + jitter * .24;
    const r = (base[0] + (target[0] - base[0]) * f) * shade;
    const g = (base[1] + (target[1] - base[1]) * f) * shade;
    const b = (base[2] + (target[2] - base[2]) * f) * shade;
    for (const [px, pz] of [[x, z], [x + CELL, z], [x + CELL, z + CELL], [x, z], [x + CELL, z + CELL], [x, z + CELL]] as const) {
      position.push(px, .02, pz); normal.push(0, 1, 0); color.push(r, g, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(color, 3));
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.name = 'ground-cover'; mesh.receiveShadow = true;
  return mesh;
}

/** A handful of terrain/road batches covering the horizon, never detailed city objects. */
export function createTerrain(root: Group): void {
  const terrain = new Group(); terrain.name = 'Generalized Manaus land and OSM arteries';
  const green = new MeshStandardMaterial({ color: '#465c3b', roughness: 1, side: DoubleSide });
  const urban = new MeshStandardMaterial({ color: '#565753', roughness: 1, side: DoubleSide });
  const irandubaUrban = new MeshStandardMaterial({ color: '#59624f', roughness: 1, side: DoubleSide });
  const sand = new MeshStandardMaterial({ color: '#b0a185', roughness: 1, side: DoubleSide });
  // A backdrop under everything. The generalized shoreline disagrees with the compiled river in
  // places, and the real water surface is what paints the Rio Negro on top; without this plane a
  // stretch of genuine land that the old polyline called river would render as a hole in the world.
  const backdrop = polygon([[-120000, -120000], [120000, -120000], [120000, 120000], [-120000, 120000]], green, -.6);
  backdrop.name = 'terrain-backdrop';
  terrain.add(backdrop);
  const opposite = SHORELINE.map(([x, z]) => [x, z + riverWidth(x)] as const);
  terrain.add(polygon([...SHORELINE, [50000, -50000], [-50000, -50000]], green, -.15));
  terrain.add(polygon([...opposite, [50000, 50000], [-50000, 50000]], green, -.2));
  terrain.add(groundCover());
  const irandubaCoast = opposite.filter(([x]) => x > -11200 && x < -5900);
  if (irandubaCoast.length > 1) {
    const inland = [...irandubaCoast].reverse().map(([x, z]) => [x, z + 2600] as const);
    terrain.add(polygon([...irandubaCoast, ...inland], irandubaUrban, .01));
  }
  // Narrow embankment ribbon makes river scale readable from flight altitude.
  const bank: (readonly [number, number])[] = [...SHORELINE, ...[...SHORELINE].reverse().map(([x, z]) => [x, z - 16] as const)];
  terrain.add(polygon(bank, sand, .035));
  const roadVertices: number[] = [], lineVertices: number[] = [];
  const ribbon = (target: number[], ax: number, az: number, bx: number, bz: number, width: number, y: number) => {
    const length = Math.hypot(bx - ax, bz - az); if (!length) return;
    const nx = -(bz - az) / length * width / 2, nz = (bx - ax) / length * width / 2;
    target.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz, ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
  };
  for (const road of OSM_ROADS) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (LANDMARKS.some(landmark => Math.hypot(mx - landmark.x, mz - landmark.z) < Math.min(landmark.radius, 110))) continue;
    const width = road.kind === 'secondary' ? 18 : 25;
    ribbon(roadVertices, a[0], a[1], b[0], b[1], width, .16);
    ribbon(lineVertices, a[0], a[1], b[0], b[1], .42, .18);
  }
  const bridge = LANDMARKS.find(landmark => landmark.id === 'ponte');
  const iranduba = LANDMARKS.find(landmark => landmark.id === 'iranduba');
  if (bridge && iranduba) {
    const halfBridge = 3595 / 2, angle = .35;
    const start = [bridge.x - Math.cos(angle) * halfBridge, bridge.z + Math.sin(angle) * halfBridge] as const;
    const middle = [(start[0] + iranduba.x) * .5, (start[1] + iranduba.z) * .5] as const;
    const access = [start, middle, [iranduba.x, iranduba.z] as const];
    for (let i = 1; i < access.length; i++) {
      const a = access[i - 1], b = access[i];
      ribbon(roadVertices, a[0], a[1], b[0], b[1], 26, .17);
      ribbon(lineVertices, a[0], a[1], b[0], b[1], .48, .19);
    }
  }
  for (const [vertices, color, name] of [
    [roadVertices, '#383d3d', 'legacy-osm-roads'],
    [lineVertices, '#d0be89', 'legacy-osm-road-markings'],
  ] as const) {
    if (!vertices.length) continue;
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color, roughness: 1, side: DoubleSide }));
    mesh.name = name; mesh.receiveShadow = true; terrain.add(mesh);
  }
  root.add(terrain);
}
