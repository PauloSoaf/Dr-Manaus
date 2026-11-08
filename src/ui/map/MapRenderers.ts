import { galaxyDefinition, galaxyLocalPositionM, boundedGalaxySector } from '../../world/galaxy/GalaxyCoordinates';
import { LIGHT_YEAR_M } from '../../world/spatial/units';
import type { UniverseLocation } from '../../world/spatial/UniverseLocation';
import type { Vector3 } from 'three/webgpu';
import type { HUDBody } from '../HUD';
import { universalTargetKey, type UniversalTargetDescriptor } from '../../world/travel/UniversalNavigationTarget';
import { ProceduralGalaxyDiscovery } from '../../world/galaxy/ProceduralGalaxyDiscovery';
import { COSMOLOGICAL_CELL_SIZE_MPC, MPC_LY, type ProceduralGalaxyDescriptor } from '../../world/galaxy/ProceduralGalaxyGenerator';
import type { BigInt3 } from '../../world/spatial/UniverseAddress';

/** Hit areas are disposable presentation. Their only output is a canonical descriptor key. */
export class CatalogMapMarkers {
  private descriptors:readonly UniversalTargetDescriptor[]=[];
  private hits:{key:string;x:number;y:number}[]=[];
  selectedKey?:string;
  hoveredKey?:string;
  setTargets(descriptors:readonly UniversalTargetDescriptor[]):void { this.descriptors=descriptors; }
  hitTest(x:number,y:number):string|undefined {
    return this.hits.find(h=>Math.hypot(x-h.x,y-h.y)<=22)?.key;
  }
  draw(ctx:CanvasRenderingContext2D,w:number,h:number,cosmology=false,currentGalaxy?:string):void {
    this.hits=[];
    const descriptors=this.descriptors.filter(d=>cosmology
      ? ['galaxy','cluster','cosmic-anchor','observable-horizon'].includes(d.kind) : ['galaxy','black-hole'].includes(d.kind));
    ctx.font='12px sans-serif';ctx.textAlign='left';
    // Catalogue inset avoids attributing invented astrophysical coordinates to the schematic spiral.
    for(let i=0;i<descriptors.length;i++){
      const d=descriptors[i],x=Math.min(28,w/4),y=35+i*42;
      if(y>h-45)break;
      const key=universalTargetKey(d);
      this.hits.push({key,x,y});
      const isSelected=this.selectedKey===key;
      const isHovered=this.hoveredKey===key;
      ctx.fillStyle=d.kind==='black-hole'?'#fbbf24':d.kind==='galaxy'?'#38bdf8':'#a78bfa';
      ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();
      if(isSelected||isHovered){
        ctx.beginPath();ctx.arc(x,y,isSelected?11:9,0,Math.PI*2);
        ctx.strokeStyle=isSelected?'#facc15':'#e2e8f0';ctx.lineWidth=isSelected?2:1.2;ctx.stroke();
      }
      ctx.fillStyle=isSelected?'#facc15':'#e2e8f0';
      ctx.fillText(d.displayName+(currentGalaxy&&d.galaxyId?(d.galaxyId===currentGalaxy?' · CURRENT':' · EXTERNAL'):''),x+14,y+4,Math.max(20,w-x-20));
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

export { PlanetMap3DRenderer } from './PlanetMap3DRenderer';

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
      !this.parentOf(body) || this.parentOf(body) === this.bodies.find(b=>!this.parentOf(b))?.id || body.selected);
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
      const generatedPlane=this.bodies.some(b=>!!b.orbit);
      const [x,y]=generatedPlane?[relative[0],relative[2]]:focus?rotateVec3Inverse(plane,relative):relative;
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
      if(focus && body.orbit && body.id!==focus.id){
        this.ctx.beginPath();
        for(let i=0;i<=96;i++){const angle=i/96*Math.PI*2,r=body.orbit.semiMajorAxisM,tilt=body.orbit.inclinationRad??0,
          s=project([origin[0]+Math.cos(angle)*r,origin[1]+Math.sin(angle)*r*Math.sin(tilt),origin[2]+Math.sin(angle)*r*Math.cos(tilt)]);
          if(i===0)this.ctx.moveTo(s.x,s.y);else this.ctx.lineTo(s.x,s.y);}
        this.ctx.strokeStyle='rgba(148,163,184,.3)';this.ctx.stroke();
      }
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
      this.ctx.beginPath(); this.ctx.arc(p.x,p.y,!this.parentOf(body) ? 8 : 4,0,Math.PI*2);
      const catalogBody = bodyById(body.id);
      this.ctx.fillStyle=BODY_COLORS[body.id] ?? (catalogBody
        ? `rgb(${bodyProfile(catalogBody).visual.albedo.map(v=>Math.round(v*255)).join(',')})` : body.profile?`rgb(${body.profile.visual.albedo.map(v=>Math.round(v*255)).join(',')})`:'#fff'); this.ctx.fill();
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
  readonly markers = new CatalogMapMarkers();
  private readonly discovery = new ProceduralGalaxyDiscovery();
  private offset = 0;
  selectedTargetKey?: string;
  hoveredTargetKey?: string;
  
  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('#020617');
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2;

    this.offset -= 0.001;
    this.markers.selectedKey = this.selectedTargetKey;
    this.markers.hoveredKey = this.hoveredTargetKey;

    const galaxyId = location.address.galaxyId || 'milky_way';
    const desc = this.discovery.findGalaxyById(galaxyId);

    if (desc && desc.family === 'elliptical') {
      // Smooth spheroidal / elliptical density contours
      const flattening = desc.bulge.axisRatio[2];
      const maxR = Math.min(w, h) * 0.38;
      for (let i = 5; i >= 1; i--) {
        const r = maxR * (i / 5);
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, r, r * flattening, desc.orientationEulerRad[2], 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(251, 191, 36, ${0.08 * (6 - i)})`;
        this.ctx.fill();
      }
      // Core
      const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
      grad.addColorStop(0, 'rgba(254, 240, 138, 1)');
      grad.addColorStop(0.3, 'rgba(245, 158, 11, 0.8)');
      grad.addColorStop(1, 'rgba(217, 119, 6, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.ellipse(cx, cy, 45, 45 * flattening, desc.orientationEulerRad[2], 0, Math.PI * 2);
      this.ctx.fill();
    } else if (desc && desc.family === 'irregular') {
      // Mottled irregular clumps
      const rngSeed = Number(desc.seed & 0xffffn);
      for (let i = 0; i < 28; i++) {
        const angle = (i * 137.5 * Math.PI) / 180 + this.offset;
        const dist = ((i * 37 + rngSeed) % 150) + 15;
        const x = cx + Math.cos(angle) * dist * 1.2;
        const y = cy + Math.sin(angle) * dist * 0.8;
        const clumpR = ((i * 19) % 25) + 10;
        const grad = this.ctx.createRadialGradient(x, y, 0, x, y, clumpR);
        grad.addColorStop(0, 'rgba(52, 211, 153, 0.6)');
        grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.3)');
        grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(x, y, clumpR, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else {
      // Spiral or Barred Spiral (including canonical Milky Way / Andromeda)
      const numArms = desc?.spiralArms.active ? desc.spiralArms.numArms : 4;
      const isBarred = desc?.bar.active ?? false;
      const armColor = desc?.dominantSpectralClass && ['O','B','A'].includes(desc.dominantSpectralClass)
        ? 'rgba(56, 189, 248, 0.14)'
        : 'rgba(167, 139, 250, 0.14)';

      // Central bar if active
      if (isBarred && desc?.bar) {
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(desc.bar.angleRad + this.offset);
        const barLen = Math.min(w * 0.22, 100);
        const barWid = barLen * 0.35;
        const barGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, barLen);
        barGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
        barGrad.addColorStop(0.4, 'rgba(192, 132, 252, 0.5)');
        barGrad.addColorStop(1, 'rgba(147, 51, 234, 0)');
        this.ctx.fillStyle = barGrad;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, barLen, barWid, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }

      // Spiral arms
      const pitch = desc?.spiralArms.pitchAngleRad ?? 0.22;
      for (let i = 0; i < numArms; i++) {
        this.ctx.beginPath();
        const armPhase = (i * Math.PI * 2) / numArms;
        for (let j = 0; j < 200; j++) {
          const t = j * 0.05;
          const r = 20 * Math.exp(t * Math.tan(pitch)) + (j * 0.6);
          const angle = t * 2.2 + armPhase + this.offset;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r * 0.65;
          if (j === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
        this.ctx.strokeStyle = armColor;
        this.ctx.lineWidth = 11;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
      }

      // Core
      const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.25, 'rgba(253, 224, 71, 0.85)');
      grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.ellipse(cx, cy, 55, 36, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Player position within local galaxy
    const galaxy = galaxyDefinition(location.address.galaxyId);
    const local = galaxy && boundedGalaxySector(location.address.sector)
      ? galaxyLocalPositionM(galaxy, location.address.sector, location.sectorOffsetM)
      : [0, 0, 0];
    const radius = (galaxy?.diameterLy ?? desc?.diameterLy ?? 100_000) * 0.5 * LIGHT_YEAR_M;
    const normX = Math.max(-1, Math.min(1, local[0] / radius));
    const normY = Math.max(-1, Math.min(1, local[1] / radius));

    const px = cx + normX * (w * 0.4);
    const py = cy + normY * (h * 0.4) * 0.65;
    if (!location.transit) {
      this.ctx.beginPath();
      this.ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(px, py, 12 + Math.sin(this.offset * -20) * 4, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#ef4444';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    const originBadge = desc?.isKnownAstronomicalEntity ? 'CANÔNICA' : 'PROCEDURAL';
    const title = desc
      ? `GALAXY: ${desc.name} · ${desc.morphology} (${desc.family.toUpperCase()}) · ${originBadge} · Ø ${Math.round(desc.diameterLy / 1000)} kly`
      : `GALAXY: ${galaxyId.toUpperCase()}`;

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '14px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(title, cx, h - 38);
    this.markers.draw(this.ctx, w, h, false, location.transit ? undefined : location.address.galaxyId);
  }
}

export class CosmologyMapRenderer extends BaseMapRenderer {
  readonly markers = new CatalogMapMarkers();
  readonly discovery = new ProceduralGalaxyDiscovery();
  centerCell: BigInt3 = { x: 0n, y: 0n, z: 0n };
  panOffsetMpc = { x: 0, y: 0 };
  zoomMpc = 14;
  selectedTargetKey?: string;
  hoveredTargetKey?: string;
  private galaxyHits: { key: string; x: number; y: number; radius: number; descriptor: ProceduralGalaxyDescriptor }[] = [];
  private cachedVisibleKey = '';
  private cachedGalaxies: readonly ProceduralGalaxyDescriptor[] = [];

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
  }

  changeZoom(deltaY: number, cursorX?: number, cursorY?: number): void {
    const oldZoom = this.zoomMpc;
    const factor = deltaY < 0 ? 0.82 : 1.22;
    const newZoom = Math.max(4, Math.min(120, oldZoom * factor));
    this.zoomMpc = newZoom;

    if (
      cursorX !== undefined &&
      cursorY !== undefined &&
      Number.isFinite(cursorX) &&
      Number.isFinite(cursorY) &&
      this.width > 1
    ) {
      const offsetPxX = cursorX - this.width / 2;
      const offsetPxY = cursorY - this.height / 2;
      this.panOffsetMpc.x += (offsetPxX / this.width) * (newZoom - oldZoom);
      this.panOffsetMpc.y += (offsetPxY / this.width) * (newZoom - oldZoom);
      this.normalizeCellOffset();
    }
  }

  pan(dxPx: number, dyPx: number): void {
    const mpcPerPx = this.zoomMpc / Math.max(1, this.width);
    this.panOffsetMpc.x -= dxPx * mpcPerPx;
    this.panOffsetMpc.y -= dyPx * mpcPerPx;
    this.normalizeCellOffset();
  }

  private normalizeCellOffset(): void {
    const cellStepX = Math.trunc(this.panOffsetMpc.x / COSMOLOGICAL_CELL_SIZE_MPC);
    if (cellStepX !== 0) {
      this.centerCell = { x: this.centerCell.x + BigInt(cellStepX), y: this.centerCell.y, z: this.centerCell.z };
      this.panOffsetMpc.x -= cellStepX * COSMOLOGICAL_CELL_SIZE_MPC;
    }
    const cellStepY = Math.trunc(this.panOffsetMpc.y / COSMOLOGICAL_CELL_SIZE_MPC);
    if (cellStepY !== 0) {
      this.centerCell = { x: this.centerCell.x, y: this.centerCell.y + BigInt(cellStepY), z: this.centerCell.z };
      this.panOffsetMpc.y -= cellStepY * COSMOLOGICAL_CELL_SIZE_MPC;
    }
  }

  hitTest(x: number, y: number): string | undefined {
    let best: { key: string; dist: number } | undefined;
    for (const h of this.galaxyHits) {
      const dist = Math.hypot(x - h.x, y - h.y);
      if (dist <= h.radius && (!best || dist < best.dist)) {
        best = { key: h.key, dist };
      }
    }
    return best?.key;
  }

  updateHover(x: number, y: number): string | undefined {
    const key = this.markers.hitTest(x, y) ?? this.hitTest(x, y);
    this.hoveredTargetKey = key;
    this.markers.hoveredKey = key;
    return key;
  }

  getVisibleGalaxies(): readonly ProceduralGalaxyDescriptor[] {
    return this.cachedGalaxies;
  }

  draw(location: UniverseLocation, destination?: Vector3): void {
    this.clear('#020617');
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2;
    this.galaxyHits = [];
    this.markers.selectedKey = this.selectedTargetKey;
    this.markers.hoveredKey = this.hoveredTargetKey;

    const pxPerMpc = w / this.zoomMpc;
    const mpcPerPx = this.zoomMpc / Math.max(1, w);
    const halfSpanX_Mpc = (w * 0.5) * mpcPerPx + Math.abs(this.panOffsetMpc.x);
    const halfSpanY_Mpc = (h * 0.5) * mpcPerPx + Math.abs(this.panOffsetMpc.y);
    const spanCellsX = Math.max(2, Math.ceil(halfSpanX_Mpc / COSMOLOGICAL_CELL_SIZE_MPC) + 1);
    const spanCellsY = Math.max(2, Math.ceil(halfSpanY_Mpc / COSMOLOGICAL_CELL_SIZE_MPC) + 1);

    // Effective discovery cell accounts for sub-cell panOffsetMpc so edge galaxies are never missing during panning
    const panShiftCellsX = Math.round(this.panOffsetMpc.x / COSMOLOGICAL_CELL_SIZE_MPC);
    const panShiftCellsY = Math.round(this.panOffsetMpc.y / COSMOLOGICAL_CELL_SIZE_MPC);
    const effectiveCenterCell: BigInt3 = {
      x: this.centerCell.x + BigInt(panShiftCellsX),
      y: this.centerCell.y + BigInt(panShiftCellsY),
      z: this.centerCell.z,
    };
    const effectiveSpanMpc =
      this.zoomMpc +
      2 * Math.max(Math.abs(this.panOffsetMpc.x), Math.abs(this.panOffsetMpc.y)) +
      COSMOLOGICAL_CELL_SIZE_MPC;
    const panBucketX = Math.round(this.panOffsetMpc.x * 2);
    const panBucketY = Math.round(this.panOffsetMpc.y * 2);

    const visibleKey = `${this.discovery.universeSeed.toString(16)}_${effectiveCenterCell.x}_${effectiveCenterCell.y}_${effectiveCenterCell.z}_${this.zoomMpc.toFixed(2)}_${panBucketX}_${panBucketY}`;
    if (this.cachedVisibleKey !== visibleKey) {
      this.cachedVisibleKey = visibleKey;
      this.cachedGalaxies = this.discovery.discoverVisibleRegion(effectiveCenterCell, effectiveSpanMpc, 96);
    }
    const galaxies = this.cachedGalaxies;

    // Subtle Cosmological Cell Grid lines (relative coordinates prevent Float64 precision loss at > 2^53)
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    this.ctx.lineWidth = 1;
    const lineStepX = spanCellsX > 24 ? 2 : 1;
    const lineStepY = spanCellsY > 24 ? 2 : 1;

    for (let relX = -spanCellsX; relX <= spanCellsX; relX += lineStepX) {
      const worldMpcX = relX * COSMOLOGICAL_CELL_SIZE_MPC - this.panOffsetMpc.x;
      const sx = cx + worldMpcX * pxPerMpc;
      if (sx >= 0 && sx <= w) {
        this.ctx.beginPath();
        this.ctx.moveTo(sx, 0);
        this.ctx.lineTo(sx, h);
        this.ctx.stroke();
      }
    }
    for (let relY = -spanCellsY; relY <= spanCellsY; relY += lineStepY) {
      const worldMpcY = relY * COSMOLOGICAL_CELL_SIZE_MPC - this.panOffsetMpc.y;
      const sy = cy + worldMpcY * pxPerMpc;
      if (sy >= 0 && sy <= h) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, sy);
        this.ctx.lineTo(w, sy);
        this.ctx.stroke();
      }
    }

    // Cell coordinate tags (using exact BigInt addition for label display with decimation)
    this.ctx.font = '10px "Inter", sans-serif';
    this.ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    this.ctx.textAlign = 'left';
    const tagStepX = spanCellsX > 20 ? 4 : spanCellsX > 10 ? 2 : 1;
    const tagStepY = spanCellsY > 20 ? 4 : spanCellsY > 10 ? 2 : 1;
    for (let relX = -spanCellsX; relX <= spanCellsX; relX += tagStepX) {
      for (let relY = -spanCellsY; relY <= spanCellsY; relY += tagStepY) {
        const sx = cx + (relX * COSMOLOGICAL_CELL_SIZE_MPC - this.panOffsetMpc.x + 0.1) * pxPerMpc;
        const sy = cy + (relY * COSMOLOGICAL_CELL_SIZE_MPC - this.panOffsetMpc.y + 0.2) * pxPerMpc;
        if (sx >= 10 && sx <= w - 60 && sy >= 15 && sy <= h - 45) {
          const absX = (this.centerCell.x + BigInt(relX)).toString(10);
          const absY = (this.centerCell.y + BigInt(relY)).toString(10);
          this.ctx.fillText(`[${absX},${absY}]`, sx, sy);
        }
      }
    }

    const placedLabels: { x: number; y: number; w: number; h: number }[] = [];

    // Draw visible galaxies
    for (const g of galaxies) {
      const dxMpc = Number(g.cell.x - this.centerCell.x) * COSMOLOGICAL_CELL_SIZE_MPC + g.localCellMpc[0] - this.panOffsetMpc.x;
      const dyMpc = Number(g.cell.y - this.centerCell.y) * COSMOLOGICAL_CELL_SIZE_MPC + g.localCellMpc[1] - this.panOffsetMpc.y;
      const sx = cx + dxMpc * pxPerMpc;
      const sy = cy + dyMpc * pxPerMpc;

      if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) continue;

      const visualR = Math.max(5, Math.min(26, (g.diameterLy / 100_000) * 12 * (14 / this.zoomMpc)));
      const hitKey = universalTargetKey({ kind: 'galaxy', displayName: g.name, objectId: g.id, galaxyId: g.id });
      this.galaxyHits.push({ key: hitKey, x: sx, y: sy, radius: Math.max(16, visualR + 6), descriptor: g });

      const isCurrent = location.address.galaxyId === g.id && !location.transit;
      const isSelected = this.selectedTargetKey === hitKey;
      const isHovered = this.hoveredTargetKey === hitKey;
      const posAngle = g.orientationEulerRad[2] || Math.PI / 5;

      // Morphological styling with orientation and family silhouette
      if (g.family === 'elliptical') {
        const flattening = Math.max(0.45, Math.min(0.95, g.bulge.axisRatio[2]));
        const grad = this.ctx.createRadialGradient(sx, sy, 0, sx, sy, visualR * 1.15);
        grad.addColorStop(0, 'rgba(254, 249, 195, 1)');
        grad.addColorStop(0.4, 'rgba(245, 158, 11, 0.78)');
        grad.addColorStop(1, 'rgba(217, 119, 6, 0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.ellipse(sx, sy, visualR * 1.1, visualR * 1.1 * flattening, posAngle, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (g.family === 'irregular') {
        const knotPhase = Number(g.seed & 0xffn) * 0.0245;
        const grad = this.ctx.createRadialGradient(sx, sy, 0, sx, sy, visualR);
        grad.addColorStop(0, 'rgba(110, 231, 183, 0.85)');
        grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.35)');
        grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, visualR * 0.85, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#34d399';
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, visualR * 0.45, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.beginPath();
        this.ctx.arc(
          sx + Math.cos(knotPhase) * visualR * 0.42,
          sy + Math.sin(knotPhase) * visualR * 0.34,
          visualR * 0.34,
          0,
          Math.PI * 2,
        );
        this.ctx.fill();
      } else if (g.family === 'barred-spiral') {
        const barAngle = g.bar.angleRad || posAngle;
        const grad = this.ctx.createRadialGradient(sx, sy, 0, sx, sy, visualR);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.45, 'rgba(192, 132, 252, 0.65)');
        grad.addColorStop(1, 'rgba(147, 51, 234, 0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.ellipse(sx, sy, visualR, visualR * 0.62, barAngle, 0, Math.PI * 2);
        this.ctx.fill();

        const bx = Math.cos(barAngle) * visualR * 0.78;
        const by = Math.sin(barAngle) * visualR * 0.78;
        this.ctx.strokeStyle = '#e9d5ff';
        this.ctx.lineWidth = Math.max(2, visualR * 0.26);
        this.ctx.beginPath();
        this.ctx.moveTo(sx - bx, sy - by);
        this.ctx.lineTo(sx + bx, sy + by);
        this.ctx.stroke();

        this.ctx.strokeStyle = 'rgba(192, 132, 252, 0.72)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, visualR * 0.82, barAngle, barAngle + Math.PI * 0.82);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, visualR * 0.82, barAngle + Math.PI, barAngle + Math.PI * 1.82);
        this.ctx.stroke();
      } else {
        // Spiral
        const grad = this.ctx.createRadialGradient(sx, sy, 0, sx, sy, visualR * 1.05);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.32, '#38bdf8');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, visualR, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = 'rgba(125, 211, 252, 0.62)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.ellipse(sx, sy, visualR * 0.92, visualR * 0.48, posAngle, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Canonical highlight
      if (g.isKnownAstronomicalEntity) {
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, visualR + 5, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }

      // Hover halo
      if (isHovered && !isSelected) {
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, visualR + 8, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
        this.ctx.lineWidth = 1.6;
        this.ctx.stroke();
      }

      // Current player galaxy reticle
      if (isCurrent) {
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, visualR + 9, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }

      // Selected destination reticle
      if (isSelected) {
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, visualR + 12, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#facc15';
        this.ctx.lineWidth = 2.2;
        this.ctx.stroke();
      }

      // Smart label de-cluttering
      const priorityLabel = g.isKnownAstronomicalEntity || isCurrent || isSelected || isHovered;
      const labelW = Math.max(54, g.name.length * 6.5);
      const labelH = 24;
      const labelX = sx - labelW * 0.5;
      const labelY = sy + visualR + 4;
      const collides = placedLabels.some(
        b =>
          labelX < b.x + b.w &&
          labelX + labelW > b.x &&
          labelY < b.y + b.h &&
          labelY + labelH > b.y,
      );

      if (priorityLabel || !collides) {
        placedLabels.push({ x: labelX, y: labelY, w: labelW, h: labelH });
        this.ctx.font = priorityLabel ? 'bold 11px "Inter", sans-serif' : '11px "Inter", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = isSelected
          ? '#facc15'
          : g.isKnownAstronomicalEntity
            ? '#f8fafc'
            : '#cbd5e1';
        this.ctx.fillText(g.name, sx, sy + visualR + 13);

        if (priorityLabel || this.zoomMpc <= 36) {
          const originTag = g.isKnownAstronomicalEntity ? 'CANÔNICA' : 'PROCEDURAL';
          this.ctx.font = '9px "Inter", sans-serif';
          this.ctx.fillStyle = isSelected ? '#fde047' : '#64748b';
          this.ctx.fillText(
            `${g.morphology} · ${Math.round(g.diameterLy / 1000)} kly · ${originTag}`,
            sx,
            sy + visualR + 24,
          );
        }
      }
    }

    const scaleMly = (this.zoomMpc * MPC_LY) / 1_000_000;
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '14px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      `COSMOS · Span: ${this.zoomMpc.toFixed(1)} Mpc (~${scaleMly.toFixed(1)} Mly) · Célula [${this.centerCell.x}, ${this.centerCell.y}, ${this.centerCell.z}]`,
      cx,
      h - 40,
    );
    this.markers.draw(this.ctx, w, h, true, location.transit ? undefined : location.address.galaxyId);
  }
}
