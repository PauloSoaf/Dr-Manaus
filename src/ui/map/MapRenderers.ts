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

      if (px*px + py*py <= r*r*1.5) { // Check if roughly on front face
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

export class SystemMapRenderer extends BaseMapRenderer {
  private offset = 0;
  private bodies = [
    { id: 'sun', dist: 0, r: 12, color: '#facc15' },
    { id: 'mercury', dist: 30, r: 2, color: '#94a3b8' },
    { id: 'venus', dist: 50, r: 4, color: '#fde047' },
    { id: 'earth', dist: 80, r: 4, color: '#38bdf8' },
    { id: 'mars', dist: 110, r: 3, color: '#f87171' },
    { id: 'jupiter', dist: 160, r: 8, color: '#fdba74' },
    { id: 'saturn', dist: 210, r: 7, color: '#fef08a' },
    { id: 'uranus', dist: 250, r: 5, color: '#67e8f9' },
    { id: 'neptune', dist: 290, r: 5, color: '#2563eb' },
  ];

  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('#020617');
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    this.offset += 0.002;

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

    for (const body of this.bodies) {
      if (body.dist > 0) {
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, body.dist, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
        this.ctx.stroke();
      }

      const angle = this.offset * (300 / (body.dist || 1));
      const bx = cx + Math.cos(angle) * body.dist;
      const by = cy + Math.sin(angle) * body.dist;

      this.ctx.beginPath();
      this.ctx.arc(bx, by, body.r, 0, Math.PI * 2);
      this.ctx.fillStyle = body.color;
      this.ctx.fill();

      if (location.address.bodyId === body.id) {
        this.ctx.beginPath();
        this.ctx.arc(bx, by, body.r + 6 + Math.sin(this.offset * 20) * 2, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.stroke();
      }
    }

    if (location.systemPositionM && !location.address.bodyId) {
      // Very rough logarithmic mapping to draw interplanetary position
      const dist = Math.log10(Math.max(1, Math.hypot(location.systemPositionM[0], location.systemPositionM[1], location.systemPositionM[2]))) * 10;
      const angle = Math.atan2(location.systemPositionM[2], location.systemPositionM[0]);
      
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;

      this.ctx.beginPath();
      this.ctx.arc(px, py, 3, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fill();
    }

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '16px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`SYSTEM: ${location.address.systemId || 'UNKNOWN'}`, cx, h - 40);
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

    // Player Sector
    const sx = Number(location.address.sector.x);
    const sy = Number(location.address.sector.y);
    const px = cx + (sx * 2); // mockup scaling
    const py = cy + (sy * 2);
    
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
    this.ctx.fillText(`GALAXY: ${location.address.galaxyId || 'UNKNOWN'}`, cx, h - 40);
  }
}

export class CosmologyMapRenderer extends BaseMapRenderer {
  private points: {x:number, y:number, z:number}[] = [];
  
  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    for (let i = 0; i < 200; i++) {
      this.points.push({
        x: (Math.random() - 0.5) * canvas.width * 2,
        y: (Math.random() - 0.5) * canvas.height * 2,
        z: Math.random() * 1000
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
