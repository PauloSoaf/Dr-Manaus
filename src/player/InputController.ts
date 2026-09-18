export class InputController {
  enabled = true;
  readonly mouseDelta = { x: 0, y: 0 };
  private readonly keys = new Set<string>();
  private readonly edges = new Set<string>();
  private dragging = false;
  private readonly controller = new AbortController();

  constructor(readonly canvas: HTMLCanvasElement) {
    const options = { signal: this.controller.signal };
    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (['Space', 'Tab', 'F3', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault();
      if (!this.keys.has(event.code)) this.edges.add(event.code);
      this.keys.add(event.code);
    }, options);
    window.addEventListener('keyup', (event) => this.keys.delete(event.code), options);
    window.addEventListener('blur', () => this.clear(), options);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), options);
    canvas.addEventListener('pointerdown', (event) => {
      if (!this.enabled) return;
      const code = `Mouse${event.button}`;
      this.keys.add(code);
      this.edges.add(code);
      this.dragging = true;
      if (event.button === 0 && document.pointerLockElement !== canvas) {
        // Pointer lock is optional: dragging also works in embedded browsers.
        try { void canvas.requestPointerLock()?.catch(() => undefined); } catch { /* Drag fallback. */ }
      }
    }, options);
    window.addEventListener('pointerup', (event) => {
      this.keys.delete(`Mouse${event.button}`);
      this.dragging = false;
    }, options);
    window.addEventListener('pointermove', (event) => {
      if (!this.enabled || (!this.dragging && !this.pointerLocked)) return;
      this.mouseDelta.x += event.movementX;
      this.mouseDelta.y += event.movementY;
    }, options);
    document.addEventListener('pointerlockchange', () => { if (!this.pointerLocked) this.clear(); }, options);
  }

  get pointerLocked(): boolean { return document.pointerLockElement === this.canvas; }
  held(code: string): boolean { return this.enabled && this.keys.has(code); }
  pressed(code: string): boolean { return this.enabled && this.edges.has(code); }
  consume(code: string): boolean {
    const active = this.pressed(code);
    this.edges.delete(code);
    return active;
  }
  endFrame(): void { this.edges.clear(); this.mouseDelta.x = this.mouseDelta.y = 0; }
  clear(): void { this.keys.clear(); this.edges.clear(); this.mouseDelta.x = this.mouseDelta.y = 0; }
  dispose(): void { this.controller.abort(); this.clear(); }
}
