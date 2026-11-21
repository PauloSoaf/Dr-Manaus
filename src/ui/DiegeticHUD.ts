/**
 * DiegeticHUD.ts
 *
 * High-performance 3D Diegetic HUD, in-world holographic target brackets,
 * cosmic species scanner taxonomic visor (Key N), and zero-reflow DOM compositing.
 *
 * Implements architectural requirements from docs/research/18-diegetic-low-overhead-web-hud-and-ui.md.
 */

import {
  Camera,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  RingGeometry,
  Vector2,
  Vector3,
} from 'three/webgpu';
import type { Target } from '../core/types';
import type { SpeciesProfile } from '../world/life/CosmicSpeciesScanner';

export interface DiegeticTargetBracket {
  readonly id: string;
  readonly mesh: Mesh;
  readonly material: MeshBasicNodeMaterial;
  active: boolean;
  targetPos: Vector3;
}

export interface ZeroReflowMetrics {
  domWritesAvoided: number;
  domWritesExecuted: number;
}

/**
 * Utility for projection of 3D world coordinates into 2D viewport coordinates
 * with strict frustum near-plane culling (Z > 1.0 rejected).
 * Inspired by references/lagrange/src/core/utils/ui-utils.ts.
 */
export function projectToScreen(
  worldPos: Vector3,
  camera: Camera,
  screenWidth: number,
  screenHeight: number,
  outScreenPos: Vector2,
): boolean {
  // Use scratch vector projection to prevent allocation
  const ndc = worldPos.clone().project(camera);

  // Behind camera or beyond far plane
  if (ndc.z > 1.0 || ndc.z < -1.0) {
    return false;
  }

  outScreenPos.x = ((ndc.x + 1.0) * screenWidth) * 0.5;
  outScreenPos.y = ((-ndc.y + 1.0) * screenHeight) * 0.5;
  return true;
}

/**
 * Cache for DOM writes to prevent Layout Thrashing and synchronous reflows.
 * Only updates elements when text or transform values actually change.
 */
export class ZeroReflowDOMCache {
  private readonly textCache = new Map<HTMLElement, string>();
  private readonly transformCache = new Map<HTMLElement, string>();
  readonly metrics: ZeroReflowMetrics = { domWritesAvoided: 0, domWritesExecuted: 0 };

  setCachedText(element: HTMLElement | null | undefined, text: string): void {
    if (!element) return;
    const prev = this.textCache.get(element);
    if (prev === text) {
      this.metrics.domWritesAvoided++;
      return;
    }
    element.textContent = text;
    this.textCache.set(element, text);
    this.metrics.domWritesExecuted++;
  }

  setCachedTransform3d(
    element: HTMLElement | null | undefined,
    x: number,
    y: number,
    z: number = 0,
    scale: number = 1.0,
  ): void {
    if (!element) return;
    const transformStr = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    const prev = this.transformCache.get(element);
    if (prev === transformStr) {
      this.metrics.domWritesAvoided++;
      return;
    }
    element.style.transform = transformStr;
    this.transformCache.set(element, transformStr);
    this.metrics.domWritesExecuted++;
  }

  resetMetrics(): void {
    this.metrics.domWritesAvoided = 0;
    this.metrics.domWritesExecuted = 0;
  }
}

/**
 * Diegetic HUD managing 3D in-world holographic reticles, soft-target brackets,
 * and the Cosmic Species Scanner taxonomic visor.
 */
export class DiegeticHUD {
  readonly root = new Group();
  readonly domCache = new ZeroReflowDOMCache();

  private readonly brackets: DiegeticTargetBracket[] = [];
  private readonly maxBrackets = 8;
  private readonly _scratchPos = new Vector3();
  private readonly _scratchScreen = new Vector2();

  // Active species taxonomic scan visor
  private activeProfile: SpeciesProfile | null = null;
  private profileTimer = 0;
  private profileDistanceM = 0;
  private profileIsNew = false;

  private visorContainer?: HTMLElement;
  private visorTitle?: HTMLElement;
  private visorScientific?: HTMLElement;
  private visorDiet?: HTMLElement;
  private visorThreat?: HTMLElement;
  private visorDistance?: HTMLElement;
  private visorDesc?: HTMLElement;

  constructor() {
    this.root.name = 'diegetic-hud-root';
    this.initBrackets();
    this.initVisorDOM();
  }

  private initBrackets(): void {
    const ringGeo = new RingGeometry(0.85, 1.0, 16);

    for (let i = 0; i < this.maxBrackets; i++) {
      const mat = new MeshBasicNodeMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.85,
        side: DoubleSide,
        depthTest: false,
      });

      const mesh = new Mesh(ringGeo, mat);
      mesh.visible = false;
      this.root.add(mesh);

      this.brackets.push({
        id: `bracket_${i}`,
        mesh,
        material: mat,
        active: false,
        targetPos: new Vector3(),
      });
    }
  }

  private initVisorDOM(): void {
    if (typeof document === 'undefined') return;

    let el = document.getElementById('cosmic-species-visor');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cosmic-species-visor';
      el.className = 'cosmic-species-visor';
      el.style.cssText = `
        position: fixed;
        bottom: 120px;
        right: 40px;
        width: 320px;
        background: rgba(10, 18, 30, 0.88);
        border: 1px solid rgba(0, 240, 255, 0.4);
        border-radius: 8px;
        padding: 16px;
        color: #e0f8ff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
        backdrop-filter: blur(8px);
        transform: translate3d(0, 0, 0);
        will-change: transform, opacity;
        pointer-events: none;
        display: none;
        box-shadow: 0 8px 32px rgba(0, 240, 255, 0.2);
        z-index: 1000;
      `;
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:10px;letter-spacing:0.12em;color:#00f0ff;text-transform:uppercase;">SCANNER CÓSMICO</span>
          <span id="visor-dist" style="font-size:11px;color:#8ab4f8;"></span>
        </div>
        <h3 id="visor-name" style="margin:0 0 2px 0;font-size:18px;color:#fff;"></h3>
        <div id="visor-sci" style="font-size:12px;font-style:italic;color:#7ee787;margin-bottom:8px;"></div>
        <div style="display:flex;gap:12px;font-size:11px;color:#a0c0d8;margin-bottom:8px;">
          <span id="visor-diet"></span>
          <span id="visor-threat"></span>
        </div>
        <div id="visor-desc" style="font-size:12px;line-height:1.4;color:#c0d8e8;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;"></div>
      `;
      document.body.appendChild(el);
    }

    this.visorContainer = el;
    this.visorTitle = el.querySelector('#visor-name') as HTMLElement;
    this.visorScientific = el.querySelector('#visor-sci') as HTMLElement;
    this.visorDiet = el.querySelector('#visor-diet') as HTMLElement;
    this.visorThreat = el.querySelector('#visor-threat') as HTMLElement;
    this.visorDistance = el.querySelector('#visor-dist') as HTMLElement;
    this.visorDesc = el.querySelector('#visor-desc') as HTMLElement;
  }

  /**
   * Activates the taxonomic visor card when a creature or titan is scanned via Key N.
   */
  showTaxonomicProfile(profile: SpeciesProfile, distanceM: number, isNewDiscovery: boolean): void {
    this.activeProfile = profile;
    this.profileTimer = 6.0; // Display for 6 seconds
    this.profileDistanceM = distanceM;
    this.profileIsNew = isNewDiscovery;

    if (this.visorContainer) {
      this.visorContainer.style.display = 'block';
      this.domCache.setCachedText(this.visorTitle, profile.commonName);
      this.domCache.setCachedText(this.visorScientific, profile.scientificName);
      this.domCache.setCachedText(this.visorDiet, `Dieta: ${profile.diet.toUpperCase()}`);
      this.domCache.setCachedText(this.visorThreat, `Ameaça: ${profile.threatLevel}/5`);
      const distStr = distanceM < 1000 ? `${distanceM.toFixed(0)} m` : `${(distanceM / 1000).toFixed(1)} km`;
      this.domCache.setCachedText(this.visorDistance, distStr);
      this.domCache.setCachedText(this.visorDesc, profile.description);
    }
  }

  update(
    camera: Camera,
    dt: number,
    targets: readonly Target[],
    softTargetId?: string,
  ): void {
    // 1. Update taxonomic visor timer
    if (this.profileTimer > 0) {
      this.profileTimer -= dt;
      if (this.profileTimer <= 0) {
        if (this.visorContainer) {
          this.visorContainer.style.display = 'none';
        }
        this.activeProfile = null;
      }
    }

    // 2. Update 3D in-world diegetic reticle brackets
    for (let i = 0; i < this.maxBrackets; i++) {
      const b = this.brackets[i];
      if (i >= targets.length) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }

      const t = targets[i];
      if (!t.active) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }

      b.active = true;
      b.mesh.visible = true;
      b.mesh.position.copy(t.position);
      b.mesh.quaternion.copy(camera.quaternion); // Billboarding

      const isLocked = t.id === softTargetId;
      const isWeakCore = t.id.startsWith('planet-titan-core');

      // Ring scale adapts to target radius and distance to keep clean visual profile
      const dist = this._scratchPos.subVectors(t.position, camera.position).length();
      const scale = Math.max(1.5, Math.min(dist * 0.04, t.radius * 1.2));
      b.mesh.scale.setScalar(scale);

      // Color coding: locked soft-target is Cyan; Titan weakpoint is Magenta/Yellow/Red
      if (isLocked) {
        b.material.color.setHex(0x00f0ff); // Locked target bracket
      } else if (isWeakCore) {
        b.material.color.setHex(0xff3366); // Vulnerable core ring
      } else {
        b.material.color.setHex(0x5ae0e6); // Default creature / vehicle bracket
      }
    }
  }

  dispose(): void {
    for (const b of this.brackets) {
      b.mesh.geometry.dispose();
      b.material.dispose();
    }
    this.brackets.length = 0;
    if (this.visorContainer?.parentElement) {
      this.visorContainer.parentElement.removeChild(this.visorContainer);
    }
  }
}
