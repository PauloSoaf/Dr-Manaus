import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Shape, ShapeGeometry } from 'three/webgpu';
import { LANDMARKS, OSM_ROADS, SHORELINE, riverWidth, shoreZ } from './geodata';

function polygon(points: readonly (readonly [number, number])[], material: MeshStandardMaterial, y: number): Mesh {
  const shape = new Shape();
  points.forEach(([x, z], i) => i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z));
  shape.closePath();
  const geometry = new ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material); mesh.position.y = y; mesh.receiveShadow = true; return mesh;
}

/** A handful of terrain/road batches covering the horizon, never detailed city objects. */
export function createTerrain(root: Group): void {
  const terrain = new Group(); terrain.name = 'Generalized Manaus land and OSM arteries';
  const green = new MeshStandardMaterial({ color: '#465c3b', roughness: 1, side: DoubleSide });
  const urban = new MeshStandardMaterial({ color: '#565753', roughness: 1, side: DoubleSide });
  const irandubaUrban = new MeshStandardMaterial({ color: '#59624f', roughness: 1, side: DoubleSide });
  const sand = new MeshStandardMaterial({ color: '#b0a185', roughness: 1, side: DoubleSide });
  const opposite = SHORELINE.map(([x, z]) => [x, z + riverWidth(x)] as const);
  terrain.add(polygon([...SHORELINE, [50000, -50000], [-50000, -50000]], green, -.15));
  terrain.add(polygon([...opposite, [50000, 50000], [-50000, 50000]], green, -.2));
  const cityCoast = SHORELINE.filter(([x]) => x > -12800 && x < 19500);
  terrain.add(polygon([[-12800, shoreZ(-12800)], ...cityCoast, [19500, shoreZ(19500)], [19500, -17100], [-12800, -17100]], urban, 0));
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
