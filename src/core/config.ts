export const WORLD = {
  chunkSize: 128, detailRadius: 480, mediumRadius: 1350, aggregateRadius: 5400,
  horizonRadius: 24000, hysteresis: 64, maxActiveChunks: 64, maxCachedChunks: 30,
  maxRequests: 4, streamingBudgetMs: 4, prefetchSeconds: 2.8, originThreshold: 2048,
  maxNPCs: 32, maxVehicles: 20, maxParticles: 600, maxPhysicsBodies: 96,
  groundY: 0, waterY: -3, spawn: { x: 0, y: 38.5, z: 0 },
} as const;
/** Streaming and representation bands for the compiled Overture/OpenStreetMap city. */
export const REAL_CITY = {
  tileSize: 1024,
  /** Near tier: facades, windows, roofs and collision, promoted per 256 m cell. */
  detailEnter: 340, detailExit: 400,
  /** Shell tier: real footprints in flat colour, measured to the tile footprint. */
  shellRadius: 1850, shellRadiusCruise: 1500, shellRadiusFast: 1050,
  evictMargin: 600, planStep: 220, planInterval: .4, maxTiles: 24, maxConcurrentLoads: 3,
  /** Above these speeds the ring narrows and the near tier stands down entirely. */
  fastSpeed: 700, megaSpeed: 2400, detailSpeedLimit: 620,
  /** Prediction: the ring rides ahead of the player instead of loading what is behind. */
  leadSeconds: 1.6, maxLead: 3200,
  buildBudgetMs: 3.5,
  /** The physical region is far smaller than the visible one at every flight speed. */
  maxColliders: 900,
} as const;

/** Altitude bands for the flight-to-orbit transition. */
export const SPACE = {
  atmosphereTop: 9000, karman: 26000, orbit: 60000, maxAltitude: 140000,
} as const;
export const QUALITY = {
  Low: { pixelRatio: .7, shadows: false, detailRadius: 280, npcs: 10, vehicles: 7, particles: 160 },
  Medium: { pixelRatio: 1, shadows: true, detailRadius: 380, npcs: 20, vehicles: 12, particles: 300 },
  High: { pixelRatio: 1.35, shadows: true, detailRadius: 480, npcs: 32, vehicles: 20, particles: 450 },
  Ultra: { pixelRatio: 1.75, shadows: true, detailRadius: 600, npcs: 40, vehicles: 28, particles: 600 },
} as const;
export type QualityPreset = keyof typeof QUALITY;
