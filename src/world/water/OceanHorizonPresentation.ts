/**
 * OceanHorizonPresentation.ts
 *
 * Multi-scale concentric continuous ocean horizon presentation for Dr-Manaus.
 *
 * Architecture (PATCH-WATER-02):
 * - Concentric clipmap rings with 128 angular segments (360-degree smooth coverage, no polygon edges).
 * - Rigorously counter-clockwise (CCW) face winding with upward geometric normals (Ny > 0).
 * - Material configured with DoubleSide for correct top-down and underwater viewing.
 * - Clear LOD ownership: outer ring mesh starts at R_inner = 384m (matching near chunk streaming boundary),
 *   completely eliminating geometric overlap and z-fighting with near chunk water.
 * - Inner cap mesh (0..384m) can be toggled when chunk streaming is inactive (e.g. planetary entry / open ocean).
 * - Spherical planetary curvature drop delta_y = -d^2 / (2 * R_planet) baked into ring vertices so the ocean
 *   naturally curves over the true planetary horizon into space/sky without an abrupt planar edge.
 * - Invariant under floating origin rebases: follows camera position horizontally in render-local space.
 */

import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three/webgpu';
import { createUniversalLiquidMaterial, LiquidSolventType } from './UniversalLiquidSystem';

const SEGMENTS = 128;
const CHUNK_TRANSITION_RADIUS_M = 384.0;
const EARTH_RADIUS_M = 6_371_000.0;
const THALASSA_RADIUS_M = 5_800_000.0;

export class OceanHorizonPresentation {
  readonly group = new Group();
  private readonly outerMesh: Mesh;
  private readonly innerCapMesh: Mesh;
  private currentSolvent: LiquidSolventType = 'terrestrial-ocean';
  private currentElevation = 0;
  private planetRadiusM = EARTH_RADIUS_M;

  constructor() {
    this.group.name = 'Ocean Horizon Presentation (Continuous Multi-LOD Clipmap)';

    const outerGeometry = this.buildOuterHorizonGeometry(this.planetRadiusM);
    const innerGeometry = this.buildInnerCapGeometry();
    const material = createUniversalLiquidMaterial(this.currentSolvent);
    material.side = DoubleSide;

    this.outerMesh = new Mesh(outerGeometry, material);
    this.outerMesh.name = 'ocean-horizon-outer-clipmap';
    this.outerMesh.frustumCulled = false;
    this.outerMesh.receiveShadow = false;

    this.innerCapMesh = new Mesh(innerGeometry, material);
    this.innerCapMesh.name = 'ocean-horizon-inner-cap';
    this.innerCapMesh.frustumCulled = false;
    this.innerCapMesh.receiveShadow = false;
    this.innerCapMesh.visible = false; // By default near chunk meshes own 0..384m

    this.group.add(this.outerMesh);
    this.group.add(this.innerCapMesh);
  }

  setSolvent(solvent: LiquidSolventType, baseElevation = 0, planetRadiusM = EARTH_RADIUS_M): void {
    if (this.currentSolvent !== solvent) {
      this.currentSolvent = solvent;
      const newMat = createUniversalLiquidMaterial(solvent);
      newMat.side = DoubleSide;
      this.outerMesh.material = newMat;
      this.innerCapMesh.material = newMat;
    }
    this.currentElevation = baseElevation;
    if (Math.abs(this.planetRadiusM - planetRadiusM) > 1000) {
      this.planetRadiusM = planetRadiusM;
      this.rebuildGeometries();
    }
  }

  setInnerCapVisible(visible: boolean): void {
    this.innerCapMesh.visible = visible;
  }

  update(cameraRenderLocalPos: Vector3, active: boolean, hasNearChunks = true): void {
    this.group.visible = active;
    if (!active) return;

    // Crest-style Grid Snapping (MIT License, wave-harmonic/crest):
    // Snap clipmap center to grid intervals so vertices remain stationary in world space
    // as the camera moves, preventing vertex crawling / edge swimming artifacts
    const gridSnap = 16.0;
    const snappedX = Math.floor(cameraRenderLocalPos.x / gridSnap) * gridSnap;
    const snappedZ = Math.floor(cameraRenderLocalPos.z / gridSnap) * gridSnap;

    // Outer horizon follows camera horizontally at the target fluid surface elevation
    this.outerMesh.position.set(snappedX, this.currentElevation, snappedZ);
    this.innerCapMesh.position.set(snappedX, this.currentElevation, snappedZ);

    // If near chunks are loaded, near chunks own 0..384m; inner cap is disabled to prevent overlap
    this.innerCapMesh.visible = !hasNearChunks;
  }

  private rebuildGeometries(): void {
    const oldOuter = this.outerMesh.geometry;
    const oldInner = this.innerCapMesh.geometry;
    this.outerMesh.geometry = this.buildOuterHorizonGeometry(this.planetRadiusM);
    this.innerCapMesh.geometry = this.buildInnerCapGeometry();
    oldOuter.dispose();
    oldInner.dispose();
  }

  /**
   * Concentric clipmap rings from R_inner (384m) out to 260,000m (260 km).
   * Spherical planetary curvature drop is applied to ring vertices:
   *   delta_y = -d^2 / (2 * R_planet)
   */
  private buildOuterHorizonGeometry(planetRadius: number): BufferGeometry {
    // Geometrically spaced concentric radii from near transition (384m) to far horizon (260km)
    const radii = [
      CHUNK_TRANSITION_RADIUS_M,
      500, 680, 920, 1250, 1700, 2300, 3100, 4200, 5700, 7800,
      10500, 14200, 19200, 26000, 35000, 48000, 65000, 90000, 130000, 180000, 260000,
    ];

    const positions: number[] = [];
    const uvs: number[] = [];
    const shores: number[] = [];
    const indices: number[] = [];

    // Ring vertices
    for (let r = 0; r < radii.length; r++) {
      const radius = radii[r];
      const curvatureDrop = -(radius * radius) / (2.0 * planetRadius);
      for (let s = 0; s < SEGMENTS; s++) {
        const theta = (s / SEGMENTS) * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        positions.push(x, curvatureDrop, z);
        uvs.push((x / 260000) * 0.5 + 0.5, (z / 260000) * 0.5 + 0.5);
        shores.push(1.0);
      }
    }

    // CCW faces connecting consecutive concentric rings (Ny > 0 everywhere)
    for (let r = 0; r < radii.length - 1; r++) {
      const innerRingStart = r * SEGMENTS;
      const outerRingStart = (r + 1) * SEGMENTS;
      for (let s = 0; s < SEGMENTS; s++) {
        const nextS = (s + 1) % SEGMENTS;
        const i0 = innerRingStart + s;
        const i1 = innerRingStart + nextS;
        const o0 = outerRingStart + s;
        const o1 = outerRingStart + nextS;

        // Strictly CCW: (i0, i1, o0) and (i1, o1, o0)
        indices.push(i0, i1, o0);
        indices.push(i1, o1, o0);
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geo.setAttribute('shore', new Float32BufferAttribute(shores, 1));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Inner cap geometry (0 to 384m) with dense rings for close-up viewing
   * when chunk streaming is inactive.
   */
  private buildInnerCapGeometry(): BufferGeometry {
    const radii = [0, 20, 45, 80, 130, 195, 280, CHUNK_TRANSITION_RADIUS_M];
    const positions: number[] = [];
    const uvs: number[] = [];
    const shores: number[] = [];
    const indices: number[] = [];

    // Center vertex (index 0)
    positions.push(0, 0, 0);
    uvs.push(0.5, 0.5);
    shores.push(1.0);

    // Ring vertices
    for (let r = 1; r < radii.length; r++) {
      const radius = radii[r];
      for (let s = 0; s < SEGMENTS; s++) {
        const theta = (s / SEGMENTS) * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        positions.push(x, 0, z);
        uvs.push((x / CHUNK_TRANSITION_RADIUS_M) * 0.5 + 0.5, (z / CHUNK_TRANSITION_RADIUS_M) * 0.5 + 0.5);
        shores.push(1.0);
      }
    }

    // Innermost triangles connecting center (0) to ring 1 (CCW: 0, 1 + nextS, 1 + s)
    for (let s = 0; s < SEGMENTS; s++) {
      const nextS = (s + 1) % SEGMENTS;
      indices.push(0, 1 + nextS, 1 + s);
    }

    // Outer rings of the cap
    for (let r = 1; r < radii.length - 1; r++) {
      const innerRingStart = 1 + (r - 1) * SEGMENTS;
      const outerRingStart = 1 + r * SEGMENTS;
      for (let s = 0; s < SEGMENTS; s++) {
        const nextS = (s + 1) % SEGMENTS;
        const i0 = innerRingStart + s;
        const i1 = innerRingStart + nextS;
        const o0 = outerRingStart + s;
        const o1 = outerRingStart + nextS;

        indices.push(i0, i1, o0);
        indices.push(i1, o1, o0);
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geo.setAttribute('shore', new Float32BufferAttribute(shores, 1));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
}
