export const WORLD = {
  chunkSize: 128, detailRadius: 480, mediumRadius: 1350, aggregateRadius: 5400,
  horizonRadius: 24000, hysteresis: 64, maxActiveChunks: 64, maxCachedChunks: 30,
  maxRequests: 4, streamingBudgetMs: 4, prefetchSeconds: 2.8, originThreshold: 2048,
  maxNPCs: 32, maxVehicles: 20, maxParticles: 600, maxPhysicsBodies: 96,
  groundY: 0, waterY: -3, spawn: { x: 0, y: 38.5, z: 0 },
} as const;
export const QUALITY = {
  Low: { pixelRatio: .7, shadows: false, detailRadius: 280, npcs: 10, vehicles: 7, particles: 160 },
  Medium: { pixelRatio: 1, shadows: true, detailRadius: 380, npcs: 20, vehicles: 12, particles: 300 },
  High: { pixelRatio: 1.35, shadows: true, detailRadius: 480, npcs: 32, vehicles: 20, particles: 450 },
  Ultra: { pixelRatio: 1.75, shadows: true, detailRadius: 600, npcs: 40, vehicles: 28, particles: 600 },
} as const;
export type QualityPreset = keyof typeof QUALITY;
