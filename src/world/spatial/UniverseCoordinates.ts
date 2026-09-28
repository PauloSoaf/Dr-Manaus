import type { TeleportTarget, CosmologicalAddress } from './UniverseLocation';
import { sectorIndex } from './UniverseAddress';

function parseFinite(val: string | null): number | null {
  if (val === null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function parseBigInt(val: string | null): bigint | null {
  if (val === null || val === '') return null;
  try {
    return BigInt(val);
  } catch {
    return null;
  }
}

export class UniverseCoordinates {
  static format(target: TeleportTarget): string {
    const params = new URLSearchParams();
    
    switch (target.kind) {
      case 'surface-geodetic':
        params.set('kind', 'surface');
        if (target.galaxyId) params.set('gal', target.galaxyId);
        if (target.systemId) params.set('sys', target.systemId);
        params.set('body', target.bodyId);
        params.set('lat', target.latDeg.toFixed(6));
        params.set('lon', target.lonDeg.toFixed(6));
        params.set('alt', target.altitudeM.toFixed(1));
        break;
      case 'body-orbit':
        params.set('kind', 'orbit');
        if (target.galaxyId) params.set('gal', target.galaxyId);
        if (target.systemId) params.set('sys', target.systemId);
        params.set('body', target.bodyId);
        params.set('alt', target.altitudeM.toFixed(1));
        break;
      case 'system-position':
        params.set('kind', 'system');
        if (target.galaxyId) params.set('gal', target.galaxyId);
        params.set('sys', target.systemId);
        params.set('x', target.positionM[0].toFixed(1));
        params.set('y', target.positionM[1].toFixed(1));
        params.set('z', target.positionM[2].toFixed(1));
        break;
      case 'cosmic-sector':
        params.set('kind', 'sector');
        params.set('gal', target.galaxyId);
        params.set('sx', target.sector.x.toString());
        params.set('sy', target.sector.y.toString());
        params.set('sz', target.sector.z.toString());
        params.set('ox', target.offsetM[0].toFixed(1));
        params.set('oy', target.offsetM[1].toFixed(1));
        params.set('oz', target.offsetM[2].toFixed(1));
        break;
      case 'cosmological':
        params.set('kind', 'cosmo');
        if (target.address.cell) {
          params.set('cx', target.address.cell.x.toString());
          params.set('cy', target.address.cell.y.toString());
          params.set('cz', target.address.cell.z.toString());
        }
        if (target.address.localMpc) {
          params.set('mx', target.address.localMpc[0].toFixed(4));
          params.set('my', target.address.localMpc[1].toFixed(4));
          params.set('mz', target.address.localMpc[2].toFixed(4));
        }
        if (target.address.redshift !== undefined) params.set('z', target.address.redshift.toFixed(6));
        if (target.address.comovingDistanceM !== undefined) params.set('d', target.address.comovingDistanceM.toFixed(1));
        if (target.address.rightAscensionRad !== undefined) params.set('ra', target.address.rightAscensionRad.toFixed(6));
        if (target.address.declinationRad !== undefined) params.set('dec', target.address.declinationRad.toFixed(6));
        break;
      case 'catalog-object':
        params.set('kind', 'catalog');
        params.set('id', target.id);
        break;
    }
    
    return `drm:v1://?${params.toString()}`;
  }

  static parse(uri: string): TeleportTarget | null {
    if (typeof uri !== 'string' || !uri.startsWith('drm:v1://?')) return null;
    
    const paramsString = uri.slice(10);
    const params = new URLSearchParams(paramsString);
    const kind = params.get('kind');
    if (!kind) return null;
    
    try {
      if (kind === 'surface') {
        const bodyId = params.get('body');
        const lat = parseFinite(params.get('lat'));
        const lon = parseFinite(params.get('lon'));
        const alt = parseFinite(params.get('alt'));
        
        if (!bodyId || lat === null || lon === null || alt === null) return null;
        if (lat < -90 || lat > 90) return null;
        if (lon < -360 || lon > 360) return null;
        if (alt < -15_000 || alt > 1e12) return null;
        
        return {
          kind: 'surface-geodetic',
          galaxyId: params.get('gal') || undefined,
          systemId: params.get('sys') || undefined,
          bodyId,
          latDeg: lat,
          lonDeg: lon,
          altitudeM: alt,
        };
      }
      
      if (kind === 'orbit') {
        const bodyId = params.get('body');
        const alt = parseFinite(params.get('alt'));
        if (!bodyId || alt === null || alt < 0 || alt > 1e15) return null;
        
        return {
          kind: 'body-orbit',
          galaxyId: params.get('gal') || undefined,
          systemId: params.get('sys') || undefined,
          bodyId,
          altitudeM: alt,
        };
      }
      
      if (kind === 'system') {
        const systemId = params.get('sys');
        const x = parseFinite(params.get('x'));
        const y = parseFinite(params.get('y'));
        const z = parseFinite(params.get('z'));
        if (!systemId || x === null || y === null || z === null) return null;
        
        return {
          kind: 'system-position',
          galaxyId: params.get('gal') || undefined,
          systemId,
          positionM: [x, y, z],
        };
      }
      
      if (kind === 'sector') {
        const galaxyId = params.get('gal');
        const sx = parseBigInt(params.get('sx'));
        const sy = parseBigInt(params.get('sy'));
        const sz = parseBigInt(params.get('sz'));
        const ox = parseFinite(params.get('ox'));
        const oy = parseFinite(params.get('oy'));
        const oz = parseFinite(params.get('oz'));
        
        if (!galaxyId || sx === null || sy === null || sz === null || ox === null || oy === null || oz === null) {
          return null;
        }
        
        return {
          kind: 'cosmic-sector',
          galaxyId,
          sector: sectorIndex(sx, sy, sz),
          offsetM: [ox, oy, oz],
        };
      }
      
      if (kind === 'cosmo') {
        const cx = parseBigInt(params.get('cx')) ?? 0n;
        const cy = parseBigInt(params.get('cy')) ?? 0n;
        const cz = parseBigInt(params.get('cz')) ?? 0n;
        const mx = parseFinite(params.get('mx')) ?? 0;
        const my = parseFinite(params.get('my')) ?? 0;
        const mz = parseFinite(params.get('mz')) ?? 0;
        
        const z = parseFinite(params.get('z'));
        const d = parseFinite(params.get('d'));
        const ra = parseFinite(params.get('ra'));
        const dec = parseFinite(params.get('dec'));

        const addr: CosmologicalAddress = {
          cell: { x: cx, y: cy, z: cz },
          localMpc: [mx, my, mz],
          epoch: parseFinite(params.get('epoch')) ?? 0,
          redshift: z !== null ? z : undefined,
          comovingDistanceM: d !== null ? d : undefined,
          rightAscensionRad: ra !== null ? ra : undefined,
          declinationRad: dec !== null ? dec : undefined,
        };
        
        return {
          kind: 'cosmological',
          address: addr,
        };
      }
      
      if (kind === 'catalog') {
        const id = params.get('id');
        if (!id || id.trim().length === 0) return null;
        return {
          kind: 'catalog-object',
          id,
        };
      }
    } catch {
      return null;
    }
    
    return null;
  }
}
