/**
 * RealCity and Urban Topography System for DR-MANAUS.
 * Consolidates real georeferenced city assets, continuous bilinear elevation,
 * road ribbons, and cut-and-fill foundation terracing.
 */

export {
  ManausGISProjector,
} from './ManausGISProjector';

export {
  VectorTileCache,
  type CachedVectorTile,
} from './VectorTileCache';

export {
  ElevationModel,
  ManausUrbanElevation,
  getManausTerrainHeight,
  getManausTerrainNormal,
  type FootprintElevationResult,
  type Point2D,
} from './ManausUrbanElevation';

export {
  RealCityLayer,
  type RealCityManifest,
  type RealCityStats,
} from './RealCityLayer';

export {
  RoadNetwork,
  ROAD_HEIGHT,
  ROAD_MARKING_LIFT,
  ROAD_MAX_HEIGHT,
  roadHeightOf,
  ARTERIAL_CLASSES,
  type RoadRecord,
  type RoadStats,
} from './roads';

export {
  RealCityMaterials,
} from './materials';

export {
  appendNearBuilding,
  appendShellBuilding,
  buildingExtent,
  createBuffers,
  districtCharacter,
  setDistrictSampler,
  type MeshBuffers,
  type RealBuilding,
  type NearOptions,
} from './buildingGeometry';

