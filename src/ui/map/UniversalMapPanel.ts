import { MapNavigationModel } from './MapNavigationModel';
import { icon } from '../icons';
import type { UniverseLocation } from '../../world/spatial/UniverseLocation';
import type { Vector3 } from 'three/webgpu';
import { SurfaceMapRenderer, PlanetMapRenderer, SystemMapRenderer, GalaxyMapRenderer, CosmologyMapRenderer } from './MapRenderers';
import { UniverseCoordinates } from '../../world/spatial/UniverseCoordinates';

export class UniversalMapPanel {
  private readonly root: HTMLElement;
  model: MapNavigationModel;
  
  private renderers: {
    surface: SurfaceMapRenderer;
    planet: PlanetMapRenderer;
    system: SystemMapRenderer;
    galaxy: GalaxyMapRenderer;
    cosmology: CosmologyMapRenderer;
  };
  private currentLevel: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology' = 'surface';
  private selectedLevel?: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology';

  constructor(
    private readonly container: HTMLElement,
    initialLocation: UniverseLocation,
    private readonly onTravel: (id: string) => void,
    private readonly onClose: () => void
  ) {
    this.model = new MapNavigationModel(initialLocation);
    this.root = document.createElement('div');
    this.root.className = 'map-layout';
    this.render();
    container.innerHTML = '';
    container.appendChild(this.root);
    
    const canvas = this.root.querySelector('#universal-canvas') as HTMLCanvasElement;
    this.renderers = {
      surface: new SurfaceMapRenderer(canvas),
      planet: new PlanetMapRenderer(canvas),
      system: new SystemMapRenderer(canvas),
      galaxy: new GalaxyMapRenderer(canvas),
      cosmology: new CosmologyMapRenderer(canvas)
    };
  }

  setLevel(level: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology') {
    this.selectedLevel = level;
    this.currentLevel = level;
    this.updateCard();
    this.updateBreadcrumb();
    const cityCanvas = this.root.querySelector('#city-map') as HTMLCanvasElement;
    if (cityCanvas) cityCanvas.style.display = level === 'surface' ? 'block' : 'none';
    if (this.currentLevel !== 'surface') {
      this.renderers[this.currentLevel].draw(this.model.location, this.model.destination);
    }
  }

  update(location: UniverseLocation, position: Vector3, destination?: Vector3) {
    this.model.updateLocation(location);
    this.model.destination = destination;
    
    const loc = this.model.location;
    if (this.selectedLevel) {
      this.currentLevel = this.selectedLevel;
    } else if (loc.cosmological || loc.address.galaxyId === 'cosmology' || loc.frameId.includes('cosmo')) {
      this.currentLevel = 'cosmology';
    } else if (loc.frameId.includes('galactic') || (!loc.address.systemId && !loc.systemPositionM)) {
      this.currentLevel = 'galaxy';
    } else if (loc.frameId === 'solar-system/barycentric') {
      this.currentLevel = 'system';
    } else if (loc.surface && loc.surface.altitudeM > 200000) {
      this.currentLevel = 'planet';
    } else {
      this.currentLevel = 'surface';
    }

    const cityCanvas = this.root.querySelector('#city-map') as HTMLCanvasElement;
    if (cityCanvas) cityCanvas.style.display = this.currentLevel === 'surface' ? 'block' : 'none';

    this.updateCard();
    this.updateBreadcrumb();
    
    if (this.currentLevel !== 'surface') {
      this.renderers[this.currentLevel].draw(loc, destination);
    }
  }

  private render() {
    this.root.innerHTML = `
      <div class="map-sidebar" style="width: 320px; border-right: 1px solid #333; padding: 1rem; overflow-y: auto;">
        <div class="map-breadcrumb" id="map-breadcrumb" style="font-size: 11px; opacity: 0.85; margin-bottom: 2rem;"></div>
        <div class="where-am-i-card" id="where-am-i-card"></div>
        <div class="map-coordinates-form" style="margin-top: 1.5rem; background: #0f172a; padding: 0.75rem; border-radius: 6px; border: 1px solid #1e293b;">
          <span class="eyebrow" style="color: #94a3b8; font-size: 10px; font-weight: 600; letter-spacing: 0.05em;">COORDENADAS UNIVERSAIS</span>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <input type="text" id="coord-input" placeholder="drm:v1://?... ou marco/destino" style="flex: 1; padding: 0.4rem 0.5rem; background: #1e293b; border: 1px solid #334155; color: #f8fafc; border-radius: 4px; font-size: 11px;" />
            <button id="btn-translocate" style="padding: 0.4rem 0.75rem; background: #2563eb; color: #fff; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;">TRANSLOCAR</button>
          </div>
          <div id="coord-status" style="font-size: 10px; color: #94a3b8; margin-top: 0.25rem;"></div>
        </div>
        <div class="map-destinations" style="margin-top: 1.5rem;">
          <span class="eyebrow">PONTOS DE INTERESSE</span>
          <div id="landmark-list"></div>
        </div>
      </div>
      <div class="map-visual" style="flex: 1; position: relative;">
        <canvas id="city-map" style="position: absolute; width: 100%; height: 100%;"></canvas>
        <canvas id="universal-canvas" width="800" height="600" style="position: absolute; width: 100%; height: 100%; pointer-events: none;"></canvas>
        <div class="map-scale">━━━━━━ <span>5 km</span></div>
        <span class="map-credit">Dados viários © OpenStreetMap contributors · Geografia estilizada</span>
      </div>
    `;

    const btnTranslocate = this.root.querySelector('#btn-translocate') as HTMLButtonElement;
    const coordInput = this.root.querySelector('#coord-input') as HTMLInputElement;
    const coordStatus = this.root.querySelector('#coord-status') as HTMLElement;
    if (btnTranslocate && coordInput) {
      btnTranslocate.onclick = () => {
        const val = coordInput.value.trim();
        if (!val) return;
        if (val.startsWith('drm:v1://?')) {
          const target = UniverseCoordinates.parse(val);
          if (!target) {
            if (coordStatus) coordStatus.textContent = 'Erro: Coordenada inválida';
            return;
          }
          if (coordStatus) coordStatus.textContent = `Destino: ${target.kind}`;
          this.onTravel(val);
        } else {
          this.onTravel(val);
        }
      };
    }

    this.updateCard();
    this.updateBreadcrumb();
  }

  private updateBreadcrumb() {
    const b = this.root.querySelector('#map-breadcrumb');
    if (!b) return;
    const a = this.model.location.address;
    const items: { label: string; level: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology' }[] = [
      { label: 'COSMOS', level: 'cosmology' },
      { label: a.galaxyId ? a.galaxyId.replace('_', ' ').toUpperCase() : 'MILKY WAY', level: 'galaxy' },
    ];
    if (a.systemId) items.push({ label: a.systemId.toUpperCase(), level: 'system' });
    if (a.bodyId) items.push({ label: a.bodyId.toUpperCase(), level: 'planet' });
    if (a.childFrame && (a.childFrame.includes('manaus') || a.childFrame.includes('surface') || a.childFrame.includes('legacy-enu'))) {
      items.push({ label: 'MANAUS', level: 'surface' });
    }
    
    b.innerHTML = items.map(item => `
      <span class="breadcrumb-item ${this.currentLevel === item.level ? 'active' : ''}" 
            data-level="${item.level}" 
            style="cursor: pointer; text-decoration: ${this.currentLevel === item.level ? 'none' : 'underline'}; margin: 0 3px; ${this.currentLevel === item.level ? 'font-weight: 700; color: #38bdf8;' : 'color: #94a3b8;'}">
        ${item.label}
      </span>
    `).join('<span style="color: #475569; margin: 0 2px;">/</span>');

    b.querySelectorAll<HTMLElement>('.breadcrumb-item').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const lvl = el.dataset.level as any;
        if (lvl) {
          this.setLevel(lvl);
        }
      };
    });
  }

  private updateCard() {
    const c = this.root.querySelector('#where-am-i-card');
    if (!c) return;
    const loc = this.model.location;
    const a = loc.address;
    
    let html = `<h3>LOCALIZAÇÃO ATUAL</h3><table class="card-table">`;
    html += `<tr><td>Galaxy</td><td>${a.galaxyId}</td></tr>`;
    html += `<tr><td>Sector</td><td>${a.sector.x},${a.sector.y},${a.sector.z}</td></tr>`;
    html += `<tr><td>System</td><td>${a.systemId || 'unavailable'}</td></tr>`;
    html += `<tr><td>Body</td><td>${a.bodyId || 'unavailable'}</td></tr>`;
    html += `<tr><td>Place</td><td>${a.childFrame?.includes('manaus') ? 'Manaus' : 'unavailable'}</td></tr>`;
    
    if (loc.surface) {
      html += `<tr><td>Lat/Lon</td><td>${loc.surface.latDeg.toFixed(4)}, ${loc.surface.lonDeg.toFixed(4)}</td></tr>`;
      html += `<tr><td>Altitude</td><td>${loc.surface.altitudeM > 1000 ? (loc.surface.altitudeM/1000).toFixed(1) + ' km' : Math.round(loc.surface.altitudeM) + ' m'}</td></tr>`;
    } else {
      html += `<tr><td>Lat/Lon</td><td>unavailable</td></tr>`;
      html += `<tr><td>Altitude</td><td>unavailable</td></tr>`;
    }
    
    if (loc.frameId === 'solar-system/barycentric') {
      html += `<tr><td>Domain</td><td>Interplanetary</td></tr>`;
    } else if (a.bodyId) {
      if (loc.surface && loc.surface.altitudeM > 150000) {
        html += `<tr><td>Domain</td><td>Orbital</td></tr>`;
      } else {
        html += `<tr><td>Domain</td><td>Local surface</td></tr>`;
      }
    } else {
      html += `<tr><td>Domain</td><td>Interstellar</td></tr>`;
    }
    
    html += `</table>`;
    c.innerHTML = html;
  }
}
