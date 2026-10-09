import type { UniversalTransitState } from '../travel/UniversalTravelController';
import type { UniverseAddress, CosmologicalAddress } from './UniverseAddress';

export type { CosmologicalAddress };

export interface UniverseLocation {
  /** Address is retained source metadata during transit; transit is the location authority. */
  mode?:'anchored'|'transit';
  transit?:UniversalTransitState;
  address: UniverseAddress;
  frameId: string;

  surface?: {
    latDeg: number;
    lonDeg: number;
    altitudeM: number;
  };

  systemPositionM?: [number, number, number];
  sectorOffsetM?: [number, number, number];
  cosmological?: CosmologicalAddress;
}

export type TeleportTarget = 
  | { kind: 'surface-geodetic', galaxyId?: string, systemId?: string, bodyId: string, latDeg: number, lonDeg: number, altitudeM: number }
  | { kind: 'body-orbit', galaxyId?: string, systemId?: string, bodyId: string, altitudeM: number }
  | { kind: 'system-position', galaxyId?: string, systemId: string, positionM: [number, number, number] }
  | { kind: 'cosmic-sector', galaxyId: string, sector: { x: bigint, y: bigint, z: bigint }, offsetM: [number, number, number] }
  | { kind: 'cosmological', address: CosmologicalAddress }
  | { kind: 'catalog-object', id: string };
