import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
} from 'three/webgpu';
import { SurfaceFrameService } from '../spatial/SurfaceFrameService';
import { localManausPresentationMode, manausTileSceneMatrix } from '../spatial/ManausSurfacePresentation';

export type RegionalPatchClass = 'forest' | 'river' | 'urban';

const FOREST_COLOR = new Color('#1f5928');
const RIVER_COLOR = new Color('#103b66');
const URBAN_COLOR = new Color('#7d7b76');

/**
 * Classifies a legacy Manaus coordinate (metres relative to Teatro Amazonas anchor)
 * for the intermediate-altitude regional proxy patch (04-EARTH-ALTITUDE-TRANSITION.md).
 */
export function classifyManausRegionalPoint(legacyX: number, legacyZ: number): RegionalPatchClass {
  // Rio Negro / Solimões / Encontro das Águas corridor running WNW -> ESE south of Centro (legacyZ > 1200)
  const riverCenterZ = 3200 + 0.18 * legacyX + 900 * Math.sin(legacyX / 9000);
  const riverHalfWidth = 2200 + 400 * Math.cos(legacyX / 7000);
  if (Math.abs(legacyZ - riverCenterZ) <= riverHalfWidth) {
    return 'river';
  }

  // Urban Manaus metropolitan footprint north of the Rio Negro bank
  const urbanDist = Math.hypot((legacyX - 1500) / 13_500, (legacyZ + 4500) / 11_000);
  if (urbanDist <= 1.0 && legacyZ < riverCenterZ - riverHalfWidth) {
    return 'urban';
  }

  return 'forest';
}

const MAJOR_DISTRICTS: ReadonlyArray<{
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}> = [
  { id: 'centro', x: 0, z: 400, width: 2200, depth: 1800, height: 48 },
  { id: 'ponta-negra', x: -8500, z: -2200, width: 2400, depth: 1400, height: 55 },
  { id: 'adrianopolis', x: 1800, z: -2400, width: 2000, depth: 2000, height: 62 },
  { id: 'distrito-industrial', x: 5200, z: 800, width: 3200, depth: 2400, height: 28 },
  { id: 'cidade-nova', x: 1200, z: -9200, width: 3600, depth: 3000, height: 24 },
];

/**
 * Intermediate-altitude (8–60 km) regional proxy for Manaus and the surrounding Amazon basin.
 * Defined in specs/dr-manaus-cosmic-night-specs/04-EARTH-ALTITUDE-TRANSITION.md (Task E4).
 */
export class ManausRegionalProxy {
  readonly group = new Group();
  readonly patchMesh: Mesh;
  readonly silhouetteMesh: InstancedMesh;
  private readonly patchMaterial: MeshBasicMaterial;
  private readonly silhouetteMaterial: MeshBasicMaterial;
  private readonly surfaceFrames = new SurfaceFrameService('earth');
  private weight = 0;

  constructor(parent?: Object3D, spanM = 64_000, resolution = 33) {
    this.group.name = 'manaus-regional-proxy';
    this.group.visible = false;

    const curved = localManausPresentationMode() === 'curved';
    const count = resolution * resolution;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let row = 0; row < resolution; row++) {
      const v = row / (resolution - 1) - 0.5;
      const lz = v * spanM;
      for (let col = 0; col < resolution; col++) {
        const u = col / (resolution - 1) - 0.5;
        const lx = u * spanM;
        const idx = (row * resolution + col) * 3;

        if (curved) {
          const pt = this.surfaceFrames.legacyPointToRenderLocal(lx, -0.4, lz);
          positions[idx] = pt.x;
          positions[idx + 1] = pt.y;
          positions[idx + 2] = pt.z;
        } else {
          positions[idx] = lx;
          positions[idx + 1] = -0.4;
          positions[idx + 2] = lz;
        }

        const kind = classifyManausRegionalPoint(lx, lz);
        const colRef = kind === 'river' ? RIVER_COLOR : kind === 'urban' ? URBAN_COLOR : FOREST_COLOR;
        colors[idx] = colRef.r;
        colors[idx + 1] = colRef.g;
        colors[idx + 2] = colRef.b;
      }
    }

    const quads = (resolution - 1) * (resolution - 1);
    const indices = new Uint16Array(quads * 6);
    let cursor = 0;
    for (let row = 0; row < resolution - 1; row++) {
      for (let col = 0; col < resolution - 1; col++) {
        const a = row * resolution + col;
        const b = a + 1;
        const c = a + resolution;
        const d = c + 1;
        indices[cursor++] = a;
        indices[cursor++] = c;
        indices[cursor++] = b;
        indices[cursor++] = b;
        indices[cursor++] = c;
        indices[cursor++] = d;
      }
    }

    const patchGeo = new BufferGeometry();
    patchGeo.setAttribute('position', new BufferAttribute(positions, 3));
    patchGeo.setAttribute('color', new BufferAttribute(colors, 3));
    patchGeo.setIndex(new BufferAttribute(indices, 1));
    patchGeo.computeBoundingSphere();

    this.patchMaterial = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.patchMesh = new Mesh(patchGeo, this.patchMaterial);
    this.patchMesh.name = 'manaus-regional-patch';
    this.group.add(this.patchMesh);

    const silGeo = new BoxGeometry(1, 1, 1);
    this.silhouetteMaterial = new MeshBasicMaterial({
      color: 0x94918b,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.silhouetteMesh = new InstancedMesh(silGeo, this.silhouetteMaterial, MAJOR_DISTRICTS.length);
    this.silhouetteMesh.name = 'manaus-regional-silhouette';

    const mat = new Matrix4();
    const scaleMat = new Matrix4();
    for (let i = 0; i < MAJOR_DISTRICTS.length; i++) {
      const d = MAJOR_DISTRICTS[i];
      manausTileSceneMatrix(`regional:${d.id}`, d.x, d.z, mat);
      scaleMat.makeScale(d.width, d.height, d.depth);
      scaleMat.setPosition(0, d.height * 0.5, 0);
      mat.multiply(scaleMat);
      this.silhouetteMesh.setMatrixAt(i, mat);
    }
    this.silhouetteMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.silhouetteMesh);

    if (parent) {
      parent.add(this.group);
    }
  }

  get activeWeight(): number {
    return this.weight;
  }

  update(altitudeM: number, explicitWeight?: number): number {
    const alt = Number.isFinite(altitudeM) ? Math.max(0, altitudeM) : 0;
    let w = explicitWeight;
    if (w === undefined) {
      if (alt < 8_000 || alt >= 60_000) {
        w = 0;
      } else if (alt < 20_000) {
        w = (alt - 8_000) / (20_000 - 8_000);
      } else {
        w = 1 - (alt - 20_000) / (60_000 - 20_000);
      }
    }
    this.weight = Math.max(0, Math.min(1, w));
    this.group.visible = this.weight > 0.01;
    this.patchMaterial.opacity = this.weight;
    this.silhouetteMaterial.opacity = this.weight * 0.85;
    return this.weight;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.patchMesh.geometry.dispose();
    this.patchMaterial.dispose();
    this.silhouetteMesh.geometry.dispose();
    this.silhouetteMaterial.dispose();
  }
}

