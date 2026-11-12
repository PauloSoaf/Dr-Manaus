/**
 * PlanetaryHazardRenderer.ts
 *
 * Visual renderer for volumetric planetary weather and environmental hazards.
 * Uses GPU-evaluated LineSegments with zero per-frame allocation.
 */

import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicNodeMaterial,
  LineSegments,
  Vector3,
} from 'three/webgpu';
import { positionLocal, time, vec3 } from 'three/tsl';
import type { PlanetaryHazardState, PlanetaryHazardType } from './PlanetaryHazardService';

const HAZARD_COLORS: Record<PlanetaryHazardType, string> = {
  none: '#ffffff',
  'radiation-storm': '#c084fc', // Ionized violet
  'acidic-downpour': '#a3e635', // Acidic lime green
  'cryogenic-blizzard': '#bae6fd', // Crystalline icy cyan
  'toxic-spores': '#34d399', // Emerald spore glow
  'thermal-scorch': '#f97316', // Fiery orange
  'vacuum-exposure': '#000000',
};

export class PlanetaryHazardRenderer {
  readonly root = new Group();
  private lines: LineSegments;
  private material: LineBasicNodeMaterial;
  private activeHazardType: PlanetaryHazardType = 'none';
  private colorTarget = new Color('#ffffff');

  constructor(parent?: Group) {
    const particleCount = 800;
    const vertices = new Float32Array(particleCount * 6);

    // Deterministic pseudo-random distribution around origin [-60, +60]
    for (let i = 0; i < particleCount; i++) {
      const seed = i * 1973 + 9277;
      const rx = (((seed * 9301 + 49297) % 233280) / 233280) * 120 - 60;
      const ry = ((((seed + 1) * 9301 + 49297) % 233280) / 233280) * 80;
      const rz = ((((seed + 2) * 9301 + 49297) % 233280) / 233280) * 120 - 60;

      // Line segment oriented slightly in wind direction
      vertices.set([rx, ry, rz, rx - 0.25, ry - 1.8, rz + 0.15], i * 6);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));

    this.material = new LineBasicNodeMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    // GPU falling and drifting motion
    this.material.positionNode = vec3(
      positionLocal.x.add(time.mul(6).sin().mul(1.5)),
      positionLocal.y.sub(time.mul(38)).mod(80),
      positionLocal.z.add(time.mul(5).cos().mul(1.5)),
    );

    this.lines = new LineSegments(geometry, this.material);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    this.root.add(this.lines);

    if (parent) {
      parent.add(this.root);
    }
  }

  update(dt: number, playerPos: Vector3, hazard: PlanetaryHazardState): void {
    if (hazard.type === 'none' || hazard.type === 'vacuum-exposure' || hazard.intensity <= 0.05) {
      this.lines.visible = false;
      this.activeHazardType = 'none';
      return;
    }

    this.lines.visible = true;
    this.lines.position.set(playerPos.x, Math.max(0, playerPos.y - 30), playerPos.z);

    if (this.activeHazardType !== hazard.type) {
      this.activeHazardType = hazard.type;
      const hex = HAZARD_COLORS[hazard.type] ?? '#ffffff';
      this.colorTarget.set(hex);
      this.material.color.copy(this.colorTarget);
    }

    // Dynamic opacity based on hazard intensity
    this.material.opacity = Math.min(0.85, 0.25 + hazard.intensity * 0.55);
  }

  dispose(): void {
    this.lines.geometry.dispose();
    this.material.dispose();
    this.root.removeFromParent();
  }
}

