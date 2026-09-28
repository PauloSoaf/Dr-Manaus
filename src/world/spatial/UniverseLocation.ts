import type { UniverseAddress } from './UniverseAddress';

export interface CosmologicalAddress {
  redshift: number;
  comovingDistanceM: number;
  rightAscensionRad: number;
  declinationRad: number;
}

export interface UniverseLocation {
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
  | { kind: 'surface-geodetic', bodyId: string, latDeg: number, lonDeg: number, altitudeM: number }
  | { kind: 'body-orbit', bodyId: string, altitudeM: number }
  | { kind: 'system-position', systemId: string, positionM: [number, number, number] }
  | { kind: 'cosmic-sector', galaxyId: string, sector: { x: bigint, y: bigint, z: bigint }, offsetM: [number, number, number] }
  | { kind: 'cosmological', address: CosmologicalAddress }
  | { kind: 'catalog-object', id: string };
