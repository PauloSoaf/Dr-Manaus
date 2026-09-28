import type { TeleportTarget, CosmologicalAddress } from './UniverseLocation';
import { sectorIndex } from './UniverseAddress';

export class UniverseCoordinates {
  static format(target: TeleportTarget): string {
    const params = new URLSearchParams();
    
    switch (target.kind) {
      case 'surface-geodetic':
        params.set('kind', 'surface');
        params.set('body', target.bodyId);
        params.set('lat', target.latDeg.toFixed(6));
        params.set('lon', target.lonDeg.toFixed(6));
        params.set('alt', target.altitudeM.toFixed(1));
        break;
      case 'body-orbit':
        params.set('kind', 'orbit');
        params.set('body', target.bodyId);
        params.set('alt', target.altitudeM.toFixed(1));
        break;
      case 'system-position':
        params.set('kind', 'system');
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
        params.set('z', target.address.redshift.toFixed(6));
        params.set('d', target.address.comovingDistanceM.toFixed(1));
        params.set('ra', target.address.rightAscensionRad.toFixed(6));
        params.set('dec', target.address.declinationRad.toFixed(6));
        break;
      case 'catalog-object':
        params.set('kind', 'catalog');
        params.set('id', target.id);
        break;
    }
    
    return `drm:v1://?${params.toString()}`;
  }

  static parse(uri: string): TeleportTarget | null {
    if (!uri.startsWith('drm:v1://?')) return null;
    
    const paramsString = uri.slice(10);
    const params = new URLSearchParams(paramsString);
    const kind = params.get('kind');
    
    try {
      if (kind === 'surface') {
        return {
          kind: 'surface-geodetic',
          bodyId: params.get('body') || 'earth',
          latDeg: Number(params.get('lat')),
          lonDeg: Number(params.get('lon')),
          altitudeM: Number(params.get('alt'))
        };
      }
      
      if (kind === 'orbit') {
        return {
          kind: 'body-orbit',
          bodyId: params.get('body') || 'earth',
          altitudeM: Number(params.get('alt'))
        };
      }
      
      if (kind === 'system') {
        return {
          kind: 'system-position',
          systemId: params.get('sys') || 'sol',
          positionM: [
            Number(params.get('x')),
            Number(params.get('y')),
            Number(params.get('z'))
          ]
        };
      }
      
      if (kind === 'sector') {
        return {
          kind: 'cosmic-sector',
          galaxyId: params.get('gal') || 'milky_way',
          sector: sectorIndex(
            BigInt(params.get('sx') || '0'),
            BigInt(params.get('sy') || '0'),
            BigInt(params.get('sz') || '0')
          ),
          offsetM: [
            Number(params.get('ox')),
            Number(params.get('oy')),
            Number(params.get('oz'))
          ]
        };
      }
      
      if (kind === 'cosmo') {
        return {
          kind: 'cosmological',
          address: {
            redshift: Number(params.get('z')),
            comovingDistanceM: Number(params.get('d')),
            rightAscensionRad: Number(params.get('ra')),
            declinationRad: Number(params.get('dec'))
          }
        };
      }
      
      if (kind === 'catalog') {
        return {
          kind: 'catalog-object',
          id: params.get('id') || ''
        };
      }
    } catch (e) {
      return null;
    }
    
    return null;
  }
}
