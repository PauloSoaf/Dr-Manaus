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
import { SaveManager } from '../../core/SaveManager';
import { formatDistance, formatGalaxyName } from '../../ui/format';
import { describeNavigationGuidance, type NavigationReadinessState } from '../travel/NavigationGuidance';
import type { UniverseLocation } from '../spatial/UniverseLocation';

export type AtlasGalaxyMorphology = 'spiral' | 'barred-spiral' | 'elliptical' | 'irregular' | 'unknown';

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
  private readonly visitedTargets = new Set<string>();
  private readonly favoriteKeys = new Set<string>();
  private readonly history: ExplorationHistoryEvent[] = [];

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

      if (a.bodyId) {
        const kind = a.bodyId === 'sun' || a.bodyId === a.systemId ? 'star' : 'body';
        const bodyKey = `${systemKey}/${kind}/${encodeURIComponent(a.bodyId)}`;
        this.markVisited(bodyKey, timeS);
      }
    }
  }

  recordDiscovery(descriptor: UniversalTargetDescriptor, timeS = 0): void {
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
      }
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

  getStatistics(currentGalaxyId?: string): CosmicAtlasStatistics {
    let proceduralCount = 0;
    let canonicalCount = 0;
    let galaxyCount = 0;
    let systemCount = 0;

    for (const desc of this.discoveredGalaxies.values()) {
      galaxyCount++;
      const isCanonical = desc.galaxyId ? isCanonicalGalaxyId(desc.galaxyId) : true;
      if (isCanonical) canonicalCount++;
      else proceduralCount++;
    }

    systemCount = this.identifiedSystems.size;

    let flyableCount = 0;
    const seed = this.discovery?.universeSeed ?? DEFAULT_UNIVERSE_SEED;
    for (const desc of this.discoveredGalaxies.values()) {
      const guidance = describeNavigationGuidance(
        desc.galaxyId !== currentGalaxyId ? 'intergalactic' : 'intra-system',
        desc.kind,
        desc.galaxyId,
        currentGalaxyId,
        seed,
      );
      if (guidance.available) flyableCount++;
    }

    return {
      totalKnown: this.discoveredGalaxies.size + this.identifiedSystems.size + this.catalog.descriptors.length,
      totalGalaxies: galaxyCount,
      proceduralGalaxies: proceduralCount,
      canonicalGalaxies: canonicalCount,
      totalSystems: systemCount,
      visitedCount: this.visitedTargets.size,
      favoritesCount: this.favoriteKeys.size,
      flyableCount,
    };
  }

  query(options: CosmicAtlasFilterOptions = {}, currentGalaxyId?: string): CosmicAtlasQueryResult {
    const query = options.query?.trim() ?? '';
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
        }
      }
    }

    // Collect all candidate target descriptors
    const targetMap = new Map<string, UniversalTargetDescriptor>();

    for (const [k, d] of this.discoveredGalaxies) targetMap.set(k, d);
    for (const [k, d] of this.identifiedSystems) targetMap.set(k, d);
    for (const d of this.catalog.descriptors) targetMap.set(universalTargetKey(d), d);

    // If favorite is not in targetMap, look it up in catalog
    for (const favKey of this.favoriteKeys) {
      if (!targetMap.has(favKey)) {
        const d = this.catalog.find(favKey);
        if (d) targetMap.set(universalTargetKey(d), d);
      }
    }

    // Build evaluated entries
    const allEntries: CosmicAtlasEntry[] = [];
    const seed = this.discovery?.universeSeed ?? DEFAULT_UNIVERSE_SEED;

    let proceduralCount = 0;
    let canonicalCount = 0;
    let galaxyCount = 0;
    let systemCount = 0;
    let flyableCount = 0;

    for (const desc of targetMap.values()) {
      const key = universalTargetKey(desc);
      const target = createUniversalTarget(desc);
      const isCanonical = desc.galaxyId ? isCanonicalGalaxyId(desc.galaxyId) : true;
      const galaxyMeta = desc.galaxyId && this.discovery ? this.discovery.findGalaxyById(desc.galaxyId) : undefined;

      if (desc.kind === 'galaxy') {
        galaxyCount++;
        if (isCanonical) canonicalCount++;
        else proceduralCount++;
      } else if (desc.kind === 'system') {
        systemCount++;
      }

      // Resolve navigation / distance / guidance
      let distanceM: number | undefined;
      let readinessState: NavigationReadinessState = 'unavailable';
      let guidanceStatus = 'Indisponível';
      let shortcutHint = 'Nenhum atalho';
      let canTravel = false;

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
        // Fallback guidance when resolver is not provided
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

      if (canTravel) flyableCount++;

      const visited = this.visitedTargets.has(key);
      const favorite = this.favoriteKeys.has(key);

      const entry: CosmicAtlasEntry = {
        key,
        descriptor: desc,
        target,
        displayName: desc.displayName,
        kind: desc.kind,
        objectId: desc.objectId,
        galaxyId: desc.galaxyId,
        systemId: desc.systemId,
        bodyId: desc.bodyId,
        isCanonical,
        morphology: galaxyMeta?.morphology ?? (desc.kind === 'galaxy' ? 'spiral' : undefined),
        family: galaxyMeta?.family,
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
      };

      // Filter: Query search
      if (query) {
        const q = query.toLowerCase();
        const matchesName = entry.displayName.toLowerCase().includes(q);
        const matchesId = entry.objectId.toLowerCase().includes(q);
        const matchesGalaxy = entry.galaxyId?.toLowerCase().includes(q) ?? false;
        const matchesKey = entry.key.toLowerCase().includes(q);
        const matchesDiscovered = queryDiscoveredKeys.has(entry.key);

        let matchesCoord = false;
        if (targetCell) {
          if (galaxyMeta && galaxyMeta.cell.x === targetCell.x && galaxyMeta.cell.y === targetCell.y && galaxyMeta.cell.z === targetCell.z) {
            matchesCoord = true;
          } else if (entry.descriptor.address && 'cell' in entry.descriptor.address) {
            const c = entry.descriptor.address.cell;
            if (c.x === targetCell.x && c.y === targetCell.y && c.z === targetCell.z) {
              matchesCoord = true;
            }
          } else if (entry.descriptor.address && 'sector' in entry.descriptor.address) {
            const s = entry.descriptor.address.sector;
            if (s.x === targetCell.x && s.y === targetCell.y && s.z === targetCell.z) {
              matchesCoord = true;
            }
          }
        }

        if (!matchesName && !matchesId && !matchesGalaxy && !matchesKey && !matchesDiscovered && !matchesCoord) {
          continue;
        }
      }

      // Filter: Kind
      if (kindFilter !== 'all' && entry.kind !== kindFilter) {
        continue;
      }

      // Filter: Status
      if (statusFilter === 'favorites' && !entry.favorite) continue;
      if (statusFilter === 'visited' && !entry.visited) continue;
      if (statusFilter === 'flyable' && !entry.canTravel) continue;

      // Filter: Morphology
      if (morphologyFilter !== 'all') {
        const morph = (entry.family ?? entry.morphology ?? '').toLowerCase();
        if (!morph.includes(morphologyFilter.toLowerCase())) continue;
      }

      allEntries.push(entry);
    }

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

    const statistics: CosmicAtlasStatistics = {
      totalKnown: targetMap.size,
      totalGalaxies: galaxyCount,
      proceduralGalaxies: proceduralCount,
      canonicalGalaxies: canonicalCount,
      totalSystems: systemCount,
      visitedCount: this.visitedTargets.size,
      favoritesCount: this.favoriteKeys.size,
      flyableCount,
    };

    return {
      entries: Object.freeze(sliced),
      totalCount,
      hasMore,
      statistics,
    };
  }

  exportState(): { favorites: string[]; visited: string[]; discoveredGalaxies: string[] } {
    return {
      favorites: [...this.favoriteKeys],
      visited: [...this.visitedTargets],
      discoveredGalaxies: [...this.discoveredGalaxies.keys()],
    };
  }

  importState(data: { favorites?: string[]; visited?: string[]; discoveredGalaxies?: string[] }): void {
    if (Array.isArray(data.favorites)) {
      this.favoriteKeys.clear();
      for (const k of data.favorites) if (typeof k === 'string') this.favoriteKeys.add(k);
    }
    if (Array.isArray(data.visited)) {
      for (const k of data.visited) if (typeof k === 'string') this.visitedTargets.add(k);
    }
    if (Array.isArray(data.discoveredGalaxies)) {
      for (const k of data.discoveredGalaxies) {
        if (typeof k === 'string') {
          const desc = this.catalog.find(k);
          if (desc && desc.kind === 'galaxy') this.discoveredGalaxies.set(universalTargetKey(desc), desc);
        }
      }
    }
  }
}

