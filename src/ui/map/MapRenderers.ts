import type { UniverseLocation } from '../../world/spatial/UniverseLocation';
import type { Vector3 } from 'three/webgpu';
import type { HUDBody } from '../HUD';
import { universalTargetKey, type UniversalTargetDescriptor } from '../../world/travel/UniversalNavigationTarget';

/** Hit areas are disposable presentation. Their only output is a canonical descriptor key. */
export class CatalogMapMarkers {
  private descriptors:readonly UniversalTargetDescriptor[]=[];
  private hits:{key:string;x:number;y:number}[]=[];
  setTargets(descriptors:readonly UniversalTargetDescriptor[]):void { this.descriptors=descriptors; }
  hitTest(x:number,y:number):string|undefined {
    return this.hits.find(h=>Math.hypot(x-h.x,y-h.y)<=22)?.key;
  }
  draw(ctx:CanvasRenderingContext2D,w:number,h:number,cosmology=false):void {
    this.hits=[];
    const descriptors=this.descriptors.filter(d=>cosmology
      ? ['cluster','cosmic-anchor','observable-horizon'].includes(d.kind) : ['galaxy','black-hole'].includes(d.kind));
    ctx.font='12px sans-serif';ctx.textAlign='left';
    // Catalogue inset avoids attributing invented astrophysical coordinates to the schematic spiral.
    for(let i=0;i<descriptors.length;i++){
      const d=descriptors[i],x=Math.min(28,w/4),y=35+i*42;
      if(y>h-45)break;
      this.hits.push({key:universalTargetKey(d),x,y});
      ctx.fillStyle=d.kind==='black-hole'?'#fbbf24':'#67e8f9';
      ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e2e8f0';ctx.fillText(d.displayName,x+14,y+4,Math.max(20,w-x-20));
    }
  }
}

export interface MapRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  show(): void;
  hide(): void;
  draw(location: UniverseLocation, destination?: Vector3): void;
}

export abstract class BaseMapRenderer implements MapRenderer {
  ctx: CanvasRenderingContext2D;
  protected width = 1;
  protected height = 1;
  
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
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    const w = Math.round(this.width * dpr), h = Math.round(this.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
}

export class SurfaceMapRenderer extends BaseMapRenderer {
  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('transparent');
    if (!location.frameId.includes('manaus')) {
      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = '14px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`${location.address.bodyId ?? 'Corpo'} · use a vista Planeta ou Sistema`, 24, 40);
    }
  }
}

export class PlanetMapRenderer extends BaseMapRenderer {
  private offset = 0;
  
  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('#020617');
    const w = this.width;
    const h = this.height;
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

import { bodyById } from '../../world/celestial/CelestialBody';
import { bodyProfile } from '../../world/celestial/CelestialBodyProfile';
import { positionFromElements } from '../../world/celestial/EphemerisProvider';
import { rotateVec3, rotateVec3Inverse, type Quat, type Vec3 } from '../../world/spatial/units';

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
  private bodies: readonly HUDBody[] = [];
  private focusBodyId?: string;
  private focusExtentM = 1;
  private readonly outlines = new Map<string, Vec3[]>();
  zoom = 1;
  readonly markers: { id: string; name: string; x: number; y: number; selected: boolean }[] = [];

  setBodies(bodies: readonly HUDBody[]): void { this.bodies = bodies; }
  get focusedBodyId(): string | undefined { return this.focusBodyId; }
  parentOf(body: HUDBody): string | undefined { return body.parentId ?? bodyById(body.id)?.parentId; }
  setFocus(bodyId?: string): void {
    const valid = bodyId && this.bodies.some(body => body.id === bodyId && !!this.parentOf(body))
      && this.bodies.some(body => this.parentOf(body) === bodyId);
    const focus = valid ? bodyId : undefined;
    if (this.focusBodyId !== focus) this.zoom = 1;
    this.focusBodyId = focus;
  }
  changeZoom(delta: number): void {
    if (Number.isFinite(delta)) this.zoom = Math.max(0.5, Math.min(16, this.zoom * Math.exp(-Math.max(-1000, Math.min(1000, delta)) * 0.001)));
  }
  hitTest(x: number, y: number): string | undefined {
    return [...this.markers].sort((a, b) => Math.hypot(a.x-x, a.y-y)-Math.hypot(b.x-x, b.y-y))
      .find(marker => Math.hypot(marker.x-x, marker.y-y) <= 14)?.id;
  }
  get scaleText(): string { return this.focusBodyId
    ? `${Math.round(this.focusExtentM / this.zoom / 1000).toLocaleString('pt-BR')} km · órbitas relativas ao planeta · ${this.zoom.toFixed(1)}×`
    : `${(32 / (this.zoom * this.zoom)).toFixed(1)} AU · escala radial comprimida · ${this.zoom.toFixed(1)}×`; }

  draw(location: UniverseLocation): void {
    this.clear('#020617');
    const w = this.width, h = this.height, cx = w/2, cy = h/2;
    const maxR = Math.max(1, Math.min(w, h) * 0.39);
    // No fallback clock: orbital positions come exclusively from the active runtime/HUD.
    const focus = this.bodies.find(body => body.id === this.focusBodyId);
    const children = focus ? this.bodies.filter(body => this.parentOf(body) === focus.id) : [];
    const bodies = focus ? [focus, ...children] : this.bodies.filter(body =>
      !this.parentOf(body) || this.parentOf(body) === 'sun' || body.selected);
    const origin = focus?.systemPositionM ?? this.bodies.find(body => !this.parentOf(body))?.systemPositionM ?? [0, 0, 0];
    const plane: Quat = (children.length && bodyById(children[0].id)?.satelliteOrbit?.referenceToEcliptic) || [0, 0, 0, 1];
    this.focusExtentM = Math.max(1, ...children.map(body => {
      const orbit = bodyById(body.id)?.satelliteOrbit;
      const p = body.systemPositionM;
      return Math.max(Math.hypot(p[0]-origin[0], p[1]-origin[1], p[2]-origin[2]),
        orbit ? orbit.elements.semiMajorAxisM * (1 + orbit.elements.eccentricity) : 0);
    })) * 1.15;
    const project = (p: readonly number[]) => {
      const relative: Vec3 = [p[0]-origin[0], p[1]-origin[1], p[2]-origin[2]];
      const [x, y] = focus ? rotateVec3Inverse(plane, relative) : relative;
      if (focus) return { x: cx+x/this.focusExtentM*maxR*this.zoom,
        y: cy-y/this.focusExtentM*maxR*this.zoom, radius: Math.hypot(x,y)/this.focusExtentM*maxR*this.zoom };
      const radius = Math.sqrt(Math.hypot(x,y)/AU_METRES/32)*maxR*this.zoom;
      const angle = Math.atan2(y,x);
      return { x: cx+Math.cos(angle)*radius, y: cy-Math.sin(angle)*radius, radius };
    };
    this.markers.length = 0;
    const labels: { x: number; y: number; width: number }[] = [];
    this.ctx.font = '12px "Inter", sans-serif';
    this.ctx.textAlign = 'left';
    for (const body of [...bodies].sort((a,b) => Number(b.selected)-Number(a.selected))) {
      const p = project(body.systemPositionM);
      const orbit = focus && body.id !== focus.id ? bodyById(body.id)?.satelliteOrbit : undefined;
      if (orbit) {
        let outline = this.outlines.get(body.id);
        if (!outline) {
          outline = Array.from({ length: 97 }, (_, i) => rotateVec3(orbit.referenceToEcliptic,
            positionFromElements({ ...orbit.elements, meanLongitudeRad: orbit.elements.longitudeOfPerihelionRad + i/96*Math.PI*2 }, 0)));
          this.outlines.set(body.id, outline);
        }
        this.ctx.beginPath();
        outline.forEach((r,i) => {
          const s = project([r[0]+origin[0],r[1]+origin[1],r[2]+origin[2]]);
          if (i === 0) this.ctx.moveTo(s.x,s.y); else this.ctx.lineTo(s.x,s.y);
        });
        this.ctx.strokeStyle='rgba(148,163,184,0.3)'; this.ctx.lineWidth=1; this.ctx.stroke();
      } else if (!focus && this.parentOf(body) === 'sun') {
        this.ctx.beginPath(); this.ctx.arc(cx,cy,p.radius,0,Math.PI*2);
        this.ctx.strokeStyle='rgba(148,163,184,0.18)'; this.ctx.lineWidth=1; this.ctx.stroke();
      }
      const selected = body.selected;
      this.markers.push({ id: body.id, name: body.name, x: p.x, y: p.y, selected });
      this.ctx.beginPath(); this.ctx.arc(p.x,p.y,body.id === 'sun' ? 8 : 4,0,Math.PI*2);
      const catalogBody = bodyById(body.id);
      this.ctx.fillStyle=BODY_COLORS[body.id] ?? (catalogBody
        ? `rgb(${bodyProfile(catalogBody).visual.albedo.map(v=>Math.round(v*255)).join(',')})` : '#fff'); this.ctx.fill();
      if (selected) {
        this.ctx.beginPath(); this.ctx.arc(p.x,p.y,12,0,Math.PI*2);
        this.ctx.strokeStyle='#facc15'; this.ctx.lineWidth=2; this.ctx.stroke();
      }
      const label = body.name + (selected ? ' · TRAVADO' : '');
      const width = this.ctx.measureText(label).width;
      const lx = Math.max(8,Math.min(w-width-8,p.x+12));
      let ly = Math.max(18,Math.min(h-28,p.y-8));
      for (let attempt=0; attempt<20 && labels.some(r => Math.abs(r.y-ly)<15 && lx<r.x+r.width+6 && lx+width+6>r.x); attempt++) ly += 16;
      if (p.x>=0 && p.x<=w && p.y>=0 && p.y<=h) {
        this.ctx.fillStyle=selected ? '#facc15' : '#e2e8f0'; this.ctx.fillText(label,lx,ly);
        labels.push({ x: lx, y: ly, width });
      }
    }
    if (location.systemPositionM) {
      const p=project(location.systemPositionM);
      this.ctx.beginPath(); this.ctx.arc(p.x,p.y,3,0,Math.PI*2); this.ctx.fillStyle='#ef4444'; this.ctx.fill();
    }
  }
}

export class GalaxyMapRenderer extends BaseMapRenderer {
  readonly markers=new CatalogMapMarkers();
  private offset = 0;
  
  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('#000');
    const w = this.width;
    const h = this.height;
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
    this.markers.draw(this.ctx,w,h);
  }
}

export class CosmologyMapRenderer extends BaseMapRenderer {
  readonly markers=new CatalogMapMarkers();
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
        x: (lcg() - 0.5) * 2,
        y: (lcg() - 0.5) * 2,
        z: lcg() * 1000
      });
    }
  }

  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('#000');
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2;

    for (const p of this.points) {
      p.z -= 1;
      if (p.z <= 0) p.z = 1000;
      
      const scale = 500 / p.z;
      const px = cx + p.x * w * scale;
      const py = cy + p.y * h * scale;

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
    this.markers.draw(this.ctx,w,h,true);
  }
}
