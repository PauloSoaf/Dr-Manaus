import type { BlackHoleDefinition } from '../providers/BlackHoleProvider';
import { LIGHT_YEAR_M, type Vec3 } from '../spatial/units';

/** Existing StarSector convention: the Solar-relative sector grid puts the MW centre on +X. */
export const GALACTIC_CENTRE_FROM_SOL_M:Vec3 = [26_000 * LIGHT_YEAR_M,0,0];

export type GalaxyDensityProfile = 'milky-way' | 'andromeda' | 'elliptical' | 'irregular';

export interface GalaxyDefinition {
  id: string;
  name: string;
  /** Sector zero relative to this galaxy's centre, in galaxy-local axes. */
  addressOriginM: Vec3;
  type: 'barred-spiral' | 'spiral' | 'elliptical' | 'irregular';
  diameterLy: number;
  thicknessLy: number;
  // Position of the galaxy center relative to the Milky Way galactic center (or Local Group center)
  // For simplicity, we can define it relative to the Solar System if we want, but usually it's relative to MW.
  positionM: [number, number, number];
  orientationEuler?: [number, number, number]; // x, y, z rotation in radians
  densityProfile: GalaxyDensityProfile;
  densityScale?: number;
  centralBlackHole?: BlackHoleDefinition;
}

export const LOCAL_GROUP_CATALOG: GalaxyDefinition[] = [
  {
    id: 'milky_way',
    name: 'Milky Way',
    addressOriginM: [-GALACTIC_CENTRE_FROM_SOL_M[0],0,0],
    type: 'barred-spiral',
    diameterLy: 100_000,
    thicknessLy: 1_000,
    positionM: [0, 0, 0], // Center of MW is origin for our intergalactic coordinate system
    densityProfile: 'milky-way',
    centralBlackHole: {
      id: 'sgra',
      massKg: 8.26e36, // 4.15 million solar masses
      spin01: 0.9,
      positionM: [0, 0, 0],
      accretion: {
        innerRadiusRs: 3,
        outerRadiusRs: 20,
        temperatureK: 1e6,
        luminosity: 1e36
      }
    }
  },
  {
    id: 'andromeda',
    name: 'Andromeda',
    addressOriginM: [0,0,0],
    type: 'spiral',
    diameterLy: 220_000,
    thicknessLy: 2_000,
    // Distance to Andromeda is ~2.5 million light years.
    // 2.5 million ly = 2.5e6 * 9.46e15 = 2.365e22 meters.
    // We'll place it somewhat arbitrarily on the Y axis for now.
    positionM: [0, 2.365e22, 0], 
    orientationEuler: [Math.PI / 4, Math.PI / 6, 0], // Tilted relative to us
    densityProfile: 'andromeda',
    densityScale: 1.5, // Denser than MW
    centralBlackHole: {
      id: 'm31_smbh',
      massKg: 2e38, // ~100 million solar masses
      spin01: 0.8,
      positionM: [0, 2.365e22, 0],
      accretion: {
        innerRadiusRs: 5,
        outerRadiusRs: 30,
        temperatureK: 2e6,
        luminosity: 1e38
      }
    }
  }
];
