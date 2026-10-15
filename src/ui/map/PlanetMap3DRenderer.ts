import type { UniverseLocation } from '../../world/spatial/UniverseLocation';
import { EARTH_LAND_MASK, isLandAt, surfaceColour } from '../../world/planet/EarthLandMask';
import { EarthRiverLayer } from '../../world/planet/EarthRiverLayer';
import { SOLAR_BODY_PROFILES } from '../../world/celestial/CelestialBodyProfile';
import { DEG_TO_RAD, RAD_TO_DEG } from '../../world/spatial/units';

export interface PlanetMap3DRotation {
  readonly yaw: number;
  readonly pitch: number;
}

/** Geodetic coordinates for Manaus marker authority. */
export const MANAUS_GEODETIC = {
  latDeg: -3.119028,
  lonDeg: -60.021731,
  latRad: -3.119028 * DEG_TO_RAD,
  lonRad: -60.021731 * DEG_TO_RAD,
} as const;

/**
 * Dedicated 3D Planet Map Renderer.
 *
 * Runs on its own dedicated 3D canvas so it never collides with 2D canvases.
 * Implements real 3D spherical transformation with interactive drag rotation,
 * wheel zoom, authentic continents, continental Amazon river layer, and real
 * geodetic player/Manaus markers.
 */
export class PlanetMap3DRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;

  // 3D rotation angles (radians)
  // Initially focused roughly on South America (lon ~-60°, lat ~-3°)
  yaw = 1.05; // ~60 degrees East of Greenwich facing West toward South America
  pitch = 0.05;
  zoom = 1.0;

  isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private animOffset = 0;

  // Cached equirectangular texture for high-performance 3D sphere sampling
  private earthTextureCanvas: HTMLCanvasElement | null = null;
  private earthTextureCtx: CanvasRenderingContext2D | null = null;
  private textureReady = false;

  private readonly boundHandlers: { target: EventTarget; type: string; handler: EventListener }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.attachEvents();
    this.initEarthTexture();
  }

  get rotation(): PlanetMap3DRotation {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  get zoomLevel(): number {
    return this.zoom;
  }

  get is3D(): boolean {
    return true;
  }

  show(): void {
    this.canvas.style.display = 'block';
  }

  hide(): void {
    this.canvas.style.display = 'none';
  }

  private attachEvents(): void {
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };

    const onPointerMove = (e: MouseEvent | PointerEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.rotate(dx * 0.006, dy * 0.006);
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.changeZoom(e.deltaY);
    };

    this.addListener(this.canvas, 'pointerdown', onPointerDown as EventListener);
    this.addListener(globalThis.window ?? this.canvas, 'pointermove', onPointerMove as EventListener);
    this.addListener(globalThis.window ?? this.canvas, 'pointerup', onPointerUp as EventListener);
    this.addListener(this.canvas, 'wheel', onWheel as EventListener);
  }

  private addListener(target: EventTarget, type: string, handler: EventListener): void {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler, { passive: type === 'pointerdown' });
    this.boundHandlers.push({ target, type, handler });
  }

  rotate(deltaYaw: number, deltaPitch: number): void {
    this.yaw = (this.yaw + deltaYaw) % (Math.PI * 2);
    // Bounded pitch: clamped strictly within [-maxPitch, maxPitch] to prevent upside-down flip / gimbal lock
    const maxPitch = Math.PI / 2.2; // ~81.8°
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch + deltaPitch));
  }

  changeZoom(deltaY: number): void {
    const factor = deltaY < 0 ? 1.1 : 0.9;
    this.zoom = Math.max(0.6, Math.min(3.5, this.zoom * factor));
  }

  resetRotation(): void {
    this.yaw = 1.05;
    this.pitch = 0.05;
    this.zoom = 1.0;
  }

  focusCoordinates(latDeg: number, lonDeg: number): void {
    this.yaw = -lonDeg * DEG_TO_RAD;
    const maxPitch = Math.PI / 2.2;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, latDeg * DEG_TO_RAD));
  }

  /**
   * Transforms a geodetic lat/lon on the sphere to screen coordinates after yaw and pitch.
   * Returns x, y, and whether the point is on the front visible hemisphere (z > 0).
   */
  project3D(latRad: number, lonRad: number, radiusPx: number, cx: number, cy: number) {
    const cosLat = Math.cos(latRad);
    const x0 = cosLat * Math.sin(lonRad);
    const y0 = Math.sin(latRad);
    const z0 = cosLat * Math.cos(lonRad);

    // Yaw rotation around Y axis
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const x1 = x0 * cosY + z0 * sinY;
    const y1 = y0;
    const z1 = -x0 * sinY + z0 * cosY;

    // Pitch rotation around X axis
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const x2 = x1;
    const y2 = y1 * cosP - z1 * sinP;
    const z2 = y1 * sinP + z1 * cosP;

    const r = radiusPx * this.zoom;
    return {
      screenX: cx + x2 * r,
      screenY: cy - y2 * r,
      z: z2,
      visible: z2 > 0.02,
      normalZ: z2,
    };
  }

  private initEarthTexture(): void {
    try {
      if (typeof document === 'undefined') return;
      const w = 512, h = 256;
      this.earthTextureCanvas = document.createElement('canvas');
      this.earthTextureCanvas.width = w;
      this.earthTextureCanvas.height = h;
      this.earthTextureCtx = this.earthTextureCanvas.getContext('2d');
      if (!this.earthTextureCtx) return;

      const imgData = this.earthTextureCtx.createImageData(w, h);
      const data = imgData.data;
      const scratch: [number, number, number] = [0, 0, 0];

      for (let y = 0; y < h; y++) {
        const latRad = (90 - (y + 0.5) / h * 180) * DEG_TO_RAD;
        for (let x = 0; x < w; x++) {
          const lonRad = ((x + 0.5) / w * 360 - 180) * DEG_TO_RAD;
          const idx = (y * w + x) * 4;
          if (isLandAt(latRad, lonRad)) {
            surfaceColour(latRad, lonRad, scratch);
            data[idx] = Math.round(scratch[0] * 255);
            data[idx + 1] = Math.round(scratch[1] * 255);
            data[idx + 2] = Math.round(scratch[2] * 255);
            data[idx + 3] = 255;
          } else {
            // Ocean blue
            data[idx] = 13;
            data[idx + 1] = 39;
            data[idx + 2] = 76;
            data[idx + 3] = 255;
          }
        }
      }
      this.earthTextureCtx.putImageData(imgData, 0, 0);

      // Draw continental rivers onto the texture
      this.earthTextureCtx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      this.earthTextureCtx.lineWidth = 1.5;
      for (const river of EarthRiverLayer.allRivers) {
        if (!river.coordinates.length) continue;
        this.earthTextureCtx.beginPath();
        for (let i = 0; i < river.coordinates.length; i++) {
          const [lon, lat] = river.coordinates[i];
          const px = ((lon + 180) / 360) * w;
          const py = ((90 - lat) / 180) * h;
          if (i === 0) this.earthTextureCtx.moveTo(px, py);
          else this.earthTextureCtx.lineTo(px, py);
        }
        this.earthTextureCtx.stroke();
      }

      this.textureReady = true;
    } catch {
      this.textureReady = false;
    }
  }

  draw(location: UniverseLocation, _destination?: any): void {
    if (!this.ctx) return;

    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#020617';
    this.ctx.fillRect(0, 0, width, height);

    this.animOffset += 0.01;

    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) / 3;
    const currentRadius = baseRadius * this.zoom;

    const bodyId = location.address.bodyId ?? 'earth';
    const isEarth = bodyId === 'earth';

    // 1. Atmosphere / Outer Rim Glow
    const glow = this.ctx.createRadialGradient(cx, cy, currentRadius * 0.9, cx, cy, currentRadius * 1.25);
    if (isEarth) {
      glow.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      glow.addColorStop(0.6, 'rgba(56, 189, 248, 0.15)');
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    } else {
      const profile = SOLAR_BODY_PROFILES[bodyId];
      const alb = profile?.visual.albedo ?? [0.7, 0.7, 0.7];
      glow.addColorStop(0, `rgba(${Math.round(alb[0]*255)}, ${Math.round(alb[1]*255)}, ${Math.round(alb[2]*255)}, 0.4)`);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, currentRadius * 1.25, 0, Math.PI * 2);
    this.ctx.fill();

    // 2. Base Sphere Fill
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
    this.ctx.clip();

    if (isEarth) {
      this.drawEarthGlobe(cx, cy, currentRadius);
    } else {
      this.drawOtherBodyGlobe(cx, cy, currentRadius, bodyId);
    }

    // Sphere 3D shading (hemisphere light + shadow)
    const sphereShading = this.ctx.createRadialGradient(
      cx - currentRadius * 0.3,
      cy - currentRadius * 0.3,
      currentRadius * 0.1,
      cx,
      cy,
      currentRadius,
    );
    sphereShading.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    sphereShading.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    sphereShading.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    this.ctx.fillStyle = sphereShading;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();

    // 3. Globe Outline
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = isEarth ? '#38bdf8' : '#94a3b8';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // 4. Overlays: Manaus Marker and Player Marker (when on Earth)
    if (isEarth) {
      this.drawManausMarker(cx, cy, baseRadius);
    }

    // Player position marker
    if (location.surface) {
      this.drawPlayerMarker(cx, cy, baseRadius, location.surface.latDeg, location.surface.lonDeg);
    }

    // 5. Title & Diagnostics readout
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '14px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      `PLANET 3D: ${(bodyId).toUpperCase()} · Zoom: ${this.zoom.toFixed(2)}x · Drag para girar`,
      cx,
      height - 24,
    );
  }

  private drawEarthGlobe(cx: number, cy: number, currentRadius: number): void {
    if (!this.ctx) return;

    // Draw ocean background
    const oceanGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, currentRadius);
    oceanGrad.addColorStop(0, '#103766');
    oceanGrad.addColorStop(1, '#081c33');
    this.ctx.fillStyle = oceanGrad;
    this.ctx.fillRect(cx - currentRadius, cy - currentRadius, currentRadius * 2, currentRadius * 2);

    // Draw 3D curved continents and terrain features
    this.drawCurvedContinents(cx, cy, currentRadius);

    // Draw 3D Amazon River and major global rivers
    this.drawCurvedRivers(cx, cy, currentRadius);

    // Draw 3D Latitude and Longitude Graticule lines
    this.draw3DGraticule(cx, cy, currentRadius);
  }

  private drawCurvedContinents(cx: number, cy: number, currentRadius: number): void {
    if (!this.ctx) return;

    // Sample the landmask along spherical grid rings
    // Stepping at 2 degrees resolution creates smooth, crisp continents across all 7 continents
    const stepDeg = 3;
    const scratch: [number, number, number] = [0, 0, 0];

    for (let latDeg = -85; latDeg <= 85; latDeg += stepDeg) {
      const latRad = latDeg * DEG_TO_RAD;
      let inLandSegment = false;
      let segColor = '#2e5c38';

      for (let lonDeg = -180; lonDeg <= 180; lonDeg += stepDeg) {
        const lonRad = lonDeg * DEG_TO_RAD;
        const land = isLandAt(latRad, lonRad);

        if (land) {
          const pt = this.project3D(latRad, lonRad, currentRadius / this.zoom, cx, cy);
          if (pt.visible) {
            surfaceColour(latRad, lonRad, scratch);
            const r = Math.round(scratch[0] * 255);
            const g = Math.round(scratch[1] * 255);
            const b = Math.round(scratch[2] * 255);
            segColor = `rgb(${r}, ${g}, ${b})`;

            // Draw continent dot / patch
            const patchSize = Math.max(1.8, (currentRadius / 90) * pt.normalZ);
            this.ctx.fillStyle = segColor;
            this.ctx.beginPath();
            this.ctx.arc(pt.screenX, pt.screenY, patchSize, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
      }
    }
  }

  private drawCurvedRivers(cx: number, cy: number, currentRadius: number): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = Math.max(1.5, currentRadius * 0.008);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (const river of EarthRiverLayer.allRivers) {
      if (!river.coordinates.length) continue;
      this.ctx.beginPath();
      let started = false;

      for (let i = 0; i < river.coordinates.length; i++) {
        const [lon, lat] = river.coordinates[i];
        const pt = this.project3D(lat * DEG_TO_RAD, lon * DEG_TO_RAD, currentRadius / this.zoom, cx, cy);

        if (pt.visible) {
          if (!started) {
            this.ctx.moveTo(pt.screenX, pt.screenY);
            started = true;
          } else {
            this.ctx.lineTo(pt.screenX, pt.screenY);
          }
        } else {
          started = false;
        }
      }
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private draw3DGraticule(cx: number, cy: number, currentRadius: number): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    this.ctx.lineWidth = 1;

    // Latitudes (every 30°)
    for (let lat = -60; lat <= 60; lat += 30) {
      const latRad = lat * DEG_TO_RAD;
      this.ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 5) {
        const pt = this.project3D(latRad, lon * DEG_TO_RAD, currentRadius / this.zoom, cx, cy);
        if (pt.visible) {
          if (!started) { this.ctx.moveTo(pt.screenX, pt.screenY); started = true; }
          else this.ctx.lineTo(pt.screenX, pt.screenY);
        } else started = false;
      }
      this.ctx.stroke();
    }

    // Longitudes (every 45°)
    for (let lon = -180; lon < 180; lon += 45) {
      const lonRad = lon * DEG_TO_RAD;
      this.ctx.beginPath();
      let started = false;
      for (let lat = -85; lat <= 85; lat += 5) {
        const pt = this.project3D(lat * DEG_TO_RAD, lonRad, currentRadius / this.zoom, cx, cy);
        if (pt.visible) {
          if (!started) { this.ctx.moveTo(pt.screenX, pt.screenY); started = true; }
          else this.ctx.lineTo(pt.screenX, pt.screenY);
        } else started = false;
      }
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawManausMarker(cx: number, cy: number, baseRadius: number): void {
    if (!this.ctx) return;

    const pt = this.project3D(MANAUS_GEODETIC.latRad, MANAUS_GEODETIC.lonRad, baseRadius, cx, cy);
    if (!pt.visible) return;

    // Manaus city glow
    const glow = this.ctx.createRadialGradient(pt.screenX, pt.screenY, 2, pt.screenX, pt.screenY, 14);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.9)');
    glow.addColorStop(0.5, 'rgba(251, 191, 36, 0.4)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(pt.screenX, pt.screenY, 14, 0, Math.PI * 2);
    this.ctx.fill();

    // Core point
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.beginPath();
    this.ctx.arc(pt.screenX, pt.screenY, 3.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Label
    this.ctx.fillStyle = '#fde68a';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('MANAUS', pt.screenX + 8, pt.screenY + 4);
  }

  private drawPlayerMarker(cx: number, cy: number, baseRadius: number, latDeg: number, lonDeg: number): void {
    if (!this.ctx) return;

    const pt = this.project3D(latDeg * DEG_TO_RAD, lonDeg * DEG_TO_RAD, baseRadius, cx, cy);
    if (!pt.visible) return;

    // Ping ring
    const pingRadius = 6 + Math.sin(this.animOffset * 8) * 4;
    this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(pt.screenX, pt.screenY, pingRadius, 0, Math.PI * 2);
    this.ctx.stroke();

    // Core dot
    this.ctx.fillStyle = '#ef4444';
    this.ctx.beginPath();
    this.ctx.arc(pt.screenX, pt.screenY, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  private drawOtherBodyGlobe(cx: number, cy: number, currentRadius: number, bodyId: string): void {
    if (!this.ctx) return;
    const profile = SOLAR_BODY_PROFILES[bodyId];
    const alb = profile?.visual.albedo ?? [0.7, 0.7, 0.7];

    const grad = this.ctx.createRadialGradient(cx - currentRadius * 0.2, cy - currentRadius * 0.2, 0, cx, cy, currentRadius);
    grad.addColorStop(0, `rgb(${Math.round(alb[0]*255)}, ${Math.round(alb[1]*255)}, ${Math.round(alb[2]*255)})`);
    grad.addColorStop(1, `rgb(${Math.round(alb[0]*140)}, ${Math.round(alb[1]*140)}, ${Math.round(alb[2]*140)})`);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(cx - currentRadius, cy - currentRadius, currentRadius * 2, currentRadius * 2);

    // If gas giant, draw atmospheric bands
    if (profile?.visual.bands) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      const bandCount = profile.visual.bands;
      for (let i = 0; i < bandCount; i++) {
        if (i % 2 === 0) {
          const y = cy - currentRadius + (i / bandCount) * currentRadius * 2;
          this.ctx.fillRect(cx - currentRadius, y, currentRadius * 2, (currentRadius * 2) / bandCount);
        }
      }
    }
  }

  dispose(): void {
    for (const { target, type, handler } of this.boundHandlers) {
      target.removeEventListener(type, handler);
    }
    this.boundHandlers.length = 0;
    this.earthTextureCanvas = null;
    this.earthTextureCtx = null;
    this.textureReady = false;
  }
}
