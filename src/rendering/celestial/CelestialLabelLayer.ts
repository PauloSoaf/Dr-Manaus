import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import type { CelestialRenderSample } from './types';

export class CelestialLabelLayer {
  private readonly container: HTMLDivElement;
  private readonly labels = new Map<string, HTMLDivElement>();
  private readonly worldPosition = new Vector3();

  constructor(parentDom: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.overflow = 'hidden';
    this.container.style.zIndex = '10'; // Above canvas but below UI
    parentDom.appendChild(this.container);
  }

  private getLabel(id: string, text: string): HTMLDivElement {
    let el = this.labels.get(id);
    if (!el) {
      el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.color = '#ffffff';
      el.style.fontFamily = 'monospace';
      el.style.fontSize = '12px';
      el.style.fontWeight = 'bold';
      el.style.letterSpacing = '1px';
      el.style.textShadow = '1px 1px 2px #000000';
      el.style.transform = 'translate(-50%, -100%)';
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.2s ease-out';
      el.textContent = text;
      this.container.appendChild(el);
      this.labels.set(id, el);
    }
    return el;
  }

  update(samples: readonly CelestialRenderSample[], camera: PerspectiveCamera, selectedBodyId?: string): void {
    const halfWidth = this.container.clientWidth / 2;
    const halfHeight = this.container.clientHeight / 2;

    const seen = new Set<string>();

    for (const sample of samples) {
      if (!sample.visible || !sample.profile) continue;

      // Distance and projection rules
      // Do not show for physical globes taking up the whole screen, or stars
      if (sample.angularRadiusRad > Math.PI / 4) continue;
      
      const isSelected = sample.bodyId === selectedBodyId;
      
      // Label visibility policy
      let showLabel = false;
      const bodyClass = sample.profile.bodyClass;
      
      if (isSelected) {
        showLabel = true;
      } else if (bodyClass !== 'star') {
        const priority = sample.profile.visual.labelPriority ?? 0;
        // Priority threshold or specific heuristics
        if (priority >= 8) { // Earth, Moon
          showLabel = true;
        } else if (priority >= 4 && sample.angularRadiusRad > 0.005) { // Planets when close
          showLabel = true;
        }
      }

      if (!showLabel) continue;

      const dir = sample.directionRender;
      // Position is camera-relative, but we project it from the actual camera position
      // Wait, directionRender is relative to camera.
      this.worldPosition.set(dir[0], dir[1], dir[2]).multiplyScalar(sample.proxyDistanceM);
      this.worldPosition.add(camera.position);

      this.worldPosition.project(camera);

      // Behind camera?
      if (this.worldPosition.z > 1.0) continue;

      // Inside viewport? (allow some margin)
      if (this.worldPosition.x < -1.2 || this.worldPosition.x > 1.2 ||
          this.worldPosition.y < -1.2 || this.worldPosition.y > 1.2) {
        continue;
      }

      const x = (this.worldPosition.x * halfWidth) + halfWidth;
      const y = -(this.worldPosition.y * halfHeight) + halfHeight;

      let name = sample.bodyId.toUpperCase();
      const ptNames: Record<string, string> = {
        sun: 'SOL', mercury: 'MERCÚRIO', venus: 'VÊNUS', earth: 'TERRA', moon: 'LUA',
        mars: 'MARTE', jupiter: 'JÚPITER', saturn: 'SATURNO', uranus: 'URANO', neptune: 'NETUNO'
      };
      name = ptNames[sample.bodyId] ?? name;

      const el = this.getLabel(sample.bodyId, name);
      // Add a dot if very small and not selected?
      const text = sample.angularRadiusRad < 0.01 && sample.bodyId !== 'sun' ? `• ${name}` : name;
      if (el.textContent !== text) el.textContent = text;
      
      el.style.left = `${x}px`;
      el.style.top = `${y - 10}px`; // slightly above
      el.style.opacity = '0.7';
      seen.add(sample.bodyId);
    }

    // Hide unseen
    for (const [id, el] of this.labels.entries()) {
      if (!seen.has(id)) {
        el.style.opacity = '0';
      }
    }
  }

  dispose(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.labels.clear();
  }
}
