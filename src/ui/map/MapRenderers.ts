import type { UniverseLocation } from '../../world/spatial/UniverseLocation';
import type { Vector3 } from 'three/webgpu';

export interface MapRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  show(): void;
  hide(): void;
  draw(location: UniverseLocation, destination?: Vector3): void;
}

export abstract class BaseMapRenderer implements MapRenderer {
  ctx: CanvasRenderingContext2D;
  
  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  show(): void {
    this.canvas.style.display = 'block';
  }

  hide(): void {
    this.canvas.style.display = 'none';
  }

  abstract draw(location: UniverseLocation, destination?: Vector3): void;

  protected clear(color: string = '#000') {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

export class SurfaceMapRenderer extends BaseMapRenderer {
  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('transparent');
  }
}

export class PlanetMapRenderer extends BaseMapRenderer {
  private offset = 0;
  
  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('#020617');
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 3;

    this.offset += 0.005;

    // Glow
    const gradient = this.ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.2);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(cx - r*2, cy - r*2, r*4, r*4);

    // Globe
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Lat/Lon lines
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    this.ctx.beginPath();
    for (let i = -4; i <= 4; i++) {
      const y = cy + (i / 4) * r * 0.9;
      this.ctx.moveTo(cx - Math.sqrt(r*r - (y-cy)*(y-cy)), y);
      this.ctx.lineTo(cx + Math.sqrt(r*r - (y-cy)*(y-cy)), y);
    }
    this.ctx.stroke();

    // Player position
    if (location.surface) {
      const { latDeg, lonDeg } = location.surface;
      // Convert lat/lon to screen pos roughly
      const px = cx + (lonDeg / 180) * r;
      const py = cy - (latDeg / 90) * r;
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy <= r * r * 1.05) { // Check if on visible face of the planet sphere
        this.ctx.beginPath();
        this.ctx.arc(px, py, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ef4444';
        this.ctx.fill();
        
        // Ping ring
        this.ctx.beginPath();
        this.ctx.arc(px, py, 8 + Math.sin(this.offset * 10) * 4, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        this.ctx.stroke();
      }
    }

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '16px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`PLANET: ${location.address.bodyId || 'UNKNOWN'}`, cx, h - 40);
  }
}

import { SOLAR_SYSTEM_BODIES } from '../../world/celestial/CelestialBody';
import { OfflineEphemeris } from '../../world/celestial/OfflineEphemeris';

const AU_METRES = 1.495978707e11;

const BODY_COLORS: Record<string, string> = {
  sun: '#facc15',
  mercury: '#94a3b8',
  venus: '#fde047',
  earth: '#38bdf8',
  moon: '#cbd5e1',
  mars: '#f87171',
  jupiter: '#fdba74',
  saturn: '#fef08a',
  uranus: '#67e8f9',
  neptune: '#2563eb',
};

export class SystemMapRenderer extends BaseMapRenderer {
  private readonly ephemeris = new OfflineEphemeris();
  private simTime = 0;

  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('#020617');
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.42;

    this.simTime += 86400 * 0.1; // advance time ~0.1 day per frame for visual orbital motion

    // System grid
    this.ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
    this.ctx.beginPath();
    for (let i = 0; i < w; i += 50) {
      this.ctx.moveTo(i, 0); this.ctx.lineTo(i, h);
    }
    for (let i = 0; i < h; i += 50) {
      this.ctx.moveTo(0, i); this.ctx.lineTo(w, i);
    }
    this.ctx.stroke();

    // Draw Sun at center
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    this.ctx.fillStyle = BODY_COLORS.sun;
    this.ctx.fill();

    // Iterate through physical major bodies in solar system
    for (const body of SOLAR_SYSTEM_BODIES) {
      if (body.id === 'sun' || body.parentId !== 'sun') continue;

      const sample = this.ephemeris.sample(body.id, this.simTime);
      if (!sample) continue;
      const distM = Math.hypot(sample.positionM[0], sample.positionM[2]);
      const distAu = distM / AU_METRES;
      // Square root mapping so inner planets and outer planets are both readable on canvas
      const screenDist = Math.sqrt(Math.max(0.01, distAu) / 32) * maxR;
      const angle = Math.atan2(sample.positionM[2], sample.positionM[0]);

      // Draw orbit circle
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, screenDist, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      this.ctx.stroke();

      const bx = cx + Math.cos(angle) * screenDist;
      const by = cy + Math.sin(angle) * screenDist;

      // Body radius scaled by physical size (clamped 2.5 to 8px)
      const radiusPx = Math.max(2.5, Math.min(8, Math.log10(body.equatorialRadiusM / 1e6) * 3 + 3));

      this.ctx.beginPath();
      this.ctx.arc(bx, by, radiusPx, 0, Math.PI * 2);
      this.ctx.fillStyle = BODY_COLORS[body.id] || '#ffffff';
      this.ctx.fill();

      // Highlight active body
      if (location.address.bodyId === body.id) {
        this.ctx.beginPath();
        this.ctx.arc(bx, by, radiusPx + 6, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }
    }

    if (location.systemPositionM && !location.address.bodyId) {
      const pDistM = Math.hypot(location.systemPositionM[0], location.systemPositionM[2]);
      const pDistAu = pDistM / AU_METRES;
      const pScreenDist = Math.sqrt(Math.max(0.001, pDistAu) / 32) * maxR;
      const pAngle = Math.atan2(location.systemPositionM[2], location.systemPositionM[0]);

      const px = cx + Math.cos(pAngle) * pScreenDist;
      const py = cy + Math.sin(pAngle) * pScreenDist;

      this.ctx.beginPath();
      this.ctx.arc(px, py, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fill();
    }

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '16px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`SYSTEM: ${location.address.systemId ? location.address.systemId.toUpperCase() : 'SOL'}`, cx, h - 40);
  }
}

export class GalaxyMapRenderer extends BaseMapRenderer {
  private offset = 0;
  
  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('#000');
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    this.offset -= 0.001;

    // Draw galaxy spiral
    const arms = 4;
    for (let i = 0; i < arms; i++) {
      this.ctx.beginPath();
      for (let j = 0; j < 200; j++) {
        const angle = (j * 0.1) + this.offset + (i * Math.PI * 2 / arms);
        const r = j * 1.5;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r * 0.6; // perspective squash
        
        if (j === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.strokeStyle = `rgba(167, 139, 250, 0.1)`;
      this.ctx.lineWidth = 10;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
    }

    // Core
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(253, 224, 71, 0.8)');
    grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, 60, 35, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Player Sector: preserve BigInt precision by scaling via BigInt arithmetic
    // 5000 sectors radius covers ~500,000 ly
    const GALAXY_SECTOR_RADIUS = 5000n;
    const scaleFactor = 10000n;
    const normX = Number((location.address.sector.x * scaleFactor) / GALAXY_SECTOR_RADIUS) / Number(scaleFactor);
    const normY = Number((location.address.sector.y * scaleFactor) / GALAXY_SECTOR_RADIUS) / Number(scaleFactor);

    const px = cx + (normX * (w * 0.4));
    const py = cy + (normY * (h * 0.4) * 0.6);
    
    this.ctx.beginPath();
    this.ctx.arc(px, py, 3, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ef4444';
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(px, py, 12 + Math.sin(this.offset * -20) * 4, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#ef4444';
    this.ctx.stroke();

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '16px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`GALAXY: ${location.address.galaxyId ? location.address.galaxyId.toUpperCase() : 'MILKY WAY'}`, cx, h - 40);
  }
}

export class CosmologyMapRenderer extends BaseMapRenderer {
  private points: {x: number; y: number; z: number}[] = [];
  
  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    // Deterministic seeded pseudo-random distribution
    let seed = 42;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 200; i++) {
      this.points.push({
        x: (lcg() - 0.5) * canvas.width * 2,
        y: (lcg() - 0.5) * canvas.height * 2,
        z: lcg() * 1000
      });
    }
  }

  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('#000');
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    for (const p of this.points) {
      p.z -= 1;
      if (p.z <= 0) p.z = 1000;
      
      const scale = 500 / p.z;
      const px = cx + p.x * scale;
      const py = cy + p.y * scale;

      if (px >= 0 && px <= w && py >= 0 && py <= h) {
        this.ctx.beginPath();
        this.ctx.arc(px, py, scale * 1.5, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(125, 211, 252, ${Math.min(1, scale / 2)})`;
        this.ctx.fill();
      }
    }

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '16px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('COSMOLOGY: LOCAL GROUP', cx, h - 40);
  }
}
