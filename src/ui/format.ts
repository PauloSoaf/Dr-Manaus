/**
 * Units for distances and speeds that span a street and a solar system.
 *
 * One place, because the HUD and the map panel have to agree: a destination list saying
 * "384 400 km" beside a map saying "0.00 AU" is two readouts disagreeing about the same number.
 *
 * Precision is kept where it matters. Switching to astronomical units at the first opportunity
 * reads tidily and loses the difference between low orbit and geostationary, so the threshold is
 * high enough that the smaller unit is still legible when it hands over.
 */

import { AU_M, LIGHT_YEAR_M, PARSEC_M } from '../world/spatial/units';
const LIGHT_SPEED_MPS = 299_792_458;

export const formatGalaxyName=(id:string|undefined):string=>id==='milky_way'?'Milky Way':id==='andromeda'?'Andromeda':id??'Cosmos';

/** A distance in metres, in whichever unit keeps it readable without losing the scale. */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return '—';
  const sign = metres < 0 ? '-' : '';
  const value = Math.abs(metres);
  if (value >= 1e9 * PARSEC_M) return `${sign}${(value / (1e9 * PARSEC_M)).toFixed(2)} Gpc`;
  if (value >= 10e6 * PARSEC_M) return `${sign}${(value / (1e6 * PARSEC_M)).toFixed(2)} Mpc`;
  if (value >= 1e6 * LIGHT_YEAR_M) return `${sign}${(value / (1e6 * LIGHT_YEAR_M)).toFixed(2)} Mly`;
  if (value >= 1e3 * LIGHT_YEAR_M) return `${sign}${(value / (1e3 * LIGHT_YEAR_M)).toFixed(2)} kly`;
  if (value >= .1 * LIGHT_YEAR_M) return `${sign}${(value / LIGHT_YEAR_M).toFixed(2)} ly`;
  if (value < 1_000) return `${sign}${Math.round(value)} m`;
  if (value < 1_000_000) return `${sign}${(value / 1_000).toFixed(1)} km`;
  if (value < 1_000_000_000) return `${sign}${Math.round(value / 1_000).toLocaleString('pt-BR')} km`;
  // Past a million kilometres, kilometres stop being a quantity anyone reads.
  if (value < 0.5 * AU_M) return `${sign}${(value / 1_000_000_000).toFixed(2)} M km`;
  return `${sign}${(value / AU_M).toFixed(3)} UA`;
}

/** A speed in metres per second, up to and past the speed of light. */
export function formatSpeed(metresPerSecond: number): { value: string; unit: string } {
  if (!Number.isFinite(metresPerSecond)) return { value: '—', unit: '' };
  const value = Math.abs(metresPerSecond);
  if (value >= 0.01 * LIGHT_SPEED_MPS) {
    return { value: (value / LIGHT_SPEED_MPS).toFixed(3), unit: 'c' };
  }
  if (value >= 50_000) return { value: Math.round(value / 1_000).toLocaleString('pt-BR'), unit: 'km/s' };
  if (value >= 1_000) return { value: (value / 1_000).toFixed(1), unit: 'km/s' };
  return { value: Math.round(value * 3.6).toLocaleString('pt-BR'), unit: 'km/h' };
}

/** Seconds as a duration a player can act on. */
export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 90) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 90) return `${minutes} min ${Math.round(seconds % 60)} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
