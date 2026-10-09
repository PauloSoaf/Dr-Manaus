import { ProceduralSystemMaterializer, systemDomainLimitM, type SystemResources } from '../world/runtime/ProceduralSystemMaterializer';
import { u1TestControlsEnabled } from '../world/runtime/U1TestControls';
import { generateStarSector } from '../world/celestial/StarSector';
import { sectorIndex } from '../world/spatial/UniverseAddress';
import { Group as SystemResourceGroup } from 'three/webgpu';
import { universalTargetDiagnostics } from '../ui/UniversalTargetDiagnostics';
import { ForestBackdrop } from '../world/ForestBackdrop';
import { CameraHelper, Group, Mesh, Vector3 } from 'three/webgpu';
import { WORLD, QUALITY, FEATURES } from '../core/config';
import type { Collider } from '../core/types';
import { SaveManager, type Settings } from '../core/SaveManager';
import { AssetManager } from '../core/AssetManager';
import { RendererManager } from '../rendering/RendererManager';
import { Atmosphere } from '../rendering/Atmosphere';
import { SpaceLayer } from '../rendering/SpaceLayer';
import { SpeedVFX, type SpeedState } from '../rendering/SpeedVFX';
import { WeatherSystem } from '../rendering/WeatherSystem';
import { WaterSystem } from '../rendering/WaterSystem';
import { ManausAerialPresentation } from '../rendering/ManausAerialPresentation';
import { QualityManager } from '../rendering/QualityManager';
import { WorldStreamer } from '../world/streaming/WorldStreamer';
import { HLODManager } from '../world/lod/HLODManager';
import { RealCityLayer } from '../world/realcity/RealCityLayer';
import { LandmarkManager } from '../world/landmarks/LandmarkManager';
import { createTerrain, setTerrainOpacity } from '../world/geodata/terrain';
import { GeoDebug } from '../world/geodata/GeoDebug';
import { LargoDistrict } from '../world/landmarks/largo';
import { createAirport } from '../world/realcity/airport';
import { LANDMARKS, isLand } from '../world/geodata/geodata';
import { InputController } from '../player/InputController';
import { PlayerController } from '../player/PlayerController';
import { FLIGHT } from '../player/flightConfig';
import { CameraController, cameraFlightAxes } from '../player/CameraController';
import { PowerSystem } from '../player/powers/PowerSystem';
import type { CosmicLevel } from '../player/CharacterModel';
import { TerrainDestruction } from '../world/destruction/TerrainDestruction';
import { AuthoredDestruction } from '../world/destruction/AuthoredDestruction';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { DestructionSystem } from '../world/destruction/DestructionSystem';
import { TrafficSystem } from '../world/traffic/TrafficSystem';
import { PopulationManager } from '../entities/PopulationManager';
import { MissionManager } from '../missions/MissionManager';
import { AudioManager, earthAtmosphericDensity01 } from '../audio/AudioManager';
import { HUD, type HUDPresentationDomain } from '../ui/HUD';
import { UniverseRuntime } from '../world/runtime/UniverseRuntime';
import { BlackHoleProvider } from '../world/providers/BlackHoleProvider';
import { EarthProvider } from '../world/providers/EarthProvider';
import {
  EarthTransitionController,
} from '../world/providers/EarthTransitionController';
import { GalaxyProvider } from '../world/providers/GalaxyProvider';
import { LargeScaleStructureProvider } from '../world/providers/LargeScaleStructureProvider';
import { LOCAL_GROUP_CATALOG } from '../world/celestial/GalaxyDefinition';

import { StarSectorProvider } from '../world/providers/StarSectorProvider';
import { TravelDomain } from '../world/travel/TravelDomain';
import { CelestialImpactService } from '../world/travel/CelestialImpactService';
import { RockyImpactDestructionService } from '../world/destruction/RockyImpactDestructionService';
import { PlanetVolumeSurfaceRenderer } from '../rendering/PlanetVolumeSurfaceRenderer';
import {bodySolarDirection} from '../rendering/PlanetVolumeLighting';
import { IMPACT_VOLUME_LIMITS } from '../world/planet/volume/PlanetVolumeImpactDemand';
import { PlanetVolumeTerrainProvider } from '../world/planet/volume/PlanetVolumeTerrainProvider';
import { PlanetVolumeCollisionProvider } from '../world/planet/volume/PlanetVolumeCollisionProvider';
import { MANAUS_COVERAGE } from '../world/providers/EarthProvider';
import { bodyFixedToGeodetic } from '../world/planet/PlanetBody';
import type { CelestialImpactEvent } from '../world/travel/CelestialImpactEvent';
import type { ImpactResult } from '../player/combat/MeteorImpact';
import { impactCategory, impactKind } from '../world/destruction/ImpactCategories';
import { ManausSubsystem } from '../world/providers/ManausSubsystem';
import { RockyPlanetProvider } from '../world/providers/RockyPlanetProvider';
import { createPlanetProviders } from '../world/providers/PlanetProviderRegistry';
import { bodyProfile, bodyArrivalPolicy } from '../world/celestial/CelestialBodyProfile';
import { NavigationTargetState, celestialLockCandidates, cycleNavigationTarget, type NavigationLock } from '../world/travel/NavigationLock';
import { UniversalTargetCatalog, SOLAR_TARGET_ADDRESS } from '../world/travel/UniversalTargetCatalog';
import { UniversalTargetResolver, activeSystemTargetBodyId, intraSystemNavigationTarget, travelCapabilityLabel } from '../world/travel/UniversalTargetResolver';
import { createUniversalTarget, type UniversalNavigationTarget, type TargetSource } from '../world/travel/UniversalNavigationTarget';
import { CELESTIAL_LABEL_NAMES } from '../rendering/celestial/CelestialLabelLayer';
import { bodyExclusionEnvelopes, selectBodyDestination, resolveBodyDestination } from '../world/travel/BodyNavigation';
import { EARTH, surfaceGravityMps2 } from '../world/planet/PlanetBody';
import { PlanetTerrainProvider } from '../world/planet/PlanetTerrainProvider';
import { planetSurfaceRadius } from '../world/planet/PlanetSurface';
import { surfaceForBody } from '../world/planet/BodySurfaceFactory';
import { relativeSurfaceMotion, surfaceOutwardNormal } from '../world/travel/LandingCapture';
import {
  type LandingBody, LANDING_POLICY, PlanetaryLandingIntent, landingCaptureRangeM, landingEtaS,
  predictTouchdownDirection, resolveLandingCandidate,
} from '../world/travel/PlanetaryLanding';
import { WGS84 } from '../world/spatial/WGS84';
import { SurfaceFrameService } from '../world/spatial/SurfaceFrameService';
import {
  BASE_BRAKE_ACCEL, CosmicCruiseController, type FlightTelemetry, type NavigationTarget,
  WARP_STEPS_C, warpLabel,
} from '../world/travel/CosmicFlight';

/** Below this forward speed, S stops braking and starts reversing. */
const COSMIC_REVERSE_EPSILON_MPS = 25;
import { MANAUS_FRAME_ID } from '../world/spatial/ManausFrameAdapter';
import { CelestialBodyVisualLayer } from '../rendering/celestial/CelestialBodyVisualLayer';
import { CelestialPresentationController } from '../rendering/celestial/CelestialPresentationController';
import { CelestialLabelLayer } from '../rendering/celestial/CelestialLabelLayer';
import { solarDiagnostics } from '../rendering/celestial/solarPresentation';
export interface FrameSample { fps:number; cpu:number; drawCalls:number; triangles:number; geometries:number; textures:number; active:number; cached:number; queued:number; loadedMB:number; streamMs:number; x:number; z:number }
export class Game {
  surfaceReturnTrace?: {
    bodyId: string; transition: 'returned'; frameBefore: string; frameAfter: string;
    physicsDomain: string; surfaceReady: boolean; relativeSpeedMps: number; radialSpeedMps: number;
    firstLocalStep?: { position: number[]; velocity: number[]; state: string; terrainHeightM: number };
  };
  readonly save = new SaveManager(); readonly assets = new AssetManager(); readonly rendering: RendererManager;
  readonly celestialRoot = new Group();
  readonly planetaryRoot = new Group();
  readonly localWorldRoot = new Group();
  readonly actorRoot = new Group();
  /** Backward-compatible aliases */
  readonly localRoot = this.localWorldRoot;
  readonly worldRoot = this.localWorldRoot;
  readonly planetRoot = this.planetaryRoot;
  private readonly renderOriginVec = new Vector3(); readonly player: PlayerController; readonly input: InputController; readonly camera: CameraController;
  readonly streamer:WorldStreamer;readonly hlod:HLODManager;readonly realCity:RealCityLayer;readonly landmarks:LandmarkManager;readonly geoDebug:GeoDebug;readonly largo:LargoDistrict;readonly atmosphere:Atmosphere;readonly space:SpaceLayer;readonly speedVfx:SpeedVFX;readonly weather:WeatherSystem;readonly water:WaterSystem;
  readonly population:PopulationManager;readonly missions:MissionManager;readonly powers:PowerSystem;readonly destruction:DestructionSystem;traffic?:TrafficSystem;readonly audio=new AudioManager();readonly hud:HUD;readonly quality:QualityManager;
  readonly forest:ForestBackdrop;readonly terrain:TerrainDestruction;readonly airport=new AuthoredDestruction();
  /**
   * The planetary and cosmic model. It owns the reference frames, the provider registry, the
   * streaming scheduler and the solar system; `Game` keeps the loop, the input and gameplay.
   * With `FEATURES.planetStreaming` off it observes and reports without touching the scene.
   */
  readonly universe:UniverseRuntime;
  readonly rockyImpactDestruction:RockyImpactDestructionService;
  readonly volumeRenderer:PlanetVolumeSurfaceRenderer;
  readonly galaxy?:StarSectorProvider;
  readonly sgra?:BlackHoleProvider;
  readonly localGroup:GalaxyProvider[] = [];
  readonly cosmicWeb?:LargeScaleStructureProvider;
  /** Which simulation the player is in. Urban physics runs in one of them and not the other. */
  readonly travelDomain=new TravelDomain();
  readonly interplanetary=new CosmicCruiseController();
  private impactService?: CelestialImpactService;
  get celestialImpacts(): CelestialImpactService { return this.impactService ??= new CelestialImpactService(); }
  lastCelestialImpact?: CelestialImpactEvent;
  navigation = new NavigationTargetState();
  private targetCatalog?:UniversalTargetCatalog;
  get universalTargetCatalog():UniversalTargetCatalog { return this.targetCatalog??=new UniversalTargetCatalog(this.universe.solarSystem); }
  get universalTargetResolver():UniversalTargetResolver { return new UniversalTargetResolver(this.universalTargetCatalog,this.universe); }
  get universalNavigationTarget():UniversalNavigationTarget|undefined { return this.navigation?.current; }
  /** Read-only active-system compatibility projection. It is never a second target store. */
  get navigationLock(): NavigationLock | undefined {
    const target=this.universalNavigationTarget,bodyId=activeSystemTargetBodyId(target,this.universe);
    return target && bodyId ? {bodyId,source:target.source,lockedAtS:target.selectedAtS,mode:target.mode}:undefined;
  }
  get navigationTarget(): NavigationTarget | undefined {
    return intraSystemNavigationTarget(this.universalNavigationTarget,this.universe);
  }
  set navigationTarget(target: NavigationTarget | undefined) {
    this.navigation ??= new NavigationTargetState();
    if (target) {
      const universal=this.activeBodyTarget(target.bodyId,'hud');
      if(universal && intraSystemNavigationTarget(universal,this.universe))this.navigation.select(universal);
      else this.navigation.clear();
    }
    else this.navigation.clear();
    this.interplanetary?.autopilot.cancel();
  }
  selectNavigationTarget(id: string|UniversalNavigationTarget, source: TargetSource = 'hud'): string | undefined {
    const target=typeof id==='string'?this.activeBodyTarget(id,source) ?? this.universalTargetCatalog.target(id,source,this.universe.activeSystem.time):id;
    if(!target || !this.universalTargetResolver.resolve(target).valid)return;
    const descriptor=this.universalTargetCatalog.resolve(target)!.descriptor;
    this.navigation.select(createUniversalTarget(descriptor,target.source,target.selectedAtS,target.mode));
    this.interplanetary.autopilot.cancel();
    this.hud.notify('Alvo travado: ' + descriptor.displayName);
    return this.navigationLock?.bodyId??target.key;
  }
  private activeBodyTarget(id:string,source:TargetSource):UniversalNavigationTarget|undefined {
    if(!this.universe.activeSystem.bodies.some(b=>b.id===id))return;
    const a=this.universe.address??SOLAR_TARGET_ADDRESS;
    if(a.systemId==='sol')return this.universalTargetCatalog.target(id,source,this.universe.time);
    const body=this.universe.activeSystem.bodies.find(b=>b.id===id)!;
    return this.universalTargetCatalog.proceduralTarget(a.galaxyId,a.sector,a.systemId!,body.parentId?'body':'star',id,source,this.universe.time);
  }
  private materializer?:ProceduralSystemMaterializer;
  get systemMaterializer():ProceduralSystemMaterializer {
    if(this.materializer)return this.materializer;
    const solarProviders=this.planetProviders,solarVisuals=this.celestialVisuals;
    const activate=(providers:ReadonlyMap<string,RockyPlanetProvider>,visuals:CelestialBodyVisualLayer)=>{
      this.interplanetary.autopilot.cancel();this.landingIntent.cancel();this.warpStep=0;this.flightTelemetry=undefined;
      for(const p of this.planetProviders.values()){p.setLandingPrefetch(undefined);p.setStreamingMode('off');p.setVisible(false);}
      this.earth?.setStreamingMode('off');if(this.earth)this.earth.globe.visible=false;
      visuals.setQuality(this.rendering.preset);this.celestialVisuals.root.removeFromParent();this.celestialRoot.add(visuals.root);
      this.planetProviders=providers;this.celestialVisuals=visuals;this.celestialController=new CelestialPresentationController(visuals);
      this.surfaceTerrains.clear();this.physicsDomain='';this.volumePhysicsGeneration=-1;
      this.renderOriginVec.set(0,0,0);this.actorRoot.position.set(0,0,0);this.player.velocity.set(0,0,0);
      const position=this.universe.player.position;
      if(this.universe.player.frame===this.universe.activeSystem.systemFrameId){
        this.travelDomain.testArrival({systemId:this.universe.address.systemId!,positionM:[...position],velocityMps:[0,0,0]});
        this.player.position.set(0,0,0);this.camera.inSpace=true;
      }else {this.travelDomain.reset();this.player.teleport(new Vector3(...position));this.camera.inSpace=false;}
      this.camera.skipIntro();this.bindSurfacePhysics();
    };
    const solarResources:SystemResources={install:()=>{},activate:()=>activate(solarProviders,solarVisuals),dispose:()=>{}};
    this.materializer=new ProceduralSystemMaterializer(this.universe,this.universalTargetCatalog,solarResources,runtime=>{
      const root=new SystemResourceGroup();let visuals:CelestialBodyVisualLayer|undefined;
      let providers:Map<string,RockyPlanetProvider>=new Map();
      try {
        const providerStart=performance.now();
        providers=createPlanetProviders(root,this.universe,runtime.bodies,false);
        this.materializer!.timings.providers=performance.now()-providerStart;
        const visualStart=performance.now();
        visuals=new CelestialBodyVisualLayer(undefined,runtime.bodies);visuals.setQuality(this.rendering.preset);this.materializer!.timings.visuals=performance.now()-visualStart;
      }catch(error){for(const p of providers.values())p.dispose();visuals?.dispose();throw error;}
      const v=visuals;const installed:RockyPlanetProvider[]=[];
      return {install:()=>{
        try {for(const p of providers.values()){this.universe.providers.register(p);installed.push(p);}this.planetRoot.add(root);}
        catch(error){for(const p of installed)this.universe.providers.unregister(p.id);throw error;}
      },activate:()=>activate(providers,v),dispose:()=>{
        for(const p of providers.values()){
          if(this.universe.providers.get(p.id)===p){this.universe.scheduler.retireProvider(p.id,p.bodyDef.id);this.universe.providers.unregister(p.id);}
          p.dispose();
        }
        v.dispose();root.removeFromParent();
      }};
    });return this.materializer;
  }
  /** QA only: selecting a canonical fixture does not move the observer. */
  selectU1TestSystem():UniversalNavigationTarget|undefined {
    if(!u1TestControlsEnabled())return;
    const sector=sectorIndex(17n,-2n,4n),star=generateStarSector('milky_way',sector).stars.find(s=>s.planetCount>0);
    if(!star)return;
    const target=this.universalTargetCatalog.proceduralTarget('milky_way',sector,star.id,'star','', 'map',this.universe.time);
    if(target)this.selectNavigationTarget(target);return target;
  }
  debugMaterializeSystem(target=this.universalNavigationTarget):boolean {
    if(!u1TestControlsEnabled() || !target)return false;
    try {this.systemMaterializer.testArrival(target);this.hud.notify('U1 TEST ARRIVAL · sistema materializado');return true;}
    catch(error){this.hud.notify('U1 TEST · '+String(error));return false;}
  }
  debugReturnToSolar():void {
    if(!u1TestControlsEnabled())return;
    this.systemMaterializer.returnToSolar();this.hud.notify('U1 TEST RETURN · Solar restaurado');
  }

  clearNavigationTarget(): void {
    this.navigation.clear(); this.interplanetary.autopilot.cancel();
    this.hud.notify('Nenhum alvo');
  }
  /** The last frame's cruise telemetry, so the HUD can show it rather than guess. */
  private flightTelemetry?: FlightTelemetry;
  /**
   * The engaged warp step, counting from 1. Zero is off.
   *
   * Lives on `Game` rather than on the player because it belongs to the travel domain, and the
   * travel domain is not something `PlayerController` knows about -- which is the point: this
   * number must never reach the local physics.
   */
  private warpStep = 0;
  /**
   * "I want to stop flying and land here." Lives with the travel layer, not the player: F is only
   * consumed by PlayerController while local physics runs, so in space nothing else could hear it.
   */
  readonly landingIntent = new PlanetaryLandingIntent();
  /** Present only while `FEATURES.earthGlobe` is on. The runtime itself never touches the scene. */
  readonly earth?:EarthProvider;
  planetProviders:ReadonlyMap<string,RockyPlanetProvider>;
  /** Compatibility for existing browser diagnostics; the registry owns provider identity. */
  get moon():RockyPlanetProvider|undefined { return this.planetProviders.get('moon'); }
  get mars():RockyPlanetProvider|undefined { return this.planetProviders.get('mars'); }
  readonly earthTransition = new EarthTransitionController();
  readonly manausAerial?:ManausAerialPresentation;
  private presentationDomain:HUDPresentationDomain='local';
  celestialVisuals = new CelestialBodyVisualLayer();
  celestialController = new CelestialPresentationController(this.celestialVisuals);
  readonly celestialLabels: CelestialLabelLayer;
  private readonly surfaceTerrains = new Map<string, PlanetTerrainProvider>();
  private physicsDomain = 'manaus';
  private volumePhysicsGeneration=-1;
  /** The generalized flat backdrop. It stands down once the globe becomes the ground. */
  private readonly flatTerrain:import('three/webgpu').Group;
  ready=false;frame:FrameSample={fps:0,cpu:0,drawCalls:0,triangles:0,geometries:0,textures:0,active:0,cached:0,queued:0,loadedMB:0,streamMs:0,x:0,z:0};
  stressReport:FrameSample[]=[];private stressRoute:Vector3[]=[];private stressIndex=0;private stressSampleTime=0;
  private lastTime=0;private discoveryTime=0;private telemetryTime=0;private cpu=0;private colliders:Collider[]=[];private curvedColliders:Collider[]=[];private playerLocal=new Vector3();private direction=new Vector3();private viewForward=new Vector3();
  private stompTimer=0;private readonly foot=new Vector3();private readonly surfaceService=new SurfaceFrameService('earth');
  private bounds=false;private lod=false;private culling?:CameraHelper;private spaceFactor=0;
  /** Exponentially smoothed per-system frame cost, in milliseconds. Drives the F3 panel. */
  readonly profile:Record<string,number>={realCity:0,colliders:0,player:0,universe:0,streamer:0,hlod:0,landmarks:0,population:0,destruction:0,traffic:0,render:0};
  private mark=0;private lastSpeed=0;private district='AMAZONAS';
  constructor(container:HTMLElement){
    this.rendering=new RendererManager(container);
    this.celestialLabels = new CelestialLabelLayer(container);
    this.celestialRoot.name='Celestial · stars & deep space visuals';
    this.planetaryRoot.name='Planetary · camera-relative celestial bodies';
    this.localWorldRoot.name='Manaus · local city/terrain';
    this.actorRoot.name='Actors · player & dynamic entities';
    this.rendering.scene.add(this.celestialRoot);
    this.rendering.scene.add(this.planetaryRoot);
    this.rendering.scene.add(this.actorRoot);
    this.atmosphere=new Atmosphere(this.rendering.scene);
    // Celestial visuals belong to celestialRoot so stars and deep space visuals stay in background
    this.space=new SpaceLayer(this.celestialRoot,this.rendering.camera);this.speedVfx=new SpeedVFX(this.rendering.scene);this.water=new WaterSystem(this.worldRoot);this.weather=new WeatherSystem(this.worldRoot);
    this.celestialRoot.add(this.celestialVisuals.root);
    this.universe=new UniverseRuntime({streaming:FEATURES.planetStreaming||FEATURES.earthGlobe,volume:IMPACT_VOLUME_LIMITS});
    if(FEATURES.earthGlobe){
      this.earth=new EarthProvider(this.planetRoot,this.universe.frames,{cityOwnsGround:!FEATURES.curvedManaus,renderSpace:this.universe.renderSpace});
      this.universe.providers.register(this.earth);
      this.earth.manausSurfaceAnchor.add(this.localWorldRoot);
      this.localWorldRoot.position.set(0, 0, 0);
      this.localWorldRoot.quaternion.identity();
      this.manausAerial=new ManausAerialPresentation(this.planetRoot,this.universe.frames,this.universe.renderSpace);
    } else {
      this.rendering.scene.add(this.localWorldRoot);
    }
    this.planetProviders=FEATURES.solarSystem
      ?createPlanetProviders(this.planetRoot,this.universe):new Map();
    this.volumeRenderer=new PlanetVolumeSurfaceRenderer(this.planetRoot,this.universe.frames,this.universe.renderSpace,
      id=>bodyProfile(this.universe.activeSystem.bodies.find(b=>b.id===id)!),entries=>{
        this.earth?.globe.volumeMask.update(entries);
        for(const provider of this.planetProviders.values())provider.globe.volumeMask.update(entries);
      },{solarDirection:id=>bodySolarDirection(this.universe.activeSystem,this.universe.frames,id,this.universe.renderSpace.currentOrigin.frame),
        surface:id=>{const body=this.universe.activeSystem.bodies.find(b=>b.id===id);return body?surfaceForBody(body):undefined;},
        prepareMasks:entries=>{const masks=[...(this.earth?[this.earth.globe.volumeMask]:[]),
          ...[...this.planetProviders.values()].map(p=>p.globe.volumeMask)],commits=masks.map(m=>m.prepareUpdate(entries));
          return ()=>{for(const commit of commits)commit();};},
        maskStats:()=>{const stats=[...(this.earth?[this.earth.globe.volumeMask.stats]:[]),
          ...[...this.planetProviders.values()].map(p=>p.globe.volumeMask.stats)],tiles=stats.reduce((s,m)=>s+m.tiles,0);
          return {averageBounds:tiles?stats.reduce((s,m)=>s+m.averageBounds*m.tiles,0)/tiles:0,
            maxBounds:Math.max(0,...stats.map(m=>m.maxBounds)),zeroTiles:stats.reduce((s,m)=>s+m.zeroTiles,0),maskedTiles:stats.reduce((s,m)=>s+m.maskedTiles,0)};}});
    this.universe.volume.setImpactPublication(this.volumeRenderer);
    this.rockyImpactDestruction=new RockyImpactDestructionService({edits:this.universe.volume.edits,
      body:id=>this.universe.activeSystem.bodies.find(b=>b.id===id),
      requestRegion:(id,plan)=>this.universe.volume.requestImpactRegion(id,plan),
      defer:plan=>{
        if(FEATURES.curvedManaus||plan.bodyId!==MANAUS_COVERAGE.bodyId)return;
        const geo=bodyFixedToGeodetic(EARTH,{xM:plan.surfaceContactBodyFixedM[0],yM:plan.surfaceContactBodyFixedM[1],zM:plan.surfaceContactBodyFixedM[2]}),
          lat=geo.latRad*180/Math.PI,lon=geo.lonRad*180/Math.PI,margin=(plan.craterRadiusM+512)/110000;
        return lat>=MANAUS_COVERAGE.minLatDeg-margin&&lat<=MANAUS_COVERAGE.maxLatDeg+margin
          &&lon>=MANAUS_COVERAGE.minLonDeg-margin&&lon<=MANAUS_COVERAGE.maxLonDeg+margin?'authored-manaus-authority':undefined;
      }});
    // The far domain costs a longer depth range, so it is only opened when something needs it.
    this.rendering.domains.active=FEATURES.earthGlobe;
    this.terrain=new TerrainDestruction(this.worldRoot);PhysicsWorld.setTerrain(this.terrain);
    this.flatTerrain=createTerrain(this.worldRoot);this.worldRoot.add(createAirport(this.airport));this.geoDebug=new GeoDebug(this.worldRoot);this.largo=new LargoDistrict(this.worldRoot);this.landmarks=new LandmarkManager(this.worldRoot);
    this.streamer=new WorldStreamer(this.worldRoot);this.hlod=new HLODManager(this.worldRoot);this.realCity=new RealCityLayer(this.worldRoot);this.hlod.setDestructionSource(this.streamer);
    // The city spends the global budget rather than a private one, so Manaus and the planet stop
    // each calling themselves within a 4 ms limit while together taking eight. See ManausSubsystem.
    if(FEATURES.spatialCore)this.universe.scheduler.registerSubsystem(new ManausSubsystem(this.realCity));
    this.streamer.setReplacesChunk((cx, cz) => this.realCity.coversChunk(cx, cz));
    // Behind its flag, and a provider rather than a renderer: the scheduler decides when a
    // sector loads, the budget applies, and a sector nobody wants is disposed.
    if(FEATURES.galaxyTravel){
      this.galaxy=new StarSectorProvider(this.celestialRoot);
      this.universe.providers.register(this.galaxy);

      const LY_TO_M = 9.4607304725808e15;

      // Instantiate Local Group galaxies (except Milky Way which is local)
      for (const galDef of LOCAL_GROUP_CATALOG) {
        if (galDef.id === 'milky_way') continue;
        const galProv = new GalaxyProvider(this.celestialRoot, { galaxy: galDef });
        this.localGroup.push(galProv);
      }

      this.sgra = new BlackHoleProvider(this.celestialRoot, {
        blackHole: {
          id: 'sgra',
          massKg: 8.26e36,
          spin01: 0.9,
          positionM: [26000 * LY_TO_M, 0, 0],
          accretion: {
            innerRadiusRs: 3,
            outerRadiusRs: 20,
            temperatureK: 1e6,
            luminosity: 1e36
          }
        }
      });

      this.cosmicWeb = new LargeScaleStructureProvider(this.celestialRoot);
    }
    this.watchGround(this.worldRoot);this.forest=new ForestBackdrop(this.worldRoot);
    this.input=new InputController(this.rendering.renderer.domElement);
    this.player=new PlayerController(this.actorRoot,this.input);
    if (FEATURES.curvedManaus) {
      const flat = this.player.position;
      const curved = this.surfaceService.legacyPointToRenderLocal(flat.x, flat.y, flat.z);
      this.player.teleport(curved);
    }
    this.camera=new CameraController(this.rendering.camera,this.input);
    this.population=new PopulationManager(this.worldRoot);
    this.missions=new MissionManager(this.worldRoot,this.save,message=>this.hud?.notify(message));
    this.destruction=new DestructionSystem(this.worldRoot,this.destructible);
    this.player.beforeMove=(position,velocity,dt)=>{if(!this.manausSimulationActive)return [];this.destruction.plough(position,velocity,dt,true);this.gatherColliders();if(FEATURES.curvedManaus)this.curveColliders();return FEATURES.curvedManaus?this.curvedColliders:this.colliders;};
    this.powers=new PowerSystem(this.actorRoot,this.player,this.rendering.camera,this.input,{
      canDeformSurface:()=>this.manausSimulationActive,
      targets:()=>this.manausSimulationActive?[...this.population.targets,...this.missions.targets]:[],
      hit:(id,force)=>{if(this.manausSimulationActive)this.missions.hit(id,force)||this.population.hit(id,force);},
      reconstruct:(position,radius)=>{
        if(!this.manausSimulationActive)return 0;
        this.destruction.restoreAt(position,radius);
        let flat = position;
        if (FEATURES.curvedManaus && this.travelDomain.localPhysicsActive) {
          flat = this.surfaceService.renderLocalToLegacyPoint(position.x, position.y, position.z);
        }
        return this.population.reconstruct(flat,radius)+this.realCity.restore(flat,radius)+this.streamer.restore(flat,radius)+this.landmarks.restore(flat,radius)+this.largo.restore(flat,radius)+this.airport.restore(flat,radius)+this.terrain.restoreAt(flat,radius);
      },
      impulse:(position,radius,force)=>{
        if(!this.manausSimulationActive)return;
        let flat = position;
        if (FEATURES.curvedManaus && this.travelDomain.localPhysicsActive) {
          flat = this.surfaceService.renderLocalToLegacyPoint(position.x, position.y, position.z);
        }
        this.population.impulse(flat,radius,force);this.traffic?.impulse(flat,radius,force);this.camera.shake(.45);
      },
      impact:(point,footprint)=>this.applyLocalImpact(point,footprint),
      damage:(point,radius,amount,deform)=>this.manausSimulationActive?this.destruction.damageAt(point,radius,amount,deform):0,prepare:destination=>this.manausSimulationActive?this.streamer.prepare(destination):Promise.resolve(),notify:message=>this.hud.notify(message),sound:name=>this.audio.play(name),getOrigin:()=>this.renderOriginVec,getColliders:()=>FEATURES.curvedManaus?this.curvedColliders:this.colliders,getAttackColliders:(point,radius)=>this.attackColliders(point,radius),
    });
    this.quality=new QualityManager(this.rendering,level=>this.applyDensity(level));
    this.hud=new HUD(this.save,{power:name=>{void this.audio.unlock();this.powers.use(name);},travel:(id,debug)=>{void this.travel(id,debug);},setTarget:(id,source)=>this.selectNavigationTarget(id,source),settings:settings=>this.applySettings(settings),pause:open=>{this.input.enabled=!open;if(open&&document.pointerLockElement)void document.exitPointerLock();},debug:(option,value)=>this.setDebug(option,value),reset:()=>{this.save.reset();location.reload();},stress:()=>this.startStress()});
    this.applySettings(this.save.data.settings);
    this.rendering.renderer.domElement.addEventListener('pointerdown',()=>{void this.audio.unlock();});
    window.addEventListener('keydown',()=>{void this.audio.unlock();},{once:true});
    window.addEventListener('drmanaus-shake',event=>this.camera.shake((event as CustomEvent<number>).detail));
    window.addEventListener('keydown',event=>{if(event.code==='F3'){event.preventDefault();this.hud.toggleDebug();}if(event.code==='KeyM'){event.preventDefault();this.hud.togglePanel('map');}if(event.code==='KeyH'){event.preventDefault();this.hud.openPause('controls');}if(event.code==='Escape'){event.preventDefault();this.hud.togglePause();}});
  }
  async initialize(){
    await this.rendering.initialize();
    await Promise.all([this.player.character.initializeAnimations(), this.powers.initializeCharacters()]);
    await this.streamer.initialize();
    await this.realCity.initialize();
    if(this.realCity.active){
      this.streamer.setReplacesChunk((cx, cz) => this.realCity.coversChunk(cx, cz));
      this.realCity.syncProceduralVisibility();
    }
    // Awaited during the loading screen: triangulating the real river costs about a second, and
    // that hitch belongs before the first frame rather than in the middle of play.
    await this.water.initialize();
    await this.manausAerial?.initialize(this.water.source);
    // Traffic only exists where the compiled network does, so it is built after the city loads.
    if(this.realCity.roads_graph.size>0){
      this.traffic=new TrafficSystem(this.worldRoot,this.realCity.roads_graph);
      this.traffic.setCount(QUALITY[this.save.data.settings.quality].vehicles*2);
      // The old free-roaming vehicles drove through buildings and across the plaza; the road
      // graph replaces them entirely rather than running both.
      this.population.vehicleCount=0;
    }
    this.realCity.update(this.player.position,this.player.velocity,1);
    // Only once the compiled block masses can cover the horizon does the procedural city stand down.
    if(this.realCity.hasSkyline)this.hlod.setRealCoverage(this.realCity.coveredTiles,this.realCity.tileSize);
    this.realCity.setNight(this.save.data.settings.time==='Night');
    this.hlod.update(this.player.position,this.streamer.activeKeys);
    // The compact offline geographic payload is optional metadata; gameplay makes no map-service calls.
    void this.assets.json('/geodata/manaus.json').catch(()=>undefined);
    this.ready=true;this.hud.ready();this.lastTime=performance.now();
    this.rendering.renderer.setAnimationLoop(this.tick);
  }
  private applyDensity(level:number){
    const config=QUALITY[this.save.data.settings.quality];const factor=1-level*.15;
    this.population.npcCount=Math.round(config.npcs*factor);this.population.vehicleCount=Math.round(config.vehicles*factor);
    this.streamer.setDetailRadius(config.detailRadius*factor);this.hlod.setDetailRadius(config.detailRadius*factor);
    // Window panes and balconies are the first thing to go when the frame budget slips.
    this.realCity.setDetail(config.shadows&&level<2);
    const distance=145*(1-level*.14);Object.assign(this.atmosphere.sun.shadow.camera,{left:-distance,right:distance,top:distance,bottom:-distance});this.atmosphere.sun.shadow.camera.updateProjectionMatrix();
  }
  applySettings(settings:Settings){this.save.data.settings=settings;this.save.save();this.rendering.setQuality(settings.quality);
    this.celestialVisuals.setQuality(settings.quality);
    this.rendering.setShadows(settings.shadows);this.camera.baseFov=settings.fov;this.camera.sensitivity=settings.sensitivity;this.camera.invertY=settings.invertY;
    this.audio.setVolumes(settings.masterVolume,settings.ambienceVolume,settings.effectsVolume);this.atmosphere.time=settings.time;this.atmosphere.weather=settings.weather;this.atmosphere.dayCycle=settings.dayCycle;this.quality.enabled=settings.dynamicResolution;this.quality.reset();this.audio.setEnabled(settings.sound);this.destruction.setQuality(QUALITY[settings.quality].particles);this.streamer.setNight(settings.time==='Night');this.water.setNight(settings.time==='Night');this.realCity.setNight(settings.time==='Night');this.realCity.setDetail(settings.quality!=='Low');}
  async travel(id:string,debug=false){
    if(id==='u1-test-select'){this.selectU1TestSystem();return;}
    if(id==='u1-test-arrival'){this.debugMaterializeSystem();return;}
    if(id==='u1-test-solar'){this.debugReturnToSolar();return;}
    if(this.universe.activeSystem!==this.universe.solarSystem){this.hud.notify('Use U1 TEST RETURN antes de visitar Manaus');return;}
    const landmark=LANDMARKS.find(l=>l.id===id);if(!landmark)return;
    if(!debug&&!this.save.data.discovered.includes(id)){this.hud.notify('Descubra esse lugar pelo voo.');return;}
    this.stressRoute=[];this.camera.skipIntro();
    const destination=new Vector3(landmark.x,landmark.spawnHeight+4,landmark.z);
    this.travelDomain.reset();
    this.celestialImpacts.clear();this.lastCelestialImpact=undefined;
    this.universe.setPlayerPose(MANAUS_FRAME_ID,[destination.x,destination.y,destination.z]);
    this.bindSurfacePhysics();
    this.player.teleport(destination);
    this.gatherColliders();
    await this.powers.teleportTo(destination);
    this.hud.notify(landmark.name);
  }
  private setDebug(option:string,value:boolean|number){
    if(option==='speed'){this.player.speedMultiplier=Number(value);return;}
    if(option==='bounds')this.bounds=Boolean(value);if(option==='lod')this.lod=Boolean(value);
    this.streamer.setDebug(this.bounds,this.lod);
    if(option==='hlod')this.hlod.setDebug(Boolean(value));
    if(option==='geo')this.geoDebug.setEnabled(Boolean(value));
    if(option==='roads')this.traffic?.setDebugColours(Boolean(value));
    if(option==='wireframe')this.worldRoot.traverse(object=>{if(object instanceof Mesh){const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials)if('wireframe'in material)material.wireframe=Boolean(value);}});
    if(option==='culling'){if(this.culling){this.rendering.scene.remove(this.culling);this.culling.dispose();this.culling=undefined;}if(value){const snapshot=this.rendering.camera.clone();snapshot.far=500;snapshot.updateProjectionMatrix();this.culling=new CameraHelper(snapshot);this.rendering.scene.add(this.culling);}}
  }
  startStress(){
    this.camera.skipIntro();this.player.teleport(new Vector3(0,160,0));this.stressIndex=0;this.stressReport=[];
    this.stressRoute=['arena','ponta','ponte','teatro'].map(id=>{const l=LANDMARKS.find(l=>l.id===id)!;return new Vector3(l.x,160,l.z);});
    this.hud.notify('Rota de stress · Arena → Ponta Negra → Ponte → Centro');
  }
  private updateStress(dt:number){
    const target=this.stressRoute[this.stressIndex];if(!target)return;
    this.direction.copy(target).sub(this.player.position);const distance=this.direction.length();this.direction.normalize();this.player.velocity.copy(this.direction).multiplyScalar(720);
    if(distance<Math.max(30,720*dt)){this.player.position.copy(target);this.stressIndex++;if(this.stressIndex>=this.stressRoute.length){this.stressRoute=[];this.player.velocity.set(0,0,0);this.hud.notify(`Stress concluído · ${this.stressReport.length} amostras registradas`);}}
    else this.player.position.addScaledVector(this.direction,720*dt);
    this.player.state='Flight';this.player.model.position.copy(this.player.position);this.player.character.animate(dt,720,true,true,'');this.camera.yaw=Math.atan2(-this.direction.x,-this.direction.z);
    this.stressSampleTime+=dt;if(this.stressSampleTime>1){this.stressSampleTime=0;this.stressReport.push({...this.frame});}
  }
  /** Smoothed so one slow frame does not dominate the readout, and cheap enough to always run. */
  private lap(key:string){const now=performance.now();this.profile[key]+=(now-this.mark-this.profile[key])*.1;this.mark=now;}
  private tick=(time:number)=>{
    const start=performance.now(),rawDt=Math.max(.001,(time-this.lastTime)/1000);this.lastTime=time;
    const dt=Math.min(.06,rawDt),worldDt=dt*(this.powers.temporal?.14:1);
    this.mark=performance.now();
    this.navigation.validate(this.universalTargetResolver);
    if (!this.navigationLock && this.interplanetary.autopilot.active) this.interplanetary.autopilot.cancel();
    if(this.travelDomain.localPhysicsActive && this.universalNavigationTarget && !this.navigationTarget && this.input.consume('KeyP'))
      this.hud.notify(travelCapabilityLabel(this.universalTargetResolver.resolve(this.universalNavigationTarget).travelCapability));
    this.updateTravelDomain(dt);
    const transition = this.travelDomain.transition;
    if (transition.kind === 'departed') {
      // Initialize interplanetary barycentric state from the actual current pose.
      const barycentricPos = this.universe.frames.convertPosition(
        this.universe.player.frame,
        this.universe.activeSystem.systemFrameId,
        this.universe.player.position
      );

      const velocityMps = this.universe.systemVelocityMps();

      this.travelDomain.setState({
        systemId: this.universe.address.systemId!,
        positionM: [barycentricPos[0], barycentricPos[1], barycentricPos[2]],
        velocityMps,
        referenceBodyId: this.universe.telemetry.dominantBody,
      });
      this.player.position.set(0, 0, 0);
      this.player.velocity.set(0, 0, 0);
      this.player.model.position.set(0, 0, 0);
      this.renderOriginVec.set(0, 0, 0);
      this.actorRoot.position.set(0, 0, 0);
      this.camera.inSpace = true;
      this.hud.notify(`Comando de voo · Interplanetário`);
    } else if (transition.kind === 'returned') {
      this.finishSurfaceReturn(this.universe.telemetry.dominantBody);
    }
    this.bindSurfacePhysics();
    const local = this.travelDomain.localPhysicsActive;
    this.camera.inSpace = !local;
    this.camera.prepareLook();
    const manaus = this.manausSimulationActive;
    if(manaus)this.destruction.beginFrame();
    // Non-Earth local ENU frames are planetary presentation domains too. Earth refines this
    // below with its coverage-aware visual handoff.
    this.presentationDomain=manaus?'local':local?'planetary':'orbital';
    this.localRoot.visible = manaus;

    // Uncurve position for RealCity legacy logic
    let legacyPos = this.player.position;
    if (FEATURES.curvedManaus && manaus) {
      legacyPos = this.surfaceService.renderLocalToLegacyPoint(this.player.position.x, this.player.position.y, this.player.position.z);
    }
    if (manaus) {
      this.realCity.update(legacyPos,this.player.velocity,dt);
    }
    this.lap('realCity');
    // Out here a frame covers thirteen kilometres, so a collider is not something to hit, it is
    // something to pass through before it has been tested. See TravelDomain.
    if(manaus){
      this.gatherColliders();
      if(FEATURES.curvedManaus)this.curveColliders();
    }else{
      this.colliders.length=0;
      this.curvedColliders.length=0;
    }
    this.lap('colliders');
    if(manaus)this.updateStomps(dt);
    if(manaus&&this.stressRoute.length)this.updateStress(dt);
    else if (local) {
      this.player.update(dt,FEATURES.curvedManaus?this.curvedColliders:this.colliders,this.camera.yaw,this.camera.pitch);
      this.recordSurfaceReturnStep();
    }
    else {
      const simSpeed = this.currentGameplaySpeedMps();
      this.player.updateTravelVisual(
        dt,
        simSpeed,
        this.viewForward,
        this.camera.yaw,
        this.camera.pitch,
        this.cosmicBoostHeld
      );
    }
    this.lap('player');

    if(FEATURES.spatialCore){
      this.rendering.camera.getWorldDirection(this.viewForward);
      if (local) {
        this.universe.update([this.player.position.x,this.player.position.y,this.player.position.z],[this.player.velocity.x,this.player.velocity.y,this.player.velocity.z],dt,[this.viewForward.x,this.viewForward.y,this.viewForward.z]);
      } else if (this.travelDomain.state) {
        this.updateInterplanetaryFlight(dt);
      }

      if (FEATURES.galaxyTravel) {
        const address = this.universe.navigationState;
        const altitude = this.universe.telemetry.altitudeM;
        const cpos: [number, number, number] = [this.rendering.camera.position.x, this.rendering.camera.position.y, this.rendering.camera.position.z];
        for (const gal of this.localGroup) gal.update(address, cpos, altitude);
        this.sgra?.update(address, cpos, altitude);
        this.cosmicWeb?.update(address, cpos, altitude);
      }

    }this.lap('universe');

    // Landing prefetch is gameplay-driven and separate from the angular presentation rule.
    this.updateLandingPrefetch();
    // Prepare celestial presentation state before streaming
    this.celestialController.prepare({
      universe: this.universe,
      earth: this.earth,
      planetProviders: this.planetProviders,
      fovRad: (this.rendering.camera.fov * Math.PI) / 180,
      viewportHeightPx: this.rendering.renderer.domElement.clientHeight,
      cameraFarM: this.rendering.camera.far,
    });

    // Process streaming based on updated presentation state
    this.universe.updateStreaming(dt);

    // One ground at a time. The flat backdrop and the curved planet cannot both be the surface,
    // and above the handover altitude the curvature is what the player is looking at.
    if(this.earth){
      // One ground and one sky at a time. The atmosphere's 44 km sky sphere is a dome drawn
      // around the player in the local pass, so from orbit it paints straight over the planet the
      // far pass just drew. A planet-aware shell replaces it; until then it stands down with the
      // flat ground it belongs to.
      const isEarth = this.universe.telemetry.dominantBody === 'earth';
      const altitudeM = isEarth ? this.universe.telemetry.altitudeM : Number.POSITIVE_INFINITY;
      const state = this.earthTransition.update(altitudeM, this.earth,!manaus||!!this.manausAerial?.ready);
      if(isEarth)this.presentationDomain=state.presentationDomain;
      // The flat backdrop handles its own crossfade based on localWeight, while the rest of
      // the local root (city, trees) remains visible as long as the ground is not fully overridden.
      setTerrainOpacity(this.flatTerrain, state.effectiveLocalWeight);
      const cityVisible = manaus && (state.effectiveLocalWeight > 0 || state.localGroundVisible);
      this.localWorldRoot.visible = cityVisible;

      // Told, not overwritten. Both layers set their own visibility inside an update that runs
      // later in the frame, so a `visible` flag written here is gone by the time anything is
      // drawn -- which is why the far pass drew the planet and the shell painted over it.
      this.atmosphere.planetaryView = !state.localGroundVisible;
      this.space.planetaryView = !state.localGroundVisible;
      // The far domain has to reach whatever the planet's distance is, or leaving orbit clips the
      // very thing the domain exists to show.
      const dominantBodyId = this.universe.telemetry.dominantBody;
      const dominantBodyDef = this.universe.activeSystem.bodies.find(b => b.id === dominantBodyId);
      const dominantBodyRadius = dominantBodyDef ? dominantBodyDef.equatorialRadiusM : 6_378_137;
      this.rendering.domains.setRange(this.universe.telemetry.altitudeM + dominantBodyRadius);
    }
    // Global doubles stay stable. Every world object receives the same inverse origin transform.
    if(local){
      const uOrigin = this.universe.renderSpace.currentOrigin.position;
      if (this.renderOriginVec.x !== uOrigin[0] || this.renderOriginVec.y !== uOrigin[1] || this.renderOriginVec.z !== uOrigin[2]) {
        this.renderOriginVec.set(uOrigin[0], uOrigin[1], uOrigin[2]);
        if (!this.earth) {
          this.localRoot.position.copy(this.renderOriginVec).negate();
        }
        this.actorRoot.position.copy(this.renderOriginVec).negate();
      }
    }
    if(manaus){
      this.streamer.update(this.player.position,this.player.velocity,dt);this.lap('streamer');this.hlod.update(this.player.position,this.streamer.activeKeys);this.lap('hlod');
    }
    // Real dt, never worldDt: the high-speed ram must match the distance actually flown.
    if(manaus){this.destruction.update(dt,this.player.position,this.player.velocity,this.player.state==='Grounded');this.lap('destruction');
    this.traffic?.update(worldDt,this.player.position);this.lap('traffic');}
    // Actors are suppressed as the world starts to blur past: simulating NPCs kilometres behind
    // the player costs the same as simulating them in front, and none of it can be seen.
    this.suppressActors();
    const speedNow=this.currentGameplaySpeedMps();
    this.speedVfx.update(dt,this.speedState(),speedNow);
    // The field of view opens with the effect, and the shake follows ACCELERATION rather than
    // speed, so holding a steady 8 000 m/s is smooth while entering it is not.
    this.camera.speedFov=this.speedVfx.fovBoost;
    const shake=this.speedVfx.shakeFor((speedNow-this.lastSpeed)/Math.max(dt,.001));
    if(shake>.004)this.camera.shake(shake);
    this.lastSpeed=speedNow;
    if(manaus)this.largo.update(this.player.position,worldDt);
    if(manaus){this.landmarks.update(this.player.position,worldDt);this.lap('landmarks');this.population.update(worldDt,this.player.position,this.player.size);this.lap('population');this.missions.update(worldDt,this.player.position);}
    this.camera.inSpace = !local;
    this.camera.update(this.player,this.renderOriginVec,dt,local ? (FEATURES.curvedManaus?this.curvedColliders:this.colliders) : []);this.rendering.camera.updateMatrixWorld();

    // Render celestial presentation
    this.celestialController.render({
      camera: this.rendering.camera
    });
    this.manausAerial?.update(this.universe.telemetry.altitudeM,this.universe.telemetry.dominantBody==='earth',
      this.rendering.camera.position.toArray() as [number,number,number],this.rendering.camera.fov*Math.PI/180,
      this.rendering.renderer.domElement.clientHeight,
      bodySolarDirection(this.universe.activeSystem,this.universe.frames,'earth',this.universe.renderSpace.currentOrigin.frame));
    this.space.setSolarPresentation(this.celestialController.renderSamples.find(sample=>sample.profile?.bodyClass==='star'));
    this.celestialLabels.update(this.celestialController.renderSamples, this.rendering.camera, {
      selectedBodyId: this.navigationLock?.bodyId,
      inTravel: this.travelDomain.kind === 'interplanetary',
      referenceBodyId: this.universe.resolveBodyContext().dominantBody,
    });
    // After the camera settles: the portal skin samples in screen space, so a stale matrix would
    // stretch the galaxy by the viewport and leave it static as the player looks around.
    this.player.character.updateCosmicView(this.rendering.camera);
    this.player.character.setCosmicLevel(this.cosmicLevel(),speedNow,this.direction);if(local)this.powers.update(dt,worldDt);
    this.playerLocal.copy(this.player.position).sub(this.renderOriginVec);
    const altitudeNow = manaus ? this.player.position.y : this.universe.telemetry.altitudeM;
    const skyAltitude=this.universe.telemetry.dominantBody==='earth'?altitudeNow:1_000_000;
    this.atmosphere.setAltitude(skyAltitude);this.atmosphere.update(worldDt,this.playerLocal);this.space.update(skyAltitude,this.atmosphere.sunDirection,this.atmosphere.time==='Night',worldDt,this.atmosphere.weather==='clear'?0:1);this.spaceFactor=this.space.spaceFactor;const flash=manaus?this.weather.update(worldDt,this.player.position,this.atmosphere.weather):0;if(flash)this.atmosphere.sun.intensity+=flash;
    if(this.galaxy)this.galaxy.recentre([this.rendering.camera.position.x,this.rendering.camera.position.y,this.rendering.camera.position.z]);
    const audioBody=this.universe.telemetry.dominantBody;
    this.audio.update({
      medium:audioBody==='earth'?'earth-atmosphere':local?'airless-surface':'vacuum',
      atmosphericDensity01:audioBody==='earth'?earthAtmosphericDensity01(altitudeNow):0,
      speedMps:speedNow,altitudeM:altitudeNow,
      rain:manaus&&['rain','storm'].includes(this.atmosphere.weather),
      river:manaus&&!isLand(this.player.position.x,this.player.position.z),
    });
    if(manaus){
      this.discoveryTime+=dt;if(this.discoveryTime>.5){this.discoveryTime=0;for(const landmark of LANDMARKS)if(Math.hypot(landmark.x-this.player.position.x,landmark.z-this.player.position.z)<Math.max(240,landmark.radius)&&this.save.discover(landmark.id)){this.hud.notify(`LUGAR DESCOBERTO · ${landmark.shortName}`);this.audio.play('discovery');}this.streamer.setNight(this.atmosphere.time==='Night');this.realCity.setNight(this.atmosphere.time==='Night');this.realCity.syncProceduralVisibility();this.updateDistrict();}
    }
    if(manaus){this.terrain.update(this.player.position,this.renderOriginVec);this.forest.update(this.player.position);}
    this.bindSurfacePhysics();this.volumeRenderer.update();
    this.rendering.renderer.render(this.rendering.scene,this.rendering.camera);
    this.cpu+=(performance.now()-start-this.cpu)*.08;this.quality.update(rawDt);this.telemetryTime+=dt;
    if(this.telemetryTime>.2){this.telemetryTime=0;this.sample();}
    const frame = this.frame;
    const animDebug = this.player.character.animationController.debugState;
    const softTarget = this.powers.softTargetInfo;
    const hitStopMs = this.powers.hitStop.remainingMs;
    const navFlight=this.hudFlight();
    this.hud.update(dt,{position:this.player.position,origin:this.renderOriginVec,velocity:this.player.velocity,speedMps:speedNow,altitudeM:altitudeNow,yaw:this.camera.yaw,state:this.player.state,size:this.player.size,selected:this.powers.selected,temporal:this.powers.temporal,title:this.missions.title,objective:this.missions.objective,hint:this.missions.hint,destination:this.missions.destination,remaining:this.missions.remaining,stage:this.missions.stage,time:this.atmosphere.clock,weather:this.atmosphere.weather,fps:frame.fps,backend:this.rendering.backend,speedMode:this.player.speedMode,megaMode:this.player.megaMode,interplanetaryMode:this.travelDomain.localPhysicsActive?this.player.interplanetaryMode:this.travelDomain.isTravelling,flightLabel:this.flightLabel(),spaceFactor:this.spaceFactor,district:this.district,location:this.universe.location,missionMarkerActive:this.manausSimulationActive,presentationDomain:this.presentationDomain,targetCatalog:this.universalTargetCatalog.descriptors,systemBodies:this.hudBodies(),flight:navFlight,nearbyBody:this.nearestNamedBody(),debug:{'Renderer':this.rendering.backend,'FPS':frame.fps,'Frame (ms)':this.quality.averageMs.toFixed(1),'CPU (ms)':this.cpu.toFixed(1),'GPU (ms)':'indisponível','Draw calls':frame.drawCalls,'Triângulos':frame.triangles.toLocaleString(),'Geometrias / texturas':`${frame.geometries} / ${frame.textures}`,'Chunks ativos / cache':`${frame.active} / ${frame.cached}`,'Fila de streaming':frame.queued,'Streaming (ms)':frame.streamMs.toFixed(2),'Memória estimada (MB)':frame.loadedMB.toFixed(1),'HLOD instâncias':this.hlod.nodeCount,'Cidade real · tiles':`${this.realCity.stats.tiles} (${this.realCity.stats.near} células)`,'Cidade real · triângulos':`${Math.round(this.realCity.stats.detailTriangles/1000)}k perto / ${Math.round(this.realCity.stats.shellTriangles/1000)}k casca`,'Cidade real · skyline':this.realCity.stats.skyline,'Cidade real · colisores':this.realCity.stats.colliders,'Destruição':`${this.destruction.stats.destroyed} prédios · ${this.destruction.stats.debris} escombros · ${this.destruction.stats.scars} marcas`,'Perfil (ms)':Object.entries(this.profile).filter(([,v])=>v>.05).map(([k,v])=>`${k} ${v.toFixed(1)}`).join(' · ')||'—','Animação · Base / Voo':`${animDebug.baseLayer} / ${animDebug.flightLayer}`,'Animação · Combate':`${animDebug.combatMove} [${animDebug.movePhase}] (${animDebug.boneMask})`,'Animação · Pulo / Flip':`jumps: ${this.player.jumpCount} · flip: ${(animDebug.doubleJumpProgress*100).toFixed(0)}%`,'Voo · Alinhamento / Vel':`${animDebug.flightAlignment.toFixed(3)} · XYZ(${animDebug.velocityDir.x.toFixed(2)}, ${animDebug.velocityDir.y.toFixed(2)}, ${animDebug.velocityDir.z.toFixed(2)})`,'Voo · Pitch / Bank':`${animDebug.rootPitch.toFixed(2)} / ${animDebug.rootBank.toFixed(2)}`,'Voo · Modo / Vertical':`${animDebug.flightMode} · ${(animDebug.upright*100).toFixed(0)}% em pé`,'Movimento · Esquiva / Mortal':`${animDebug.dodge??'nenhuma'} · ${animDebug.flipPhase}${this.player.isSlamming?' · SLAM':''}`,'Combate · Soft Target':`${softTarget.id??'nenhum'} (${softTarget.angleDeg.toFixed(1)}°)`,'Combate · Hit Stop':`${hitStopMs} ms`,'Largo':`${this.largo.stats.detail} · ${this.largo.stats.draws} draws · ${this.largo.stats.colliders} colisores`,'Skin cósmica':Object.entries(this.player.character.cosmicDiagnostics).filter(([,v])=>v!==undefined&&v!==null).slice(0,5).map(([k,v])=>`${k} ${v}`).join(' · '),'Trânsito':this.traffic?`${this.traffic.stats.active} carros · ${this.traffic.stats.segments} vias · ${this.traffic.stats.nodes} cruzamentos`:'sem malha viária','Ruas reais (tri)':this.realCity.stats.roadTriangles,'Voo':this.player.speedMode+(this.player.armed==='none'?'':` · ${this.player.armed.toUpperCase()} armado`),'NPCs / veículos':`${this.population.npcCount} / ${this.population.vehicleCount}`,'Global XYZ':`${this.player.position.x.toFixed(0)} ${this.player.position.y.toFixed(0)} ${this.player.position.z.toFixed(0)}`,'Local XYZ':`${this.playerLocal.x.toFixed(0)} ${this.playerLocal.y.toFixed(0)} ${this.playerLocal.z.toFixed(0)}`,'Qualidade / resolução':`${this.rendering.preset} / ${Math.round(this.rendering.renderScale*100)}%`,...this.universeDebug(navFlight)}},this.rendering.camera);
    this.input.endFrame();
  };
  /** Rebuilt in place every frame: spreads and filters would allocate three arrays per tick. */
  private gatherColliders(){
    const list=this.colliders;list.length=0;
    if(!this.manausSimulationActive)return;
    for(const collider of this.streamer.colliders)if(!this.realCity.replacesCollider(collider))list.push(collider);
    for(const collider of this.realCity.colliders)list.push(collider);
    for(const collider of this.hlod.colliders)if(!this.realCity.replacesCollider(collider))list.push(collider);
    for(const collider of this.landmarks.colliders)list.push(collider);
    for(const collider of this.largo.colliders)list.push(collider);
    this.airport.appendColliders(list,this.player.position,1600);
    if(this.traffic)for(const collider of this.traffic.colliders)list.push(collider);
    for(const collider of this.population.colliders)list.push(collider);
  }
  private curveColliders(){
    const curvedList = this.curvedColliders;
    curvedList.length = 0;
    for (let i = 0; i < this.colliders.length; i++) {
      if (curvedList.length <= i) curvedList.push({ id: '', x: 0, y: 0, z: 0, width: 0, height: 0, depth: 0 });
      this.surfaceService.legacyColliderToRenderLocal(this.colliders[i], curvedList[i]);
    }
  }
  private updateStomps(dt:number):void{
    this.stompTimer-=dt;if(this.player.size<5||this.stompTimer>0)return;
    this.stompTimer=.12;
    const size=this.player.size,angle=this.player.facingYaw;
    const activeColliders = FEATURES.curvedManaus ? this.curvedColliders : this.colliders;
    for(const side of [-1,1]){
      this.foot.copy(this.player.position);this.foot.x+=Math.cos(angle)*side*.112*size;this.foot.z-=Math.sin(angle)*side*.112*size;
      const floor=PhysicsWorld.terrainHeight(this.foot.x,this.foot.z);
      const supported=this.foot.y<=floor+Math.max(2,size*.08)||activeColliders.some(c=>Math.abs(c.x-this.foot.x)<c.width/2+size*.1&&Math.abs(c.z-this.foot.z)<c.depth/2+size*.1&&Math.abs(c.y+c.height/2-this.foot.y)<Math.max(2,size*.08));
      if(supported)this.destruction.damageAt(this.foot,Math.max(2,size*.18),100000);
    }
  }
  private attackTime=-Infinity;private attackRadius=0;private readonly attackPosition=new Vector3();private attackBoxes:Collider[]=[];
  private attackColliders(point:Vector3,radius:number):readonly Collider[]{
    if(!this.manausSimulationActive)return [];
    if(this.player.size<7)return FEATURES.curvedManaus ? this.curvedColliders : this.colliders;
    const now=performance.now();
    if(now-this.attackTime>120||radius!==this.attackRadius||point.distanceToSquared(this.attackPosition)>65536){
      this.attackBoxes=Array.from(this.destructible.blastColliders(point,radius));this.attackTime=now;this.attackRadius=radius;this.attackPosition.copy(point);
    }
    return this.attackBoxes;
  }
  private readonly blastBoxes:Collider[]=[];
  readonly destructible={
    blastColliders:(point:Vector3,radius:number):readonly Collider[]=>{
      if(!this.manausSimulationActive)return [];
      let flat = point;
      if (FEATURES.curvedManaus && this.travelDomain.localPhysicsActive) {
        flat = this.surfaceService.renderLocalToLegacyPoint(point.x, point.y, point.z);
      }
      const out=this.blastBoxes;out.length=0;
      const srcBoxes = FEATURES.curvedManaus ? this.curvedColliders : this.colliders;
      for(const box of srcBoxes)if(!box.id?.startsWith("real:")&&!box.id?.startsWith("landmark:")&&!box.id?.startsWith("largo:")&&!box.id?.startsWith("airport:"))out.push(box);

      const legacyOut: Collider[] = [];
      this.realCity.appendBlastColliders(legacyOut,flat,radius);
      this.landmarks.appendBlastColliders(legacyOut,flat,radius);
      this.largo.appendBlastColliders(legacyOut,flat,radius);
      this.airport.appendColliders(legacyOut,flat,radius);
      this.streamer.appendBlastColliders(legacyOut,flat,radius);
      this.population.appendBlastColliders(legacyOut,flat,radius);

      if (FEATURES.curvedManaus && this.travelDomain.localPhysicsActive) {
        for (const box of legacyOut) {
          out.push(this.surfaceService.legacyColliderToRenderLocal(box, { id: box.id, x: 0, y: 0, z: 0, width: 0, height: 0, depth: 0 }));
        }
      } else {
        for (const box of legacyOut) out.push(box);
      }

      for (const box of out) { box.category ??= impactCategory(box.id); box.impactKind ??= impactKind(box.id); }
      return out;
    },
    colliders:():readonly Collider[]=>FEATURES.curvedManaus ? this.curvedColliders : this.colliders,
    destroy:(id:string):boolean=>{if(!this.manausSimulationActive)return false;id=id.replace(/^hlod:/,'');return !!this.traffic?.destroy(id)||this.population.destroy(id)||this.realCity.destroy(id)||this.streamer.destroy(id)||this.landmarks.destroy(id)||this.largo.destroy(id)||this.airport.destroy(id);},
    deform:(point:Vector3,radius:number,damage:number,depth?:number)=>{
      if(!this.manausSimulationActive)return false;
      let flat = point;
      if (FEATURES.curvedManaus && this.travelDomain.localPhysicsActive) {
        flat = this.surfaceService.renderLocalToLegacyPoint(point.x, point.y, point.z);
      }
      return this.terrain.damageAt(flat,radius,damage,depth);
    },
  };
  /** Local Manaus authority; C4 celestial events and D0 volume collision remain isolated. */
  applyLocalImpact(point: Vector3, footprint: ImpactResult): number {
    if (!this.manausSimulationActive) return 0;
    const collapsed = this.destruction.impactAt(point,footprint);
    const flat = FEATURES.curvedManaus && this.travelDomain.localPhysicsActive
      ? this.surfaceService.renderLocalToLegacyPoint(point.x,point.y,point.z) : point;
    const response = this.population.applyImpact(flat,footprint);
    this.population.impulse(flat,footprint.impulseRadiusM,footprint.impulse);
    this.traffic?.impulse(flat,footprint.impulseRadiusM,footprint.impulse);
    const stats = this.destruction.lastImpact;
    if (stats) { stats.vehicles+=this.traffic?.lastImpulseWrecks??0;
      stats.npcAffected=response.affected; stats.npcDisabled=response.disabled;
      stats.npcKnocked=response.knocked; stats.npcFleeing=response.fleeing; }
    return collapsed;
  }
  /** Register newly built surfaces once, including streamed roads and plaza LOD changes. */
  private readonly watchedGround=new WeakSet<import('three/webgpu').Object3D>();
  private watchGround(object:import('three/webgpu').Object3D,ground=false):void{
    if(this.watchedGround.has(object))return;this.watchedGround.add(object);
    ground ||= /Generalized Manaus|airport-pavement|sidewalks|destruction-scars|real-city-road-network|largo-sao-sebastiao/.test(object.name) || object.userData?.terrainSurface !== undefined;
    if(ground&&object instanceof Mesh)this.terrain.registerSurface(object);
    for(const child of object.children)this.watchGround(child,ground);
    object.addEventListener('childadded',event=>this.watchGround(event.child,ground));
  }
  /** Named from the real compiled bairro boundaries; throttled with the discovery sweep. */
  private updateDistrict(){
    const bairro=this.realCity.districts.nearest(this.player.position.x,this.player.position.z,2500);
    this.district=(bairro?.name??'AMAZONAS').toUpperCase();
  }
  /** The flight tier the player is actually in, which is what the effect keys off. */
  /** The flight tier and the powers both feed the skin; a power reads over the flight state. */
  private cosmicLevel():CosmicLevel{
    if(this.powers.temporal||this.powers.cooldowns[this.powers.selected]>0)return 'power';
    const mode=this.player.speedMode;
    return mode==='interplanetary'||mode==='mega'?'mega':mode==='super'?'boost':mode==='fast'?'flight'
      :this.player.state==='Grounded'?'idle':'flight';
  }
  private speedState():SpeedState{
    if(!this.travelDomain.localPhysicsActive)return 'interplanetary';
    const mode=this.player.speedMode;
    return mode==='interplanetary'?'interplanetary':mode==='mega'?'mega':mode==='super'?'super':mode==='fast'?'fast':'normal';
  }
  private suppressActors(){
    if(!this.manausSimulationActive){
      this.population.npcCount=0;
      this.traffic?.setCount(0);
      return;
    }
    const speed=this.player.velocity.length();
    const config=QUALITY[this.save.data.settings.quality];
    const fade=speed<=WORLD.actorSpeedLimit?1:Math.max(0,1-(speed-WORLD.actorSpeedLimit)/(WORLD.actorCutoffSpeed-WORLD.actorSpeedLimit));
    this.population.npcCount=Math.round(config.npcs*fade);
    this.traffic?.setCount(Math.round(config.vehicles*2*fade));
  }
  private currentGameplaySpeedMps():number{
    if(this.travelDomain.state){
      const t=this.universe.telemetry;
      const bodyVelocity=this.universe.activeSystem.stateOf(t.dominantBody)?.velocityMps??[0,0,0];
      const vel=this.travelDomain.state.velocityMps;
      return Math.hypot(vel[0]-bodyVelocity[0],vel[1]-bodyVelocity[1],vel[2]-bodyVelocity[2]);
    }
    return this.player.velocity.length();
  }
  /** Space Shift owns boost, animation and reverse target cycling. Local B stays local. */
  private get cosmicBoostHeld(): boolean {
    return this.input.held('ShiftLeft') || this.input.held('ShiftRight');
  }

  /** The production space input/controller step, independent of rendering and city simulation. */
  private updateInterplanetaryFlight(dt:number):void {
    if (!this.travelDomain.state) return;
    // We are interplanetary! Zero out local velocity so the player stays put relative to the camera.
    this.player.velocity.set(0,0,0);

    // Read input for thrust and brake aligned with camera
    const { forward: camFwd, right: camRight, up: camUp } = cameraFlightAxes(this.rendering.camera);

    const boostHeld = this.cosmicBoostHeld;
    const inputBrake = this.input.held('KeyX');

    if (inputBrake && this.warpStep > 0) this.warpStep = 0;

    const forwardHeld = this.input.held('KeyW');
    const backHeld = this.input.held('KeyS');
    const rightInput = (this.input.held('KeyD') ? 1 : 0) - (this.input.held('KeyA') ? 1 : 0);
    const upInput = (this.input.held('Space') ? 1 : 0) - (this.input.held('ControlLeft') || this.input.held('ControlRight') ? 1 : 0);

    /**
     * S brakes the forward component before it reverses anything.
     *
     * Encoding S as negative W looks equivalent and is not: at cosmic speed a plain reverse
     * thrust spends the whole burn cancelling a velocity the player can no longer see, and
     * then keeps going. So while there is forward motion left, S removes it; only once that
     * component is spent does S push backward.
     */
    const relForward = this.relativeForwardSpeed(camFwd);
    let fwdInput = 0;
    if (forwardHeld && !backHeld) fwdInput = 1;
    else if (backHeld && !forwardHeld) {
      fwdInput = relForward > COSMIC_REVERSE_EPSILON_MPS ? 0 : -1;
      // Shed the forward component rather than fighting it with reverse thrust.
      if (relForward > COSMIC_REVERSE_EPSILON_MPS) this.brakeForwardComponent(camFwd, dt);
    }

    const thrust = new Vector3();
    if (fwdInput !== 0 || rightInput !== 0 || upInput !== 0) {
      thrust.addScaledVector(camFwd, fwdInput);
      thrust.addScaledVector(camRight, rightInput);
      thrust.addScaledVector(camUp, upInput);
      thrust.normalize();
    }
    // Shift alone is a modifier, never a direction. It used to copy the camera forward here,
    // so holding it with no movement key flew the player forwards and could enter cosmic
    // cruise without any forward intent at all.
    const forwardIntent = fwdInput > 0;

    /**
     * Both of these cross into `solar-system/barycentric` before anything compares them.
     *
     * The camera forward used to be passed through in render space while the thrust was
     * converted, so the cruise controller's alignment test was a dot product between two
     * different frames -- it could decide the player was not looking at the Moon when they
     * were, and the other way round.
     */
    const renderFrame = this.universe.renderSpace.currentOrigin.frame;
    const toBary = (v: Vector3): void => {
      const out: [number, number, number] = [0, 0, 0];
      this.universe.frames.convertDirection(renderFrame, this.universe.activeSystem.systemFrameId, [v.x, v.y, v.z], out);
      v.set(out[0], out[1], out[2]);
    };
    if (thrust.lengthSq() > 1e-4) toBary(thrust);
    const camFwdBary = camFwd.clone();
    toBary(camFwdBary);
    if (camFwdBary.lengthSq() > 1e-12) camFwdBary.normalize();

    if (this.input.consume('Backspace')) this.clearNavigationTarget();
    if (this.input.consume('Tab')) {
      const candidates = celestialLockCandidates(this.universe.activeSystem,
        this.universe.playerSystemPositionM(),[camFwdBary.x,camFwdBary.y,camFwdBary.z],
        this.celestialController.renderSamples);
      const id = cycleNavigationTarget(candidates,this.navigationLock?.bodyId,boostHeld);
      if (id) this.selectNavigationTarget(id,'reticle'); else this.clearNavigationTarget();
    }
    if (this.input.consume('KeyP')) {
      if (this.interplanetary.autopilot.active) this.interplanetary.autopilot.cancel();
      else if (this.navigationTarget) this.interplanetary.autopilot.engage();
      const universal=this.universalNavigationTarget;
      this.hud.notify(universal && !this.navigationTarget
        ? travelCapabilityLabel(this.universalTargetResolver.resolve(universal).travelCapability)
        : this.interplanetary.autopilot.active ? 'Piloto automático ativo' : 'Piloto automático desligado');
    }
    const target = this.resolveNavigationTarget();
    const targetBody = target && this.universe.activeSystem.bodies.find(b=>b.id===target.bodyId);
    const t = this.universe.telemetry;
    const bodyDef = this.universe.activeSystem.bodies.find(b=>b.id===t.dominantBody);
    const bodyVel = this.universe.activeSystem.stateOf(t.dominantBody)?.velocityMps ?? [0,0,0];
    const bodyPos = this.universe.activeSystem.positionOf(t.dominantBody) ?? [0,0,0];

    const ctx = {
      altitudeM: t.altitudeM,
      speedMps: this.currentGameplaySpeedMps(),
      requested: (this.player.state !== 'Grounded') && boostHeld,
      nearestColliderM: Number.POSITIVE_INFINITY,
      bodyRadiusM: bodyDef?.equatorialRadiusM ?? 6378137,
      bodyPositionM: bodyPos,
      bodyVelocityMps: bodyVel,
      bodyId: t.dominantBody,
      systemId: this.universe.address.systemId!,
      envelopeMarginM: bodyDef?bodyArrivalPolicy(bodyDef).exclusionMarginM:1000,
      exclusionEnvelopes: bodyExclusionEnvelopes(this.universe.activeSystem, {
        bodyId:t.dominantBody,observerM:this.universe.playerSystemPositionM(),
        clearanceM:this.surfaceClearanceM(t.dominantBody),
      }),
      maxLocalTerrainSweepMps:this.travelDomain.landingGate.maxLocalTerrainSweepMps,
      cameraForwardBary: camFwdBary,
      // Cosmic cruise assistance needs real forward intent, not merely the modifier.
      inputBoost: boostHeld && forwardIntent,
      warpStep: this.warpStep,
      inputBrake,
      target,
      targetCanLand:targetBody ? bodyProfile(targetBody).canLand : false,
      targetSurfaceClearanceM:target ? this.surfaceClearanceM(target.bodyId) : undefined,
      targetSurfaceReady:target ? this.surfaceReadyForLanding(target.bodyId) : false,
      returnAltitudeM:this.travelDomain.landingGate.returnAltitudeM,
      landingIntent:this.landingIntentContext(),
    };
    this.celestialImpacts.updateSeparation(this.travelDomain.state.positionM,ctx.exclusionEnvelopes);
    // Snapshot command ownership before update can mark arrival/cancel. X disengages safety now.
    const impactContext = { lockedBodyId:this.navigationLock?.bodyId,
      autopilotActive:this.interplanetary.autopilot.active && !inputBrake,
      landingIntentBodyId:ctx.landingIntent?.bodyId,warpStep:this.warpStep,simulationTimeS:this.universe.time };
    const newState = this.interplanetary.update(this.travelDomain.state, dt, thrust, ctx);
    const contact = this.interplanetary.lastCelestialContact;
    const contactedBody = contact && this.universe.activeSystem.bodies.find(body=>body.id===contact.bodyId);
    if (contact && contactedBody) {
      const elapsed = Math.max(0,Math.min(.25,dt))*contact.fraction;
      // The sweep linearly advances the body's centre from this frame snapshot. Undo that
      // translation before the graph converts to its fixed frame; never use a render proxy.
      const atFrameStart:[number,number,number] = [contact.contactPositionM[0]-contact.bodyVelocityMps[0]*elapsed,
        contact.contactPositionM[1]-contact.bodyVelocityMps[1]*elapsed,
        contact.contactPositionM[2]-contact.bodyVelocityMps[2]*elapsed];
      const fixed = bodyProfile(contactedBody).hasSolidSurface && this.universe.frames.has(contactedBody.frameId)
        ? this.universe.frames.convertPosition(this.universe.activeSystem.systemFrameId,contactedBody.frameId,atFrameStart) : undefined;
      this.celestialImpacts.emit(contact,bodyProfile(contactedBody),
        {...impactContext,simulationTimeS:impactContext.simulationTimeS+elapsed},fixed);
    }
    for (const event of this.celestialImpacts.drain()) {
      this.lastCelestialImpact=event;this.rockyImpactDestruction.consume(event);
    }
    this.flightTelemetry = this.interplanetary.getTelemetry();
    this.travelDomain.setState(newState);

    this.universe.updateSystemPose(newState.positionM, newState.velocityMps, dt, [this.viewForward.x, this.viewForward.y, this.viewForward.z]);
  }

  private updateTravelDomain(dt:number){
    let nearest=Number.POSITIVE_INFINITY;
    for(const collider of (FEATURES.curvedManaus ? this.curvedColliders : this.colliders)){
      const dx=collider.x-this.player.position.x,dy=(collider.y??0)-this.player.position.y,dz=collider.z-this.player.position.z;
      nearest=Math.min(nearest,Math.hypot(dx,dy,dz));
    }
    const t=this.universe.telemetry;
    const bodyVelocity=this.universe.activeSystem.stateOf(t.dominantBody)?.velocityMps??[0,0,0];
    const bodyPos=this.universe.activeSystem.positionOf(t.dominantBody)??[0,0,0];
    const requested=this.player.interplanetaryMode&&this.input.held('KeyB');
    const motion=this.landingMotion(t.dominantBody);

    /**
     * The warp key is read once a frame, outside the domain branches.
     *
     * Reading it inside the interplanetary branch dropped presses: edges are cleared at the end of
     * every frame, so a press that landed on a frame spent in the local branch was discarded
     * without being seen. Four taps reached warp 2.
     */
    if (!this.travelDomain.localPhysicsActive && this.input.consume('KeyF')) this.requestLanding();
    if (this.input.consume('KeyB') && !this.travelDomain.localPhysicsActive) {
      // Warp belongs to free flight. During a landing capture the controller owns the velocity.
      if (this.landingIntent.active) this.hud.notify('Pouso em andamento · F cancela');
      else {
        this.warpStep = Math.min(WARP_STEPS_C.length, this.warpStep + 1);
        this.hud.notify(`Warp ${warpLabel(this.warpStep)}`);
      }
    }
    if (this.travelDomain.localPhysicsActive) { this.warpStep = 0; this.landingIntent.cancel(); }
    else this.maintainLandingIntent();
    this.travelDomain.update({
      altitudeM:this.surfaceClearanceM(t.dominantBody) ?? t.altitudeM,
      speedMps:this.currentGameplaySpeedMps(),
      requested,
      nearestColliderM:nearest,
      bodyRadiusM:this.universe.activeSystem.bodies.find(b=>b.id===t.dominantBody)?.equatorialRadiusM ?? WGS84.semiMajorAxisM,
      bodyPositionM:bodyPos,
      bodyVelocityMps:bodyVelocity,
      bodyId:t.dominantBody,
      systemId:this.universe.address.systemId!,
      envelopeMarginM:1000,
      surfaceReady:this.surfaceReadyForLanding(t.dominantBody),
      radialSpeedMps:motion.radialSpeedMps,
      tangentialSpeedMps:motion.tangentialSpeedMps,
      isAssistedTarget:this.navigationLock?.bodyId===t.dominantBody,
      // The real barycentric pose, so departure does not relocate the player across the system.
      entryPositionM:this.universe.playerSystemPositionM(),
      entryVelocityMps:bodyVelocity,
    },dt);
  }

  /** A local ENU belongs to its body; only Manaus coordinates may drive the city. */
  get manausSimulationActive():boolean {
    return this.travelDomain.localPhysicsActive&&this.universe.player.frame===MANAUS_FRAME_ID;
  }

  private surfaceProvider(bodyId:string):RockyPlanetProvider|undefined {
    return this.planetProviders.get(bodyId);
  }

  /** Airless landing/departure gates use the same measured relief as local collision. */
  private surfaceClearanceM(bodyId:string):number|undefined {
    const provider=this.surfaceProvider(bodyId);
    const body=this.universe.activeSystem.bodies.find(candidate=>candidate.id===bodyId);
    const surface=provider?.surface??(body?surfaceForBody(body):undefined);
    if(!surface||!body)return undefined;
    const fixed=this.universe.frames.convertPosition(this.universe.activeSystem.systemFrameId,body.frameId,this.universe.playerSystemPositionM());
    const radius=Math.hypot(...fixed);
    if(!(radius>0))return -planetSurfaceRadius(surface,[1,0,0]);
    return radius-planetSurfaceRadius(surface,[fixed[0]/radius,fixed[1]/radius,fixed[2]/radius]);
  }

  private landingMotion(bodyId:string) {
    const body=this.universe.activeSystem.bodies.find(candidate=>candidate.id===bodyId);
    const position=this.universe.playerSystemPositionM();
    const centre=this.universe.activeSystem.positionOf(bodyId)??[0,0,0];
    const surface=this.surfaceProvider(bodyId)?.surface??(body?surfaceForBody(body):undefined);
    const fixed=body?this.universe.frames.convertPosition(this.universe.activeSystem.systemFrameId,body.frameId,position):[1,0,0] as [number,number,number];
    const offset=position.map((v,i)=>v-centre[i]);const radius=Math.hypot(...offset)||1;
    const normal=surface&&body?this.universe.frames.convertDirection(body.frameId,this.universe.activeSystem.systemFrameId,surfaceOutwardNormal(surface,fixed)):
      offset.map(v=>v/radius) as [number,number,number];
    return relativeSurfaceMotion(this.travelDomain.state?.velocityMps??this.universe.systemVelocityMps(),
      this.universe.activeSystem.stateOf(bodyId)?.velocityMps??[0,0,0],normal);
  }

  private surfaceReadyForLanding(bodyId:string):boolean {
    const body=this.universe.activeSystem.bodies.find(candidate=>candidate.id===bodyId);
    if(!body||!bodyProfile(body).canLand)return false;
    if(bodyId==='earth')return true;
    const readiness=this.surfaceProvider(bodyId)?.readiness();
    // The minimum safe landing, not the whole visible cut: the landing patch plus the fallback.
    return readiness?.surfaceCoverageReady===true||readiness?.landingCoverageReady===true;
  }

  /** Height above the measured surface, or above the mean sphere for a body with no ground. */
  private clearanceOrSphereM(bodyId:string):number {
    const measured=this.surfaceClearanceM(bodyId);
    if(measured!==undefined)return measured;
    const body=this.universe.activeSystem.bodies.find(candidate=>candidate.id===bodyId);
    const centre=this.universe.activeSystem.positionOf(bodyId);
    if(!body||!centre)return Number.POSITIVE_INFINITY;
    const position=this.universe.playerSystemPositionM();
    return Math.hypot(position[0]-centre[0],position[1]-centre[1],position[2]-centre[2])-body.equatorialRadiusM;
  }

  private landingBodies():LandingBody[] {
    return this.universe.activeSystem.bodies.map(body=>({id:body.id,canLand:bodyProfile(body).canLand,
      clearanceM:this.clearanceOrSphereM(body.id),radiusM:body.equatorialRadiusM}));
  }

  /** F in space: ask to land on the dominant or locked body, if it can be landed on. */
  private requestLanding():void {
    if(this.landingIntent.active){
      this.landingIntent.cancel();
      this.hud.notify('Pouso cancelado');
      return;
    }
    const result=resolveLandingCandidate(this.landingBodies(),this.universe.telemetry.dominantBody,this.navigationLock?.bodyId);
    if(result.ok){
      this.landingIntent.request(result.bodyId);
      this.warpStep=0;
      this.interplanetary.autopilot.cancel();
      this.hud.notify(`Pouso · capturando ${CELESTIAL_LABEL_NAMES[result.bodyId]??result.bodyId}`);
    }else if(result.reason==='not-landable'){
      this.hud.notify('Pouso indisponível · corpo sem superfície sólida');
    }else{
      this.hud.notify('Pouso indisponível · nenhum corpo ao alcance');
    }
  }

  /** Drops an intent that no longer has a body in range, so it cannot fly the player forever. */
  private maintainLandingIntent():void {
    const id=this.landingIntent.bodyId;
    if(!id)return;
    const body=this.universe.activeSystem.bodies.find(candidate=>candidate.id===id);
    if(!body||this.clearanceOrSphereM(id)>landingCaptureRangeM(body.equatorialRadiusM)*LANDING_POLICY.releaseRangeFactor)
      this.landingIntent.cancel();
  }

  private landingIntentContext(){
    const id=this.landingIntent.bodyId;
    const body=id?this.universe.activeSystem.bodies.find(candidate=>candidate.id===id):undefined;
    const centre=id?this.universe.activeSystem.positionOf(id):undefined;
    if(!id||!body||!centre)return undefined;
    return {bodyId:id,centreM:centre,velocityMps:this.universe.activeSystem.stateOf(id)?.velocityMps??[0,0,0] as [number,number,number],
      radiusM:body.equatorialRadiusM,clearanceM:this.clearanceOrSphereM(id),surfaceReady:this.surfaceReadyForLanding(id),
      returnAltitudeM:this.travelDomain.landingGate.returnAltitudeM};
  }

  /**
   * Starts the small landing-critical patch before contact. Candidate bodies are the landing
   * intent and the navigation target; the patch is derived in the body-fixed frame.
   */
  private updateLandingPrefetch():void {
    let active:string|undefined;
    const state=this.travelDomain.state;
    if(!this.travelDomain.localPhysicsActive&&state){
      for(const id of [this.landingIntent.bodyId,this.navigationLock?.bodyId]){
        const body=id?this.universe.activeSystem.bodies.find(candidate=>candidate.id===id):undefined;
        const provider=id?this.surfaceProvider(id):undefined;
        const centre=id?this.universe.activeSystem.positionOf(id):undefined;
        if(!id||!body||!provider||!centre||!bodyProfile(body).canLand)continue;
        const orbital=this.universe.activeSystem.stateOf(id)?.velocityMps??[0,0,0];
        const offset:[number,number,number]=[state.positionM[0]-centre[0],state.positionM[1]-centre[1],state.positionM[2]-centre[2]];
        const relative:[number,number,number]=[state.velocityMps[0]-orbital[0],state.velocityMps[1]-orbital[1],state.velocityMps[2]-orbital[2]];
        const distance=Math.hypot(...offset)||1;
        const closing=-(offset[0]*relative[0]+offset[1]*relative[1]+offset[2]*relative[2])/distance;
        const clearance=this.clearanceOrSphereM(id);
        const intent=this.landingIntent.bodyId===id;
        let eta=landingEtaS(clearance,closing);
        // A held player is waiting for the patch right now: zero, not Infinity.
        if(intent&&!Number.isFinite(eta))eta=0;
        if(!intent&&!(eta<=LANDING_POLICY.prefetchHorizonS))continue;
        const fixed=this.universe.frames.convertPosition(this.universe.activeSystem.systemFrameId,body.frameId,state.positionM);
        const fixedVelocity=this.universe.frames.convertDirection(this.universe.activeSystem.systemFrameId,body.frameId,relative);
        provider.setLandingPrefetch({directionFixed:predictTouchdownDirection(fixed,fixedVelocity as [number,number,number],
          planetSurfaceRadius(provider.surface,[fixed[0]/(Math.hypot(...fixed)||1),fixed[1]/(Math.hypot(...fixed)||1),fixed[2]/(Math.hypot(...fixed)||1)])),
          timeToContactS:eta});
        active=id;
        break;
      }
    }
    for(const [id,provider] of this.planetProviders)if(id!==active)provider.setLandingPrefetch(undefined);
  }

  /** Completes the TravelDomain return using the actual gameplay physics and view. */
  private finishSurfaceReturn(targetBody:string):void {
    this.landingIntent.cancel();
    if (this.interplanetary?.autopilot.active && this.navigationLock?.bodyId===targetBody)
      this.interplanetary.autopilot.arrive();
      const frameBefore=this.universe.player.frame,motion=this.landingMotion(targetBody);
      const previousViewFrame=this.universe.renderSpace.currentOrigin.frame;
      this.rendering.camera.getWorldDirection(this.viewForward);
      const newLocalPos = this.universe.handoffTo(targetBody);
      const landingView=this.universe.frames.convertDirection(previousViewFrame,this.universe.player.frame,[this.viewForward.x,this.viewForward.y,this.viewForward.z]);
      this.camera.setLocalView(landingView);
      this.bindSurfacePhysics();
      this.player.teleport(new Vector3(...newLocalPos));
      this.player.velocity.set(...this.universe.localVelocityMps);
      this.player.beginSurfaceApproach();
      this.surfaceReturnTrace={bodyId:targetBody,transition:'returned',frameBefore,
        frameAfter:this.universe.player.frame,physicsDomain:this.physicsDomain,
        surfaceReady:this.surfaceReadyForLanding(targetBody),
        relativeSpeedMps:motion.relativeSpeedMps,radialSpeedMps:motion.radialSpeedMps};
      const uOrigin = this.universe.renderSpace.currentOrigin.position;
      this.renderOriginVec.set(...uOrigin);
      if (!this.earth) this.localRoot.position.copy(this.renderOriginVec).negate();
      this.actorRoot.position.copy(this.renderOriginVec).negate();
      this.camera.inSpace = false;
      this.hud.notify(`Aproximação · ${this.universe.activeSystem.bodies.find(body=>body.id===targetBody)?.name ?? targetBody}`);
  }

  private recordSurfaceReturnStep():void {
    const trace=this.surfaceReturnTrace;
    if(trace&&!trace.firstLocalStep) trace.firstLocalStep={position:this.player.position.toArray(),
      velocity:this.player.velocity.toArray(),state:this.player.state,
      terrainHeightM:PhysicsWorld.terrainHeight(this.player.position.x,this.player.position.z,.32*this.player.size)};
  }

  private bindSurfacePhysics():void {
    const bodyId=this.universe.navigationState.bodyId;
    const provider=bodyId?this.surfaceProvider(bodyId):undefined;
    const body=this.universe.activeSystem.bodies.find(b=>b.id===bodyId),surface=provider?.surface??(body&&surfaceForBody(body));
    const domain=this.manausSimulationActive?'manaus':
      this.travelDomain.localPhysicsActive&&surface&&this.universe.player.frame===`${bodyId}/local-enu`?bodyId!:'space';
    const replacementGeneration=this.universe.volume.replacement.generation;
    if(domain===this.physicsDomain&&replacementGeneration===this.volumePhysicsGeneration)return;
    this.volumePhysicsGeneration=replacementGeneration;
    this.physicsDomain=domain;
    this.colliders.length=0;
    this.curvedColliders.length=0;
    this.attackBoxes.length=0;
    this.blastBoxes.length=0;
    this.attackTime=-Infinity;
    if(domain==='manaus'){
      PhysicsWorld.setVolumeCollision(null);
      PhysicsWorld.setTerrain(this.terrain);
      this.player.setSurfaceGravity(surfaceGravityMps2(EARTH));
    }else if(surface&&domain!=='space'){
      let terrain=this.surfaceTerrains.get(domain);
      if(!terrain){
        terrain=new PlanetTerrainProvider(this.universe.frames,surface.body,surface);
        this.surfaceTerrains.set(domain,terrain);
      }
      PhysicsWorld.setTerrain(new PlanetVolumeTerrainProvider(terrain,this.universe.volume.replacement,
        this.universe.frames,domain,`${domain}/fixed`,`${domain}/local-enu`));
      const volume=new PlanetVolumeCollisionProvider(this.universe.volume.collisionCache,this.universe.frames,
        domain,`${domain}/fixed`,`${domain}/local-enu`);
      PhysicsWorld.setVolumeCollision(this.universe.volume.replacement.bodyId===domain?volume:null);
      this.universe.volume.setCollisionDiagnostics(volume.metrics);
      this.player.setSurfaceGravity(surfaceGravityMps2(surface.body));
      this.district=surface.body.id.toUpperCase();
    }else{
      PhysicsWorld.setVolumeCollision(null);
      PhysicsWorld.setTerrain(null);
      this.player.setSurfaceGravity(0);
      this.district='ESPAÇO';
    }
  }

  /** Browser diagnostics use the same binding that the movement controller consumes. */
  get surfacePhysicsState(){
    return {
      domain:this.physicsDomain,
      frame:this.universe.player.frame,
      bodyId:this.universe.navigationState.bodyId,
      terrainHeightM:this.physicsDomain==='space'?null:PhysicsWorld.terrainHeight(this.player.position.x,this.player.position.z),
      gravityMps2:this.player.surfaceGravityMps2,
      colliderCount:this.colliders.length+this.curvedColliders.length,
      manausSimulationActive:this.manausSimulationActive,
      playerLocalYM:this.player.position.y,
      playerState:this.player.state,
      terrainContactFraction:this.player.lastTerrainContact?.fraction??null,
    };
  }

  /** Landing and representation gates are inspectable through F3 and browser diagnostics. */
  get moonLandingState(){
    const provider=this.surfaceProvider('moon');
    const readiness=provider?.readiness();
    const altitudeM=this.surfaceClearanceM('moon')??Infinity;
    const velocity=this.travelDomain.state?.velocityMps??this.universe.systemVelocityMps();
    const orbital=this.universe.activeSystem.stateOf('moon')?.velocityMps??[0,0,0];
    const relativeSpeedMps=Math.hypot(...velocity.map((v,i)=>v-orbital[i]));
    const sample=this.celestialController.renderSamples.find(candidate=>candidate.bodyId==='moon');
    const gate=this.travelDomain.landingGate;
    return {altitudeM,relativeSpeedMps,surfaceReady:readiness?.surfaceCoverageReady??false,
      activeTiles:readiness?.activeTiles??0,missingLandingTiles:readiness?.landingMissingKeys.length??0,
      fallbackActive:provider?.globe.visible===true&&readiness?.fallbackReady===true,
      representation:this.physicsDomain==='moon'?'local-surface':provider?.globe.visible
        ?provider.presentationMode==='surface'?'surface-globe':'coarse-globe':'proxy',
      proxyOpacity:sample?.visible?sample.opacity:0,globeOpacity:provider?.globe.visible?provider.globe.opacity:0,
      domain:this.travelDomain.kind,frame:this.universe.player.frame,...gate,
      blockedReason:this.physicsDomain==='moon'?'local':this.universe.telemetry.dominantBody!=='moon'?'not-near-moon':gate.blockedReason};
  }

  /**
   * The solar system's bodies as the destination list needs them, with live coordinates.
   *
   * Built from `activeSystem` every time it is asked for rather than cached: these are ephemeris
   * values and a cached copy is a copy of where the planets used to be.
   */
  private hudBodies(){
    const player=this.travelDomain.state?.positionM
      ?? this.universe.activeSystem.positionOf(this.universe.telemetry.dominantBody)
      ?? [0,0,0];
    const rows=[];
    for(const body of this.universe.activeSystem.bodies){
      const position=this.universe.activeSystem.positionOf(body.id);
      if(!position)continue;
      rows.push({
        id:body.id,
        name:CELESTIAL_LABEL_NAMES[body.id] ?? body.name,
        parentId:body.parentId,profile:bodyProfile(body),orbit:body.orbit,
        systemPositionM:position as readonly [number,number,number],
        distanceFromPlayerM:Math.hypot(position[0]-player[0],position[1]-player[1],position[2]-player[2]),
        selected:this.navigationLock?.bodyId===body.id,
      });
    }
    return rows;
  }

  /**
   * The body the player is close enough to call a place, with how big it looks from here.
   *
   * Proximity is measured in apparent size rather than in metres: half a degree is the Moon seen
   * from Earth, which is about where something stops being a point of light and starts being
   * somewhere. One distance threshold cannot serve both the Sun and a moon. The address alone could
   * not answer this -- it names a body only once a surface provider owns the ground, so the readout
   * said deep space while a planet filled the view.
   */
  private nearestNamedBody(){
    const player=this.travelDomain.state?.positionM;
    if(!player)return undefined;
    let best:{id:string;name:string;distanceM:number;angularDeg:number}|undefined;
    for(const body of this.universe.activeSystem.bodies){
      const position=this.universe.activeSystem.positionOf(body.id);
      if(!position)continue;
      const distanceM=Math.hypot(position[0]-player[0],position[1]-player[1],position[2]-player[2]);
      if(!(distanceM>0))continue;
      const angularDeg=2*Math.asin(Math.min(1,body.equatorialRadiusM/distanceM))*180/Math.PI;
      if(angularDeg<.5)continue;
      // The biggest in the sky wins, not the closest: a moon a thousand kilometres away is where
      // you are, and the star behind it is not, however much of the system it owns.
      if(!best||angularDeg>best.angularDeg)best={id:body.id,name:body.name,distanceM,angularDeg};
    }
    return best;
  }

  /** The cruise controller's own numbers, named for the target rather than its id. */
  private hudFlight(){
    const telemetry=this.flightTelemetry ?? this.interplanetary.getTelemetry();
    const target=this.resolveNavigationTarget();
    const local=this.travelDomain.localPhysicsActive;
    const position=this.universe.playerSystemPositionM();
    const velocity=this.travelDomain.state?.velocityMps ?? this.universe.systemVelocityMps();
    const dx=target ? target.positionM[0]-position[0] : 0,dy=target ? target.positionM[1]-position[1] : 0,
      dz=target ? target.positionM[2]-position[2] : 0;
    const distance=Math.hypot(dx,dy,dz);
    const relative=target ? velocity.map((v,i)=>v-(target.velocityMps?.[i]??0)) : [0,0,0];
    const closing=distance>0 ? (dx*relative[0]+dy*relative[1]+dz*relative[2])/distance : 0;
    const arrivalRadius=this.interplanetary.autopilot.active && this.interplanetary.autopilot.arrivalRadiusM>0
      ? this.interplanetary.autopilot.arrivalRadiusM : target ? target.radiusM+target.arrivalMarginM : 0;
    const name=target?.bodyId
      ? CELESTIAL_LABEL_NAMES[target.bodyId] ?? this.universe.activeSystem.bodies.find(b=>b.id===target.bodyId)?.name
      : undefined;
    const universal=this.universalNavigationTarget;
    const resolved=universal?this.universalTargetResolver.resolve(universal):undefined;
    return {
      universalTarget:resolved,
      phase:local ? target?.bodyId===this.universe.telemetry.dominantBody ? 'arrived' : 'idle'
        :this.interplanetary.autopilot.phase==='arrived' ? 'arrived' : telemetry.targetBodyId===target?.bodyId ? telemetry.phase : 'idle',
      speedMps:telemetry.speedMps,
      accelerationMps2:telemetry.accelerationMps2,
      targetBodyId:target?.bodyId,
      lockSource:universal?.source,
      lockActive:!!universal,
      autopilotActive:this.interplanetary.autopilot.active,
      closingSpeedMps:closing,
      relativeSpeedMps:Math.hypot(...relative),
      targetName:name??resolved?.target.displayName,
      warpStep:telemetry.warpStep,
      warpLabel:warpLabel(telemetry.warpStep),
      distanceToTargetM:target ? distance : resolved?.distanceM,
      photosphereClearanceM:target?.bodyId==='sun' ? distance-target.radiusM : undefined,
      angularDiameterDeg:target?.bodyId==='sun' ? solarDiagnostics(target.radiusM,distance,
        this.rendering.camera.fov*Math.PI/180,innerHeight).angularDiameterDeg : undefined,
      timeToTargetS:closing>0 ? Math.max(0,distance-arrivalRadius)/closing : undefined,
    };
  }

  /**
   * The target, resolved against the ephemeris as it is now.
   *
   * Called every update. The body keeps orbiting after it was chosen, so anything that answers
   * "where is Mars" has to ask the system rather than remember.
   */
  private resolveNavigationTarget(){
    return resolveBodyDestination(this.universe.activeSystem,this.navigationTarget);
  }

  /** The player's speed along the camera's forward axis, relative to the reference body. */
  private relativeForwardSpeed(camFwd:Vector3):number{
    const state=this.travelDomain.state;
    if(!state)return 0;
    const body=this.universe.activeSystem.stateOf(this.universe.telemetry.dominantBody)?.velocityMps??[0,0,0];
    const rel=new Vector3(
      state.velocityMps[0]-body[0],
      state.velocityMps[1]-body[1],
      state.velocityMps[2]-body[2],
    );
    const fwdBary:[number,number,number]=[0,0,0];
    this.universe.frames.convertDirection(
      this.universe.renderSpace.currentOrigin.frame,this.universe.activeSystem.systemFrameId,
      [camFwd.x,camFwd.y,camFwd.z],fwdBary,
    );
    const length=Math.hypot(fwdBary[0],fwdBary[1],fwdBary[2])||1;
    return (rel.x*fwdBary[0]+rel.y*fwdBary[1]+rel.z*fwdBary[2])/length;
  }

  /** Sheds the forward component of travel without touching the lateral one. */
  private brakeForwardComponent(camFwd:Vector3,dt:number):void{
    const state=this.travelDomain.state;
    if(!state)return;
    const fwdBary:[number,number,number]=[0,0,0];
    this.universe.frames.convertDirection(
      this.universe.renderSpace.currentOrigin.frame,this.universe.activeSystem.systemFrameId,
      [camFwd.x,camFwd.y,camFwd.z],fwdBary,
    );
    const length=Math.hypot(fwdBary[0],fwdBary[1],fwdBary[2]);
    if(!(length>0))return;
    const nx=fwdBary[0]/length,ny=fwdBary[1]/length,nz=fwdBary[2]/length;
    const body=this.universe.activeSystem.stateOf(this.universe.telemetry.dominantBody)?.velocityMps??[0,0,0];
    const rel:[number,number,number]=[
      state.velocityMps[0]-body[0],state.velocityMps[1]-body[1],state.velocityMps[2]-body[2],
    ];
    const along=rel[0]*nx+rel[1]*ny+rel[2]*nz;
    if(along<=0)return;
    const shed=Math.min(along,Math.max(BASE_BRAKE_ACCEL,along*2.5)*dt);
    rel[0]-=nx*shed;rel[1]-=ny*shed;rel[2]-=nz*shed;
    this.travelDomain.setState({
      systemId:state.systemId,
      positionM:state.positionM,
      velocityMps:[body[0]+rel[0],body[1]+rel[1],body[2]+rel[2]],
      referenceBodyId:state.referenceBodyId,
    });
  }

  /** Local tier or landing status, whichever domain the player is in. Never shows arm state as Warp. */
  private flightLabel():string {
    if(this.universe.activeSystem!==this.universe.solarSystem && Math.hypot(...this.universe.playerSystemPositionM())>systemDomainLimitM(this.universe.activeSystem))
      return 'INTERSTELLAR HYPERCRUISE REQUIRED';
    if(!this.travelDomain.localPhysicsActive){
      const landing=this.landingState;
      if(!landing.intentBodyId)return '';
      const speed=`${landing.relativeSpeedMps.toFixed(0)} m/s`;
      const clearance=`${landing.clearanceM.toFixed(0)} m`;
      return landing.phase==='hold'&&!landing.surfaceReady
        ?`POUSO · PREPARANDO SUPERFÍCIE · ${landing.missingLandingTiles} tiles · ${clearance} · ${speed}`
        :landing.phase==='hold'?`POUSO · PRONTO · ${clearance} · ${speed}`:`POUSO · CAPTURANDO · ${clearance} · ${speed}`;
    }
    if(this.player.state==='Grounded'||this.player.state==='Falling')return '';
    const names:Record<string,string>={normal:'NORMAL',fast:'RÁPIDO',super:'SUPER',mega:'MEGA',interplanetary:'INTERPLANETÁRIO'};
    const armed=this.player.armed;
    if(armed!=='none'&&this.player.speedMode!==armed)return `VOO · ${names[armed]} ARMADO`;
    return `VOO · ${names[this.player.speedMode]??this.player.speedMode.toUpperCase()}`;
  }

  /** Landing diagnostics for F3 and the browser harness. */
  get landingState(){
    const id=this.landingIntent.bodyId??this.navigationLock?.bodyId??this.universe.telemetry.dominantBody;
    const provider=this.surfaceProvider(id);
    const readiness=provider?.readiness();
    const motion=this.landingMotion(id);
    const telemetry=this.interplanetary.getTelemetry();
    const gate=this.travelDomain.landingGate;
    const missing=readiness?.landingPrefetchKeys.length?readiness.landingPrefetchMissingKeys.length:readiness?.landingMissingKeys.length??0;
    return {intentBodyId:this.landingIntent.bodyId,
      phase:this.travelDomain.localPhysicsActive?'idle' as const
        :telemetry.phase==='landing-hold'?'hold' as const:telemetry.phase==='landing-capture'?'capture' as const:'idle' as const,
      bodyId:id,clearanceM:this.clearanceOrSphereM(id),relativeSpeedMps:motion.relativeSpeedMps,radialSpeedMps:motion.radialSpeedMps,
      tangentialSpeedMps:motion.tangentialSpeedMps,surfaceMode:provider?.presentationMode??'off',fallbackReady:readiness?.fallbackReady??false,
      requiredTiles:readiness?.landingPrefetchKeys.length||readiness?.landingRequiredKeys.length||0,missingLandingTiles:missing,
      surfaceReady:this.surfaceReadyForLanding(id),landingCoverageReady:readiness?.landingCoverageReady??false,
      blockedReason:this.travelDomain.localPhysicsActive?'local':gate.blockedReason};
  }

  get solarApproachState() {
    const sun=this.universe.activeSystem.bodies.find(body=>bodyProfile(body).bodyClass==='star');
    const centre=sun&&this.universe.activeSystem.positionOf(sun.id);
    if(!sun||!centre)return undefined;
    const observer=this.universe.playerSystemPositionM();
    const distance=Math.hypot(...observer.map((v,i)=>v-centre[i]));
    const policy=bodyArrivalPolicy(sun);
    return {...solarDiagnostics(sun.equatorialRadiusM,distance,this.rendering.camera.fov*Math.PI/180,
      typeof innerHeight==='number'?innerHeight:900),ccdRadiusM:sun.equatorialRadiusM+policy.exclusionMarginM,
      ccdMarginM:policy.exclusionMarginM,autopilotStandoffM:policy.arrivalMarginM,
      coronaExtentR:bodyProfile(sun).visual.solarGlow?.outerScale??1,
      contact:this.interplanetary.lastCelestialContact?.bodyId===sun.id,
      visual:this.celestialVisuals?.solarDiagnostics};
  }

  private solarDebug():Record<string,string|number>{
    const s=this.solarApproachState;if(!s)return{};
    return {'SOL · Distância ao centro':s.distanceM,'SOL · Distância à fotosfera':s.photosphereClearanceM,
      'SOL · Raio físico':s.radiusM,'SOL · Diâmetro angular':s.angularDiameterDeg,
      'SOL · Diâmetro projetado px':s.projectedDiameterPx,'SOL · CCD radius':s.ccdRadiusM,
      'SOL · CCD margin':s.ccdMarginM,'SOL · Autopilot standoff':s.autopilotStandoffM,
      'SOL · Corona visual extent':`${s.coronaExtentR}R angular (óptico)`,
      'SOL · Contato CCD':s.contact?'SIM':'NÃO',
      'SOL · Visual / Draws / Triângulos':`${s.visual?.mode??'—'} / ${s.visual?.drawCalls??0} / ${s.visual?.triangles??0}`};
  }

  private universeDebug(nav=this.hudFlight()):Record<string,string|number>{
    if(!FEATURES.spatialCore)return{};
    const t=this.universe.telemetry;
    const moon=this.moonLandingState;
    const landing=this.landingState;
    const landingEta=landingEtaS(landing.clearanceM,-landing.radialSpeedMps);
    const motion=this.landingMotion(t.dominantBody),gate=this.travelDomain.landingGate;
    const contact=this.interplanetary.lastCelestialContact;
    const impact=this.lastCelestialImpact;
    const localImpact=this.destruction.lastImpact, footprint=localImpact?.footprint;
    return{
      'ACTIVE SYSTEM · Galaxy':this.universe.address.galaxyId,
      'ACTIVE SYSTEM · Sector':Object.values(this.universe.address.sector).join(','),
      'ACTIVE SYSTEM · ID':this.universe.address.systemId??'—',
      'ACTIVE SYSTEM · Procedural':this.universe.activeSystem===this.universe.solarSystem?'não':'sim',
      'ACTIVE SYSTEM · Star':this.universe.activeSystem.bodies.find(b=>!b.parentId)?.name??'—',
      'ACTIVE SYSTEM · Bodies':this.universe.activeSystem.bodies.length,
      'ACTIVE SYSTEM · Planets':this.universe.activeSystem.bodies.filter(b=>b.parentId===this.universe.activeSystem.bodies.find(b=>!b.parentId)?.id).length,
      'ACTIVE SYSTEM · Moons':this.universe.activeSystem.bodies.filter(b=>b.parentId && b.parentId!==this.universe.address.systemId && b.parentId!=='sun').length,
      'ACTIVE SYSTEM · Runtime generation':this.materializer?.generation??0,
      'ACTIVE SYSTEM · System frame':this.universe.activeSystem.systemFrameId,
      'ACTIVE SYSTEM · Providers':this.planetProviders.size,
      'ACTIVE SYSTEM · Dynamic visuals':this.celestialVisuals.stats.total,
      'ACTIVE SYSTEM · Landable bodies':this.universe.activeSystem.bodies.filter(b=>bodyProfile(b).canLand).length,
      'ACTIVE SYSTEM · Gas/ice giants':this.universe.activeSystem.bodies.filter(b=>!bodyProfile(b).hasSolidSurface && !!b.parentId).length,
      'ACTIVE SYSTEM · Epoch':this.universe.time.toFixed(3),
      'ACTIVE SYSTEM · QA arrival mode':this.materializer?.qaArrivalMode?'U1 TEST ARRIVAL':'off',
      'ACTIVE SYSTEM · Boundary':Math.hypot(...this.universe.playerSystemPositionM())>systemDomainLimitM(this.universe.activeSystem)?'INTERSTELLAR HYPERCRUISE REQUIRED':'intra-system',
      ...this.solarDebug(),
      'Manaus aerial · Ready / visible / opacity':`${this.manausAerial?.ready??false} / ${this.manausAerial?.stats.visible??false} / ${this.manausAerial?.stats.opacity.toFixed(3)??'0'}`,
      'Manaus aerial · River urban mass roads triangles':Object.values(this.manausAerial?.stats.triangles??{}).join(' / '),
      'Manaus aerial · Eligible meshes / bytes / projected px':`${this.manausAerial?.stats.drawCalls??0} / ${this.manausAerial?.stats.cpuGeometryBytes??0} / ${this.manausAerial?.stats.projectedPx.toFixed(1)??'0'}`,
      'Manaus aerial · Failure':this.manausAerial?.failure||'—',
      ...this.universe.volume?.debugMetrics(),
      'Planet Destruction · Tile masks avg max / zero masked':`${this.volumeRenderer.stats.masks?.averageBounds.toFixed(2)??'0'} ${this.volumeRenderer.stats.masks?.maxBounds??0} / ${this.volumeRenderer.stats.masks?.zeroTiles??0} ${this.volumeRenderer.stats.masks?.maskedTiles??0}`,
      ...this.rockyImpactDestruction.debugMetrics(),
      'Geo · Lat / Lon':`${t.latDeg.toFixed(5)}, ${t.lonDeg.toFixed(5)}`,
      'Geo · Altitude':`${t.altitudeM.toFixed(1)} m`,
      'Frame · Ativo':`${t.frame} · corpo ${t.dominantBody}`,
      'Frame · Local / Rebases':`${t.renderLocalM.toFixed(0)} m · ${t.rebases}`,
      'Planeta · Tiles / Stream':`${t.planetTiles} · ${t.streaming.active} ativos, ${t.streaming.fetching} em voo`,
      'Orçamento · Subsistemas':t.streaming.subsystems.map(x=>`${x.id.split('/').pop()} ${x.grantedMs.toFixed(1)}ms (${x.pending})`).join(' · ')||'—',
      'Domínio':`${this.travelDomain.kind}${this.travelDomain.transition.kind==='refused'?` · recusado (${this.travelDomain.transition.reason})`:''}`,
      'Corpos · Proxies':this.celestialController.renderSamples.filter(sample=>sample.visible).length,
      'Corpos · Provider físico':this.celestialController.physicalBodyId??'—',
      'Corpos · Apresentação':this.celestialController.physicalMode,
      'Corpos · Tiles residentes':Array.from(this.planetProviders,([id,provider])=>`${id}: ${provider.stats.tiles}`).join(' · '),
      ...universalTargetDiagnostics(nav.universalTarget),
      'Destino':this.universalNavigationTarget?.displayName??'—',
      'Alvo · Origem':this.universalNavigationTarget?.source??'—',
      'Alvo · Distância / Relativa / Fechamento':`${nav.distanceToTargetM??0} / ${nav.relativeSpeedMps} / ${nav.closingSpeedMps}`,
      'Alvo · Alinhamento':this.flightTelemetry?.alignment??0,
      'Piloto · Ativo / Fase':`${this.interplanetary.autopilot.active} / ${this.interplanetary.autopilot.phase}`,
      'Piloto · Frenagem / Raio / Limite':`${this.interplanetary.autopilot.stoppingDistanceM} / ${this.interplanetary.autopilot.arrivalRadiusM} / ${this.interplanetary.autopilot.effectiveSpeedCapMps}`,
      'Contato · Domínio físico':this.physicsDomain,
      'Contato · Vel relativa / radial / tangente':`${motion.relativeSpeedMps.toFixed(1)} / ${motion.radialSpeedMps.toFixed(1)} / ${motion.tangentialSpeedMps.toFixed(1)} m/s`,
      'Contato · Folga / Gate':`${(this.surfaceClearanceM(t.dominantBody)??t.altitudeM).toFixed(1)} m / ${gate.blockedReason}`,
      'Contato · Aproximação / Handoff / Sweep':`${gate.approachCaptureSpeedMps} / ${gate.localHandoffSpeedMps} / ${gate.maxLocalTerrainSweepMps} m/s`,
      'Contato · Terreno / Y / Estado':`${this.physicsDomain} · ${PhysicsWorld.terrainHeight(this.player.position.x,this.player.position.z).toFixed(2)} / ${this.player.position.y.toFixed(2)} m · ${this.player.state}`,
      'Contato · Último corpo / Fração':contact?`${contact.bodyId} / ${contact.fraction.toFixed(6)}`:'—',
      'VOO LOCAL · Tier armado / Modo':`${this.player.armed} / ${this.player.speedMode}${this.player.armWaitingForBoostRelease?' (solte e repita B)':''}`,
      'VOO LOCAL · Velocidade pedida / real':`${this.player.speedMode==='ground'?'—':FLIGHT.speeds[this.player.speedMode]*this.player.speedMultiplier} / ${this.player.velocity.length().toFixed(1)} m/s`,
      'POUSO · Intenção / Fase':`${landing.intentBodyId??'—'} / ${landing.phase}`,
      'POUSO · Folga / Relativa':`${landing.clearanceM.toFixed(1)} m / ${landing.relativeSpeedMps.toFixed(1)} m/s`,
      'POUSO · Radial / Tangente':`${landing.radialSpeedMps.toFixed(1)} / ${landing.tangentialSpeedMps.toFixed(1)} m/s`,
      'POUSO · Superfície / Fallback':`${landing.surfaceMode} / ${landing.fallbackReady?'pronto':'aguardando'}`,
      'POUSO · Tiles críticos / Faltando':`${landing.requiredTiles} / ${landing.missingLandingTiles}`,
      'POUSO · ETA / Bloqueio':`${Number.isFinite(landingEta)?landingEta.toFixed(1)+' s':'—'} / ${landing.blockedReason}`,
      'CONTATO CELESTE · Corpo / Modo':contact?`${contact.bodyId} / ${contact.responseMode}`:'—',
      'IMPACTO CELESTE · Corpo / Tipo':impact?`${impact.bodyId} / ${impact.bodyClass}`:'—',
      'IMPACTO CELESTE · Classe':impact?.classification??'—',
      'IMPACTO CELESTE · Relativa / c':impact?`${impact.relativeSpeedMps.toFixed(1)} m/s / ${impact.effectiveC.toFixed(3)}c`:'—',
      'IMPACTO CELESTE · Radial / Tangente':impact?`${impact.inwardRadialSpeedMps.toFixed(1)} / ${impact.tangentialSpeedMps.toFixed(1)} m/s`:'—',
      'IMPACTO CELESTE · Direto / Ângulo':impact?`${impact.radialFraction.toFixed(3)} / ${impact.incidenceAngleRad.toFixed(3)} rad`:'—',
      'IMPACTO CELESTE · Warp / Lock / Piloto / Pouso':impact?`${impact.warpStep} / ${impact.lockedTarget} / ${impact.autopilotActive} / ${impact.landingIntentActive}`:'—',
      'IMPACTO CELESTE · Evento':impact?.eventId??'—',
      'IMPACTO LOCAL · Velocidade / Normal / Tangente':footprint?`${footprint.impactSpeed.toFixed(1)} / ${footprint.normalImpactSpeed.toFixed(1)} / ${footprint.tangentialSpeed.toFixed(1)} m/s`:'—',
      'IMPACTO LOCAL · Energia / Raio / Profundidade':footprint?`${footprint.energy.toFixed(0)} / ${footprint.craterRadiusM.toFixed(1)} / ${footprint.craterDepthM.toFixed(1)} m`:'—',
      'IMPACTO LOCAL · Core / Blast / Impulso / Reação':footprint?`${footprint.coreDestructionRadiusM.toFixed(0)} / ${footprint.blastDamageRadiusM.toFixed(0)} / ${footprint.impulseRadiusM.toFixed(0)} / ${footprint.reactionRadiusM.toFixed(0)} m`:'—',
      'IMPACTO LOCAL · Consultados / Prédios / Árvores / Props / Lâmpadas / Carros':localImpact?`${localImpact.queried} / ${localImpact.buildings} / ${localImpact.trees} / ${localImpact.props} / ${localImpact.lamps} / ${localImpact.vehicles}`:'—',
      'IMPACTO LOCAL · NPCs / Pendentes':`${localImpact?.npcAffected??0} / ${this.destruction.pendingCount}`,
      'CONTATO CELESTE · Vel / Radial':contact?`${contact.relativeSpeedMps.toFixed(0)} / ${contact.radialSpeedMps.toFixed(0)} m/s → ${contact.responseRadialSpeedMps.toFixed(2)} / ${contact.responseTangentialSpeedMps.toFixed(2)}`:'—',
      'Lua · Pouso':`${moon.blockedReason} · ${moon.altitudeM.toFixed(0)} m sobre terreno · ${moon.relativeSpeedMps.toFixed(0)} m/s relativos`,
      'Lua · Gates':`retorno ≤ ${moon.returnAltitudeM} m sobre terreno / ${moon.maxRelativeSpeedMps} m/s · superfície ${moon.surfaceReady?'pronta':'aguardando'} (${moon.missingLandingTiles} tiles faltando)`,
      'Lua · Representação':`${moon.representation} · proxy ${moon.proxyOpacity.toFixed(2)} / globo ${moon.globeOpacity.toFixed(2)} · fallback ${moon.fallbackActive?'ativo':'off'} · ${moon.activeTiles} tiles`,
      ...(this.earth?{'Planeta · Globo':`${this.earth.stats.tiles} tiles · ${this.earth.stats.triangles.toLocaleString()} tri · ${this.earth.stats.visible?'visível':'oculto'}`}:{}),
    };
  }

  private sample(){const info=this.rendering.renderer.info,stats=this.streamer.stats;this.frame={fps:Math.round(1000/this.quality.averageMs),cpu:Number(this.cpu.toFixed(2)),drawCalls:info.render.drawCalls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,active:stats.active,cached:stats.cached,queued:stats.queued,loadedMB:stats.loadedMB+info.memory.total/1048576,streamMs:stats.streamMs,x:this.player.position.x,z:this.player.position.z};}
}
