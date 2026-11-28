import type { UniverseLocation, TeleportTarget } from '../../world/spatial/UniverseLocation';
import type { Vector3 } from 'three/webgpu';
import { UniverseCoordinates } from '../../world/spatial/UniverseCoordinates';
import { LOCAL_GROUP_CATALOG, isCanonicalGalaxyId } from '../../world/celestial/GalaxyDefinition';
import { SOLAR_BODY_PROFILES } from '../../world/celestial/CelestialBodyProfile';
import { formatGalaxyName } from '../format';
import {
  universalTargetKey,
  type UniversalTargetDescriptor,
} from '../../world/travel/UniversalNavigationTarget';
import type { UniversalTargetCatalog } from '../../world/travel/UniversalTargetCatalog';
import {
  describeNavigationGuidance,
  type NavigationGuidance,
} from '../../world/travel/NavigationGuidance';
import { DEFAULT_UNIVERSE_SEED } from '../../world/galaxy/ProceduralGalaxyDiscovery';

export type MapPrecision = 'measured' | 'approximate' | 'procedural' | 'gameplay-placeholder';

export type MapScaleTier =
  | 'surface'
  | 'planet'
  | 'system'
  | 'sector'
  | 'galaxy'
  | 'local-group'
  | 'cosmology'
  | 'atlas';

export interface BreadcrumbItem {
  readonly id: string;
  readonly label: string;
  readonly level: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology' | 'atlas';
  readonly targetKey?: string;
  readonly precision: MapPrecision;
  readonly active?: boolean;
}

export interface MapSearchResult {
  readonly label: string;
  readonly kind: string;
  readonly target: UniversalTargetDescriptor;
  readonly precision: MapPrecision;
  readonly availability: string;
  readonly guidance: NavigationGuidance;
  readonly isCanonical: boolean;
  readonly distanceM?: number;
}

export function isLocalGroupGalaxy(galaxyId: string | undefined): boolean {
  if (!galaxyId) return false;
  return LOCAL_GROUP_CATALOG.some(g => g.id === galaxyId);
}

export class MapNavigationModel {
  location: UniverseLocation;
  destination?: Vector3;
  /** Presentation focus only; never changes the player's location or navigation target. */
  systemFocusBodyId?: string;
  /** Presentation hover key in Cosmos/Galaxy maps. */
  hoveredTargetKey?: string;
  /** Presentation selected target key in Cosmos/Galaxy maps. */
  selectedTargetKey?: string;
  precision: MapPrecision = 'measured';

  constructor(initialLocation: UniverseLocation) {
    this.location = initialLocation;
    this.precision = this.evaluateLocationPrecision(initialLocation);
  }

  updateLocation(location: UniverseLocation): void {
    this.location = location;
    this.precision = this.evaluateLocationPrecision(location);
  }

  /**
   * Evaluates the physical precision of current authoritative navigationState.
   * - measured: solar geodetic or solar active system positions.
   * - approximate: local group interstellar/galactic positions.
   * - procedural: procedural stars/galaxies outside local group.
   * - gameplay-placeholder: non-celestial or fallback coordinates.
   */
  evaluateLocationPrecision(location: UniverseLocation): MapPrecision {
    const a = location.address;
    if (location.surface && a.bodyId && (a.galaxyId === 'milky_way' || !a.galaxyId)) {
      return 'measured';
    }
    if (a.galaxyId === 'milky_way' && a.systemId === 'sol') {
      return 'measured';
    }
    if (isLocalGroupGalaxy(a.galaxyId)) {
      return 'approximate';
    }
    if (location.cosmological) {
      return 'approximate';
    }
    if (a.galaxyId) {
      return 'procedural';
    }
    return 'gameplay-placeholder';
  }

  /**
   * Returns current active scale tier from map level and location.
   */
  getScaleTier(currentLevel?: string): MapScaleTier {
    if (currentLevel === 'atlas') return 'atlas';
    if (currentLevel === 'surface') return 'surface';
    if (currentLevel === 'planet') return 'planet';
    if (currentLevel === 'system') return 'system';
    if (currentLevel === 'galaxy') return 'galaxy';
    if (currentLevel === 'cosmology') {
      return isLocalGroupGalaxy(this.location.address.galaxyId) ? 'local-group' : 'cosmology';
    }
    return 'system';
  }

  /**
   * Deterministically resolves precision for any UniversalTargetDescriptor.
   */
  getPrecisionForTarget(target: UniversalTargetDescriptor): MapPrecision {
    if (target.kind === 'body' || target.kind === 'star') {
      const bId = target.bodyId ?? target.objectId;
      const isSolar = target.galaxyId === 'milky_way' || !target.galaxyId;
      if (isSolar && (bId in SOLAR_BODY_PROFILES || bId === 'sun')) {
        return 'measured';
      }
      return 'procedural';
    }
    if (target.kind === 'system') {
      if (target.objectId === 'sol' && (target.galaxyId === 'milky_way' || !target.galaxyId)) {
        return 'measured';
      }
      return 'procedural';
    }
    if (target.kind === 'galaxy') {
      return isCanonicalGalaxyId(target.objectId) ? 'approximate' : 'procedural';
    }
    if (target.kind === 'black-hole') {
      return (target.objectId === 'sgra' || target.objectId === 'm31_smbh') ? 'approximate' : 'procedural';
    }
    if (target.kind === 'cosmic-anchor' || target.kind === 'cluster' || target.kind === 'observable-horizon') {
      return 'approximate';
    }
    return 'gameplay-placeholder';
  }

  /**
   * Builds the breadcrumb hierarchy according to spec:
   * UNIVERSE / LOCAL GROUP / MILKY WAY / SOL / EARTH / MANAUS
   * Without fabricating levels if they do not exist.
   */
  resolveHierarchy(
    currentLevel?: 'surface' | 'planet' | 'system' | 'galaxy' | 'cosmology' | 'atlas',
    focusBodyName?: string,
  ): readonly BreadcrumbItem[] {
    const a = this.location.address;
    const items: BreadcrumbItem[] = [];

    // Root universe level is always present
    items.push({
      id: 'universe',
      label: 'UNIVERSE',
      level: 'cosmology',
      precision: 'approximate',
      active: currentLevel === 'cosmology',
    });

    // Local Group: only present if galaxy is part of canonical Local Group catalog
    const inLocalGroup = isLocalGroupGalaxy(a.galaxyId);
    if (inLocalGroup) {
      items.push({
        id: 'local-group',
        label: 'LOCAL GROUP',
        level: 'cosmology',
        precision: 'approximate',
        active: currentLevel === 'cosmology',
      });
    }

    // Galaxy level: present if galaxyId is defined
    if (a.galaxyId) {
      const galName = formatGalaxyName(a.galaxyId).toUpperCase();
      items.push({
        id: `galaxy-${a.galaxyId}`,
        label: galName,
        level: 'galaxy',
        precision: inLocalGroup ? 'approximate' : 'procedural',
        active: currentLevel === 'galaxy',
      });
    }

    // System level: present only if systemId is defined
    if (a.systemId) {
      const sysName = a.systemId === 'sol' ? 'SOL' : `SYSTEM ${a.systemId.toUpperCase()}`;
      items.push({
        id: `system-${a.systemId}`,
        label: sysName,
        level: 'system',
        precision: a.systemId === 'sol' ? 'measured' : 'procedural',
        active: currentLevel === 'system',
      });
    }

    // Body / Planet level: present if focused on a body or address has bodyId
    const bodyId = focusBodyName ? this.systemFocusBodyId : a.bodyId;
    if (bodyId) {
      const bodyLabel = (focusBodyName ?? (bodyId === 'earth' ? 'TERRA' : bodyId)).toUpperCase();
      items.push({
        id: `body-${bodyId}`,
        label: bodyLabel,
        level: 'planet',
        precision: a.systemId === 'sol' ? 'measured' : 'procedural',
        active: currentLevel === 'planet',
      });
    }

    // Surface level: present if on surface or childFrame is specified
    if (a.childFrame && (a.childFrame.includes('manaus') || a.childFrame.includes('surface') || this.location.surface)) {
      const placeName = a.childFrame.includes('manaus') ? 'MANAUS' : 'SUPERFÍCIE';
      items.push({
        id: 'surface',
        label: placeName,
        level: 'surface',
        precision: 'measured',
        active: currentLevel === 'surface',
      });
    }

    // Atlas mode indicator
    if (currentLevel === 'atlas') {
      items.push({
        id: 'atlas',
        label: 'ATLAS CÓSMICO',
        level: 'atlas',
        precision: 'approximate',
        active: true,
      });
    }

    return items;
  }

  /**
   * Searches the universal catalog and returns standardized results.
   */
  search(
    catalog: UniversalTargetCatalog,
    rawQuery: string,
    currentGalaxyId: string = this.location.address.galaxyId,
  ): readonly MapSearchResult[] {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return [];

    const results: MapSearchResult[] = [];
    const seed = catalog.discovery?.universeSeed ?? DEFAULT_UNIVERSE_SEED;

    // Search descriptors in catalog
    for (const d of catalog.descriptors) {
      const match =
        d.displayName.toLowerCase().includes(q) ||
        d.objectId.toLowerCase().includes(q) ||
        d.kind.toLowerCase().includes(q) ||
        (d.galaxyId && d.galaxyId.toLowerCase().includes(q));

      if (match) {
        const precision = this.getPrecisionForTarget(d);
        const guidance = describeNavigationGuidance(
          d.kind === 'galaxy' && d.galaxyId !== currentGalaxyId
            ? 'intergalactic'
            : d.kind === 'system'
              ? 'intra-system'
              : 'solar',
          d.kind,
          d.galaxyId,
          currentGalaxyId,
          seed,
        );
        const isCanonical =
          d.kind === 'galaxy'
            ? isCanonicalGalaxyId(d.objectId)
            : d.objectId === 'sol' || (d.bodyId !== undefined && d.bodyId in SOLAR_BODY_PROFILES);

        results.push({
          label: d.displayName,
          kind: d.kind,
          target: d,
          precision,
          availability: guidance.status,
          guidance,
          isCanonical,
        });
      }
    }

    // Search discovery procedural galaxies
    if (catalog.discovery) {
      const foundGalaxies = catalog.discovery.search(q);
      for (const g of foundGalaxies) {
        if (!results.some(r => r.target.objectId === g.id)) {
          const d: UniversalTargetDescriptor = {
            kind: 'galaxy',
            displayName: g.name,
            objectId: g.id,
            galaxyId: g.id,
          };
          const precision: MapPrecision = g.isKnownAstronomicalEntity ? 'approximate' : 'procedural';
          const guidance = describeNavigationGuidance(
            'intergalactic',
            'galaxy',
            g.id,
            currentGalaxyId,
            seed,
          );
          results.push({
            label: g.name,
            kind: 'galaxy',
            target: d,
            precision,
            availability: guidance.status,
            guidance,
            isCanonical: g.isKnownAstronomicalEntity,
          });
        }
      }
    }

    return results;
  }

  /**
   * Formats the current location as a shareable drm:v1:// URI with exact BigInt preservation.
   */
  formatShareableUri(): string {
    return UniverseCoordinates.formatLocation(this.location);
  }
}
