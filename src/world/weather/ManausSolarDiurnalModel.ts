/**
 * ManausSolarDiurnalModel.ts
 *
 * Rigorous equatorial solar and lunar astronomical model for Manaus, Amazonas:
 * - Latitude: -3.119028° (South of Equator)
 * - Longitude: -60.021731° (UTC-4 time zone, Western Amazonia)
 *
 * Implements analytical NOAA solar position algorithms:
 * - Solar declination angle delta(dayOfYear)
 * - Equation of time and solar hour angle H(hourOfDay)
 * - Exact solar elevation (altitude angle) and solar azimuth
 * - Equatorial diurnal trajectory: rises ~06:00 almost due East (azimuth ~90°),
 *   reaches near-zenith elevation (>85°) at solar noon (12:00),
 *   sets ~18:00 almost due West (azimuth ~270°).
 *
 * Guarantees zero runtime heap allocation inside animation ticks.
 */

import { Vector3 } from 'three';

export const MANAUS_COORDINATES = {
  latitudeDeg: -3.119028,
  longitudeDeg: -60.021731,
  latitudeRad: (-3.119028 * Math.PI) / 180,
  longitudeRad: (-60.021731 * Math.PI) / 180,
  timeZoneOffsetHours: -4.0
} as const;

export interface SolarPositionSample {
  elevationRad: number;
  elevationDeg: number;
  azimuthRad: number;
  azimuthDeg: number;
  direction: Vector3;
  isDaylight: boolean;
  goldenHourFactor: number; // 0 to 1 peak during sunrise/sunset
  sunDiskScale: number;
}

export interface MoonPositionSample {
  direction: Vector3;
  phaseFraction: number;
  elevationRad: number;
  elevationDeg: number;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Calculates solar declination in radians for a given day of year [1..365].
 * Declination ranges approximately between -23.44° (Dec solstice) and +23.44° (Jun solstice).
 */
export function calculateSolarDeclinationRad(dayOfYear: number): number {
  const safeDay = Number.isFinite(dayOfYear) ? Math.max(1, Math.min(365, dayOfYear)) : 80;
  // Cooper's equation for solar declination
  const angleRad = ((360 / 365) * (284 + safeDay)) * DEG2RAD;
  return 23.45 * DEG2RAD * Math.sin(angleRad);
}

/**
 * Computes solar position at Manaus for a given local decimal hour [0..24) and day of year.
 * Populates outSample with zero heap allocations.
 */
export function sampleManausSunPosition(
  localHour: number,
  dayOfYear: number = 80, // Default near autumnal equinox
  out?: SolarPositionSample
): SolarPositionSample {
  const safeHour = Number.isFinite(localHour) ? ((localHour % 24) + 24) % 24 : 12.0;
  const safeDay = Number.isFinite(dayOfYear) ? Math.max(1, Math.min(365, dayOfYear)) : 80;

  const result: SolarPositionSample = out || {
    elevationRad: 0,
    elevationDeg: 0,
    azimuthRad: 0,
    azimuthDeg: 0,
    direction: new Vector3(0, 1, 0),
    isDaylight: false,
    goldenHourFactor: 0,
    sunDiskScale: 1.0
  };

  const latRad = MANAUS_COORDINATES.latitudeRad;
  const declinationRad = calculateSolarDeclinationRad(safeDay);

  // Hour angle H: 0 at solar noon (12:00), 15 degrees per hour
  // H < 0 in morning, H > 0 in afternoon
  const hourAngleRad = (safeHour - 12.0) * 15.0 * DEG2RAD;

  // Solar elevation: sin(alpha) = sin(phi)*sin(delta) + cos(phi)*cos(delta)*cos(H)
  const sinAlpha = Math.sin(latRad) * Math.sin(declinationRad) +
                   Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);
  
  const elevationRad = Math.asin(Math.max(-1.0, Math.min(1.0, sinAlpha)));
  const elevationDeg = elevationRad * RAD2DEG;

  // Solar azimuth: cos(gamma) = (sin(delta) - sin(phi)*sin(alpha)) / (cos(phi)*cos(alpha))
  const cosAlpha = Math.cos(elevationRad);
  let azimuthRad = 0;

  if (Math.abs(cosAlpha) > 1e-5) {
    const cosGamma = (Math.sin(declinationRad) - Math.sin(latRad) * sinAlpha) / (Math.cos(latRad) * cosAlpha);
    const clampedCosGamma = Math.max(-1.0, Math.min(1.0, Number.isFinite(cosGamma) ? cosGamma : 0));
    const rawAzimuth = Math.acos(clampedCosGamma);

    // Azimuth measured from South or North:
    // When hourAngle > 0 (afternoon), azimuth is 360 - raw
    azimuthRad = hourAngleRad > 0 ? (2 * Math.PI - rawAzimuth) : rawAzimuth;
  }

  const azimuthDeg = azimuthRad * RAD2DEG;

  // Cartesian unit vector in ENU coordinates:
  // X = East, Y = Up, Z = -North (Three.js standard camera space: Z negative is North)
  const dirX = cosAlpha * Math.sin(azimuthRad);
  const dirY = Math.sin(elevationRad);
  const dirZ = -cosAlpha * Math.cos(azimuthRad);

  result.direction.set(dirX, dirY, dirZ);
  if (result.direction.lengthSq() > 1e-6) {
    result.direction.normalize();
  } else {
    result.direction.set(0, 1, 0);
  }

  result.elevationRad = elevationRad;
  result.elevationDeg = elevationDeg;
  result.azimuthRad = azimuthRad;
  result.azimuthDeg = azimuthDeg;
  result.isDaylight = elevationRad > -0.05; // Astronomical twilight threshold

  // Golden hour factor: peaks when elevation is between -0.05 rad and +0.22 rad (0° to ~12°)
  if (elevationRad >= -0.05 && elevationRad <= 0.22) {
    const t = (elevationRad - (-0.05)) / (0.22 - (-0.05));
    // Bell curve peaked near horizon
    result.goldenHourFactor = Math.sin(t * Math.PI);
  } else {
    result.goldenHourFactor = 0;
  }

  // Apparent sun disk enlargement near horizon due to atmospheric refraction & illusion
  result.sunDiskScale = 1.0 + Math.max(0, 0.35 * (1.0 - Math.max(0, Math.sin(Math.max(0, elevationRad)))));

  return result;
}

/**
 * Estimates lunar position and illumination fraction in Manaus sky.
 */
export function sampleManausMoonPosition(
  localHour: number,
  lunarAgeDays: number = 14.76, // 0 = New Moon, 14.76 = Full Moon, 29.53 = Cycle end
  out?: MoonPositionSample | Vector3
): MoonPositionSample {
  const safeAge = Number.isFinite(lunarAgeDays) ? ((lunarAgeDays % 29.53) + 29.53) % 29.53 : 14.76;
  const safeHour = Number.isFinite(localHour) ? ((localHour % 24) + 24) % 24 : 0.0;

  let target: MoonPositionSample;
  if (out && 'phaseFraction' in out) {
    target = out;
  } else {
    target = {
      direction: out instanceof Vector3 ? out : new Vector3(),
      phaseFraction: 0,
      elevationRad: 0,
      elevationDeg: 0
    };
  }

  // At new moon (age = 0), moon tracks with sun (same hour).
  // At full moon (age = 14.76), moon is opposite sun (+12 hours).
  const synodicProgress = safeAge / 29.53;
  const moonHour = (safeHour + synodicProgress * 24.0) % 24.0;

  const latRad = MANAUS_COORDINATES.latitudeRad;
  const moonDeclinationRad = 5.14 * DEG2RAD * Math.sin(synodicProgress * 2 * Math.PI);
  const hourAngleRad = (moonHour - 12.0) * 15.0 * DEG2RAD;

  const sinAlpha = Math.sin(latRad) * Math.sin(moonDeclinationRad) +
                   Math.cos(latRad) * Math.cos(moonDeclinationRad) * Math.cos(hourAngleRad);
  const elevationRad = Math.asin(Math.max(-1.0, Math.min(1.0, sinAlpha)));
  const elevationDeg = elevationRad * RAD2DEG;
  const cosAlpha = Math.cos(elevationRad);
  const azimuthRad = hourAngleRad > 0 ? (Math.PI * 1.5) : (Math.PI * 0.5);

  target.direction.set(cosAlpha * Math.sin(azimuthRad), Math.sin(elevationRad), -cosAlpha * Math.cos(azimuthRad));
  if (target.direction.lengthSq() > 1e-6) {
    target.direction.normalize();
  } else {
    target.direction.set(0, 1, 0);
  }

  // Phase fraction: 0.0 (new moon) to 1.0 (full moon)
  target.phaseFraction = 0.5 * (1.0 - Math.cos(synodicProgress * 2 * Math.PI));
  target.elevationRad = elevationRad;
  target.elevationDeg = elevationDeg;

  return target;
}
