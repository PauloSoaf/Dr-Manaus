/**
 * Astrophysical world model definition for black holes.
 *
 * Separates core physical definitions from Three.js GPU presentation providers
 * to ensure clean layered architecture across celestial and galactic systems.
 */

export interface BlackHoleAccretionDefinition {
  readonly innerRadiusRs: number;
  readonly outerRadiusRs: number;
  readonly temperatureK: number;
  readonly luminosity: number;
}

export interface BlackHoleDefinition {
  readonly id: string;
  readonly name?: string;
  readonly massKg: number;
  readonly spin01: number; // Dimensionless Kerr parameter in [0, 0.998]
  readonly positionM: [number, number, number]; // Galactic or system-local frame
  readonly accretion?: BlackHoleAccretionDefinition;
}

