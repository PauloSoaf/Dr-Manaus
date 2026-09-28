import { MapNavigationModel } from './MapNavigationModel';
import { icon } from '../icons';
import type { UniverseLocation } from '../../world/spatial/UniverseLocation';
import type { Vector3 } from 'three/webgpu';
import { SurfaceMapRenderer, PlanetMapRenderer, SystemMapRenderer, GalaxyMapRenderer, CosmologyMapRenderer } from './MapRenderers';

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

  update(location: UniverseLocation, position: Vector3, destination?: Vector3) {
    this.model.updateLocation(location);
    this.model.destination = destination;
    this.updateCard();
    this.updateBreadcrumb();
    
    const loc = this.model.location;
    if (loc.frameId === 'solar-system/barycentric') {
      this.currentLevel = 'system';
    } else if (loc.surface && loc.surface.altitudeM > 200000) {
      this.currentLevel = 'planet';
    } else {
      this.currentLevel = 'surface'; // Should be replaced by CityMap from outside for manaus
    }
    
    // The renderers manage their own drawing onto the shared canvas
    // (In reality HUD.ts might still draw CityMap over it if currentLevel === 'surface')
    if (this.currentLevel !== 'surface') {
      this.renderers[this.currentLevel].draw(loc, destination);
    }
  }

  private render() {
    this.root.innerHTML = `
      <div class="map-sidebar" style="width: 320px; border-right: 1px solid #333; padding: 1rem;">
        <div class="map-breadcrumb" id="map-breadcrumb" style="font-size: 11px; opacity: 0.7; margin-bottom: 2rem;"></div>
        <div class="where-am-i-card" id="where-am-i-card"></div>
        <div class="map-destinations" style="margin-top: 2rem;">
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
    this.updateCard();
    this.updateBreadcrumb();
  }

  private updateBreadcrumb() {
    const b = this.root.querySelector('#map-breadcrumb');
    if (!b) return;
    const a = this.model.location.address;
    const parts = ['UNIVERSE', 'LOCAL GROUP', a.galaxyId.replace('_', ' ').toUpperCase()];
    if (a.systemId) parts.push(a.systemId.toUpperCase());
    if (a.bodyId) parts.push(a.bodyId.toUpperCase());
    if (a.childFrame && a.childFrame === 'manaus/compiled') parts.push('MANAUS');
    b.innerHTML = parts.join(' / ');
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
