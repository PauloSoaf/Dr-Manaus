import { UniversalTargetCatalog, SOLAR_TARGET_ADDRESS } from '../travel/UniversalTargetCatalog';
import {
  type UniversalTargetDescriptor,
  type UniversalNavigationTarget,
  type UniversalTargetKind,
  createUniversalTarget,
  universalTargetKey,
  isUniverseAddress,
} from '../travel/UniversalNavigationTarget';
import { UniversalTargetResolver } from '../travel/UniversalTargetResolver';
import { ProceduralGalaxyDiscovery, DEFAULT_UNIVERSE_SEED } from '../galaxy/ProceduralGalaxyDiscovery';
import { LOCAL_GROUP_CATALOG, isCanonicalGalaxyId } from '../celestial/GalaxyDefinition';
import { SOLAR_BODY_PROFILES } from '../celestial/CelestialBodyProfile';
import { SaveManager } from '../../core/SaveManager';
import { formatDistance, formatGalaxyName } from '../../ui/format';
import { describeNavigationGuidance, type NavigationReadinessState } from '../travel/NavigationGuidance';
import type { UniverseLocation } from '../spatial/UniverseLocation';

export type AtlasGalaxyMorphology = 'spiral' | 'barred-spiral' | 'elliptical' | 'irregular' | 'unknown';

export function isCanonicalTarget(desc: UniversalTargetDescriptor): boolean {
  if (desc.kind === 'galaxy') {
    return isCanonicalGalaxyId(desc.objectId);
  }
  if (desc.kind === 'system') {
    return desc.objectId === 'sol' && (desc.galaxyId === 'milky_way' || desc.galaxyId === undefined);
  }
  if (desc.kind === 'body' || desc.kind === 'star') {
    const bodyId = desc.bodyId ?? desc.objectId;
    const isSolarGalaxy = desc.galaxyId === 'milky_way' || desc.galaxyId === undefined;
    const isSolarSystem = desc.systemId === 'sol';
    const isAddressSolar = !desc.address || !('galaxyId' in desc.address) || desc.address.galaxyId === 'milky_way';
    return isSolarGalaxy && isSolarSystem && isAddressSolar && (bodyId in SOLAR_BODY_PROFILES || bodyId === 'sun');
  }
  if (desc.kind === 'black-hole') {
    const isLocalGroup = desc.galaxyId === 'milky_way' || desc.galaxyId === 'andromeda' || desc.galaxyId === undefined;
    return isLocalGroup && (desc.objectId === 'sgra' || desc.objectId === 'sagittarius-a-star' || desc.objectId === 'm31_smbh');
  }
  if (desc.kind === 'cosmic-anchor' || desc.kind === 'cluster' || desc.kind === 'observable-horizon') {
    return true;
  }
  return false;
}

export interface CosmicAtlasEntry {
  readonly key: string;
  readonly descriptor: UniversalTargetDescriptor;
  readonly target: UniversalNavigationTarget;
  readonly displayName: string;
  readonly kind: UniversalTargetKind;
  readonly objectId: string;
  readonly galaxyId?: string;
  readonly systemId?: string;
  readonly bodyId?: string;
  readonly isCanonical: boolean;
  readonly morphology?: string;
  readonly family?: string;
  readonly diameterLy?: number;
  readonly estimatedStarCount?: number;
  readonly distanceM?: number;
  readonly distanceFormatted: string;
  readonly visited: boolean;
  readonly favorite: boolean;
  readonly readinessState: NavigationReadinessState;
  readonly guidanceStatus: string;
  readonly shortcutHint: string;
  readonly canTravel: boolean;
  readonly worldType?: string;
  readonly canLand?: boolean;
  readonly landingMode?: 'none' | 'surface' | 'photosphere';
  readonly temperatureK?: number;
  readonly hasRings?: boolean;
  readonly biosphere?: import('../life/PlanetaryBiosphere').PlanetaryBiosphereProfile;
}

export interface ExplorationHistoryEvent {
  readonly timestampS: number;
  readonly type: 'arrival' | 'discovery' | 'favorite_added' | 'favorite_removed';
  readonly targetKey: string;
  readonly displayName: string;
  readonly details?: string;
}

export interface CosmicAtlasFilterOptions {
  readonly query?: string;
  readonly kind?: 'all' | UniversalTargetKind;
  readonly statusFilter?: 'all' | 'favorites' | 'visited' | 'flyable';
  readonly morphology?: 'all' | AtlasGalaxyMorphology;
  readonly sort?: 'name' | 'distance' | 'stars' | 'diameter';
  readonly sortDirection?: 'asc' | 'desc';
  readonly offset?: number;
  readonly limit?: number;
}

export interface CosmicAtlasStatistics {
  readonly totalKnown: number;
  readonly totalGalaxies: number;
  readonly proceduralGalaxies: number;
  readonly canonicalGalaxies: number;
  readonly totalSystems: number;
  readonly visitedCount: number;
  readonly favoritesCount: number;
  readonly flyableCount: number;
}

export interface CosmicAtlasQueryResult {
  readonly entries: readonly CosmicAtlasEntry[];
  readonly totalCount: number;
  readonly hasMore: boolean;
  readonly statistics: CosmicAtlasStatistics;
}

export class CosmicAtlasModel {
  private readonly discoveredGalaxies = new Map<string, UniversalTargetDescriptor>();
  private readonly identifiedSystems = new Map<string, UniversalTargetDescriptor>();
  private readonly discoveredBodies = new Map<string, UniversalTargetDescriptor>();
  private readonly visitedTargets = new Set<string>();
  private readonly favoriteKeys = new Set<string>();
  private readonly history: ExplorationHistoryEvent[] = [];
  private readonly bodyMetadataCache = new Map<string, {
    worldType?: string;
    canLand?: boolean;
    landingMode?: 'none' | 'surface' | 'photosphere';
    temperatureK?: number;
    hasRings?: boolean;
    biosphere?: import('../life/PlanetaryBiosphere').PlanetaryBiosphereProfile;
  }>();
  private cachedTargetMap: Map<string, UniversalTargetDescriptor> | null = null;

  constructor(
    readonly catalog: UniversalTargetCatalog,
    readonly save?: SaveManager,
    readonly discovery?: ProceduralGalaxyDiscovery,
    private resolver?: UniversalTargetResolver,
  ) {
    this.discovery ??= catalog.discovery;

    // Load initial state from SaveManager
    if (save) {
      if (Array.isArray(save.data.favorites)) {
        for (const fav of save.data.favorites) {
          if (typeof fav === 'string' && fav.length > 0) this.favoriteKeys.add(fav);
        }
      }
      if (Array.isArray(save.data.visitedTargets)) {
        for (const v of save.data.visitedTargets) {
          if (typeof v === 'string' && v.length > 0) this.visitedTargets.add(v);
        }
      }
      if (Array.isArray(save.data.discoveredTargets)) {
        const uniqueKeys = Array.from(new Set(save.data.discoveredTargets.filter((k): k is string => typeof k === 'string' && k.length > 0)));
        const systemKeys: string[] = [];
        const otherKeys: string[] = [];
        for (const k of uniqueKeys) {
          if (k.includes('/system/') && !k.includes('/body/') && !k.includes('/star/')) {
            systemKeys.push(k);
          } else {
            otherKeys.push(k);
          }
        }
        for (const k of systemKeys) {
          const desc = catalog.find(k);
          if (desc && desc.kind === 'system') {
            this.identifiedSystems.set(universalTargetKey(desc), desc);
          }
        }
        for (const k of otherKeys) {
          const desc = catalog.find(k);
          if (desc) {
            const kKey = universalTargetKey(desc);
            if (desc.kind === 'galaxy') this.discoveredGalaxies.set(kKey, desc);
            else if (desc.kind === 'system') this.identifiedSystems.set(kKey, desc);
            else if (desc.kind === 'body' || desc.kind === 'star') this.discoveredBodies.set(kKey, desc);
          }
        }
      }
    }

    // Baseline presence: Sol, Earth, and Milky Way are starting visited locations
    const defaultVisited = [
      'galaxy/milky_way',
      'universe/milky_way/0,0,0/system/sol',
      'universe/milky_way/0,0,0/system/sol/body/earth',
    ];
    for (const key of defaultVisited) {
      this.visitedTargets.add(key);
      if (save && !save.isVisited(key)) save.markVisited(key);
    }

    // Populate catalog descriptors
    for (const desc of catalog.descriptors) {
      const key = universalTargetKey(desc);
      if (desc.kind === 'galaxy') {
        this.discoveredGalaxies.set(key, desc);
      } else if (desc.kind === 'system') {
        this.identifiedSystems.set(key, desc);
      }
    }

    // Populate Local Group canonical galaxies
    for (const g of LOCAL_GROUP_CATALOG) {
      const desc: UniversalTargetDescriptor = {
        kind: 'galaxy',
        displayName: g.name ?? (g.id === 'milky_way' ? 'Milky Way' : 'Andromeda'),
        objectId: g.id,
        galaxyId: g.id,
      };
      const key = universalTargetKey(desc);
      this.discoveredGalaxies.set(key, desc);
    }
  }

  setResolver(resolver: UniversalTargetResolver): void {
    this.resolver = resolver;
  }

  isFavorite(key: string): boolean {
    return this.favoriteKeys.has(key);
  }

  toggleFavorite(key: string, timeS = 0): boolean {
    const isFav = this.favoriteKeys.has(key);
    let active = false;
    let displayName = key;

    const desc = this.catalog.find(key);
    if (desc) displayName = desc.displayName;

    if (isFav) {
      this.favoriteKeys.delete(key);
      active = false;
      this.addHistory({
        timestampS: timeS,
        type: 'favorite_removed',
        targetKey: key,
        displayName,
      });
    } else {
      this.favoriteKeys.add(key);
      active = true;
      this.addHistory({
        timestampS: timeS,
        type: 'favorite_added',
        targetKey: key,
        displayName,
      });
    }

    this.cachedTargetMap = null;
    if (this.save) {
      this.save.toggleFavorite(key);
    }

    return active;
  }

  isVisited(key: string): boolean {
    return this.visitedTargets.has(key);
  }

  markVisited(key: string, timeS = 0): boolean {
    if (this.visitedTargets.has(key)) return false;
    this.visitedTargets.add(key);
    this.cachedTargetMap = null;

    let displayName = key;
    const desc = this.catalog.find(key);
    if (desc) displayName = desc.displayName;

    this.addHistory({
      timestampS: timeS,
      type: 'arrival',
      targetKey: key,
      displayName,
    });

    if (this.save) {
      this.save.markVisited(key);
    }
    return true;
  }

  recordArrival(location: UniverseLocation, timeS = 0): void {
    const doArrival = () => {
      const a = location.address;
      if (!a) return;

      if (a.galaxyId && a.galaxyId !== 'cosmology') {
        const galaxyKey = `galaxy/${encodeURIComponent(a.galaxyId)}`;
        this.markVisited(galaxyKey, timeS);
      }

      if (a.galaxyId && a.sector && a.systemId) {
        const sectorStr = `${a.sector.x},${a.sector.y},${a.sector.z}`;
        const systemKey = `universe/${encodeURIComponent(a.galaxyId)}/${sectorStr}/system/${encodeURIComponent(a.systemId)}`;
        this.markVisited(systemKey, timeS);

        // Register procedural system & contained bodies when arriving at a procedural system
        if (a.systemId !== 'sol') {
          const sysTarget = this.catalog.proceduralTarget(a.galaxyId, a.sector, a.systemId, 'system');
          if (sysTarget) {
            this.recordDiscovery(sysTarget, timeS);
          }
        }

        if (a.bodyId) {
          const kind = a.bodyId === 'sun' || a.bodyId === a.systemId ? 'star' : 'body';
          const bodyKey = `${systemKey}/${kind}/${encodeURIComponent(a.bodyId)}`;
          this.markVisited(bodyKey, timeS);
        }
      }
    };

    if (this.save) {
      this.save.batch(doArrival);
    } else {
      doArrival();
    }
  }

  recordDiscovery(descriptor: UniversalTargetDescriptor, timeS = 0): void {
    const doDiscovery = () => {
      this.cachedTargetMap = null;
      const key = universalTargetKey(descriptor);
      if (descriptor.kind === 'galaxy') {
        if (!this.discoveredGalaxies.has(key)) {
          this.discoveredGalaxies.set(key, descriptor);
          this.addHistory({
            timestampS: timeS,
            type: 'discovery',
            targetKey: key,
            displayName: descriptor.displayName,
            details: 'Galáxia descoberta',
          });
          if (this.save) this.save.discoverTarget(key);
        }
      } else if (descriptor.kind === 'system') {
        if (!this.identifiedSystems.has(key)) {
          this.identifiedSystems.set(key, descriptor);
          this.addHistory({
            timestampS: timeS,
            type: 'discovery',
            targetKey: key,
            displayName: descriptor.displayName,
            details: 'Sistema identificado',
          });
          if (this.save) this.save.discoverTarget(key);
        }

        // Automatically register the system's contained bodies in discoveredBodies in bulk
        if (descriptor.address && 'sector' in descriptor.address && descriptor.address.systemId) {
          const p = this.catalog.proceduralDescriptor(
            descriptor.address.galaxyId,
            descriptor.address.sector,
            descriptor.address.systemId,
          );
          if (p) {
            const bodyKeys: string[] = [];
            for (const body of p.system.bodies) {
              const bodyKind = body.id === p.star.id ? 'star' : 'body';
              const bodyTarget = this.catalog.proceduralTarget(
                descriptor.address.galaxyId,
                descriptor.address.sector,
                descriptor.address.systemId,
                bodyKind,
                body.id,
              );
              if (bodyTarget) {
                const bKey = universalTargetKey(bodyTarget);
                if (!this.discoveredBodies.has(bKey)) {
                  this.discoveredBodies.set(bKey, bodyTarget);
                  bodyKeys.push(bKey);
                }
                if (body.profile) {
                  this.bodyMetadataCache.set(bKey, {
                    worldType: body.profile.environment?.label ?? body.profile.bodyClass,
                    canLand: body.profile.canLand,
                    landingMode: body.profile.landingMode,
                    temperatureK: body.profile.environment?.temperatureK,
                    hasRings: !!body.profile.visual.rings || !!body.profile.environment?.hasRings,
                    biosphere: body.profile.environment?.biosphere,
                  });
                }
              }
            }
            if (this.save && bodyKeys.length > 0) {
              this.save.discoverTargets(bodyKeys);
            }
          }
        }
      } else if (descriptor.kind === 'body' || descriptor.kind === 'star') {
        if (!this.discoveredBodies.has(key)) {
          this.discoveredBodies.set(key, descriptor);
          this.addHistory({
            timestampS: timeS,
            type: 'discovery',
            targetKey: key,
            displayName: descriptor.displayName,
            details: descriptor.kind === 'star' ? 'Estrela descoberta' : 'Corpo celeste descoberto',
          });
          if (this.save) this.save.discoverTarget(key);
        }
      }
    };

    if (this.save) {
      this.save.batch(doDiscovery);
    } else {
      doDiscovery();
    }
  }

  private addHistory(event: ExplorationHistoryEvent): void {
    this.history.unshift(event);
    if (this.history.length > 120) {
      this.history.pop();
    }
  }

  getHistory(): readonly ExplorationHistoryEvent[] {
    return this.history;
  }

  private getBodyMetadata(desc: UniversalTargetDescriptor): {
    worldType?: string;
    canLand?: boolean;
    landingMode?: 'none' | 'surface' | 'photosphere';
    temperatureK?: number;
    hasRings?: boolean;
    biosphere?: import('../life/PlanetaryBiosphere').PlanetaryBiosphereProfile;
  } {
    const key = universalTargetKey(desc);
    const cached = this.bodyMetadataCache.get(key);
    if (cached) return cached;

    let worldType: string | undefined;
    let canLandBody: boolean | undefined;
    let landingModeBody: 'none' | 'surface' | 'photosphere' | undefined;
    let temperatureK: number | undefined;
    let hasRings: boolean | undefined;
    let biosphere: import('../life/PlanetaryBiosphere').PlanetaryBiosphereProfile | undefined;

    const solar = desc.bodyId ? SOLAR_BODY_PROFILES[desc.bodyId] : (desc.objectId in SOLAR_BODY_PROFILES ? SOLAR_BODY_PROFILES[desc.objectId] : undefined);
    if (solar) {
      worldType = solar.environment?.label ?? solar.bodyClass;
      canLandBody = solar.canLand;
      landingModeBody = solar.landingMode;
      temperatureK = solar.environment?.temperatureK;
      hasRings = !!solar.visual.rings || !!solar.environment?.hasRings;
      biosphere = solar.environment?.biosphere;
    } else if (desc.address && 'sector' in desc.address && desc.address.systemId) {
      const p = this.catalog.proceduralDescriptor(desc.address.galaxyId, desc.address.sector, desc.address.systemId);
      const cand = p?.system.bodies.find(b => b.id === (desc.bodyId ?? desc.objectId));
      if (cand?.profile) {
        worldType = cand.profile.environment?.label ?? cand.profile.bodyClass;
        canLandBody = cand.profile.canLand;
        landingModeBody = cand.profile.landingMode;
        temperatureK = cand.profile.environment?.temperatureK;
        hasRings = !!cand.profile.visual.rings || !!cand.profile.environment?.hasRings;
        biosphere = cand.profile.environment?.biosphere;
      }
    }

    const meta = {
      worldType,
      canLand: canLandBody,
      landingMode: landingModeBody,
      temperatureK,
      hasRings,
      biosphere,
    };
    this.bodyMetadataCache.set(key, meta);
    return meta;
  }

  private collectTargetMap(): Map<string, UniversalTargetDescriptor> {
    if (this.cachedTargetMap) {
      return this.cachedTargetMap;
    }
    const targetMap = new Map<string, UniversalTargetDescriptor>();
    for (const [k, d] of this.discoveredGalaxies) targetMap.set(k, d);
    for (const [k, d] of this.identifiedSystems) targetMap.set(k, d);
    for (const [k, d] of this.discoveredBodies) targetMap.set(k, d);
    for (const d of this.catalog.descriptors) targetMap.set(universalTargetKey(d), d);
    for (const favKey of this.favoriteKeys) {
      if (!targetMap.has(favKey)) {
        const d = this.catalog.find(favKey);
        if (d) targetMap.set(universalTargetKey(d), d);
      }
    }
    this.cachedTargetMap = targetMap;
    return targetMap;
  }

  private computeStatistics(
    targetMap: Map<string, UniversalTargetDescriptor>,
    currentGalaxyId?: string,
  ): CosmicAtlasStatistics {
    let proceduralCount = 0;
    let canonicalCount = 0;
    let galaxyCount = 0;
    let systemCount = 0;
    let flyableCount = 0;
    const seed = this.discovery?.universeSeed ?? DEFAULT_UNIVERSE_SEED;

    for (const desc of targetMap.values()) {
      const isCanonical = isCanonicalTarget(desc);
      if (desc.kind === 'galaxy') {
        galaxyCount++;
        if (isCanonical) canonicalCount++;
        else proceduralCount++;
      } else if (desc.kind === 'system') {
        systemCount++;
      }

      let canTravel = false;
      if (this.resolver) {
        try {
          const target = createUniversalTarget(desc);
          const resolved = this.resolver.resolve(target);
          const guidance = describeNavigationGuidance(
            resolved.travelCapability,
            target.kind,
            target.galaxyId,
            currentGalaxyId,
            seed,
          );
          canTravel = guidance.available;
        } catch {
          canTravel = false;
        }
      } else {
        const capability = desc.kind === 'galaxy' && desc.galaxyId !== currentGalaxyId
          ? 'intergalactic'
          : desc.kind === 'system'
            ? 'interstellar'
            : 'intra-system';
        const guidance = describeNavigationGuidance(
          capability,
          desc.kind,
          desc.galaxyId,
          currentGalaxyId,
          seed,
        );
        canTravel = guidance.available;
      }

      if (canTravel) flyableCount++;
    }

    return {
      totalKnown: targetMap.size,
      totalGalaxies: galaxyCount,
      proceduralGalaxies: proceduralCount,
      canonicalGalaxies: canonicalCount,
      totalSystems: systemCount,
      visitedCount: this.visitedTargets.size,
      favoritesCount: this.favoriteKeys.size,
      flyableCount,
    };
  }

  getStatistics(currentGalaxyId?: string): CosmicAtlasStatistics {
    const targetMap = this.collectTargetMap();
    return this.computeStatistics(targetMap, currentGalaxyId);
  }

  invalidateCache(): void {
    this.cachedTargetMap = null;
    this.bodyMetadataCache.clear();
  }

  query(options: CosmicAtlasFilterOptions = {}, currentGalaxyId?: string): CosmicAtlasQueryResult {
    const rawQuery = options.query?.trim() ?? '';
    const query = rawQuery.startsWith('drm:v1://') ? rawQuery.slice(9) : rawQuery;
    const kindFilter = options.kind ?? 'all';
    const statusFilter = options.statusFilter ?? 'all';
    const morphologyFilter = options.morphology ?? 'all';
    const sortField = options.sort ?? 'name';
    const sortDir = options.sortDirection ?? 'asc';
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.max(1, Math.min(100, options.limit ?? 30));

    // Coordinate query recognition (c:x,y,z or cell:x,y,z or x,y,z)
    const coordMatch = /^(?:c:?|cell:?)?\s*(-?\d+)[,_\s]+(-?\d+)[,_\s]+(-?\d+)$/i.exec(query);
    let targetCell: { x: bigint; y: bigint; z: bigint } | undefined;
    if (coordMatch) {
      try {
        targetCell = {
          x: BigInt(coordMatch[1]),
          y: BigInt(coordMatch[2]),
          z: BigInt(coordMatch[3]),
        };
      } catch {
        targetCell = undefined;
      }
    }

    // Dynamic discovery on query string
    const queryDiscoveredKeys = new Set<string>();
    if (query.length >= 2 && this.discovery) {
      const discovered = this.discovery.search(query, { x: 0n, y: 0n, z: 0n }, 32);
      let newlyDiscovered = false;
      for (const g of discovered) {
        const desc: UniversalTargetDescriptor = {
          kind: 'galaxy',
          displayName: g.name,
          objectId: g.id,
          galaxyId: g.id,
        };
        const key = universalTargetKey(desc);
        queryDiscoveredKeys.add(key);
        if (!this.discoveredGalaxies.has(key)) {
          this.discoveredGalaxies.set(key, desc);
          newlyDiscovered = true;
        }
      }
      if (newlyDiscovered) {
        this.cachedTargetMap = null;
      }
    }

    // Collect all candidate target descriptors
    const targetMap = this.collectTargetMap();

    // Prepare search terms once outside the loop
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const hasQuery = query.length > 0;
    const nq = hasQuery ? normalize(query) : '';
    const q = hasQuery ? query.toLowerCase() : '';
    const seed = this.discovery?.universeSeed ?? DEFAULT_UNIVERSE_SEED;

    // Statistics accumulators (evaluated in the single loop)
    let proceduralGalaxies = 0;
    let canonicalGalaxies = 0;
    let totalGalaxies = 0;
    let totalSystems = 0;
    let flyableCount = 0;

    const allEntries: CosmicAtlasEntry[] = [];

    for (const desc of targetMap.values()) {
      const isCanonical = isCanonicalTarget(desc);
      if (desc.kind === 'galaxy') {
        totalGalaxies++;
        if (isCanonical) canonicalGalaxies++;
        else proceduralGalaxies++;
      } else if (desc.kind === 'system') {
        totalSystems++;
      }

      const key = universalTargetKey(desc);
      const visited = this.visitedTargets.has(key);
      const favorite = this.favoriteKeys.has(key);

      // Resolve navigation / distance / guidance once per target
      let distanceM: number | undefined;
      let readinessState: NavigationReadinessState = 'unavailable';
      let guidanceStatus = 'Indisponível';
      let shortcutHint = 'Nenhum atalho';
      let canTravel = false;

      const target = createUniversalTarget(desc);

      if (this.resolver) {
        try {
          const resolved = this.resolver.resolve(target);
          distanceM = resolved.distanceM;
          const guidance = describeNavigationGuidance(
            resolved.travelCapability,
            target.kind,
            target.galaxyId,
            currentGalaxyId,
            seed,
          );
          readinessState = guidance.readinessState;
          guidanceStatus = guidance.status;
          shortcutHint = guidance.shortcutHint;
          canTravel = guidance.available;
        } catch {
          // Keep defaults
        }
      } else {
        const capability = desc.kind === 'galaxy' && desc.galaxyId !== currentGalaxyId
          ? 'intergalactic'
          : desc.kind === 'system'
            ? 'interstellar'
            : 'intra-system';
        const guidance = describeNavigationGuidance(
          capability,
          desc.kind,
          desc.galaxyId,
          currentGalaxyId,
          seed,
        );
        readinessState = guidance.readinessState;
        guidanceStatus = guidance.status;
        shortcutHint = guidance.shortcutHint;
        canTravel = guidance.available;
      }

      if (canTravel) {
        flyableCount++;
      }

      // Early rejection filters
      if (kindFilter !== 'all' && desc.kind !== kindFilter) {
        continue;
      }
      if (statusFilter === 'favorites' && !favorite) continue;
      if (statusFilter === 'visited' && !visited) continue;
      if (statusFilter === 'flyable' && !canTravel) continue;

      const galaxyMeta = desc.galaxyId && this.discovery ? this.discovery.findGalaxyById(desc.galaxyId) : undefined;
      const morphology = galaxyMeta?.morphology ?? (desc.kind === 'galaxy' ? 'spiral' : undefined);
      const family = galaxyMeta?.family;

      if (morphologyFilter !== 'all') {
        const morph = (family ?? morphology ?? '').toLowerCase();
        if (!morph.includes(morphologyFilter.toLowerCase())) continue;
      }

      // Body metadata retrieval (cached)
      let worldType: string | undefined;
      let canLandBody: boolean | undefined;
      let landingModeBody: 'none' | 'surface' | 'photosphere' | undefined;
      let temperatureK: number | undefined;
      let hasRings: boolean | undefined;
      let biosphere: import('../life/PlanetaryBiosphere').PlanetaryBiosphereProfile | undefined;

      if (desc.kind === 'body' || desc.kind === 'star') {
        const meta = this.getBodyMetadata(desc);
        worldType = meta.worldType;
        canLandBody = meta.canLand;
        landingModeBody = meta.landingMode;
        temperatureK = meta.temperatureK;
        hasRings = meta.hasRings;
        biosphere = meta.biosphere;
      }

      // Query filter with short-circuit evaluation
      if (hasQuery) {
        let matches = false;
        if (queryDiscoveredKeys.has(key)) {
          matches = true;
        } else if (normalize(desc.displayName).includes(nq)) {
          matches = true;
        } else if (desc.objectId.toLowerCase().includes(q)) {
          matches = true;
        } else if (desc.galaxyId !== undefined && desc.galaxyId.toLowerCase().includes(q)) {
          matches = true;
        } else if (key.toLowerCase().includes(q)) {
          matches = true;
        } else if (worldType !== undefined && normalize(worldType).includes(nq)) {
          matches = true;
        } else if (targetCell !== undefined) {
          if (galaxyMeta && galaxyMeta.cell.x === targetCell.x && galaxyMeta.cell.y === targetCell.y && galaxyMeta.cell.z === targetCell.z) {
            matches = true;
          } else if (desc.address && 'cell' in desc.address) {
            const c = desc.address.cell;
            if (c.x === targetCell.x && c.y === targetCell.y && c.z === targetCell.z) {
              matches = true;
            }
          } else if (desc.address && 'sector' in desc.address) {
            const s = desc.address.sector;
            if (s.x === targetCell.x && s.y === targetCell.y && s.z === targetCell.z) {
              matches = true;
            }
          }
        }

        if (!matches) {
          continue;
        }
      }

      const isRuptured = Boolean(desc.bodyId && this.save?.isBodyRuptured(desc.bodyId));
      const effectiveDisplayName = isRuptured
        ? `${desc.displayName} [MUNDO EM RUÍNAS - CINTURÃO DE DESTROÇOS]`
        : desc.displayName;
      const effectiveWorldType = isRuptured
        ? 'Cinturão de Destroços Cósmicos (Mundo Rupturado)'
        : worldType;
      const effectiveCanLand = isRuptured ? false : canLandBody;
      const effectiveLandingMode = isRuptured ? 'none' : landingModeBody;

      const entry: CosmicAtlasEntry = {
        key,
        descriptor: desc,
        target,
        displayName: effectiveDisplayName,
        kind: desc.kind,
        objectId: desc.objectId,
        galaxyId: desc.galaxyId,
        systemId: desc.systemId,
        bodyId: desc.bodyId,
        isCanonical,
        morphology,
        family,
        diameterLy: galaxyMeta?.diameterLy,
        estimatedStarCount: galaxyMeta?.estimatedStarCount,
        distanceM,
        distanceFormatted: distanceM === undefined ? '—' : formatDistance(distanceM),
        visited,
        favorite,
        readinessState,
        guidanceStatus,
        shortcutHint,
        canTravel,
        worldType: effectiveWorldType,
        canLand: effectiveCanLand,
        landingMode: effectiveLandingMode,
        temperatureK,
        hasRings,
        biosphere,
      };

      allEntries.push(entry);
    }

    const statistics: CosmicAtlasStatistics = {
      totalKnown: targetMap.size,
      totalGalaxies,
      proceduralGalaxies,
      canonicalGalaxies,
      totalSystems,
      visitedCount: this.visitedTargets.size,
      favoritesCount: this.favoriteKeys.size,
      flyableCount,
    };

    // Sort entries
    allEntries.sort((a, b) => {
      // Primary: Favorite targets pin to top unless explicit sort chosen
      if (options.sort === undefined) {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        if (a.visited !== b.visited) return a.visited ? -1 : 1;
      }

      let diff = 0;
      if (sortField === 'distance') {
        const da = a.distanceM ?? Number.POSITIVE_INFINITY;
        const db = b.distanceM ?? Number.POSITIVE_INFINITY;
        diff = da - db;
      } else if (sortField === 'stars') {
        const sa = a.estimatedStarCount ?? 0;
        const sb = b.estimatedStarCount ?? 0;
        diff = sb - sa;
      } else if (sortField === 'diameter') {
        const da = a.diameterLy ?? 0;
        const db = b.diameterLy ?? 0;
        diff = db - da;
      } else {
        // Name
        diff = a.displayName.localeCompare(b.displayName);
      }

      return sortDir === 'desc' ? -diff : diff;
    });

    const totalCount = allEntries.length;
    const sliced = allEntries.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return {
      entries: Object.freeze(sliced),
      totalCount,
      hasMore,
      statistics,
    };
  }

  exportState(): {
    favorites: string[];
    visited: string[];
    discoveredGalaxies: string[];
    identifiedSystems: string[];
    discoveredBodies: string[];
  } {
    return {
      favorites: [...this.favoriteKeys],
      visited: [...this.visitedTargets],
      discoveredGalaxies: [...this.discoveredGalaxies.keys()],
      identifiedSystems: [...this.identifiedSystems.keys()],
      discoveredBodies: [...this.discoveredBodies.keys()],
    };
  }

  importState(data: {
    favorites?: string[];
    visited?: string[];
    discoveredGalaxies?: string[];
    identifiedSystems?: string[];
    discoveredBodies?: string[];
  }): void {
    this.cachedTargetMap = null;
    this.bodyMetadataCache.clear();
    if (Array.isArray(data.favorites)) {
      this.favoriteKeys.clear();
      for (const k of data.favorites) if (typeof k === 'string') this.favoriteKeys.add(k);
    }
    if (Array.isArray(data.visited)) {
      for (const k of data.visited) if (typeof k === 'string') this.visitedTargets.add(k);
    }
    if (Array.isArray(data.discoveredGalaxies)) {
      const unique = Array.from(new Set(data.discoveredGalaxies.filter((k): k is string => typeof k === 'string')));
      for (const k of unique) {
        const desc = this.catalog.find(k);
        if (desc && desc.kind === 'galaxy') this.discoveredGalaxies.set(universalTargetKey(desc), desc);
      }
    }
    if (Array.isArray(data.identifiedSystems)) {
      const unique = Array.from(new Set(data.identifiedSystems.filter((k): k is string => typeof k === 'string')));
      for (const k of unique) {
        const desc = this.catalog.find(k);
        if (desc && desc.kind === 'system') this.identifiedSystems.set(universalTargetKey(desc), desc);
      }
    }
    if (Array.isArray(data.discoveredBodies)) {
      const unique = Array.from(new Set(data.discoveredBodies.filter((k): k is string => typeof k === 'string')));
      for (const k of unique) {
        const desc = this.catalog.find(k);
        if (desc && (desc.kind === 'body' || desc.kind === 'star')) {
          this.discoveredBodies.set(universalTargetKey(desc), desc);
        }
      }
    }
  }
}

