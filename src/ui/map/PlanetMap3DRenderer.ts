import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { UniverseLocation } from '../../world/spatial/UniverseLocation';
import { isLandAt, surfaceColour } from '../../world/planet/EarthLandMask';
import { EarthRiverLayer } from '../../world/planet/EarthRiverLayer';
import { DEG_TO_RAD, RAD_TO_DEG } from '../../world/spatial/units';
import { MANAUS_ANCHOR, MANAUS_ANCHOR_GEODETIC } from '../../world/spatial/ManausFrameAdapter';

export interface PlanetMap3DRotation {
  readonly yaw: number;
  readonly pitch: number;
}

/**
 * Geodetic coordinates for Manaus marker authority.
 * Strictly imports and re-exports canonical project geospatial authority.
 */
export const MANAUS_GEODETIC = {
  latDeg: MANAUS_ANCHOR.latDeg, // -3.130333
  lonDeg: MANAUS_ANCHOR.lonDeg, // -60.022528
  latRad: MANAUS_ANCHOR_GEODETIC.latRad,
  lonRad: MANAUS_ANCHOR_GEODETIC.lonRad,
} as const;

/**
 * True 3D GPU Planet Map Renderer.
 *
 * Runs an isolated Three.js 3D scene on #planet-3d-canvas.
 * Features an authentic textured sphere geometry, 3D line-segment continental rivers,
 * drag rotation, camera zoom, depth-tested far-hemisphere marker occlusion,
 * and clean resource lifecycle disposal.
 */
export class PlanetMap3DRenderer {
  canvas: HTMLCanvasElement;
  readonly mode: 'gpu-3d' | '2d-fallback';

  // Three.js 3D resources
  readonly scene: Scene | null = null;
  readonly camera: PerspectiveCamera | null = null;
  readonly renderer: WebGLRenderer | null = null;
  readonly globeGroup: Group | null = null;
  readonly globeMesh: Mesh<SphereGeometry, MeshBasicMaterial> | null = null;
  readonly manausMarker: Mesh | null = null;
  readonly playerMarker: Mesh | null = null;
  readonly riverLines: LineSegments | null = null;
  private earthTexture: CanvasTexture | null = null;

  // 3D rotation angles (radians)
  // Initially focused on South America (lon ~-60°, lat ~-3°)
  yaw = 1.05;
  pitch = 0.05;
  zoom = 1.0;

  isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private boundHandlers: { target: EventTarget; type: string; handler: EventListener }[] = [];
  private fallbackCtx: CanvasRenderingContext2D | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    let webglRenderer: WebGLRenderer | null = null;
    try {
      gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as any;
      if (gl) {
        webglRenderer = new WebGLRenderer({
          canvas,
          context: gl,
          alpha: true,
          antialias: true,
        });
        webglRenderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
      }
    } catch {
      webglRenderer = null;
      gl = null;
    }

    if (webglRenderer && gl) {
      this.mode = 'gpu-3d';
      this.renderer = webglRenderer;
      this.scene = new Scene();
      this.camera = new PerspectiveCamera(45, 1, 0.1, 50);
      this.camera.position.set(0, 0, 2.6);

      this.globeGroup = new Group();
      this.globeGroup.name = 'planet-3d-globe-group';
      this.scene.add(this.globeGroup);

      // Build real land/ocean texture
      const textureCanvas = this.generateEarthTextureCanvas(1024, 512);
      this.earthTexture = new CanvasTexture(textureCanvas);

      // 3D Sphere geometry (unit sphere radius = 1)
      const geometry = new SphereGeometry(1, 64, 32);
      const material = new MeshBasicMaterial({
        map: this.earthTexture,
      });

      this.globeMesh = new Mesh(geometry, material);
      this.globeMesh.name = 'planet-3d-sphere-mesh';
      this.globeGroup.add(this.globeMesh);

      // 3D River line segments on sphere surface
      this.riverLines = this.buildRiverLineSegments(1.002);
      if (this.riverLines) {
        this.globeGroup.add(this.riverLines);
      }

      // Manaus 3D marker on sphere surface
      this.manausMarker = this.createMarkerMesh(
        MANAUS_GEODETIC.latRad,
        MANAUS_GEODETIC.lonRad,
        1.005,
        0xfbbf24 // amber gold
      );
      this.manausMarker.name = 'manaus-3d-marker';
      this.globeGroup.add(this.manausMarker);

      // Player 3D marker
      this.playerMarker = this.createMarkerMesh(
        MANAUS_GEODETIC.latRad,
        MANAUS_GEODETIC.lonRad,
        1.006,
        0x38bdf8 // cyan blue
      );
      this.playerMarker.name = 'player-3d-marker';
      this.globeGroup.add(this.playerMarker);

      // Lighting
      const ambient = new AmbientLight(0xffffff, 0.9);
      const sun = new DirectionalLight(0xffffff, 1.2);
      sun.position.set(3, 2, 4);
      this.scene.add(ambient);
      this.scene.add(sun);
    } else {
      this.mode = '2d-fallback';
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.globeGroup = null;
      this.globeMesh = null;
      this.manausMarker = null;
      this.playerMarker = null;
      this.riverLines = null;

      // When WebGLRenderer throws or WebGL is unsupported, try 2D context.
      // If gl was already acquired by this canvas element, browsers disallow switching
      // context type and getContext('2d') returns null per HTML spec.
      // Replace the canvas element with a fresh, clean element preserving attributes and DOM attachment.
      let ctx: CanvasRenderingContext2D | null = null;
      try {
        ctx = this.canvas.getContext('2d');
      } catch {
        ctx = null;
      }

      if (!ctx) {
        const doc = this.canvas.ownerDocument || (typeof document !== 'undefined' ? document : null);
        if (doc && typeof doc.createElement === 'function') {
          try {
            const replacement = doc.createElement('canvas');
            if (this.canvas.id) replacement.id = this.canvas.id;
            if (this.canvas.className) replacement.className = this.canvas.className;
            replacement.width = this.canvas.width;
            replacement.height = this.canvas.height;
            if (this.canvas.style?.cssText) {
              replacement.style.cssText = this.canvas.style.cssText;
            } else if (this.canvas.style) {
              replacement.style.display = this.canvas.style.display;
            }
            if (this.canvas.parentElement) {
              this.canvas.parentElement.replaceChild(replacement, this.canvas);
            }
            this.canvas = replacement;
            ctx = this.canvas.getContext('2d');
          } catch {
            // Safe fallback
          }
        }
      }
      this.fallbackCtx = ctx;
    }

    this.attachEvents();
  }

  get rotation(): PlanetMap3DRotation {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  get zoomLevel(): number {
    return this.zoom;
  }

  get is3D(): boolean {
    return this.mode === 'gpu-3d';
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
    // Bounded pitch: clamped strictly within [-maxPitch, maxPitch] to prevent upside-down flip
    const maxPitch = Math.PI / 2.2; // ~81.8°
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch + deltaPitch));

    if (this.globeGroup) {
      this.globeGroup.rotation.y = this.yaw;
      this.globeGroup.rotation.x = this.pitch;
    }
  }

  changeZoom(deltaY: number): void {
    const factor = deltaY < 0 ? 1.15 : 0.87;
    this.zoom = Math.max(0.6, Math.min(3.5, this.zoom * factor));
    if (this.camera) {
      this.camera.position.z = 2.6 / this.zoom;
    }
  }

  resetRotation(): void {
    this.yaw = 1.05;
    this.pitch = 0.05;
    this.zoom = 1.0;
    if (this.globeGroup) {
      this.globeGroup.rotation.y = this.yaw;
      this.globeGroup.rotation.x = this.pitch;
    }
    if (this.camera) {
      this.camera.position.z = 2.6;
    }
  }

  focusCoordinates(latDeg: number, lonDeg: number): void {
    this.yaw = -lonDeg * DEG_TO_RAD;
    const maxPitch = Math.PI / 2.2;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, latDeg * DEG_TO_RAD));
    if (this.globeGroup) {
      this.globeGroup.rotation.y = this.yaw;
      this.globeGroup.rotation.x = this.pitch;
    }
  }

  focusManaus(): void {
    this.focusCoordinates(MANAUS_GEODETIC.latDeg, MANAUS_GEODETIC.lonDeg);
  }

  /**
   * Generates a high-quality equirectangular land/ocean texture from authentic landmask.
   */
  private generateEarthTextureCanvas(width = 1024, height = 512): HTMLCanvasElement {
    if (typeof document === 'undefined') {
      return {} as HTMLCanvasElement;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;
    const scratch: [number, number, number] = [0, 0, 0];

    for (let y = 0; y < height; y++) {
      const latRad = (90 - (y + 0.5) / height * 180) * DEG_TO_RAD;
      for (let x = 0; x < width; x++) {
        const lonRad = ((x + 0.5) / width * 360 - 180) * DEG_TO_RAD;
        const idx = (y * width + x) * 4;

        if (isLandAt(latRad, lonRad)) {
          surfaceColour(latRad, lonRad, scratch);
          data[idx] = Math.round(scratch[0] * 255);
          data[idx + 1] = Math.round(scratch[1] * 255);
          data[idx + 2] = Math.round(scratch[2] * 255);
          data[idx + 3] = 255;
        } else {
          // Deep ocean blue
          data[idx] = 12;
          data[idx + 1] = 40;
          data[idx + 2] = 80;
          data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Rasterize authentic Natural Earth rivers onto the texture for crisp continent view
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const river of EarthRiverLayer.allRivers) {
      const lines = EarthRiverLayer.getRiverLines(river);
      for (const line of lines) {
        if (line.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < line.length; i++) {
          const [lon, lat] = line[i];
          const px = ((lon + 180) / 360) * width;
          const py = ((90 - lat) / 180) * height;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }

    return canvas;
  }

  /**
   * Subdivides spherical line segments along great-circle arc on unit sphere using SLERP.
   */
  private subdivideGreatCircleSpherical(points: readonly (readonly [number, number])[]): [number, number][] {
    if (points.length < 2) return points.map(p => [p[0], p[1]]);
    const result: [number, number][] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const [lon1, lat1] = points[i];
      const [lon2, lat2] = points[i + 1];
      result.push([lon1, lat1]);

      const p1 = this.latLonToSphere(lat1 * DEG_TO_RAD, lon1 * DEG_TO_RAD, 1);
      const p2 = this.latLonToSphere(lat2 * DEG_TO_RAD, lon2 * DEG_TO_RAD, 1);

      const dot = Math.max(-1, Math.min(1, p1.dot(p2)));
      const omega = Math.acos(dot);
      const maxAngle = 0.05; // ~2.8 degrees

      if (omega > maxAngle && omega < Math.PI - 1e-4) {
        const steps = Math.min(12, Math.ceil(omega / maxAngle));
        const sinOmega = Math.sin(omega);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const A = Math.sin((1 - t) * omega) / sinOmega;
          const B = Math.sin(t * omega) / sinOmega;
          const v = new Vector3()
            .addScaledVector(p1, A)
            .addScaledVector(p2, B)
            .normalize();

          const phi = Math.acos(Math.max(-1, Math.min(1, v.y)));
          const theta = Math.atan2(v.z, -v.x);
          const interpLatRad = Math.PI / 2 - phi;
          const interpLonRad = theta - Math.PI / 2;

          result.push([interpLonRad * RAD_TO_DEG, interpLatRad * RAD_TO_DEG]);
        }
      }
    }
    const last = points[points.length - 1];
    result.push([last[0], last[1]]);
    return result;
  }

  /**
   * Builds 3D line segments for continental rivers on the 3D sphere.
   */
  private buildRiverLineSegments(radius = 1.002): LineSegments | null {
    const coords: number[] = [];
    for (const river of EarthRiverLayer.allRivers) {
      const lines = EarthRiverLayer.getRiverLines(river);
      for (const line of lines) {
        if (line.length < 2) continue;
        const arc = this.subdivideGreatCircleSpherical(line);
        for (let i = 0; i < arc.length - 1; i++) {
          const [lon1, lat1] = arc[i];
          const [lon2, lat2] = arc[i + 1];

          const p1 = this.latLonToSphere(lat1 * DEG_TO_RAD, lon1 * DEG_TO_RAD, radius);
          const p2 = this.latLonToSphere(lat2 * DEG_TO_RAD, lon2 * DEG_TO_RAD, radius);

          coords.push(p1.x, p1.y, p1.z);
          coords.push(p2.x, p2.y, p2.z);
        }
      }
    }
    if (!coords.length) return null;

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(coords), 3));
    const material = new LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      depthWrite: false,
    });
    return new LineSegments(geometry, material);
  }

  private latLonToSphere(latRad: number, lonRad: number, radius = 1): Vector3 {
    const phi = Math.PI / 2 - latRad;
    const theta = lonRad + Math.PI / 2;
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new Vector3(x, y, z);
  }

  private createMarkerMesh(latRad: number, lonRad: number, radius = 1.005, colorHex = 0xfbbf24): Mesh {
    const markerGeo = new SphereGeometry(0.015, 12, 12);
    const markerMat = new MeshBasicMaterial({
      color: colorHex,
      depthTest: true,
      depthWrite: false,
    });
    const mesh = new Mesh(markerGeo, markerMat);
    const pos = this.latLonToSphere(latRad, lonRad, radius);
    mesh.position.copy(pos);
    return mesh;
  }

  /**
   * Projects a geodetic point (latRad, lonRad) to screen space after yaw and pitch.
   * Accurately calculates normalZ to determine front-hemisphere visibility (normalZ > 0).
   */
  project3D(latRad: number, lonRad: number, radiusPx: number, cx: number, cy: number) {
    const cosLat = Math.cos(latRad);
    const x0 = cosLat * Math.sin(lonRad);
    const y0 = Math.sin(latRad);
    const z0 = cosLat * Math.cos(lonRad);

    // Yaw rotation
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const x1 = x0 * cosY + z0 * sinY;
    const y1 = y0;
    const z1 = -x0 * sinY + z0 * cosY;

    // Pitch rotation
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
      visible: z2 > 0.05,
      normalZ: z2,
    };
  }

  draw(location: UniverseLocation, _destination?: any): void {
    if (this.mode === 'gpu-3d' && this.renderer && this.scene && this.camera && this.globeGroup) {
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width || this.canvas.width || 800);
      const height = Math.max(1, rect.height || this.canvas.height || 600);

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);

      this.globeGroup.rotation.y = this.yaw;
      this.globeGroup.rotation.x = this.pitch;

      // Update player marker if surface location is present
      if (location.surface && this.playerMarker) {
        const playerPos = this.latLonToSphere(
          location.surface.latDeg * DEG_TO_RAD,
          location.surface.lonDeg * DEG_TO_RAD,
          1.006
        );
        this.playerMarker.position.copy(playerPos);
      }

      this.renderer.render(this.scene, this.camera);
    } else if (this.mode === '2d-fallback' && this.fallbackCtx) {
      // Clean, functional, labeled 2D fallback with landmasses, rivers and markers
      const ctx = this.fallbackCtx;
      const w = this.canvas.width || 800;
      const h = this.canvas.height || 600;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.38 * this.zoom;

      ctx.save();
      ctx.clearRect(0, 0, w, h);

      // Deep space background
      ctx.fillStyle = '#080c16';
      ctx.fillRect(0, 0, w, h);

      // Earth disk (ocean blue)
      ctx.fillStyle = '#0c2850';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Atmosphere rim
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Clip to Earth disk for globe features
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
      ctx.clip();

      // Sample continental land points on front hemisphere
      ctx.fillStyle = 'rgba(34, 197, 94, 0.45)';
      const step = 6;
      for (let lat = -84; lat <= 84; lat += step) {
        for (let lon = -180; lon < 180; lon += step) {
          const latR = lat * DEG_TO_RAD;
          const lonR = lon * DEG_TO_RAD;
          if (isLandAt(latR, lonR)) {
            const proj = this.project3D(latR, lonR, r, cx, cy);
            if (proj.visible) {
              const spot = Math.max(2, 3.5 * this.zoom);
              ctx.fillRect(proj.screenX - spot / 2, proj.screenY - spot / 2, spot, spot);
            }
          }
        }
      }

      // Draw continental rivers on front hemisphere
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(1, 1.5 * this.zoom);
      for (const river of EarthRiverLayer.allRivers) {
        const lines = EarthRiverLayer.getRiverLines(river);
        for (const line of lines) {
          if (line.length < 2) continue;
          ctx.beginPath();
          let inPath = false;
          for (let i = 0; i < line.length; i++) {
            const [lon, lat] = line[i];
            const proj = this.project3D(lat * DEG_TO_RAD, lon * DEG_TO_RAD, r, cx, cy);
            if (proj.visible) {
              if (!inPath) {
                ctx.moveTo(proj.screenX, proj.screenY);
                inPath = true;
              } else {
                ctx.lineTo(proj.screenX, proj.screenY);
              }
            } else {
              inPath = false;
            }
          }
          if (inPath) ctx.stroke();
        }
      }

      ctx.restore(); // unclip

      // Manaus marker
      const manausProj = this.project3D(MANAUS_GEODETIC.latRad, MANAUS_GEODETIC.lonRad, r, cx, cy);
      if (manausProj.visible) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(manausProj.screenX, manausProj.screenY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('Manaus', manausProj.screenX + 8, manausProj.screenY + 4);
      }

      // Player marker
      if (location.surface) {
        const playerProj = this.project3D(
          location.surface.latDeg * DEG_TO_RAD,
          location.surface.lonDeg * DEG_TO_RAD,
          r,
          cx,
          cy
        );
        if (playerProj.visible) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(playerProj.screenX, playerProj.screenY, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('Jogador', playerProj.screenX + 8, playerProj.screenY + 4);
        }
      }

      // Diagnostic banner
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = '10px monospace';
      ctx.fillText('MODO: 2D FALLBACK (WebGL indisponível)', 12, 20);

      ctx.restore();
    }
  }

  dispose(): void {
    // Detach all DOM event handlers
    for (const { target, type, handler } of this.boundHandlers) {
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener(type, handler);
      }
    }
    this.boundHandlers = [];

    // Dispose Three.js GPU resources
    if (this.globeMesh) {
      this.globeMesh.geometry.dispose();
      this.globeMesh.material.dispose();
    }
    if (this.riverLines) {
      this.riverLines.geometry.dispose();
      (this.riverLines.material as any).dispose();
    }
    if (this.manausMarker) {
      (this.manausMarker as any).geometry?.dispose();
      (this.manausMarker as any).material?.dispose();
    }
    if (this.playerMarker) {
      (this.playerMarker as any).geometry?.dispose();
      (this.playerMarker as any).material?.dispose();
    }
    if (this.earthTexture) {
      this.earthTexture.dispose();
      this.earthTexture = null;
    }
    if (this.scene) {
      this.scene.clear();
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }
}
