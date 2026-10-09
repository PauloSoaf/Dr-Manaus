import { hypercruiseTelemetry } from '../HypercruiseTelemetry';
import { u1TestControlsEnabled, u2TestControlsEnabled } from '../../world/runtime/U1TestControls';
import { MapNavigationModel } from './MapNavigationModel';
import { formatDistance, formatDuration, formatSpeed, formatGalaxyName } from '../format';
import type { HUDBody, HUDFlightTelemetry } from '../HUD';
import type { UniverseLocation } from '../../world/spatial/UniverseLocation';
import type { Vector3 } from 'three/webgpu';
import { SurfaceMapRenderer, PlanetMapRenderer, SystemMapRenderer, GalaxyMapRenderer, CosmologyMapRenderer } from './MapRenderers';
import { UniverseCoordinates } from '../../world/spatial/UniverseCoordinates';
import { universalTargetKey, type UniversalTargetDescriptor } from '../../world/travel/UniversalNavigationTarget';
import { travelCapabilityLabel } from '../../world/travel/UniversalTargetResolver';

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

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
  /** Live bodies and cruise telemetry, fed by the HUD each refresh. */
  private bodies: readonly HUDBody[] = [];
  private flight?: HUDFlightTelemetry;
  private targetCatalog:readonly UniversalTargetDescriptor[]=[];
  private inTravel = false;

  constructor(
    private readonly container: HTMLElement,
    initialLocation: UniverseLocation,
    private readonly onTravel: (id: string) => void,
    private readonly onClose: () => void,
    private readonly onSelectTarget: (id: string) => string | undefined | void = () => {},
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
    canvas.addEventListener('wheel', event => {
      if (this.currentLevel !== 'system') return;
      event.preventDefault();
      this.renderers.system.changeZoom(event.deltaY);
      this.drawMap();
    }, { passive: false });
    canvas.addEventListener('click', event => {
      const rect = canvas.getBoundingClientRect();
      const x=event.clientX-rect.left,y=event.clientY-rect.top;
      const id = this.currentLevel==='system'?this.renderers.system.hitTest(x,y)
        : this.currentLevel==='galaxy'?this.renderers.galaxy.markers.hitTest(x,y)
        : this.currentLevel==='cosmology'?this.renderers.cosmology.markers.hitTest(x,y):undefined;
      if (id) this.selectTarget(id);
    });
  }

  setLevel(level: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology') {
    if (level === 'system') {
      this.model.systemFocusBodyId = undefined;
      this.renderers.system.setFocus();
    }
    this.selectedLevel = level;
    this.currentLevel = level;
    this.updateCard();
    this.updateBreadcrumb();
    this.updateCanvasVisibility();
    if (this.currentLevel !== 'surface' || !this.model.location.frameId.includes('manaus')) {
      this.drawMap();
    }
    this.updateScale();
  }

  focusSystem(bodyId?: string): void {
    this.currentLevel = this.selectedLevel = 'system';
    this.renderers.system.setFocus(bodyId);
    this.model.systemFocusBodyId = this.renderers.system.focusedBodyId;
    this.updateCard(); this.updateBreadcrumb(); this.updateCanvasVisibility(); this.drawMap();
  }

  private selectTarget(id: string): void {
    const lockedId = this.onSelectTarget(id);
    // Presentation copy of the identity confirmed by Game; never an independent target.
    if (typeof lockedId === 'string') this.bodies = this.bodies.map(body => ({ ...body, selected: body.id === lockedId }));
    this.renderers.system.setBodies(this.bodies);
    this.updateCard(); this.drawMap();
  }

  update(
    location: UniverseLocation,
    position: Vector3,
    destination?: Vector3,
    bodies: readonly HUDBody[] = [],
    flight?: HUDFlightTelemetry,
    targetCatalog:readonly UniversalTargetDescriptor[]=[],
  ) {
    this.bodies = bodies;
    this.flight = flight;
    this.targetCatalog=targetCatalog;
    this.renderers.galaxy.markers.setTargets(targetCatalog);
    this.renderers.cosmology.markers.setTargets(targetCatalog);
    const inTravel = !!location.systemPositionM||!!location.transit;
    if (inTravel && !this.inTravel) this.selectedLevel = undefined;
    this.inTravel = inTravel;
    this.renderers.system.setBodies(bodies);
    this.model.updateLocation(location);
    this.model.destination = destination;
    
    const loc = this.model.location;
    if(loc.transit){this.currentLevel=loc.transit.plan.domain==='intergalactic'?'cosmology':'galaxy';}
    else if (this.selectedLevel) {
      this.currentLevel = this.selectedLevel;
    } else if (loc.cosmological || loc.address.galaxyId === 'cosmology' || loc.frameId.includes('cosmo')) {
      this.currentLevel = 'cosmology';
    } else if (loc.frameId.includes('galactic') || (!loc.address.systemId && !loc.systemPositionM)) {
      this.currentLevel = 'galaxy';
    } else if (!!loc.systemPositionM) {
      this.currentLevel = 'system';
    } else if (loc.surface && (loc.surface.altitudeM > 200000 || loc.address.bodyId !== 'earth')) {
      this.currentLevel = 'planet';
    } else {
      this.currentLevel = 'surface';
    }

    this.updateCanvasVisibility();

    this.updateCard();
    this.updateBreadcrumb();
    
    if (this.currentLevel !== 'surface' || !loc.frameId.includes('manaus')) {
      this.drawMap();
    }
    this.updateScale();
  }

  private drawMap(): void {
    this.renderers[this.currentLevel].draw(this.model.location, this.model.destination);
    const transit=this.model.location.transit;
    if(transit){
      const canvas=this.root.querySelector<HTMLCanvasElement>('#universal-canvas')!,ctx=canvas.getContext('2d')!;
      const x=canvas.width*.2,y=canvas.height*.75,w=canvas.width*.6;
      ctx.strokeStyle='#38bdf8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();
      ctx.fillStyle='#e2f5ff';for(const px of [x,x+w]){ctx.beginPath();ctx.arc(px,y,5,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#ffd166';ctx.beginPath();ctx.arc(x+w*transit.progress,y,7,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e2f5ff';ctx.font='13px sans-serif';ctx.fillText('SOURCE',x,y+22);ctx.fillText('DESTINATION',x+w-90,y+22);
    }
    this.updateScale();
  }

  private updateCanvasVisibility(): void {
    const city = this.currentLevel === 'surface' && this.model.location.frameId.includes('manaus');
    const cityCanvas = this.root.querySelector('#city-map') as HTMLCanvasElement;
    const universalCanvas = this.root.querySelector('#universal-canvas') as HTMLCanvasElement;
    if (cityCanvas) cityCanvas.style.display = city ? 'block' : 'none';
    if (universalCanvas) universalCanvas.style.display = city ? 'none' : 'block';
    const credit = this.root.querySelector<HTMLElement>('.map-credit');
    if (credit) credit.style.display = city ? 'block' : 'none';
  }

  private updateScale(): void {
    const scale = this.root.querySelector('.map-scale');
    if (scale) scale.textContent = this.currentLevel === 'system' ? this.renderers.system.scaleText
      : ({ surface: '5 km', planet: 'Escala planetária · km', galaxy: `${formatGalaxyName(this.model.location.address.galaxyId)} · kly`, cosmology: 'Grupo Local · Mly' } as const)[this.currentLevel];
  }

  private render() {
    this.root.innerHTML = `
      <div class="map-levels"><div id="map-breadcrumb"></div><div class="map-level-buttons">${(['surface','planet','system','galaxy','cosmology'] as const).map((level,i) => `<button data-map-level="${level}">${['Superfície','Planeta','Sistema','Galáxia','Cosmos'][i]}</button>`).join('')}</div></div>
      <div class="map-sidebar" style="width: 320px; border-right: 1px solid #333; padding: 1rem; overflow-y: auto;">
        <div class="where-am-i-card" id="where-am-i-card"></div>
        ${u2TestControlsEnabled()?'<section class="u2-test-controls"><b>U2 TEST · ANDROMEDA / RETURN</b><p>Chegada de teste em outro contexto galáctico.</p><button data-u2-test="arrival">ENTER ANDROMEDA · U2 TEST</button><button data-u2-test="solar">RETURN TO MILKY WAY / SOL · U2 TEST</button></section>':''}
        ${u1TestControlsEnabled()?'<section class="u1-test-controls"><b>U1 TEST · ARRIVAL / RETURN</b><p>Chegada de desenvolvimento, sem viagem interestelar.</p><button data-u1-test="select">SELECIONAR SISTEMA · 17,-2,4</button><button data-u1-test="arrival">MATERIALIZAR SISTEMA (U1 TEST)</button><button data-u1-test="solar">VOLTAR AO SOLAR (U1 TEST)</button></section>':''}
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
        <canvas id="universal-canvas" style="position: absolute; width: 100%; height: 100%;"></canvas>
        <div class="map-scale">━━━━━━ <span>5 km</span></div>
        <span class="map-credit">Dados viários © OpenStreetMap contributors · Geografia estilizada</span>
      </div>
    `;
    this.root.querySelectorAll<HTMLButtonElement>('[data-map-level]').forEach(button => {
      button.onclick = () => this.setLevel(button.dataset.mapLevel as typeof this.currentLevel);
    });

    const btnTranslocate = this.root.querySelector('#btn-translocate') as HTMLButtonElement;
    this.root.querySelectorAll<HTMLElement>('[data-u2-test]').forEach(button=>{button.onclick=()=>this.onTravel('u2-test-'+button.dataset.u2Test);});
    this.root.querySelectorAll<HTMLElement>('[data-u1-test]').forEach(button=>{
      button.onclick=()=>this.onTravel('u1-test-'+button.dataset.u1Test);
    });
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
    this.root.querySelectorAll<HTMLButtonElement>('[data-map-level]').forEach(button => {
      const active = button.dataset.mapLevel === this.currentLevel;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const b = this.root.querySelector('#map-breadcrumb');
    if (!b) return;
    const a = this.model.location.address;
    const items: { label: string; level: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology' }[] = [
      { label: 'COSMOS', level: 'cosmology' },
      { label: a.galaxyId ? a.galaxyId.replace('_', ' ').toUpperCase() : 'MILKY WAY', level: 'galaxy' },
    ];
    if (a.systemId) items.push({ label: a.systemId.toUpperCase(), level: 'system' });
    const focus = this.bodies.find(body => body.id === this.model.systemFocusBodyId);
    if (this.currentLevel === 'system' && focus) items.push({ label: focus.name.toUpperCase(), level: 'system' });
    else if (a.bodyId && this.currentLevel !== 'system') items.push({ label: a.bodyId.toUpperCase(), level: 'planet' });
    if (this.currentLevel === 'surface' && a.childFrame && (a.childFrame.includes('manaus') || a.childFrame.includes('surface') || a.childFrame.includes('legacy-enu'))) {
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
          if (this.currentLevel === 'system' && focus && el.textContent?.trim() === focus.name.toUpperCase()) return;
          this.setLevel(lvl);
        }
      };
    });
  }

  /**
   * Where the player is, in terms that apply where they are.
   *
   * The previous version printed "unavailable" for latitude, longitude, altitude and place
   * whenever the player was between planets -- four rows saying nothing, for four concepts that
   * do not exist out there. A surface coordinate is not missing in interplanetary space; it is
   * not a question. So the card asks a different one depending on the frame.
   *
   * `UniverseLocation.systemPositionM` is the coordinate authority throughout. Never the camera,
   * never an `Object3D` position: those are render-space and rebase under the player's feet.
   */
  private updateCard() {
    const c = this.root.querySelector('#where-am-i-card');
    if (!c) return;
    const loc = this.model.location;
    const a = loc.address;
    const interplanetary = !!loc.systemPositionM;

    let html = `<h3>LOCALIZAÇÃO ATUAL</h3><table class="card-table">`;
    html += `<tr><td>Galaxy</td><td>${a.galaxyId}</td></tr>`;
    html += `<tr><td>Sector</td><td>${a.sector.x},${a.sector.y},${a.sector.z}</td></tr>`;
    html += `<tr><td>System</td><td>${a.systemId || '—'}</td></tr>`;
    html += `<tr><td>Frame</td><td>${loc.frameId}</td></tr>`;

    if (interplanetary) {
      const p = loc.systemPositionM ?? [0, 0, 0];
      html += `<tr><td>Domain</td><td>Interplanetary</td></tr>`;
      html += `<tr><td>Reference</td><td>${a.bodyId || 'barycentre'}</td></tr>`;
      html += `<tr><td>X</td><td>${formatDistance(p[0])}</td></tr>`;
      html += `<tr><td>Y</td><td>${formatDistance(p[1])}</td></tr>`;
      html += `<tr><td>Z</td><td>${formatDistance(p[2])}</td></tr>`;
      if (this.flight) {
        const speed = formatSpeed(this.flight.speedMps);
        html += `<tr><td>Speed</td><td>${speed.value} ${speed.unit}</td></tr>`;
        html += `<tr><td>Destination</td><td>${this.flight.targetName ?? '—'}</td></tr>`;
        html += `<tr><td>Distance</td><td>${this.flight.distanceToTargetM === undefined ? '—' : formatDistance(this.flight.distanceToTargetM)}</td></tr>`;
        html += `<tr><td>ETA</td><td>${formatDuration(this.flight.timeToTargetS)}</td></tr>`;
      }
    } else {
      html += `<tr><td>Body</td><td>${a.bodyId || '—'}</td></tr>`;
      html += `<tr><td>Place</td><td>${a.childFrame?.includes('manaus') ? 'Manaus' : '—'}</td></tr>`;
      if (loc.surface) {
        html += `<tr><td>Lat/Lon</td><td>${loc.surface.latDeg.toFixed(4)}, ${loc.surface.lonDeg.toFixed(4)}</td></tr>`;
        html += `<tr><td>Altitude</td><td>${formatDistance(loc.surface.altitudeM)}</td></tr>`;
      }
      if (a.bodyId) {
        html += `<tr><td>Domain</td><td>${loc.surface && loc.surface.altitudeM > 150000 ? 'Orbital' : 'Local surface'}</td></tr>`;
      } else {
        html += `<tr><td>Domain</td><td>Interstellar</td></tr>`;
      }
    }

    html += `</table>`;
    if(loc.transit)html=`<h3>LOCALIZAÇÃO · EM TRÂNSITO</h3>${hypercruiseTelemetry(loc.transit,this.flight?.universalTarget?.target.displayName)}<small>Runtime de origem preservado até a chegada atômica.</small>`;

    const resolved=this.flight?.universalTarget;
    html+=`<section id="universal-target-card"><h3>ALVO DE NAVEGAÇÃO</h3>`;
    if(resolved){
      const t=resolved.target;
      html+=`<strong>${escapeHtml(t.displayName)}</strong><table class="card-table"><tr><td>Tipo</td><td>${t.kind}</td></tr>`
        +`<tr><td>Galáxia</td><td>${escapeHtml(formatGalaxyName(t.galaxyId))}</td></tr>`
        +`<tr><td>Distância</td><td>${resolved.distanceM===undefined?'—':formatDistance(resolved.distanceM)}</td></tr>`
        +`<tr><td>Materializado</td><td>${resolved.materialized?'sim':'não'}</td></tr>`
        +`<tr><td>Viagem</td><td>${travelCapabilityLabel(resolved.travelCapability)}</td></tr></table>`
        +`<small style="overflow-wrap:anywhere">${escapeHtml(t.key)}</small>`;
    }else html+='Nenhum alvo';
    html+='</section>';
    if(this.currentLevel==='galaxy'||this.currentLevel==='cosmology'){
      html+=`<h3>GALÁXIA ATUAL · ${escapeHtml(formatGalaxyName(this.model.location.address.galaxyId))}</h3>`;
      html+='<h3>CATÁLOGO DE DESTINOS</h3><small>Marcadores esquemáticos · selecionar não inicia viagem</small>';
      for(const d of this.targetCatalog.filter(d=>this.currentLevel==='galaxy'
        ? ['galaxy','black-hole','system'].includes(d.kind) : ['galaxy','cluster','cosmic-anchor','observable-horizon','system'].includes(d.kind))){
        const key=universalTargetKey(d);
        html+=`<button class="map-body-target" data-universal-target="${escapeHtml(key)}" aria-pressed="${resolved?.target.key===key}">${escapeHtml(d.displayName)} · ${d.kind}${d.galaxyId===this.model.location.address.galaxyId?' · ATUAL':' · REMOTO'}</button>`;
      }
    }

    // Every body the system knows about, with the coordinates that make the list navigable.
    // Dynamic from `activeSystem.bodies`: nothing here is a hard-coded planet.
    if (this.bodies.length) {
      if (this.model.systemFocusBodyId) html += `<button class="map-body-target" data-system-overview>← Sistema ativo</button>`;
      html += `<h3>CORPOS DO SISTEMA</h3><table class="card-table body-table">`;
      html += `<tr><th>Corpo</th><th>Distância</th></tr>`;
      for (const body of this.bodies) {
        const parent = body.parentId ?? this.renderers?.system.parentOf(body);
        const hasMoons = !!parent && this.bodies.some(child => (child.parentId ?? this.renderers?.system.parentOf(child)) === body.id);
        html += `<tr class="${body.selected ? 'selected-body' : ''}">`
          + `<td><button class="map-body-target" data-body-target="${body.id}" style="margin-left:${parent && parent !== 'sun' ? 12 : 0}px" aria-pressed="${body.selected}">${body.selected ? 'TRAVADO · ' : ''}${body.name}</button>`
          + (hasMoons ? `<button class="map-body-target" data-system-focus="${body.id}" aria-label="Focar sistema de ${body.name}">Focar luas</button>` : '') + `</td>`
          + `<td>${formatDistance(body.distanceFromPlayerM)}</td></tr>`;
      }
      html += `</table>`;
    }

    c.innerHTML = html;
    c.querySelectorAll<HTMLButtonElement>('[data-universal-target]').forEach(button=>{
      button.onclick=()=>this.selectTarget(button.dataset.universalTarget!);
    });
    c.querySelectorAll<HTMLButtonElement>('[data-body-target]').forEach(button => {
      button.onclick = () => this.selectTarget(button.dataset.bodyTarget!);
    });
    c.querySelectorAll<HTMLButtonElement>('[data-system-focus]').forEach(button => {
      button.onclick = () => this.focusSystem(button.dataset.systemFocus);
    });
    const overview = c.querySelector<HTMLButtonElement>('[data-system-overview]');
    if (overview) overview.onclick = () => this.focusSystem();
  }
}
