import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Path, Shape, ShapeGeometry, Vector3 } from 'three/webgpu';
import { localManausPresentationMode, MANAUS_GROUND_COVER_Y } from '../spatial/ManausSurfacePresentation';
import { urbanDensity } from '../chunks/BuildingGenerator';
import { LANDMARKS, OSM_ROADS, isLand, isUrban } from './geodata';
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

function sampleTerrainBiomeColor(px: number, pz: number): [number, number, number] {
  // 1. Detection of Beach / Praia (Praia da Ponta Negra)
  const dxPonta = px - (-9400);
  const dzPonta = pz - (-7400);
  const distPontaSq = dxPonta * dxPonta + dzPonta * dzPonta;
  const isPontaNegra = distPontaSq < 6760000; // ~2.6km radius around Praia da Ponta Negra

  // Signed shore distance: d > 0 in water, d < 0 on land (inland distance is -shoreDist)
  const shoreDist = manausBathymetry.sampleSignedShoreDistance(px, pz);
  const inlandDist = -shoreDist;

  // Sandy beach zone:
  // - Ponta Negra has an expansive golden beach extending up to 135m inland from the shoreline
  // - Natural jungle riverbanks and forest streams do NOT have desert sand: they are lush green rainforest!
  const isBeach = isPontaNegra && inlandDist >= -1.0 && inlandDist <= 135.0;

  // Grain jitter for procedural variation
  const grain = 0.94 + (((Math.imul(Math.round(px) * 73856093 ^ Math.round(pz) * 19349663, 2654435761) >>> 8) % 1000) / 1000) * 0.12;

  if (isBeach) {
    // Praia: Golden river beach sand (e.g. Praia da Ponta Negra)
    const tBeach = Math.min(1, Math.max(0, inlandDist / 135.0));
    const sandR = (0.72 + tBeach * 0.04) * grain;
    const sandG = (0.60 + tBeach * 0.03) * grain;
    const sandB = (0.38 + tBeach * 0.02) * grain;
    return [sandR, sandG, sandB];
  }

  // 2. City vs Forest (Mato)
  const isCity = isUrban(px, pz);
  const density = urbanDensity(px, pz);
  // Inside urban footprint, ground is definitively city asphalt & concrete slate gray.
  // Blends smoothly toward forest green only at the outer wilderness boundary (density < 0.15).
  const urbanFactor = isCity ? Math.max(0.85, Math.min(1.0, density * 1.5)) : 0.0;

  // Cidade: Clean, neutral asphalt & concrete slate gray (cancels green/warm ambient tint)
  const cityR = 0.145 * grain;
  const cityG = 0.145 * grain;
  const cityB = 0.152 * grain;

  // Mato: Vibrant, deep, lush Amazonian rainforest green (tropical emerald foliage)
  const forestR = 0.035 * grain;
  const forestG = 0.235 * grain;
  const forestB = 0.042 * grain;

  const r = forestR * (1 - urbanFactor) + cityR * urbanFactor;
  const g = forestG * (1 - urbanFactor) + cityG * urbanFactor;
  const b = forestB * (1 - urbanFactor) + cityB * urbanFactor;
  return [r, g, b];
}

/**
 * Builds both the flat urban/forest/beach `ground-cover` mesh (strictly at Y = MANAUS_GROUND_COVER_Y = 0)
 * and the 3D excavated `manaus-riverbed` mesh (sloping continuously from Y = 0.0m at the shoreline
 * down to deep thalwegs in the Rio Negro and Solimões channels).
 *
 * Distinct biomes:
 * - Cidade: Chão cinza asfalto/concreto urbano característico.
 * - Mato: Chão verde vivo de selva tropical amazônica.
 * - Praia: Chão de areia dourada na Praia da Ponta Negra e orla fluvial.
 */
function buildGroundAndRiverbed(): { groundCover: Mesh; riverbed: Mesh } {
  const CELL = 512, REACH = 26000;
  const landPos: number[] = [], landNorm: number[] = [], landCol: number[] = [];
  const bedPos: number[] = [], bedNorm: number[] = [], bedCol: number[] = [];

  // Riverbed sediment palette: submerged amber beach sand -> intermediate alluvial silt -> deep benthic bedrock/mud
  const shallowSand: readonly [number, number, number] = [0.60, 0.50, 0.32];
  const midSilt: readonly [number, number, number] = [0.15, 0.13, 0.11];
  const deepBenthic: readonly [number, number, number] = [0.05, 0.06, 0.07];
  const solimoesClay: readonly [number, number, number] = [0.34, 0.27, 0.19];

  const curved = localManausPresentationMode() === 'curved';

  function emitLandQuad(x0: number, z0: number, x1: number, z1: number) {
    for (const [px, pz] of [[x0, z0], [x1, z1], [x1, z0], [x0, z0], [x0, z1], [x1, z1]] as const) {
      if (curved) {
        const pt = surfaceService.legacyPointToRenderLocal(px, MANAUS_GROUND_COVER_Y, pz);
        landPos.push(pt.x, pt.y, pt.z);
        const up = surfaceService.legacyDirectionToRenderLocal(0, 1, 0, px, MANAUS_GROUND_COVER_Y, pz);
        landNorm.push(up.x, up.y, up.z);
      } else {
        landPos.push(px, MANAUS_GROUND_COVER_Y, pz);
        landNorm.push(0, 1, 0);
      }
      const [r, g, b] = sampleTerrainBiomeColor(px, pz);
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
    // If this vertex is on dry land or at the exact waterline boundary (depth <= 0.05m),
    // use the terrain biome color so dry land never displays as artificial beige sand!
    const inWater = manausBathymetry.isWater(px, pz) && depth > 0.05;
    if (!inWater) {
      const [r, g, b] = sampleTerrainBiomeColor(px, pz);
      bedCol.push(r, g, b);
      return;
    }

    const silt = manausBathymetry.sampleSiltFactor(px, pz);
    const grain = 0.90 + (((Math.imul(Math.round(px) * 73856093 ^ Math.round(pz) * 19349663, 2654435761) >>> 8) % 1000) / 1000) * 0.20;

    // Golden sand is unique to Praia da Ponta Negra; natural Amazon riverbeds are dark organic silt & benthic mud
    const dxPonta = px - (-9400);
    const dzPonta = pz - (-7400);
    const isPontaNegraBed = (dxPonta * dxPonta + dzPonta * dzPonta) < 6760000;

    let r: number, g: number, b: number;
    if (depth < 1.5) {
      const f = depth / 1.5;
      if (isPontaNegraBed) {
        r = shallowSand[0] * (1 - f) + midSilt[0] * f;
        g = shallowSand[1] * (1 - f) + midSilt[1] * f;
        b = shallowSand[2] * (1 - f) + midSilt[2] * f;
      } else {
        r = midSilt[0] * (1 - f * 0.5) + deepBenthic[0] * (f * 0.5);
        g = midSilt[1] * (1 - f * 0.5) + deepBenthic[1] * (f * 0.5);
        b = midSilt[2] * (1 - f * 0.5) + deepBenthic[2] * (f * 0.5);
      }
    } else {
      const f = Math.min(1, (depth - 1.5) / 16.0);
      r = midSilt[0] * (1 - f) + deepBenthic[0] * f;
      g = midSilt[1] * (1 - f) + deepBenthic[1] * f;
      b = midSilt[2] * (1 - f) + deepBenthic[2] * f;
    }
    // Blend Solimões ochre clay on the eastern river branch
    r = (r * (1 - silt * 0.35) + solimoesClay[0] * (silt * 0.35)) * grain;
    g = (g * (1 - silt * 0.35) + solimoesClay[1] * (silt * 0.35)) * grain;
    b = (b * (1 - silt * 0.35) + solimoesClay[2] * (silt * 0.35)) * grain;
    bedCol.push(r, g, b);
  }

  function emitRiverbedQuad(x0: number, z0: number, x1: number, z1: number) {
    emitRiverbedVertex(x0, z0);
    emitRiverbedVertex(x1, z1);
    emitRiverbedVertex(x1, z0);
    emitRiverbedVertex(x0, z0);
    emitRiverbedVertex(x0, z1);
    emitRiverbedVertex(x1, z1);
  }

  /**
   * Adaptive bed refinement for the central corridor. A block is split while the linear surface
   * through its corners (the exact triangles that get rendered) deviates from the bathymetry field
   * by more than BED_TOLERANCE_M at its edge midpoints, centre or quarter points. Shoreline blocks
   * (any land sample) always refine down to SHORE_QUAD_M so land/water seams stay at Y = 0.
   */
  const BED_TOLERANCE_M = 0.12, BED_MIN_QUAD_M = 8, SHORE_QUAD_M = 16;
  function emitBedAdaptive(x0: number, z0: number, size: number) {
    const x1 = x0 + size, z1 = z0 + size, mx = x0 + size / 2, mz = z0 + size / 2;
    const l00 = isLand(x0, z0), l10 = isLand(x1, z0), l11 = isLand(x1, z1), l01 = isLand(x0, z1), lcc = isLand(mx, mz);
    if (l00 && l10 && l11 && l01 && lcc) { emitLandQuad(x0, z0, x1, z1); return; }
    const anyLand = l00 || l10 || l11 || l01 || lcc;
    if (anyLand) {
      if (size > SHORE_QUAD_M) { splitBed(x0, z0, size); return; }
      emitRiverbedQuad(x0, z0, x1, z1);
      return;
    }
    if (size > BED_MIN_QUAD_M) {
      const h = (x: number, z: number) => manausBathymetry.sampleRiverbedHeight(x, z);
      const h00 = h(x0, z0), h10 = h(x1, z0), h11 = h(x1, z1), h01 = h(x0, z1);
      const q = size / 4;
      // Triangles are (00,10,11) and (00,11,01): the diagonal runs 00 -> 11.
      const probes: Array<[number, number, number]> = [
        [mx, z0, (h00 + h10) / 2], [x1, mz, (h10 + h11) / 2], [mx, z1, (h01 + h11) / 2], [x0, mz, (h00 + h01) / 2],
        [mx, mz, (h00 + h11) / 2],
        [x0 + q * 3, z0 + q, h00 * 0.25 + h10 * 0.5 + h11 * 0.25],
        [x0 + q, z0 + q * 3, h00 * 0.25 + h01 * 0.5 + h11 * 0.25],
      ];
      let worst = 0;
      for (const [px, pz, expected] of probes) worst = Math.max(worst, Math.abs(h(px, pz) - expected));
      if (worst > BED_TOLERANCE_M) { splitBed(x0, z0, size); return; }
    }
    emitRiverbedQuad(x0, z0, x1, z1);
  }
  function splitBed(x0: number, z0: number, size: number) {
    const half = size / 2;
    emitBedAdaptive(x0, z0, half); emitBedAdaptive(x0 + half, z0, half);
    emitBedAdaptive(x0, z0 + half, half); emitBedAdaptive(x0 + half, z0 + half, half);
  }

  for (let z = -REACH; z < REACH; z += CELL) {
    for (let x = -REACH; x < REACH; x += CELL) {
      const cx = x + CELL * 0.5, cz = z + CELL * 0.5;

      const c00 = isLand(x, z);
      const c10 = isLand(x + CELL, z);
      const c11 = isLand(x + CELL, z + CELL);
      const c01 = isLand(x, z + CELL);
      const cc = isLand(cx, cz);

      // Also check midpoint edges so a narrow 128m creek crossing a 512m cell is never missed
      const cm0 = isLand(cx, z);
      const cm1 = isLand(x + CELL, cz);
      const cm2 = isLand(cx, z + CELL);
      const cm3 = isLand(x, cz);

      // 1. Pure inland cell: single 512m quad in ground-cover
      if (c00 && c10 && c11 && c01 && cc && cm0 && cm1 && cm2 && cm3) {
        emitLandQuad(x, z, x + CELL, z + CELL);
        continue;
      }

      // 2. Pure far-field deep water cell (> 16km from center): 128m riverbed quads
      const isNearCorridor = Math.abs(cx) <= 16384 && cz >= -8704 && cz <= 12288;
      if (!c00 && !c10 && !c11 && !c01 && !cc && !cm0 && !cm1 && !cm2 && !cm3 && !isNearCorridor) {
        const FAR_SUB = 128;
        for (let sz = z; sz < z + CELL; sz += FAR_SUB) {
          for (let sx = x; sx < x + CELL; sx += FAR_SUB) {
            emitRiverbedQuad(sx, sz, sx + FAR_SUB, sz + FAR_SUB);
          }
        }
        continue;
      }

      const SUB = 64;
      const isCentralShoreCorridor = Math.abs(cx) <= 12288 && cz >= -8704 && cz <= 8192;
      for (let sz = z; sz < z + CELL; sz += SUB) {
        for (let sx = x; sx < x + CELL; sx += SUB) {
          const s00 = isLand(sx, sz);
          const s10 = isLand(sx + SUB, sz);
          const s11 = isLand(sx + SUB, sz + SUB);
          const s01 = isLand(sx, sz + SUB);
          const scc = isLand(sx + SUB * 0.5, sz + SUB * 0.5);

          if (s00 && s10 && s11 && s01 && scc) {
            emitLandQuad(sx, sz, sx + SUB, sz + SUB);
          } else if (isCentralShoreCorridor) {
            emitBedAdaptive(sx, sz, SUB);
          } else {
            const landCount = (s00 ? 1 : 0) + (s10 ? 1 : 0) + (s11 ? 1 : 0) + (s01 ? 1 : 0) + (scc ? 1 : 0);
            if (landCount >= 3) {
              emitLandQuad(sx, sz, sx + SUB, sz + SUB);
            } else {
              emitRiverbedQuad(sx, sz, sx + SUB, sz + SUB);
            }
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
  const green = new MeshStandardMaterial({ color: '#1b4317', roughness: 1, side: DoubleSide });
  const urban = new MeshStandardMaterial({ color: '#2b2d30', roughness: 1, side: DoubleSide });

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
      if (mat.transparent !== transparent) {
        mat.transparent = transparent;
        mat.needsUpdate = true;
      }
      mat.depthWrite = !transparent;
      if (mat.opacity !== opacity) mat.opacity = opacity;
    }
  }
}
