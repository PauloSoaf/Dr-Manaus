import { hypercruiseTelemetry } from '../HypercruiseTelemetry';
import { u1TestControlsEnabled, u2TestControlsEnabled } from '../../world/runtime/U1TestControls';
import { MapNavigationModel } from './MapNavigationModel';
import { formatDistance, formatDuration, formatSpeed, formatGalaxyName } from '../format';
import type { HUDBody, HUDFlightTelemetry } from '../HUD';
import type { UniverseLocation } from '../../world/spatial/UniverseLocation';
import type { Vector3 } from 'three/webgpu';
import { SurfaceMapRenderer, PlanetMapRenderer, PlanetMap3DRenderer, SystemMapRenderer, GalaxyMapRenderer, CosmologyMapRenderer } from './MapRenderers';
import { UniverseCoordinates } from '../../world/spatial/UniverseCoordinates';
import { universalTargetKey, type UniversalTargetDescriptor } from '../../world/travel/UniversalNavigationTarget';
import { travelCapabilityLabel, type ResolvedUniversalTarget } from '../../world/travel/UniversalTargetResolver';
import { DEFAULT_UNIVERSE_SEED, type ProceduralGalaxyDiscovery } from '../../world/galaxy/ProceduralGalaxyDiscovery';
import { isCanonicalGalaxyId } from '../../world/celestial/GalaxyDefinition';
import { SOLAR_BODY_PROFILES } from '../../world/celestial/CelestialBodyProfile';
import {
  CosmicAtlasModel,
  isCanonicalTarget,
  type CosmicAtlasEntry,
  type CosmicAtlasFilterOptions,
  type AtlasGalaxyMorphology,
} from '../../world/exploration/CosmicAtlasModel';
import { UniversalTargetCatalog } from '../../world/travel/UniversalTargetCatalog';

import {
  getCanonicalBlackHole,
  generateStellarBlackHole,
} from '../../world/celestial/BlackHoleDescriptor';

import {
  describeNavigationGuidance,
  type NavigationReadinessState,
  type NavigationGuidance,
} from '../../world/travel/NavigationGuidance';
export {
  describeNavigationGuidance,
  type NavigationReadinessState,
  type NavigationGuidance,
} from '../../world/travel/NavigationGuidance';

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function renderUniversalTargetCardHtml(
  resolved: ResolvedUniversalTarget | undefined,
  discovery?: ProceduralGalaxyDiscovery,
  currentGalaxyId?: string,
  isFavorite = false,
  isVisited = false,
  catalog?: UniversalTargetCatalog,
): string {
  let html = `<section id="universal-target-card"><h3>ALVO DE NAVEGAÇÃO</h3>`;
  if (!resolved) {
    html += `Nenhum alvo</section>`;
    return html;
  }
  const t = resolved.target;
  const desc = t.galaxyId && discovery ? discovery.findGalaxyById(t.galaxyId) : undefined;
  const isCanonical = isCanonicalTarget(t);
  let classification = isCanonical ? 'Canônica' : 'Procedural Sintética';
  if (t.kind === 'galaxy') {
    classification = isCanonical ? 'Galáxia Canônica' : 'Galáxia Procedural';
  } else if (t.kind === 'system') {
    classification = isCanonical ? 'Sistema Catalogado' : 'Sistema Procedural';
  } else if (t.kind === 'body' || t.kind === 'star') {
    classification = isCanonical ? 'Corpo Canônico (Sistema Solar)' : 'Corpo Procedural Sintético';
  } else if (t.kind === 'black-hole') {
    classification = isCanonical ? 'Buraco Negro Supermassivo Canônico' : 'Buraco Negro Estelar Procedural';
  }
  const guidance = describeNavigationGuidance(
    resolved.travelCapability,
    t.kind,
    t.galaxyId,
    currentGalaxyId,
    discovery ? discovery.universeSeed : DEFAULT_UNIVERSE_SEED,
  );
  const cellText = desc
    ? `[${desc.cell.x}, ${desc.cell.y}, ${desc.cell.z}]`
    : t.address && 'sector' in t.address
      ? `${t.address.sector.x},${t.address.sector.y},${t.address.sector.z}`
      : t.address && 'cell' in t.address
        ? `[${t.address.cell.x}, ${t.address.cell.y}, ${t.address.cell.z}]`
        : '—';

  html += `<div class="target-section" data-target-section="identidade">`;
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;"><span style="font-size:10px;color:#38bdf8;font-weight:700;letter-spacing:0.06em;">IDENTIDADE</span><button data-target-fav-toggle="${escapeHtml(t.key)}" style="background:none;border:1px solid ${isFavorite ? '#facc15' : '#475569'};color:${isFavorite ? '#facc15' : '#94a3b8'};border-radius:4px;padding:1px 6px;cursor:pointer;font-size:10px;font-weight:600;">${isFavorite ? '★ FAVORITO' : '☆ FAVORITAR'}</button></div>`;
  html += `<strong>${escapeHtml(t.displayName)}</strong>`;
  html += `<table class="card-table">`;
  html += `<tr><td>Tipo</td><td>${escapeHtml(t.kind)}</td></tr>`;
  html += `<tr><td>Classificação</td><td>${classification}</td></tr>`;
  html += `<tr><td>Visita</td><td>${isVisited ? '<span style="color:#4ade80;font-weight:600;">✓ Visitado</span>' : '<span style="color:#94a3b8;">Não visitado</span>'}</td></tr>`;
  html += `</table>`;
  html += `<small style="overflow-wrap:anywhere">${escapeHtml(t.key)}</small>`;
  html += `</div>`;

  html += `<div class="target-section" data-target-section="posicao" style="margin-top:6px;">`;
  html += `<div style="font-size:10px;color:#38bdf8;font-weight:700;letter-spacing:0.06em;margin-bottom:2px;">POSIÇÃO</div>`;
  html += `<table class="card-table">`;
  html += `<tr><td>Galáxia</td><td>${escapeHtml(formatGalaxyName(t.galaxyId))}</td></tr>`;
  html += `<tr><td>Célula / Setor</td><td>${escapeHtml(cellText)}</td></tr>`;
  html += `<tr><td>Distância</td><td>${resolved.distanceM === undefined ? '—' : formatDistance(resolved.distanceM)}</td></tr>`;
  html += `</table>`;
  html += `</div>`;

  html += `<div class="target-section" data-target-section="exploracao" style="margin-top:6px;">`;
  html += `<div style="font-size:10px;color:#38bdf8;font-weight:700;letter-spacing:0.06em;margin-bottom:2px;">EXPLORAÇÃO</div>`;
  html += `<table class="card-table">`;
  if (desc) {
    html += `<tr><td>Morfologia</td><td>${escapeHtml(desc.morphology)} (${escapeHtml(desc.family)})</td></tr>`;
    html += `<tr><td>Diâmetro</td><td>${Math.round(desc.diameterLy / 1000)} kly</td></tr>`;
    html += `<tr><td>Estrelas Est.</td><td>${(desc.estimatedStarCount / 1e9).toFixed(1)} bilhões</td></tr>`;
  }
  html += `<tr><td>Materializado</td><td>${resolved.materialized ? 'sim' : 'não'}</td></tr>`;
  html += `</table>`;
  html += `</div>`;

  // Astrophysics & Surface condition section for bodies and stars
  const candidateId = t.bodyId ?? t.objectId;
  let env = candidateId && SOLAR_BODY_PROFILES[candidateId]?.environment;
  let canLand = candidateId ? SOLAR_BODY_PROFILES[candidateId]?.canLand : false;
  let landingMode = candidateId ? SOLAR_BODY_PROFILES[candidateId]?.landingMode : undefined;
  let bodyClass = candidateId ? SOLAR_BODY_PROFILES[candidateId]?.bodyClass : undefined;
  let hasAtmo = candidateId ? SOLAR_BODY_PROFILES[candidateId]?.hasAtmosphere : false;
  let hasRings = candidateId ? (!!SOLAR_BODY_PROFILES[candidateId]?.visual.rings || !!SOLAR_BODY_PROFILES[candidateId]?.environment?.hasRings) : false;

  if (!env && catalog && t.address && 'sector' in t.address && t.address.systemId) {
    const p = catalog.proceduralDescriptor(t.address.galaxyId, t.address.sector, t.address.systemId);
    if (p) {
      const b = p.system.bodies.find(cand => cand.id === candidateId);
      if (b?.profile?.environment) {
        env = b.profile.environment;
        canLand = b.profile.canLand;
        landingMode = b.profile.landingMode;
        bodyClass = b.profile.bodyClass;
        hasAtmo = b.profile.hasAtmosphere;
        hasRings = !!b.profile.visual.rings || !!b.profile.environment?.hasRings;
      }
    }
  }

  if (env) {
    html += `<div class="target-section" data-target-section="astrofisica" style="margin-top:6px;">`;
    html += `<div style="font-size:10px;color:#38bdf8;font-weight:700;letter-spacing:0.06em;margin-bottom:2px;">ASTROFÍSICA &amp; SUPERFÍCIE</div>`;
    html += `<table class="card-table">`;
    html += `<tr><td>Classificação</td><td><strong>${escapeHtml(env.label)}</strong></td></tr>`;
    const tempLabel = isCanonical ? 'Temperatura Média (observada)' : 'Temperatura de Equilíbrio (estimada)';
    html += `<tr><td>${tempLabel}</td><td>${env.temperatureK} K (${Math.round(env.temperatureK - 273.15)}°C)</td></tr>`;
    html += `<tr><td>Gravidade</td><td>${env.surfaceGravityMps2} m/s² (${(env.surfaceGravityMps2 / 9.80665).toFixed(2)} g)</td></tr>`;

    let landingHtml = '<span style="color:#f87171;font-weight:600;">✗ Sem pouso</span>';
    if (landingMode === 'photosphere') {
      landingHtml = '<span style="color:#fde047;font-weight:600;">✓ Entrada permitida na fotosfera</span>';
    } else if (canLand && landingMode === 'surface') {
      landingHtml = '<span style="color:#4ade80;font-weight:600;">✓ Pouso permitido (superfície sólida)</span>';
    } else if (bodyClass === 'gas-giant' || bodyClass === 'ice-giant') {
      landingHtml = '<span style="color:#f87171;font-weight:600;">✗ Pouso impossível (gigante fluido)</span>';
    } else if (bodyClass === 'star') {
      landingHtml = '<span style="color:#f87171;font-weight:600;">✗ Sem pouso (fotosfera inóspita)</span>';
    }
    html += `<tr><td>Pouso</td><td>${landingHtml}</td></tr>`;

    if (hasRings) {
      html += `<tr><td>Anéis</td><td><span style="color:#fde047;font-weight:600;">★ Sistema de anéis presente</span></td></tr>`;
    }
    html += `<tr><td>Atmosfera</td><td>${hasAtmo ? (env.atmosphericPressureAtm ? env.atmosphericPressureAtm + ' atm' : 'Presente') : 'Rarefeita / Vácuo'}</td></tr>`;
    html += `</table>`;
    html += `<div style="font-size:10px;color:#94a3b8;margin-top:4px;font-style:italic;">${escapeHtml(env.description)}</div>`;
    html += `</div>`;
  }

  if (t.kind === 'black-hole') {
    const bhDesc = getCanonicalBlackHole(t.objectId)
      ?? (t.address && 'sector' in t.address ? generateStellarBlackHole(t.address.galaxyId, t.address.sector) : undefined);

    html += `<div class="target-section" data-target-section="astrofisica-bh" style="margin-top:6px;">`;
    html += `<div style="font-size:10px;color:#f59e0b;font-weight:700;letter-spacing:0.06em;margin-bottom:2px;">ASTROFÍSICA &amp; HORIZONTE DE EVENTOS</div>`;
    html += `<table class="card-table">`;
    if (bhDesc) {
      const massFormat = bhDesc.massSolar >= 1e6
        ? `${(bhDesc.massSolar / 1e6).toFixed(2)} milhões M☉`
        : `${bhDesc.massSolar.toFixed(1)} M☉`;
      html += `<tr><td>Massa</td><td><strong>${massFormat}</strong></td></tr>`;
      html += `<tr><td>Spin Kerr (a*)</td><td>${bhDesc.spin01.toFixed(3)}</td></tr>`;
      const rsKm = (bhDesc.schwarzschildRadiusM / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
      html += `<tr><td>Raio Schwarzschild</td><td>${rsKm} km</td></tr>`;
      const rhKm = (bhDesc.eventHorizonRadiusM / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
      html += `<tr><td>Horizonte de Kerr</td><td>${rhKm} km</td></tr>`;
      const shKm = (bhDesc.shadowRadiusM / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
      html += `<tr><td>Sombra Lenteada</td><td>${shKm} km</td></tr>`;
    }
    html += `<tr><td>Pouso</td><td><span style="color:#f87171;font-weight:600;">✗ Pouso impossível (singularidade relativística)</span></td></tr>`;
    if (bhDesc?.accretion) {
      const tempK = bhDesc.accretion.peakTemperatureK.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
      html += `<tr><td>Disco de Acreção</td><td><span style="color:#fde047;font-weight:600;">Ativo (${tempK} K)</span></td></tr>`;
    }
    html += `</table>`;
    html += `<div style="font-size:10px;color:#94a3b8;margin-top:4px;font-style:italic;">Horizonte de eventos unidirecional: escape impossível após cruzamento da fronteira relativística.</div>`;
    html += `</div>`;
  }

  html += `<div class="target-section" data-target-section="navegacao" style="margin-top:6px;padding:6px;background:rgba(15,23,42,0.65);border-radius:4px;border:1px solid ${guidance.available ? '#0284c7' : '#334155'};">`;
  html += `<div style="font-size:10px;color:${guidance.available ? '#38bdf8' : '#94a3b8'};font-weight:700;letter-spacing:0.06em;margin-bottom:2px;">NAVEGAÇÃO</div>`;
  html += `<table class="card-table">`;
  html += `<tr><td>Viagem</td><td>${travelCapabilityLabel(resolved.travelCapability)}</td></tr>`;
  html += `<tr><td>Status</td><td>${escapeHtml(guidance.status)}</td></tr>`;
  html += `</table>`;
  html += `<div data-travel-shortcut-hint style="font-size:11px;margin-top:4px;color:${guidance.available ? '#fde047' : '#94a3b8'};">${escapeHtml(guidance.shortcutHint)}</div>`;
  html += `</div>`;
  html += `</section>`;
  return html;
}

export class UniversalMapPanel {
  private readonly root: HTMLElement;
  model: MapNavigationModel;
  
  readonly renderers: {
    surface: SurfaceMapRenderer;
    planet: PlanetMap3DRenderer;
    system: SystemMapRenderer;
    galaxy: GalaxyMapRenderer;
    cosmology: CosmologyMapRenderer;
  };
  readonly atlasModel: CosmicAtlasModel;
  private atlasFilter: CosmicAtlasFilterOptions = { query: '', kind: 'all', statusFilter: 'all', morphology: 'all', sort: 'name', limit: 24 };
  currentLevel: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology' | 'atlas' = 'surface';
  private selectedLevel?: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology' | 'atlas';
  /** Live bodies and cruise telemetry, fed by the HUD each refresh. */
  private bodies: readonly HUDBody[] = [];
  private flight?: HUDFlightTelemetry;
  private targetCatalog: readonly UniversalTargetDescriptor[] = [];
  private inTravel = false;

  private lastRecordedAddressKey = '';
  private lastAtlasSelectedKey?: string;
  private lastAtlasGalaxyId?: string;
  private atlasDirty = false;

  constructor(
    private readonly container: HTMLElement,
    initialLocation: UniverseLocation,
    private readonly onTravel: (id: string) => void,
    private readonly onClose: () => void,
    private readonly onSelectTarget: (id: string) => string | undefined | void = () => {},
    atlasModel?: CosmicAtlasModel,
  ) {
    this.model = new MapNavigationModel(initialLocation);
    this.root = document.createElement('div');
    this.root.className = 'map-layout';
    this.buildDomSkeleton();
    if (container) {
      container.innerHTML = '';
      container.appendChild(this.root);
    }
    
    const canvas = this.root.querySelector('#universal-canvas') as HTMLCanvasElement;
    this.renderers = {
      surface: new SurfaceMapRenderer(canvas),
      planet: new PlanetMap3DRenderer(((this.root.querySelector('#planet-3d-canvas') as HTMLCanvasElement) ?? canvas)),
      system: new SystemMapRenderer(canvas),
      galaxy: new GalaxyMapRenderer(canvas),
      cosmology: new CosmologyMapRenderer(canvas),
    };
    this.atlasModel = atlasModel ?? new CosmicAtlasModel(new UniversalTargetCatalog(undefined, this.renderers.cosmology.discovery), undefined, this.renderers.cosmology.discovery);
    this.lastRecordedAddressKey = this.getAddressKey(initialLocation.address);
    this.lastAtlasGalaxyId = initialLocation.address.galaxyId;
    this.lastAtlasSelectedKey = undefined;
    this.atlasDirty = false;
    this.atlasModel.recordArrival(initialLocation);

    this.bindCanvasListeners(canvas);

    this.updateCard();
    this.updateBreadcrumb();
    this.updateCanvasVisibility();
    this.updateScale();
  }

  private getAddressKey(address: UniverseLocation['address']): string {
    return `${address.galaxyId || ''}:${address.sector.x},${address.sector.y},${address.sector.z}:${address.systemId || ''}:${address.bodyId || ''}:${address.childFrame || ''}`;
  }

  private bindCanvasListeners(canvas: HTMLCanvasElement): void {
    if (!canvas || !canvas.addEventListener) return;
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    canvas.addEventListener('mousedown', event => {
      if (this.currentLevel === 'cosmology') {
        isDragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        canvas.style.cursor = 'grabbing';
      }
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', event => {
        if (isDragging && this.currentLevel === 'cosmology') {
          const dx = event.clientX - dragStartX;
          const dy = event.clientY - dragStartY;
          dragStartX = event.clientX;
          dragStartY = event.clientY;
          this.renderers.cosmology.pan(dx, dy);
          this.drawMap();
        } else if (this.currentLevel === 'cosmology' || this.currentLevel === 'galaxy') {
          const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 800, height: 600 };
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            const prevHover = this.model.hoveredTargetKey;
            const nextHover =
              this.currentLevel === 'cosmology'
                ? this.renderers.cosmology.updateHover(x, y)
                : this.renderers.galaxy.markers.hitTest(x, y);
            this.model.hoveredTargetKey = nextHover;
            this.renderers.galaxy.hoveredTargetKey = nextHover;
            canvas.style.cursor = nextHover
              ? 'pointer'
              : this.currentLevel === 'cosmology'
                ? 'grab'
                : 'default';
            if (prevHover !== nextHover) this.drawMap();
          }
        }
      });
      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          canvas.style.cursor = this.currentLevel === 'cosmology' ? 'grab' : 'default';
        }
      });
    }

    canvas.addEventListener('wheel', event => {
      if (this.currentLevel === 'system') {
        event.preventDefault();
        this.renderers.system.changeZoom(event.deltaY);
        this.drawMap();
      } else if (this.currentLevel === 'cosmology') {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 800, height: 600 };
        const cx = event.clientX - rect.left;
        const cy = event.clientY - rect.top;
        this.renderers.cosmology.changeZoom(event.deltaY, cx, cy);
        this.drawMap();
      }
    }, { passive: false });

    canvas.addEventListener('click', event => {
      const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 800, height: 600 };
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const id = this.currentLevel === 'system' ? this.renderers.system.hitTest(x, y)
        : this.currentLevel === 'galaxy' ? this.renderers.galaxy.markers.hitTest(x, y)
        : this.currentLevel === 'cosmology' ? (this.renderers.cosmology.hitTest(x, y) ?? this.renderers.cosmology.markers.hitTest(x, y)) : undefined;
      if (id) this.selectTarget(id);
    });
  }

  setLevel(level: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology' | 'atlas') {
    if (level === 'system') {
      this.model.systemFocusBodyId = undefined;
      this.renderers.system.setFocus();
    }
    this.selectedLevel = level;
    this.currentLevel = level;
    this.updateCard();
    this.updateBreadcrumb();
    this.updateCanvasVisibility();
    if (this.currentLevel === 'atlas') {
      this.atlasDirty = false;
      this.renderAtlasView();
    } else if (this.currentLevel !== 'surface' || !this.model.location.frameId.includes('manaus')) {
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
    targetCatalog: readonly UniversalTargetDescriptor[] = [],
  ) {
    this.bodies = bodies;
    this.flight = flight;
    this.targetCatalog = targetCatalog;

    const currentAddressKey = this.getAddressKey(location.address);
    if (currentAddressKey !== this.lastRecordedAddressKey) {
      this.lastRecordedAddressKey = currentAddressKey;
      this.atlasModel.recordArrival(location);
      this.atlasDirty = true;
    }

    const selectedKey = flight?.universalTarget?.target.key;
    if (selectedKey !== this.lastAtlasSelectedKey) {
      this.lastAtlasSelectedKey = selectedKey;
      this.atlasDirty = true;
    }

    const currentGalaxyId = location.address.galaxyId;
    if (currentGalaxyId !== this.lastAtlasGalaxyId) {
      this.lastAtlasGalaxyId = currentGalaxyId;
      this.atlasDirty = true;
    }

    this.model.selectedTargetKey = selectedKey;
    this.renderers.galaxy.selectedTargetKey = selectedKey;
    this.renderers.cosmology.selectedTargetKey = selectedKey;
    this.renderers.galaxy.markers.setTargets(targetCatalog);
    this.renderers.cosmology.markers.setTargets(targetCatalog);
    const inTravel = !!location.systemPositionM || !!location.transit;
    if (inTravel && !this.inTravel) this.selectedLevel = undefined;
    this.inTravel = inTravel;
    this.renderers.system.setBodies(bodies);
    this.model.updateLocation(location);
    this.model.destination = destination;
    
    const loc = this.model.location;
    if (loc.transit) {
      this.currentLevel = loc.transit.plan.domain === 'intergalactic' ? 'cosmology' : 'galaxy';
    } else if (this.selectedLevel) {
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
    
    if (this.currentLevel === 'atlas') {
      if (this.atlasDirty) {
        this.atlasDirty = false;
        this.renderAtlasView();
      }
    } else if (this.currentLevel !== 'surface' || !loc.frameId.includes('manaus')) {
      this.drawMap();
    }
    this.updateScale();
  }

  private drawMap(): void {
    if (this.currentLevel === 'atlas') {
      this.renderAtlasView();
      return;
    }
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
    const isPlanet = this.currentLevel === 'planet';
    const planet3DCanvas = this.root.querySelector('#planet-3d-canvas') as HTMLCanvasElement;
    const isAtlas = this.currentLevel === 'atlas';
    const atlasContainer = this.root.querySelector('#atlas-view-container') as HTMLElement;
    if (universalCanvas) universalCanvas.style.display = (city || isPlanet || isAtlas) ? 'none' : 'block';
    if (planet3DCanvas) planet3DCanvas.style.display = isPlanet ? 'block' : 'none';
    if (atlasContainer) atlasContainer.style.display = isAtlas ? 'block' : 'none';
    const credit = this.root.querySelector<HTMLElement>('.map-credit');
    if (credit) credit.style.display = city ? 'block' : 'none';
    const scale = this.root.querySelector<HTMLElement>('.map-scale');
    if (scale) scale.style.display = isAtlas ? 'none' : 'block';
  }

  private updateScale(): void {
    const scale = this.root.querySelector('.map-scale');
    if (!scale) return;
    if (this.currentLevel === 'atlas') {
      scale.textContent = 'Atlas Cósmico · Exploração & Favoritos';
    } else if (this.currentLevel === 'system') {
      scale.textContent = this.renderers.system.scaleText;
    } else if (this.currentLevel === 'cosmology') {
      const spanMly = (this.renderers.cosmology.zoomMpc * 3.26156).toFixed(1);
      scale.textContent = `Cosmos · ${this.renderers.cosmology.zoomMpc.toFixed(1)} Mpc (~${spanMly} Mly)`;
    } else {
      scale.textContent = ({
        surface: '5 km',
        planet: 'Escala planetária · km',
        galaxy: `${formatGalaxyName(this.model.location.address.galaxyId)} · kly`,
      } as const)[this.currentLevel as 'surface' | 'planet' | 'galaxy'] ?? 'Escala';
    }
  }

  private buildDomSkeleton(): void {
    this.root.innerHTML = `
      <div class="map-levels"><div id="map-breadcrumb"></div><div class="map-level-buttons">${(['surface','planet','system','galaxy','cosmology','atlas'] as const).map((level,i) => `<button data-map-level="${level}">${['Superfície','Planeta','Sistema','Galáxia','Cosmos','Atlas'][i]}</button>`).join('')}</div></div>
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
        <canvas id="planet-3d-canvas" style="position: absolute; width: 100%; height: 100%; display: none;"></canvas>
        <div id="atlas-view-container" style="position: absolute; width: 100%; height: 100%; display: none; overflow-y: auto; background: #090d16; color: #f8fafc; padding: 1.25rem; box-sizing: border-box;"></div>
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
          const galaxyDesc = this.renderers?.cosmology?.discovery?.findGalaxyById(val)
            ?? (this.renderers?.cosmology?.discovery?.search(val)[0]);
          if (galaxyDesc) {
            const key = `galaxy/${encodeURIComponent(galaxyDesc.id)}`;
            this.selectTarget(key);
            if (coordStatus) coordStatus.textContent = `Galáxia: ${galaxyDesc.name}`;
            return;
          }
          this.onTravel(val);
        }
      };
    }
  }

  private render(): void {
    this.buildDomSkeleton();
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
    const items: { label: string; level: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology' | 'atlas' }[] = [
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
    if (this.currentLevel === 'atlas') {
      items.push({ label: 'ATLAS CÓSMICO', level: 'atlas' });
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
    if(loc.transit)html=`<h3>LOCALIZAÇÃO · EM TRÂNSITO</h3><div class="cruise-block hypercruise-map">${hypercruiseTelemetry(loc.transit,this.flight?.universalTarget?.target.displayName)}</div>`;

    const resolved=this.flight?.universalTarget;
    const selectedKey = resolved?.target.key;
    const isFav = selectedKey ? (this.atlasModel?.isFavorite(selectedKey) ?? false) : false;
    const isVis = selectedKey ? (this.atlasModel?.isVisited(selectedKey) ?? false) : false;
    html+=renderUniversalTargetCardHtml(resolved,this.renderers?.cosmology?.discovery,this.model.location.address.galaxyId,isFav,isVis,this.atlasModel?.catalog);
    if(this.currentLevel==='galaxy'||this.currentLevel==='cosmology'){
      html+=`<h3>GALÁXIA ATUAL · ${escapeHtml(formatGalaxyName(this.model.location.address.galaxyId))}</h3>`;
      html+='<h3>CATÁLOGO DE DESTINOS</h3><small>Marcadores esquemáticos · selecionar não inicia viagem</small>';
      for(const d of this.targetCatalog.filter(d=>this.currentLevel==='galaxy'
        ? ['galaxy','black-hole','system'].includes(d.kind) : ['galaxy','cluster','cosmic-anchor','observable-horizon','system'].includes(d.kind))){
        const key=universalTargetKey(d);
        const favIcon = this.atlasModel?.isFavorite(key) ? '★ ' : '';
        const visIcon = this.atlasModel?.isVisited(key) ? '✓ ' : '';
        html+=`<button class="map-body-target" data-universal-target="${escapeHtml(key)}" aria-pressed="${resolved?.target.key===key}">${favIcon}${visIcon}${escapeHtml(d.displayName)} · ${d.kind}${d.galaxyId===this.model.location.address.galaxyId?' · ATUAL':' · REMOTO'}</button>`;
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
    c.querySelectorAll<HTMLButtonElement>('[data-target-fav-toggle]').forEach(button => {
      button.onclick = (e) => {
        e.stopPropagation();
        const key = button.dataset.targetFavToggle;
        if (key && this.atlasModel) {
          this.atlasModel.toggleFavorite(key);
          this.updateCard();
          if (this.currentLevel === 'atlas') {
            this.renderAtlasView();
          } else {
            this.atlasDirty = true;
          }
        }
      };
    });
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

  renderAtlasView(): void {
    const container = this.root.querySelector('#atlas-view-container') as HTMLElement;
    if (!container) return;

    const prevScrollTop = container.scrollTop;
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const wasSearchFocused = activeEl?.id === 'atlas-search-input';
    const selStart = wasSearchFocused ? (activeEl as HTMLInputElement).selectionStart : null;
    const selEnd = wasSearchFocused ? (activeEl as HTMLInputElement).selectionEnd : null;

    const currentGalaxyId = this.model.location.address.galaxyId;
    const result = this.atlasModel.query(this.atlasFilter, currentGalaxyId);
    const stats = result.statistics;

    let html = `
      <div class="atlas-header" style="margin-bottom: 1.25rem; border-bottom: 1px solid #1e293b; padding-bottom: 1rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <span class="eyebrow" style="color:#38bdf8; font-size:11px; font-weight:700; letter-spacing:0.08em;">ATLAS DE DESCOBERTAS</span>
            <h2 style="margin:2px 0 0; font-size:1.4rem; color:#f8fafc;">Navegação &amp; Exploração Galáctica</h2>
          </div>
          <div style="font-size:11px; color:#94a3b8; background:#0f172a; padding:6px 12px; border-radius:6px; border:1px solid #1e293b;">
            Galáxia Atual: <strong style="color:#38bdf8;">${escapeHtml(formatGalaxyName(currentGalaxyId))}</strong>
          </div>
        </div>

        <div class="atlas-stats-bar" style="display:flex; gap:12px; flex-wrap:wrap; margin-top:10px; font-size:11px; color:#94a3b8; background:rgba(15,23,42,0.6); padding:8px 12px; border-radius:6px;">
          <div>Galáxias: <strong style="color:#f8fafc;">${stats.totalGalaxies}</strong> <span style="color:#64748b;">(${stats.canonicalGalaxies} canônicas, ${stats.proceduralGalaxies} procedurais)</span></div>
          <div style="color:#334155;">•</div>
          <div>Sistemas: <strong style="color:#f8fafc;">${stats.totalSystems}</strong></div>
          <div style="color:#334155;">•</div>
          <div>Destinos Visitados: <strong style="color:#4ade80;">${stats.visitedCount}</strong></div>
          <div style="color:#334155;">•</div>
          <div>Favoritos: <strong style="color:#facc15;">${stats.favoritesCount}</strong></div>
          <div style="color:#334155;">•</div>
          <div>Aptos p/ Voo: <strong style="color:#38bdf8;">${stats.flyableCount}</strong></div>
        </div>
      </div>

      <div class="atlas-controls" style="display:flex; flex-direction:column; gap:8px; margin-bottom:1.25rem;">
        <div style="display:flex; gap:8px;">
          <input type="text" id="atlas-search-input" placeholder="Buscar por nome, designação (ex: Andromeda, M31, DM-PG), setor ou coordenadas..." value="${escapeHtml(this.atlasFilter.query ?? '')}" style="flex:1; padding:8px 12px; background:#1e293b; border:1px solid #334155; color:#f8fafc; border-radius:6px; font-size:12px;" />
          ${this.atlasFilter.query ? '<button id="atlas-search-clear" style="padding:0 12px; background:#334155; color:#f8fafc; border:none; border-radius:6px; cursor:pointer; font-size:12px;">Limpar</button>' : ''}
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; font-size:11px; align-items:center;">
          <span style="color:#64748b; font-weight:600;">TIPO:</span>
          ${(['all','galaxy','system','body'] as const).map(k => `
            <button data-filter-kind="${k}" style="padding:3px 8px; border-radius:4px; border:1px solid ${this.atlasFilter.kind === k || (k === 'all' && !this.atlasFilter.kind) ? '#0284c7' : '#334155'}; background:${this.atlasFilter.kind === k || (k === 'all' && !this.atlasFilter.kind) ? '#0369a1' : 'transparent'}; color:#f8fafc; cursor:pointer;">${{ all:'Todos', galaxy:'Galáxias', system:'Sistemas', body:'Planetas/Luas' }[k]}</button>
          `).join('')}

          <span style="color:#64748b; font-weight:600; margin-left:8px;">STATUS:</span>
          ${(['all','favorites','visited','flyable'] as const).map(s => `
            <button data-filter-status="${s}" style="padding:3px 8px; border-radius:4px; border:1px solid ${this.atlasFilter.statusFilter === s || (s === 'all' && !this.atlasFilter.statusFilter) ? '#0284c7' : '#334155'}; background:${this.atlasFilter.statusFilter === s || (s === 'all' && !this.atlasFilter.statusFilter) ? '#0369a1' : 'transparent'}; color:#f8fafc; cursor:pointer;">${{ all:'Todos', favorites:'★ Favoritos', visited:'✓ Visitados', flyable:'Aptos p/ Voo' }[s]}</button>
          `).join('')}

          <span style="color:#64748b; font-weight:600; margin-left:8px;">MORFOLOGIA:</span>
          ${(['all','spiral','barred-spiral','elliptical','irregular'] as const).map(m => `
            <button data-filter-morph="${m}" style="padding:3px 8px; border-radius:4px; border:1px solid ${this.atlasFilter.morphology === m || (m === 'all' && !this.atlasFilter.morphology) ? '#0284c7' : '#334155'}; background:${this.atlasFilter.morphology === m || (m === 'all' && !this.atlasFilter.morphology) ? '#0369a1' : 'transparent'}; color:#f8fafc; cursor:pointer;">${{ all:'Todas', spiral:'Espiral', 'barred-spiral':'Espiral Barrada', elliptical:'Elíptica', irregular:'Irregular' }[m]}</button>
          `).join('')}

          <span style="color:#64748b; font-weight:600; margin-left:8px;">ORDENAR:</span>
          <select id="atlas-sort-select" style="padding:3px 8px; border-radius:4px; border:1px solid #334155; background:#1e293b; color:#f8fafc; font-size:11px;">
            <option value="name" ${this.atlasFilter.sort === 'name' ? 'selected' : ''}>Nome</option>
            <option value="distance" ${this.atlasFilter.sort === 'distance' ? 'selected' : ''}>Distância</option>
            <option value="stars" ${this.atlasFilter.sort === 'stars' ? 'selected' : ''}>Qtd. Estrelas</option>
            <option value="diameter" ${this.atlasFilter.sort === 'diameter' ? 'selected' : ''}>Diâmetro</option>
          </select>
        </div>
      </div>
    `;

    if (result.entries.length === 0) {
      html += `
        <div style="text-align: center; padding: 3rem 1rem; color: #94a3b8; background: #0f172a; border-radius: 8px; border: 1px dashed #334155;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🌌</div>
          <strong style="color: #f8fafc; font-size: 14px;">Nenhum destino corresponde aos filtros atuais</strong>
          <p style="font-size: 12px; margin: 6px 0 0; color: #64748b;">Tente ajustar os filtros de tipo, status ou o termo de busca.</p>
        </div>
      `;
    } else {
      html += `<div class="atlas-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">`;
      for (const entry of result.entries) {
        const isSelected = this.model.selectedTargetKey === entry.key;
        html += `
          <div class="atlas-card" style="background: #0f172a; border: 1px solid ${isSelected ? '#38bdf8' : '#1e293b'}; border-radius: 6px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; transition: border-color 0.15s ease;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <strong style="font-size: 13px; color: ${isSelected ? '#38bdf8' : '#f8fafc'}; overflow-wrap: anywhere;">${escapeHtml(entry.displayName)}</strong>
                <button data-atlas-toggle-fav="${escapeHtml(entry.key)}" title="${entry.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" style="background: none; border: none; font-size: 16px; cursor: pointer; color: ${entry.favorite ? '#facc15' : '#475569'}; padding: 0 4px;">${entry.favorite ? '★' : '☆'}</button>
              </div>

              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; font-size: 10px;">
                <span style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #94a3b8; text-transform: uppercase;">${escapeHtml(entry.kind)}</span>
                <span style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: ${entry.isCanonical ? '#38bdf8' : '#a855f7'};">${entry.isCanonical ? (entry.kind === 'galaxy' ? 'Canônica' : entry.kind === 'system' ? 'Sistema Solar' : entry.kind === 'black-hole' ? 'Buraco Negro SMBH' : 'Canônico') : (entry.kind === 'black-hole' ? 'Buraco Negro Estelar' : 'Procedural')}</span>
                ${entry.visited ? '<span style="background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); padding: 1px 6px; border-radius: 4px; font-weight: 600;">✓ VISITADO</span>' : '<span style="color: #64748b; padding: 1px 4px;">NÃO VISITADO</span>'}
                ${entry.kind === 'black-hole' ? '<span style="background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.35); padding: 1px 6px; border-radius: 4px; font-weight: 600;">● Singularidade</span>' : ''}
                ${entry.morphology ? `<span style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #cbd5e1;">${escapeHtml(entry.morphology)}</span>` : ''}
                ${entry.worldType ? `<span style="background: #0369a1; padding: 2px 6px; border-radius: 4px; color: #e0f2fe; font-weight: 600;">${escapeHtml(entry.worldType)}</span>` : ''}
                ${entry.canLand !== undefined ? `<span style="background: ${entry.canLand ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}; color: ${entry.canLand ? '#4ade80' : '#f87171'}; border: 1px solid ${entry.canLand ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}; padding: 1px 6px; border-radius: 4px;">${entry.landingMode === 'photosphere' ? '✓ Fotosfera' : entry.canLand ? '✓ Pousável' : 'Apenas observável'}</span>` : ''}
                ${entry.hasRings ? `<span style="background: rgba(250,204,21,0.12); color: #facc15; border: 1px solid rgba(250,204,21,0.3); padding: 1px 6px; border-radius: 4px;">★ Anéis</span>` : ''}
              </div>

              <div style="margin-top: 8px; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                ${entry.galaxyId ? `<div>Galáxia: <span style="color: #cbd5e1;">${escapeHtml(formatGalaxyName(entry.galaxyId))}</span></div>` : ''}
                <div>Distância: <span style="color: #cbd5e1;">${entry.distanceFormatted}</span></div>
                ${entry.estimatedStarCount ? `<div>Estrelas Est.: <span style="color: #cbd5e1;">${(entry.estimatedStarCount / 1e9).toFixed(1)}B</span></div>` : ''}
                ${entry.diameterLy ? `<div>Diâmetro: <span style="color: #cbd5e1;">${Math.round(entry.diameterLy / 1000)} kly</span></div>` : ''}
                ${entry.temperatureK ? `<div>${entry.isCanonical ? 'Temp. Média' : 'Temp. Equilíbrio'}: <span style="color: #cbd5e1;">${entry.temperatureK} K (${Math.round(entry.temperatureK - 273.15)}°C)</span></div>` : ''}
              </div>

              <div style="margin-top: 8px; padding: 6px; background: rgba(15,23,42,0.8); border-radius: 4px; border: 1px solid ${entry.canTravel ? '#0284c7' : '#334155'}; font-size: 10px;">
                <div style="color: ${entry.canTravel ? '#38bdf8' : '#94a3b8'}; font-weight: 600;">${escapeHtml(entry.guidanceStatus)}</div>
                <div style="color: ${entry.canTravel ? '#fde047' : '#64748b'}; margin-top: 2px;">${escapeHtml(entry.shortcutHint)}</div>
              </div>
            </div>

            <div style="display: flex; gap: 6px; margin-top: 10px;">
              <button data-atlas-locate="${escapeHtml(entry.key)}" style="flex: 1; padding: 6px 8px; background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;">LOCALIZAR NO MAPA</button>
              ${entry.canTravel ? `<button data-atlas-travel="${escapeHtml(entry.key)}" style="flex: 1; padding: 6px 8px; background: #2563eb; color: #fff; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;">INICIAR VIAGEM [P]</button>` : ''}
            </div>
          </div>
        `;
      }
      html += `</div>`;

      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #1e293b; font-size: 11px; color: #94a3b8;">
          <div>Mostrando ${result.entries.length} de ${result.totalCount} destinos</div>
          ${result.hasMore ? `<button id="atlas-load-more" style="padding: 6px 14px; background: #1e293b; color: #38bdf8; border: 1px solid #334155; border-radius: 4px; cursor: pointer; font-weight: 600;">Carregar mais (+24)</button>` : ''}
        </div>
      `;
    }

    container.innerHTML = html;
    container.scrollTop = prevScrollTop;

    if (wasSearchFocused) {
      const newInput = container.querySelector('#atlas-search-input') as HTMLInputElement;
      if (newInput) {
        newInput.focus();
        if (selStart !== null && selEnd !== null) {
          try {
            newInput.setSelectionRange(selStart, selEnd);
          } catch {}
        }
      }
    }

    // Bind interactive handlers
    const searchInput = container.querySelector('#atlas-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.oninput = () => {
        this.atlasFilter = { ...this.atlasFilter, query: searchInput.value, offset: 0 };
        this.renderAtlasView();
      };
    }

    const searchClear = container.querySelector('#atlas-search-clear') as HTMLButtonElement;
    if (searchClear) {
      searchClear.onclick = () => {
        this.atlasFilter = { ...this.atlasFilter, query: '', offset: 0 };
        this.renderAtlasView();
      };
    }

    container.querySelectorAll<HTMLButtonElement>('[data-filter-kind]').forEach(btn => {
      btn.onclick = () => {
        const k = btn.dataset.filterKind as any;
        this.atlasFilter = { ...this.atlasFilter, kind: k, offset: 0 };
        this.renderAtlasView();
      };
    });

    container.querySelectorAll<HTMLButtonElement>('[data-filter-status]').forEach(btn => {
      btn.onclick = () => {
        const s = btn.dataset.filterStatus as any;
        this.atlasFilter = { ...this.atlasFilter, statusFilter: s, offset: 0 };
        this.renderAtlasView();
      };
    });

    container.querySelectorAll<HTMLButtonElement>('[data-filter-morph]').forEach(btn => {
      btn.onclick = () => {
        const m = btn.dataset.filterMorph as any;
        this.atlasFilter = { ...this.atlasFilter, morphology: m, offset: 0 };
        this.renderAtlasView();
      };
    });

    const sortSelect = container.querySelector('#atlas-sort-select') as HTMLSelectElement;
    if (sortSelect) {
      sortSelect.onchange = () => {
        this.atlasFilter = { ...this.atlasFilter, sort: sortSelect.value as any, offset: 0 };
        this.renderAtlasView();
      };
    }

    container.querySelectorAll<HTMLButtonElement>('[data-atlas-toggle-fav]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const k = btn.dataset.atlasToggleFav;
        if (k) {
          this.atlasModel.toggleFavorite(k);
          this.renderAtlasView();
          this.updateCard();
        }
      };
    });

    container.querySelectorAll<HTMLButtonElement>('[data-atlas-locate]').forEach(btn => {
      btn.onclick = () => {
        const k = btn.dataset.atlasLocate;
        if (k) {
          this.selectTarget(k);
          const desc = this.atlasModel.catalog.find(k);
          if (desc?.kind === 'galaxy') {
            this.setLevel('cosmology');
          } else if (desc?.kind === 'system') {
            this.setLevel(desc.galaxyId === this.model.location.address.galaxyId ? 'system' : 'galaxy');
          } else if (desc?.kind === 'body') {
            this.setLevel('system');
          } else {
            this.setLevel('cosmology');
          }
        }
      };
    });

    container.querySelectorAll<HTMLButtonElement>('[data-atlas-travel]').forEach(btn => {
      btn.onclick = () => {
        const k = btn.dataset.atlasTravel;
        if (k) {
          this.selectTarget(k);
          this.onTravel(k);
        }
      };
    });

    const loadMoreBtn = container.querySelector('#atlas-load-more') as HTMLButtonElement;
    if (loadMoreBtn) {
      loadMoreBtn.onclick = () => {
        const currentLimit = this.atlasFilter.limit ?? 24;
        this.atlasFilter = { ...this.atlasFilter, limit: currentLimit + 24 };
        this.renderAtlasView();
      };
    }
  }
}
