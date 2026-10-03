import { PerspectiveCamera, Quaternion, Vector3 } from 'three/webgpu';
import type { CelestialRenderSample } from './types';
import { CELESTIAL_RENDER_SAFE_RADIUS_M } from './math';
import { smoothRange } from './presentation';

export const CELESTIAL_LABEL_NAMES: Readonly<Record<string, string>> = {
  sun: 'SOL', mercury: 'MERCÚRIO', venus: 'VÊNUS', earth: 'TERRA', moon: 'LUA',
  mars: 'MARTE', jupiter: 'JÚPITER', saturn: 'SATURNO', uranus: 'URANO', neptune: 'NETUNO',
  io: 'IO', europa: 'EUROPA', ganymede: 'GANIMEDES', callisto: 'CALISTO',
  titan: 'TITÃ', enceladus: 'ENCÉLADO', titania: 'TITÂNIA', oberon: 'OBERON', triton: 'TRITÃO',
};

export interface CelestialLabelContext {
  selectedBodyId?: string;
  inTravel?: boolean;
  referenceBodyId?: string;
  /** Derived from live samples, including when the selected body is a sibling moon. */
  parentSystemId?: string;
}

export function projectNavigationMarker(sample: CelestialRenderSample, camera: PerspectiveCamera,
  out = { x: 0, y: 0, offscreen: false }, point = new Vector3(), rotation = new Quaternion()) {
  if (!sample.directionRender.every(Number.isFinite) || !Number.isFinite(sample.proxyDistanceM)
    || sample.proxyDistanceM <= 0 || sample.proxyDistanceM > CELESTIAL_RENDER_SAFE_RADIUS_M) return undefined;
  point.set(...sample.directionRender).applyQuaternion(camera.getWorldQuaternion(rotation).invert());
  const depth = Math.max(.0001, Math.abs(point.z));
  const tangent = Math.tan(camera.fov * Math.PI / 360);
  let x = point.x / (depth * tangent * camera.aspect), y = point.y / (depth * tangent);
  const offscreen = point.z >= 0 || Math.abs(x) > .9 || Math.abs(y) > .85;
  if (offscreen) {
    if (Math.abs(x) + Math.abs(y) < 1e-8) y = -1;
    const scale = Math.max(Math.abs(x) / .9, Math.abs(y) / .85);
    x /= scale; y /= scale;
  }
  out.x = x; out.y = y; out.offscreen = offscreen;
  return out;
}

/** Project the bounded observer-relative point, never the logical system coordinates. */
export function projectCelestialLabel(sample: CelestialRenderSample, camera: PerspectiveCamera) {
  const { directionRender: dir, proxyDistanceM: distance } = sample;
  if (![...dir, distance].every(Number.isFinite) || distance <= 0
    || distance > CELESTIAL_RENDER_SAFE_RADIUS_M || Math.abs(Math.hypot(...dir) - 1) > 1e-6) return undefined;
  const point = new Vector3(...dir).multiplyScalar(distance);
  point.applyQuaternion(camera.getWorldQuaternion(new Quaternion()).invert());
  if (point.z >= -camera.near) return undefined;
  point.applyMatrix4(camera.projectionMatrix);
  if (!point.toArray().every(Number.isFinite) || Math.abs(point.x) > 1 || Math.abs(point.y) > 1
    || point.z < -1 || point.z > 1) return undefined;
  return { x: point.x, y: point.y };
}

/** Selected physical globes retain labels even when their proxy has retired. */
export function celestialLabelOpacity(sample: CelestialRenderSample, context: CelestialLabelContext,
  screen: { x: number; y: number }): number {
  if (sample.bodyId === context.selectedBodyId) return 0.9;
  const diameter = sample.physicalProjectedDiameterPx ?? Infinity;
  if (!sample.visible || !Number.isFinite(diameter)) return 0;
  if (sample.bodyId === 'earth') return context.inTravel ? 0.7 * (1 - smoothRange(diameter, 6, 18)) : 0;
  if (sample.bodyId === 'moon') {
    const earthMoonContext = context.inTravel && (context.referenceBodyId === 'earth' || context.referenceBodyId === 'moon'
      || context.selectedBodyId === 'earth' || context.selectedBodyId === 'moon');
    return earthMoonContext ? 0.65 * (1 - smoothRange(diameter, 30, 80)) : 0;
  }
  if (sample.parentId && sample.parentId !== 'sun') {
    const nearby = context.inTravel && (context.referenceBodyId === sample.parentId
      || context.referenceBodyId === sample.bodyId || context.selectedBodyId === sample.parentId
      || context.parentSystemId === sample.parentId);
    return nearby ? 0.65 * smoothRange(diameter, 2, 8) : 0;
  }
  if (sample.profile?.bodyClass === 'star') {
    return context.inTravel && diameter < 80 ? 0.55 * smoothRange(Math.hypot(screen.x, screen.y), 0.35, 0.6) : 0;
  }
  const priority = sample.profile?.visual.labelPriority ?? 0;
  return 0.6 * smoothRange(diameter, 12 + (10 - priority), 30);
}

export class CelestialLabelLayer {
  private readonly container: HTMLDivElement;
  private readonly labels = new Map<string, HTMLDivElement>();
  private readonly marker = document.createElement('div');
  private readonly markerPoint = new Vector3();
  private readonly markerRotation = new Quaternion();
  private readonly markerScreen = { x: 0, y: 0, offscreen: false };

  constructor(parentDom: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'celestial-labels';
    Object.assign(this.container.style, { position: 'absolute', inset: '0', pointerEvents: 'none',
      overflow: 'hidden', zIndex: '10' });
    parentDom.appendChild(this.container);
    this.marker.id = 'navigation-lock-marker';
    Object.assign(this.marker.style, { position: 'absolute', color: '#facc15', fontSize: '24px',
      transform: 'translate(-50%, -50%)', textShadow: '0 0 3px black' });
    this.container.appendChild(this.marker);
  }

  private getLabel(id: string): HTMLDivElement {
    let el = this.labels.get(id);
    if (!el) {
      el = document.createElement('div');
      Object.assign(el.style, { position: 'absolute', color: '#dce6ed', fontFamily: 'monospace',
        fontSize: '12px', letterSpacing: '1px', textShadow: '1px 1px 2px #000',
        transform: 'translate(-50%, -100%)', whiteSpace: 'nowrap', opacity: '0', transition: 'opacity 0.2s ease-out' });
      el.dataset.bodyId = id;
      this.container.appendChild(el);
      this.labels.set(id, el);
    }
    return el;
  }

  update(samples: readonly CelestialRenderSample[], camera: PerspectiveCamera, context: CelestialLabelContext = {}): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const seen = new Set<string>();
    const selected = samples.find(sample => sample.bodyId === context.selectedBodyId);
    const marker = selected && projectNavigationMarker(selected, camera, this.markerScreen,
      this.markerPoint, this.markerRotation);
    this.marker.hidden = !marker;
    if (marker && selected) {
      this.marker.dataset.bodyId = selected.bodyId;
      this.marker.dataset.offscreen = String(marker.offscreen);
      this.marker.textContent = marker.offscreen ? '➤' : '⌖';
      this.marker.style.left = `${(marker.x + 1) * width / 2}px`;
      this.marker.style.top = `${(1 - marker.y) * height / 2}px`;
      this.marker.style.transform = `translate(-50%, -50%)${marker.offscreen
        ? ` rotate(${Math.atan2(-marker.y, marker.x)}rad)` : ''}`;
    }
    const reference = samples.find(sample => sample.bodyId === context.referenceBodyId);
    const effectiveContext = { ...context, parentSystemId: context.parentSystemId
      ?? (selected?.parentId !== 'sun' ? selected?.parentId : undefined)
      ?? (reference?.parentId !== 'sun' ? reference?.parentId : undefined) };
    const occupied: LabelRect[] = [];
    const ranked = [...samples].sort((a, b) => Number(b.bodyId === context.selectedBodyId) - Number(a.bodyId === context.selectedBodyId)
      || (b.profile?.visual.labelPriority ?? 0) - (a.profile?.visual.labelPriority ?? 0)
      || (b.physicalProjectedDiameterPx ?? 0) - (a.physicalProjectedDiameterPx ?? 0));
    for (const sample of ranked) {
      const screen = projectCelestialLabel(sample, camera);
      if (!screen || width <= 0 || height <= 0) continue;
      const opacity = celestialLabelOpacity(sample, effectiveContext, screen);
      if (opacity <= 0) continue;
      const el = this.getLabel(sample.bodyId);
      const name = CELESTIAL_LABEL_NAMES[sample.bodyId] ?? sample.bodyId.toUpperCase();
      el.textContent = (sample.physicalProjectedDiameterPx ?? Infinity) < 6 ? `• ${name}` : name;
      const halfLabel = (el.offsetWidth || el.textContent.length * 8) / 2;
      if (width < halfLabel * 2 + 16 || height < 40) continue;
      const x = (screen.x + 1) * width / 2;
      const y = (1 - screen.y) * height / 2 - 10;
      const rect = { x: Math.max(halfLabel + 8, Math.min(width - halfLabel - 8, x)),
        y: Math.max(24, Math.min(height - 8, y)), halfWidth: halfLabel };
      if (!reserveLabelRect(rect, occupied)) continue;
      el.style.left = `${rect.x}px`;
      el.style.top = `${rect.y}px`;
      el.style.opacity = String(opacity);
      el.style.visibility = 'visible';
      seen.add(sample.bodyId);
    }
    for (const [id, el] of this.labels) {
      if (!seen.has(id)) {
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
      }
    }
  }

  dispose(): void { this.container.remove(); this.labels.clear(); }
}

export interface LabelRect { x: number; y: number; halfWidth: number; }
/** Higher-priority labels reserve space first; lower ones cannot make a DOM pile. */
export function reserveLabelRect(rect: LabelRect, occupied: LabelRect[]): boolean {
  if (occupied.some(r => Math.abs(r.y - rect.y) < 22 && Math.abs(r.x - rect.x) < r.halfWidth + rect.halfWidth + 10)) return false;
  occupied.push(rect); return true;
}
