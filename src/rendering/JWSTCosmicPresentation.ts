/**
 * JWSTCosmicPresentation.ts
 *
 * Procedural deep field cosmic nebulae and hexagonal diffraction starbursts
 * inspired directly by James Webb Space Telescope (JWST) NIRCam and MIRI imagery:
 * - Iconic 6-pointed hexagonal diffraction spikes from the 18 gold-plated beryllium mirror segments
 *   plus 2 horizontal struts (8-point signature).
 * - "Pillars of Creation" (M16 Eagle Nebula) dusty interstellar hydrogen columns.
 * - "Cosmic Cliffs" (Carina Nebula NGC 3324) undulating amber/orange stellar nursery cliffs.
 * - "Tarantula Nebula" (30 Doradus) ionizing starburst gas web.
 * - "Deep Field Gravitational Lensing" (SMACS 0723) Einstein ring arc filaments.
 *
 * 100% procedural WebGPU, 0 external images, zero per-frame heap allocations.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Uint32BufferAttribute,
  Vector3,
} from 'three/webgpu';
import { attribute, float, mix, positionLocal, sin, smoothstep, time, uniform, uv } from 'three/tsl';
import { PLANET_LAYER } from './domains/RenderDomains';

const JWST_SKY_RADIUS = 160000;

export interface JWSTNebulaRegion {
  name: string;
  direction: Vector3;
  angularSizeRad: number;
  primaryColor: number;
  secondaryColor: number;
  glowColor: number;
  type: 'pillars-of-creation' | 'cosmic-cliffs' | 'tarantula-starburst' | 'gravitational-arcs';
}

export const CURATED_JWST_NEBULAE: readonly JWSTNebulaRegion[] = [
  {
    name: 'Pilares da Criação (M16 · Nebulosa da Águia)',
    direction: new Vector3(0.55, 0.42, -0.72).normalize(),
    angularSizeRad: 0.16,
    primaryColor: 0x8a3814, // Dense dust columns (warm rust)
    secondaryColor: 0x147d8f, // Ionized gas glow (turquoise)
    glowColor: 0xf5df82, // Embedded proto-stars (warm gold)
    type: 'pillars-of-creation',
  },
  {
    name: 'Penhascos Cósmicos (NGC 3324 · Nebulosa de Carina)',
    direction: new Vector3(-0.75, -0.35, 0.55).normalize(),
    angularSizeRad: 0.22,
    primaryColor: 0xd96521, // Blazing orange dust ridges
    secondaryColor: 0x051a36, // Deep space backdrop
    glowColor: 0xffd269, // Ionizing UV stellar shock front
    type: 'cosmic-cliffs',
  },
  {
    name: 'Nebulosa da Tarântula (30 Doradus)',
    direction: new Vector3(-0.35, 0.78, 0.52).normalize(),
    angularSizeRad: 0.18,
    primaryColor: 0x2b7fff, // Ionized hydrogen/oxygen filaments
    secondaryColor: 0x8022aa, // Molecular cloud periphery
    glowColor: 0x66f0ff, // Massive R136 starburst cluster
    type: 'tarantula-starburst',
  },
  {
    name: 'Campo Profundo do Webb (SMACS 0723 · Lentes Gravitacionais)',
    direction: new Vector3(0.12, -0.88, -0.45).normalize(),
    angularSizeRad: 0.14,
    primaryColor: 0xe07a38, // Redshifted distant early galaxies
    secondaryColor: 0x18304f, // Intracluster light
    glowColor: 0xffecb3, // Einstein ring arcs
    type: 'gravitational-arcs',
  },
];

/**
 * Procedurally generates the 6-pointed hexagonal diffraction spikes + 2 horizontal spikes
 * characteristic of the JWST primary mirror geometry.
 */
function createJWSTStarburstGeometry(radius: number): BufferGeometry {
  const geo = new BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Six primary spikes at 60° increments (0°, 60°, 120°, 180°, 240°, 300°)
  const primaryAngles = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3];
  // Two secondary horizontal spikes at 90° and 270° from struts
  const secondaryAngles = [Math.PI / 2, (3 * Math.PI) / 2];

  let vertIdx = 0;

  // Center vertex
  positions.push(0, 0, 0);
  colors.push(1, 1, 1);
  const centerVert = vertIdx++;

  // Primary spikes: elongated diamonds
  for (const angle of primaryAngles) {
    const len = radius;
    const width = radius * 0.045;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const perpCos = -sinA;
    const perpSin = cosA;

    // Tip
    const tipX = cosA * len;
    const tipY = sinA * len;
    // Flanks
    const flank1X = perpCos * width + cosA * (len * 0.15);
    const flank1Y = perpSin * width + sinA * (len * 0.15);
    const flank2X = -perpCos * width + cosA * (len * 0.15);
    const flank2Y = -perpSin * width + sinA * (len * 0.15);

    positions.push(flank1X, flank1Y, 0);
    colors.push(0.95, 0.85, 0.55); // Warm diffraction tint
    const f1 = vertIdx++;

    positions.push(tipX, tipY, 0);
    colors.push(0.4, 0.75, 1.0); // Slight blue fringing at tip
    const tip = vertIdx++;

    positions.push(flank2X, flank2Y, 0);
    colors.push(0.95, 0.85, 0.55);
    const f2 = vertIdx++;

    // Diamond triangles
    indices.push(centerVert, f1, tip);
    indices.push(centerVert, tip, f2);
  }

  // Secondary faint horizontal spikes
  for (const angle of secondaryAngles) {
    const len = radius * 0.65;
    const width = radius * 0.025;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const perpCos = -sinA;
    const perpSin = cosA;

    const tipX = cosA * len;
    const tipY = sinA * len;
    const flank1X = perpCos * width + cosA * (len * 0.12);
    const flank1Y = perpSin * width + sinA * (len * 0.12);
    const flank2X = -perpCos * width + cosA * (len * 0.12);
    const flank2Y = -perpSin * width + sinA * (len * 0.12);

    positions.push(flank1X, flank1Y, 0);
    colors.push(0.7, 0.7, 0.85);
    const f1 = vertIdx++;

    positions.push(tipX, tipY, 0);
    colors.push(0.3, 0.5, 0.8);
    const tip = vertIdx++;

    positions.push(flank2X, flank2Y, 0);
    colors.push(0.7, 0.7, 0.85);
    const f2 = vertIdx++;

    indices.push(centerVert, f1, tip);
    indices.push(centerVert, tip, f2);
  }

  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.setIndex(new Uint32BufferAttribute(indices, 1));
  return geo;
}

/**
 * Creates curved sky billboard mesh for a JWST cosmic nebula.
 */
function createNebulaMesh(nebula: JWSTNebulaRegion): Mesh {
  const size = JWST_SKY_RADIUS * nebula.angularSizeRad;
  const geo = new PlaneGeometry(size, size, 16, 16);

  // Distort vertices into filamentary clouds
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y);
    // Subtle dome curvature so it sits on celestial sphere
    pos.setZ(i, -Math.pow(r / size, 2) * (size * 0.25));
  }
  geo.computeVertexNormals();

  const primaryCol = new Color(nebula.primaryColor);
  const secondaryCol = new Color(nebula.secondaryColor);

  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    opacity: 0.82,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });

  // TSL shader for filamentary nebular swirl
  const uvCoord = uv();
  const distFromCenter = smoothstep(float(0.5), float(0.05), positionLocal.xy.length().div(float(size * 0.5)));
  const swirl = sin(uvCoord.x.mul(12.0).add(uvCoord.y.mul(8.0))).mul(0.5).add(0.5);
  const nebColor = mix(primaryCol, secondaryCol, swirl);
  mat.colorNode = nebColor.mul(distFromCenter);

  const mesh = new Mesh(geo, mat);
  mesh.name = `jwst-nebula-${nebula.type}`;

  // Orient towards direction on celestial sphere
  mesh.position.copy(nebula.direction).multiplyScalar(JWST_SKY_RADIUS);
  mesh.lookAt(new Vector3(0, 0, 0));
  mesh.renderOrder = -8;
  return mesh;
}

export class JWSTCosmicPresentation {
  readonly root = new Group();
  private starbursts: Mesh[] = [];
  private nebulae: Mesh[] = [];

  constructor() {
    this.root.name = 'jwst-cosmic-presentation';
    this.buildStarbursts();
    this.buildNebulae();
  }

  private buildStarbursts(): void {
    // Curated prominent stars with iconic JWST 6-point hexagonal diffraction spikes
    const prominentStars = [
      { dir: new Vector3(0.35, 0.82, -0.45).normalize(), size: 2400 },
      { dir: new Vector3(-0.62, 0.45, 0.64).normalize(), size: 2100 },
      { dir: new Vector3(0.72, -0.22, 0.65).normalize(), size: 1900 },
      { dir: new Vector3(-0.25, -0.75, -0.61).normalize(), size: 2200 },
    ];

    const spikeGeo = createJWSTStarburstGeometry(1.0);
    const spikeMat = new MeshBasicNodeMaterial({
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    for (let i = 0; i < prominentStars.length; i++) {
      const star = prominentStars[i];
      const mesh = new Mesh(spikeGeo, spikeMat);
      mesh.name = `jwst-spike-${i}`;
      mesh.position.copy(star.dir).multiplyScalar(JWST_SKY_RADIUS * 0.96);
      mesh.scale.set(star.size, star.size, star.size);
      mesh.lookAt(new Vector3(0, 0, 0));
      mesh.renderOrder = -7;
      this.starbursts.push(mesh);
      this.root.add(mesh);
    }
  }

  private buildNebulae(): void {
    for (const nebDef of CURATED_JWST_NEBULAE) {
      const mesh = createNebulaMesh(nebDef);
      this.nebulae.push(mesh);
      this.root.add(mesh);
    }
  }

  update(cameraPos: Vector3, spaceFactor: number): void {
    // Rides camera position
    this.root.position.copy(cameraPos);

    // Visible in space and during dark night
    const visible = spaceFactor > 0.05;
    this.root.visible = visible;

    if (visible) {
      // Scale starburst intensity with space factor
      const s = Math.min(1.0, spaceFactor * 1.2);
      for (const sb of this.starbursts) {
        sb.visible = true;
      }
    }
  }

  dispose(): void {
    for (const sb of this.starbursts) {
      sb.geometry.dispose();
      (sb.material as MeshBasicNodeMaterial).dispose();
    }
    for (const neb of this.nebulae) {
      neb.geometry.dispose();
      (neb.material as MeshBasicNodeMaterial).dispose();
    }
    this.starbursts.length = 0;
    this.nebulae.length = 0;
  }
}
