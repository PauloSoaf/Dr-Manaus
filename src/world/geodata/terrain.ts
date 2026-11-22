import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Path, Shape, ShapeGeometry, Vector3 } from 'three/webgpu';
import { localManausPresentationMode, MANAUS_GROUND_COVER_Y } from '../spatial/ManausSurfacePresentation';
import { urbanDensity } from '../chunks/BuildingGenerator';
import { LANDMARKS, OSM_ROADS, isLand } from './geodata';
import { SurfaceFrameService } from '../spatial/SurfaceFrameService';
import { manausBathymetry } from '../water/ManausBathymetry';

const surfaceService = new SurfaceFrameService('earth');
const _scratchNormal = new Vector3();

function horizonBackdrop(material: MeshStandardMaterial, y: number, outerReach: number, innerReach: number): Mesh {
  const shape = new Shape();
  shape.moveTo(-outerReach, -outerReach);
  shape.lineTo(outerReach, -outerReach);
  shape.lineTo(outerReach, outerReach);
  shape.lineTo(-outerReach, outerReach);
  shape.closePath();

  // Cut out the inner [-innerReach, innerReach] square so the backdrop at Y = -0.6m never
  // slices horizontally across the excavated 3D riverbed (which descends to -28.5m).
  const hole = new Path();
  hole.moveTo(-innerReach, -innerReach);
  hole.lineTo(-innerReach, innerReach);
  hole.lineTo(innerReach, innerReach);
  hole.lineTo(innerReach, -innerReach);
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.getAttribute('position');
  const arr = posAttr.array as Float32Array;
  if (localManausPresentationMode() === 'curved') {
    for (let i = 0; i < arr.length; i += 3) {
      const pt = surfaceService.legacyPointToRenderLocal(arr[i], y, arr[i + 2]);
      arr[i] = pt.x;
      arr[i + 1] = pt.y;
      arr[i + 2] = pt.z;
    }
  } else {
    for (let i = 1; i < arr.length; i += 3) {
      arr[i] = y;
    }
  }
  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds both the flat urban/forest `ground-cover` mesh (strictly at Y = MANAUS_GROUND_COVER_Y = 0)
 * and the 3D excavated `manaus-riverbed` mesh (sloping continuously from Y = 0.0m at the shoreline
 * down to Y = -28.5m in the main Rio Negro and Solimões channels).
 *
 * Because `ground-cover` takes all sub-quads where all 4 corners + center are land, and
 * `manaus-riverbed` takes all remaining sub-quads (evaluating `sampleRiverbedHeight(px, pz)` which
 * is 0.0m at land corners and < 0.0m at water corners), the two meshes share exact Y = 0.0m vertices
 * along the entire coastline with zero holes, zero overlap, and zero flat planes cutting the water.
 */
function buildGroundAndRiverbed(): { groundCover: Mesh; riverbed: Mesh } {
  const CELL = 512, REACH = 26000;
  const landPos: number[] = [], landNorm: number[] = [], landCol: number[] = [];
  const bedPos: number[] = [], bedNorm: number[] = [], bedCol: number[] = [];

  const forest: readonly [number, number, number] = [.156, .268, .137];
  const scrub: readonly [number, number, number] = [.243, .316, .180];
  const city: readonly [number, number, number] = [.331, .336, .322];

  // Riverbed sediment palette: shallow quartz/amber sand -> intermediate alluvial silt -> deep benthic bedrock/mud
  const shallowSand: readonly [number, number, number] = [0.54, 0.43, 0.29];
  const midSilt: readonly [number, number, number] = [0.35, 0.27, 0.19];
  const deepBenthic: readonly [number, number, number] = [0.17, 0.14, 0.11];
  const solimoesClay: readonly [number, number, number] = [0.52, 0.42, 0.28];

  const curved = localManausPresentationMode() === 'curved';

  function emitLandQuad(x0: number, z0: number, x1: number, z1: number, r: number, g: number, b: number) {
    for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]] as const) {
      if (curved) {
        const pt = surfaceService.legacyPointToRenderLocal(px, MANAUS_GROUND_COVER_Y, pz);
        landPos.push(pt.x, pt.y, pt.z);
        const up = surfaceService.legacyDirectionToRenderLocal(0, 1, 0, px, MANAUS_GROUND_COVER_Y, pz);
        landNorm.push(up.x, up.y, up.z);
      } else {
        landPos.push(px, MANAUS_GROUND_COVER_Y, pz);
        landNorm.push(0, 1, 0);
      }
      landCol.push(r, g, b);
    }
  }

  function emitRiverbedVertex(px: number, pz: number) {
    const py = manausBathymetry.sampleRiverbedHeight(px, pz);
    const n = manausBathymetry.sampleRiverbedNormal(px, pz, _scratchNormal);
    if (curved) {
      const pt = surfaceService.legacyPointToRenderLocal(px, py, pz);
      bedPos.push(pt.x, pt.y, pt.z);
      const cn = surfaceService.legacyDirectionToRenderLocal(n.x, n.y, n.z, px, py, pz);
      bedNorm.push(cn.x, cn.y, cn.z);
    } else {
      bedPos.push(px, py, pz);
      bedNorm.push(n.x, n.y, n.z);
    }

    const depth = Math.max(0, -py);
    const silt = manausBathymetry.sampleSiltFactor(px, pz);
    const grain = 0.90 + (((Math.imul(Math.round(px) * 73856093 ^ Math.round(pz) * 19349663, 2654435761) >>> 8) % 1000) / 1000) * 0.20;

    let r: number, g: number, b: number;
    if (depth < 3.0) {
      const f = depth / 3.0;
      r = shallowSand[0] + (midSilt[0] - shallowSand[0]) * f;
      g = shallowSand[1] + (midSilt[1] - shallowSand[1]) * f;
      b = shallowSand[2] + (midSilt[2] - shallowSand[2]) * f;
    } else {
      const f = Math.min(1, (depth - 3.0) / 18.0);
      r = midSilt[0] + (deepBenthic[0] - midSilt[0]) * f;
      g = midSilt[1] + (deepBenthic[1] - midSilt[1]) * f;
      b = midSilt[2] + (deepBenthic[2] - midSilt[2]) * f;
    }
    // Blend Solimões ochre clay on the eastern river branch
    r = (r * (1 - silt * 0.35) + solimoesClay[0] * (silt * 0.35)) * grain;
    g = (g * (1 - silt * 0.35) + solimoesClay[1] * (silt * 0.35)) * grain;
    b = (b * (1 - silt * 0.35) + solimoesClay[2] * (silt * 0.35)) * grain;
    bedCol.push(r, g, b);
  }

  function emitRiverbedQuad(x0: number, z0: number, x1: number, z1: number) {
    emitRiverbedVertex(x0, z0);
    emitRiverbedVertex(x1, z0);
    emitRiverbedVertex(x1, z1);
    emitRiverbedVertex(x0, z0);
    emitRiverbedVertex(x1, z1);
    emitRiverbedVertex(x0, z1);
  }

  for (let z = -REACH; z < REACH; z += CELL) {
    for (let x = -REACH; x < REACH; x += CELL) {
      const cx = x + CELL * 0.5, cz = z + CELL * 0.5;

      const c00 = isLand(x, z);
      const c10 = isLand(x + CELL, z);
      const c11 = isLand(x + CELL, z + CELL);
      const c01 = isLand(x, z + CELL);
      const cc = isLand(cx, cz);

      const density = urbanDensity(cx, cz);
      const t = Math.min(1, density * 1.35);
      const base = t < 0.5 ? forest : scrub, target = t < 0.5 ? scrub : city;
      const f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const jitter = ((Math.imul(Math.round(cx / CELL) * 73856093 ^ Math.round(cz / CELL) * 19349663, 2654435761) >>> 8) % 1000) / 1000;
      const shade = 0.88 + jitter * 0.24;
      const r = (base[0] + (target[0] - base[0]) * f) * shade;
      const g = (base[1] + (target[1] - base[1]) * f) * shade;
      const b = (base[2] + (target[2] - base[2]) * f) * shade;

      // Also check midpoint edges so a narrow 128m creek crossing a 512m cell is never missed
      const cm0 = isLand(cx, z);
      const cm1 = isLand(x + CELL, cz);
      const cm2 = isLand(cx, z + CELL);
      const cm3 = isLand(x, cz);

      // 1. Pure inland cell: single 512m quad in ground-cover
      if (c00 && c10 && c11 && c01 && cc && cm0 && cm1 && cm2 && cm3) {
        emitLandQuad(x, z, x + CELL, z + CELL, r, g, b);
        continue;
      }

      // 2. Pure far-field deep water cell (> 16km from center): 128m riverbed quads
      const isNearCorridor = Math.abs(cx) <= 16384 && cz >= -6144 && cz <= 12288;
      if (!c00 && !c10 && !c11 && !c01 && !cc && !cm0 && !cm1 && !cm2 && !cm3 && !isNearCorridor) {
        const FAR_SUB = 128;
        for (let sz = z; sz < z + CELL; sz += FAR_SUB) {
          for (let sx = x; sx < x + CELL; sx += FAR_SUB) {
            emitRiverbedQuad(sx, sz, sx + FAR_SUB, sz + FAR_SUB);
          }
        }
        continue;
      }

      // 3. Coastal boundary or near-corridor river cell: subdivide into 64m quads
      const SUB = 64;
      for (let sz = z; sz < z + CELL; sz += SUB) {
        for (let sx = x; sx < x + CELL; sx += SUB) {
          const s00 = isLand(sx, sz);
          const s10 = isLand(sx + SUB, sz);
          const s11 = isLand(sx + SUB, sz + SUB);
          const s01 = isLand(sx, sz + SUB);
          const scc = isLand(sx + SUB * 0.5, sz + SUB * 0.5);

          if (s00 && s10 && s11 && s01 && scc) {
            emitLandQuad(sx, sz, sx + SUB, sz + SUB, r, g, b);
          } else {
            emitRiverbedQuad(sx, sz, sx + SUB, sz + SUB);
          }
        }
      }
    }
  }

  const landGeo = new BufferGeometry();
  landGeo.setAttribute('position', new Float32BufferAttribute(landPos, 3));
  landGeo.setAttribute('normal', new Float32BufferAttribute(landNorm, 3));
  landGeo.setAttribute('color', new Float32BufferAttribute(landCol, 3));
  landGeo.computeBoundingSphere();
  const groundCover = new Mesh(landGeo, new MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  groundCover.name = 'ground-cover';
  groundCover.receiveShadow = true;
  groundCover.userData.terrainSurface = 'sheet';

  const bedGeo = new BufferGeometry();
  bedGeo.setAttribute('position', new Float32BufferAttribute(bedPos, 3));
  bedGeo.setAttribute('normal', new Float32BufferAttribute(bedNorm, 3));
  bedGeo.setAttribute('color', new Float32BufferAttribute(bedCol, 3));
  bedGeo.computeBoundingSphere();
  const riverbed = new Mesh(bedGeo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.04, side: DoubleSide }));
  riverbed.name = 'manaus-riverbed';
  riverbed.receiveShadow = true;
  riverbed.userData.terrainSurface = 'sheet';

  return { groundCover, riverbed };
}

/** A handful of terrain/road batches covering the horizon, never detailed city objects. */
export function createTerrain(root: Group): Group {
  const terrain = new Group(); terrain.name = 'Generalized Manaus land and OSM arteries';
  const green = new MeshStandardMaterial({ color: '#465c3b', roughness: 1, side: DoubleSide });
  const urban = new MeshStandardMaterial({ color: '#565753', roughness: 1, side: DoubleSide });

  // Outer horizon backdrop at authored -0.6m with an inner cutout for [-26000, 26000]
  // so it never blocks the excavated 3D riverbed while preserving the -0.6m horizon contract.
  const backdrop = horizonBackdrop(green, -0.6, 120000, 26000);
  backdrop.name = 'terrain-backdrop';
  backdrop.userData.terrainSurface = 'sheet';
  backdrop.userData.terrainFallback = true;
  terrain.add(backdrop);

  const { groundCover, riverbed } = buildGroundAndRiverbed();
  terrain.add(groundCover);
  terrain.add(riverbed);

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
  
  // Curve the ribbons only if curvedManaus is enabled
  if (localManausPresentationMode() === 'curved') {
    for (const verts of [roadVertices, lineVertices]) {
      for (let i = 0; i < verts.length; i += 3) {
        const pt = surfaceService.legacyPointToRenderLocal(verts[i], verts[i + 1], verts[i + 2]);
        verts[i] = pt.x;
        verts[i + 1] = pt.y;
        verts[i + 2] = pt.z;
      }
    }
  }

  for (const [vertices, color, name] of [
    [roadVertices, '#383d3d', 'legacy-osm-roads'],
    [lineVertices, '#d0be89', 'legacy-osm-road-markings'],
  ] as const) {
    if (!vertices.length) continue;
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color, roughness: 1, side: DoubleSide }));
    mesh.name = name; mesh.receiveShadow = true;
    mesh.userData.terrainSurface = 'road';
    terrain.add(mesh);
  }
  root.add(terrain);
  return terrain;
}

/** Set opacity of the generalized flat terrain for crossfading with planetary tiles. */
export function setTerrainOpacity(terrain: Group, opacity: number): void {
  terrain.visible = opacity > 0.01;
  if (!terrain.visible) return;
  const transparent = opacity < 0.99;
  for (const child of terrain.children) {
    if ((child as Mesh).material) {
      const mat = (child as Mesh).material as MeshStandardMaterial;
      if (mat.transparent !== transparent) mat.transparent = transparent;
      if (mat.opacity !== opacity) mat.opacity = opacity;
    }
  }
}
