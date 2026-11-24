import { enuBasis, type EnuBasis } from './ENU';
import { degToRad } from './units';

export class BuildingGeneratorContext {
  static activeOrigin = {
    latDeg: -3.1303,
    lonDeg: -60.0234,
    isManaus: true,
  };
  private static cachedBasis: EnuBasis | null = null;
  private static cachedLat = -999;
  private static cachedLon = -999;

  static getBasis(): EnuBasis {
    const { latDeg, lonDeg } = BuildingGeneratorContext.activeOrigin;
    if (!BuildingGeneratorContext.cachedBasis || latDeg !== BuildingGeneratorContext.cachedLat || lonDeg !== BuildingGeneratorContext.cachedLon) {
      BuildingGeneratorContext.cachedLat = latDeg;
      BuildingGeneratorContext.cachedLon = lonDeg;
      BuildingGeneratorContext.cachedBasis = enuBasis({
        latRad: degToRad(latDeg),
        lonRad: degToRad(lonDeg),
        heightM: 0,
      });
    }
    return BuildingGeneratorContext.cachedBasis;
  }
}

