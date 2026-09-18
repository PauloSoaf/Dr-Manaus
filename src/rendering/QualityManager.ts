import type { RendererManager } from './RendererManager';
export class QualityManager {
  enabled = true;
  averageMs = 16.7;
  private elapsed = 0;
  private cooldown = 8;
  level = 0;
  constructor(private renderer: RendererManager, private changed: (level: number) => void) {}
  update(dt: number) {
    this.averageMs += (Math.min(dt * 1000, 150) - this.averageMs) * .025;
    if (!this.enabled || document.hidden) return;
    this.elapsed += dt;
    if (this.elapsed < this.cooldown) return;
    this.elapsed = 0;
    const previous = this.level;
    if (this.averageMs > 26 && this.level < 3) this.level++;
    else if (this.averageMs < 16.5 && this.level > 0) this.level--;
    if (previous !== this.level) {
      this.renderer.renderScale = 1 - this.level * .12;
      this.renderer.resize(); this.changed(this.level); this.cooldown = 12;
    }
  }
  reset() { this.level = 0; this.elapsed = 0; this.renderer.renderScale = 1; this.renderer.resize(); this.changed(0); }
}
